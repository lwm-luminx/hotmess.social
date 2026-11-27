// A venue's safety poster for someone without the app or an account (audience_kit_api doc/SAFETY_ALERTS.md, "Safety
// posters"): hotmess.social/help/<code> sends the venue's staff on shift a safety alert over the API's public REST
// calls and follows it with the guest token the API hands back once. The token stays in this browser's storage, keyed
// by the poster code, so a reload or a second scan comes back to the same alert. Mirrors hot_mess_ios
// HotMessClip/ClipSafety.swift.
import { apiError, website } from './api';
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

/** Runs an SDK call, failing with the site's APIError (whose status and code the help flow reads). */
async function call<T>(path: string, run: () => Promise<T>): Promise<T> {
  try { return await run(); } catch (e) { throw apiError(path, e); }
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
  const token = () => savedAlert(code)?.token ?? '';
  const alert = async (path: string, run: () => Promise<{ alert: GuestAlertJSON }>) => fromGuestJSON((await call(path, run)).alert);
  return {
    async venue(): Promise<PosterVenue | null> {
      type Answer = { venue: PosterVenue['venue']; audience: PosterVenue['audience']; staff_on_shift: boolean };
      const answer = await call('safety/posters', () => website.safetyPoster<Answer>(code));
      return answer && { venue: answer.venue, audience: answer.audience, staffOnShift: answer.staff_on_shift };
    },
    async send(_venueId: string, draft: SafetyDraft): Promise<SafetyAlert> {
      const answer = await call('safety/posters/alerts', () =>
        website.sendGuestSafetyAlert<{ alert: GuestAlertJSON; guest_token: string }>(code, details(draft), savedAlert(code)?.token ?? null));
      save(code, { id: answer.alert.id, token: answer.guest_token });
      return fromGuestJSON(answer.alert);
    },
    /** The alert this browser sent from this poster, if it still has its token; a token the API refuses is forgotten. */
    async restore(): Promise<SafetyAlert | null> {
      const saved = savedAlert(code);
      if (!saved) return null;
      try {
        return await alert('safety/alerts', () => website.guestSafetyAlert(saved.id, saved.token));
      } catch (e) {
        if ((e as { status?: number }).status === 404) save(code, null);
        return null;
      }
    },
    alert: (id: string) => alert('safety/alerts', () => website.guestSafetyAlert(id, token())),
    update: (id: string, draft: SafetyDraft) => alert('safety/alerts/details', () => website.updateGuestSafetyAlert(id, token(), details(draft))),
    remind: (id: string) => alert('safety/alerts/remind', () => website.remindGuestSafetyAlert(id, token())),
    cancel: (id: string) => alert('safety/alerts/cancel', () => website.cancelGuestSafetyAlert(id, token())),
    message: (id: string, body: string) => alert('safety/alerts/messages', () => website.messageGuestSafetyAlert(id, token(), body)),
  };
}
