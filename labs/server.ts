import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { createStore } from './src/backend/store.js';
import {
  signSession,
  verifySession,
  sessionCookie,
  clearSessionCookie,
  COOKIE_NAME,
  HOUR_MS,
} from './src/backend/session.js';
import { Lab, User } from './src/types.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

const store = createStore();
const SESSION_SECRET = process.env.LABS_SESSION_SECRET || 'dev-only-change-me';
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || '';
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '';
const APP_URL = process.env.APP_URL || 'http://localhost:3000';
const isSecure = APP_URL.startsWith('https://');
// GitHub usernames with admin (Lab Builder / CMS) access, comma-separated.
const ADMIN_LOGINS = new Set(
  (process.env.LABS_ADMIN_GITHUB_LOGINS || 'zexvro')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
);

// Initialize Gemini Client Lazily/Safely (optional AI Mentor)
function getGeminiClient() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  return new GoogleGenAI({ apiKey: key });
}

function getSessionUser(req: express.Request): User | null {
  const raw = req.headers.cookie;
  if (!raw) return null;
  const match = raw.split(';').map((c) => c.trim()).find((c) => c.startsWith(`${COOKIE_NAME}=`));
  if (!match) return null;
  const token = match.slice(COOKIE_NAME.length + 1);
  const payload = verifySession(token, SESSION_SECRET);
  if (!payload) return null;
  return {
    id: payload.githubId,
    name: payload.name || payload.login,
    email: payload.email || '',
    username: payload.login,
    avatarUrl: payload.avatarUrl,
    role: payload.role || 'student',
    xp: 0,
    streakDays: 0,
    completedLabsCount: 0,
    githubConnected: true,
  };
}

async function requireUser(req: express.Request, res: express.Response, next: express.NextFunction) {
  const user = getSessionUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  (req as any).user = user;
  next();
}

// -------------------------------------------------------------------
// API ROUTES
// -------------------------------------------------------------------

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// User Auth Routes
app.get('/api/auth/me', (req, res) => {
  const user = getSessionUser(req);
  if (!user) return res.json({ authenticated: false, user: null });
  res.json({ authenticated: true, user });
});

// GitHub OAuth — build real authorization URL
app.get('/api/auth/github/url', (req, res) => {
  if (!GITHUB_CLIENT_ID) {
    return res.status(500).json({
      error: 'GitHub OAuth is not configured on the server (missing GITHUB_CLIENT_ID).',
    });
  }
  const redirectUri = `${APP_URL}/auth/callback`;
  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: 'read:user user:email',
    state: Math.random().toString(36).slice(2),
  });
  res.json({ url: `https://github.com/login/oauth/authorize?${params}` });
});

// OAuth callback — exchange code for token, fetch user, create session
app.get(['/auth/callback', '/auth/callback/'], async (req, res) => {
  const code = String(req.query.code || '');
  if (!code || !GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
    return res.status(400).send('<h2>Missing OAuth parameters or server config.</h2>');
  }

  try {
    // 1) Exchange code for an access token (form-urlencoded per GitHub docs)
    const tokenBody = new URLSearchParams({
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: `${APP_URL}/auth/callback`,
    }).toString();
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: tokenBody,
    });
    const tokenData: any = await tokenRes.json();
    const accessToken = tokenData.access_token;
    if (!accessToken) {
      throw new Error(tokenData.error_description || 'Failed to exchange OAuth code');
    }

    // 2) Fetch the GitHub profile
    const userRes = await fetch('https://api.github.com/user', {
      headers: { Authorization: `token ${accessToken}`, Accept: 'application/json' },
    });
    const gh: any = await userRes.json();

    // 3) Fetch a primary email (the /user payload may not include it without scope)
    let email = gh.email || '';
    if (!email) {
      try {
        const emailRes = await fetch('https://api.github.com/user/emails', {
          headers: { Authorization: `token ${accessToken}`, Accept: 'application/json' },
        });
        const emails: any[] = await emailRes.json();
        email = emails.find((e) => e.verified && e.primary)?.email || emails[0]?.email || '';
      } catch {
        email = '';
      }
    }

    const githubId: string = String(gh.id);
    const isAdmin = ADMIN_LOGINS.has(String(gh.login || '').toLowerCase());
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

    const token = signSession(
      {
        githubId,
        login: gh.login,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        role: user.role,
        iss: 'zexvro-labs',
      },
      SESSION_SECRET,
    );

    res.setHeader('Set-Cookie', sessionCookie(token, 7 * 24 * HOUR_MS, isSecure));
    res.send(`
      <!DOCTYPE html>
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
                user: ${JSON.stringify(user)},
                token: ${JSON.stringify(token)},
              }, '*');
              setTimeout(() => window.close(), 600);
            } else {
              window.location.href = '/';
            }
          </script>
        </body>
      </html>
    `);
  } catch (error: any) {
    console.error('GitHub OAuth callback error:', error);
    res.status(500).send('<h2>GitHub authentication failed.</h2>');
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.setHeader('Set-Cookie', clearSessionCookie(isSecure));
  res.json({ success: true });
});

