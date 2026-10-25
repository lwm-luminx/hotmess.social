// Safety alerts: "I feel unsafe" to the staff on shift at the venue the user is at, its private thread, and
// "Need support?" (audience-kit api/doc/SAFETY_ALERTS.md). Mirrors hot_mess_ios
// HotMess/Models/SafetyAlert.swift; the requests are in safetyApi.ts.

export type SafetyAlertState = 'OPEN' | 'ACKNOWLEDGED' | 'CLOSED' | 'CANCELLED';
export type SafetyPlace = 'BAR' | 'DANCE_FLOOR' | 'RESTROOMS' | 'PATIO' | 'STAGE' | 'ENTRANCE' | 'UNSURE';
export type SafetyConcern = 'BOTHERING' | 'FOLLOWING' | 'INTOXICATED' | 'UNWELL' | 'OTHER';

export const PLACES: [SafetyPlace, string][] = [
  ['BAR', 'Bar'], ['DANCE_FLOOR', 'Dance floor'], ['RESTROOMS', 'Restrooms'], ['PATIO', 'Patio'],
  ['STAGE', 'Near the stage'], ['ENTRANCE', 'Entrance'], ['UNSURE', 'Not sure'],
];

export const CONCERNS: [SafetyConcern, string][] = [
  ['BOTHERING', 'Someone’s bothering me'], ['FOLLOWING', 'Someone’s following me'],
  ['INTOXICATED', 'Someone’s had too much'], ['UNWELL', 'I don’t feel well'], ['OTHER', 'Something else'],
];

export interface SafetyAlertMessage { id: string; body: string; fromStaff: boolean; senderName: string; createdAt: string }

export interface SafetyAlert {
  id: string;
  state: SafetyAlertState;
  place: SafetyPlace | null;
  concerns: SafetyConcern[];
  description: string | null;
  summary: string;
  seen: boolean;
  acknowledgedByName: string | null;
  acknowledgedAt: string | null;
  escalatedAt: string | null;
  closedAt: string | null;
  supportSharedAt: string | null;
  supportNote: string | null;
  createdAt: string;
  venue: { id: string; name: string | null };
  messages: SafetyAlertMessage[];
}

export interface SafetyDraft { place: SafetyPlace | null; concerns: SafetyConcern[]; description: string }

export interface SupportLine {
  id: string; name: string; description: string | null; phone: string | null;
  textNumber: string | null; textBody: string | null; url: string | null;
}

/**
 * "Get a ride": a ride app (Uber, Lyft) as a plain link. `url` opens the app, or its site when it isn't installed;
 * `pickupUrl` does the same with the pickup set once {latitude}, {longitude} and {name} are filled in.
 */
export interface SupportRide { id: string; name: string; url: string; pickupUrl: string | null }

export interface SupportResources {
  region: string; name: string; emergency: string; checkedAt: string | null; lines: SupportLine[];
  /** Absent from an API older than ride links. */
  rides?: SupportRide[];
}

/** Where "Get a ride" sets the pickup: the venue, with its name. */
export interface RidePickup { latitude: number; longitude: number; name: string | null }

/** The link for a pickup at `pickup`, or the plain one when there's no pickup or the app takes none. */
export function rideLink(ride: SupportRide, pickup: RidePickup | null): string {
  if (!pickup || !ride.pickupUrl) return ride.url;
  return ride.pickupUrl
    .replaceAll('{latitude}', pickup.latitude.toFixed(6))
    .replaceAll('{longitude}', pickup.longitude.toFixed(6))
    .replaceAll('{name}', encodeURIComponent(pickup.name ?? ''));
}

/** A venue's point, `POINT (<longitude> <latitude>)` with or without an SRID, as a pickup. */
export function pickupAt(point: string | null | undefined, name: string | null): RidePickup | null {
  const match = point?.match(/POINT\s*\(\s*(-?[\d.]+)\s+(-?[\d.]+)\s*\)/i);
  if (!match) return null;
  return { longitude: Number(match[1]), latitude: Number(match[2]), name };
}

/** How long nobody may pick an alert up before the managers hear it too (SafetyAlert::ESCALATE_AFTER). */
export const ESCALATION_MS = 2 * 60 * 1000;

export const isActive = (alert: SafetyAlert) => alert.state === 'OPEN' || alert.state === 'ACKNOWLEDGED';

/** Nobody has picked it up and the window has passed: the "Nobody's picked it up yet" options. */
export function isUnanswered(alert: SafetyAlert, now: number = Date.now()): boolean {
  if (alert.state !== 'OPEN') return false;
  return alert.escalatedAt != null || now - Date.parse(alert.createdAt) >= ESCALATION_MS;
}

/** 18664887386 as 1-866-488-7386, 8775658860 as 877-565-8860; short codes as they are. */
export function formatNumber(digits: string): string {
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits.startsWith('1')) return `1-${digits.slice(1, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
  return digits;
}

/** The numbers written out, so they can be read aloud: "Call 1-866-488-7386 · Text START to 678678". */
export function lineNumbers(line: SupportLine): string {
  const parts: string[] = [];
  if (line.phone) parts.push(`Call ${formatNumber(line.phone)}`);
  if (line.textNumber) parts.push(line.textBody ? `Text ${line.textBody} to ${line.textNumber}` : `Text ${formatNumber(line.textNumber)}`);
  return parts.join(' · ');
}
