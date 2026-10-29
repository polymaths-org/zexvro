import { Env, config, adminLogins, getStore, setSession, validOAuthState, oauthStateCookie } from '../_shared';
import { User } from '../../src/types';

// GET /auth/callback — GitHub OAuth redirect target
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const { env } = ctx;
  const url = new URL(ctx.request.url);
  const code = url.searchParams.get('code');
  const c = config(env);

  if (!code || !c.GITHUB_CLIENT_ID || !c.GITHUB_CLIENT_SECRET) {
    return new Response('<h2>Missing OAuth parameters or server config.</h2>', {
      status: 400,
      headers: { 'Content-Type': 'text/html' },
    });
  }

  if(!validOAuthState(ctx.request))return new Response('Invalid OAuth state',{status:400});
  if(c.SESSION_SECRET.length<32)return new Response('Session signing is not configured',{status:503});
  try {
    // 1) Exchange code for an access token (form-urlencoded per GitHub docs)
    const tokenBody = new URLSearchParams({
      client_id: c.GITHUB_CLIENT_ID,
      client_secret: c.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: `${c.APP_URL}/auth/callback`,
    }).toString();
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: tokenBody,
    });
    const tokenStatus = tokenRes.status;
    const tokenText = await tokenRes.text();
    let tokenData: any;
    try {
      tokenData = JSON.parse(tokenText);
    } catch {
      // GitHub sometimes returns plain-text/query errors -> parse form-style
      const params = new URLSearchParams(tokenText);
      tokenData = Object.fromEntries(params.entries());
    }
    const accessToken = tokenData?.access_token;
    if (!accessToken) {
      throw new Error(
        `Token exchange failed (HTTP ${tokenStatus}): ${tokenData?.error_description || tokenData?.error || tokenText}`,
      );
    }

    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'zexvro-labs',
      },
    });
    const gh: any = await parseJsonOrText(userRes.text(), `user (HTTP ${userRes.status})`);

    if(!userRes.ok || !gh.id || !gh.login)throw new Error('GitHub profile lookup failed');
    let email = gh.email || '';
    if (!email) {
      try {
        const emailRes = await fetch('https://api.github.com/user/emails', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github+json',
            'User-Agent': 'zexvro-labs',
          },
        });
        const emails: any[] = await parseJsonOrText(emailRes.text(), `emails (HTTP ${emailRes.status})`);
        email = emails.find((e) => e.verified && e.primary)?.email || emails[0]?.email || '';
      } catch {
        email = '';
      }
    }

    const store = getStore(env);
    const githubId: string = String(gh.id);
    const isAdmin = adminLogins(env).has(String(gh.login || '').toLowerCase());
    const existing = await store.getUser(githubId);
    const user: User = existing
      ? {
          ...existing,
          name: gh.name || existing.name || gh.login,
          email,
          username: gh.login,
          avatarUrl: gh.avatar_url || existing.avatarUrl,
          role: isAdmin ? 'admin' : existing.role,
          githubConnected: true,
        }
      : {
          id: githubId,
          name: gh.name || gh.login,
          email,
          username: gh.login,
          avatarUrl: gh.avatar_url || '',
          role: isAdmin ? 'admin' : 'student',
          xp: 0,
          streakDays: 0,
          completedLabsCount: 0,
          githubConnected: true,
        };
    await store.upsertUser(user);

    const html = `<!DOCTYPE html>
<html>
  <head>
    <title>ZEXVRO Labs Auth Success</title>
    <style>
      body { font-family: system-ui, sans-serif; background: #050505; color: #fff; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
      .card { background: #111113; border: 1px solid #27272a; padding: 2rem; border-radius: 12px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
      .icon { width: 48px; height: 48px; background: #22c55e; border-radius: 50%; margin: 0 auto 1rem; display: flex; align-items: center; justify-content: center; font-size: 24px; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="icon">✓</div>
      <h2>Authenticated with GitHub!</h2>
      <p>Connecting to ZEXVRO Labs...</p>
    </div>
    <script>
      if (window.opener) {
        window.opener.postMessage({
          type: 'OAUTH_AUTH_SUCCESS',
          user: ${JSON.stringify(user).replace(/</g,'\\u003c')},
        }, ${JSON.stringify(new URL(c.APP_URL).origin)});
        setTimeout(() => window.close(), 600);
      } else {
        window.location.href = '/';
      }
    </script>
  </body>
</html>`;

    const res = new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' },
    });
    const response=await setSession(res, user, env);
    response.headers.append('Set-Cookie',oauthStateCookie('',c.isSecure));
    return response;
  } catch (error: any) {
    // Temporary diagnostics: report the real cause on the failure page.
    return new Response(
      `<h2>GitHub authentication failed.</h2><pre style="text-align:left;font-size:11px;white-space:pre-wrap">Please retry sign-in or contact the administrator.</pre>`,
      { status: 500, headers: { 'Content-Type': 'text/html' } },
    );
  }
};

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c),
  );
}

async function parseJsonOrText(p: Promise<string>, ctx: string): Promise<any> {
  let text: string;
  try {
    text = await p;
  } catch (e: any) {
    throw new Error(`${ctx}: fetch failed: ${e?.message || e}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${ctx}: non-JSON response (starts: ${text.slice(0, 200)}): ${text.slice(0, 500)}`);
  }
}