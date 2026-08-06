import { Env, getStore, config } from '../_shared';

// Serves rich-link (Open Graph / Twitter Card) previews for lab detail pages
// so pasting a lab link into WhatsApp, Slack, Telegram, etc. shows the lab's
// banner + title + description instead of a bare URL. Real browsers get the
// normal SPA index.html (served from ASSETS), preserving the single-page app.
export const onRequest: PagesFunction<Env> = async (ctx) => {
  const { env } = ctx;
  const slug = (ctx.params.slug as string) || '';
  const url = new URL(ctx.request.url);
  const c = config(env);
  const origin = c.APP_URL || url.origin;

  const isCrawler = /whatsapp|telegram|slack|twitterbot|facebookexternalhit|linkedinbot|discordbot|line\b|viber|skypeuri|snapchat|pinterest|googlebot|bingbot|duckduckbot|applebot|semrushbot|ahrefsbot|yandex/i.test(
    ctx.request.headers.get('user-agent') || '',
  );

  if (!isCrawler) {
    const index = await env.ASSETS.fetch(new URL('/index.html', origin).toString());
    return new Response(index.body, {
      status: index.status,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  const store = getStore(env);
  const lab = await store.getLab(slug);
  if (!lab) {
    const index = await env.ASSETS.fetch(new URL('/index.html', origin).toString());
    return new Response(index.body, {
      status: index.status,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  const title = lab.title || 'ZEXVRO Lab';
  const description = truncate(
    lab.description || 'Hands-on blockchain lab on ZEXVRO Labs.',
    200,
  );
  const category = lab.category || 'Smart Contracts';
  const difficulty = lab.difficulty || 'Introductory';
  const xp = lab.xpReward || 0;
  // bannerUrl may be a data: URL (from the editor uploader) which crawlers
  // cannot fetch; only emit og:image when we have an http(s) URL.
  const image = lab.bannerUrl && /^https?:\/\//i.test(lab.bannerUrl) ? lab.bannerUrl : '';
  const pageUrl = `${origin}/labs/${encodeURIComponent(slug)}`;

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)} · ZEXVRO Labs</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="${escapeHtml(description)}" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="ZEXVRO Labs" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${pageUrl}" />
    ${image ? `<meta property="og:image" content="${escapeHtml(image)}" />` : ''}
    <meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    ${image ? `<meta name="twitter:image" content="${escapeHtml(image)}" />` : ''}
    <meta name="theme-color" content="#000000" />
    <style>
      body { font-family: -apple-system, system-ui, sans-serif; background: #000; color: #e5e5e5; margin: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
      .card { max-width: 560px; width: 90%; border: 1px solid #27272a; border-radius: 20px; overflow: hidden; background: #0a0a0a; }
      ${image ? `.cover { width: 100%; aspect-ratio: 1 / 1; object-fit: cover; background: #18181b; display: block; }` : '.cover { display: none; }'}
      .body { padding: 20px 24px 26px; }
      .tag { display: inline-block; font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #7dd3fc; background: #082f49; border: 1px solid #075985; border-radius: 999px; padding: 4px 10px; margin-bottom: 12px; }
      h1 { font-size: 22px; line-height: 1.25; margin: 0 0 8px; color: #fff; }
      p { font-size: 14px; line-height: 1.55; color: #a1a1aa; margin: 0; }
      .meta { display: flex; gap: 14px; margin-top: 14px; font-size: 12px; font-weight: 700; color: #71717a; }
    </style>
  </head>
  <body>
    <div class="card">
      ${image ? `<img class="cover" src="${escapeHtml(image)}" alt="${escapeHtml(title)}" />` : ''}
      <div class="body">
        <span class="tag">${escapeHtml(difficulty)} · ${escapeHtml(category)}</span>
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(description)}</p>
        <div class="meta"><span>${xp} XP</span><span>Blockchain Lab</span><span>labs.zexvro.in</span></div>
      </div>
    </div>
  </body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
};

function escapeHtml(input: string): string {
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function truncate(input: string, max: number): string {
  const s = String(input).replace(/\s+/g, ' ').trim();
  return s.length > max ? `${s.slice(0, max).trim()}…` : s;
}
