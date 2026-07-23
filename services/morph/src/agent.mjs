import { systemPrompt } from './prompts.mjs'
import { createToolRuntime } from './tools.mjs'
import { assistantBlock, err, info, warn } from './ui.mjs'

/**
 * Self-contained Morph agent loop (OpenAI-compatible tools).
 */
export class MorphAgent {
  constructor({ workspace, provider, maxSteps = 24 }) {
    this.workspace = workspace
    this.provider = provider
    this.maxSteps = maxSteps
    this.tools = createToolRuntime(workspace)
    this.messages = [
      {
        role: 'system',
        content: systemPrompt({ workspace }),
      },
    ]
  }

  async chat(userText) {
    this.messages.push({ role: 'user', content: userText })
    let steps = 0

    while (steps < this.maxSteps) {
      steps += 1
      const res = await this.#complete()
      const choice = res.choices?.[0]
      if (!choice) {
        const fallback = res.error?.message || JSON.stringify(res).slice(0, 400)
        throw new Error(`Empty model response: ${fallback}`)
      }

      const msg = choice.message || {}
      const toolCalls = msg.tool_calls || []

      if (toolCalls.length > 0) {
        this.messages.push({
          role: 'assistant',
          content: msg.content || null,
          tool_calls: toolCalls,
        })
        for (const call of toolCalls) {
          const name = call.function?.name || call.name
          let args = {}
          try {
            args = JSON.parse(call.function?.arguments || call.arguments || '{}')
          } catch {
            args = {}
          }
          const result = await this.tools.execute(name, args)
          this.messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: typeof result === 'string' ? result : JSON.stringify(result),
          })
        }
        continue
      }

      const text = msg.content || '(no content)'
      this.messages.push({ role: 'assistant', content: text })
      // keep context bounded
      if (this.messages.length > 60) {
        this.messages = [this.messages[0], ...this.messages.slice(-50)]
      }
      return text
    }

    return 'Stopped: max tool steps reached. Ask me to continue.'
  }

  async #complete() {
    if (!this.provider.apiKey) {
      throw new Error(
        'No API key. Run: morph providers set --preset openai --api-key sk-...  (or set MORPH_API_KEY / OPENAI_API_KEY)',
      )
    }
    const url = `${this.provider.baseUrl}/chat/completions`
    const body = {
      model: this.provider.model,
      messages: this.messages.map(normalizeMessage),
      tools: this.tools.definitions,
      tool_choice: 'auto',
      temperature: 0.2,
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.provider.apiKey}`,
        'user-agent': 'Morph/0.2 ZEXVRO',
      },
      body: JSON.stringify(body),
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const msg = data?.error?.message || data?.message || `HTTP ${res.status}`
      throw new Error(`LLM error: ${msg}`)
    }
    return data
  }
}

function normalizeMessage(m) {
  // Some gateways dislike null content with tool_calls
  if (m.role === 'assistant' && m.tool_calls) {
    return {
      role: 'assistant',
      content: m.content || '',
      tool_calls: m.tool_calls,
    }
  }
  return m
}

export async function runOnce({ workspace, provider, prompt }) {
  const agent = new MorphAgent({ workspace, provider })
  info(`workspace ${workspace}`)
  info(`provider  ${provider.name} · model ${provider.model}`)
  try {
    const text = await agent.chat(prompt)
    assistantBlock(text)
    return text
  } catch (e) {
    err(e instanceof Error ? e.message : String(e))
    throw e
  }
}
