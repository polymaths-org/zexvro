// Shared by the landing waitlist section and the /waitlist page.
const WAITLIST_API_BASE =
  (((globalThis as typeof globalThis & { __ZEXVRO_CONFIG__?: Record<string, string> }).__ZEXVRO_CONFIG__?.VITE_API_URL ??
    import.meta.env.VITE_API_URL) as string | undefined)?.trim().replace(/\/$/, '') ||
  'https://zexvro-platform-api.zexvro.workers.dev';

export type WaitlistJoin = { kind: 'joined' } | { kind: 'already' } | { kind: 'error'; message: string };

export async function joinWaitlist(email: string, source: string): Promise<WaitlistJoin> {
  try {
    const res = await fetch(`${WAITLIST_API_BASE}/api/waitlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, source }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      status?: string;
      error_description?: string;
      error?: string;
    };

    if (!res.ok) {
      return { kind: 'error', message: data.error_description || data.error || 'Something went wrong. Try again.' };
    }
    return data.status === 'already_joined' ? { kind: 'already' } : { kind: 'joined' };
  } catch {
    return { kind: 'error', message: 'Network error. Check your connection and try again.' };
  }
}
