export const CAPABILITY_HEADER = 'x-zexvro-capability'
/**
 * @zexvro/gate captcha — premium modal UX
 * Soft gate → hero challenges · attempts chip · a11y · co-brand · fluid motion
 */

async function requestJson(baseUrl, path, init = {}) {
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, init)
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    const err = new Error(body.detail || `Gate error ${response.status}`)
    err.status = response.status
    err.problem = body
    err.attemptsRemaining = body.attempts_remaining
    err.maxAttempts = body.max_attempts
    throw err
  }
  return body
}

export function captchaAssetUrl(apiBase, challengeId, assetPath, siteKey) {
  const base = apiBase.replace(/\/$/, '')
  const q = siteKey ? `?siteKey=${encodeURIComponent(siteKey)}` : ''
  return `${base}/v1/challenges/${challengeId}/captcha/assets/${assetPath}${q}`
}

const MODAL_ID = 'zexvro-gate-captcha-modal'
const HERO_TYPES = [
  'image_select',
  'odd_one_out',
  'pair_match',
  'label_pick',
  'count_objects',
  'photo_rotate',
    'majority_select',
  'text_distorted',
  'rotate',
]

const INFO_COPY = {
  title: 'About this check',
  body: [
    'This quick check keeps automated abuse out of sensitive actions.',
    'Agents never see this screen — they prove identity with cryptographic keys.',
    'You may get a short visual task. Answers stay on this site’s Gate.',
    'Reports help fix broken or unclear challenges. We do not sell captcha data as ads.',
  ],
}

const REPORT_REASONS = [
  { id: 'broken_image', label: 'Image broken or blank' },
  { id: 'unclear', label: 'Challenge is unclear' },
  { id: 'wrong_answer', label: 'I think the answer is wrong' },
  { id: 'accessibility', label: 'Hard to use (accessibility)' },
  { id: 'offensive', label: 'Offensive content' },
  { id: 'other', label: 'Other' },
]

function injectStyles() {
  if (document.getElementById('zexvro-gate-captcha-css')) return
  const s = document.createElement('style')
  s.id = 'zexvro-gate-captcha-css'
  s.textContent = `
@keyframes zg-fade-in { from { opacity: 0 } to { opacity: 1 } }
@keyframes zg-scale-in {
  from { opacity: 0; transform: scale(.96) translateY(8px) }
  to { opacity: 1; transform: scale(1) translateY(0) }
}
@keyframes zg-check-pop {
  0% { transform: scale(.84); opacity: 0 }
  55% { transform: scale(1.04); opacity: 1 }
  100% { transform: scale(1); opacity: 1 }
}
@keyframes zg-draw-circle {
  to { stroke-dashoffset: 0 }
}
@keyframes zg-draw-check {
  to { stroke-dashoffset: 0 }
}
@keyframes zg-success-glow {
  0% { box-shadow: 0 0 0 0 rgba(250,250,250,0) }
  40% { box-shadow: 0 0 0 10px rgba(250,250,250,.06) }
  100% { box-shadow: 0 0 0 0 rgba(250,250,250,0) }
}
@keyframes zg-success-fade {
  from { opacity: 0; transform: translateY(6px) }
  to { opacity: 1; transform: translateY(0) }
}
@keyframes zg-pulse-soft {
  0%, 100% { opacity: .55 }
  50% { opacity: 1 }
}
@keyframes zg-shake {
  0%, 100% { transform: translateX(0) }
  20% { transform: translateX(-4px) }
  40% { transform: translateX(4px) }
  60% { transform: translateX(-3px) }
  80% { transform: translateX(3px) }
}
#zexvro-gate-captcha-modal [data-zg-backdrop] {
  animation: zg-fade-in .18s ease-out;
}
#zexvro-gate-captcha-modal [data-zg-panel] {
  animation: zg-scale-in .22s cubic-bezier(.2,.8,.2,1);
  transition: box-shadow .2s ease, border-color .2s ease;
}
#zexvro-gate-captcha-modal [data-zg-panel].zg-success {
  border-color: #3f3f46;
  box-shadow: 0 16px 48px rgba(0,0,0,.5), 0 0 0 1px rgba(250,250,250,.08);
}
#zexvro-gate-captcha-modal .zg-shake { animation: zg-shake .32s ease; }
#zexvro-gate-captcha-modal .zg-tile {
  transition: border-color .15s ease, box-shadow .15s ease, transform .15s ease;
}
#zexvro-gate-captcha-modal .zg-tile:hover { transform: translateY(-1px); }
#zexvro-gate-captcha-modal .zg-tile:focus-visible {
  outline: 2px solid #a1a1aa; outline-offset: 2px;
}
#zexvro-gate-captcha-modal button:focus-visible {
  outline: 2px solid #a1a1aa; outline-offset: 2px;
}
@media (max-height: 560px) {
  #zexvro-gate-captcha-modal [data-zg-panel] {
    height: min(456px, calc(100dvh - 24px)) !important;
  }
}
`
  document.head.appendChild(s)
}

