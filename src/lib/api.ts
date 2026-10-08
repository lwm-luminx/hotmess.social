// A small client for the Hot Mess (AudienceKit) REST API, mirroring
// hot_mess_ios HotMess/Networking/HotMessAPI.swift.
import type { Event, Now, Person, Venue } from '../sdk/types';
import { API_BASE, AUDIENCE_HOST, AUDIENCEKIT_ENVIRONMENT, FACEBOOK_APP_ID } from './config';

const TOKEN_KEY = 'hotmess.token';
const DEVICE_KEY = 'hotmess.device';

export class APIError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

function storage(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}

export const session = {
  get token(): string | null { return storage()?.getItem(TOKEN_KEY) ?? null; },
  set token(value: string | null) {
    const s = storage();
    if (!s) return;
    if (value) s.setItem(TOKEN_KEY, value); else s.removeItem(TOKEN_KEY);
  },
};

// The API keys sessions by device, so a browser gets a stable identifier.
function deviceIdentifier(): string {
  const s = storage();
  let id = s?.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    s?.setItem(DEVICE_KEY, id);
  }
  return id;
}

async function send<T>(path: string, init: RequestInit = {}, authenticated = true): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body) headers.set('Content-Type', 'application/json');
  if (authenticated && session.token) headers.set('Authorization', `JWT ${session.token}`);
  if (AUDIENCEKIT_ENVIRONMENT === 'staging') headers.set('X-AudienceKit-Environment', 'staging');

  const response = await fetch(new URL(path, API_BASE), { ...init, headers });
  if (response.status === 401) session.token = null;
  if (!response.ok) throw new APIError(response.status, `${init.method ?? 'GET'} ${path} failed with ${response.status}`);
  return response.status === 204 ? (undefined as T) : response.json();
}

export type { Event, Now, Person, Venue } from '../sdk/types';

export const api = {
  signIn: (facebookToken: string) =>
    send<{ token: string; user: { id: string; name: string } }>('/v1/token', {
      method: 'POST',
      body: JSON.stringify({
        facebook_token: facebookToken,
        // host picks the audience; facebook_app_id is the app the token is for.
        host: AUDIENCE_HOST,
        facebook_app_id: FACEBOOK_APP_ID,
        device: {
          type: 'web',
          identifier: deviceIdentifier(),
          version: '1.0',
          build: '1',
          model: navigator.userAgent.slice(0, 120),
        },
      }),
    }, false),
  now: (latitude: number, longitude: number) =>
    send<Now>(`/v1/now?${new URLSearchParams({ latitude: String(latitude), longitude: String(longitude) })}`),
  venue: (id: string) => send<{ venue: Venue }>(`/v1/venues/${id}`).then((r) => r.venue),
  venueEvents: (id: string) => send<{ events: Event[] }>(`/v1/venues/${id}/events`).then((r) => r.events),
  event: (id: string) => send<{ event: Event }>(`/v1/events/${id}`).then((r) => r.event),
  person: (id: string) => send<{ person: Person }>(`/v1/people/${id}`).then((r) => r.person),
};
