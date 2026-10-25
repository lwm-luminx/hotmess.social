// "Get help" at a venue the user is at, and the alert once it's sent: a digital "Ask for Angela" (audience-kit
// api/doc/design-system/SafetyAlerts.md). Mirrors hot_mess_ios HotMess/Features/Safety. Built so someone looking over
// the user's shoulder sees nothing alarming: normal surfaces, no red except 911, and nothing here ever shows in chat
// or on their profile.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Venue } from '../sdk';
import {
  CONCERNS, PLACES, isActive, isUnanswered, lineNumbers, pickupAt, rideLink,
  type RidePickup, type SafetyAlert, type SafetyConcern, type SafetyDraft, type SupportResources, type SupportRide,
} from '../lib/safety';
import { safety } from '../lib/safetyApi';
import { APIError } from '../lib/api';

/** The venue "Get help" is about, with what "Message a friend" and "Get a ride" say. */
interface HelpVenue { id: string; name: string; address: string | null; pickup?: RidePickup | null }

const helpVenue = (venue: Venue, point: string | null): HelpVenue => {
  const name = venue.name ?? 'the venue';
  return { id: venue.id, name, address: venue.profile?.address ?? null, pickup: pickupAt(point, name) };
};

const emptyDraft = (): SafetyDraft => ({ place: null, concerns: [], description: '' });

// The API says what went wrong with a code (src/lib/apiErrors.ts), never with its message.
const failure = (e: unknown) => e instanceof APIError && e.signedOut
  ? 'You’ve been signed out. Sign in again, or find a member of staff.'
  : 'That didn’t go through. Try again, or find a member of staff.';

/** A modal sheet: the browser's own dialog, so focus stays inside and Escape closes it. */
function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal?.();
  }, []);
  return (
    <dialog ref={ref} className="help-sheet card" aria-labelledby="help-title" onClose={onClose}>
      <header className="help-head">
        <h2 id="help-title">{title}</h2>
        <button className="button secondary" type="button" onClick={() => ref.current?.close()}>Close</button>
      </header>
      {children}
    </dialog>
  );
}

/**
 * The quiet way in on a venue: muted, with no red and no "SOS". It shows only when the API places the user at the
 * venue (`canSendSafetyAlert`, from their last Now location), so it never shows for a venue they're browsing.
 */
export function GetHelpEntry({ venue }: { venue: Venue }) {
  const [safe, setSafe] = useState<{ canSend: boolean; staffOnShift: boolean; point: string | null } | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let current = true;
    safety.venue(venue.id).then(
      (answer) => { if (current && answer) setSafe({ canSend: answer.canSendSafetyAlert, staffOnShift: answer.safetyStaffOnShift, point: answer.point ?? null }); },
      () => {},
    );
    return () => { current = false; };
  }, [venue.id]);
  if (!safe?.canSend) return null;
  return <>
    <button className="help-entry" type="button" onClick={() => setOpen(true)}
      aria-label="Get help: tell staff quietly, reach a friend or a ride, or find support">
      <ShieldIcon /> <span>Get help</span> <span aria-hidden="true">›</span>
    </button>
    {open ? <HelpFlow venue={helpVenue(venue, safe.point)} staffOnShift={safe.staffOnShift} onClose={() => setOpen(false)} /> : null}
  </>;
}

/** An alert opened from its link (/safety-alerts/<id>, the push's url): its status, full page. */
export function SafetyAlertPage({ id }: { id: string }) {
  return <section className="card help-page"><HelpFlow alertId={id} staffOnShift onClose={() => history.back()} inline /></section>;
}

/** "Need support?" from the account bar, any time. */
export function SupportEntry() {
  const [open, setOpen] = useState(false);
  return <>
    <button className="button secondary" type="button" onClick={() => setOpen(true)}>Need support?</button>
    {open ? <Sheet title="Need support?" onClose={() => setOpen(false)}><Support /></Sheet> : null}
  </>;
}

type View = 'options' | 'tell' | 'add' | 'support';

interface FlowProps { venue?: HelpVenue; alertId?: string; staffOnShift: boolean; onClose: () => void; inline?: boolean }

