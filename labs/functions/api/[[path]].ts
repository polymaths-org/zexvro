import {
  Env,
  config,
  adminLogins,
  getStore,
  authenticate,
  isAdmin,
  requireUser,
  sanitizeLab,
  checkRateLimit,
  json,
  readBody,
} from '../_shared';
import { Lab, User } from '../../src/types';

// /api/<path>
export const onRequest: PagesFunction<Env> = async (ctx) => {
  const { env } = ctx;
  const url = new URL(ctx.request.url);
  const pathSegs = (ctx.params.path as string[]) || [];
  const method = ctx.request.method;

  const path = '/' + pathSegs.join('/');
  const store = getStore(env);
  const c = config(env);
  const ip = ctx.request.headers.get('cf-connecting-ip') || 'anon';

  const mutateKey = (prefix: string, user: User | null) =>
    `${prefix}:${user ? user.id : 'anon'}`;

  // Best-effort throttle on mutating endpoints.
  const throttled = (key: string, limit = 30, windowMs = 60_000): Response | null => {
    const r = checkRateLimit(env, key, limit, windowMs);
    if (!r.ok) {
      const res = json({ error: 'Too many requests. Slow down and try again.' }, 429);
      res.headers.set('Retry-After', String(r.retryAfterSec));
      return res;
    }
    return null;
  };

  try {
    // health
    if (path === '/health' && method === 'GET') {
      return json({ status: 'ok', build: 9, time: new Date().toISOString() });
    }

    // legacy auth (GitHub OAuth popup) — kept for backward compat
    if (path === '/auth/me' && method === 'GET') {
      const user = await authenticate(ctx.request, env);
      if (!user) return json({ authenticated: false, user: null });
      return json({ authenticated: true, user });
    }

    if (path === '/auth/logout' && method === 'POST') {
      const res = json({ success: true });
      res.headers.set('Set-Cookie', clearCookie(c.isSecure));
      return res;
    }

    if (path === '/auth/github/url' && method === 'GET') {
      if (!c.GITHUB_CLIENT_ID) {
        return json({ error: 'GitHub OAuth is not configured on the server (missing GITHUB_CLIENT_ID).' }, 500);
      }
      const redirectUri = `${c.APP_URL}/auth/callback`;
      const params = new URLSearchParams({
        client_id: c.GITHUB_CLIENT_ID,
        redirect_uri: redirectUri,
        scope: 'read:user user:email',
        state: Math.random().toString(36).slice(2),
      });
      return json({ url: `https://github.com/login/oauth/authorize?${params}` });
    }

    // labs CRUD
    if (path === '/labs' && method === 'GET') {
      const user = await authenticate(ctx.request, env);
      const admin = isAdmin(user, env);
      const labs = await store.listLabs();
      // Drafts / unpublished labs are visible only to admins and the lab's
      // listed editors (by GitHub username). Everyone else sees published labs.
      const visible = admin
        ? labs
        : labs.filter((l: any) => {
            const isDraft = l.status === 'draft' || l.isPublished === false;
            if (!isDraft) return true;
            const editors = Array.isArray(l.editors) ? l.editors.map((e: string) => e.toLowerCase()) : [];
            return user ? editors.includes(user.username?.toLowerCase()) : false;
          });
      return json({ labs: visible.map((l: Lab) => sanitizeLab(l, false)) });
    }

    if (path === '/labs' && method === 'POST') {
      const throttle = throttled(mutateKey('labs', null), 60, 60_000);
      if (throttle) return throttle;
      const user = await requireUser(ctx.request, env);
      if (!user) return json({ error: 'Unauthorized' }, 401);
      const body = await readBody(ctx.request);
      const newLab: Lab = {
        ...body,
        id: `lab_${Date.now()}`,
        slug: body.title ? body.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') : `lab-${Date.now()}`,
        createdAt: new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString().split('T')[0],
        author: user.username,
      };
      await store.createLab(newLab);
      return json({ success: true, lab: sanitizeLab(newLab, isAdmin(user, env)) }, 201);
    }

    const enrollMatch = path.match(/^\/labs\/([^/]+)\/enroll$/);
    if (enrollMatch && method === 'POST') {
      const user = await requireUser(ctx.request, env);
      if (!user) return json({ error: 'Unauthorized' }, 401);
      const throttle = throttled(mutateKey('enroll', user), 10, 60_000);
      if (throttle) return throttle;
      const lab = await store.getLab(decodeURIComponent(enrollMatch[1]));
      if (!lab) return json({ error: 'Lab not found' }, 404);
      await store.updateLab(lab.id, { enrolledCount: (lab.enrolledCount || 0) + 1 });
      return json({ success: true, enrolledCount: (lab.enrolledCount || 0) + 1 });
    }

    const labMatch = path.match(/^\/labs\/([^/]+)$/);
    if (labMatch) {
      const idOrSlug = decodeURIComponent(labMatch[1]);
      if (method === 'GET') {
        const user = await authenticate(ctx.request, env);
        const admin = isAdmin(user, env);
        const lab = await store.getLab(idOrSlug);
        if (!lab) return json({ error: 'Lab not found' }, 404);
        const isDraft = lab.status === 'draft' || lab.isPublished === false;
        const editors = Array.isArray(lab.editors) ? lab.editors.map((e: string) => e.toLowerCase()) : [];
        const privileged = admin || (user ? editors.includes(user.username?.toLowerCase()) : false);
        if (isDraft && !privileged) return json({ error: 'Lab not found' }, 404);
        return json({ lab: sanitizeLab(lab, admin) });
      }
      const user = await requireUser(ctx.request, env);
      if (!user) return json({ error: 'Unauthorized' }, 401);
      if (method === 'PUT' || method === 'DELETE') {
        if (!isAdmin(user, env)) return json({ error: 'Forbidden' }, 403);
        const throttle = throttled(mutateKey('lab', user));
        if (throttle) return throttle;
        if (method === 'PUT') {
          const body = await readBody(ctx.request);
          const updated = await store.updateLab(idOrSlug, body);
          if (!updated) return json({ error: 'Lab not found' }, 404);
          return json({ success: true, lab: sanitizeLab(updated, true) });
        }
        const ok = await store.deleteLab(idOrSlug);
        if (!ok) return json({ error: 'Lab not found' }, 404);
        return json({ success: true });
      }
    }

    // badges
    if (path === '/badges' && method === 'GET') {
      return json({ badges: await store.listBadges() });
    }

    if (path === '/badges' && method === 'POST') {
      const user = await requireUser(ctx.request, env);
      if (!user) return json({ error: 'Unauthorized' }, 401);
      if (!isAdmin(user, env)) return json({ error: 'Forbidden' }, 403);
      const throttle = throttled(mutateKey('badge', user));
      if (throttle) return throttle;
      const body = await readBody(ctx.request);
      const badge = { ...body, id: `badge_${Date.now()}` };
      await store.createBadge(badge);
      return json({ success: true, badge }, 201);
    }

    const badgeMatch = path.match(/^\/badges\/([^/]+)$/);
    if (badgeMatch) {
      const id = decodeURIComponent(badgeMatch[1]);
      if (method === 'PUT' || method === 'DELETE') {
        const user = await requireUser(ctx.request, env);
        if (!user) return json({ error: 'Unauthorized' }, 401);
        if (!isAdmin(user, env)) return json({ error: 'Forbidden' }, 403);
        const throttle = throttled(mutateKey('badge', user));
        if (throttle) return throttle;
        if (method === 'PUT') {
          const body = await readBody(ctx.request);
          const updated = await store.updateBadge(id, body);
          if (!updated) return json({ error: 'Badge not found' }, 404);
          return json({ success: true, badge: updated });
        }
        const ok = await store.deleteBadge(id);
        if (!ok) return json({ error: 'Badge not found' }, 404);
        return json({ success: true });
      }
    }

    // admin: users + submissions
    if (path === '/admin/users' && method === 'GET') {
      const user = await requireUser(ctx.request, env);
      if (!user) return json({ error: 'Unauthorized' }, 401);
      if (!isAdmin(user, env)) return json({ error: 'Forbidden' }, 403);
      return json({ users: await store.listUsers() });
    }

    if (path === '/admin/invite' && method === 'POST') {
      const user = await requireUser(ctx.request, env);
      if (!user) return json({ error: 'Unauthorized' }, 401);
      if (!isAdmin(user, env)) return json({ error: 'Forbidden' }, 403);
      return json({ success: true });
    }

    if (path === '/submissions' && method === 'GET') {
      const user = await requireUser(ctx.request, env);
      if (!user) return json({ error: 'Unauthorized' }, 401);
      if (!isAdmin(user, env)) return json({ error: 'Forbidden' }, 403);
      return json({ submissions: await store.listSubmissions() });
    }

    if (path === '/submissions' && method === 'POST') {
      const user = await requireUser(ctx.request, env);
      if (!user) return json({ error: 'Unauthorized' }, 401);
      const throttle = throttled(mutateKey('sub', user));
      if (throttle) return throttle;
      const body = await readBody(ctx.request);
      const submission = {
        id: `sub_${Date.now()}`,
        userId: user.id,
        userName: user.name || user.username,
        status: 'pending',
        submittedAt: new Date().toISOString(),
        ...body,
      };
      await store.saveSubmission(submission);
      return json({ success: true, submission }, 201);
    }

    const subMatch = path.match(/^\/submissions\/([^/]+)$/);
    if (subMatch) {
      const id = decodeURIComponent(subMatch[1]);
      const user = await requireUser(ctx.request, env);
      if (!user) return json({ error: 'Unauthorized' }, 401);
      if (!isAdmin(user, env)) return json({ error: 'Forbidden' }, 403);
      if (method === 'PUT') {
        const throttle = throttled(mutateKey('sub', user));
        if (throttle) return throttle;
        const body = await readBody(ctx.request);
        const updated = await store.updateSubmission(id, body);
        if (!updated) return json({ error: 'Submission not found' }, 404);
        return json({ success: true, submission: updated });
      }
    }

    // public certificate verification (shareable /verify/<number>)
    const certMatch = path.match(/^\/certificates\/verify\/([^/]+)$/);
    if (certMatch && method === 'GET') {
      const number = decodeURIComponent(certMatch[1]);
      const cert = await store.findCertificateByNumber(number);
      if (!cert) return json({ valid: false, certificate: null });
      return json({ valid: true, certificate: cert });
    }

    // public user profile (shareable /u/<username>)
    const userMatch = path.match(/^\/users\/([^/]+)$/);
    if (userMatch && method === 'GET') {
      const username = decodeURIComponent(userMatch[1]);
      const user = await store.findUserByUsername(username);
      if (!user) return json({ error: 'User not found' }, 404);
      const certificates = await store.listCertificates(user.id);
      return json({ user, certificates });
    }

    // certificates
    if (path === '/certificates' && method === 'GET') {
      const user = await requireUser(ctx.request, env);
      if (!user) return json({ error: 'Unauthorized' }, 401);
      const certs = await store.listCertificates(user.id);
      return json({ certificates: certs });
    }
    if (path === '/certificates' && method === 'POST') {
      const user = await requireUser(ctx.request, env);
      if (!user) return json({ error: 'Unauthorized' }, 401);
      const throttle = throttled(mutateKey('cert', user));
      if (throttle) return throttle;
      const body = await readBody(ctx.request);
      await store.saveCertificate(user.id, body);
      return json({ success: true, certificate: body });
    }

    // verify task
    if (path === '/verify-task' && method === 'POST') {
      const throttle = throttled(`verify:${ip}`, 60, 60_000);
      if (throttle) return throttle;
      const { labId, taskId, userCommand, codeContent, flag } = await readBody(ctx.request);
      const lab = await store.getLab(labId);
      if (!lab) return json({ error: 'Lab not found' }, 404);
      const allTasks = [...(lab.pages || []).flatMap((p) => p.elements), ...lab.tasks];
      const task = allTasks.find((t) => t.id === taskId);
      if (!task) return json({ error: 'Task not found' }, 404);

      const cmd = (userCommand || '').trim().toLowerCase();
      const reqCmd = (task.verificationCommand || '').trim().toLowerCase();

      const norm = (s: string) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
      const expectedOut = norm(task.expectedOutput);

      let isPassed = false;
      let logMessage = '';
      if (task.expectedFlag && flag != null) {
        isPassed = norm(flag) === norm(task.expectedFlag);
        logMessage = isPassed
          ? '[CHECK PASSED] Flag verified.'
          : '[CHECK FAILED] Incorrect flag. Re-check the lab content.';
      } else if (reqCmd && cmd.includes(reqCmd)) {
        // Command contains the expected keyword AND (if an expected output is
        // pinned) the submitted output matches it. Never accept leftover tokens.
        const outputOk = expectedOut ? cmd.includes(expectedOut) : true;
        isPassed = outputOk;
        logMessage = isPassed
          ? `[CHECK PASSED] Command executed: "${userCommand}".\n${task.expectedOutput || 'SUCCESS'}`
          : '[CHECK FAILED] Output did not match the expected result.';
      } else if (expectedOut && cmd.length > 0) {
        // Code task: submitted output must match the pinned expected output.
        isPassed = cmd.includes(expectedOut) || expectedOut.includes(cmd);
        logMessage = isPassed
          ? '[CHECK PASSED] Code/output verified successfully.'
          : `[CHECK FAILED] Expected: "${task.expectedOutput}". Your input did not match.`;
      } else {
        isPassed = false;
        logMessage = `[CHECK FAILED] Expected command keyword: "${task.verificationCommand || 'correct execution'}"`;
      }
      return json({ passed: isPassed, log: logMessage, taskId, xpAwarded: isPassed ? 50 : 0 });
    }

    // AI lab assistant
    if (path === '/ai/lab-assistant' && method === 'POST') {
      const throttle = throttled(`ai:${ip}`, 30, 60_000);
      if (throttle) return throttle;
      return handleLabAssistant(ctx.request, env);
    }

    if (path === '/ai/health' && method === 'POST') {
      return json({ status: 'ok', message: 'ZEXVRO AI Service online', timestamp: Date.now() });
    }

    return json({ error: 'Not found' }, 404);
  } catch (e: any) {
    return json({ error: e.message || 'Internal error' }, 500);
  }
};

function clearCookie(secure: boolean): string {
  const chunks = ['zexvro_labs_session=', 'Path=/', 'Max-Age=0', 'HttpOnly', 'SameSite=Lax'];
  if (secure) chunks.push('Secure');
  return chunks.join('; ');
}

async function handleLabAssistant(ctx: any, env: Env): Promise<Response> {
  try {
    const { labTitle, taskTitle, userQuestion, codeSnippet, terminalLogs } = await readBody(ctx.request);
    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
      return json({
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

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] }),
      },
    );
    const data: any = await resp.json();
    const answer = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response from AI mentor.';
    return json({ answer });
  } catch (e: any) {
    return json({ error: 'Failed to generate AI guidance', details: e?.message }, 500);
  }
}
