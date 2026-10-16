import { createHash, randomBytes } from 'node:crypto'
import {
  constants,
  lstatSync,
  realpathSync,
  type Stats
} from 'node:fs'
import { link, lstat, mkdtemp, open, readdir, realpath, rename, rm } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { tmpdir } from 'node:os'
import { basename, dirname, isAbsolute, join, relative, resolve, sep, win32 } from 'node:path'

const MAX_PATH_LENGTH = 1024
const MAX_FILE_BYTES = 512 * 1024
const MAX_LIST_FILES = 200
const MAX_LIST_DEPTH = 4
const MAX_CHECK_OUTPUT_BYTES = 32 * 1024
const CHECK_TIMEOUT_MS = 120_000
const CHECK_KILL_GRACE_MS = 1_500

const BLOCKED_DIRECTORIES = new Set([
  '.git',
  'node_modules',
  'auth',
  'credential',
  'credentials',
  'secret',
  'secrets',
  '.ssh',
  '.gnupg'
])

const BLOCKED_KEY_EXTENSIONS = new Set(['.pem', '.key', '.p12', '.pfx', '.p8', '.kdbx'])

export interface WorkspaceFile {
  path: string
  text: string
  hash: string
}

export interface WorkspaceEditResult {
  path: string
  hash: string
}

export interface WorkspaceCheckResult {
  ok: boolean
  exitCode: number | null
  output: string
}

interface ResolvedPath {
  absolute: string
  path: string
  exists: boolean
}

/**
 * Small opt-in coding workspace rooted at one canonical directory.
 *
 * This limits paths, file sizes, and check-command inheritance, but it is NOT
 * an OS sandbox. An operator-configured check executable can still access the
 * host with the desktop user's permissions and can read the workspace itself.
 */
export class Workspace {
  readonly root: string
  private readonly checkCommand?: readonly string[]

  constructor(root: string, checkCommand?: string[]) {
    if (!root.trim()) throw new Error('Workspace root must be a non-empty path.')

    let canonicalRoot: string
    try {
      canonicalRoot = realpathSync(resolve(root))
    } catch (error) {
      throw new Error(`Workspace root is unavailable: ${messageOf(error)}`)
    }

    let rootInfo: Stats
    try {
      rootInfo = lstatSync(canonicalRoot)
    } catch (error) {
      throw new Error(`Workspace root is unavailable: ${messageOf(error)}`)
    }
    if (!rootInfo.isDirectory()) throw new Error('Workspace root must be a directory.')

    if (checkCommand !== undefined) {
      if (!Array.isArray(checkCommand) || checkCommand.length === 0) {
        throw new Error('Workspace check command must contain an executable and optional arguments.')
      }
      if (checkCommand.some((part) => typeof part !== 'string' || part.includes('\0'))) {
        throw new Error('Workspace check command arguments must be valid strings.')
      }
      if (!checkCommand[0].trim()) throw new Error('Workspace check executable must not be empty.')
      this.checkCommand = Object.freeze([...checkCommand])
    }

    this.root = canonicalRoot
  }

