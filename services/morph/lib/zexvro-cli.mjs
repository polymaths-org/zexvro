/**
 * Morph ZEXVRO account CLI: login | logout | whoami | use | workspaces | bind
 */
import { createInterface } from 'node:readline'
import { listProjects, listWorkspaces, memoryGetAll, memoryPut, platformContext } from './zexvro-api.mjs'
import { deviceLogin } from './zexvro-login.mjs'
import { findProjectBind, writeProjectBind } from './project-bind.mjs'
import {
  clearSession,
  loadSession,
  sessionSummary,
  updateSession,
} from './zexvro-store.mjs'
import { defaultApiBase, zexvroAuthPath } from './paths.mjs'
import {
  makeMemoryEntry,
  projectMemoryKey,
  workspaceMemoryKey,
} from './memory-schema.mjs'

const c = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
}

function ok(msg) {
  console.log(c.green('  ✓ ') + msg)
}
function info(msg) {
  console.log(c.dim('  · ') + msg)
}
function err(msg) {
  console.error(c.red('  ✗ ') + msg)
}

function ask(rl, q) {
  return new Promise((r) => rl.question(q, r))
}

export async function runZexvroCommand(argv) {
  const cmd = argv[0] || 'status'
  const rest = argv.slice(1)

  try {
    switch (cmd) {
      case 'login':
        await cmdLogin(rest)
        break
      case 'logout':
        clearSession()
        ok('Logged out of ZEXVRO')
        info(`cleared ${zexvroAuthPath()}`)
        break
      case 'whoami':
      case 'status':
        cmdWhoami()
        break
      case 'workspaces':
      case 'ws':
        await cmdWorkspaces()
        break
      case 'use':
        await cmdUse(rest)
        break
      case 'bind':
        await cmdBind(rest)
        break
      case 'memory':
        await cmdMemory(rest)
        break
      case 'help':
      case '-h':
      case '--help':
        printHelp()
        break
      default:
        err(`Unknown zexvro command: ${cmd}`)
        printHelp()
        process.exitCode = 1
    }
  } catch (e) {
    err(e instanceof Error ? e.message : String(e))
    process.exitCode = 1
  }
}

function printHelp() {
  console.log(`
  ${c.bold('Morph · ZEXVRO account')}

  ${c.cyan('morph login')}              Device-code login (browser approve)
  ${c.cyan('morph logout')}             Clear ZEXVRO session
  ${c.cyan('morph whoami')}             Show account + workspace
  ${c.cyan('morph workspaces')}         List workspaces (API)
  ${c.cyan('morph use')} ${c.dim('<workspaceId> [projectId]')}
  ${c.cyan('morph bind')}               Write .morph/project.json in cwd
  ${c.cyan('morph memory')}             List platform memory keys
  ${c.cyan('morph memory --all')}       Full JSON dump
  ${c.cyan('morph memory add')}         Append a note to project/workspace memory

  ${c.dim('LLM providers are separate: morph providers add  /  /connect')}
  ${c.dim('Session file:')} ${zexvroAuthPath()}
`)
}

async function cmdLogin(rest) {
  const apiIdx = rest.indexOf('--api')
  const apiBase =
    apiIdx >= 0 && rest[apiIdx + 1] ? rest[apiIdx + 1] : defaultApiBase()
  const noBrowser = rest.includes('--no-browser')

  if (loadSession()?.accessToken && !rest.includes('--force')) {
    info(`Already logged in as ${loadSession()?.username || 'user'}`)
    info('Use morph login --force to re-auth')
    cmdWhoami()
    return
  }

  const session = await deviceLogin({
    apiBase,
    openBrowser: !noBrowser,
    onStatus: (s) => info(s),
  })
  console.log('')
  ok(`Logged in as ${c.bold(session.username || 'user')}`)
  info('Next: morph workspaces   then   morph use <workspaceId>')
  info('Then: cd your-app && morph bind && morph')
  console.log('')
}

