/**
 * Bind Morph to a ZEXVRO workspace/project for the current directory.
 * File: <project>/.morph/project.json
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const BIND_FILE = 'project.json'
const BIND_DIR = '.morph'

export function projectBindPath(cwd = process.cwd()) {
  return join(resolve(cwd), BIND_DIR, BIND_FILE)
}

/** Bind file for this directory only (no parent walk). */
export function readLocalBind(cwd = process.env.MORPH_PROJECT_DIR || process.cwd()) {
  const dir = resolve(cwd)
  const p = join(dir, BIND_DIR, BIND_FILE)
  if (!existsSync(p)) return null
  try {
    const bind = JSON.parse(readFileSync(p, 'utf8'))
    if (!bind?.workspaceId) return null
    return { path: p, dir, bind }
  } catch {
    return null
  }
}

/** True when this launch dir has no workspace link yet. */
export function needsWorkspaceLink(cwd = process.env.MORPH_PROJECT_DIR || process.cwd()) {
  return !readLocalBind(cwd)
}

/**
 * Walk up from cwd looking for .morph/project.json.
 * Prefer local bind; parent walk is for nested tools that inherit a monorepo link.
 */
export function findProjectBind(start = process.env.MORPH_PROJECT_DIR || process.cwd()) {
  const local = readLocalBind(start)
  if (local) return local
  let dir = resolve(start)
  for (let i = 0; i < 12; i++) {
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
    const p = join(dir, BIND_DIR, BIND_FILE)
    if (existsSync(p)) {
      try {
        const bind = JSON.parse(readFileSync(p, 'utf8'))
        if (!bind?.workspaceId) continue
        return { path: p, dir, bind }
      } catch {
        /* continue */
      }
    }
  }
  return null
}

/**
 * @param {{ workspaceId: string, workspaceName?: string, projectId?: string, projectName?: string }} bind
 * @param {string} [cwd]
 */
export function writeProjectBind(bind, cwd = process.cwd()) {
  const path = projectBindPath(cwd)
  mkdirSync(dirname(path), { recursive: true })
  const body = {
    workspaceId: bind.workspaceId,
    workspaceName: bind.workspaceName || '',
    projectId: bind.projectId || '',
    projectName: bind.projectName || '',
    boundAt: new Date().toISOString(),
    note: 'Morph project bind — do not put secrets here',
  }
  writeFileSync(path, JSON.stringify(body, null, 2) + '\n', 'utf8')
  // gitignore secrets-ish local morph state optionally
  const gi = join(dirname(path), '.gitignore')
  if (!existsSync(gi)) {
    writeFileSync(gi, '# Morph local bind (workspace ids are ok to commit if you want)\n', 'utf8')
  }
  return { path, bind: body }
}

/** Merge session + directory bind for tool context */
export function resolveWorkspaceContext(session) {
  const found = findProjectBind()
  const workspaceId =
    found?.bind?.workspaceId || session?.workspaceId || process.env.ZEXVRO_WORKSPACE_ID || ''
  const projectId =
    found?.bind?.projectId || session?.projectId || process.env.ZEXVRO_PROJECT_ID || ''
  return {
    workspaceId,
    projectId,
    workspaceName: found?.bind?.workspaceName || session?.workspaceName || '',
    projectName: found?.bind?.projectName || session?.projectName || '',
    bindPath: found?.path || null,
    bindDir: found?.dir || null,
    source: found?.bind?.workspaceId
      ? 'project-bind'
      : session?.workspaceId
        ? 'session'
        : process.env.ZEXVRO_WORKSPACE_ID
          ? 'env'
          : 'none',
  }
}
