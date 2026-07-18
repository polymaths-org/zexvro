/** Professional sample site — fixed 360×456 modal, 3×3 image grid. */
export const CAPTCHA_DEMO_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>ZEXVRO Gate · Verification demo</title>
  <style>
    :root { color-scheme: dark; font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; }
    body { margin:0; min-height:100vh; background:#050506; color:#e4e4e7; }
    .wrap { max-width:880px; margin:0 auto; padding:56px 20px 80px; }
    .card {
      border:1px solid #27272a; background:#0a0a0b; border-radius:12px; padding:28px 28px 32px;
      box-shadow:0 16px 48px rgba(0,0,0,.35);
    }
    .badge {
      display:inline-flex; align-items:center; gap:6px; font-size:11px; font-weight:600;
      color:#a1a1aa; letter-spacing:.04em; text-transform:uppercase;
    }
    h1 { font-size:22px; font-weight:600; margin:14px 0 8px; color:#fafafa; letter-spacing:-.02em; }
    p { color:#a1a1aa; font-size:14px; line-height:1.55; max-width:48ch; margin:0; }
    .row { display:flex; gap:12px; flex-wrap:wrap; align-items:center; margin-top:22px; }
    button.primary {
      height:40px; padding:0 18px; border:0; border-radius:8px; cursor:pointer;
      background:#fafafa; color:#09090b; font-weight:600; font-size:13px;
    }
    button.primary:disabled { opacity:.45; cursor:not-allowed; }
    .stat { font-size:12px; color:#71717a; }
    .ok { color:#4ade80; } .err { color:#f87171; }
    pre { margin-top:20px; font-size:11px; color:#52525b; white-space:pre-wrap; word-break:break-all; }
    .grid-fake { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-top:28px; }
    .grid-fake div { height:64px; border-radius:8px; background:#18181b; border:1px solid #27272a; }

    #zg-modal { display:none; }
    #zg-modal[data-open="1"] { display:block; }
    .zg-back {
      position:fixed; inset:0; z-index:9999; background:rgba(0,0,0,.55); backdrop-filter:blur(2px);
      display:flex; align-items:center; justify-content:center; padding:16px;
    }
    .zg-panel {
      width:360px; max-width:min(360px, calc(100vw - 24px));
      height:456px; max-height:calc(100vh - 32px);
      background:#09090b; border:1px solid #27272a; border-radius:12px;
      box-shadow:0 16px 48px rgba(0,0,0,.5);
      display:flex; flex-direction:column; overflow:hidden; box-sizing:border-box;
    }
    .zg-h {
      height:44px; flex:0 0 44px; display:flex; align-items:center; justify-content:space-between;
      padding:0 12px; border-bottom:1px solid #27272a; box-sizing:border-box;
    }
    .zg-h .brand { font-size:12px; font-weight:600; color:#fafafa; letter-spacing:.02em; }
    .zg-h .sub { font-size:11px; color:#a1a1aa; }
    .zg-x { background:transparent; border:0; color:#a1a1aa; cursor:pointer; font-size:18px; padding:6px 8px; }
    .zg-body { flex:1; overflow:hidden; padding:10px 12px 8px; box-sizing:border-box; display:flex; flex-direction:column; min-height:0; }
    .zg-body.zg-scroll { overflow:auto; }
    .zg-prompt { font-size:13px; font-weight:600; color:#fafafa; line-height:1.3; margin:0; }
    .zg-stage {
      flex:1 1 auto; min-height:0; display:flex; flex-direction:column; align-items:center; justify-content:center;
      gap:12px; width:100%;
    }
    .zg-choice-grid {
      display:grid; grid-template-columns:1fr 1fr; gap:8px; width:100%; flex:0 0 auto;
    }
    .zg-choice {
      height:40px; border-radius:10px; border:1px solid #3f3f46; background:#18181b; color:#fafafa;
      font-size:12px; font-weight:600; cursor:pointer;
    }
    .zg-choice.on { border-color:#fafafa; background:#1f1f22; box-shadow:inset 0 0 0 1px rgba(255,255,255,.06); }
    .zg-digit-pad {
      display:grid; grid-template-columns:repeat(5,1fr); gap:8px; width:100%; max-width:280px;
    }
    .zg-digit {
      height:44px; border-radius:10px; border:1px solid #3f3f46; background:#18181b; color:#fafafa;
      font-size:15px; font-weight:700; cursor:pointer;
    }
    .zg-digit:hover { border-color:#52525b; }
    .zg-hero-img {
      width:100%; height:132px; object-fit:contain; object-position:center;
      border-radius:12px; border:1px solid #27272a; display:block; background:#0a0a0b;
    }
    .zg-rotate-stage {
      width:min(100%, 220px); aspect-ratio:1; border-radius:16px; border:1px solid #27272a; background:#0a0a0b;
      display:flex; align-items:center; justify-content:center; overflow:hidden;
    }
    .zg-rotate-stage img { max-width:88%; max-height:88%; object-fit:contain; transition:transform .18s cubic-bezier(.2,.8,.2,1); }
    .zg-count-row { display:flex; gap:6px; flex-wrap:wrap; justify-content:center; width:100%; flex:0 0 auto; margin-top:6px; }
    .zg-count-chip {
      width:28px; height:32px; border-radius:8px; border:1px solid #3f3f46; background:#18181b; color:#e4e4e7;
      font-size:12px; font-weight:700; cursor:pointer; flex:0 0 auto;
    }
    .zg-count-row { flex-wrap:nowrap; overflow:hidden; }
    .zg-count-chip.on { border-color:#fafafa; background:#fafafa; color:#09090b; }
    .zg-hint { font-size:11px; color:#71717a; text-align:center; line-height:1.4; }
    .tile-grid.rows-2 { grid-template-rows:repeat(2,minmax(0,1fr)); }
    .tile-grid.cols-2 { grid-template-columns:repeat(2,minmax(0,1fr)); grid-template-rows:minmax(0,1fr); }
    .zg-f {
      height:60px; flex:0 0 60px; padding:0 12px; border-top:1px solid #27272a;
      display:flex; align-items:center; justify-content:space-between; gap:8px; box-sizing:border-box;
    }
    .zg-f .muted { font-size:11px; color:#a1a1aa; flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; text-align:center; }
    .zg-tools { display:flex; gap:4px; align-items:center; }
    .zg-icon {
      width:32px; height:32px; border-radius:8px; border:1px solid transparent; background:transparent;
      color:#a1a1aa; cursor:pointer; font-size:14px; display:inline-flex; align-items:center; justify-content:center;
    }
    .zg-icon:hover { color:#fafafa; border-color:#3f3f46; background:#18181b; }
    .zg-btn {
      height:36px; padding:0 14px; border:0; border-radius:8px; cursor:pointer;
      font-size:12px; font-weight:600; background:#fafafa; color:#09090b;
    }
    .zg-btn:disabled { opacity:.45; cursor:not-allowed; }
    .zg-btn.sec { background:#18181b; color:#e4e4e7; border:1px solid #3f3f46; }
    .tile-grid {
      display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); grid-template-rows:repeat(3,minmax(0,1fr));
      gap:6px; flex:1 1 auto; min-height:0; width:100%;
    }
    .ctile {
      width:100%; height:100%; min-height:0; border:2px solid #3f3f46; border-radius:8px; overflow:hidden;
      cursor:pointer; background:#0c0c0e; padding:0; position:relative; box-sizing:border-box;
      transition: border-color .15s ease, box-shadow .15s ease, transform .15s ease;
      display:flex; align-items:center; justify-content:center;
    }
    .ctile:hover { transform: translateY(-1px); border-color:#52525b; }
    .ctile.selected { border-color:#fafafa; box-shadow:inset 0 0 0 999px rgba(255,255,255,.06); }
    /* contain: full subject visible — letterbox bars ok, cropping not */
    .ctile img {
      width:100%; height:100%; object-fit:contain; object-position:center; display:block;
      background:#0c0c0e; pointer-events:none;
    }
    input[type=text], input[type=number], input[type=range] {
      width:100%; box-sizing:border-box; height:40px; background:#18181b; border:1px solid #3f3f46;
      color:#fafafa; border-radius:8px; padding:0 12px; margin-top:8px;
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="badge">Premium Gate demo</div>
      <h1>Claim daily reward</h1>
      <p>
        Straight to the challenge: compact example thumbnail, full 3×3 grid (all rows visible),
        SVG tools, attempts feedback, and success motion — via <code style="color:#d4d4d8">@zexvro/gate</code>.
      </p>
      <div class="row">
        <button class="primary" id="claimBtn">Claim reward</button>
        <span class="stat" id="status">Ready</span>
      </div>
      <div class="grid-fake" aria-hidden="true"><div></div><div></div><div></div><div></div><div></div><div></div></div>
      <pre id="capOut"></pre>
    </div>
  </div>

  <div id="zg-modal">
    <div class="zg-back" id="zgBack">
      <div class="zg-panel">
        <div class="zg-h">
          <div>
            <div class="brand">Nebula Quest</div>
            <div class="sub">Protected by ZEXVRO</div>
          </div>
          <button type="button" class="zg-x" id="zgClose" aria-label="Close">×</button>
        </div>
        <div class="zg-body" id="zgBody"></div>
        <div class="zg-f">
          <div class="zg-tools" id="zgTools"></div>
          <div class="muted" id="zgStatus"></div>
          <div id="zgActions" style="display:flex;gap:8px"></div>
        </div>
      </div>
    </div>
  </div>

  <script type="module">
    const API = location.origin;
    const siteKey = 'zk_test_demo_public';
    const action = 'reward.claim';
    const origin = location.origin;
    const statusEl = document.getElementById('status');
    const capOut = document.getElementById('capOut');
    const claimBtn = document.getElementById('claimBtn');
    const modal = document.getElementById('zg-modal');
    const zgBody = document.getElementById('zgBody');
    const zgActions = document.getElementById('zgActions');
    const zgTools = document.getElementById('zgTools');
    const zgStatus = document.getElementById('zgStatus');

    function assetUrl(challengeId, path) {
      return API + '/v1/challenges/' + challengeId + '/captcha/assets/' + path + '?siteKey=' + encodeURIComponent(siteKey);
    }
    async function j(path, init) {
      const r = await fetch(API + path, init);
      const b = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(b.detail || r.statusText);
      return b;
    }
    function setStatus(t, cls) {
      statusEl.className = 'stat ' + (cls || '');
      statusEl.textContent = t;
    }
    function openModal() { modal.dataset.open = '1'; }
    function closeModal() { modal.dataset.open = '0'; zgBody.innerHTML=''; zgActions.innerHTML=''; zgStatus.textContent=''; }

    document.getElementById('zgClose').onclick = () => {
      closeModal(); claimBtn.disabled = false; setStatus('Cancelled', 'err');
    };
    document.getElementById('zgBack').onclick = (e) => {
      if (e.target.id === 'zgBack') document.getElementById('zgClose').click();
    };

    async function complete(challengeId, captchaId) {
      const completed = await j('/v1/challenges/' + challengeId + '/complete', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ siteKey, proofType: 'captcha_pass', proof: captchaId }),
      });
      zgBody.innerHTML = ''+ '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:14px;text-align:center">'+ '<div style="width:72px;height:72px;border-radius:999px;border:1px solid #3f3f46;background:radial-gradient(circle at 40% 35%,#1c1c1f,#0a0a0b);display:flex;align-items:center;justify-content:center">'+ '<svg width="36" height="36" viewBox="0 0 52 52"><circle cx="26" cy="26" r="22" fill="none" stroke="#52525b" stroke-width="2"/><path d="M15 27.5 L23 35 L38 18" fill="none" stroke="#fafafa" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'+ '</div><div style="font-size:15px;font-weight:600;color:#fafafa">You are verified</div>'+ '<div style="font-size:12px;color:#71717a">Continuing securely</div></div>';
      zgActions.innerHTML = '';
      zgTools.innerHTML = '';
      setTimeout(() => {
        closeModal();
        setStatus('Verified · ' + completed.class, 'ok');
        capOut.textContent = completed.capability;
        claimBtn.disabled = false;
        claimBtn.textContent = 'Claim again';
      }, 480);
    }

    async function submitAnswer(challengeId, captchaId, value) {
      zgStatus.textContent = 'Checking…';
      zgStatus.style.color = '#a1a1aa';
      try {
        await j('/v1/challenges/' + challengeId + '/captcha/answer', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ siteKey, captchaId, value }),
        });
        await complete(challengeId, captchaId);
      } catch (e) {
        zgStatus.textContent = e.message || String(e);
        zgStatus.style.color = '#f87171';
        zgBody.style.animation = 'none';
        zgBody.offsetHeight;
        zgBody.style.animation = 'zg-shake .32s ease';
      }
    }

    let liveChallengeId = null;
    let liveCap = null;

    const SVG = {
      reload: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><polyline points="21 3 21 9 15 9"/></svg>',
      info: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
      report: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>',
    };
    function wireTools() {
      zgTools.innerHTML = '';
      const mk = (name, label, fn) => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'zg-icon'; b.innerHTML = SVG[name] || '';
        b.setAttribute('aria-label', label); b.title = label; b.onclick = fn;
        return b;
      };
      zgTools.appendChild(mk('reload', 'New challenge', async () => {
        zgStatus.textContent = 'Loading…';
        try {
          const challenge = await j('/v1/challenges', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              siteKey, action, channel: 'human',
              clientPublicKey: 'ck_' + crypto.randomUUID().replace(/-/g,''), origin,
            }),
          });
          const issued = await j('/v1/challenges/' + challenge.id + '/captcha', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ siteKey }),
          });
          render(challenge.id, issued.captcha);
          zgStatus.textContent = '';
        } catch (e) {
          zgStatus.textContent = e.message || 'Could not reload';
          zgStatus.style.color = '#f87171';
        }
      }));
      zgTools.appendChild(mk('info', 'About this check', () => {
        zgBody.innerHTML = '';
        zgActions.innerHTML = '';
        const h = document.createElement('div');
        h.style.cssText = 'font-size:14px;font-weight:600;color:#fafafa;margin-bottom:10px';
        h.textContent = 'About this check';
        zgBody.appendChild(h);
        for (const line of [
          'ZEXVRO Gate confirms a person is present before sensitive actions.',
          'Challenges rotate (images, text, and more). Answers stay on the Gate server.',
          'Agents never use this UI — they authenticate with keys and proof-of-possession.',
          'Optional reports help us fix broken or unclear challenges. We do not sell captcha data.',
        ]) {
          const p = document.createElement('p');
          p.style.cssText = 'font-size:12px;color:#a1a1aa;line-height:1.5;margin:0 0 10px';
          p.textContent = line;
          zgBody.appendChild(p);
        }
        const back = document.createElement('button');
        back.className = 'zg-btn sec'; back.textContent = 'Back to challenge';
        back.onclick = () => render(liveChallengeId, liveCap);
        zgBody.appendChild(back);
      }));
      zgTools.appendChild(mk('report', 'Report a problem', () => {
        zgBody.innerHTML = '';
        zgActions.innerHTML = '';
        const h = document.createElement('div');
        h.style.cssText = 'font-size:14px;font-weight:600;color:#fafafa;margin-bottom:8px';
        h.textContent = 'Report a problem';
        zgBody.appendChild(h);
        let reason = 'unclear';
        for (const [id, label] of [
          ['broken_image','Image broken or blank'],
          ['unclear','Challenge is unclear'],
          ['wrong_answer','I think the answer is wrong'],
          ['accessibility','Hard to use (accessibility)'],
          ['offensive','Offensive content'],
          ['other','Other'],
        ]) {
          const row = document.createElement('label');
          row.style.cssText = 'display:flex;gap:8px;align-items:center;font-size:12px;margin:6px 0;cursor:pointer';
          const input = document.createElement('input');
          input.type = 'radio'; input.name = 'reason'; input.value = id;
          if (id === reason) input.checked = true;
          input.onchange = () => { reason = id; };
          row.appendChild(input);
          row.appendChild(document.createTextNode(label));
          zgBody.appendChild(row);
        }
        const note = document.createElement('textarea');
        note.rows = 3; note.placeholder = 'Optional details';
        note.style.cssText = 'width:100%;box-sizing:border-box;margin-top:8px;background:#18181b;border:1px solid #3f3f46;color:#fafafa;border-radius:8px;padding:8px;font-size:12px';
        zgBody.appendChild(note);
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;margin-top:12px';
        const cancel = document.createElement('button'); cancel.className='zg-btn sec'; cancel.textContent='Cancel';
        cancel.onclick = () => render(liveChallengeId, liveCap);
        const send = document.createElement('button'); send.className='zg-btn'; send.textContent='Send report';
        send.onclick = async () => {
          try {
            await j('/v1/captcha/report', {
              method: 'POST', headers: { 'content-type': 'application/json' },
              body: JSON.stringify({
                siteKey, challengeId: liveChallengeId, captchaId: liveCap.captchaId,
                captchaType: liveCap.type, reason, note: note.value.trim() || undefined,
              }),
            });
            zgStatus.textContent = 'Report sent — thank you';
            render(liveChallengeId, liveCap);
          } catch (e) {
            zgStatus.textContent = e.message || 'Could not send';
            zgStatus.style.color = '#f87171';
          }
        };
        row.appendChild(cancel); row.appendChild(send);
        zgBody.appendChild(row);
      }));
    }

    function render(challengeId, cap) {
      liveChallengeId = challengeId;
      liveCap = cap;
      zgBody.innerHTML = '';
      zgActions.innerHTML = '';
      zgStatus.textContent = '';
      zgStatus.style.color = '';
      zgBody.classList.remove('zg-scroll');
      openModal();
      wireTools();

      const ui = cap.ui || {};
      const top = document.createElement('div');
      top.style.cssText = 'display:flex;flex-direction:column;gap:8px;margin:0 0 8px;flex:0 0 auto';
      const prompt = document.createElement('div');
      prompt.className = 'zg-prompt';
      prompt.textContent = cap.prompt;
      top.appendChild(prompt);
      if (ui.referenceAssetPath) {
        const refRow = document.createElement('div');
        refRow.style.cssText = 'display:flex;align-items:center;gap:10px;padding:8px;border-radius:10px;border:1px solid #27272a;background:#0c0c0e';
        const refImg = document.createElement('img');
        refImg.src = assetUrl(challengeId, ui.referenceAssetPath);
        refImg.alt = 'Example';
        refImg.style.cssText = 'width:96px;height:72px;object-fit:contain;object-position:center;border-radius:8px;border:1px solid #3f3f46;flex:0 0 auto;background:#09090b';
        const refMeta = document.createElement('div');
        refMeta.innerHTML = '<div style="font-size:10px;font-weight:700;color:#71717a;letter-spacing:.06em;text-transform:uppercase;margin-bottom:4px">Match this example</div><div style="font-size:12px;color:#a1a1aa;line-height:1.35">Look for the same kind of object in the grid below</div>';
        refRow.appendChild(refImg);
        refRow.appendChild(refMeta);
        top.appendChild(refRow);
      }
      zgBody.appendChild(top);

      const stage = document.createElement('div');
      stage.className = 'zg-stage';
      zgBody.appendChild(stage);

      const gridTypes = new Set(['image_select','image_grid','odd_one_out','pair_match','majority_select','binary_pick']);
      if (gridTypes.has(cap.type)) {
        const tiles = (ui.tiles || []).slice(0, 9);
        const selected = new Set();
        const order = [];
        const grid = document.createElement('div');
        grid.className = 'tile-grid';
        if (false && tiles.length <= 4) {
          grid.classList.add('cols-2');
          grid.style.gridTemplateColumns = 'repeat(2,minmax(0,1fr))';
          grid.style.gridTemplateRows = 'repeat(2,minmax(0,1fr))';
        } else if (cap.type === 'binary_pick') {
          grid.classList.add('cols-2');
          grid.style.gridTemplateColumns = 'repeat(2,minmax(0,1fr))';
          grid.style.gridTemplateRows = 'minmax(0,1fr)';
        } else if (cap.type === 'pair_match' || tiles.length <= 6) {
          grid.classList.add('rows-2');
          grid.style.gridTemplateRows = 'repeat(2,minmax(0,1fr))';
          if (tiles.length <= 6) grid.style.gridTemplateColumns = 'repeat(3,minmax(0,1fr))';
        }
        let verify;
        const update = () => {
          let ok = selected.size > 0;
          if (cap.type === 'image_select') ok = order.length > 0;
          if (cap.type === 'binary_pick' || cap.type === 'odd_one_out') ok = selected.size === 1;
          if (cap.type === 'pair_match') ok = selected.size === 2;
          if (verify) verify.disabled = !ok;
        };
        for (const t of tiles) {
          const el = document.createElement('button');
          el.type = 'button';
          el.className = 'ctile';
          const img = document.createElement('img');
          img.src = assetUrl(challengeId, t.assetPath);
          img.alt = '';
          el.appendChild(img);
          if (cap.type === 'image_select') {
            // numbered badges applied on click
          }
          el.onclick = () => {
            if (cap.type === 'image_select') {
              if (!order.includes(t.id)) {
                order.push(t.id);
                el.classList.add('selected');
                const badge = document.createElement('span');
                badge.textContent = String(order.length);
                badge.style.cssText = 'position:absolute;top:4px;right:4px;background:#18181b;color:#fafafa;border:1px solid #fafafa;font-size:10px;font-weight:700;border-radius:999px;width:16px;height:16px;display:flex;align-items:center;justify-content:center';
                el.appendChild(badge);
                update();
              }
            } else if (cap.type === 'binary_pick' || cap.type === 'odd_one_out') {
              selected.clear();
              for (const c of grid.querySelectorAll('button')) c.classList.remove('selected');
              selected.add(t.id);
              el.classList.add('selected');
              update();
            } else {
              if (cap.type === 'pair_match' && !selected.has(t.id) && selected.size >= 2) return;
              if (selected.has(t.id)) { selected.delete(t.id); el.classList.remove('selected'); }
              else { selected.add(t.id); el.classList.add('selected'); }
              update();
            }
          };
          grid.appendChild(el);
        }
        stage.style.justifyContent = 'stretch';
        stage.appendChild(grid);
        verify = document.createElement('button');
        verify.className = 'zg-btn';
        verify.textContent = 'Verify';
        verify.disabled = true;
        verify.onclick = () => submitAnswer(
          challengeId,
          cap.captchaId,
          (cap.type === 'binary_pick' || cap.type === 'odd_one_out') ? [...selected][0] : [...selected],
        );
        zgActions.appendChild(verify);
      } else if (cap.type === 'label_pick') {
        // Fixed compact hero + 2x2 choices always visible (never clip under footer)
        stage.style.justifyContent = 'flex-start';
        stage.style.gap = '10px';
        if (ui.assetPath) {
          const img = document.createElement('img');
          img.src = assetUrl(challengeId, ui.assetPath);
          img.alt = 'What is this?';
          img.className = 'zg-hero-img';
          img.style.cssText = 'width:100%;height:132px;object-fit:contain;object-position:center;border-radius:12px;border:1px solid #27272a;display:block;flex:0 0 auto;background:#0a0a0b';
          stage.appendChild(img);
        }
        const list = document.createElement('div');
        list.className = 'zg-choice-grid';
        list.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:8px;width:100%;flex:0 0 auto';
        let chosen = null;
        const v = document.createElement('button'); v.className='zg-btn'; v.textContent='Verify'; v.disabled = true;
        for (const opt of (ui.options || [])) {
          const b = document.createElement('button');
          b.type = 'button'; b.className = 'zg-choice'; b.textContent = opt.label || opt.id;
          b.style.cssText = 'height:40px;border-radius:10px;border:1px solid #3f3f46;background:#18181b;color:#fafafa;font-size:12px;font-weight:600;cursor:pointer';
          b.onclick = () => {
            chosen = opt.id;
            v.disabled = false;
            for (const el of list.querySelectorAll('button')) {
              el.classList.remove('on');
              el.style.borderColor = '#3f3f46';
              el.style.background = '#18181b';
            }
            b.classList.add('on');
            b.style.borderColor = '#fafafa';
            b.style.background = '#1f1f22';
          };
          list.appendChild(b);
        }
        stage.appendChild(list);
        v.onclick = () => submitAnswer(challengeId, cap.captchaId, chosen);
        zgActions.appendChild(v);
      } else if (cap.type === 'count_objects') {
        const tiles = (ui.tiles || []).slice(0, 9);
        const grid = document.createElement('div');
        grid.className = 'tile-grid';
        for (const t of tiles) {
          const el = document.createElement('div');
          el.className = 'ctile';
          el.style.cursor = 'default';
          const img = document.createElement('img');
          img.src = assetUrl(challengeId, t.assetPath);
          img.alt = '';
          el.appendChild(img);
          grid.appendChild(el);
        }
        stage.style.justifyContent = 'stretch';
        stage.appendChild(grid);
        const row = document.createElement('div');
        row.className = 'zg-count-row';
        let picked = null;
        const v = document.createElement('button'); v.className='zg-btn'; v.textContent='Verify'; v.disabled = true;
        for (let n = 0; n <= 9; n++) {
          const chip = document.createElement('button');
          chip.type = 'button';
          chip.className = 'zg-count-chip';
          chip.textContent = String(n);
          chip.onclick = () => {
            picked = n;
            for (const c of row.querySelectorAll('button')) c.classList.remove('on');
            chip.classList.add('on');
            v.disabled = false;
          };
          row.appendChild(chip);
        }
        stage.appendChild(row);
        v.onclick = () => submitAnswer(challengeId, cap.captchaId, Number(picked));
        zgActions.appendChild(v);
      } else if (cap.type === 'rotate' || cap.type === 'photo_rotate') {
        const box = document.createElement('div');
        box.className = 'zg-rotate-stage';
        const img = document.createElement('img');
        img.src = assetUrl(challengeId, ui.assetPath);
        img.alt = 'Rotate upright';
        let delta = 0;
        const initial = Number(ui.initialDegrees || 0);
        const apply = () => {
          // photo_rotate: image is already rotated by server initialDegrees in asset for SVG rotate;
          // for photo we apply initial+delta; for SVG rotate asset already has initial baked, apply delta only.
          img.style.transform = 'rotate(' + delta + 'deg)';
        };
        apply();
        box.appendChild(img);
        stage.appendChild(box);
        const hint = document.createElement('div');
        hint.className = 'zg-hint';
        hint.textContent = 'Rotate until it looks upright';
        stage.appendChild(hint);
        const left = document.createElement('button'); left.className='zg-btn sec'; left.textContent='↺';
        const right = document.createElement('button'); right.className='zg-btn sec'; right.textContent='↻';
        left.onclick = () => { delta -= Number(ui.step || 15); apply(); };
        right.onclick = () => { delta += Number(ui.step || 15); apply(); };
        zgActions.appendChild(left); zgActions.appendChild(right);
        const v = document.createElement('button'); v.className='zg-btn'; v.textContent='Verify';
        v.onclick = () => {
          if (cap.type === 'photo_rotate') {
            submitAnswer(challengeId, cap.captchaId, {
              degrees: delta,
              displayDegrees: (((initial + delta) % 360) + 360) % 360,
            });
          } else {
            submitAnswer(challengeId, cap.captchaId, {
              degrees: delta,
              displayDegrees: (initial + delta) % 360,
            });
          }
        };
        zgActions.appendChild(v);
      } else if (cap.type === 'slider_align') {
        const track = document.createElement('img');
        track.src = assetUrl(challengeId, ui.trackPath);
        track.alt = 'Align the piece';
        track.style.cssText = 'width:100%;border-radius:10px;display:block;border:1px solid #27272a';
        stage.appendChild(track);
        const range = document.createElement('input');
        range.type = 'range'; range.min = 0; range.max = ui.max || 240; range.value = 0;
        range.style.cssText = 'width:100%;max-width:280px;margin-top:8px';
        stage.appendChild(range);
        const hint = document.createElement('div');
        hint.className = 'zg-hint';
        hint.textContent = 'Slide until the piece sits in the dashed slot';
        stage.appendChild(hint);
        const v = document.createElement('button'); v.className='zg-btn'; v.textContent='Verify';
        v.onclick = () => submitAnswer(challengeId, cap.captchaId, Number(range.value));
        zgActions.appendChild(v);
      } else if (cap.type === 'text_distorted') {
        if (ui.assetPath) {
          const img = document.createElement('img');
          img.src = assetUrl(challengeId, ui.assetPath);
          img.alt = 'Characters';
          img.style.cssText = 'max-width:100%;border-radius:12px;display:block;border:1px solid #27272a;background:#020617';
          stage.appendChild(img);
        }
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Characters';
        input.autocomplete = 'off';
        input.spellcheck = false;
        input.style.cssText = 'width:100%;max-width:240px;box-sizing:border-box;height:44px;background:#18181b;border:1px solid #3f3f46;color:#fafafa;border-radius:10px;padding:0 14px;font-size:16px;text-align:center;font-weight:600';
        stage.appendChild(input);
        const v = document.createElement('button'); v.className='zg-btn'; v.textContent='Verify';
        v.onclick = () => submitAnswer(challengeId, cap.captchaId, input.value);
        zgActions.appendChild(v);
      } else {
        stage.textContent = 'Unsupported challenge type';
        const v = document.createElement('button'); v.className='zg-btn'; v.textContent='Close';
        v.onclick = () => closeModal();
        zgActions.appendChild(v);
      }
    }

    function showSoftGate() {
      openModal();
      zgTools.innerHTML = '';
      zgActions.innerHTML = '';
      zgStatus.textContent = '';
      zgBody.innerHTML = ''
        + '<div style="display:flex;flex-direction:column;height:100%;justify-content:center;gap:14px">'
        + '<div style="width:44px;height:44px;border-radius:12px;background:linear-gradient(145deg,#18181b,#27272a);border:1px solid #3f3f46;display:flex;align-items:center;justify-content:center">✓</div>'
        + '<div><div style="font-size:16px;font-weight:600;color:#fafafa;margin-bottom:6px">Confirm you are here</div>'
        + '<div style="font-size:13px;color:#a1a1aa;line-height:1.5">One step before claiming your reward. Agents use keys — this is for people.</div></div>'
        + '<div style="font-size:11px;color:#71717a">Protected by ZEXVRO · privacy-first</div></div>';
      const cont = document.createElement('button');
      cont.className = 'zg-btn';
      cont.textContent = 'Continue';
      cont.onclick = async () => {
        zgStatus.textContent = 'Opening challenge…';
        await openPuzzle();
      };
      const hard = document.createElement('button');
      hard.className = 'zg-btn sec';
      hard.textContent = 'Use challenge';
      hard.onclick = () => openPuzzle();
      zgActions.appendChild(hard);
      zgActions.appendChild(cont);
    }

    async function openPuzzle() {
      try {
        const challenge = await j('/v1/challenges', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            siteKey, action, channel: 'human',
            clientPublicKey: 'ck_' + crypto.randomUUID().replace(/-/g,''), origin,
          }),
        });
        const issued = await j('/v1/challenges/' + challenge.id + '/captcha', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            siteKey,
            // QA hook: /demo/captcha?type=image_select (or any CAPTCHA_TYPES value)
            ...(new URLSearchParams(location.search).get('type')
              ? { preferredType: new URLSearchParams(location.search).get('type') }
              : {}),
          }),
        });
        render(challenge.id, issued.captcha);
        setStatus('Complete the challenge');
      } catch (e) {
        setStatus(e.message || String(e), 'err');
        claimBtn.disabled = false;
        closeModal();
      }
    }

    claimBtn.onclick = async () => {
      claimBtn.disabled = true; capOut.textContent = ''; setStatus('Opening verification…');
      await openPuzzle();
    };
  </script>
</body>
</html>`