function cmdWhoami() {
  const s = sessionSummary()
  const ctx = platformContext()
  console.log('')
  if (!s.loggedIn) {
    console.log(c.yellow('  Not logged in to ZEXVRO'))
    info('Run: morph login')
    console.log('')
    return
  }
  console.log(c.bold('  ZEXVRO session'))
  console.log(c.dim('  ──────────────────────────────────'))
  info(`user       ${s.username}`)
  info(`workspace  ${s.workspaceId || c.yellow('(none — morph use <id>)')}${s.workspaceName ? `  ${s.workspaceName}` : ''}`)
  info(`project    ${s.projectId || '—'}${s.projectName ? `  ${s.projectName}` : ''}`)
  info(`api        ${s.apiBase || defaultApiBase()}`)
  info(`auth since ${s.authenticatedAt || '—'}`)
  const found = findProjectBind()
  if (found) {
    info(`cwd bind   ${found.path}`)
    info(`  → ws ${found.bind.workspaceId || '—'}  project ${found.bind.projectId || '—'}`)
  } else {
    info(`cwd bind   (none — morph bind in your app folder)`)
  }
  info(`context    ${ctx.source}`)
  console.log('')
}

async function cmdWorkspaces() {
  if (!loadSession()?.accessToken) {
    err('Not logged in. morph login')
    process.exitCode = 1
    return
  }
  const r = await listWorkspaces()
  console.log('')
  if (!r.ok) {
    err(`List failed (${r.status || '?'})`)
    info(typeof r.error === 'string' ? r.error : JSON.stringify(r.error))
    if (r.note) info(r.note)
    console.log('')
    return
  }
  if (!r.workspaces.length) {
    info('No workspaces returned')
    console.log('')
    return
  }
  console.log(c.bold('  Workspaces'))
  for (const w of r.workspaces) {
    const id = w.id || w.workspaceId || w.pk || '?'
    const name = w.name || w.title || ''
    const active = loadSession()?.workspaceId === id ? c.cyan(' *') : '  '
    console.log(`${active} ${id}  ${name}`)
  }
  console.log('')
  info('Select: morph use <workspaceId>')
  console.log('')
}

async function cmdUse(rest) {
  if (!loadSession()?.accessToken) {
    err('Not logged in. morph login')
    process.exitCode = 1
    return
  }
  let workspaceId = rest[0]
  let projectId = rest[1]
  const rl = createInterface({ input: process.stdin, output: process.stdout })

  if (!workspaceId) {
    const listed = await listWorkspaces()
    if (listed.ok && listed.workspaces.length) {
      console.log('')
      listed.workspaces.forEach((w, i) => {
        console.log(`  ${i + 1}) ${w.id || w.workspaceId}  ${w.name || ''}`)
      })
      const pick = (await ask(rl, '  Workspace # or id: ')).trim()
      const n = Number(pick)
      if (n >= 1 && n <= listed.workspaces.length) {
        const w = listed.workspaces[n - 1]
        workspaceId = w.id || w.workspaceId
      } else {
        workspaceId = pick
      }
    } else {
      workspaceId = (await ask(rl, '  Workspace id: ')).trim()
    }
  }

  if (!workspaceId) {
    rl.close()
    err('workspace id required')
    process.exitCode = 1
    return
  }

  let workspaceName = ''
  const listed = await listWorkspaces()
  if (listed.ok) {
    const hit = listed.workspaces.find(
      (w) => (w.id || w.workspaceId) === workspaceId,
    )
    workspaceName = hit?.name || hit?.title || ''
  }

  if (!projectId && rest[0] && !rest[1]) {
    // optional project pick
    const projs = await listProjects(workspaceId)
    if (projs.ok && projs.projects.length) {
      console.log('')
      info('Projects (optional — Enter to skip)')
      projs.projects.forEach((p, i) => {
        console.log(`  ${i + 1}) ${p.id || p.projectId}  ${p.name || ''}`)
      })
      const pick = (await ask(rl, '  Project # or id [skip]: ')).trim()
      if (pick) {
        const n = Number(pick)
        if (n >= 1 && n <= projs.projects.length) {
          const p = projs.projects[n - 1]
          projectId = p.id || p.projectId
        } else {
          projectId = pick
        }
      }
    }
  }
  rl.close()

  let projectName = ''
  if (projectId) {
    const projs = await listProjects(workspaceId)
    if (projs.ok) {
      const hit = projs.projects.find((p) => (p.id || p.projectId) === projectId)
      projectName = hit?.name || ''
    }
  }

  updateSession({
    workspaceId,
    workspaceName,
    projectId: projectId || '',
    projectName,
  })
  ok(`Using workspace ${workspaceId}${workspaceName ? ` (${workspaceName})` : ''}`)
  if (projectId) ok(`Project ${projectId}`)
  info('Bind this folder: morph bind')
  console.log('')
}

