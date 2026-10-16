/**
 * Provider-agnostic model access. Core builds one prompt string per request; each client turns it into
 * whatever its provider wants. Which provider is used is configuration only (see index.ts) and is never
 * shown in the app.
 */
/** A tool offered to models that support native tool calling. */
export interface NativeTool {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export interface ModelClient {
  /** Returns the reply text; native tool calls come back as <<action ...>> lines appended to it. */
  complete(prompt: string, signal: AbortSignal, tools?: NativeTool[]): Promise<string>
  reachable(): Promise<boolean>
}

const TIMEOUT_MS = 90_000

/** VROAI: POST { prompt } → { success, response }. GET answers 405, which still proves it's up. */
export class VroaiClient implements ModelClient {
  constructor(private url: () => string) {}

  async complete(prompt: string, signal: AbortSignal): Promise<string> {
    const res = await fetch(this.url(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
      signal: AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)])
    })
    const body = (await res.json().catch(() => null)) as { success?: boolean; response?: unknown } | null
    if (!res.ok || !body?.success || typeof body.response !== 'string' || !body.response.trim()) {
      throw new Error(`VROAI request failed (${res.status})`)
    }
    return body.response.trim()
  }

  async reachable(): Promise<boolean> {
    try {
      await fetch(this.url(), { method: 'GET', signal: AbortSignal.timeout(4_000) })
      return true
    } catch {
      return false
    }
  }
}

/**
 * Splits Core's prompt into instructions (system) and the live part (user). Chat models follow
 * instructions given as a system message much more reliably than the same text inside a user message.
 */
const LIVE_PART = ['\n\nConversation so far:\n', '\n\nSteps so far:\n', '\n\nNew part of the conversation:\n']

export function splitPrompt(prompt: string): { system: string; user: string } {
  for (const marker of LIVE_PART) {
    const at = prompt.indexOf(marker)
    if (at > 0) return { system: prompt.slice(0, at).trim(), user: prompt.slice(at + 2) }
  }
  return { system: '', user: prompt }
}

export interface OpenRouterConfig {
  key: string
  /** First is preferred; the rest are fallbacks OpenRouter tries if it is down or rate-limited. */
  models: string[]
  baseUrl?: string
}

/** OpenRouter's OpenAI-compatible chat API. */
export class OpenRouterClient implements ModelClient {
  private outputBudget = 1500
  constructor(private config: () => OpenRouterConfig) {}

  private base() {
    return (this.config().baseUrl ?? 'https://openrouter.ai/api/v1').replace(/\/$/, '')
  }

