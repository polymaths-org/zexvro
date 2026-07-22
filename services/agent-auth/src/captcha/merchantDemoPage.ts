/** Sample merchant site protected by ZEXVRO Gate — dual channel demo. */
export const MERCHANT_DEMO_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Acme Shop · Protected by ZEXVRO Gate</title>
  <style>
    :root { color-scheme: dark; font-family: ui-sans-serif, system-ui, sans-serif; }
    body { margin:0; min-height:100vh; background:#050506; color:#e4e4e7; }
    .wrap { max-width:720px; margin:0 auto; padding:48px 20px 80px; }
    .card {
      border:1px solid #27272a; background:#0a0a0b; border-radius:14px; padding:28px;
      box-shadow:0 16px 48px rgba(0,0,0,.35); margin-bottom:16px;
    }
    .badge {
      display:inline-flex; font-size:11px; font-weight:700; letter-spacing:.04em; text-transform:uppercase;
      color:#a1a1aa; margin-bottom:10px;
    }
    h1 { font-size:22px; font-weight:600; margin:0 0 8px; color:#fafafa; }
    h2 { font-size:14px; font-weight:600; margin:0 0 8px; color:#fafafa; }
    p { color:#a1a1aa; font-size:14px; line-height:1.55; margin:0 0 12px; }
    .grid { display:grid; gap:12px; grid-template-columns:1fr 1fr; }
    @media (max-width:640px){ .grid { grid-template-columns:1fr; } }
    button {
      height:40px; padding:0 16px; border:0; border-radius:9px; cursor:pointer;
      font-weight:600; font-size:13px;
    }
    button.primary { background:#fafafa; color:#09090b; }
    button.sec { background:#18181b; color:#e4e4e7; border:1px solid #3f3f46; }
    button:disabled { opacity:.45; cursor:not-allowed; }
    pre {
      margin:12px 0 0; padding:12px; border-radius:10px; background:#09090b; border:1px solid #27272a;
      font-size:11px; color:#a1a1aa; white-space:pre-wrap; word-break:break-all; max-height:220px; overflow:auto;
    }
    .ok { color:#4ade80; } .err { color:#f87171; } .muted { color:#71717a; font-size:12px; }
    code { color:#d4d4d8; }
    .row { display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin-top:14px; }
    .pill {
      display:inline-flex; align-items:center; gap:6px; border-radius:999px; padding:4px 10px;
      font-size:11px; font-weight:600; border:1px solid #3f3f46; color:#a1a1aa;
    }
    .pill.human { border-color:#38bdf8; color:#7dd3fc; }
    .pill.agent { border-color:#a78bfa; color:#c4b5fd; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="badge">Sample developer website</div>
      <h1>Acme Shop</h1>
      <p>
        This site integrated <strong>ZEXVRO Gate</strong>. Humans and agents use
        <em>different</em> paths to the same protected APIs.
      </p>
      <div class="row">
        <span class="pill human">Human → captcha / session</span>
        <span class="pill agent">Agent → Ed25519 + PoP</span>
      </div>
    </div>

    <div class="grid">
      <div class="card">
        <h2>Human path · checkout</h2>
        <p class="muted">Policy: <code>checkout.submit</code> · human_only</p>
        <p>Browser users complete a Gate human ceremony (captcha in product default). Agents cannot mint this class via captcha_pass.</p>
        <div class="row">
          <button class="primary" id="btnHuman" type="button">Checkout as human</button>
        </div>
        <pre id="outHuman" class="muted">Waiting…</pre>
      </div>

      <div class="card">
        <h2>Agent path · search API</h2>
        <p class="muted">Policy: <code>search.query</code> · either / agent-capable</p>
        <p>
          Autonomous agents do <strong>not</strong> open captcha. They register a key, sign the challenge,
          attach capability + PoP, and call the API.
        </p>
        <div class="row">
          <button class="sec" id="btnAgentHint" type="button">How agents call this</button>
        </div>
        <pre id="outAgent" class="muted">Run: npm run gate:agent-site-demo</pre>
      </div>
    </div>

    <div class="card">
      <h2>Protected endpoints on this demo site</h2>
      <pre class="muted">POST /demo/site/api/checkout   → requires class=human capability
GET  /demo/site/api/search     → requires class=agent capability + PoP
GET  /demo/site/api/public     → open (no Gate)</pre>
      <p class="muted" style="margin-top:12px">
        Live agent autonomous demo (Node): <code>npm run gate:agent-site-demo</code>
      </p>
    </div>
  </div>
  <script type="module">
    const API = location.origin;
    const siteKey = 'zk_test_demo_public';
    const outH = document.getElementById('outHuman');
    const outA = document.getElementById('outAgent');

    document.getElementById('btnHuman').onclick = async () => {
      outH.textContent = 'Opening Gate human ceremony (captcha)…';
      outH.className = 'muted';
      try {
        // Prefer SDK captcha if available via dynamic import path in monorepo demos;
        // for this page use REST soft/session is less ideal — call captcha demo flow:
        // Redirect-style: open captcha demo then come back is heavy; use BrowserGate captcha when bundled.
        // Here we call Gate captcha ceremony directly via a minimal modalless path for demo page simplicity:
        const { protectWithCaptcha, CAPABILITY_HEADER } = await import('/demo/site/sdk/captcha.js').catch(() => ({}));
        let capability, klass, note;
        if (protectWithCaptcha) {
          const r = await protectWithCaptcha({
            apiBase: API,
            siteKey,
            action: 'checkout.submit',
            origin: location.origin,
            mode: 'modal',
          });
          capability = r.capability; klass = r.class; note = r.securityNote;
        } else {
          // Fallback: show user the real captcha demo
          outH.innerHTML = 'Use the full captcha demo: <a href="/demo/captcha" style="color:#7dd3fc">/demo/captcha</a> (SDK captcha not mounted on this static page).';
          return;
        }
        const res = await fetch(API + '/demo/site/api/checkout', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            [CAPABILITY_HEADER || 'x-zexvro-capability']: capability,
          },
          body: JSON.stringify({ item: 'sku_demo', qty: 1 }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.detail || body.error || res.statusText);
        outH.className = 'ok';
        outH.textContent = JSON.stringify({ human: true, class: klass, note, server: body }, null, 2);
      } catch (e) {
        outH.className = 'err';
        outH.textContent = e.message || String(e);
      }
    };

    document.getElementById('btnAgentHint').onclick = () => {
      outA.className = 'muted';
      outA.textContent = [
        'Autonomous agent (Node) — no captcha UI:',
        '',
        '1) generateAgentKeyPair()',
        '2) POST /v1/admin/agents { publicKey }',
        '3) GateAgent.obtainCapability({ action: "search.query" })',
        '4) createPop({ htm, htu })',
        '5) GET /demo/site/api/search with x-zexvro-capability + x-zexvro-pop',
        '',
        'Run: npm run gate:agent-site-demo',
      ].join('\\n');
    };
  </script>
</body>
</html>`
