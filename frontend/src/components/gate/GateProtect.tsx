import { useCallback, useState } from 'react'
import { Loader2, ShieldCheck, AlertCircle } from 'lucide-react'

type GatePhase = 'idle' | 'checking' | 'challenge' | 'ready' | 'error'

type ProtectResult = {
  capability: string
  class: string
  securityNote?: string
}

type Props = {
  action: string
  siteKey?: string
  apiBase?: string
  mode?: 'session_pop' | 'soft_confirm' | 'captcha'
  onReady?: (result: ProtectResult) => void
  label?: string
}

function resolveApiBase(apiBase: string) {
  if (apiBase.startsWith('http')) return apiBase.replace(/\/$/, '')
  if (typeof window !== 'undefined') {
    return `${window.location.origin}${apiBase.startsWith('/') ? '' : '/'}${apiBase}`.replace(
      /\/$/,
      '',
    )
  }
  return apiBase.replace(/\/$/, '')
}

/**
 * Gate protect control. Captcha mode uses the public SDK from the Gate host
 * (`/v1/sdk/captcha.js`) so production builds do not need monorepo package paths.
 */
export default function GateProtect({
  action,
  siteKey = '',
  apiBase = '/api/agent-auth',
  mode = 'captcha',
  onReady,
  label = 'Continue securely',
}: Props) {
  const [phase, setPhase] = useState<GatePhase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ProtectResult | null>(null)

  const run = useCallback(async () => {
    setError(null)
    setPhase('checking')
    const base = resolveApiBase(apiBase)
    if (!siteKey) {
      setPhase('error')
      setError('Create a site and select it first')
      return
    }
    try {
      let protectResult: ProtectResult
      if (mode === 'captcha') {
        const sdkUrl = `${base}/v1/sdk/captcha.js`
        const mod = (await import(/* @vite-ignore */ sdkUrl)) as {
          protectWithCaptcha: (opts: Record<string, unknown>) => Promise<ProtectResult>
        }
        protectResult = await mod.protectWithCaptcha({
          apiBase: base,
          siteKey,
          action,
          origin: window.location.origin,
          mode: 'modal',
          onState: (s: string) => setPhase(s as GatePhase),
        })
      } else {
        setPhase('challenge')
        const challenge = await fetch(`${base}/v1/challenges`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            siteKey,
            action,
            channel: 'human',
            clientPublicKey: `ck_${crypto.randomUUID().replace(/-/g, '')}`,
            origin: window.location.origin,
          }),
        }).then(async (r) => {
          const b = await r.json()
          if (!r.ok) throw new Error(b.detail || r.statusText)
          return b
        })
        const completed = await fetch(`${base}/v1/challenges/${challenge.id}/complete`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            siteKey,
            proofType: 'soft_confirm',
            proof: 'soft-confirm',
          }),
        }).then(async (r) => {
          const b = await r.json()
          if (!r.ok) throw new Error(b.detail || r.statusText)
          return b
        })
        protectResult = {
          capability: completed.capability || completed.token,
          class: completed.class || 'human',
          securityNote: 'soft_confirm is dev-only',
        }
      }
      setResult(protectResult)
      setPhase('ready')
      onReady?.(protectResult)
    } catch (err: unknown) {
      setPhase('error')
      setError(err instanceof Error ? err.message : 'Gate protect failed')
    }
  }, [action, apiBase, mode, onReady, siteKey])

  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-500">
        Runs a live human captcha against <span className="font-mono">{resolveApiBase(apiBase)}</span>
        . This console origin must be on the site allowlist.
      </p>
      <button
        type="button"
        onClick={() => void run()}
        disabled={phase === 'checking' || phase === 'challenge'}
        className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-zinc-900"
      >
        {(phase === 'checking' || phase === 'challenge') && (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        )}
        {phase === 'ready' && <ShieldCheck className="h-3.5 w-3.5" />}
        {phase === 'error' && <AlertCircle className="h-3.5 w-3.5" />}
        {phase === 'ready' ? 'Capability issued' : label}
      </button>
      {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}
      {result && (
        <div className="rounded-lg bg-zinc-50 p-3 font-mono text-[10px] text-zinc-600 dark:bg-zinc-900/50 dark:text-zinc-300">
          class={result.class}
          <div className="mt-1 break-all opacity-70">{result.capability.slice(0, 80)}…</div>
        </div>
      )}
    </div>
  )
}