  async complete(prompt: string, signal: AbortSignal, tools?: NativeTool[], budget = this.outputBudget): Promise<string> {
    const { key, models } = this.config()
    const { system, user } = splitPrompt(prompt)
    const res = await fetch(`${this.base()}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://zexvro.in', 'X-Title': 'Morph' },
      body: JSON.stringify({
        ...(models.length > 1 ? { models } : { model: models[0] }),
        max_tokens: budget,
        temperature: 0.4,
        messages: [...(system ? [{ role: 'system', content: system }] : []), { role: 'user', content: user }],
        ...(tools?.length
          ? { tools: tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } })), tool_choice: 'auto' }
          : tools ? { tool_choice: 'none' } : {})
      }),
      signal: AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)])
    })
    type Call = { function?: { name?: string; arguments?: string } }
    const body = (await res.json().catch(() => null)) as {
      choices?: { finish_reason?: string; message?: { content?: unknown; tool_calls?: Call[] } }[]
      error?: { message?: string }
    } | null
    if (res.ok && body?.choices?.[0]?.finish_reason === 'length') {
      // A partial tool call must never reach execution. Retry only the model request.
      if (budget >= 6000) throw new Error('Model output budget exhausted at 6000 tokens; no truncated action was executed.')
      if (signal.aborted) throw new Error('stopped')
      this.outputBudget = Math.min(6000, budget * 2)
      return this.complete(prompt, signal, tools, this.outputBudget)
    }
    const message = body?.choices?.[0]?.message
    const text = typeof message?.content === 'string' ? message.content.trim() : ''
    // Native tool calls become the same <<action>> lines the rest of Core already understands.
    const calls = (message?.tool_calls ?? []).flatMap((call) => {
      if (!call.function?.name) return []
      let args: unknown = {}
      try {
        args = JSON.parse(call.function.arguments || '{}')
      } catch {
        // Unreadable arguments: the tool's own validation will reject the call.
      }
      return [`<<action ${JSON.stringify({ tool: call.function.name, args })}>>`]
    })
    if (res.ok && !text && calls.length === 0) throw new Error(`OpenRouter returned no text or tool calls (200; finish=${body?.choices?.[0]?.finish_reason || 'unknown'}). Use only the advertised tool or text JSON protocol.`)
    if (!res.ok) {
      throw new Error(`OpenRouter request failed (${res.status})${body?.error?.message ? `: ${body.error.message}` : ''}`)
    }
    return [text, ...calls].filter(Boolean).join('\n')
  }

  /** OpenRouter validates keys at /key; compatible gateways expose /models instead. */
  async reachable(): Promise<boolean> {
    try {
      const route = this.config().baseUrl ? 'models' : 'key'
      const res = await fetch(`${this.base()}/${route}`, { headers: { Authorization: `Bearer ${this.config().key}` }, signal: AbortSignal.timeout(5_000) })
      await res.body?.cancel()
      return res.ok
    } catch {
      return false
    }
  }
}

/**
 * How long to leave a provider alone after it failed, so Morph doesn't wait on it every turn:
 *   daily quota used up (HTTP 429 "per day") → until the quota resets at midnight UTC
 *   rate limited (other 429)                 → a minute
 *   unreachable (network error, time-out)    → 20 seconds
 *   anything else                            → not skipped (try it again next time)
 */
export function backoffFor(error: unknown, now = Date.now()): number {
  const text = error instanceof Error ? `${error.name} ${error.message} ${String((error as { cause?: unknown }).cause ?? '')}` : String(error)
  if (/\b429\b/.test(text) && /per[- ]?day|daily/i.test(text)) {
    const midnight = new Date(now)
    midnight.setUTCHours(24, 0, 0, 0)
    return midnight.getTime() - now
  }
  if (/\b429\b|rate limit/i.test(text)) return 60_000
  if (/fetch failed|network|ECONN|EHOSTUNREACH|ENOTFOUND|ETIMEDOUT|No route|TimeoutError|timed out/i.test(text)) return 20_000
  return 0
}

/**
 * Tries each client in turn, so Morph still answers if one provider is down. A provider that just failed
 * is skipped for a while (see backoffFor); if every provider is being skipped, all are tried anyway.
 * Stopping is never retried.
 */
export class FallbackClient implements ModelClient {
  private skipUntil = new Map<ModelClient, number>()

  constructor(
    private clients: ModelClient[],
    private onFallback: (error: unknown) => void = () => {},
    private now: () => number = Date.now
  ) {}

  async complete(prompt: string, signal: AbortSignal, tools?: NativeTool[]): Promise<string> {
    const resting = (c: ModelClient) => (this.skipUntil.get(c) ?? 0) > this.now()
    const ready = this.clients.filter((c) => !resting(c))
    const errors: unknown[] = []
    let last: unknown
    for (const client of ready.length ? ready : this.clients) {
      try {
        const reply = await client.complete(prompt, signal, tools)
        this.skipUntil.delete(client)
        return reply
      } catch (err) {
        if (signal.aborted) throw err
        last = err
        errors.push(err)
        const wait = backoffFor(err, this.now())
        if (wait > 0) this.skipUntil.set(client, this.now() + wait)
        this.onFallback(err)
      }
    }
    if (errors.length > 1) throw new AggregateError(errors, `All configured model providers failed: ${errors.map(e => e instanceof Error ? e.message : String(e)).join('; ').slice(0, 1400)}`)
    throw last
  }

  async reachable(): Promise<boolean> {
    for (const client of this.clients) if (await client.reachable()) return true
    return false
  }
}

/** OpenRouter accepts `models`; other chat gateways need individual `model` requests. */
export function createChatClient(config: OpenRouterConfig): ModelClient {
  if (config.baseUrl && config.models.length > 1) {
    return new FallbackClient(config.models.map((model) => new OpenRouterClient(() => ({ ...config, models: [model] }))))
  }
  return new OpenRouterClient(() => config)
}
