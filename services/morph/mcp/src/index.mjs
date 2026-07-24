#!/usr/bin/env node
/**
 * ZEXVRO MCP for Morph.
 * Auth: morph login session (~/.local/share/morph/zexvro-auth.json)
 *       or env ZEXVRO_ACCESS_TOKEN (CI / break-glass)
 * Workspace: .morph/project.json or session workspaceId
 */
import { createInterface } from 'node:readline'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  defaultApiBase,
  defaultDepinUrl,
  defaultGateUrl,
  defaultNftUrl,
} from '../../lib/paths.mjs'
import { getAccessToken, loadSession } from '../../lib/zexvro-store.mjs'
import { resolveWorkspaceContext } from '../../lib/project-bind.mjs'
import {
  makeMemoryEntry,
  projectMemoryKey,
  workspaceMemoryKey,
} from '../../lib/memory-schema.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))

function resolveCfg() {
  const session = loadSession()
  const token = getAccessToken()
  const ctx = resolveWorkspaceContext(session)
  return {
    api: (session?.apiBase || defaultApiBase()).replace(/\/$/, ''),
    gate: defaultGateUrl(),
    nft: defaultNftUrl(),
    depin: defaultDepinUrl(),
    token,
    gateAdmin: (process.env.ZEXVRO_GATE_ADMIN_KEY || process.env.GATE_ADMIN_API_KEY || '').trim(),
    workspaceId: ctx.workspaceId,
    projectId: ctx.projectId,
    username: session?.username || '',
    authSource: process.env.ZEXVRO_ACCESS_TOKEN
      ? 'env'
      : session?.accessToken
        ? 'morph-login'
        : 'none',
    bindSource: ctx.source,
  }
}

function redact(s, secrets = []) {
  let out = String(s ?? '')
  for (const secret of secrets) {
    if (secret && secret.length > 4) out = out.split(secret).join('***')
  }
  out = out.replace(/\bS[A-Za-z0-9]{50,}\b/g, 'S***')
  out = out.replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, 'eyJ***')
  return out
}

async function httpJson(url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: {
      accept: 'application/json',
      ...(init.headers || {}),
    },
  })
  const ct = res.headers.get('content-type') || ''
  let body
  if (ct.includes('application/json')) body = await res.json().catch(() => null)
  else body = await res.text().catch(() => '')
  return { status: res.status, ok: res.ok, body }
}

function textResult(obj, secrets = []) {
  return {
    content: [
      {
        type: 'text',
        text: redact(typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2), secrets),
      },
    ],
  }
}

function needToken(cfg) {
  if (cfg.token) return null
  return textResult({
    error: 'not_logged_in',
    message: 'Run: morph login  (or set ZEXVRO_ACCESS_TOKEN for CI)',
  })
}

function needWorkspace(cfg) {
  if (cfg.workspaceId) return null
  return textResult({
    error: 'no_workspace',
    message: 'Run: morph use <workspaceId> && morph bind',
  })
}

