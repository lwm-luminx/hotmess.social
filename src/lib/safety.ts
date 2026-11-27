// Safety alerts: "I feel unsafe" to the staff on shift at the venue the user is at, its private thread, and
// "Need support?" (audience-kit api/doc/SAFETY_ALERTS.md). Mirrors hot_mess_ios
// HotMess/Models/SafetyAlert.swift; the requests are in safetyApi.ts.

import type { Website } from 'audience-kit';

// The shapes are the SDK's (audience-kit's Website models); this file keeps the words and the rules.
export type SafetyAlertState = Website.SafetyAlertState;
export type SafetyPlace = Website.SafetyPlace;
export type SafetyConcern = Website.SafetyConcern;
export type SafetyAlertMessage = Website.SafetyAlertMessage;
export type SafetyAlert = Website.SafetyAlert;
export type SafetyDraft = Website.SafetyDraft;
export type SupportLine = Website.SupportLine;
export type SupportRide = Website.SupportRide;
export type SupportResources = Website.SupportResources;

export const PLACES: [SafetyPlace, string][] = [
  ['BAR', 'Bar'], ['DANCE_FLOOR', 'Dance floor'], ['RESTROOMS', 'Restrooms'], ['PATIO', 'Patio'],
  ['STAGE', 'Near the stage'], ['ENTRANCE', 'Entrance'], ['UNSURE', 'Not sure'],
];

export const CONCERNS: [SafetyConcern, string][] = [
  ['BOTHERING', 'Someone’s bothering me'], ['FOLLOWING', 'Someone’s following me'],
  ['INTOXICATED', 'Someone’s had too much'], ['UNWELL', 'I don’t feel well'], ['OTHER', 'Something else'],
];

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

/**
 * "Get a ride" is one row; what it says names the region's apps ("Uber, Lyft, transit, or a friend."), and the user
 * picks how after: a ride app, transit, a friend sending one, or sharing where to be picked up.
 */
export function rideSummary(rides: SupportRide[]): string {
  return rides.length ? `${rides.map((ride) => ride.name).join(', ')}, transit, or a friend.` : 'Transit, or share where to pick you up.';
}

/** Google Maps directions by transit, from the pickup when there is one; the user picks where they're going. */
export function transitLink(pickup: RidePickup | null): string {
  const origin = pickup ? `&origin=${pickup.latitude.toFixed(6)},${pickup.longitude.toFixed(6)}` : '';
  return `https://www.google.com/maps/dir/?api=1${origin}&travelmode=transit`;
}

/** For a friend who'll book the ride in their own app: Uber and Lyft both let the payer set someone else as the rider. */
export function sendMeARide(place: string | null): string {
  return place
    ? `Can you send me a ride home? I'm here: ${place}. In Uber or Lyft you can book it with me as the rider.`
    : 'Can you send me a ride home? In Uber or Lyft you can book it with me as the rider.';
}

/** "Pick me up here", for another app or a friend who can drive. */
export function pickMeUp(place: string | null): string {
  return place ? `Can you pick me up? I'm here: ${place}` : 'Can you pick me up?';
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
