import { systemPrompt } from './prompts.mjs'
import { createToolRuntime } from './tools.mjs'
import { err, info } from './ui.mjs'

export class MorphAgent {
  constructor({ workspace, provider, maxSteps = 28 }) {
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
        const fallback = res.error?.message || JSON.stringify(res).slice(0, 500)
        throw new Error(`Empty model response: ${fallback}`)
      }

      const msg = choice.message || {}
      const toolCalls = msg.tool_calls || []

      if (toolCalls.length > 0) {
        this.messages.push({
          role: 'assistant',
          content: msg.content || '',
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
      if (this.messages.length > 70) {
        this.messages = [this.messages[0], ...this.messages.slice(-55)]
      }
      return text
    }

    return 'Stopped after max tool steps. Say “continue” to keep going.'
  }

  async #complete() {
    if (!this.provider.apiKey) {
      throw new Error('No API key. In Morph run /connect to add a provider.')
    }
    if (!this.provider.baseUrl) {
      throw new Error('No base URL. Run /connect and set an OpenAI-compatible endpoint.')
    }

    const url = `${this.provider.baseUrl.replace(/\/$/, '')}/chat/completions`
    const body = {
      model: this.provider.model,
      messages: this.messages,
      tools: this.tools.definitions,
      tool_choice: 'auto',
      temperature: 0.2,
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.provider.apiKey}`,
        'user-agent': 'Morph/0.3 ZEXVRO',
      },
      body: JSON.stringify(body),
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const msg = data?.error?.message || data?.message || `HTTP ${res.status}`
      throw new Error(`Model error: ${msg}`)
    }
    return data
  }
}

export async function runOnce({ workspace, provider, prompt }) {
  const agent = new MorphAgent({ workspace, provider })
  info(`workspace ${workspace}`)
  info(`provider  ${provider.name} · ${provider.model}`)
  try {
    return await agent.chat(prompt)
  } catch (e) {
    err(e instanceof Error ? e.message : String(e))
    throw e
  }
}
