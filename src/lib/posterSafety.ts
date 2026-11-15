// A safety poster guest's alert as the API sends it (audience_kit_api SafetyPostersController#alert_json), read as
// the app's SafetyAlert; the calls are in posterSafetyApi.ts.
import type { SafetyAlert } from './safety';

/** The API's guest alert: snake_case, lowercase values. */
export interface GuestAlertJSON {
  id: string; state: string; place: string | null; concerns: string[]; description: string | null; summary: string;
  seen: boolean; acknowledged_by_name: string | null; acknowledged_at: string | null; escalated_at: string | null;
  closed_at: string | null; support_shared_at: string | null; support_note: string | null; created_at: string;
  venue: { id: string; name: string };
  messages: { id: string; body: string; from_staff: boolean; sender_name: string; created_at: string }[];
}

/** The guest alert as the app's SafetyAlert. */
export function fromGuestJSON(a: GuestAlertJSON): SafetyAlert {
  return {
    id: a.id, state: a.state.toUpperCase() as SafetyAlert['state'],
    place: (a.place?.toUpperCase() ?? null) as SafetyAlert['place'],
    concerns: a.concerns.map((c) => c.toUpperCase()) as SafetyAlert['concerns'],
    description: a.description, summary: a.summary, seen: a.seen, acknowledgedByName: a.acknowledged_by_name,
    acknowledgedAt: a.acknowledged_at, escalatedAt: a.escalated_at, closedAt: a.closed_at,
    supportSharedAt: a.support_shared_at, supportNote: a.support_note, createdAt: a.created_at, venue: a.venue,
    messages: a.messages.map((m) => ({ id: m.id, body: m.body, fromStaff: m.from_staff, senderName: m.sender_name, createdAt: m.created_at })),
  };
}

