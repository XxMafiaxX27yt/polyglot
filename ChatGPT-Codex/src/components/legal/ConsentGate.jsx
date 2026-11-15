import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import Logo from '../Logo.jsx';
import { Marked } from './LegalPage.jsx';
import { OPERATOR, POLICY_UPDATED, POLICY_VERSION } from '../../legal/config.js';
import { backendConnected } from '../../services/api.js';
import { getCookiePrefs, latestConsent, recordConsent, setCookiePrefs } from '../../services/privacyService.js';

function Check({ checked, onChange, children }) {
  return (
    <label className="consent-check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  );
}

/**
 * Shown after sign-in until the user has agreed to the current policy version.
 * Nothing is pre-ticked; required and optional choices are kept apart.
 */
export default function ConsentGate({ user, onAccepted, onDecline }) {
  const returning = !!latestConsent(user.email, 'terms'); // agreed to an older version before
  const [terms, setTerms] = useState(false);
  const [ai, setAi] = useState(false);
  const [age, setAge] = useState(''); // '' | 'adult' | 'minor'
  const [marketing, setMarketing] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [error, setError] = useState('');
  // Already answered in the cookie banner? Then don't ask (or silently override) again.
  const [askAnalytics] = useState(() => getCookiePrefs() === null);

  // Under-18s: the operator has no reviewed parental-consent process yet, so a
  // connected (live) service must not let them through on a checkbox.
  const minorBlocked = age === 'minor' && backendConnected;
  const ready = terms && ai && age && !minorBlocked;

  function submit(e) {
    e.preventDefault();
    if (!ready) return;
    const saved = recordConsent(user.email, [
      { type: 'terms', granted: true },
      { type: 'ai', granted: true },
      { type: 'age', granted: true, detail: age === 'adult' ? '18 or older' : 'Under 18 — prototype only, parental consent not collected' },
      { type: 'marketing', granted: marketing },
      ...(askAnalytics ? [{ type: 'analytics', granted: analytics }] : []),
    ]);
    if (!saved) return setError('Your choices could not be saved in this browser. Check that site storage is allowed and try again.');
    if (askAnalytics) setCookiePrefs({ analytics });
    onAccepted();
  }

  return (
    <div className="consent">
      <form className="consent-card" onSubmit={submit}>
        <Logo />
        <h1>{returning ? 'Our terms have been updated' : 'Before you continue'}</h1>
        <p className="consent-sub">
          Signed in as {user.email}. Policies version {POLICY_VERSION}, updated {POLICY_UPDATED}.
        </p>

        <fieldset>
          <legend>Required to use Polyglot</legend>
          <Check checked={terms} onChange={setTerms}>
            I have read and agree to the <a href="#/legal/terms">Terms of Service</a> and the{' '}
            <a href="#/legal/privacy">Privacy Policy</a>.
          </Check>
          <Check checked={ai} onChange={setAi}>
            I understand that live Polyglot sends speech recordings to its configured backend to transcribe, translate and
            generate translated speech, and that translations can be wrong.{' '}
            <a href="#/legal/ai">AI Transparency Notice</a>
          </Check>

          <div className="consent-age" role="radiogroup" aria-label="Your age">
            <span>Your age</span>
            <label>
              <input type="radio" name="age" checked={age === 'adult'} onChange={() => setAge('adult')} /> I am 18 or older
            </label>
            <label>
              <input type="radio" name="age" checked={age === 'minor'} onChange={() => setAge('minor')} /> I am under 18
            </label>
          </div>
          {age === 'minor' && (
            <p className="notice" role="status">
              {minorBlocked
                ? 'Polyglot is not open to under-18s yet. A parent or guardian consent process has to be in place first.'
                : 'Under-18 accounts will need a parent or guardian’s verified consent. That process is not built yet, so the live service will not accept this answer. This local prototype does not verify age or parental consent. In live mode, speech segments still leave your device.'}
            </p>
          )}
          <p className="consent-fine">
            Age policy: <Marked text={OPERATOR.minAge} />
          </p>
        </fieldset>

        <fieldset>
          <legend>Optional — you can change these at any time</legend>
          <Check checked={marketing} onChange={setMarketing}>
            Email me occasional Polyglot product updates.
          </Check>
          {askAnalytics ? (
            <Check checked={analytics} onChange={setAnalytics}>
              Allow anonymous usage analytics to help improve Polyglot. <a href="#/legal/cookies">Cookie Policy</a>
            </Check>
          ) : (
            <p className="consent-fine">
              Analytics: {getCookiePrefs()?.analytics ? 'allowed' : 'not allowed'}, as you chose in the cookie banner.
              Change it in Privacy &amp; Security.
            </p>
          )}
        </fieldset>

        <p className="consent-fine">
          Allowing your microphone or camera in the browser is a separate step. It is not consent to AI processing, and
          This UI does not save meeting recordings; live speech segments are captured for processing.
        </p>
        <p className="consent-fine">
          {backendConnected
            ? 'Your choices are recorded with the version and time.'
            : 'Prototype: your choices are recorded with the version and time in this browser only. No server has a copy yet.'}
        </p>

        {error && (
          <p className="notice" role="alert">
            {error}
          </p>
        )}

        <div className="consent-actions">
          <button type="button" className="btn-ghost" onClick={onDecline}>
            Decline and sign out
          </button>
          <button type="submit" className="btn-primary" disabled={!ready}>
            Agree and continue
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        </div>
      </form>
    </div>
  );
}