function ensureModalShell(opts = {}) {
  injectStyles()
  let root = document.getElementById(MODAL_ID)
  if (root) {
    applyCoBrand(root, opts)
    return root
  }
  root = document.createElement('div')
  root.id = MODAL_ID
  root.setAttribute('role', 'dialog')
  root.setAttribute('aria-modal', 'true')
  root.setAttribute('aria-label', 'Confirm you are human')
  root.innerHTML = `
<div data-zg-backdrop style="
  position:fixed;inset:0;z-index:2147483000;
  background:rgba(0,0,0,.58);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);
  display:flex;align-items:center;justify-content:center;
  padding:max(12px, env(safe-area-inset-top)) 16px max(12px, env(safe-area-inset-bottom));
  box-sizing:border-box;
  font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,sans-serif;
">
  <div data-zg-panel style="
    width:360px;max-width:min(360px,calc(100vw - 24px));
    height:456px;max-height:calc(100dvh - 24px);
    background:#09090b;color:#e4e4e7;
    border:1px solid #27272a;border-radius:14px;
    box-shadow:0 24px 64px rgba(0,0,0,.55);
    display:flex;flex-direction:column;overflow:hidden;
    box-sizing:border-box;position:relative;
  ">
    <div data-zg-header style="
      height:44px;flex:0 0 44px;display:flex;align-items:center;justify-content:space-between;
      padding:0 12px;border-bottom:1px solid #27272a;box-sizing:border-box;gap:8px;
    ">
      <div style="display:flex;align-items:center;gap:10px;min-width:0;flex:1">
        <div data-zg-host-logo style="display:none;width:28px;height:28px;border-radius:7px;overflow:hidden;flex:0 0 auto;background:#18181b;border:1px solid #27272a"></div>
        <div style="min-width:0">
          <div data-zg-host-name style="font-size:12px;font-weight:600;letter-spacing:.01em;color:#fafafa;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Protected action</div>
          <div style="font-size:10px;color:#71717a;margin-top:1px">Protected by <span style="color:#a1a1aa">ZEXVRO</span></div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:6px;flex:0 0 auto">
        <div data-zg-attempts aria-live="polite" style="
          display:none;font-size:10px;font-weight:600;color:#a1a1aa;
          border:1px solid #3f3f46;border-radius:999px;padding:3px 8px;letter-spacing:.02em;
        "></div>
        <button type="button" data-zg-close aria-label="Close" style="
          background:transparent;border:0;color:#a1a1aa;cursor:pointer;
          font-size:18px;line-height:1;padding:6px 8px;border-radius:8px;
        ">×</button>
      </div>
    </div>
    <div data-zg-body style="
      flex:1 1 auto;overflow:hidden;padding:10px 12px 8px;min-height:0;box-sizing:border-box;
      display:flex;flex-direction:column;
    "></div>
    <div data-zg-live aria-live="polite" aria-atomic="true" style="
      position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0;
    "></div>
    <div data-zg-footer style="
      height:52px;flex:0 0 52px;padding:0 10px;border-top:1px solid #27272a;
      display:flex;align-items:center;justify-content:space-between;gap:6px;box-sizing:border-box;
    ">
      <div data-zg-tools style="display:flex;gap:4px;align-items:center;flex:0 0 auto"></div>
      <div data-zg-status style="font-size:11px;color:#a1a1aa;min-width:0;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:center"></div>
      <div data-zg-actions style="display:flex;gap:8px;flex:0 0 auto;align-items:center"></div>
    </div>
  </div>
</div>`
  document.body.appendChild(root)
  const close = root.querySelector('[data-zg-close]')
  close.addEventListener('mouseenter', () => {
    close.style.color = '#fafafa'
  })
  close.addEventListener('mouseleave', () => {
    close.style.color = '#a1a1aa'
  })
  applyCoBrand(root, opts)
  return root
}

function applyCoBrand(root, opts = {}) {
  const hostName = opts.hostName || opts.brandName || 'Protected action'
  const logoUrl = opts.hostLogoUrl || opts.logoUrl
  const nameEl = root.querySelector('[data-zg-host-name]')
  const logoEl = root.querySelector('[data-zg-host-logo]')
  if (nameEl) nameEl.textContent = hostName
  if (logoEl) {
    if (logoUrl) {
      logoEl.style.display = 'block'
      logoEl.innerHTML = `<img src="${logoUrl}" alt="" style="width:100%;height:100%;object-fit:cover;display:block"/>`
    } else {
      logoEl.style.display = 'none'
      logoEl.innerHTML = ''
    }
  }
}

function openModal(opts) {
  const root = ensureModalShell(opts)
  root.style.display = 'block'
  return root
}
function closeModal() {
  const root = document.getElementById(MODAL_ID)
  if (root) root.style.display = 'none'
}
function clearModal(root) {
  root.querySelector('[data-zg-body]').innerHTML = ''
  root.querySelector('[data-zg-actions]').innerHTML = ''
  root.querySelector('[data-zg-tools]').innerHTML = ''
  const st = root.querySelector('[data-zg-status]')
  st.textContent = ''
  st.style.color = '#a1a1aa'
  const att = root.querySelector('[data-zg-attempts]')
  if (att) {
    att.style.display = 'none'
    att.textContent = ''
  }
  const panel = root.querySelector('[data-zg-panel]')
  panel?.classList.remove('zg-success')
}

function setAttemptsChip(root, remaining, max) {
  const att = root.querySelector('[data-zg-attempts]')
  if (!att) return
  if (remaining == null || max == null) {
    att.style.display = 'none'
    return
  }
  att.style.display = 'inline-flex'
  att.textContent = `${remaining} left`
  att.style.color = remaining <= 2 ? '#fbbf24' : '#a1a1aa'
  att.style.borderColor = remaining <= 2 ? '#854d0e' : '#3f3f46'
}

function announce(root, msg) {
  const live = root.querySelector('[data-zg-live]')
  if (live) live.textContent = msg || ''
}

function btnPrimary(label, onClick, disabled = false) {
  const b = document.createElement('button')
  b.type = 'button'
  b.textContent = label
  b.disabled = disabled
  b.style.cssText = `
    height:36px;padding:0 16px;border:0;border-radius:9px;cursor:pointer;
    font-size:12px;font-weight:600;background:#fafafa;color:#09090b;
    opacity:${disabled ? '0.45' : '1'};
    transition:transform .12s ease, opacity .12s ease, background .12s ease;
  `
  b.onmouseenter = () => {
    if (!b.disabled) b.style.transform = 'translateY(-1px)'
  }
  b.onmouseleave = () => {
    b.style.transform = 'none'
  }
  b.onclick = onClick
  return b
}
function btnSecondary(label, onClick) {
  const b = document.createElement('button')
  b.type = 'button'
  b.textContent = label
  b.style.cssText = `
    height:36px;padding:0 12px;border-radius:9px;cursor:pointer;
    font-size:12px;font-weight:600;background:#18181b;color:#e4e4e7;
    border:1px solid #3f3f46;transition:border-color .12s ease, transform .12s ease;
  `
  b.onmouseenter = () => {
    b.style.borderColor = '#52525b'
  }
  b.onmouseleave = () => {
    b.style.borderColor = '#3f3f46'
  }
  b.onclick = onClick
  return b
}
const ICONS = {
  reload: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><polyline points="21 3 21 9 15 9"/></svg>',
  info: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  report: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>',
}