  /** List at most 200 files within four directory levels, as root-relative paths. */
  async list(relativePath = '.'): Promise<string[]> {
    const target = await this.resolvePath(relativePath, { allowRoot: true })
    if (!target.exists) throw new Error(`Workspace directory does not exist: ${target.path}`)

    let info: Stats
    try {
      info = await lstat(target.absolute)
    } catch (error) {
      throw new Error(`Unable to inspect workspace directory ${target.path}: ${messageOf(error)}`)
    }
    if (!info.isDirectory()) throw new Error(`Workspace path is not a directory: ${target.path}`)

    const files: string[] = []
    let truncated = false
    let visited = 0
    const visit = async (directory: string, prefix: string, depth: number): Promise<void> => {
      if (truncated) return
      let entries
      try {
        entries = await readdir(directory, { withFileTypes: true })
      } catch (error) {
        throw new Error(`Unable to list workspace directory ${prefix || '.'}: ${messageOf(error)}`)
      }

      entries.sort((a, b) => a.name.localeCompare(b.name))
      for (const entry of entries) {
        if (truncated) break
        visited++
        if (visited > 2_000) {
          throw new Error('Workspace listing reached its 2000-entry scan limit; list a narrower directory.')
        }
        const entryPath = prefix ? `${prefix}/${entry.name}` : entry.name
        if (!isAllowedPath(entryPath)) continue

        const absolute = join(directory, entry.name)
        let entryInfo: Stats
        try {
          entryInfo = await lstat(absolute)
        } catch (error) {
          throw new Error(`Unable to inspect workspace path ${entryPath}: ${messageOf(error)}`)
        }
        // Do not traverse or report symlinks. This prevents list from following
        // a link that leaves the root, including links swapped after readdir.
        if (entryInfo.isSymbolicLink()) continue
        await this.assertWithinRoot(absolute)
        if (entryInfo.isDirectory()) {
          if (depth < MAX_LIST_DEPTH) await visit(absolute, entryPath, depth + 1)
          else truncated = true
        } else if (entryInfo.isFile()) {
          if (files.length >= MAX_LIST_FILES) truncated = true
          else files.push(entryPath)
        }
      }
    }

    await visit(target.absolute, target.path === '.' ? '' : target.path, 0)
    if (truncated) throw new Error('Workspace listing exceeded its 200-file or four-level limit; list a narrower directory.')
    return files
  }

  async read(relativePath: string): Promise<WorkspaceFile> {
    const target = await this.resolvePath(relativePath)
    if (!target.exists) throw new Error(`Workspace file does not exist: ${target.path}`)
    const file = await this.readResolvedFile(target)
    return { path: target.path, text: file.text, hash: file.hash }
  }

