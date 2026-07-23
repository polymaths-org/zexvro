#!/usr/bin/env node
/**
 * Minimal MCP stdio server — ZEXVRO platform tools for Morph.
 * No npm deps (easy to run from OpenCode).
 *
 * Env (never log values):
 *   ZEXVRO_API_URL, ZEXVRO_GATE_URL, ZEXVRO_NFT_URL, ZEXVRO_DEPIN_URL
 *   ZEXVRO_ACCESS_TOKEN, ZEXVRO_GATE_ADMIN_KEY
 */
import { createInterface } from 'node:readline'

const cfg = {
  api: (process.env.ZEXVRO_API_URL || 'https://qkuostruh3.execute-api.us-east-1.amazonaws.com').replace(
    /\/$/,
    '',
  ),
  gate: (process.env.ZEXVRO_GATE_URL || 'https://api.zexvro.in/gate').replace(/\/$/, ''),
  nft: (
    process.env.ZEXVRO_NFT_URL ||
    process.env.NFT_API_BASE ||
    'https://iyk6idmup6.us-east-1.awsapprunner.com'
  ).replace(/\/$/, ''),
  depin: (
    process.env.ZEXVRO_DEPIN_URL ||
    process.env.VITE_DEPIN_API_URL ||
    'https://sr9k3xpmbj.us-east-1.awsapprunner.com'
  ).replace(/\/$/, ''),
  token: (process.env.ZEXVRO_ACCESS_TOKEN || '').trim(),
  gateAdmin: (process.env.ZEXVRO_GATE_ADMIN_KEY || process.env.GATE_ADMIN_API_KEY || '').trim(),
}

function redact(s) {
  let out = String(s ?? '')
  for (const secret of [cfg.token, cfg.gateAdmin]) {
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
  if (ct.includes('application/json')) {
    body = await res.json().catch(() => null)
  } else {
    body = await res.text().catch(() => '')
  }
  return { status: res.status, ok: res.ok, body }
}

function textResult(obj) {
  return {
    content: [{ type: 'text', text: redact(typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2)) }],
  }
}

const tools = [
  {
    name: 'zexvro_health',
    description: 'Check health of ZEXVRO Gate, NFT, De-pin, and platform API.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'gate_status',
    description: 'GET Gate /status (issuer, product).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'gate_list_sites',
    description: 'List Gate sites (requires ZEXVRO_GATE_ADMIN_KEY).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'gate_create_site',
    description:
      'Create a Gate site for embedding captcha. Args: name, allowedOrigins (string array). Requires admin key. Returns siteKey (secretKey only once — do not log full secret).',
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
    description: 'GET NFT service /health (network should be stellar:testnet).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'nft_list_collections',
    description: 'List NFT collections for a workspace. Requires ZEXVRO_ACCESS_TOKEN.',
    inputSchema: {
      type: 'object',
      properties: { workspaceId: { type: 'string' } },
      required: ['workspaceId'],
    },
  },
  {
    name: 'nft_create_collection',
    description:
      'Create/deploy an NFT collection on testnet. Requires ZEXVRO_ACCESS_TOKEN. Body fields: workspaceId, name, symbol, description, ownerAddress, royaltyRecipient, royaltyBps, coverImageUri.',
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
      required: [
        'workspaceId',
        'name',
        'symbol',
        'description',
        'ownerAddress',
        'royaltyRecipient',
        'royaltyBps',
        'coverImageUri',
      ],
    },
  },
  {
    name: 'depin_status',
    description: 'GET De-pin /status (providers, settleReady, network).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'depin_probe',
    description: 'Probe a De-pin route unpaid (expect 402). Args: path (default /v1/weather).',
    inputSchema: {
      type: 'object',
      properties: { path: { type: 'string' } },
      additionalProperties: false,
    },
  },
  {
    name: 'memory_get',
    description: 'GET platform /api/memory?key=… Requires ZEXVRO_ACCESS_TOKEN.',
    inputSchema: {
      type: 'object',
      properties: { key: { type: 'string' } },
      required: ['key'],
    },
  },
  {
    name: 'memory_put',
    description: 'POST platform /api/memory with { key, value }. Requires ZEXVRO_ACCESS_TOKEN. Never store secrets.',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string' },
        value: {},
      },
      required: ['key', 'value'],
    },
  },
  {
    name: 'lakebed_deploy_hint',
    description: 'Return commands to redeploy the Morph arcade demo on Lakebed after code changes.',
    inputSchema: {
      type: 'object',
      properties: { capsuleDir: { type: 'string' } },
      additionalProperties: false,
    },
  },
]

