import { useCallback, useState } from 'react'
import { Loader2, ShieldCheck, AlertCircle, CheckCircle2 } from 'lucide-react'

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
 * Customer-facing “try verification” control. Uses the public Gate captcha SDK.
 */
export default function GateProtect({
  action,
  siteKey = '',
  apiBase = '/api/agent-auth',
  mode = 'captcha',
  onReady,
  label = 'Run verification',
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
      setError('Create a website first, then try again.')
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
        }
      }
      setResult(protectResult)
      setPhase('ready')
      onReady?.(protectResult)
    } catch (err: unknown) {
      setPhase('error')
      const msg = err instanceof Error ? err.message : 'Verification failed'
      setError(
        msg.includes('origin')
          ? `${msg} — add this console’s domain under My website → Allowed domains.`
          : msg,
      )
    }
  }, [action, apiBase, mode, onReady, siteKey])

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => void run()}
        disabled={phase === 'checking' || phase === 'challenge'}
        className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
      >
        {(phase === 'checking' || phase === 'challenge') && (
          <Loader2 className="h-4 w-4 animate-spin" />
        )}
        {phase === 'ready' && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
        {phase === 'error' && <AlertCircle className="h-4 w-4" />}
        {phase === 'ready' ? 'Verified — pass issued' : label}
      </button>

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      {result && phase === 'ready' && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
            <ShieldCheck className="h-4 w-4" />
            Success — your site can accept this visitor for “{action}”
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            In production, send this pass to your server in the{' '}
            <code className="font-mono text-[11px]">X-Zexvro-Capability</code> header and verify it
            with your secret key.
          </p>
        </div>
      )}
    </div>
  )
}
