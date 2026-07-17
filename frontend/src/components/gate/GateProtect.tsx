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
  siteId?: string
  onReady?: (result: ProtectResult) => void
  label?: string
}

/**
 * Calm Gate protect control. Default captcha mode opens a fixed 360×480 modal popup
 * so the host page layout does not change. Falls back to soft_confirm if needed.
 */
export default function GateProtect({
  action,
  siteKey = 'zk_test_demo_public',
  apiBase = '/api/agent-auth',
  mode = 'captcha',
  siteId = 'site_demo',
  onReady,
  label = 'Continue securely',
}: Props) {
  const [phase, setPhase] = useState<GatePhase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ProtectResult | null>(null)

  const run = useCallback(async () => {
    setError(null)
    setPhase('checking')
    try {
      // Prefer browser session_pop module
      let protectResult: ProtectResult
      try {
        const mod = await import('../../../../packages/agent-auth-sdk/src/browser.js')
        const gate = new mod.BrowserGate({ siteKey, apiBase, siteId, mode })
        protectResult = await gate.protect({
          action,
          origin: window.location.origin,
          onState: (s: string) => setPhase(s as GatePhase),
          // captcha mode opens fixed modal popup (no layout space needed)
        })
      } catch {
        // Fallback soft path REST
        setPhase('challenge')
        const challenge = await fetch(`${apiBase.replace(/\/$/, '')}/v1/challenges`, {
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
        const completed = await fetch(
          `${apiBase.replace(/\/$/, '')}/v1/challenges/${challenge.id}/complete`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              siteKey,
              proofType: 'soft_confirm',
              proof: 'soft-confirm',
            }),
          },
        ).then(async (r) => {
          const b = await r.json()
          if (!r.ok) throw new Error(b.detail || r.statusText)
          return b
        })
        protectResult = {
          capability: completed.capability,
          class: completed.class,
          securityNote: 'dev_soft_confirm_fallback',
        }
      }
      setResult(protectResult)
      setPhase('ready')
      onReady?.(protectResult)
    } catch (e) {
      setPhase('error')
      setError(e instanceof Error ? e.message : 'Gate failed')
    }
  }, [action, apiBase, mode, onReady, siteId, siteKey])

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#080809]">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-lg bg-zinc-100 p-2 dark:bg-zinc-900">
          <ShieldCheck className="h-4 w-4 text-zinc-700 dark:text-zinc-200" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-zinc-900 dark:text-white">ZEXVRO Gate</div>
          <p className="mt-0.5 text-xs text-zinc-500">
            Confirm presence for <code className="font-mono text-[11px]">{action}</code>
          </p>

          {phase === 'ready' && result && (
            <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">
              Capability ready · class={result.class}
            </p>
          )}
          {phase === 'error' && error && (
            <p className="mt-2 flex items-center gap-1 text-xs text-red-500">
              <AlertCircle className="h-3 w-3" />
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={() => void run()}
            disabled={phase === 'checking' || phase === 'challenge'}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
          >
            {(phase === 'checking' || phase === 'challenge') && (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            )}
            {phase === 'ready' ? 'Verified — run again' : label}
          </button>
        </div>
      </div>
    </div>
  )
}