  /** Replace one exact, unique text span after verifying the hash from read(). */
  async edit(
    relativePath: string,
    oldText: string,
    newText: string,
    expectedHash: string
  ): Promise<WorkspaceEditResult> {
    if (typeof oldText !== 'string' || typeof newText !== 'string') {
      throw new Error('Workspace edit text must be strings.')
    }
    if (typeof expectedHash !== 'string' || !/^(?:new|[a-f0-9]{64})$/i.test(expectedHash)) {
      throw new Error('Workspace edit requires the current SHA-256 hash from read(), or "new" for file creation.')
    }
    if (expectedHash.toLowerCase() === 'new' && oldText !== '') {
      throw new Error('Creating a workspace file requires oldText to be empty.')
    }
    if (expectedHash.toLowerCase() !== 'new' && oldText === '') {
      throw new Error('Workspace edit oldText must not be empty for an existing file.')
    }
    if (oldText === newText) throw new Error('Workspace edit would make no changes.')

    const target = await this.resolvePath(relativePath, { allowMissingFinal: true })
    if (expectedHash.toLowerCase() === 'new') {
      if (target.exists) throw new Error(`Workspace file already exists: ${target.path}`)
      const parent = await this.resolvePath(dirname(target.path), { allowRoot: true })
      if (!parent.exists) throw new Error(`Workspace parent directory does not exist: ${dirname(target.path)}`)
      const parentInfo = await lstat(parent.absolute)
      if (!parentInfo.isDirectory()) throw new Error(`Workspace parent is not a directory: ${parent.path}`)
      await this.assertWithinRoot(parent.absolute)

      const bytes = Buffer.from(newText, 'utf8')
      this.assertFileSize(bytes.length, target.path)
      const tempPath = join(parent.absolute, `.morphic-write-${randomBytes(12).toString('hex')}.tmp`)
      try {
        await writeTempFile(tempPath, bytes, 0o644)
        await this.assertWithinRoot(parent.absolute)
        // link() creates the final name only if it does not already exist.
        await link(tempPath, target.absolute)
      } catch (error) {
        throw new Error(`Unable to create workspace file ${target.path}: ${messageOf(error)}`)
      } finally {
        await rm(tempPath, { force: true }).catch(() => undefined)
      }
      return { path: target.path, hash: hashBytes(bytes) }
    }

    if (!target.exists) throw new Error(`Workspace file does not exist: ${target.path}`)
    const before = await this.readResolvedFile(target)
    if (before.hash !== expectedHash.toLowerCase()) {
      throw new Error(`Workspace file is stale: ${target.path} changed since read. Read it again before editing.`)
    }

    const firstMatch = before.text.indexOf(oldText)
    if (firstMatch < 0) throw new Error(`Workspace edit could not find the exact oldText in ${target.path}.`)
    if (before.text.indexOf(oldText, firstMatch + 1) >= 0) {
      throw new Error(`Workspace edit is ambiguous: oldText occurs more than once in ${target.path}. Add surrounding context.`)
    }

    const updated = `${before.text.slice(0, firstMatch)}${newText}${before.text.slice(firstMatch + oldText.length)}`
    const bytes = Buffer.from(updated, 'utf8')
    this.assertFileSize(bytes.length, target.path)

    // Re-read immediately before staging the atomic replacement to catch edits
    // made while the model was preparing its replacement.
    const current = await this.readResolvedFile(target)
    if (current.hash !== expectedHash.toLowerCase()) {
      throw new Error(`Workspace file is stale: ${target.path} changed before the edit could be applied. Read it again.`)
    }

    const parentPath = dirname(target.absolute)
    await this.assertWithinRoot(parentPath)
    const parentInfo = await lstat(parentPath)
    if (!parentInfo.isDirectory()) throw new Error(`Workspace parent is not a directory: ${dirname(target.path)}`)
    const tempPath = join(parentPath, `.morphic-write-${randomBytes(12).toString('hex')}.tmp`)
    const mode = before.mode & 0o777
    try {
      await writeTempFile(tempPath, bytes, mode || 0o600)
      const currentAgain = await this.readResolvedFile(target)
      if (currentAgain.hash !== expectedHash.toLowerCase()) {
        throw new Error(`Workspace file is stale: ${target.path} changed before the edit could be applied. Read it again.`)
      }
      await this.assertWithinRoot(parentPath)
      await rename(tempPath, target.absolute)
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Workspace file is stale:')) throw error
      throw new Error(`Unable to edit workspace file ${target.path}: ${messageOf(error)}`)
    } finally {
      await rm(tempPath, { force: true }).catch(() => undefined)
    }

    return { path: target.path, hash: hashBytes(bytes) }
  }

