import { execFile } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { promisify } from 'node:util'
import { toolLine } from './ui.mjs'

const execFileAsync = promisify(execFile)

const IGNORED = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  '.lakebed',
  '__pycache__',
  '.venv',
  'venv',
  'coverage',
])

function safeJoin(workspace, relPath = '.') {
  const root = resolve(workspace)
  const target = resolve(root, relPath || '.')
  if (target !== root && !target.startsWith(root + sep)) {
    throw new Error(`Path escapes workspace: ${relPath}`)
  }
  return target
}

async function httpJson(url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: { accept: 'application/json', ...(init.headers || {}) },
  })
  const ct = res.headers.get('content-type') || ''
  let body
  if (ct.includes('application/json')) body = await res.json().catch(() => null)
  else body = await res.text().catch(() => '')
  return { status: res.status, ok: res.ok, body }
}

function env(name, fallback = '') {
  const v = process.env[name]
  return v && String(v).trim() ? String(v).trim() : fallback
}

export function createToolRuntime(workspace) {
  const root = resolve(workspace)
  const platform = {
    api: env('ZEXVRO_API_URL', 'https://qkuostruh3.execute-api.us-east-1.amazonaws.com').replace(
      /\/$/,
      '',
    ),
    gate: env('ZEXVRO_GATE_URL', 'https://api.zexvro.in/gate').replace(/\/$/, ''),
    nft: env('ZEXVRO_NFT_URL', env('NFT_API_BASE', 'https://iyk6idmup6.us-east-1.awsapprunner.com')).replace(
      /\/$/,
      '',
    ),
    depin: env(
      'ZEXVRO_DEPIN_URL',
      env('VITE_DEPIN_API_URL', 'https://sr9k3xpmbj.us-east-1.awsapprunner.com'),
    ).replace(/\/$/, ''),
    token: env('ZEXVRO_ACCESS_TOKEN'),
    gateAdmin: env('ZEXVRO_GATE_ADMIN_KEY', env('GATE_ADMIN_API_KEY')),
  }

  const definitions = [
    {
      type: 'function',
      function: {
        name: 'list_dir',
        description: 'List files in a directory under the workspace',
        parameters: {
          type: 'object',
          properties: { path: { type: 'string', description: 'Relative path (default .)' } },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'read_file',
        description: 'Read a text file from the workspace',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string' },
            maxChars: { type: 'number', description: 'Max characters to return (default 40000)' },
          },
          required: ['path'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'write_file',
        description: 'Write/create a text file in the workspace',
        parameters: {
          type: 'object',
          properties: { path: { type: 'string' }, content: { type: 'string' } },
          required: ['path', 'content'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'search_files',
        description: 'Search for a string/regex in workspace text files',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            path: { type: 'string', description: 'Subdirectory to search' },
            maxHits: { type: 'number' },
          },
          required: ['query'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'run_command',
        description:
          'Run a shell command in the workspace (timeout 60s). Prefer for npm/lakebed/tests. No destructive rm -rf / force push.',
        parameters: {
          type: 'object',
          properties: {
            command: { type: 'string' },
            timeoutSec: { type: 'number' },
          },
          required: ['command'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'analyze_project',
        description: 'High-level scan: languages, key dirs, likely Morph targets (arcade, gate, nft)',
        parameters: { type: 'object', properties: {} },
      },
    },
    {
      type: 'function',
      function: {
        name: 'zexvro_health',
        description: 'Check Gate / NFT / De-pin / platform API health',
        parameters: { type: 'object', properties: {} },
      },
    },
    {
      type: 'function',
      function: {
        name: 'gate_status',
        description: 'GET ZEXVRO Gate /status',
        parameters: { type: 'object', properties: {} },
      },
    },
    {
      type: 'function',
      function: {
        name: 'gate_create_site',
        description: 'Create Gate site (needs ZEXVRO_GATE_ADMIN_KEY). Returns siteKey; keep secretKey private.',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            allowedOrigins: { type: 'array', items: { type: 'string' } },
          },
          required: ['name', 'allowedOrigins'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'nft_health',
        description: 'GET NFT service health (expect stellar:testnet)',
        parameters: { type: 'object', properties: {} },
      },
    },
    {
      type: 'function',
      function: {
        name: 'depin_status',
        description: 'GET De-pin status',
        parameters: { type: 'object', properties: {} },
      },
    },
    {
      type: 'function',
      function: {
        name: 'lakebed_deploy_hint',
        description: 'How to redeploy demos/arcade after Morph changes',
        parameters: {
          type: 'object',
          properties: { capsuleDir: { type: 'string' } },
        },
      },
    },
  ]

  async function execute(name, args = {}) {
    toolLine(name, summarizeArgs(name, args))
    try {
      switch (name) {
        case 'list_dir': {
          const p = safeJoin(root, args.path || '.')
          if (!existsSync(p) || !statSync(p).isDirectory()) return `Not a directory: ${args.path || '.'}`
          const entries = readdirSync(p, { withFileTypes: true })
            .filter((e) => !IGNORED.has(e.name) && !e.name.startsWith('.'))
            .slice(0, 200)
            .map((e) => `${e.isDirectory() ? 'dir ' : 'file'} ${e.name}`)
          return entries.join('\n') || '(empty)'
        }
        case 'read_file': {
          const p = safeJoin(root, args.path)
          if (!existsSync(p)) return `File not found: ${args.path}`
          const max = Math.min(Number(args.maxChars) || 40_000, 80_000)
          let text = readFileSync(p, 'utf8')
          if (text.length > max) text = text.slice(0, max) + `\n… truncated ${text.length - max} chars`
          return text
        }
        case 'write_file': {
          const p = safeJoin(root, args.path)
          mkdirSync(dirname(p), { recursive: true })
          writeFileSync(p, String(args.content ?? ''), 'utf8')
          return `Wrote ${args.path} (${String(args.content ?? '').length} bytes)`
        }
        case 'search_files': {
          const start = safeJoin(root, args.path || '.')
          const q = String(args.query || '')
          const maxHits = Math.min(Number(args.maxHits) || 40, 100)
          const hits = []
          const walk = (dir) => {
            if (hits.length >= maxHits) return
            let entries
            try {
              entries = readdirSync(dir, { withFileTypes: true })
            } catch {
              return
            }
            for (const e of entries) {
              if (hits.length >= maxHits) break
              if (IGNORED.has(e.name) || e.name.startsWith('.')) continue
              const full = join(dir, e.name)
              if (e.isDirectory()) walk(full)
              else if (e.isFile() && e.name.match(/\.(ts|tsx|js|mjs|json|md|css|html)$/i)) {
                let text
                try {
                  text = readFileSync(full, 'utf8')
                } catch {
                  continue
                }
                const lines = text.split('\n')
                for (let i = 0; i < lines.length; i++) {
                  if (lines[i].includes(q)) {
                    hits.push(`${relative(root, full)}:${i + 1}: ${lines[i].trim().slice(0, 160)}`)
                    if (hits.length >= maxHits) break
                  }
                }
              }
            }
          }
          walk(start)
          return hits.join('\n') || 'No matches'
        }
        case 'run_command': {
          const cmd = String(args.command || '')
          if (!cmd) return 'Empty command'
          if (/rm\s+-rf\s+\/|git\s+push\s+.*--force|mkfs|dd\s+if=/i.test(cmd)) {
            return 'Blocked dangerous command'
          }
          const timeout = Math.min((Number(args.timeoutSec) || 60) * 1000, 180_000)
          try {
            const { stdout, stderr } = await execFileAsync('bash', ['-lc', cmd], {
              cwd: root,
              timeout,
              maxBuffer: 2_000_000,
              env: process.env,
            })
            const out = `${stdout || ''}${stderr ? `\n[stderr]\n${stderr}` : ''}`.trim()
            return out.slice(0, 30_000) || '(no output)'
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e)
            const stdout = e?.stdout ? String(e.stdout) : ''
            const stderr = e?.stderr ? String(e.stderr) : ''
            return `Command failed: ${msg}\n${stdout}\n${stderr}`.slice(0, 30_000)
          }
        }
        case 'analyze_project': {
          const hints = []
          const checks = [
            ['demos/arcade', 'Lakebed Neon Run demo (primary Morph target)'],
            ['demos/arcade/client/index.tsx', 'Arcade client UI'],
            ['demos/arcade/server/index.ts', 'Arcade server capsule'],
            ['demos/arcade/shared/platformer.ts', 'Platformer engine'],
            ['services/agent-auth', 'Gate / captcha service source'],
            ['services/nft-service', 'NFT service'],
            ['services/depin', 'De-pin x402 gateway'],
            ['services/morph', 'Morph agent package'],
            ['package.json', 'Monorepo root'],
          ]
          for (const [rel, note] of checks) {
            if (existsSync(join(root, rel))) hints.push(`✓ ${rel} — ${note}`)
            else hints.push(`· missing ${rel}`)
          }
          // language counts
          const counts = {}
          const walk = (dir, depth = 0) => {
            if (depth > 4) return
            let entries
            try {
              entries = readdirSync(dir, { withFileTypes: true })
            } catch {
              return
            }
            for (const e of entries) {
              if (IGNORED.has(e.name) || e.name.startsWith('.')) continue
              const full = join(dir, e.name)
              if (e.isDirectory()) walk(full, depth + 1)
              else {
                const ext = e.name.includes('.') ? e.name.split('.').pop() : 'none'
                counts[ext] = (counts[ext] || 0) + 1
              }
            }
          }
          walk(root)
          const top = Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 12)
            .map(([k, v]) => `${k}:${v}`)
            .join(', ')
          return `Workspace: ${root}\nExtensions: ${top}\n\nTargets:\n${hints.join('\n')}`
        }
        case 'zexvro_health': {
          const [gate, nft, depin] = await Promise.all([
            httpJson(`${platform.gate}/health`),
            httpJson(`${platform.nft}/health`),
            httpJson(`${platform.depin}/health`),
          ])
          return JSON.stringify(
            {
              gate: { status: gate.status, body: gate.body },
              nft: { status: nft.status, body: nft.body },
              depin: { status: depin.status, body: depin.body },
              configured: {
                accessToken: Boolean(platform.token),
                gateAdmin: Boolean(platform.gateAdmin),
              },
            },
            null,
            2,
          )
        }
        case 'gate_status':
          return JSON.stringify(await httpJson(`${platform.gate}/status`), null, 2)
        case 'gate_create_site': {
          if (!platform.gateAdmin) return 'ZEXVRO_GATE_ADMIN_KEY not set'
          const r = await httpJson(`${platform.gate}/v1/admin/sites`, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              'x-gate-admin-key': platform.gateAdmin,
            },
            body: JSON.stringify({
              name: args.name,
              allowedOrigins: args.allowedOrigins,
            }),
          })
          return JSON.stringify(
            { ...r, warning: 'Do not commit secretKey. Use env/secrets only.' },
            null,
            2,
          )
        }
        case 'nft_health':
          return JSON.stringify(await httpJson(`${platform.nft}/health`), null, 2)
        case 'depin_status':
          return JSON.stringify(await httpJson(`${platform.depin}/status`), null, 2)
        case 'lakebed_deploy_hint': {
          const dir = args.capsuleDir || 'demos/arcade'
          return [
            `cd ${dir}`,
            'npx lakebed@0.0.29 dev          # local',
            'npx lakebed@0.0.29 deploy       # updates shared URL (lakebed.json)',
            'npx lakebed auth login && npx lakebed claim   # before demo day (avoid expiry)',
          ].join('\n')
        }
        default:
          return `Unknown tool: ${name}`
      }
    } catch (e) {
      return `Tool error: ${e instanceof Error ? e.message : String(e)}`
    }
  }

  return { definitions, execute, workspace: root }
}

function summarizeArgs(name, args) {
  if (name === 'write_file') return String(args.path || '')
  if (name === 'read_file') return String(args.path || '')
  if (name === 'run_command') return String(args.command || '').slice(0, 80)
  if (name === 'search_files') return String(args.query || '').slice(0, 60)
  return ''
}
