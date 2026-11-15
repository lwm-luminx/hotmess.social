// A venue's safety poster for someone without the app or an account (audience_kit_api doc/SAFETY_ALERTS.md, "Safety
// posters"): hotmess.social/help/<code> sends the venue's staff on shift a safety alert over the API's public REST
// calls and follows it with the guest token the API hands back once. The token stays in this browser's storage, keyed
// by the poster code, so a reload or a second scan comes back to the same alert. Mirrors hot_mess_ios
// HotMessClip/ClipSafety.swift.
import { API_BASE, AUDIENCE_HOST } from './config';
import { API_VERSION } from './api';
import { restError } from './apiErrors';
import { CONCERNS, type SafetyAlert, type SafetyDraft } from './safety';
import { fromGuestJSON, type GuestAlertJSON } from './posterSafety';

export { fromGuestJSON };

export interface PosterVenue { venue: { id: string; name: string }; audience: { name: string }; staffOnShift: boolean }

interface Saved { id: string; token: string }

const key = (code: string) => `hotmess.safety-poster.${code}`;

function storage(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}

export function savedAlert(code: string): Saved | null {
  try {
    const raw = storage()?.getItem(key(code));
    const saved = raw ? JSON.parse(raw) as Partial<Saved> : null;
    return saved?.id && saved.token ? { id: saved.id, token: saved.token } : null;
  } catch {
    return null;
  }
}

function save(code: string, saved: Saved | null) {
  try {
    if (saved) storage()?.setItem(key(code), JSON.stringify(saved)); else storage()?.removeItem(key(code));
  } catch { /* private mode: the alert still works until the page closes */ }
}

async function call<T>(method: 'GET' | 'POST', path: string, token: string | null, body?: object): Promise<T> {
  const url = new URL(`${API_BASE.replace(/\/+$/, '')}/v1/${path}`);
  url.searchParams.set('host', AUDIENCE_HOST);
  const headers: Record<string, string> = { Accept: 'application/json', 'X-AudienceKit-API-Version': API_VERSION };
  if (token) headers['X-Safety-Token'] = token;
  if (body) headers['Content-Type'] = 'application/json';
  const response = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const json = await response.json().catch(() => null);
  if (!response.ok) throw restError(method, path, response.status, json);
  return json as T;
}

function details(draft: SafetyDraft) {
  const description = draft.description.trim();
  return {
    place: draft.place?.toLowerCase() ?? null,
    concerns: CONCERNS.map(([c]) => c).filter((c) => draft.concerns.includes(c)).map((c) => c.toLowerCase()),
    description: description || null,
  };
}

/** The calls the help flow makes, for one poster code; the same shape as safetyApi's for a signed-in member. */
export function posterSafety(code: string) {
  const token = () => savedAlert(code)?.token ?? null;
  const alert = async (path: string, body?: object, method: 'GET' | 'POST' = 'POST') =>
    fromGuestJSON((await call<{ alert: GuestAlertJSON }>(method, path, token(), body)).alert);
  return {
    async venue(): Promise<PosterVenue | null> {
      try {
        const answer = await call<{ venue: PosterVenue['venue']; audience: PosterVenue['audience']; staff_on_shift: boolean }>('GET', `safety/posters/${code}`, null);
        return { venue: answer.venue, audience: answer.audience, staffOnShift: answer.staff_on_shift };
      } catch (e) {
        if ((e as { status?: number }).status === 404) return null;
        throw e;
      }
    },
    async send(_venueId: string, draft: SafetyDraft): Promise<SafetyAlert> {
      const answer = await call<{ alert: GuestAlertJSON; guest_token: string }>('POST', `safety/posters/${code}/alerts`, token(), details(draft));
      save(code, { id: answer.alert.id, token: answer.guest_token });
      return fromGuestJSON(answer.alert);
    },
    /** The alert this browser sent from this poster, if it still has its token; a token the API refuses is forgotten. */
    async restore(): Promise<SafetyAlert | null> {
      const saved = savedAlert(code);
      if (!saved) return null;
      try {
        return await alert(`safety/alerts/${saved.id}`, undefined, 'GET');
      } catch (e) {
        if ((e as { status?: number }).status === 404) save(code, null);
        return null;
      }
    },
    alert: (id: string) => alert(`safety/alerts/${id}`, undefined, 'GET'),
    update: (id: string, draft: SafetyDraft) => alert(`safety/alerts/${id}/details`, details(draft)),
    remind: (id: string) => alert(`safety/alerts/${id}/remind`),
    cancel: (id: string) => alert(`safety/alerts/${id}/cancel`),
    message: (id: string, body: string) => alert(`safety/alerts/${id}/messages`, { body }),
  };
}
