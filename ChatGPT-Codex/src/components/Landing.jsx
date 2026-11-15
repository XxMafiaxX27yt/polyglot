import { useEffect, useState } from 'react';
import { ArrowRight, AudioLines, Ear, Mic } from 'lucide-react';
import Logo from './Logo.jsx';
import PixelAtlas from './PixelAtlas.jsx';
import SiteFooter from './legal/SiteFooter.jsx';
import { LANGUAGES, getLanguage, isTestedLanguage } from '../data/languages.js';

const STEPS = [
  {
    icon: Mic,
    title: 'Speak naturally',
    text: 'Choose the language you speak so speech recognition has the right hint. Hinglish speakers choose Hindi.',
  },
  {
    icon: AudioLines,
    title: 'Pause, then hear the translation',
    text: 'After a pause in your speech, the recording is recognised, translated and voiced for listeners.',
  },
  {
    icon: Ear,
    title: 'Everyone hears their own language',
    text: 'One speaker, many listeners: each person on the call hears the language they picked.',
  },
];

const SCROLL_MS = 1400;

/** Slow eased scroll to an element (CSS smooth scrolling has no speed control). */
function glideTo(id) {
  const el = document.getElementById(id);
  if (!el) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    el.scrollIntoView({ behavior: 'instant' });
    return;
  }
  const from = window.scrollY;
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const to = Math.min(max, from + el.getBoundingClientRect().top - 20);
  const start = performance.now();
  const ease = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

  function step(now) {
    const p = Math.min(1, (now - start) / SCROLL_MS);
    window.scrollTo({ top: from + (to - from) * ease(p), behavior: 'instant' });
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

export default function Landing({ onGetStarted, onGuest, onResults }) {
  const [selected, setSelected] = useState('hi');
  const [paused, setPaused] = useState(false);

  // Tour the languages one by one until someone takes over.
  useEffect(() => {
    if (paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = setInterval(() => {
      setSelected((code) => {
        const i = LANGUAGES.findIndex((l) => l.code === code);
        return LANGUAGES[(i + 1) % LANGUAGES.length].code;
      });
    }, 2600);
    return () => clearInterval(timer);
  }, [paused]);

  const lang = getLanguage(selected);

  return (
    <div className="landing">
      <header className="land-nav">
        <Logo />
        <nav>
          <button className="btn-ghost" onClick={onResults}>Results</button>
          <button className="btn-ghost" onClick={onGetStarted}>
            Sign in
          </button>
        </nav>
      </header>

      <section className="land-hero">
        <p className="eyebrow">AI voice translation prototype</p>
        <h1>
          Speak your language.
          <br />
          <span>Hear theirs.</span>
        </h1>
        <p className="hero-sub">
          Speak Hindi and hear English after each utterance. Live rooms connect microphones and translated audio; remote participants use avatars, and your camera stays a local preview.
        </p>
        <div className="land-cta">
          <button className="btn-primary" onClick={onGuest}>
            Join as guest
            <ArrowRight size={18} aria-hidden="true" />
          </button>
          <a
            className="btn-ghost"
            href="#languages"
            onClick={(e) => {
              e.preventDefault();
              glideTo('languages');
            }}
          >
            See the languages
          </a>
        </div>
      </section>

      <section id="languages" className="atlas-panel">
        <div className="atlas-head">
          <div>
            <p className="eyebrow">Language catalogue</p>
            <h2>4 languages in scope. 16 untested.</h2>
          </div>
          <div className="atlas-now" aria-live="polite">
            <b lang={lang.code}>{lang.native}</b>
            <span>{lang.name}{!isTestedLanguage(lang.code) && ' · Untested'}</span>
          </div>
        </div>

        <PixelAtlas selected={selected} onSelect={setSelected} onHoverChange={setPaused} />

        <div
          className="lang-chips"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
        >
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              className={`lang-chip${l.code === selected ? ' selected' : ''}`}
              onMouseEnter={() => setSelected(l.code)}
              onFocus={() => setSelected(l.code)}
              onClick={() => setSelected(l.code)}
              aria-pressed={l.code === selected}
            >
              <b lang={l.code}>{l.native}</b>
              {l.native !== l.name && <span>{l.name}</span>}{!isTestedLanguage(l.code) && <small className="lang-untested">Untested</small>}
            </button>
          ))}
        </div>
        <p className="atlas-note">
          Markers are example locations. Hindi, English, Tamil, Bengali and Hinglish are in the tested scope. The other 16 languages are untested. See Results for available evaluation data.
        </p>
      </section>

      <section id="how" className="steps">
        {STEPS.map(({ icon: Icon, title, text }, i) => (
          <article key={title} className="step">
            <span className="step-num">0{i + 1}</span>
            <Icon size={22} aria-hidden="true" />
            <h3>{title}</h3>
            <p>{text}</p>
          </article>
        ))}
      </section>

      <SiteFooter />
    </div>
  );
}
