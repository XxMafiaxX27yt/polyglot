import { useState } from 'react';
import { ArrowLeft, ArrowRight, Eye, EyeOff } from 'lucide-react';
import Logo from './Logo.jsx';
import FluidCanvas from './FluidCanvas.jsx';

// "priya.sharma@example.com" -> "Priya Sharma"
const nameFromEmail = (email) =>
  email
    .split('@')[0]
    .split(/[._\-+0-9]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');

export default function SignIn({ onSignIn, onBack, onGuest }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [note, setNote] = useState('');

  function submit(e) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    // Prototype: there is no account backend yet, so nothing is verified or
    // stored — the password never leaves this component.
    onSignIn({ email: email.trim(), name: nameFromEmail(email.trim()) });
  }

  return (
    <div className="signin">
      <aside className="signin-art">
        <FluidCanvas />
        <div className="signin-art-top">
          <Logo />
        </div>
        <p className="signin-art-quote">
          Speak your language.
          <br />
          <span>Hear theirs.</span>
        </p>
      </aside>

      <main className="signin-side">
        <button className="btn-ghost signin-back" onClick={onBack}>
          <ArrowLeft size={16} aria-hidden="true" />
          Back
        </button>

        <form className="signin-form" onSubmit={submit}>
          <h1>Welcome back</h1>
          <p className="signin-sub">Sign in to pick up where you left off.</p>

          <label className="s-field">
            <span>Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>

          <div className="s-field">
            <span className="s-field-row">
              <label htmlFor="signin-password">Password</label>
              <button
                type="button"
                className="s-link"
                onClick={() => setNote('Password reset is not available in this prototype yet.')}
              >
                Forgot?
              </button>
            </span>
            <div className="s-password">
              <input
                id="signin-password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button className="btn-primary signin-submit" type="submit">
            Sign in
            <ArrowRight size={18} aria-hidden="true" />
          </button>

          <button type="button" className="btn-ghost guest-entry" onClick={onGuest}>Join as guest</button>
          <p className="signin-note" role="status">
            {note || 'Prototype: accounts are not connected yet, so any email and password will continue.'}
          </p>
          
          <p className="signin-note">
            Next, you will be asked to review the <a href="#/legal/terms">Terms of Service</a> and{' '}
            <a href="#/legal/privacy">Privacy Policy</a>. Live speech is processed by the configured translation backend.
          </p>
        </form>
      </main>
    </div>
  );
}


