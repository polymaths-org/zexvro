import { join } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { ConnectorConfig, ConnectorStatus, ConnectorTool, NewConnector } from '@shared/core'
import { newId, readJson, writeJson } from './store'

/**
 * Connectors: outside tools over MCP (the open standard Claude, Goose and others use). A connector is a
 * program on this computer (stdio) or a web address (Streamable HTTP). Their tools are offered to Morph,
 * and every use goes through a review card first: Morph never runs a connector tool on its own.
 */

const CONNECT_TIMEOUT = 20_000
const CALL_TIMEOUT = 60_000
const RESULT_MAX = 4_000

interface Live {
  client?: Client
  state: ConnectorStatus['state']
  error?: string
  tools: ConnectorTool[]
}

const withTimeout = <T>(promise: Promise<T>, ms: number, what: string) =>
  Promise.race([promise, new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`${what} took too long`)), ms))])

export class Connectors {
  private file: string
  private configs: ConnectorConfig[]
  private live = new Map<string, Live>()

  constructor(
    dataDir: string,
    private onChange: () => void = () => {}
  ) {
    this.file = join(dataDir, 'connectors.json')
    this.configs = readJson<ConnectorConfig[]>(this.file, [])
  }

  start() {
    for (const c of this.configs) if (c.enabled) void this.connect(c.id)
  }

  private save() {
    writeJson(this.file, this.configs)
  }

  private set(id: string, live: Live) {
    this.live.set(id, live)
    this.onChange()
  }

  list(): ConnectorStatus[] {
    return this.configs.map((c) => {
      const live = this.live.get(c.id)
      return { ...c, state: c.enabled ? (live?.state ?? 'connecting') : 'off', error: live?.error, tools: live?.tools ?? [] }
    })
  }

  add(input: NewConnector): ConnectorStatus | null {
    const name = String(input?.name ?? '').replace(/\s+/g, ' ').trim().slice(0, 40)
    if (!name || this.configs.some((c) => c.name.toLowerCase() === name.toLowerCase())) return null
    const config: ConnectorConfig = { id: newId(), name, kind: input.kind === 'web' ? 'web' : 'program', enabled: true }
    if (config.kind === 'program') {
      const command = String(input.command ?? '').trim()
      if (!command) return null
      config.command = command.slice(0, 500)
      config.args = (Array.isArray(input.args) ? input.args : []).map((a) => String(a).slice(0, 500)).slice(0, 30)
    } else {
      try {
        const url = new URL(String(input.url ?? ''))
        if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
        config.url = url.toString()
      } catch {
        return null
      }
    }
    this.configs.push(config)
    this.save()
    void this.connect(config.id)
    return this.list().find((c) => c.id === config.id) ?? null
  }

  async remove(id: string) {
    await this.disconnect(id)
    this.configs = this.configs.filter((c) => c.id !== id)
    this.live.delete(id)
    this.save()
    this.onChange()
  }

  async setEnabled(id: string, enabled: boolean) {
    const config = this.configs.find((c) => c.id === id)
    if (!config) return
    config.enabled = enabled
    this.save()
    if (enabled) await this.connect(id)
    else {
      await this.disconnect(id)
      this.set(id, { state: 'off', tools: [] })
    }
  }

  private async disconnect(id: string) {
    const client = this.live.get(id)?.client
    await client?.close().catch(() => {})
  }

  async connect(id: string) {
    const config = this.configs.find((c) => c.id === id)
    if (!config) return
    await this.disconnect(id)
    this.set(id, { state: 'connecting', tools: [] })
    const client = new Client({ name: 'morphic', version: '0.1.0' })
    try {
      const transport =
        config.kind === 'program'
          ? new StdioClientTransport({ command: config.command!, args: config.args ?? [], stderr: 'ignore' })
          : new StreamableHTTPClientTransport(new URL(config.url!))
      await withTimeout(client.connect(transport), CONNECT_TIMEOUT, 'Connecting')
      const { tools } = await withTimeout(client.listTools(), CONNECT_TIMEOUT, 'Listing tools')
      this.set(id, {
        client,
        state: 'ready',
        tools: tools.slice(0, 40).map((t) => ({
          name: t.name,
          description: (t.description ?? '').replace(/\s+/g, ' ').trim().slice(0, 200),
          params: Object.keys((t.inputSchema as { properties?: Record<string, unknown> })?.properties ?? {})
        }))
      })
    } catch (err) {
      await client.close().catch(() => {})
      this.set(id, { state: 'error', tools: [], error: err instanceof Error ? err.message.slice(0, 200) : 'Could not connect' })
    }
  }

  /** Ready connectors and their tools, for the prompt and for validating Morph's requests. */
  ready(): { connector: ConnectorStatus; tools: ConnectorTool[] }[] {
    return this.list()
      .filter((c) => c.state === 'ready' && c.tools.length)
      .map((connector) => ({ connector, tools: connector.tools }))
  }

  find(connectorName: string, toolName: string) {
    const entry = this.ready().find((r) => r.connector.name.toLowerCase() === connectorName.toLowerCase())
    const tool = entry?.tools.find((t) => t.name === toolName)
    return entry && tool ? { connector: entry.connector, tool } : null
  }

  /** Calls a tool and returns its text output (shortened). Only ever called after the person said yes. */
  async call(connectorId: string, tool: string, args: Record<string, unknown>): Promise<{ ok: boolean; text: string }> {
    const client = this.live.get(connectorId)?.client
    if (!client) return { ok: false, text: 'That connector is not connected.' }
    try {
      const result = await withTimeout(client.callTool({ name: tool, arguments: args }), CALL_TIMEOUT, 'The tool')
      const content = Array.isArray(result.content) ? result.content : []
      const text = content
        .map((part) => (part && typeof part === 'object' && 'type' in part && part.type === 'text' ? String((part as { text?: unknown }).text ?? '') : ''))
        .filter(Boolean)
        .join('\n')
        .slice(0, RESULT_MAX)
      return { ok: !result.isError, text: text || '(no text came back)' }
    } catch (err) {
      return { ok: false, text: err instanceof Error ? err.message : 'The tool failed.' }
    }
  }

  async stopAll() {
    await Promise.all(this.configs.map((c) => this.disconnect(c.id)))
  }
}