const tools = [
  {
    name: 'zexvro_whoami',
    description: 'Show Morph ZEXVRO login + workspace/project context for this session',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'zexvro_health',
    description: 'Health-check Gate, NFT, De-pin, and platform memory (auth status)',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'zexvro_workspaces',
    description: 'List ZEXVRO workspaces for the logged-in user',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'gate_status',
    description: 'GET Gate /status',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'gate_list_sites',
    description:
      'List Gate sites. Uses morph login Bearer (Cognito) and/or ZEXVRO_GATE_ADMIN_KEY.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'gate_create_site',
    description:
      'Create Gate site (name, allowedOrigins[]). Uses morph login Bearer and/or ZEXVRO_GATE_ADMIN_KEY. Client only needs public siteKey.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        allowedOrigins: { type: 'array', items: { type: 'string' } },
      },
      required: ['name', 'allowedOrigins'],
    },
  },
  {
    name: 'nft_health',
    description: 'GET NFT /health (expect stellar:testnet)',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'nft_list_collections',
    description: 'List NFT collections for workspace (Bearer from morph login). Optional workspaceId.',
    inputSchema: {
      type: 'object',
      properties: { workspaceId: { type: 'string' } },
    },
  },
  {
    name: 'nft_create_collection',
    description: 'Create NFT collection on testnet. Requires login. Pass API body fields.',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string' },
        name: { type: 'string' },
        symbol: { type: 'string' },
        description: { type: 'string' },
        ownerAddress: { type: 'string' },
        royaltyRecipient: { type: 'string' },
        royaltyBps: { type: 'number' },
        coverImageUri: { type: 'string' },
      },
      required: ['name', 'symbol', 'description', 'ownerAddress', 'royaltyRecipient', 'royaltyBps', 'coverImageUri'],
    },
  },
  {
    name: 'depin_status',
    description: 'GET De-pin /status',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'depin_probe',
    description: 'Probe unpaid De-pin route (expect 402)',
    inputSchema: {
      type: 'object',
      properties: { path: { type: 'string' } },
    },
  },
  {
    name: 'memory_get',
    description:
      'Read platform shared memory (dashboard + Morph). Optional key returns one key; omit for all keys.',
    inputSchema: {
      type: 'object',
      properties: { key: { type: 'string' } },
    },
  },
  {
    name: 'memory_put',
    description:
      'Merge platform memory. Prefer append_entry for agent notes: { append_entry: { summary, label, service, decisions?, blockers?, followUps?, filesChanged? } } writes into projectMemory/workspaceMemory array. Or { key, value } / { memory }. Never secrets.',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string' },
        value: {},
        memory: { type: 'object' },
        append_entry: {
          type: 'object',
          properties: {
            summary: { type: 'string' },
            label: { type: 'string' },
            service: { type: 'string' },
            decisions: { type: 'array', items: { type: 'string' } },
            blockers: { type: 'array', items: { type: 'string' } },
            followUps: { type: 'array', items: { type: 'string' } },
            filesChanged: { type: 'array', items: { type: 'string' } },
            verification: { type: 'string' },
          },
        },
      },
    },
  },
  {
    name: 'lakebed_deploy_hint',
    description: 'Redeploy commands for a Lakebed capsule if the project uses Lakebed',
    inputSchema: {
      type: 'object',
      properties: { capsuleDir: { type: 'string' } },
    },
  },
]

