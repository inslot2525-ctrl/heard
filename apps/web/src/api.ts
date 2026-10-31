// Thin client for our API. The session token lives in localStorage (the MVP has no passwords;
// the personal login code brings it back on another device).

// Render passes a bare host (heard-api.onrender.com); add the scheme if missing.
const RAW_API = (import.meta.env.VITE_API_URL ?? 'http://localhost:8787').replace(/\/$/, '');
export const API = /^https?:\/\//.test(RAW_API) ? RAW_API : `https://${RAW_API}`;
const KEY = 'heard.session';

export type Role = 'student' | 'mentor' | 'warden';
/** Any Nexconn chat language code, e.g. 'en', 'mr', 'zh', 'ta'. */
export type Lang = string;

export interface User {
  id: string;
  campusId: string;
  role: Role;
  name: string;
  lang: Lang;
  hostelId: string | null;
}

export interface Me {
  user: User;
  campus: { id: string; name: string };
  hostel: { id: string; name: string } | null;
  mentor: { id: string; name: string } | null;
}

export type ChatItem =
  | { kind: 'direct'; peerId: string; title: string; subtitle?: string; peerLang?: Lang; role: 'mentor' | 'student' | 'assistant' | 'staff' }
  | { kind: 'community'; channelId: string; subChannelId: string; title: string; subtitle?: string; canPost: boolean; role: 'hostel' | 'notices' | 'mentors' };

export type Level = 0 | 1 | 2;
export interface Pulse {
  id: string;
  week: string;
  studies: Level;
  money: Level;
  health: Level;
  home: Level;
  note: string | null;
  wantsToTalk: boolean;
}

export interface Flag {
  id: string;
  studentId: string;
  rule: 'repeat_struggling' | 'drop_from_baseline' | 'silent' | 'wants_to_talk' | 'asked_for_help' | 'safety' | 'safety_ragging';
  area: '' | 'studies' | 'money' | 'health' | 'home';
  week: string;
  reason: string;
  evidence: { history: { week: string; level: Level | null }[] | null; studentWords: string | null };
  status: 'open' | 'contacted' | 'resolved' | 'dismissed';
  openerDraft: string | null;
  openerSent: string | null;
  createdAt: string;
  student: { id: string; name: string; lang: Lang };
}

export const session = {
  get: () => localStorage.getItem(KEY),
  set: (s: string) => localStorage.setItem(KEY, s),
  clear: () => localStorage.removeItem(KEY),
};

export class ApiError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
  }
}

export async function api<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const s = session.get();
  const res = await fetch(`${API}${path}`, {
    method: opts.method ?? (opts.body === undefined ? 'GET' : 'POST'),
    headers: { 'Content-Type': 'application/json', ...(s ? { Authorization: `Bearer ${s}` } : {}) },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) session.clear();
    throw new ApiError(res.status, (json as { error?: string }).error ?? `http_${res.status}`);
  }
  return json as T;
}