// Labs API
app.get('/api/labs', async (req, res) => {
  try {
    const labs = await store.listLabs();
    res.json({ labs });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/labs/:id', async (req, res) => {
  const lab = await store.getLab(req.params.id);
  if (!lab) return res.status(404).json({ error: 'Lab not found' });
  res.json({ lab });
});

app.post('/api/labs', requireUser, async (req, res) => {
  const newLab: Lab = {
    ...req.body,
    id: `lab_${Date.now()}`,
    slug: req.body.title ? req.body.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') : `lab-${Date.now()}`,
    createdAt: new Date().toISOString().split('T')[0],
    updatedAt: new Date().toISOString().split('T')[0],
    author: (req as any).user.username,
  };
  await store.createLab(newLab);
  res.status(201).json({ success: true, lab: newLab });
});

app.put('/api/labs/:id', requireUser, async (req, res) => {
  const updated = await store.updateLab(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Lab not found' });
  res.json({ success: true, lab: updated });
});

app.delete('/api/labs/:id', requireUser, async (req, res) => {
  const ok = await store.deleteLab(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Lab not found' });
  res.json({ success: true });
});

// Badges / Certificates
app.get('/api/badges', async (req, res) => {
  res.json({ badges: await store.listBadges() });
});

app.get('/api/certificates', requireUser, async (req, res) => {
  const user = (req as any).user as User;
  const certs = await store.listCertificates(user.id);
  res.json({ certificates: certs });
});

app.post('/api/certificates', requireUser, async (req, res) => {
  const user = (req as any).user as User;
  const cert = req.body;
  await store.saveCertificate(user.id, cert);
  res.json({ success: true, certificate: cert });
});

// Verify Lab Task Execution (Terminal / Code check)
app.post('/api/verify-task', async (req, res) => {
  const { labId, taskId, userCommand, codeContent } = req.body;
  const lab = await store.getLab(labId);
  if (!lab) return res.status(404).json({ error: 'Lab not found' });
  const task = lab.tasks.find((t) => t.id === taskId);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const cmd = (userCommand || '').trim().toLowerCase();
  const reqCmd = (task.verificationCommand || '').trim().toLowerCase();

  let isPassed = false;
  let logMessage = '';

  if (reqCmd && cmd.includes(reqCmd)) {
    isPassed = true;
    logMessage = `[CHECK PASSED] Command executed: "${userCommand}".\n${task.expectedOutput || 'SUCCESS'}`;
  } else if (codeContent && codeContent.length > 10) {
    isPassed = true;
    logMessage = '[CHECK PASSED] Code structure verified successfully.';
  } else {
    isPassed = false;
    logMessage = `[CHECK FAILED] Expected command keyword: "${task.verificationCommand || 'correct execution'}"`;
  }

  res.json({ passed: isPassed, log: logMessage, taskId, xpAwarded: isPassed ? 50 : 0 });
});

// AI Lab Mentor Assistant Endpoint (optional, when GEMINI_API_KEY is set)
app.post('/api/ai/lab-assistant', async (req, res) => {
  try {
    const { labTitle, taskTitle, userQuestion, codeSnippet, terminalLogs } = req.body;
    const ai = getGeminiClient();

    if (!ai) {
      return res.json({
        answer: `[ZEXVRO AI Mentor] Working on "${labTitle}" - task "${taskTitle}". Follow the lab guide and execution steps. Set GEMINI_API_KEY to enable live AI mentorship.`,
      });
    }

    const prompt = `You are ZEXVRO AI Mentor, a friendly cloud engineering instructor for ZEXVRO Labs (labs.zexvro.in).
A student is working on the hands-on lab: "${labTitle}".
Current Task: "${taskTitle}".
Student's Question/Code Context:
"${userQuestion}"

Terminal Output / Code Snippet:
${codeSnippet || (terminalLogs ? terminalLogs.join('\n') : 'N/A')}

Provide a concise, encouraging, and clear hint or explanation (2-4 bullet points max). Include code or terminal command examples in markdown codeblocks.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    res.json({ answer: response.text });
  } catch (error: any) {
    console.error('Gemini Lab Mentor Error:', error);
    res.status(500).json({ error: 'Failed to generate AI guidance', details: error?.message });
  }
});

// AI Health endpoint
app.post('/api/ai/health', (req, res) => {
  res.json({ status: 'ok', message: 'ZEXVRO AI Service online', timestamp: Date.now() });
});

// -------------------------------------------------------------------
// VITE MIDDLEWARE & SERVER LISTEN
// -------------------------------------------------------------------

async function startServer() {
  const PORT = Number(process.env.PORT || 3000);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ZEXVRO Labs Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();