async function callTool(name, args = {}) {
  const cfg = resolveCfg()
  const secrets = [cfg.token, cfg.gateAdmin].filter(Boolean)

  switch (name) {
    case 'zexvro_whoami':
      return textResult({
        loggedIn: Boolean(cfg.token),
        authSource: cfg.authSource,
        username: cfg.username || null,
        workspaceId: cfg.workspaceId || null,
        projectId: cfg.projectId || null,
        bindSource: cfg.bindSource,
        urls: { api: cfg.api, gate: cfg.gate, nft: cfg.nft, depin: cfg.depin },
        next: !cfg.token
          ? 'morph login'
          : !cfg.workspaceId
            ? 'morph use <workspaceId> && morph bind'
            : 'ready',
      })

    case 'zexvro_health': {
      const [gate, nft, depin, api] = await Promise.all([
        httpJson(`${cfg.gate}/health`),
        httpJson(`${cfg.nft}/health`),
        httpJson(`${cfg.depin}/health`),
        httpJson(`${cfg.api}/api/memory`, {
          headers: cfg.token ? { authorization: `Bearer ${cfg.token}` } : {},
        }),
      ])
      return textResult(
        {
          gate: { status: gate.status, body: gate.body },
          nft: { status: nft.status, body: nft.body },
          depin: { status: depin.status, body: depin.body },
          platformMemory: {
            status: api.status,
            note:
              api.status === 401 || api.status === 403
                ? 'auth required — morph login'
                : 'reachable',
          },
          session: {
            authSource: cfg.authSource,
            workspaceId: cfg.workspaceId || null,
            projectId: cfg.projectId || null,
            hasGateAdmin: Boolean(cfg.gateAdmin),
          },
        },
        secrets,
      )
    }

    case 'zexvro_workspaces': {
      const miss = needToken(cfg)
      if (miss) return miss
      const r = await httpJson(`${cfg.api}/api/workspaces`, {
        headers: { authorization: `Bearer ${cfg.token}` },
      })
      return textResult(
        {
          status: r.status,
          body: r.body,
          hint: r.ok ? 'morph use <workspaceId>' : 'If 404, set workspace id manually: morph use <id>',
        },
        secrets,
      )
    }

    case 'gate_status':
      return textResult(await httpJson(`${cfg.gate}/status`), secrets)

    case 'gate_list_sites': {
      // Gate admin routes accept Cognito access token (morph login) OR X-Gate-Admin-Key.
      const headers = {}
      if (cfg.gateAdmin) headers['x-gate-admin-key'] = cfg.gateAdmin
      if (cfg.token) headers.authorization = `Bearer ${cfg.token}`
      if (!headers['x-gate-admin-key'] && !headers.authorization) {
        return textResult({
          error: 'auth_required',
          message: 'morph login (Bearer) or ZEXVRO_GATE_ADMIN_KEY required for Gate site list',
        })
      }
      return textResult(await httpJson(`${cfg.gate}/v1/admin/sites`, { headers }), secrets)
    }

    case 'gate_create_site': {
      const headers = { 'content-type': 'application/json' }
      if (cfg.gateAdmin) headers['x-gate-admin-key'] = cfg.gateAdmin
      if (cfg.token) headers.authorization = `Bearer ${cfg.token}`
      if (!headers['x-gate-admin-key'] && !headers.authorization) {
        return textResult({
          error: 'auth_required',
          message: 'morph login (Bearer) or ZEXVRO_GATE_ADMIN_KEY required to create Gate sites',
        })
      }
      const r = await httpJson(`${cfg.gate}/v1/admin/sites`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: args.name,
          allowedOrigins: args.allowedOrigins,
        }),
      })
      return textResult(
        {
          ...r,
          warning:
            'Store secretKey only in env/secrets — never in client or git. Put public siteKey in game config + morph memory.',
        },
        secrets,
      )
    }

    case 'nft_health':
      return textResult(await httpJson(`${cfg.nft}/health`), secrets)

    case 'nft_list_collections': {
      const miss = needToken(cfg)
      if (miss) return miss
      const ws = args.workspaceId || cfg.workspaceId
      if (!ws) return needWorkspace(cfg)
      return textResult(
        await httpJson(`${cfg.nft}/v1/collections?workspaceId=${encodeURIComponent(ws)}`, {
          headers: { authorization: `Bearer ${cfg.token}` },
        }),
        secrets,
      )
    }

    case 'nft_create_collection': {
      const miss = needToken(cfg)
      if (miss) return miss
      const body = {
        ...args,
        workspaceId: args.workspaceId || cfg.workspaceId,
      }
      if (!body.workspaceId) return needWorkspace(cfg)
      return textResult(
        await httpJson(`${cfg.nft}/v1/collections`, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${cfg.token}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify(body),
        }),
        secrets,
      )
    }

    case 'depin_status':
      return textResult(await httpJson(`${cfg.depin}/status`), secrets)

    case 'depin_probe': {
      let path = args.path || '/v1/weather'
      if (!path.startsWith('/')) path = `/${path}`
      const r = await httpJson(`${cfg.depin}${path}`)
      return textResult(
        {
          path,
          status: r.status,
          expected: '402 for unpaid protected routes',
          body: typeof r.body === 'string' ? r.body.slice(0, 200) : r.body,
        },
        secrets,
      )
    }

    case 'memory_get': {
      const miss = needToken(cfg)
      if (miss) return miss
      const r = await httpJson(`${cfg.api}/api/memory`, {
        headers: { authorization: `Bearer ${cfg.token}` },
      })
      if (!r.ok) return textResult({ status: r.status, body: r.body }, secrets)
      const memory = r.body?.memory || {}
      if (args.key) {
        return textResult(
          { key: args.key, value: memory[args.key], username: r.body?.username },
          secrets,
        )
      }
      // Prefer project/workspace keys when bound
      const prefer = []
      if (cfg.projectId) prefer.push(`projectMemory:${cfg.projectId}`)
      if (cfg.workspaceId) prefer.push(`workspaceMemory:${cfg.workspaceId}`)
      prefer.push('morph:migrations')
      return textResult(
        {
          username: r.body?.username,
          keys: Object.keys(memory),
          prefer,
          memory,
        },
        secrets,
      )
    }

    case 'memory_put': {
      const miss = needToken(cfg)
      if (miss) return miss
      let patch = args.memory
      if (!patch && args.key !== undefined) {
        patch = { [args.key]: args.value }
      }
      // Structured agent note → project/workspace feed (dashboard Shared Memory)
      if (args.append_entry?.summary) {
        const bag = await httpJson(`${cfg.api}/api/memory`, {
          headers: { authorization: `Bearer ${cfg.token}` },
        })
        const memory = bag.ok ? bag.body?.memory || {} : {}
        const feedKey = cfg.projectId
          ? projectMemoryKey(cfg.projectId)
          : cfg.workspaceId
            ? workspaceMemoryKey(cfg.workspaceId)
            : null
        if (!feedKey) return needWorkspace(cfg)
        const prev = Array.isArray(memory[feedKey]) ? memory[feedKey] : []
        const entry = makeMemoryEntry({
          ...args.append_entry,
          source: 'morph',
          owner: cfg.username || 'Morph',
        })
        patch = {
          ...(patch || {}),
          [feedKey]: [entry, ...prev],
          'morph:lastWriteAt': new Date().toISOString(),
        }
      }
      if (!patch || typeof patch !== 'object') {
        return textResult({
          error: 'Provide append_entry, { key, value }, or { memory: object }',
        })
      }
      if (cfg.workspaceId) patch = { ...patch, 'morph:lastWorkspaceId': cfg.workspaceId }
      if (cfg.projectId) patch = { ...patch, 'morph:lastProjectId': cfg.projectId }
      const r = await httpJson(`${cfg.api}/api/memory`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${cfg.token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ memory: patch }),
      })
      return textResult({ status: r.status, body: r.body }, secrets)
    }

    case 'lakebed_deploy_hint': {
      const dir = args.capsuleDir || '.'
      return textResult({
        steps: [
          `cd ${dir}`,
          'npx lakebed@0.0.29 deploy',
          'npx lakebed claim   # optional',
        ],
      })
    }

    default:
      return textResult({ error: `unknown tool ${name}` })
  }
}

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + '\n')
}

