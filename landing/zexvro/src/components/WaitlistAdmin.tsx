import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';

const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined)?.trim().replace(/\/$/, '') ||
  'https://qkuostruh3.execute-api.us-east-1.amazonaws.com';

type Entry = {
  email: string;
  created_at: number;
  source: string;
};

function resolveSecret(): string {
  const params = new URLSearchParams(window.location.search);
  const explicit = params.get('secret') || params.get('key') || params.get('') || '';
  if (explicit) return explicit.trim();

  // Support /waitlist?=<secret> and /waitlist?<secret>
  const raw = window.location.search.replace(/^\?/, '');
  if (!raw) return '';
  if (raw.startsWith('=')) return raw.slice(1).split('&')[0].trim();
  if (!raw.includes('=')) return raw.split('&')[0].trim();
  return '';
}

export const WaitlistAdmin: React.FC = () => {
  const secret = useMemo(() => resolveSecret(), []);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    if (!secret) {
      setError('Missing secret. Open /waitlist?secret=<WAITLIST_ADMIN_SECRET>');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        `${API_BASE}/api/waitlist?secret=${encodeURIComponent(secret)}`,
      );
      const data = (await res.json().catch(() => ({}))) as {
        count?: number;
        entries?: Entry[];
        error_description?: string;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error_description || data.error || `Request failed (${res.status})`);
        setEntries([]);
        setCount(0);
        return;
      }
      setEntries(data.entries || []);
      setCount(data.count ?? data.entries?.length ?? 0);
    } catch {
      setError('Network error reaching waitlist API.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [secret]);

  return (
    <div className="min-h-screen bg-black text-white px-6 py-12 md:px-12">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-8">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/40 mb-2">Admin</p>
            <h1 className="text-2xl font-bold">Waitlist</h1>
            <p className="text-sm text-white/50 mt-1">{count} signed up</p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-white/80 hover:bg-white/5 disabled:opacity-50"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Refresh
          </button>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {loading && !entries.length ? (
          <div className="flex items-center gap-2 text-white/50 text-sm">
            <Loader2 size={16} className="animate-spin" />
            Loading…
          </div>
        ) : entries.length === 0 && !error ? (
          <p className="text-sm text-white/45">No entries yet.</p>
        ) : (
          <ul className="divide-y divide-white/10 rounded-2xl border border-white/10 overflow-hidden">
            {entries.map((entry) => (
              <li
                key={entry.email}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 px-4 py-3 bg-white/[0.03]"
              >
                <span className="text-sm font-medium">{entry.email}</span>
                <span className="text-xs text-white/40">
                  {entry.created_at
                    ? new Date(entry.created_at * 1000).toLocaleString()
                    : '—'}
                  {entry.source ? ` · ${entry.source}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