function iconBtn(name, label, onClick) {
  const b = document.createElement('button')
  b.type = 'button'
  b.setAttribute('aria-label', label)
  b.title = label
  b.innerHTML = ICONS[name] || name
  b.style.cssText = `
    width:32px;height:32px;border-radius:8px;cursor:pointer;padding:0;
    display:inline-flex;align-items:center;justify-content:center;
    background:transparent;border:1px solid transparent;color:#a1a1aa;
    transition:color .12s ease, border-color .12s ease, background .12s ease;
  `
  b.onmouseenter = () => {
    b.style.color = '#fafafa'
    b.style.borderColor = '#3f3f46'
    b.style.background = '#18181b'
  }
  b.onmouseleave = () => {
    b.style.color = '#a1a1aa'
    b.style.borderColor = 'transparent'
    b.style.background = 'transparent'
  }
  b.onclick = onClick
  return b
}

function trapFocus(root) {
  const focusable = () =>
    [...root.querySelectorAll('button,input,textarea,[href],select,[tabindex]:not([tabindex="-1"])')].filter(
      (el) => !el.disabled && el.offsetParent !== null,
    )
  const onKey = (e) => {
    if (e.key !== 'Tab') return
    const list = focusable()
    if (!list.length) return
    const first = list[0]
    const last = list[list.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }
  root.addEventListener('keydown', onKey)
  return () => root.removeEventListener('keydown', onKey)
}

/**
 * Soft gate risk: low → one-tap Continue (session_pop if possible, else soft_confirm).
 * medium/high/force → full captcha.
 */
function resolveRisk(opts) {
  if (opts.forcePuzzle || opts.skipSoftGate) return 'high'
  if (opts.risk) return opts.risk
  // Heuristic: first visit soft; after failures hard
  try {
    const fails = Number(sessionStorage.getItem('zg_captcha_fails') || '0')
    if (fails >= 2) return 'high'
    if (fails >= 1) return 'medium'
  } catch {
    /* ignore */
  }
  // Soft gate is opt-in only (softGate: true). Default = go straight to captcha.
  if (opts.softGate === true) return 'low'
  return 'high'
}

async function softContinue(opts) {
  const apiBase = opts.apiBase.replace(/\/$/, '')
  const origin = opts.origin || (typeof location !== 'undefined' ? location.origin : undefined)
  // Prefer soft_confirm in dev; session_pop when Browser crypto available
  try {
    const { BrowserGate } = await import('./browser.js')
    const gate = new BrowserGate({
      siteKey: opts.siteKey,
      apiBase,
      siteId: opts.siteId || 'site_demo',
      projectId: opts.projectId || 'proj_demo',
      mode: 'session_pop',
    })
    return gate.protect({ action: opts.action, origin, onState: opts.onState })
  } catch {
    const challenge = await requestJson(apiBase, '/v1/challenges', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        siteKey: opts.siteKey,
        action: opts.action,
        channel: 'human',
        clientPublicKey: `ck_${Date.now().toString(16)}`,
        origin,
      }),
    })
    const completed = await requestJson(apiBase, `/v1/challenges/${challenge.id}/complete`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        siteKey: opts.siteKey,
        proofType: 'soft_confirm',
        proof: 'soft-confirm',
      }),
    })
    return {
      capability: completed.capability,
      class: completed.class,
      securityNote: 'soft_gate_continue',
    }
  }
}

export async function protectWithCaptcha(opts) {
  if (!opts?.siteKey || !opts?.apiBase || !opts?.action) {
    throw new Error('siteKey, apiBase, action required')
  }
  const onState = opts.onState || (() => {})
  const origin = opts.origin || (typeof location !== 'undefined' ? location.origin : undefined)
  const apiBase = opts.apiBase.replace(/\/$/, '')
  const uiMode = opts.mode || (opts.mount ? 'inline' : 'modal')
  const risk = resolveRisk(opts)

  const brand = {
    hostName: opts.hostName || opts.brandName,
    hostLogoUrl: opts.hostLogoUrl || opts.logoUrl,
  }

  // Soft path: show premium Continue sheet first
  if (risk === 'low' && uiMode === 'modal' && opts.softGate === true) {
    onState('soft_gate')
    const soft = await mountSoftGate({
      ...brand,
      action: opts.action,
      onContinue: async () => {
        onState('soft_continue')
        try {
          return await softContinue({ ...opts, apiBase, origin, onState })
        } catch {
          // soft path failed (prod soft_confirm off etc.) → escalate to puzzle
          try {
            sessionStorage.setItem(
              'zg_captcha_fails',
              String(Number(sessionStorage.getItem('zg_captcha_fails') || '0') + 1),
            )
          } catch {
            /* */
          }
          return null
        }
      },
      onNeedPuzzle: () => null,
    })
    if (soft && soft.capability) return soft
    // fall through to puzzle
  }

  const session = {
    siteKey: opts.siteKey,
    apiBase,
    action: opts.action,
    origin,
    preferredType: opts.preferredType,
    brand,
    maxAttempts: 8,
  }

  async function issueRound(preferredType) {
    onState('checking')
    session.clientPublicKey = `ck_${
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID().replace(/-/g, '')
        : String(Date.now())
    }`
    onState('challenge')
    const challenge = await requestJson(apiBase, '/v1/challenges', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        siteKey: session.siteKey,
        action: session.action,
        channel: 'human',
        clientPublicKey: session.clientPublicKey,
        origin: session.origin,
      }),
    })
    session.challengeId = challenge.id
    onState('captcha')
    // Prefer hero types unless caller forces one
    const preferred =
      preferredType ||
      session.preferredType ||
      HERO_TYPES[Math.floor(Math.random() * HERO_TYPES.length)]
    const issued = await requestJson(apiBase, `/v1/challenges/${challenge.id}/captcha`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        siteKey: session.siteKey,
        preferredType: preferred,
      }),
    })
    session.captcha = issued.captcha
    session.attemptsRemaining = session.maxAttempts
    return {
      challengeId: challenge.id,
      captcha: issued.captcha,
      attemptsRemaining: session.attemptsRemaining,
      maxAttempts: session.maxAttempts,
      assetUrl: (path) => captchaAssetUrl(apiBase, challenge.id, path, session.siteKey),
      submit: async (value) => {
        onState('complete')
        try {
          const ans = await requestJson(apiBase, `/v1/challenges/${challenge.id}/captcha/answer`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              siteKey: session.siteKey,
              captchaId: session.captcha?.captchaId,
              value,
            }),
          })
          if (typeof ans.attempts_remaining === 'number') {
            session.attemptsRemaining = ans.attempts_remaining
          }
        } catch (e) {
          if (typeof e.attemptsRemaining === 'number') {
            session.attemptsRemaining = e.attemptsRemaining
          } else {
            session.attemptsRemaining = Math.max(0, (session.attemptsRemaining ?? 8) - 1)
          }
          try {
            sessionStorage.setItem(
              'zg_captcha_fails',
              String(Number(sessionStorage.getItem('zg_captcha_fails') || '0') + 1),
            )
          } catch {
            /* */
          }
          throw e
        }
        const completed = await requestJson(apiBase, `/v1/challenges/${challenge.id}/complete`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            siteKey: session.siteKey,
            proofType: 'captcha_pass',
            proof: issued.captcha.captchaId,
          }),
        })
        try {
          sessionStorage.setItem('zg_captcha_fails', '0')
        } catch {
          /* */
        }
        onState('ready')
        return {
          capability: completed.capability,
          class: completed.class,
          expiresIn: completed.expires_in,
          scopes: completed.scopes,
          captchaType: issued.captcha.type,
          securityNote: 'self_hosted_captcha_casual_bot_friction',
        }
      },
      reload: async () => issueRound(undefined),
      report: async (payload) =>
        requestJson(apiBase, '/v1/captcha/report', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            siteKey: session.siteKey,
            challengeId: session.challengeId,
            captchaId: session.captcha?.captchaId,
            captchaType: session.captcha?.type,
            ...payload,
          }),
        }),
      session,
    }
  }

  if (typeof opts.onCaptcha === 'function') {
    const ctx = await issueRound(opts.preferredType)
    const maybeValue = await opts.onCaptcha(ctx)
    if (maybeValue && maybeValue.capability) return maybeValue
    if (maybeValue !== undefined && maybeValue !== null) return ctx.submit(maybeValue)
    throw new Error('onCaptcha must return answer value or call submit(value)')
  }

  const ctx = await issueRound(opts.preferredType)
  if (uiMode === 'modal' || !opts.mount) return mountCaptchaModal(ctx, brand)
  return mountCaptchaWidget(opts.mount, ctx)
}

