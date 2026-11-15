import { useEffect, useState } from 'react';
import { getCookiePrefs, setCookiePrefs } from '../../services/privacyService.js';

/**
 * Cookie / storage consent. Shown until a choice is made, and again from
 * "Cookie choices". Rejecting optional storage never blocks the app, and no
 * optional script exists to load before consent.
 */
export default function CookieBanner() {
  const [prefs, setPrefs] = useState(getCookiePrefs);
  const [open, setOpen] = useState(false); // reopened from the footer / settings
  const [custom, setCustom] = useState(false);
  const [analytics, setAnalytics] = useState(false);

  useEffect(() => {
    const onOpen = () => {
      setAnalytics(!!getCookiePrefs()?.analytics);
      setCustom(true);
      setOpen(true);
    };
    const onChanged = () => setPrefs(getCookiePrefs());
    window.addEventListener('polyglot:cookies-open', onOpen);
    window.addEventListener('polyglot:cookies-changed', onChanged);
    return () => {
      window.removeEventListener('polyglot:cookies-open', onOpen);
      window.removeEventListener('polyglot:cookies-changed', onChanged);
    };
  }, []);

  if (prefs && !open) return null;

  const choose = (value) => {
    const choice = setCookiePrefs({ analytics: value });
    setPrefs(choice); // Keep this visit usable even when persistent storage is blocked.
    setOpen(false);
    setCustom(false);
  };

  return (
    <section className="cookie" role="region" aria-label="Cookie choices">
      <div className="cookie-text">
        <strong>Your privacy choices</strong>
        <p>
          Polyglot stores a small amount of essential data in your browser so sign-in and settings work. Optional
          analytics stay off unless you allow them. Polyglot does not use advertising cookies.{' '}
          <a href="#/legal/cookies">Cookie Policy</a>
        </p>
      </div>

      {custom && (
        <div className="cookie-options">
          <div className="set-row">
            <div>
              <strong>Essential</strong>
              <span>Sign-in, settings and your consent choices. Always on.</span>
            </div>
            <button type="button" role="switch" aria-checked="true" aria-label="Essential storage" className="switch on" disabled>
              <i />
            </button>
          </div>
          <div className="set-row">
            <div>
              <strong>Analytics</strong>
              <span>Anonymous usage statistics. No analytics tool is installed today.</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={analytics}
              aria-label="Analytics"
              className={`switch${analytics ? ' on' : ''}`}
              onClick={() => setAnalytics((v) => !v)}
            >
              <i />
            </button>
          </div>
        </div>
      )}

      <div className="cookie-actions">
        {custom ? (
          <button className="mbtn primary" onClick={() => choose(analytics)}>
            Save choices
          </button>
        ) : (
          <button className="mbtn" onClick={() => setCustom(true)}>
            Customise
          </button>
        )}
        {/* Equal prominence: rejecting is as easy as accepting. */}
        <button className="mbtn" onClick={() => choose(false)}>
          Reject optional
        </button>
        <button className="mbtn" onClick={() => choose(true)}>
          Accept all
        </button>
      </div>
    </section>
  );
}