async function handle(msg) {
  const id = msg.id
  const method = msg.method
  const params = msg.params || {}

  try {
    if (method === 'initialize') {
      return send({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'zexvro-morph-mcp', version: '0.2.0' },
        },
      })
    }
    if (method === 'notifications/initialized' || method === 'initialized') return
    if (method === 'tools/list') {
      return send({ jsonrpc: '2.0', id, result: { tools } })
    }
    if (method === 'tools/call') {
      const result = await callTool(params.name, params.arguments || {})
      return send({ jsonrpc: '2.0', id, result })
    }
    if (method === 'ping') {
      return send({ jsonrpc: '2.0', id, result: {} })
    }
    if (id === undefined || id === null) return
    return send({
      jsonrpc: '2.0',
      id,
      error: { code: -32601, message: `Method not found: ${method}` },
    })
  } catch (e) {
    if (id === undefined || id === null) return
    return send({
      jsonrpc: '2.0',
      id,
      error: {
        code: -32000,
        message: redact(e instanceof Error ? e.message : String(e), [
          getAccessToken(),
          process.env.ZEXVRO_GATE_ADMIN_KEY,
        ]),
      },
    })
  }
}

const rl = createInterface({ input: process.stdin, crlfDelay: Infinity })
rl.on('line', (line) => {
  const trimmed = line.trim()
  if (!trimmed) return
  let msg
  try {
    msg = JSON.parse(trimmed)
  } catch {
    return
  }
  void handle(msg)
})