  /** Run only the operator-configured executable and argv, never a model command. */
  async check(signal?: AbortSignal): Promise<WorkspaceCheckResult> {
    if (!this.checkCommand) {
      throw new Error('Workspace check is unavailable: no operator-configured check command was provided.')
    }
    if (signal?.aborted) return { ok: false, exitCode: null, output: 'Workspace check cancelled before it started.' }

    let temporaryHome: string
    try {
      temporaryHome = await mkdtemp(join(tmpdir(), 'morphic-workspace-home-'))
    } catch (error) {
      throw new Error(`Unable to prepare a private home for the workspace check: ${messageOf(error)}`)
    }

    const [executable, ...args] = this.checkCommand
    const env: NodeJS.ProcessEnv = {
      PATH: process.env.PATH ?? '',
      HOME: temporaryHome,
      TMPDIR: tmpdir(),
      TEMP: tmpdir(),
      TMP: tmpdir(),
      CI: '1',
      NO_COLOR: '1',
      FORCE_COLOR: '0',
      ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}),
      ...(process.env.WINDIR ? { WINDIR: process.env.WINDIR } : {})
    }

    return await new Promise<WorkspaceCheckResult>((resolveResult) => {
      let child
      try {
        child = spawn(executable, [...args], {
          cwd: this.root,
          env,
          shell: false,
          stdio: ['ignore', 'pipe', 'pipe'],
          detached: process.platform !== 'win32'
        })
      } catch (error) {
        void rm(temporaryHome, { recursive: true, force: true })
        resolveResult({ ok: false, exitCode: null, output: `Unable to start workspace check: ${messageOf(error)}` })
        return
      }

      const output: Buffer[] = []
      const maxContentBytes = MAX_CHECK_OUTPUT_BYTES - 32
      let outputBytes = 0
      let outputTruncated = false
      let timedOut = false
      let aborted = false
      let settled = false
      let timeout: NodeJS.Timeout | undefined
      let forceKill: NodeJS.Timeout | undefined
      const append = (chunk: Buffer | string): void => {
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
        const remaining = maxContentBytes - outputBytes
        if (remaining > 0) {
          const kept = bytes.subarray(0, remaining)
          output.push(kept)
          outputBytes += kept.length
        }
        if (bytes.length > remaining) outputTruncated = true
      }
      const kill = (): void => {
        try {
          if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, 'SIGTERM')
          else child.kill('SIGTERM')
        } catch {
          // The process may have exited between the event and the signal.
        }
        forceKill = setTimeout(() => {
          try {
            if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, 'SIGKILL')
            else child.kill('SIGKILL')
          } catch {
            // Already stopped.
          }
        }, CHECK_KILL_GRACE_MS)
        forceKill.unref()
      }
      const finish = async (exitCode: number | null, extra = ''): Promise<void> => {
        if (settled) return
        settled = true
        if (timeout) clearTimeout(timeout)
        if (forceKill) clearTimeout(forceKill)
        signal?.removeEventListener('abort', onAbort)
        if (extra) append(`\n${extra}`)
        const text = Buffer.concat(output).toString('utf8') + (outputTruncated ? '\n[output truncated]' : '')
        await rm(temporaryHome, { recursive: true, force: true }).catch(() => undefined)
        resolveResult({ ok: exitCode === 0 && !timedOut && !aborted, exitCode, output: text })
      }
      const onAbort = (): void => {
        if (settled || aborted) return
        aborted = true
        kill()
      }

      child.stdout?.on('data', append)
      child.stderr?.on('data', append)
      child.once('error', (error) => {
        void finish(null, `Unable to start workspace check: ${messageOf(error)}`)
      })
      child.once('close', (code) => {
        const reason = timedOut ? 'Workspace check timed out.' : aborted ? 'Workspace check cancelled.' : ''
        void finish(code, reason)
      })

      timeout = setTimeout(() => {
        if (settled) return
        timedOut = true
        kill()
      }, CHECK_TIMEOUT_MS)
      timeout.unref()

      if (signal) {
        signal.addEventListener('abort', onAbort, { once: true })
        if (signal.aborted) onAbort()
      }
    })
  }

  private async resolvePath(
    relativePath: string,
    options: { allowRoot?: boolean; allowMissingFinal?: boolean } = {}
  ): Promise<ResolvedPath> {
    if (typeof relativePath !== 'string' || relativePath.length === 0 || relativePath.length > MAX_PATH_LENGTH) {
      throw new Error('Workspace path must be a non-empty relative path no longer than 1024 characters.')
    }
    if (relativePath === '.') {
      if (!options.allowRoot) throw new Error('Workspace path must name a file.')
      return { absolute: this.root, path: '.', exists: true }
    }
    if (
      relativePath.includes('\0') ||
      relativePath.includes('\\') ||
      isAbsolute(relativePath) ||
      win32.isAbsolute(relativePath) ||
      /^[a-zA-Z]:/.test(relativePath)
    ) {
      throw new Error(`Workspace path must be relative and use forward slashes: ${relativePath}`)
    }

    const segments = relativePath.split('/')
    if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
      throw new Error(`Workspace path contains an invalid or traversing segment: ${relativePath}`)
    }
    if (!isAllowedPath(relativePath)) throw new Error(`Workspace path is restricted: ${relativePath}`)

    let current = this.root
    for (let index = 0; index < segments.length; index++) {
      current = join(current, segments[index])
      const isFinal = index === segments.length - 1
      let info: Stats
      try {
        info = await lstat(current)
      } catch (error) {
        if (isFinal && options.allowMissingFinal && isNotFound(error)) {
          await this.assertWithinRoot(dirname(current))
          return { absolute: current, path: segments.join('/'), exists: false }
        }
        if (isNotFound(error)) throw new Error(`Workspace path does not exist: ${segments.join('/')}`)
        throw new Error(`Unable to inspect workspace path ${segments.join('/')}: ${messageOf(error)}`)
      }
      if (info.isSymbolicLink()) throw new Error(`Workspace path may not follow symlinks: ${segments.slice(0, index + 1).join('/')}`)
      await this.assertWithinRoot(current)
      if (!isFinal && !info.isDirectory()) {
        throw new Error(`Workspace path component is not a directory: ${segments.slice(0, index + 1).join('/')}`)
      }
    }
    return { absolute: current, path: segments.join('/'), exists: true }
  }

  private async readResolvedFile(target: ResolvedPath): Promise<WorkspaceFile & { mode: number }> {
    const safe = await this.resolvePath(target.path)
    if (safe.absolute !== target.absolute) throw new Error(`Workspace path changed while reading: ${target.path}`)
    let handle
    try {
      handle = await open(target.absolute, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0))
      const info = await handle.stat()
      if (!info.isFile()) throw new Error(`Workspace path is not a regular file: ${target.path}`)
      this.assertFileSize(info.size, target.path)
      const bytes = await handle.readFile()
      this.assertFileSize(bytes.length, target.path)
      let text: string
      try {
        text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
      } catch {
        throw new Error(`Workspace file is not valid UTF-8 text: ${target.path}`)
      }
      if (text.includes('\0')) throw new Error(`Workspace file contains binary data: ${target.path}`)
      return { path: target.path, text, hash: hashBytes(bytes), mode: info.mode }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Workspace')) throw error
      throw new Error(`Unable to read workspace file ${target.path}: ${messageOf(error)}`)
    } finally {
      await handle?.close().catch(() => undefined)
    }
  }

  private assertFileSize(bytes: number, path: string): void {
    if (bytes > MAX_FILE_BYTES) {
      throw new Error(`Workspace file exceeds the ${MAX_FILE_BYTES}-byte limit: ${path}`)
    }
  }

  private async assertWithinRoot(path: string): Promise<void> {
    let canonical: string
    try {
      canonical = await realpath(path)
    } catch (error) {
      throw new Error(`Unable to resolve workspace path: ${messageOf(error)}`)
    }
    const fromRoot = relative(this.root, canonical)
    if (fromRoot === '..' || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot)) {
      throw new Error('Workspace path resolves outside the configured root.')
    }
  }
}

async function writeTempFile(path: string, bytes: Buffer, mode: number): Promise<void> {
  let handle
  try {
    handle = await open(path, 'wx', mode)
    await handle.writeFile(bytes)
    await handle.sync()
  } finally {
    await handle?.close().catch(() => undefined)
  }
}

function isAllowedPath(path: string): boolean {
  const segments = path.split('/')
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]
    const lower = segment.toLowerCase()
    const isDirectory = i < segments.length - 1
    if (BLOCKED_DIRECTORIES.has(lower)) return false
    if (lower.startsWith('.env')) return false
    if (BLOCKED_KEY_EXTENSIONS.has(extensionOf(lower))) return false
    if (/^(?:id_rsa|id_dsa|id_ecdsa|id_ed25519)(?:\.|$)/i.test(lower)) return false
    if (/^(?:auth|credentials?|secrets?|tokens?|api[-_]?keys?|private[-_]?keys?)(?:\.(?:json|ya?ml|toml|conf|config|db))?$/i.test(lower)) return false
    if (isDirectory && lower === 'node_modules') return false
  }
  return true
}

function extensionOf(path: string): string {
  const name = basename(path)
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot) : ''
}

function hashBytes(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function isNotFound(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