function HelpFlow({ venue: given, alertId, staffOnShift, onClose, inline }: FlowProps) {
  const [alert, setAlert] = useState<SafetyAlert | null>(null);
  const [venue, setVenue] = useState<HelpVenue | null>(given ?? null);
  const [view, setView] = useState<View>('options');
  const [draft, setDraft] = useState<SafetyDraft>(emptyDraft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [keepsWaiting, setKeepsWaiting] = useState(false);
  const [missing, setMissing] = useState(false);
  const rides = useRides();

  const apply = (fresh: SafetyAlert) => {
    setAlert(fresh);
    setVenue((known) => known ?? { id: fresh.venue.id, name: fresh.venue.name ?? 'the venue', address: null });
  };

  // The alert it was opened for, or the user's open alert at this venue if they already sent one.
  useEffect(() => {
    let current = true;
    const load = alertId
      ? safety.alert(alertId)
      : safety.mine().then((alerts) => alerts.find((a) => isActive(a) && a.venue.id === given?.id) ?? null);
    load.then((found) => {
      if (!current) return;
      if (found) apply(found); else if (alertId) setMissing(true);
    }, () => { if (current && alertId) setMissing(true); });
    return () => { current = false; };
  }, [alertId, given?.id]);

  // There's no subscription for alerts, so read it again every few seconds while it's open, and tick the clock so
  // the waiting view notices the escalation window passing.
  const alertID = alert?.id;
  const active = alert ? isActive(alert) : false;
  useEffect(() => {
    if (!alertID || !active) return;
    let ticks = 0;
    const timer = setInterval(() => {
      setNow(Date.now());
      ticks += 1;
      if (ticks % 5 === 0 && document.visibilityState === 'visible') safety.alert(alertID).then((fresh) => { if (fresh) apply(fresh); }, () => {});
    }, 1000);
    return () => clearInterval(timer);
  }, [alertID, active]);

  const run = async (action: () => Promise<SafetyAlert>) => {
    if (busy) return false;
    setBusy(true);
    setError(null);
    try {
      apply(await action());
      return true;
    } catch (e) {
      setError(failure(e));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    if (!venue) return;
    if (await run(() => safety.send(venue.id, draft))) { setDraft(emptyDraft()); setView('options'); }
  };
  const addMore = async () => {
    if (!alert) return;
    if (await run(() => safety.update(alert.id, draft))) { setDraft(emptyDraft()); setView('options'); }
  };

  const title = view === 'tell' ? 'Tell staff quietly' : view === 'add' ? 'Add more' : view === 'support' ? 'Need support?'
    : venue ? `Get help at ${venue.name}` : 'Get help';

  let body: ReactNode;
  if (view === 'support') {
    body = <><BackButton onClick={() => setView('options')} /><Support sharedNote={alert?.supportSharedAt ? alert.supportNote : null} /></>;
  } else if (view === 'tell' || view === 'add') {
    body = <><BackButton onClick={() => setView('options')} />
      <TellStaffForm draft={draft} setDraft={setDraft} busy={busy} mode={view === 'tell' ? 'send' : 'add'}
        onSubmit={view === 'tell' ? send : addMore} /></>;
  } else if (alert) {
    body = <AlertStatus alert={alert} venue={venue} rides={rides} now={now} busy={busy} keepsWaiting={keepsWaiting}
      onKeepWaiting={() => setKeepsWaiting(true)}
      onRemind={() => { setKeepsWaiting(true); run(() => safety.remind(alert.id)); }}
      onCancel={() => run(() => safety.cancel(alert.id))}
      onMessage={(text) => run(() => safety.message(alert.id, text))}
      onAddMore={() => setView('add')} onSupport={() => setView('support')} />;
  } else if (missing) {
    body = <p className="muted">We couldn’t find that alert. It may belong to another account.</p>;
  } else if (alertId) {
    body = <p className="muted">Loading…</p>;
  } else {
    body = <>
      <ul className="help-rows">
        {venue && staffOnShift ? <li><HelpRow title="Tell staff I feel unsafe" subtitle="The staff on shift hear it quietly and can come find you."
          onClick={() => setView('tell')} /></li> : null}
        <EscapeRows venue={venue} rides={rides} onSupport={() => setView('support')} />
      </ul>
      <p className="muted small">Nothing here shows in chat or on your profile.</p>
      <Emergency />
    </>;
  }

  const content = <>{body}{error ? <p className="error" role="alert">{error}</p> : null}</>;
  if (inline) return <><h1 className="help-page-title">{title}</h1>{content}</>;
  return <Sheet title={title} onClose={onClose}>{content}</Sheet>;
}

function BackButton({ onClick }: { onClick: () => void }) {
  return <button className="help-back" type="button" onClick={onClick}>‹ Back</button>;
}

function HelpRow({ title, subtitle, onClick, href }: { title: string; subtitle?: string; onClick?: () => void; href?: string }) {
  const inner = <><span className="help-row-title">{title}</span>{subtitle ? <span className="muted small">{subtitle}</span> : null}</>;
  return href
    ? <a className="help-row" href={href} target="_blank" rel="noreferrer">{inner}</a>
    : <button className="help-row" type="button" onClick={onClick}>{inner}</button>;
}

/** Shares text through the system share sheet, or copies it where there is none. */
async function share(text: string): Promise<'shared' | 'copied' | null> {
  try {
    if (navigator.share) { await navigator.share({ text }); return 'shared'; }
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return null;
  }
}

/** "Get a ride": the ride apps the API lists for the user's country (the website doesn't ask where they are). */
function useRides(): SupportRide[] {
  const [rides, setRides] = useState<SupportRide[]>([]);
  useEffect(() => {
    let current = true;
    safety.support(null).then((answer) => { if (current) setRides(answer.rides ?? []); }, () => {});
    return () => { current = false; };
  }, []);
  return rides;
}

/**
 * "Get a ride": a row for each ride app, with the pickup at the venue when the API knows where it is (otherwise the
 * app asks), then sharing the pickup for any other app or a friend who can drive. Plain links: the app opens if
 * it's installed, its site if not.
 */
function RideRows({ rides, pickup, copied, onShare }: {
  rides: SupportRide[]; pickup: RidePickup | null; copied: boolean; onShare: () => void;
}) {
  const where = pickup?.name ? `Pickup at ${pickup.name}.` : 'Opens the app to set your pickup.';
  return <>
    {rides.map((ride) => <li key={ride.id}><HelpRow title={`Get a ride with ${ride.name}`} subtitle={where} href={rideLink(ride, pickup)} /></li>)}
    <li><HelpRow title={rides.length ? 'Share where to pick me up' : 'Get a ride'}
      subtitle={copied ? 'Copied. Paste it in your ride app.'
        : rides.length ? 'For another ride app, or a friend who can drive.' : 'Share where to pick you up with a ride app.'}
      onClick={onShare} /></li>
  </>;
}

/** "Message a friend", "Get a ride" and "Need support?": the options when nobody on shift can help, too. */
function EscapeRows({ venue, rides, onSupport }: { venue: HelpVenue | null; rides: SupportRide[]; onSupport: () => void }) {
  const [copied, setCopied] = useState<string | null>(null);
  const here = venue ? (venue.address ? `I'm at ${venue.name}, ${venue.address}.` : `I'm at ${venue.name}.`) : '';
  const pickupText = venue ? (venue.address ? `${venue.name}, ${venue.address}` : venue.name) : 'Pick me up here.';
  const shareRow = async (key: string, text: string) => {
    if (await share(text) === 'copied') setCopied(key);
  };
  return <>
    <li><HelpRow title="Message a friend" subtitle={copied === 'friend' ? 'Copied. Paste it in a message.' : 'Send them where you are.'}
      onClick={() => shareRow('friend', `${here} Can you come find me?`.trim())} /></li>
    <RideRows rides={rides} pickup={venue?.pickup ?? null} copied={copied === 'ride'} onShare={() => shareRow('ride', pickupText)} />
    <li><HelpRow title="Need support?" subtitle="Free, confidential lines, any time." onClick={onSupport} /></li>
  </>;
}

/** "In danger right now? Call 911": the one red thing, always last. */
function Emergency({ number = '911' }: { number?: string }) {
  return <div className="help-emergency">
    <p className="small">In danger right now?</p>
    <a className="help-call" href={`tel:${number}`}>Call {number}</a>
    <p className="muted small">Hot Mess isn’t a crisis service. In an emergency, call {number}.</p>
  </div>;
}

function Chips<T extends string>({ items, label, isSelected, toggle }:
  { items: [T, string][]; label: string; isSelected: (item: T) => boolean; toggle: (item: T) => void }) {
  return <div className="help-chips" role="group" aria-label={label}>
    {items.map(([value, title]) => (
      <button key={value} type="button" className="help-chip" aria-pressed={isSelected(value)} onClick={() => toggle(value)}>{title}</button>
    ))}
  </div>;
}

/** "Tell staff quietly": where, what and anything else, all optional. Also "Add more" once it's sent. */
function TellStaffForm({ draft, setDraft, busy, mode, onSubmit }: {
  draft: SafetyDraft; setDraft: (draft: SafetyDraft) => void; busy: boolean; mode: 'send' | 'add'; onSubmit: () => void;
}) {
  const toggle = (concern: SafetyConcern) => setDraft({
    ...draft, concerns: draft.concerns.includes(concern) ? draft.concerns.filter((c) => c !== concern) : [...draft.concerns, concern],
  });
  return <form className="help-form" onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
    <h3>Where are you?</h3>
    <Chips items={PLACES} label="Where are you?" isSelected={(p) => draft.place === p}
      toggle={(p) => setDraft({ ...draft, place: draft.place === p ? null : p })} />
    <h3>What’s going on?</h3>
    <Chips items={CONCERNS} label="What’s going on?" isSelected={(c) => draft.concerns.includes(c)} toggle={toggle} />
    <label className="help-label" htmlFor="help-description">Anything that helps staff spot them</label>
    <textarea id="help-description" rows={3} value={draft.description} maxLength={500}
      placeholder="What they look like, what they’re wearing"
      onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
    <p className="muted small">{mode === 'send' ? 'You can send without filling anything in. Only staff see who sent this.' : 'Staff see this straight away.'}</p>
    <button className="button help-submit" type="submit" disabled={busy}>
      {busy ? 'Sending…' : mode === 'send' ? 'Send to staff' : 'Add to my alert'}
    </button>
  </form>;
}

const time = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : null);

interface StatusProps {
  alert: SafetyAlert; venue: HelpVenue | null; rides: SupportRide[]; now: number; busy: boolean; keepsWaiting: boolean;
  onKeepWaiting: () => void; onRemind: () => void; onCancel: () => void; onMessage: (text: string) => Promise<boolean>;
  onAddMore: () => void; onSupport: () => void;
}

/**
 * The alert once it's sent: the steps, what was sent with "Add more", the private thread and "I'm OK now". After the
 * escalation window with nobody on it, the other ways to get help come first.
 */
function AlertStatus({ alert, venue, rides, now, busy, keepsWaiting, onKeepWaiting, onRemind, onCancel, onMessage, onAddMore, onSupport }: StatusProps) {
  const [reply, setReply] = useState('');
  const [confirming, setConfirming] = useState(false);
  const live = isActive(alert);
  const steps: { title: string; note: string | null; state: 'done' | 'current' | 'upcoming' }[] = [
    { title: 'Sent to the staff on shift', note: time(alert.createdAt), state: 'done' },
    ...(alert.state === 'ACKNOWLEDGED'
      ? [{ title: 'Seen', note: null, state: 'done' as const },
        { title: `${alert.acknowledgedByName ?? 'Someone'} is on the way`, note: time(alert.acknowledgedAt), state: 'current' as const }]
      : [{ title: alert.seen ? 'Seen by staff' : 'Waiting for someone to pick it up', note: null, state: 'current' as const },
        { title: 'Someone’s on the way', note: null, state: 'upcoming' as const }]),
  ];
  const send = async () => { if (await onMessage(reply)) setReply(''); };

  return <div className="help-status">
    {isUnanswered(alert, now) && !keepsWaiting ? <section className="help-section">
      <h3>Nobody’s picked it up yet</h3>
      <p className="muted small">Stay where you feel safest. These can help while you wait.</p>
      <ul className="help-rows">
        <li><HelpRow title="Tell staff again" subtitle="It goes to the managers too." onClick={onRemind} /></li>
        <EscapeRows venue={venue} rides={rides} onSupport={onSupport} />
      </ul>
      <button className="button secondary" type="button" onClick={onKeepWaiting}>Keep waiting for staff</button>
    </section> : null}

    {live ? <>
      <section className="help-section" aria-live="polite">
        <h3>{alert.state === 'ACKNOWLEDGED' ? 'Someone’s on the way' : 'Staff have your alert'}</h3>
        <ol className="help-steps">
          {steps.map((step) => <li key={step.title} className={`help-step ${step.state}`}>
            <span className="help-dot" aria-hidden="true">{step.state === 'done' ? '✓' : ''}</span>
            <span><strong>{step.title}</strong>{step.note ? <span className="muted small"> {step.note}</span> : null}</span>
          </li>)}
        </ol>
        {alert.state === 'OPEN' ? <p className="muted small">Stay where you feel safest. If nobody picks it up in 2 minutes, we’ll help you reach a friend, a ride or 911.</p> : null}
      </section>
      <section className="help-section">
        <h3>What you sent</h3>
        <p>{alert.summary}</p>
        {alert.description ? <p className="muted">{alert.description}</p> : null}
        <button className="help-back" type="button" onClick={onAddMore}>Add more</button>
      </section>
    </> : <section className="help-section">
      <p>{alert.state === 'CANCELLED' ? 'You cancelled your alert. You can send another any time.' : 'Staff closed your alert. You can send another any time.'}</p>
    </section>}

    {live || alert.messages.length > 0 ? <section className="help-section">
      <h3>Private thread</h3>
      <ul className="help-thread">
        {alert.messages.map((message) => <li key={message.id} className={message.fromStaff ? 'staff' : 'mine'}>
          <span className="muted small">{message.senderName}</span>
          <span className="help-bubble">{message.body}</span>
        </li>)}
      </ul>
      {live ? <form className="help-reply" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <label className="visually-hidden" htmlFor="help-reply">Message the staff on shift</label>
        <input id="help-reply" value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Message the staff on shift" />
        <button className="button" type="submit" disabled={busy || !reply.trim()}>Send</button>
      </form> : null}
      <p className="muted small">Just you and the staff on shift. This isn’t in venue chat.</p>
    </section> : null}

    {alert.supportSharedAt ? <section className="help-section">
      <h3>From the staff at {alert.venue.name ?? 'the venue'}</h3>
      {alert.supportNote ? <p>{alert.supportNote}</p> : null}
      <ul className="help-rows"><li><HelpRow title="Need support?" onClick={onSupport} /></li></ul>
    </section> : null}

    {live ? <section className="help-section">
      {confirming ? <div role="alertdialog" aria-labelledby="help-cancel-title">
        <p id="help-cancel-title"><strong>Cancel your alert?</strong> Staff will see that you’re OK. You can send another any time.</p>
        <div className="signin-actions">
          <button className="button secondary" type="button" onClick={() => setConfirming(false)}>Keep it open</button>
          <button className="button" type="button" disabled={busy} onClick={() => { setConfirming(false); onCancel(); }}>I’m OK now, cancel it</button>
        </div>
      </div> : <button className="button secondary" type="button" onClick={() => setConfirming(true)}>I’m OK now, cancel the alert</button>}
    </section> : null}

    <Emergency />
  </div>;
}

/** "Need support?": free, confidential lines, with the numbers written out so they can be dialled from another phone. */
function Support({ sharedNote }: { sharedNote?: string | null }) {
  const [resources, setResources] = useState<SupportResources | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let current = true;
    // The website doesn't ask where the user is for this; the API answers with the country's lines.
    safety.support(null).then((answer) => { if (current) setResources(answer); }, () => { if (current) setFailed(true); });
    return () => { current = false; };
  }, []);
  return <div className="help-support">
    {sharedNote ? <p className="help-note">{sharedNote}</p> : null}
    {failed ? <p className="muted">These lines couldn’t load. In an emergency, call 911.</p>
      : !resources ? <p className="muted">Loading…</p>
      : <ul className="help-rows">
        {resources.lines.map((line) => <li key={line.id} className="help-line">
          <strong>{line.name}</strong>
          {line.description ? <span className="muted small">{line.description}</span> : null}
          <span>{lineNumbers(line)}</span>
          <span className="help-line-actions">
            {line.phone ? <a href={`tel:${line.phone}`}>Call</a> : null}
            {line.textNumber ? <a href={`sms:${line.textNumber}${line.textBody ? `?&body=${encodeURIComponent(line.textBody)}` : ''}`}>Text</a> : null}
            {line.url ? <a href={line.url} target="_blank" rel="noreferrer">Website</a> : null}
          </span>
        </li>)}
      </ul>}
    {resources?.rides?.length ? <section className="help-section">
      <h3>Get home safe</h3>
      <ul className="help-rows">
        {resources.rides.map((ride) => <li key={ride.id}>
          <HelpRow title={`Get a ride with ${ride.name}`} subtitle="Opens the app to set your pickup." href={ride.url} />
        </li>)}
      </ul>
    </section> : null}
    {resources?.checkedAt ? <p className="muted small">Checked {new Date(`${resources.checkedAt}T12:00:00`).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}.</p> : null}
    <Emergency number={resources?.emergency ?? '911'} />
  </div>;
}

function ShieldIcon() {
  return <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
  </svg>;
}
