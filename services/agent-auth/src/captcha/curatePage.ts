/** Local human labeling UI for trusted captcha photos. */
export const CURATE_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>ZEXVRO · Curate captcha photos</title>
  <style>
    :root { color-scheme: dark; font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #050506; color: #e4e4e7; min-height: 100vh; }
    header {
      position: sticky; top: 0; z-index: 20;
      border-bottom: 1px solid #27272a; background: rgba(5,5,6,.94); backdrop-filter: blur(12px);
      padding: 12px 20px; display: flex; flex-wrap: wrap; gap: 12px; align-items: center; justify-content: space-between;
    }
    h1 { font-size: 15px; font-weight: 600; margin: 0; letter-spacing: -.02em; }
    .sub { font-size: 12px; color: #71717a; margin-top: 2px; }
    .row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
    button, select {
      height: 40px; border-radius: 10px; border: 1px solid #3f3f46; background: #18181b; color: #fafafa;
      padding: 0 14px; font-size: 13px; font-weight: 600; cursor: pointer;
    }
    button.primary { background: #fafafa; color: #09090b; border-color: #fafafa; }
    button:disabled { opacity: .45; cursor: not-allowed; }
    button.ghost:hover { border-color: #52525b; background: #1f1f22; }
    main { max-width: 1280px; margin: 0 auto; padding: 18px 20px 110px; }
    .prompt {
      font-size: 24px; font-weight: 600; letter-spacing: -.03em; margin: 8px 0 6px; color: #fafafa;
    }
    .meta { font-size: 13px; color: #a1a1aa; margin-bottom: 12px; }
    .bar {
      height: 6px; background: #18181b; border-radius: 999px; overflow: hidden; margin: 0 0 18px; border: 1px solid #27272a;
    }
    .bar > i { display: block; height: 100%; background: #fafafa; width: 0%; transition: width .25s ease; }
    .labels {
      display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px;
    }
    .lab {
      border: 1px solid #27272a; border-radius: 999px; padding: 8px 12px; background: #0a0a0b; cursor: pointer; text-align: left;
      min-height: 40px;
    }
    .lab.active { border-color: #fafafa; background: #141416; }
    .lab strong { display: inline; font-size: 12px; color: #fafafa; margin-right: 6px; }
    .lab span { font-size: 11px; color: #71717a; }

    /* 10 images per row on desktop */
    .grid {
      display: grid !important;
      grid-template-columns: repeat(10, minmax(0, 1fr)) !important;
      gap: 8px !important;
      width: 100%;
      align-items: stretch;
    }
    @media (max-width: 1400px) {
      .grid { grid-template-columns: repeat(8, minmax(0, 1fr)) !important; }
    }
    @media (max-width: 1100px) {
      .grid { grid-template-columns: repeat(6, minmax(0, 1fr)) !important; }
    }
    @media (max-width: 800px) {
      .grid { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
    }
    @media (max-width: 520px) {
      .grid { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
    }

    .card {
      all: unset;
      position: relative;
      display: block !important;
      width: 100% !important;
      min-height: 0 !important;
      aspect-ratio: 1 / 1;
      border-radius: 10px !important;
      overflow: hidden !important;
      border: 2px solid #2a2a2e !important;
      background: #0a0a0b !important;
      cursor: pointer !important;
      padding: 0 !important;
      margin: 0 !important;
      box-sizing: border-box !important;
      transition: border-color .15s ease, transform .15s ease, box-shadow .15s ease;
    }
    .card:hover { transform: translateY(-2px); border-color: #52525b !important; }
    .card.selected {
      border-color: #fafafa !important;
      box-shadow: 0 0 0 1px #fafafa, inset 0 0 0 999px rgba(255,255,255,.10);
    }
    .card.selected .badge { background: #fafafa; color: #09090b; }
    .card.done { outline: 1px dashed #3f3f46; }
    .card img {
      width: 100% !important;
      height: 100% !important;
      object-fit: cover !important;
      display: block !important;
      pointer-events: none;
    }
    .card .badge {
      position: absolute; top: 10px; right: 10px; min-width: 28px; height: 28px; border-radius: 999px;
      background: #fafafa; color: #09090b; font-size: 14px; font-weight: 700;
      display: none; align-items: center; justify-content: center; padding: 0 8px;
      box-shadow: 0 4px 16px rgba(0,0,0,.4);
    }
    .card.selected .badge { display: flex; }
    .card .tag {
      position: absolute; left: 10px; bottom: 10px; font-size: 11px; font-weight: 600;
      background: rgba(0,0,0,.7); color: #d4d4d8; padding: 4px 8px; border-radius: 8px;
    }

    .footer-actions {
      position: fixed; left: 0; right: 0; bottom: 0; z-index: 30;
      border-top: 1px solid #27272a;
      background: rgba(5,5,6,.96); backdrop-filter: blur(12px);
      padding: 12px 20px calc(12px + env(safe-area-inset-bottom));
      display: flex; flex-wrap: wrap; gap: 10px; justify-content: space-between; align-items: center;
    }
    .status { font-size: 13px; color: #a1a1aa; max-width: 42ch; }
    .ok { color: #86efac; } .err { color: #f87171; }
    .pager { display:flex; gap:8px; align-items:center; }
    .page-pill {
      font-size: 12px; color: #a1a1aa; border: 1px solid #27272a; border-radius: 999px; padding: 8px 12px;
    }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>Curate trusted captcha photos</h1>
      <div class="sub">Select GOOD images only. Unselected on this page are junk forever and never shown again. Motorcycle = old bicycle set.</div>
    </div>
    <div class="row">
      <button class="ghost" id="btnPublish" title="Copy verified sets into live captcha bank">Publish to bank</button>
      <button class="ghost" id="btnRefresh">Refresh</button>
    </div>
  </header>
  <main>
    <div class="labels" id="labels"></div>
    <div class="prompt" id="prompt">Choose a label</div>
    <div class="meta" id="meta">—</div>
    <div class="bar"><i id="progress"></i></div>
    <div class="grid" id="grid"></div>
    <div class="footer-actions">
      <div class="status" id="status">Select GOOD · Select all · uncheck junk · Save. Unselected = gone forever.</div>
      <div class="pager">
        <button class="ghost" id="btnPrev">← Prev</button>
        <span class="page-pill" id="pagePill">Page 1</span>
        <button class="ghost" id="btnNext">Next →</button>
        <button class="ghost" id="btnSelectAll">Select all</button>
        <button class="ghost" id="btnClear">Clear</button>
        <button class="primary" id="btnSave" disabled>Save selected (0)</button>
      </div>
    </div>
  </main>
  <script type="module">
    const labelsEl = document.getElementById('labels');
    const grid = document.getElementById('grid');
    const promptEl = document.getElementById('prompt');
    const metaEl = document.getElementById('meta');
    const progress = document.getElementById('progress');
    const statusEl = document.getElementById('status');
    const btnSave = document.getElementById('btnSave');
    let label = null;
    let offset = 0;
    const limit = 50;
    let total = 0;
    let items = [];
    const selected = new Set();
    let lastIdx = null;

    async function j(url, init) {
      const r = await fetch(url, init);
      const b = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(b.detail || b.error_code || r.statusText);
      return b;
    }
    function setStatus(t, cls) {
      statusEl.className = 'status ' + (cls || '');
      statusEl.textContent = t;
    }
    function updateSave() {
      btnSave.disabled = !label || selected.size === 0;
      btnSave.textContent = 'Save selected (' + selected.size + ')';
    }

    async function loadLabels() {
      const data = await j('/demo/curate/api/labels');
      labelsEl.innerHTML = '';
      for (const L of data.labels) {
        const b = document.createElement('button');
        b.className = 'lab' + (L.label === label ? ' active' : '');
        b.innerHTML = '<strong>' + L.label + '</strong><span>' + L.verified + ' / ' + L.target + ' saved</span>';
        b.onclick = () => { label = L.label; offset = 0; selected.clear(); loadPage(); loadLabels(); };
        labelsEl.appendChild(b);
      }
    }

    async function loadPage() {
      if (!label) return;
      setStatus('Loading candidates…');
      const data = await j('/demo/curate/api/candidates?label=' + encodeURIComponent(label) + '&offset=' + offset + '&limit=' + limit);
      items = data.items;
      total = data.total;
      promptEl.textContent = data.prompt;
      const pageNum = Math.floor(offset/limit)+1; const pages = Math.max(1, Math.ceil(total/limit)); metaEl.textContent = 'Verified ' + data.verified + ' / ' + data.target + ' · pool ' + data.total + ' · page ' + pageNum + ' / ' + pages + ' · ' + items.length + ' large images';
      progress.style.width = Math.min(100, (data.verified / data.target) * 100) + '%';
      grid.innerHTML = '';
      items.forEach((it, idx) => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'card' + (selected.has(it.id) ? ' selected' : '') + (it.alreadyVerified ? ' done' : '');
        card.innerHTML = '<img loading="lazy" decoding="async" src="' + it.url + '" alt=""/><span class="badge">✓</span>'
          + (it.alreadyVerified ? '<span class="tag">saved</span>' : '');
        card.onclick = (e) => {
          if (e.shiftKey && lastIdx != null) {
            const a = Math.min(lastIdx, idx), b = Math.max(lastIdx, idx);
            for (let i = a; i <= b; i++) selected.add(items[i].id);
          } else if (selected.has(it.id)) selected.delete(it.id);
          else selected.add(it.id);
          lastIdx = idx;
          // re-render selection classes only
          [...grid.children].forEach((el, i) => {
            el.classList.toggle('selected', selected.has(items[i].id));
          });
          updateSave();
        };
        grid.appendChild(card);
      });
      updateSave();
      const pagePill = document.getElementById('pagePill');
      if (pagePill) pagePill.textContent = 'Page ' + (Math.floor(offset/limit)+1) + ' / ' + Math.max(1, Math.ceil(total/limit));
      setStatus(data.prompt + ' — only selected images are saved to the trusted bank');
    }

    btnSave.onclick = async () => {
      if (!label || selected.size === 0) return;
      btnSave.disabled = true;
      try {
        const pageIds = items.map((it) => it.id);
        const goodIds = [...selected];
        const badIds = pageIds.filter((id) => !selected.has(id));
        // selected = GOOD verified; unselected on this page = permanent REJECT (never show again)
        const res = await j('/demo/curate/api/save', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ label, ids: badIds, goodIds, mode: 'select_bad' }),
        });
        setStatus(
          'Saved ' + (res.saved || goodIds.length) + ' good · permanently dropped ' + (res.rejected || badIds.length) + ' junk · total verified ' + (res.totalVerified || res.total || '?') + '/50',
          'ok',
        );
        selected.clear();
        await loadLabels();
        await loadPage();
      } catch (e) {
        setStatus(e.message || String(e), 'err');
        updateSave();
      }
    };
    document.getElementById('btnSelectAll').onclick = () => {
      items.forEach((it) => selected.add(it.id));
      [...grid.children].forEach((el) => el.classList.add('selected'));
      updateSave();
      setStatus('All ' + items.length + ' on this page selected — uncheck junk, then Save');
    };
    btnClear.onclick = () => { selected.clear(); loadPage(); };
    btnPrev.onclick = () => { offset = Math.max(0, offset - limit); selected.clear(); loadPage(); };
    btnNext.onclick = () => { if (offset + limit < total) { offset += limit; selected.clear(); loadPage(); } };
    btnRefresh.onclick = () => { loadLabels(); if (label) loadPage(); };
    document.getElementById('btnPublish').onclick = async () => {
      try {
        const res = await j('/demo/curate/api/publish', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
        setStatus('Published to live bank: ' + JSON.stringify(res.published), 'ok');
      } catch (e) {
        setStatus(e.message || String(e), 'err');
      }
    };

    await loadLabels();
    // auto-select first incomplete label
    const stats = await j('/demo/curate/api/labels');
    const first = stats.labels.find((l) => l.verified < l.target) || stats.labels[0];
    if (first) { label = first.label; await loadLabels(); await loadPage(); }
  </script>
</body>
</html>`