async function callTool(name, args = {}) {
  switch (name) {
    case 'zexvro_health': {
      const [gate, nft, depin, api] = await Promise.all([
        httpJson(`${cfg.gate}/health`),
        httpJson(`${cfg.nft}/health`),
        httpJson(`${cfg.depin}/health`),
        httpJson(`${cfg.api}/api/memory`, {
          headers: cfg.token ? { authorization: `Bearer ${cfg.token}` } : {},
        }),
      ])
      return textResult({
        gate: { status: gate.status, body: gate.body },
        nft: { status: nft.status, body: nft.body },
        depin: { status: depin.status, body: depin.body },
        platformMemory: {
          status: api.status,
          note: api.status === 401 || api.status === 403 ? 'auth required or invalid token' : 'reachable',
        },
        configured: {
          gateAdmin: Boolean(cfg.gateAdmin),
          accessToken: Boolean(cfg.token),
        },
      })
    }
    case 'gate_status':
      return textResult(await httpJson(`${cfg.gate}/status`))
    case 'gate_list_sites': {
      if (!cfg.gateAdmin) return textResult({ error: 'ZEXVRO_GATE_ADMIN_KEY not set' })
      return textResult(
        await httpJson(`${cfg.gate}/v1/admin/sites`, {
          headers: { 'x-gate-admin-key': cfg.gateAdmin },
        }),
      )
    }
    case 'gate_create_site': {
      if (!cfg.gateAdmin) return textResult({ error: 'ZEXVRO_GATE_ADMIN_KEY not set' })
      const r = await httpJson(`${cfg.gate}/v1/admin/sites`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-gate-admin-key': cfg.gateAdmin,
        },
        body: JSON.stringify({
          name: args.name,
          allowedOrigins: args.allowedOrigins,
        }),
      })
      // Return keys once for Morph to embed; instruct not to commit secretKey
      return textResult({
        ...r,
        warning: 'Store secretKey only in env/secrets. Do not commit to git.',
      })
    }
    case 'nft_health':
      return textResult(await httpJson(`${cfg.nft}/health`))
    case 'nft_list_collections': {
      if (!cfg.token) return textResult({ error: 'ZEXVRO_ACCESS_TOKEN not set' })
      const ws = encodeURIComponent(args.workspaceId)
      return textResult(
        await httpJson(`${cfg.nft}/v1/collections?workspaceId=${ws}`, {
          headers: { authorization: `Bearer ${cfg.token}` },
        }),
      )
    }
    case 'nft_create_collection': {
      if (!cfg.token) return textResult({ error: 'ZEXVRO_ACCESS_TOKEN not set' })
      return textResult(
        await httpJson(`${cfg.nft}/v1/collections`, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${cfg.token}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify(args),
        }),
      )
    }
    case 'depin_status':
      return textResult(await httpJson(`${cfg.depin}/status`))
    case 'depin_probe': {
      let path = args.path || '/v1/weather'
      if (!path.startsWith('/')) path = `/${path}`
      const r = await httpJson(`${cfg.depin}${path}`)
      return textResult({
        path,
        status: r.status,
        expected: '402 Payment Required for unpaid protected routes',
        bodyPreview: typeof r.body === 'string' ? r.body.slice(0, 200) : r.body,
      })
    }
    case 'memory_get': {
      if (!cfg.token) return textResult({ error: 'ZEXVRO_ACCESS_TOKEN not set' })
      const key = encodeURIComponent(args.key)
      return textResult(
        await httpJson(`${cfg.api}/api/memory?key=${key}`, {
          headers: { authorization: `Bearer ${cfg.token}` },
        }),
      )
    }
    case 'memory_put': {
      if (!cfg.token) return textResult({ error: 'ZEXVRO_ACCESS_TOKEN not set' })
      return textResult(
        await httpJson(`${cfg.api}/api/memory`, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${cfg.token}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ key: args.key, value: args.value }),
        }),
      )
    }
    case 'lakebed_deploy_hint': {
      const dir = args.capsuleDir || 'demos/arcade'
      return textResult({
        steps: [
          `cd ${dir}`,
          'npx lakebed dev          # local',
          'npx lakebed auth login   # once',
          'npx lakebed deploy       # creates/updates shared URL (commit lakebed.json)',
          'npx lakebed domains add arcade.lakebed.app   # optional stable subdomain after claim',
        ],
        note: 'Redeploy after Morph patches so every share link shows Web3.',
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
          serverInfo: { name: 'zexvro-morph-mcp', version: '0.1.0' },
        },
      })
    }
    if (method === 'notifications/initialized' || method === 'initialized') {
      return
    }
    if (method === 'tools/list') {
      return send({ jsonrpc: '2.0', id, result: { tools } })
    }
    if (method === 'tools/call') {
      const name = params.name
      const args = params.arguments || {}
      const result = await callTool(name, args)
      return send({ jsonrpc: '2.0', id, result })
    }
    if (method === 'ping') {
      return send({ jsonrpc: '2.0', id, result: {} })
    }
    // ignore unknown notifications (no id)
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
      error: { code: -32000, message: redact(e instanceof Error ? e.message : String(e)) },
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
