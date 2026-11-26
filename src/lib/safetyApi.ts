// The safety alert requests (audience-kit api/doc/SAFETY_ALERTS.md), through the SDK's Website client, mirroring
// hot_mess_ios HotMess/Networking/HotMessAPI+SafetyAlerts.swift. Each read is its own request, so an API without these
// fields still shows the venue.
import { call, website } from './api';
import { CONCERNS, type SafetyAlert, type SafetyDraft, type SupportResources, type SupportRide } from './safety';

/** The draft with its concerns in the order the form lists them. */
const ordered = (draft: SafetyDraft): SafetyDraft =>
  ({ ...draft, concerns: CONCERNS.map(([c]) => c).filter((c) => draft.concerns.includes(c)) });

export const safety = {
  venue: (id: string) => call('VenueSafety', () => website.venueSafety(id)),
  send: (venueId: string, draft: SafetyDraft): Promise<SafetyAlert> =>
    call('SendSafetyAlert', () => website.sendSafetyAlert(venueId, ordered(draft))),
  update: (id: string, draft: SafetyDraft): Promise<SafetyAlert> =>
    call('UpdateSafetyAlert', () => website.updateSafetyAlert(id, ordered(draft))),
  remind: (id: string): Promise<SafetyAlert> => call('RemindSafetyAlert', () => website.remindSafetyAlert(id)),
  cancel: (id: string): Promise<SafetyAlert> => call('CancelSafetyAlert', () => website.cancelSafetyAlert(id)),
  message: (id: string, body: string): Promise<SafetyAlert> =>
    call('SendSafetyAlertMessage', () => website.sendSafetyAlertMessage(id, body)),
  alert: (id: string): Promise<SafetyAlert | null> => call('SafetyAlert', () => website.safetyAlert(id)),
  mine: (): Promise<SafetyAlert[]> => call('MySafetyAlerts', () => website.mySafetyAlerts()),
  support: (region: string | null): Promise<SupportResources> => call('SupportResources', () => website.supportResources(region)),
  rides: (region: string | null): Promise<SupportRide[]> => call('SupportRides', () => website.supportRides(region)),
};
