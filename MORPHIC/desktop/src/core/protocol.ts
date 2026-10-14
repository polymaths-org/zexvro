/**
 * The action protocol for text-only models (VROAI today). Morph answers in plain text and may end with
 * action lines:  <<action {"tool": "set_reminder", "args": {...}}>>
 * One model call per turn: the answer and its actions arrive together (VROAI takes ~9 s per call).
 * When VROAI supports native tool calls, this becomes the fallback path.
 */

export interface ParsedAction {
  tool: string
  args: Record<string, unknown>
}

export interface ParsedReply {
  text: string
  actions: ParsedAction[]
}

/** Finds the JSON object that starts at `from`, honouring nested braces and strings. */
function balancedJson(source: string, from: number): string | null {
  let depth = 0
  let inString = false
  for (let i = from; i < source.length; i++) {
    const ch = source[i]
    if (inString) {
      if (ch === '\\') i++
      else if (ch === '"') inString = false
    } else if (ch === '"') inString = true
    else if (ch === '{') depth++
    else if (ch === '}' && --depth === 0) return source.slice(from, i + 1)
  }
  return null
}

/** Accepts the many shapes models use for a tool call: {tool, args}, {name, arguments}, {function: {...}}. */
function toAction(value: unknown): ParsedAction | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Record<string, unknown>
  const fn = v.function && typeof v.function === 'object' ? (v.function as Record<string, unknown>) : null
  const tool = [v.tool, v.name, fn?.name, v.function].find((t): t is string => typeof t === 'string')
  if (!tool || !/^[a-z_]{3,40}$/.test(tool)) return null
  let args: unknown = v.args ?? v.arguments ?? v.parameters ?? v.input ?? fn?.arguments ?? {}
  if (typeof args === 'string') {
    try {
      args = JSON.parse(args)
    } catch {
      args = {}
    }
  }
  return { tool, args: args && typeof args === 'object' && !Array.isArray(args) ? (args as Record<string, unknown>) : {} }
}

/** Adds the tool call(s) in `json` to `actions`; returns how many were found (0 if it isn't one). */
function collect(json: string | null, actions: ParsedAction[]): number {
  if (!json) return 0
  try {
    const parsed = JSON.parse(json)
    let found = 0
    for (const item of Array.isArray(parsed) ? parsed : [parsed]) {
      const action = toAction(item)
      if (action) {
        actions.push(action)
        found++
      }
    }
    return found
  } catch {
    return 0
  }
}

/**
 * Reads Morph's reply: the words for the person, plus any actions. Models write actions in many shapes
 * (our <<action ...>> lines, <tool_call> tags, ```json blocks, bare JSON objects), so all of them are
 * understood and removed from what the person sees. Identical actions are only kept once.
 */
export function parseReply(raw: string): ParsedReply {
  const actions: ParsedAction[] = []
  let text = raw

  // 1. <<action {...}>>  (also "<<action: {...}>>")
  for (let at = text.search(/<<\s*action/i); at !== -1; at = text.search(/<<\s*action/i)) {
    const open = text.indexOf('{', at)
    const json = open === -1 ? null : balancedJson(text, open)
    const close = json ? text.indexOf('>>', open + json.length) : -1
    if (!json || close === -1) {
      text = text.slice(0, at) + text.slice(at).replace(/<<\s*action[^\n]*/i, '')
      break
    }
    // A malformed action is dropped rather than shown.
    collect(json, actions)
    text = text.slice(0, at) + text.slice(close + 2)
  }

  // 2. <tool_call>...</tool_call>, <function_call>...</function_call>
  text = text.replace(/<(tool_call|function_call|tool_use)>([\s\S]*?)<\/\1>/gi, (_m, _tag, inner: string) => {
    const open = inner.indexOf('{')
    collect(open === -1 ? null : balancedJson(inner, open), actions)
    return ''
  })

  // 3. ```json ... ``` blocks that hold a tool call (other code blocks are left alone)
  text = text.replace(/```(?:json|tool_call|tool)?\s*([\s\S]*?)```/gi, (block, inner: string) => {
    return collect(inner.trim(), actions) > 0 ? '' : block
  })

  // 4. Bare JSON objects on their own that look like a tool call
  for (let at = text.search(/^\s*\{\s*"(tool|name|function)"/m); at !== -1; ) {
    const open = text.indexOf('{', at)
    const json = balancedJson(text, open)
    if (!collect(json, actions)) break
    text = text.slice(0, open) + text.slice(open + json!.length)
    at = text.search(/^\s*\{\s*"(tool|name|function)"/m)
  }

  const seen = new Set<string>()
  const unique = actions.filter((a) => {
    const key = JSON.stringify([a.tool, a.args])
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  text = text
    .replace(/^\s*Morph:\s*/i, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return { text, actions: unique }
}

/** Pulls the first JSON object out of a model reply (used for memory reflection). */
export function extractJson<T>(raw: string): T | null {
  const start = raw.indexOf('{')
  if (start === -1) return null
  const json = balancedJson(raw, start)
  if (!json) return null
  try {
    return JSON.parse(json) as T
  } catch {
    return null
  }
}
