import { useEffect, useState } from 'react';
import Landing from './components/Landing.jsx';
import SignIn from './components/SignIn.jsx';
import Session from './components/Session.jsx';
import Results from './components/Results.jsx';
import WaveBackground from './components/WaveBackground.jsx';
import CircleRevealLoader from './components/CircleRevealLoader.jsx';
import LegalPage from './components/legal/LegalPage.jsx';
import HelpPage from './components/legal/HelpPage.jsx';
import ConsentGate from './components/legal/ConsentGate.jsx';
import CookieBanner from './components/legal/CookieBanner.jsx';
import { loadUser, signIn, signOut, updateProfile } from './services/account.js';
import { hasRequiredConsent } from './services/privacyService.js';
import { applyAppearance, loadPrefs } from './utils/prefs.js';
import { useOverlayRoute, closeOverlay } from './utils/route.js';

const joinToken = new URLSearchParams(window.location.search).get('join');
if (joinToken) window.history.replaceState(null, '', window.location.pathname + window.location.hash);
applyAppearance(loadPrefs());
const id = () => globalThis.crypto?.randomUUID?.() ?? `guest-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export default function App() {
  const [user, setUser] = useState(loadUser);
  const [view, setView] = useState(user ? 'app' : 'landing');
  const [consented, setConsented] = useState(() => !!user && hasRequiredConsent(user.email));
  const overlay = useOverlayRoute();
  useEffect(() => { if (overlay && document.fullscreenElement) document.exitFullscreen?.(); }, [overlay]);
  function leave() { signOut(); setUser(null); setConsented(false); setView('landing'); }
  function guest() {
    setUser({ name: 'Guest', avatar: null, email: `guest-${id()}@local.invalid`, guest: true });
    setConsented(true); setView('app');
  }
  return <>
    <WaveBackground />
    <CircleRevealLoader key={view}><div className="loader-brand">POLYGLOT</div></CircleRevealLoader>
    <div inert={overlay ? '' : undefined} aria-hidden={overlay ? true : undefined}>
      {view === 'landing' && <Landing onGetStarted={() => setView(user ? 'app' : 'signin')} onGuest={guest} onResults={() => { window.location.hash = '/results'; }} />}
      {view === 'signin' && <SignIn onBack={() => setView('landing')} onGuest={guest} onSignIn={({ email, name }) => { const next = signIn(email, name); setUser(next); setConsented(hasRequiredConsent(next.email)); setView('app'); }} />}
      {view === 'app' && user && !consented && <ConsentGate user={user} onAccepted={() => setConsented(true)} onDecline={leave} />}
      {view === 'app' && user && consented && <Session user={user} joinToken={joinToken} onResults={() => { window.location.hash = '/results'; }} onUpdateUser={(patch) => {
        if (user.guest) { setUser((current) => ({ ...current, ...patch })); return true; }
        const next = updateProfile(user.email, patch); if (next) setUser(next); return !!next;
      }} onSignOut={leave} />}
    </div>
    <CookieBanner />
    {overlay?.page === 'results' && <div className="results-layer"><Results onBack={closeOverlay} /></div>}
    {overlay?.page === 'legal' && <LegalPage docId={overlay.arg} />}
    {overlay?.page === 'help' && <HelpPage key={overlay.arg} topic={overlay.arg} user={user} />}
  </>;
}
