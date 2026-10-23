// The safety alert requests (audience-kit api/doc/SAFETY_ALERTS.md), mirroring hot_mess_ios
// HotMess/Networking/HotMessAPI+SafetyAlerts.swift. Each read is its own request, so an API without these fields
// still shows the venue.
import { graphql } from './api';
import { CONCERNS, type SafetyAlert, type SafetyDraft, type SupportResources } from './safety';

const ALERT = `id state place concerns description summary seen acknowledgedByName acknowledgedAt escalatedAt closedAt
  supportSharedAt supportNote createdAt venue { id name } messages { id body fromStaff senderName createdAt }`;

const VENUE_SAFETY = `query VenueSafety($id: ID!) {
  venues { venue(id: $id) { id canSendSafetyAlert safetyStaffOnShift } }
}`;

const SEND = `mutation SendSafetyAlert($venueId: ID!, $place: SafetyAlertPlace, $concerns: [SafetyAlertConcern!], $description: String) {
  sendSafetyAlert(input: { venueId: $venueId, place: $place, concerns: $concerns, description: $description }) { safetyAlert { ${ALERT} } }
}`;

const UPDATE = `mutation UpdateSafetyAlert($id: ID!, $place: SafetyAlertPlace, $concerns: [SafetyAlertConcern!], $description: String) {
  updateSafetyAlert(input: { id: $id, place: $place, concerns: $concerns, description: $description }) { safetyAlert { ${ALERT} } }
}`;

const REMIND = `mutation RemindSafetyAlert($id: ID!) {
  remindSafetyAlert(input: { id: $id }) { safetyAlert { ${ALERT} } }
}`;

const CANCEL = `mutation CancelSafetyAlert($id: ID!) {
  cancelSafetyAlert(input: { id: $id }) { safetyAlert { ${ALERT} } }
}`;

const MESSAGE = `mutation SendSafetyAlertMessage($id: ID!, $body: String!) {
  sendSafetyAlertMessage(input: { id: $id, body: $body }) { safetyAlert { ${ALERT} } }
}`;

const ONE = `query SafetyAlert($id: ID!) {
  me { safetyAlert(id: $id) { ${ALERT} } }
}`;

const MINE = `query MySafetyAlerts {
  me { safetyAlerts { ${ALERT} } }
}`;

const SUPPORT = `query SupportResources($region: String) {
  supportResources(region: $region) { region name emergency checkedAt lines { id name description phone textNumber textBody url } }
}`;

type Payload<K extends string> = Record<K, { safetyAlert: SafetyAlert | null }>;

function draftVariables(draft: SafetyDraft) {
  const description = draft.description.trim();
  return { place: draft.place, concerns: CONCERNS.map(([c]) => c).filter((c) => draft.concerns.includes(c)), description: description || null };
}

function alertFrom<K extends string>(payload: Payload<K>, key: K): SafetyAlert {
  const alert = payload[key].safetyAlert;
  if (!alert) throw new Error(`${key} returned no alert`);
  return alert;
}

export const safety = {
  venue: async (id: string) =>
    (await graphql<{ venues: { venue: { canSendSafetyAlert: boolean; safetyStaffOnShift: boolean } | null } }>(VENUE_SAFETY, { id })).venues.venue,
  send: async (venueId: string, draft: SafetyDraft) =>
    alertFrom(await graphql<Payload<'sendSafetyAlert'>>(SEND, { venueId, ...draftVariables(draft) }), 'sendSafetyAlert'),
  update: async (id: string, draft: SafetyDraft) =>
    alertFrom(await graphql<Payload<'updateSafetyAlert'>>(UPDATE, { id, ...draftVariables(draft) }), 'updateSafetyAlert'),
  remind: async (id: string) => alertFrom(await graphql<Payload<'remindSafetyAlert'>>(REMIND, { id }), 'remindSafetyAlert'),
  cancel: async (id: string) => alertFrom(await graphql<Payload<'cancelSafetyAlert'>>(CANCEL, { id }), 'cancelSafetyAlert'),
  message: async (id: string, body: string) =>
    alertFrom(await graphql<Payload<'sendSafetyAlertMessage'>>(MESSAGE, { id, body: body.trim() }), 'sendSafetyAlertMessage'),
  alert: async (id: string) => (await graphql<{ me: { safetyAlert: SafetyAlert | null } | null }>(ONE, { id })).me?.safetyAlert ?? null,
  mine: async () => (await graphql<{ me: { safetyAlerts: SafetyAlert[] } | null }>(MINE, {})).me?.safetyAlerts ?? [],
  support: async (region: string | null) =>
    (await graphql<{ supportResources: SupportResources }>(SUPPORT, { region })).supportResources,
};