async function cmdBind(rest) {
  const session = loadSession()
  if (!session?.accessToken) {
    err('Not logged in. morph login')
    process.exitCode = 1
    return
  }
  const workspaceId = rest[0] || session.workspaceId
  if (!workspaceId) {
    err('No workspace. morph use <workspaceId> first')
    process.exitCode = 1
    return
  }
  const projectId = rest[1] || session.projectId || ''
  const { path } = writeProjectBind({
    workspaceId,
    workspaceName: session.workspaceName,
    projectId,
    projectName: session.projectName,
  })
  // keep session in sync
  updateSession({
    workspaceId,
    projectId,
  })
  ok(`Bound → ${path}`)
  info(`workspace ${workspaceId}${projectId ? ` · project ${projectId}` : ''}`)
  console.log('')
}

async function cmdMemory(rest) {
  if (!loadSession()?.accessToken) {
    err('Not logged in. morph login')
    process.exitCode = 1
    return
  }

  if (rest[0] === 'add') {
    await cmdMemoryAdd(rest.slice(1))
    return
  }

  const r = await memoryGetAll()
  if (!r.ok) {
    err(`memory failed: ${JSON.stringify(r.error)}`)
    process.exitCode = 1
    return
  }
  const keys = Object.keys(r.memory || {})
  console.log('')
  ok(`user ${r.username || '?'} · ${keys.length} keys`)
  if (rest[0] === '--all') {
    console.log(JSON.stringify(r.memory, null, 2))
  } else {
    for (const k of keys.slice(0, 40)) {
      const v = r.memory[k]
      const preview =
        typeof v === 'string' ? v.slice(0, 80) : JSON.stringify(v)?.slice(0, 80)
      console.log(`  ${k}  ${c.dim(preview || '')}`)
    }
    if (keys.length > 40) info(`… ${keys.length - 40} more (morph memory --all)`)
  }
  console.log('')
}

async function cmdMemoryAdd(rest) {
  const session = loadSession()
  const projectId = session?.projectId
  const workspaceId = session?.workspaceId
  if (!projectId && !workspaceId) {
    err('No workspace/project. morph use <ws> && morph bind')
    process.exitCode = 1
    return
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const summary =
    rest.join(' ').trim() ||
    (await ask(rl, '  Summary (what should next agent know?): ')).trim()
  if (!summary) {
    rl.close()
    err('summary required')
    process.exitCode = 1
    return
  }
  const label =
    (await ask(rl, '  Type [decision|blocker|handoff|context|migration] (context): ')).trim() ||
    'context'
  const service = (await ask(rl, '  Area [Morph]: ')).trim() || 'Morph'
  rl.close()

  const key = projectId ? projectMemoryKey(projectId) : workspaceMemoryKey(workspaceId)
  const all = await memoryGetAll()
  if (!all.ok) {
    err(`load failed: ${JSON.stringify(all.error)}`)
    process.exitCode = 1
    return
  }
  const prev = Array.isArray(all.memory?.[key]) ? all.memory[key] : []
  const entry = makeMemoryEntry({
    summary,
    label,
    service,
    source: 'cli',
    owner: session?.username || 'cli',
  })
  const next = [entry, ...prev]
  const put = await memoryPut({ [key]: next })
  if (!put.ok) {
    err(`save failed: ${JSON.stringify(put.error)}`)
    process.exitCode = 1
    return
  }
  ok(`Appended to ${key}`)
  info(entry.summary)
  console.log('')
}
