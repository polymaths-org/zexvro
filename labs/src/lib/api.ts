import { Lab, Badge, Certificate, Submission } from '../types';
import { getIdToken } from './firebase';

// Centralized data API. Every call attaches the current Firebase ID token so
// the server can authenticate (and authorize) the request. Responses are typed
// and the UI always falls back to optimistic local state instead of crashing.

async function request<T>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    const token = await getIdToken();
    const res = await fetch(path, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...init,
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export const api = {
  fetchLabs: () => request<{ labs: Lab[] }>('/api/labs'),
  fetchBadges: () => request<{ badges: Badge[] }>('/api/badges'),
  fetchCertificates: () => request<{ certificates: Certificate[] }>('/api/certificates'),
  fetchSubmissions: () => request<{ submissions: Submission[] }>('/api/submissions'),
  fetchUsers: () => request<{ users: unknown[] }>('/api/admin/users'),

  createLab: (lab: Partial<Lab>) =>
    request<{ lab: Lab }>('/api/labs', { method: 'POST', body: JSON.stringify(lab) }),
  updateLab: (id: string, patch: Partial<Lab>) =>
    request<{ lab: Lab }>(`/api/labs/${id}`, { method: 'PUT', body: JSON.stringify(patch) }),
  enrollLab: (id: string) =>
    request<{ success: boolean; enrolledCount: number }>(`/api/labs/${id}/enroll`, { method: 'POST' }),
  deleteLab: (id: string) =>
    request<{ success: boolean }>(`/api/labs/${id}`, { method: 'DELETE' }),

  createBadge: (badge: Partial<Badge>) =>
    request<{ badge: Badge }>('/api/badges', { method: 'POST', body: JSON.stringify(badge) }),
  updateBadge: (id: string, patch: Partial<Badge>) =>
    request<{ badge: Badge }>(`/api/badges/${id}`, { method: 'PUT', body: JSON.stringify(patch) }),
  deleteBadge: (id: string) =>
    request<{ success: boolean }>(`/api/badges/${id}`, { method: 'DELETE' }),

  createCertificate: (cert: Certificate) =>
    request<{ success: boolean }>('/api/certificates', { method: 'POST', body: JSON.stringify(cert) }),

  createSubmission: (sub: Partial<Submission>) =>
    request<{ submission: Submission }>('/api/submissions', {
      method: 'POST',
      body: JSON.stringify(sub),
    }),
  updateSubmission: (id: string, patch: Partial<Submission>) =>
    request<{ submission: Submission }>(`/api/submissions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(patch),
    }),
};
