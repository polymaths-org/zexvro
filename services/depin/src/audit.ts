import type { AuditLogger, AuditRecord } from './domain.js'

const sensitiveKey = /authorization|cookie|secret|token|payment[-_]?signature/i

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [
        key,
        sensitiveKey.test(key) ? '[REDACTED]' : redact(nested),
      ]),
    )
  }
  return value
}

export class JsonAuditLogger implements AuditLogger {
  info(record: AuditRecord): void {
    console.log(JSON.stringify(redact({ ...record, level: 'info' })))
  }

  error(record: AuditRecord): void {
    console.error(JSON.stringify(redact({ ...record, level: 'error' })))
  }
}

export function redactAuditValue(value: unknown): unknown {
  return redact(value)
}
