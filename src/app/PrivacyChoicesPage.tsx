// Your privacy choices (/privacy-choices): the same switches as the apps' Me › Your privacy choices, for someone
// signed in to Hot Mess. The API enforces every choice; this page only shows them. The browser's Global Privacy Control
// signal reaches the API by itself and counts as an opt-out.
import { useEffect, useState } from 'react';
import { graphql } from '../lib/api';
import {
  browserSendsGPC, detail, FROM_GPC, intro, isOn, known, LABELS, passButton, passExplanation, passOffered,
  PRIVACY_QUERY, START_PRIVACY_PASS, UPDATE_PRIVACY, variablesFor,
  type PrivacyChoiceKey, type PrivacyChoices, type PrivacyOffer,
} from '../lib/privacyChoices';
import SignedIn from './SignedIn';

const APP_NAME = 'Hot Mess';

type Loaded = { offer: PrivacyOffer; choices: PrivacyChoices };

function Choices() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [saving, setSaving] = useState<PrivacyChoiceKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    graphql<{ privacyOffer: PrivacyOffer; me: { privacy: PrivacyChoices } | null }>(PRIVACY_QUERY, {})
      .then((data) => data.me && setLoaded({ offer: data.privacyOffer, choices: data.me.privacy }))
      .catch(() => setError('Your privacy choices couldn’t load. Try again in a moment.'));
  }, []);

  const set = async (key: PrivacyChoiceKey, on: boolean) => {
    if (!loaded) return;
    setSaving(key);
    try {
      const data = await graphql<{ updatePrivacyChoices: { privacy: PrivacyChoices } }>(UPDATE_PRIVACY, variablesFor(key, on));
      setLoaded({ ...loaded, choices: data.updatePrivacyChoices.privacy });
      setError(null);
    } catch {
      setError('That didn’t save. Try again.');
    } finally { setSaving(null); }
  };

  const startPass = async () => {
    try {
      const data = await graphql<{ startPrivacyPass: { checkoutUrl: string } }>(START_PRIVACY_PASS, { returnUrl: location.href });
      location.assign(data.startPrivacyPass.checkoutUrl);
    } catch {
      setError('The privacy pass isn’t available right now.');
    }
  };

  if (!loaded) return <p className="muted">{error ?? 'Loading…'}</p>;
  const { offer, choices } = loaded;
  const until = choices.privacyPassUntil ? new Date(choices.privacyPassUntil).toLocaleDateString(undefined, { dateStyle: 'medium' }) : null;
  return <>
    <p>{intro(APP_NAME)}</p>
    {browserSendsGPC() && <p className="muted">Your browser sends a Global Privacy Control signal, which we treat as opting out of selling or sharing.</p>}
    <ul className="privacy-choices">
      {known(offer).filter((key) => key !== 'PRIVACY_PASS').map((key) => <li key={key}>
        <label>
          <input type="checkbox" role="switch" checked={isOn(choices, key)} disabled={saving === key}
            onChange={(event) => void set(key, event.target.checked)} />
          <strong>{LABELS[key]}</strong>
        </label>
        <p className="muted">{detail(key, APP_NAME)}</p>
        {key === 'SALE_SHARE_OPT_OUT' && choices.saleShareOptOutSource === 'GLOBAL_PRIVACY_CONTROL' && <p className="muted">{FROM_GPC}</p>}
      </li>)}
    </ul>
    {passOffered(offer) && offer.passCents != null && <section>
      <h2>{LABELS.PRIVACY_PASS}</h2>
      {until && <p>Your privacy pass runs until {until}. Thanks for supporting this community.</p>}
      <p className="muted">{passExplanation(offer.passDays)}</p>
      <button type="button" onClick={() => void startPass()}>{passButton(offer.passCents, offer.passDays)}</button>
    </section>}
    {!passOffered(offer) && until && <p>Your privacy pass runs until {until}.</p>}
    {error && <p role="alert">{error}</p>}
  </>;
}

export default function PrivacyChoicesPage() {
  return <SignedIn lede="Sign in to see and change your privacy choices for Hot Mess.">
    {() => <Choices />}
  </SignedIn>;
}
