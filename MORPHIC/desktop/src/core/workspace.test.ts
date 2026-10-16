import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { Workspace } from './workspace'

const fixtures: string[] = []

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'morphic-workspace-test-'))
  fixtures.push(root)
  return root
}

afterEach(() => {
  for (const path of fixtures.splice(0)) rmSync(path, { recursive: true, force: true })
})

describe('Workspace', () => {
  it('canonicalizes its root, lists concise safe files, and refuses symlink escapes', async () => {
    const root = fixture()
    const outside = fixture()
    const alias = `${root}-alias`
    symlinkSync(root, alias, 'dir')
    fixtures.push(alias)
    mkdirSync(join(root, 'src', 'nested'), { recursive: true })
    mkdirSync(join(root, '.git'), { recursive: true })
    mkdirSync(join(root, 'node_modules', 'pkg'), { recursive: true })
    mkdirSync(join(root, 'auth'), { recursive: true })
    writeFileSync(join(root, 'src', 'app.ts'), 'export const app = true\n')
    writeFileSync(join(root, 'src', 'nested', 'readme.md'), 'safe\n')
    writeFileSync(join(root, '.env.local'), 'not for the model')
    writeFileSync(join(root, 'auth', 'credentials.json'), 'not for the model')
    writeFileSync(join(root, '.git', 'config'), 'internal')
    writeFileSync(join(root, 'node_modules', 'pkg', 'index.js'), 'dependency')
    writeFileSync(join(outside, 'outside.ts'), 'outside')
    symlinkSync(outside, join(root, 'linked-dir'), 'dir')
    symlinkSync(join(outside, 'outside.ts'), join(root, 'linked-file.ts'), 'file')

    const workspace = new Workspace(alias)
    expect(workspace.root).toBe(root)
    expect(await workspace.list()).toEqual(['src/app.ts', 'src/nested/readme.md'])
    await expect(workspace.read('.env.local')).rejects.toThrow(/restricted/)
    await expect(workspace.read('auth/credentials.json')).rejects.toThrow(/restricted/)
    await expect(workspace.read('linked-file.ts')).rejects.toThrow(/symlinks/)
    await expect(workspace.read('linked-dir/outside.ts')).rejects.toThrow(/symlinks/)
    await expect(workspace.read('../outside.ts')).rejects.toThrow(/invalid or traversing/)
    await expect(workspace.read('/etc/passwd')).rejects.toThrow(/relative/)
  })

  it('requires a fresh hash, replaces only a unique exact span, and leaves rejected files unchanged', async () => {
    const root = fixture()
    mkdirSync(join(root, 'src'))
    const path = join(root, 'src', 'example.ts')
    writeFileSync(path, 'const color = "blue"\nconst color = "blue"\n')
    const workspace = new Workspace(root)
    const initial = await workspace.read('src/example.ts')

    await expect(workspace.edit('src/example.ts', '"blue"', '"green"', initial.hash)).rejects.toThrow(/ambiguous/)
    expect(readFileSync(path, 'utf8')).toBe(initial.text)

    writeFileSync(path, 'const color = "red"\n')
    await expect(workspace.edit('src/example.ts', '"blue"', '"green"', initial.hash)).rejects.toThrow(/stale/)
    expect(readFileSync(path, 'utf8')).toBe('const color = "red"\n')

    const current = await workspace.read('src/example.ts')
    const edited = await workspace.edit('src/example.ts', '"red"', '"green"', current.hash)
    const after = await workspace.read('src/example.ts')
    expect(after.text).toBe('const color = "green"\n')
    expect(edited.hash).toBe(after.hash)
  })

  it('creates only with the explicit new sentinel and rejects oversized content without creating it', async () => {
    const root = fixture()
    const workspace = new Workspace(root)
    await expect(workspace.edit('new.ts', 'not empty', 'code', 'new')).rejects.toThrow(/oldText to be empty/)
    const created = await workspace.edit('new.ts', '', 'export const answer = 42\n', 'new')
    expect((await workspace.read('new.ts')).hash).toBe(created.hash)

    const tooLarge = 'x'.repeat(512 * 1024 + 1)
    await expect(workspace.edit('too-large.ts', '', tooLarge, 'new')).rejects.toThrow(/byte limit/)
    await expect(workspace.read('too-large.ts')).rejects.toThrow(/does not exist/)
  })

  it('does not silently return a partial listing when the listing bound is reached', async () => {
    const root = fixture()
    for (let index = 0; index < 201; index++) {
      writeFileSync(join(root, `file-${String(index).padStart(3, '0')}.ts`), 'x')
    }
    await expect(new Workspace(root).list()).rejects.toThrow(/200-file/)
  })

  it('runs only the configured argv with a minimal environment and reports failures', async () => {
    const root = fixture()
    const original = process.env.MORPHIC_WORKSPACE_TEST_SECRET
    process.env.MORPHIC_WORKSPACE_TEST_SECRET = 'must-not-be-inherited'
    try {
      const passing = new Workspace(root, [
        process.execPath,
        '-e',
        'process.stdout.write(process.env.MORPHIC_WORKSPACE_TEST_SECRET ? "leaked" : "check-ok")'
      ])
      const good = await passing.check()
      expect(good).toEqual({ ok: true, exitCode: 0, output: 'check-ok' })

      const failing = new Workspace(root, [process.execPath, '-e', 'process.stderr.write("check-failed"); process.exit(7)'])
      const bad = await failing.check()
      expect(bad).toEqual({ ok: false, exitCode: 7, output: 'check-failed' })
    } finally {
      if (original === undefined) delete process.env.MORPHIC_WORKSPACE_TEST_SECRET
      else process.env.MORPHIC_WORKSPACE_TEST_SECRET = original
    }
  })

  it('returns a visible cancellation result and reports when checking is unavailable', async () => {
    const root = fixture()
    await expect(new Workspace(root).check()).rejects.toThrow(/no operator-configured check command/)

    const workspace = new Workspace(root, [process.execPath, '-e', 'setInterval(() => {}, 1000)'])
    const controller = new AbortController()
    const pending = workspace.check(controller.signal)
    setTimeout(() => controller.abort(), 25)
    const result = await pending
    expect(result.ok).toBe(false)
    expect(result.exitCode).toBeNull()
    expect(result.output).toContain('Workspace check cancelled.')
  })
})
