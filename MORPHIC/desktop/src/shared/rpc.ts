/**
 * Minimal JSON-RPC peer used on both ends of the Core ↔ host link. Either side can handle requests
 * and make requests; Core additionally pushes events. Transport-agnostic: Electron MessagePort,
 * stdin/stdout JSON lines, or (later) a WebSocket.
 */

export interface Transport {
  send(message: unknown): void
  onMessage(listener: (message: unknown) => void): void
}

type Request = { kind: 'req'; id: number; method: string; params: unknown[] }
type Response = { kind: 'res'; id: number; result?: unknown; error?: string }
type EventMessage = { kind: 'event'; event: unknown }
type Wire = Request | Response | EventMessage

type Handler = (...params: never[]) => unknown

export class Peer {
  private nextId = 1
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>()
  private handlers = new Map<string, Handler>()
  private eventListeners = new Set<(event: unknown) => void>()

  constructor(private transport: Transport) {
    transport.onMessage((message) => this.receive(message as Wire))
  }

  handle(method: string, handler: Handler) {
    this.handlers.set(method, handler)
  }

  request<T = unknown>(method: string, ...params: unknown[]): Promise<T> {
    const id = this.nextId++
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject })
      this.transport.send({ kind: 'req', id, method, params } satisfies Request)
    })
  }

  emit(event: unknown) {
    this.transport.send({ kind: 'event', event } satisfies EventMessage)
  }

  onEvent(listener: (event: unknown) => void) {
    this.eventListeners.add(listener)
    return () => this.eventListeners.delete(listener)
  }

  /** Fails every outstanding request (e.g. when the other side has died). */
  failAll(reason: string) {
    for (const { reject } of this.pending.values()) reject(new Error(reason))
    this.pending.clear()
  }

  private async receive(message: Wire) {
    if (!message || typeof message !== 'object') return
    if (message.kind === 'res') {
      const waiting = this.pending.get(message.id)
      if (!waiting) return
      this.pending.delete(message.id)
      if (message.error !== undefined) waiting.reject(new Error(message.error))
      else waiting.resolve(message.result)
    } else if (message.kind === 'req') {
      const handler = this.handlers.get(message.method)
      const respond = (r: Omit<Response, 'kind' | 'id'>) => this.transport.send({ kind: 'res', id: message.id, ...r })
      if (!handler) return respond({ error: `Unknown method ${message.method}` })
      try {
        const result = await (handler as (...p: unknown[]) => unknown)(...(Array.isArray(message.params) ? message.params : []))
        respond({ result: result === undefined ? null : result })
      } catch (err) {
        respond({ error: err instanceof Error ? err.message : String(err) })
      }
    } else if (message.kind === 'event') {
      for (const listener of this.eventListeners) listener(message.event)
    }
  }
}