function mountSoftGate({ hostName, hostLogoUrl, action, onContinue }) {
  const root = openModal({ hostName, hostLogoUrl })
  clearModal(root)
  applyCoBrand(root, { hostName: hostName || 'Continue securely', hostLogoUrl })
  const body = root.querySelector('[data-zg-body]')
  const actions = root.querySelector('[data-zg-actions]')
  const tools = root.querySelector('[data-zg-tools]')
  const status = root.querySelector('[data-zg-status]')
  const closeBtn = root.querySelector('[data-zg-close]')
  const releaseFocus = trapFocus(root)

  return new Promise((resolve, reject) => {
    let settled = false
    const finish = (err, val) => {
      if (settled) return
      settled = true
      releaseFocus()
      closeModal()
      if (err) reject(err)
      else resolve(val)
    }
    closeBtn.onclick = () => finish(new Error('captcha_cancelled'))
    root.querySelector('[data-zg-backdrop]').onclick = (e) => {
      if (e.target?.getAttribute?.('data-zg-backdrop') !== null) finish(new Error('captcha_cancelled'))
    }

    body.innerHTML = `
      <div style="display:flex;flex-direction:column;height:100%;justify-content:center;gap:14px;animation:zg-fade-in .25s ease">
        <div style="width:44px;height:44px;border-radius:12px;background:linear-gradient(145deg,#18181b,#27272a);border:1px solid #3f3f46;display:flex;align-items:center;justify-content:center;font-size:18px">✓</div>
        <div>
          <div style="font-size:16px;font-weight:600;color:#fafafa;letter-spacing:-.02em;margin-bottom:6px">Confirm you're here</div>
          <div style="font-size:13px;color:#a1a1aa;line-height:1.5">
            One step before <span style="color:#d4d4d8">${escapeHtml(action || 'this action')}</span>.
            Agents use keys — this screen is for people.
          </div>
        </div>
        <div style="font-size:11px;color:#71717a;line-height:1.45">Protected by ZEXVRO Gate · privacy-first · no ad tracking</div>
      </div>`
    tools.innerHTML = ''
    actions.appendChild(
      btnPrimary('Continue', async () => {
        status.textContent = 'Working…'
        status.style.color = '#a1a1aa'
        announce(root, 'Continuing')
        try {
          const result = await onContinue()
          if (result && result.capability) {
            await playSuccess(root, body)
            finish(null, result)
          } else {
            // escalate
            finish(null, null)
          }
        } catch (e) {
          status.textContent = e.message || 'Need a quick check'
          status.style.color = '#f87171'
          finish(null, null)
        }
      }),
    )
    setTimeout(() => actions.querySelector('button')?.focus(), 30)
  })
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function playSuccess(root, bodyEl) {
  return new Promise((resolve) => {
    const panel = root.querySelector?.('[data-zg-panel]') || root
    if (panel?.classList) panel.classList.add('zg-success')
    // Premium stroke-draw check (no emoji/unicode glyphs)
    bodyEl.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:14px;text-align:center">
        <div style="
          width:72px;height:72px;border-radius:999px;background:radial-gradient(circle at 40% 35%,#1c1c1f,#0a0a0b);
          border:1px solid #3f3f46;display:flex;align-items:center;justify-content:center;
          animation:zg-check-pop .5s cubic-bezier(.16,1,.3,1), zg-success-glow .7s ease-out;
        ">
          <svg width="36" height="36" viewBox="0 0 52 52" aria-hidden="true">
            <circle cx="26" cy="26" r="22" fill="none" stroke="#52525b" stroke-width="2"
              stroke-dasharray="140" stroke-dashoffset="140"
              style="animation:zg-draw-circle .45s ease forwards"/>
            <path d="M15 27.5 L23 35 L38 18" fill="none" stroke="#fafafa" stroke-width="2.6"
              stroke-linecap="round" stroke-linejoin="round"
              stroke-dasharray="40" stroke-dashoffset="40"
              style="animation:zg-draw-check .35s .28s ease forwards"/>
          </svg>
        </div>
        <div style="animation:zg-success-fade .35s .25s both">
          <div style="font-size:15px;font-weight:600;color:#fafafa;letter-spacing:-.02em">You're verified</div>
          <div style="font-size:12px;color:#71717a;margin-top:4px">Continuing securely</div>
        </div>
      </div>`
    announce(root, 'Verified')
    setTimeout(resolve, 720)
  })
}

export function mountCaptchaModal(ctx, brand = {}) {
  const root = openModal(brand)
  clearModal(root)
  applyCoBrand(root, brand)
  const body = root.querySelector('[data-zg-body]')
  const actions = root.querySelector('[data-zg-actions]')
  const tools = root.querySelector('[data-zg-tools]')
  const status = root.querySelector('[data-zg-status]')
  const closeBtn = root.querySelector('[data-zg-close]')
  const releaseFocus = trapFocus(root)

  return new Promise((resolve, reject) => {
    let settled = false
    let live = ctx

    const finish = (err, result) => {
      if (settled) return
      settled = true
      releaseFocus()
      closeModal()
      if (err) reject(err)
      else resolve(result)
    }

    closeBtn.onclick = () => finish(new Error('captcha_cancelled'))
    root.querySelector('[data-zg-backdrop]').onclick = (e) => {
      if (e.target?.getAttribute?.('data-zg-backdrop') !== null) finish(new Error('captcha_cancelled'))
    }

    const paint = (next) => {
      live = next
      body.innerHTML = ''
      actions.innerHTML = ''
      tools.innerHTML = ''
      status.textContent = ''
      status.style.color = '#a1a1aa'
      setAttemptsChip(root, live.attemptsRemaining ?? live.session?.attemptsRemaining, live.maxAttempts ?? 8)
      renderChallenge(body, actions, tools, status, live, root, {
        onSubmit: async (value) => {
          status.textContent = 'Checking…'
          status.style.color = '#a1a1aa'
          announce(root, 'Checking answer')
          try {
            const result = await live.submit(value)
            setAttemptsChip(root, live.session?.attemptsRemaining, live.maxAttempts)
            await playSuccess(root, body)
            finish(null, result)
          } catch (e) {
            const left = e.attemptsRemaining ?? live.session?.attemptsRemaining
            setAttemptsChip(root, left, e.maxAttempts ?? live.maxAttempts ?? 8)
            status.textContent = e.message || (left != null ? `Not quite — ${left} left` : 'Not quite — try again')
            status.style.color = '#f87171'
            announce(root, status.textContent)
            body.classList.remove('zg-shake')
            // reflow
            void body.offsetWidth
            body.classList.add('zg-shake')
            if (String(e.message || '').includes('Too many') || e.status === 429 || left === 0) finish(e)
          }
        },
        onReload: async () => {
          status.textContent = 'Loading…'
          announce(root, 'Loading new challenge')
          try {
            paint(await live.reload())
          } catch (e) {
            status.textContent = e.message || 'Could not reload'
            status.style.color = '#f87171'
          }
        },
        onInfo: () => showInfoPanel(body, () => paint(live)),
        onReport: () =>
          showReportPanel(body, live, {
            onDone: async (msg) => {
              status.textContent = msg || 'Thanks — loading a new challenge…'
              announce(root, 'Report sent')
              try {
                paint(await live.reload())
              } catch {
                paint(live)
              }
            },
            onCancel: () => paint(live),
          }),
      })
      setTimeout(() => body.querySelector('button,input')?.focus?.(), 40)
    }

    paint(live)
  })
}

export function mountCaptchaWidget(el, ctx) {
  if (!el) return Promise.reject(new Error('mount element required'))
  injectStyles()
  el.innerHTML = ''
  const shell = document.createElement('div')
  shell.style.cssText =
    'width:360px;max-width:100%;height:456px;box-sizing:border-box;font-family:ui-sans-serif,system-ui,sans-serif;border:1px solid #27272a;border-radius:14px;background:#09090b;color:#e4e4e7;display:flex;flex-direction:column;overflow:hidden;position:relative'
  const body = document.createElement('div')
  body.style.cssText = 'flex:1;overflow:hidden;padding:14px;min-height:0'
  const foot = document.createElement('div')
  foot.style.cssText =
    'height:60px;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 12px;border-top:1px solid #27272a'
  const tools = document.createElement('div')
  tools.style.cssText = 'display:flex;gap:4px'
  const status = document.createElement('div')
  status.style.cssText = 'font-size:11px;color:#a1a1aa;flex:1;text-align:center'
  const actions = document.createElement('div')
  actions.style.cssText = 'display:flex;gap:8px'
  foot.appendChild(tools)
  foot.appendChild(status)
  foot.appendChild(actions)
  shell.appendChild(body)
  shell.appendChild(foot)
  el.appendChild(shell)
  const fakeRoot = {
    querySelector: (sel) => {
      if (sel === '[data-zg-panel]') return shell
      if (sel === '[data-zg-attempts]') return null
      if (sel === '[data-zg-live]') return status
      return null
    },
  }

  return new Promise((resolve, reject) => {
    let live = ctx
    const paint = (next) => {
      live = next
      body.innerHTML = ''
      actions.innerHTML = ''
      tools.innerHTML = ''
      status.textContent = ''
      renderChallenge(body, actions, tools, status, live, fakeRoot, {
        onSubmit: (value) =>
          live
            .submit(value)
            .then(async (r) => {
              await playSuccess(fakeRoot, body)
              resolve(r)
            })
            .catch(reject),
        onReload: async () => {
          try {
            paint(await live.reload())
          } catch (e) {
            status.textContent = e.message || 'Could not reload'
          }
        },
        onInfo: () => showInfoPanel(body, () => paint(live)),
        onReport: () =>
          showReportPanel(body, live, {
            onDone: async () => {
              try {
                paint(await live.reload())
              } catch {
                paint(live)
              }
            },
            onCancel: () => paint(live),
          }),
      })
    }
    paint(live)
  })
}

function showInfoPanel(bodyEl, onBack) {
  bodyEl.innerHTML = ''
  bodyEl.style.overflow = 'auto'
  const wrap = document.createElement('div')
  wrap.style.cssText = 'font-size:13px;line-height:1.45;color:#d4d4d8;animation:zg-fade-in .2s ease'
  const h = document.createElement('div')
  h.style.cssText = 'font-size:14px;font-weight:600;color:#fafafa;margin-bottom:10px'
  h.textContent = INFO_COPY.title
  wrap.appendChild(h)
  for (const para of INFO_COPY.body) {
    const p = document.createElement('p')
    p.style.cssText = 'margin:0 0 10px;color:#a1a1aa;font-size:12px;line-height:1.5'
    p.textContent = para
    wrap.appendChild(p)
  }
  const back = btnSecondary('Back to challenge', onBack)
  back.style.marginTop = '8px'
  wrap.appendChild(back)
  bodyEl.appendChild(wrap)
  back.focus()
}

function showReportPanel(bodyEl, ctx, { onDone, onCancel }) {
  bodyEl.innerHTML = ''
  bodyEl.style.overflow = 'auto'
  const wrap = document.createElement('div')
  wrap.style.cssText = 'animation:zg-fade-in .2s ease'
  const h = document.createElement('div')
  h.style.cssText = 'font-size:14px;font-weight:600;color:#fafafa;margin-bottom:8px'
  h.textContent = 'Report a problem'
  wrap.appendChild(h)
  const sub = document.createElement('div')
  sub.style.cssText = 'font-size:12px;color:#a1a1aa;margin-bottom:10px'
  sub.textContent = 'Tell us what went wrong. No login required.'
  wrap.appendChild(sub)

  let reason = 'unclear'
  for (const r of REPORT_REASONS) {
    const row = document.createElement('label')
    row.style.cssText =
      'display:flex;align-items:center;gap:8px;font-size:12px;color:#e4e4e7;margin:6px 0;cursor:pointer'
    const input = document.createElement('input')
    input.type = 'radio'
    input.name = 'zg-report-reason'
    input.value = r.id
    if (r.id === reason) input.checked = true
    input.onchange = () => {
      reason = r.id
    }
    row.appendChild(input)
    row.appendChild(document.createTextNode(r.label))
    wrap.appendChild(row)
  }

  const note = document.createElement('textarea')
  note.placeholder = 'Optional details (max 500 chars)'
  note.maxLength = 500
  note.rows = 3
  note.style.cssText =
    'width:100%;box-sizing:border-box;margin-top:8px;background:#18181b;border:1px solid #3f3f46;color:#fafafa;border-radius:8px;padding:8px;font-size:12px;resize:none'
  wrap.appendChild(note)

  const row = document.createElement('div')
  row.style.cssText = 'display:flex;gap:8px;margin-top:12px;justify-content:flex-end'
  row.appendChild(btnSecondary('Cancel', onCancel))
  const send = btnPrimary('Send report', async () => {
    send.disabled = true
    send.style.opacity = '0.45'
    try {
      await ctx.report({ reason, note: note.value.trim() || undefined })
      onDone('Thanks — loading a different task')
    } catch (e) {
      send.disabled = false
      send.style.opacity = '1'
      sub.textContent = e.message || 'Could not send report'
      sub.style.color = '#f87171'
    }
  })
  row.appendChild(send)
  wrap.appendChild(row)
  bodyEl.appendChild(wrap)
}

function wireTools(toolsEl, { onReload, onInfo, onReport }) {
  toolsEl.appendChild(iconBtn('reload', 'Get a new challenge', onReload))
  toolsEl.appendChild(iconBtn('info', 'How this works and privacy', onInfo))
  toolsEl.appendChild(iconBtn('report', 'Report a problem', onReport))
}

function renderChallenge(bodyEl, actionsEl, toolsEl, statusEl, ctx, root, hooks) {
  const captcha = ctx.captcha
  const assetUrl = ctx.assetUrl
  const type = captcha.type
  const ui = captcha.ui || {}
  bodyEl.style.overflow = 'hidden'
  bodyEl.classList.remove('zg-shake')

  wireTools(toolsEl, hooks)
  bodyEl.style.display = 'flex'
  bodyEl.style.flexDirection = 'column'
  bodyEl.style.minHeight = '0'

  // Prompt + large reference example (readable subject, not a 44px pin)
  const top = document.createElement('div')
  top.style.cssText =
    'display:flex;flex-direction:column;gap:8px;margin:0 0 8px;flex:0 0 auto;min-height:0'

  const prompt = document.createElement('div')
  prompt.style.cssText =
    'font-size:13px;font-weight:600;color:#fafafa;line-height:1.35'
  prompt.textContent = captcha.prompt
  top.appendChild(prompt)

  if (ui.referenceAssetPath) {
    const refRow = document.createElement('div')
    refRow.style.cssText =
      'display:flex;align-items:center;gap:10px;padding:8px;border-radius:10px;border:1px solid #27272a;background:#0c0c0e'
    const refImg = document.createElement('img')
    refImg.src = assetUrl(ui.referenceAssetPath)
    refImg.alt = `Example of ${ui.referenceLabel || 'target'}`
    refImg.title = `Example: ${ui.referenceLabel || 'target'}`
    refImg.style.cssText =
      'width:96px;height:72px;object-fit:contain;object-position:center;border-radius:8px;border:1px solid #3f3f46;flex:0 0 auto;background:#09090b'
    const refMeta = document.createElement('div')
    refMeta.style.cssText = 'min-width:0;flex:1'
    refMeta.innerHTML =
      '<div style="font-size:10px;font-weight:700;color:#71717a;letter-spacing:.06em;text-transform:uppercase;margin-bottom:4px">Match this example</div>' +
      '<div style="font-size:12px;color:#a1a1aa;line-height:1.35">Look for the same kind of object in the grid below</div>'
    refRow.appendChild(refImg)
    refRow.appendChild(refMeta)
    top.appendChild(refRow)
  }
  bodyEl.appendChild(top)

  const area = document.createElement('div')
  area.style.cssText =
    'flex:1 1 auto;min-height:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;width:100%'
  bodyEl.appendChild(area)
  actionsEl.innerHTML = ''

  const gridTypes = new Set([
    'image_select',
    'image_grid',
      'odd_one_out',
    'pair_match',
    'majority_select',
      ])

  if (gridTypes.has(type)) {
    const tiles = (ui.tiles || []).slice(0, 9)
    const selected = new Set()
    const order = []
    const grid = document.createElement('div')
    const cols = Number(ui.columns || (type === 'binary_pick' ? 2 : 3))
    let rows = Number(ui.rows || (tiles.length <= 6 ? 2 : 3))
    if (false) {
      rows = 2
    }
    if (type === 'binary_pick') {
      rows = 1
    }
    grid.style.cssText = [
      'display:grid',
      `grid-template-columns:repeat(${false ? 2 : cols},minmax(0,1fr))`,
      `grid-template-rows:repeat(${rows},minmax(0,1fr))`,
      'gap:6px',
      'flex:1 1 auto',
      'min-height:0',
      'width:100%',
      'max-height:100%',
      'align-self:stretch',
    ].join(';')
    area.style.justifyContent = 'stretch'
    area.style.alignItems = 'stretch'

    for (const t of tiles) {
      const cell = document.createElement('button')
      cell.type = 'button'
      cell.className = 'zg-tile'
      cell.setAttribute('aria-pressed', 'false')
      cell.style.cssText = [
        'width:100%',
        'height:100%',
        'min-height:0',
        'padding:0',
        'margin:0',
        'border:2px solid #3f3f46',
        'border-radius:8px',
        'overflow:hidden',
        'cursor:pointer',
        'background:#0c0c0e',
        'position:relative',
        'box-sizing:border-box',
        'transition:border-color .15s ease, box-shadow .15s ease, transform .12s ease',
        'display:flex',
        'align-items:center',
        'justify-content:center',
      ].join(';')
      const img = document.createElement('img')
      img.src = assetUrl(t.assetPath)
      img.alt = ''
      img.draggable = false
      img.style.cssText = 'display:block;width:100%;height:100%;object-fit:contain;object-position:center;background:#0c0c0e'
      cell.appendChild(img)
      cell.onmouseenter = () => {
        if (!cell.dataset.on) cell.style.borderColor = '#52525b'
      }
      cell.onmouseleave = () => {
        if (!cell.dataset.on) cell.style.borderColor = '#3f3f46'
      }
      cell.onclick = () => {
        if (false) { // sequence removed
          if (!order.includes(t.id)) {
            order.push(t.id)
            cell.dataset.on = '1'
            cell.setAttribute('aria-pressed', 'true')
            cell.style.borderColor = '#fafafa'
            const badge = document.createElement('span')
            badge.textContent = String(order.length)
            badge.style.cssText =
              'position:absolute;top:4px;right:4px;background:#18181b;color:#fafafa;border:1px solid #fafafa;font-size:10px;font-weight:700;border-radius:999px;width:16px;height:16px;display:flex;align-items:center;justify-content:center'
            cell.appendChild(badge)
            updateVerify()
          }
        } else if (type === 'odd_one_out' || type === 'binary_pick') {
          for (const c of grid.querySelectorAll('button')) {
            delete c.dataset.on
            c.setAttribute('aria-pressed', 'false')
            c.style.borderColor = '#3f3f46'
            c.style.boxShadow = 'none'
          }
          selected.clear()
          selected.add(t.id)
          cell.dataset.on = '1'
          cell.setAttribute('aria-pressed', 'true')
          cell.style.borderColor = '#fafafa'
          cell.style.boxShadow = 'inset 0 0 0 999px rgba(255,255,255,0.08)'
          updateVerify()
        } else if (selected.has(t.id)) {
          selected.delete(t.id)
          delete cell.dataset.on
          cell.setAttribute('aria-pressed', 'false')
          cell.style.borderColor = '#3f3f46'
          cell.style.boxShadow = 'none'
          updateVerify()
        } else {
          if (type === 'pair_match' && selected.size >= 2) return
          selected.add(t.id)
          cell.dataset.on = '1'
          cell.setAttribute('aria-pressed', 'true')
          cell.style.borderColor = '#fafafa'
          cell.style.boxShadow = 'inset 0 0 0 999px rgba(255,255,255,0.08)'
          updateVerify()
        }
      }
      grid.appendChild(cell)
    }
    area.appendChild(grid)

    let verifyBtn
    const updateVerify = () => {
      let ok = selected.size > 0
      /* sequence removed */
      if (type === 'odd_one_out' || type === 'binary_pick') ok = selected.size === 1
      if (type === 'pair_match') ok = selected.size === 2
      if (verifyBtn) {
        verifyBtn.disabled = !ok
        verifyBtn.style.opacity = ok ? '1' : '0.45'
      }
    }
    verifyBtn = btnPrimary(
      'Verify',
      () => {
        /* sequence removed */
        if (type === 'odd_one_out' || type === 'binary_pick') return hooks.onSubmit([...selected][0])
        return hooks.onSubmit([...selected])
      },
      true,
    )
    actionsEl.appendChild(verifyBtn)
  } else if (type === 'label_pick') {
    // Fixed-height hero so 2×2 choices never clip under footer
    area.style.justifyContent = 'flex-start'
    area.style.alignItems = 'stretch'
    area.style.gap = '10px'
    if (ui.assetPath) {
      const img = document.createElement('img')
      img.src = assetUrl(ui.assetPath)
      img.alt = 'What is this?'
      img.style.cssText =
        'width:100%;height:132px;object-fit:contain;object-position:center;border-radius:12px;display:block;border:1px solid #27272a;flex:0 0 auto;background:#0a0a0b'
      area.appendChild(img)
    }
    const list = document.createElement('div')
    list.style.cssText =
      'display:grid;grid-template-columns:1fr 1fr;gap:8px;width:100%;flex:0 0 auto'
    let chosen = null
    let verifyBtn
    for (const opt of ui.options || []) {
      const b = document.createElement('button')
      b.type = 'button'
      b.textContent = opt.label || opt.id
      b.style.cssText =
        'height:40px;border-radius:10px;border:1px solid #3f3f46;background:#18181b;color:#fafafa;font-size:12px;font-weight:600;cursor:pointer;transition:border-color .12s ease,background .12s ease'
      b.onclick = () => {
        chosen = opt.id
        for (const el of list.querySelectorAll('button')) {
          el.style.borderColor = '#3f3f46'
          el.style.background = '#18181b'
        }
        b.style.borderColor = '#fafafa'
        b.style.background = '#1f1f22'
        if (verifyBtn) {
          verifyBtn.disabled = false
          verifyBtn.style.opacity = '1'
        }
      }
      list.appendChild(b)
    }
    area.appendChild(list)
    verifyBtn = btnPrimary('Verify', () => hooks.onSubmit(chosen), true)
    actionsEl.appendChild(verifyBtn)
  } else if (type === 'count_objects') {
    area.style.justifyContent = 'stretch'
    area.style.alignItems = 'stretch'
    const tiles = (ui.tiles || []).slice(0, 9)
    const cols = Number(ui.columns || 3)
    const rows = Number(ui.rows || 3)
    const grid = document.createElement('div')
    grid.style.cssText = [
      'display:grid',
      `grid-template-columns:repeat(${cols},minmax(0,1fr))`,
      `grid-template-rows:repeat(${rows},minmax(0,1fr))`,
      'gap:6px',
      'flex:1 1 auto',
      'min-height:0',
      'width:100%',
    ].join(';')
    for (const t of tiles) {
      const cell = document.createElement('div')
      cell.style.cssText =
        'width:100%;height:100%;min-height:0;border:1px solid #3f3f46;border-radius:8px;overflow:hidden;background:#0c0c0e;display:flex;align-items:center;justify-content:center'
      const img = document.createElement('img')
      img.src = assetUrl(t.assetPath)
      img.alt = ''
      img.draggable = false
      img.style.cssText = 'display:block;width:100%;height:100%;object-fit:contain;object-position:center;background:#0c0c0e'
      cell.appendChild(img)
      grid.appendChild(cell)
    }
    area.appendChild(grid)
    const row = document.createElement('div')
    row.style.cssText =
      'display:flex;gap:5px;flex-wrap:nowrap;justify-content:center;width:100%;flex:0 0 auto'
    let picked = null
    let verifyBtn
    for (let n = 0; n <= 9; n++) {
      const chip = document.createElement('button')
      chip.type = 'button'
      chip.textContent = String(n)
      chip.style.cssText =
        'width:28px;height:32px;border-radius:8px;border:1px solid #3f3f46;background:#18181b;color:#e4e4e7;font-size:12px;font-weight:700;cursor:pointer;flex:0 0 auto'
      chip.onclick = () => {
        picked = n
        for (const c of row.querySelectorAll('button')) {
          c.style.borderColor = '#3f3f46'
          c.style.background = '#18181b'
          c.style.color = '#e4e4e7'
        }
        chip.style.borderColor = '#fafafa'
        chip.style.background = '#fafafa'
        chip.style.color = '#09090b'
        if (verifyBtn) {
          verifyBtn.disabled = false
          verifyBtn.style.opacity = '1'
        }
      }
      row.appendChild(chip)
    }
    area.appendChild(row)
    verifyBtn = btnPrimary('Verify', () => hooks.onSubmit(Number(picked)), true)
    actionsEl.appendChild(verifyBtn)
  } else if (type === 'text_distorted') {
    if (ui.assetPath) {
      const img = document.createElement('img')
      img.src = assetUrl(ui.assetPath)
      img.alt = 'Challenge characters'
      img.style.cssText =
        'max-width:100%;border-radius:12px;display:block;border:1px solid #27272a;background:#020617'
      area.appendChild(img)
    }
    const input = document.createElement('input')
    input.type = 'text'
    input.placeholder = 'Enter characters'
    input.autocomplete = 'off'
    input.spellcheck = false
    input.setAttribute('aria-label', 'Characters you see')
    input.style.cssText =
      'width:100%;max-width:240px;box-sizing:border-box;height:44px;background:#18181b;border:1px solid #3f3f46;color:#fafafa;border-radius:10px;padding:0 14px;font-size:16px;text-align:center;font-weight:600'
    area.appendChild(input)
    actionsEl.appendChild(btnPrimary('Verify', () => hooks.onSubmit(input.value)))
  } else if (type === 'rotate' || type === 'photo_rotate') {
    const box = document.createElement('div')
    box.style.cssText =
      'width:min(100%,220px);aspect-ratio:1;border-radius:16px;border:1px solid #27272a;background:#0a0a0b;display:flex;align-items:center;justify-content:center;overflow:hidden'
    const img = document.createElement('img')
    img.src = assetUrl(ui.assetPath)
    img.alt = 'Rotate upright'
    img.style.cssText =
      'max-width:88%;max-height:88%;object-fit:contain;transition:transform .18s cubic-bezier(.2,.8,.2,1)'
    let delta = 0
    const initial = Number(ui.initialDegrees || 0)
    const apply = () => {
      img.style.transform = `rotate(${delta}deg)`
    }
    apply()
    box.appendChild(img)
    area.appendChild(box)
    const hint = document.createElement('div')
    hint.style.cssText = 'font-size:11px;color:#71717a;text-align:center'
    hint.textContent = 'Rotate until it looks upright'
    area.appendChild(hint)
    actionsEl.appendChild(
      btnSecondary('↺', () => {
        delta -= Number(ui.step || 15)
        apply()
      }),
    )
    actionsEl.appendChild(
      btnSecondary('↻', () => {
        delta += Number(ui.step || 15)
        apply()
      }),
    )
    actionsEl.appendChild(
      btnPrimary('Verify', () =>
        hooks.onSubmit({
          degrees: delta,
          displayDegrees:
            type === 'photo_rotate'
              ? (((initial + delta) % 360) + 360) % 360
              : (initial + delta) % 360,
        }),
      ),
    )
  } else if (type === 'slider_align') {
    const track = document.createElement('img')
    track.src = assetUrl(ui.trackPath)
    track.alt = 'Align the piece'
    track.style.cssText = 'width:100%;border-radius:10px;display:block;border:1px solid #27272a'
    area.appendChild(track)
    const range = document.createElement('input')
    range.type = 'range'
    range.min = '0'
    range.max = String(ui.max || 240)
    range.value = '0'
    range.setAttribute('aria-label', 'Slider position')
    range.style.cssText = 'width:100%;max-width:280px;margin-top:4px'
    area.appendChild(range)
    const hint = document.createElement('div')
    hint.style.cssText = 'font-size:11px;color:#71717a;text-align:center'
    hint.textContent = 'Slide until the piece sits in the dashed slot'
    area.appendChild(hint)
    actionsEl.appendChild(btnPrimary('Verify', () => hooks.onSubmit(Number(range.value))))
  } else {
    area.textContent = 'Unsupported challenge type'
  }
}

export async function protectAction(opts) {
  return protectWithCaptcha({ ...opts, mode: opts.mount ? 'inline' : 'modal' })
}
export async function protectPage(opts) {
  return protectWithCaptcha({ ...opts, mode: 'modal' })
}

export default {
  CAPABILITY_HEADER,
  protectWithCaptcha,
  mountCaptchaWidget,
  mountCaptchaModal,
  protectAction,
  protectPage,
  captchaAssetUrl,
  HERO_TYPES,
}
