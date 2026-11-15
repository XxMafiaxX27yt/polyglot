import { useEffect, useMemo, useState } from 'react';
import {
  CalendarClock,
  CalendarPlus,
  History,
  House,
  KeyRound,
  LogIn,
  LogOut,
  Settings as SettingsIcon,
  ShieldCheck,
  Video,
} from 'lucide-react';
import Logo from '../Logo.jsx';
import { IS_LIVE } from '../../services/backendConfig.js';
import MeetingForm from './MeetingForm.jsx';
import CalendarView from './CalendarView.jsx';
import { MeetingCard, MeetingDetails } from './MeetingCard.jsx';
import SettingsView from './SettingsView.jsx';
import PrivacyView from './PrivacyView.jsx';
import { loadPrefs, savePrefs } from '../../utils/prefs.js';
import {
  cancelMeeting,
  createMeeting,
  findMeeting,
  getMeeting,
  hostsMeeting,
  joinState,
  listMeetings,
  statusOf,
  updateMeeting,
} from '../../services/meetingsService.js';

const newRoomCode = () => `PLG-${Math.floor(1000 + Math.random() * 9000)}`;

const NAV = [
  ['home', 'Home', House],
  ['join', 'Join Meeting', LogIn],
  ['schedule', 'Schedule Meeting', CalendarPlus],
  ['upcoming', 'Upcoming Meetings', CalendarClock],
  ['past', 'Past Meetings', History],
  ['settings', 'Settings', SettingsIcon],
  ['privacy', 'Privacy & Security', ShieldCheck],
];

export default function Dashboard({ user, joinToken, onStart, onUpdateUser, onSignOut, onResults }) {
  const [view, setView] = useState(joinToken ? 'join' : 'home');
  const [prefs, setPrefs] = useState(loadPrefs);
  const [meetings, setMeetings] = useState(() => listMeetings(user));
  const [now, setNow] = useState(Date.now());
  const [modal, setModal] = useState(null); // { type: 'form' | 'details' | 'cancel' | 'passcode', id? }
  const [toast, setToast] = useState('');
  const [layout, setLayout] = useState('list'); // upcoming: list | calendar

  const tz = prefs.timeZone;
  const refresh = () => setMeetings(listMeetings(user));

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 20000); // keeps countdowns and statuses current
    return () => clearInterval(t);
  }, []);

  useEffect(() => savePrefs(prefs), [prefs]);

  // Meeting reminders: one browser notification per meeting, 10 minutes before
  // it starts. Only fires while this page is open.
  useEffect(() => {
    if (!prefs.remind || !('Notification' in window) || Notification.permission !== 'granted') return;
    for (const m of meetings) {
      const ms = new Date(m.scheduledStartUtc).getTime() - now;
      const key = `polyglot.reminded.${m.id}.${m.scheduledStartUtc}`;
      if (statusOf(m, now) === 'scheduled' && ms <= 10 * 60000 && !sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1');
        new Notification('Polyglot meeting starting soon', { body: `${m.title} starts in ${Math.max(1, Math.round(ms / 60000))} min.` });
      }
    }
  }, [now, meetings, prefs.remind]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const { upcoming, past } = useMemo(() => {
    const isUpcoming = (m) => ['scheduled', 'live'].includes(statusOf(m, now));
    const byStart = (a, b) => a.scheduledStartUtc.localeCompare(b.scheduledStartUtc);
    return {
      upcoming: meetings.filter(isUpcoming).sort(byStart),
      past: meetings.filter((m) => !isUpcoming(m)).sort((a, b) => byStart(b, a)),
    };
  }, [meetings, now]);

  const enter = (meeting) => onStart({ room: meeting.id, title: meeting.title, lang: prefs.lang });

  const actions = {
    join(meeting) {
      const state = joinState(meeting);
      if (!state.ok) return setToast(state.reason);
      if (meeting.passcode && !hostsMeeting(meeting, user)) return setModal({ type: 'passcode', id: meeting.id });
      enter(meeting);
    },
    details: (meeting) => setModal({ type: 'details', id: meeting.id }),
    edit: (meeting) => setModal({ type: 'form', id: meeting.id }),
    cancel: (meeting) => setModal({ type: 'cancel', id: meeting.id }),
  };

  /** Returns an error message for the form to show, or nothing on success. */
  function saveMeeting(data) {
    try {
      const saved = modal.id ? updateMeeting(modal.id, data, user) : createMeeting(data, user);
      refresh();
      setToast(modal.id ? 'Meeting updated' : 'Meeting scheduled');
      setModal({ type: 'details', id: saved.id }); // show the invitation straight away
    } catch (err) {
      return err.message;
    }
  }

  function confirmCancel() {
    try {
      cancelMeeting(modal.id, user);
      refresh();
      setToast('Meeting cancelled');
    } catch (err) {
      setToast(err.message);
    }
    setModal(null);
  }

  const go = (id) => (id === 'schedule' ? setModal({ type: 'form' }) : setView(id));
  const current = modal?.id ? getMeeting(modal.id) : null;
  const cardProps = { user, tz, now, actions };

  return (
    <div className="dash">
      <aside className="dash-side">
        <Logo />
        <nav aria-label="Dashboard">
          {NAV.map(([id, label, Icon]) => (
            <button key={id} className={view === id ? 'active' : ''} onClick={() => go(id)} aria-current={view === id ? 'page' : undefined}>
              <Icon size={18} aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
          <button onClick={onResults}>Results</button>
        </nav>
        <div className="dash-user">
          <span className="p-avatar">{user.avatar ? <img src={user.avatar} alt="" /> : user.name.slice(0, 1).toUpperCase() || '?'}</span>
          <div>
            <strong>{user.name || 'Guest'}</strong>
            <span>{user.guest ? 'Guest · no login' : user.email}</span>
          </div>
          <button className="icon-btn" onClick={onSignOut} aria-label="Sign out" title="Sign out">
            <LogOut size={17} />
          </button>
        </div>
      </aside>

      <main className="dash-main">
        <p className="prototype-banner">{IS_LIVE ? 'Live translation backend configured.' : 'Demo mode — participants, translations and latency are simulated.'} Scheduling, profiles and settings are saved in this browser only. Meeting passcodes and host controls are not enforced by the translation server.</p>
        {view === 'home' && (
          <>
            <header className="dash-head">
              <h1>Welcome{user.name ? `, ${user.name.split(' ')[0]}` : ''}</h1>
              <p>Start a call, join one, or plan the next.</p>
            </header>
            <div className="quick">
              <button className="quick-card primary" onClick={() => onStart({ room: newRoomCode(), title: null, lang: prefs.lang })}>
                <Video size={22} aria-hidden="true" />
                <strong>New meeting</strong>
                <span>Start an instant call now</span>
              </button>
              <button className="quick-card" onClick={() => setView('join')}>
                <LogIn size={22} aria-hidden="true" />
                <strong>Join meeting</strong>
                <span>Use a meeting ID or invitation link</span>
              </button>
              <button className="quick-card" onClick={() => setModal({ type: 'form' })}>
                <CalendarPlus size={22} aria-hidden="true" />
                <strong>Schedule meeting</strong>
                <span>Plan a call and invite people</span>
              </button>
            </div>
            <section>
              <div className="dash-row">
                <h2>Upcoming meetings</h2>
                {upcoming.length > 3 && (
                  <button className="mbtn" onClick={() => setView('upcoming')}>
                    View all {upcoming.length}
                  </button>
                )}
              </div>
              {upcoming.length ? (
                <div className="mgrid">
                  {upcoming.slice(0, 3).map((m) => (
                    <MeetingCard key={m.id} meeting={m} {...cardProps} />
                  ))}
                </div>
              ) : (
                <p className="dash-empty">Nothing scheduled yet. Schedule a meeting and it will appear here.</p>
              )}
            </section>
          </>
        )}

        {view === 'join' && <JoinView initial={joinToken} cardProps={cardProps} onInstant={(room) => onStart({ room, title: null, lang: prefs.lang })} />}

        {view === 'upcoming' && (
          <>
            <header className="dash-head row">
              <div>
                <h1>Upcoming meetings</h1>
                <p>Times are shown in {tz.replace(/_/g, ' ')}.</p>
              </div>
              <div className="dash-tools">
                <div className="tabs" role="tablist" aria-label="Layout">
                  <button role="tab" aria-selected={layout === 'list'} onClick={() => setLayout('list')}>
                    List
                  </button>
                  <button role="tab" aria-selected={layout === 'calendar'} onClick={() => setLayout('calendar')}>
                    Calendar
                  </button>
                </div>
                <button className="mbtn primary" onClick={() => setModal({ type: 'form' })}>
                  <CalendarPlus size={14} aria-hidden="true" />
                  Schedule
                </button>
              </div>
            </header>
            {layout === 'calendar' ? (
              <CalendarView meetings={meetings} tz={tz} now={now} onOpen={actions.details} />
            ) : upcoming.length ? (
              <div className="mgrid">
                {upcoming.map((m) => (
                  <MeetingCard key={m.id} meeting={m} {...cardProps} />
                ))}
              </div>
            ) : (
              <p className="dash-empty">No upcoming meetings.</p>
            )}
          </>
        )}

        {view === 'past' && (
          <>
            <header className="dash-head">
              <h1>Past meetings</h1>
              <p>Completed and cancelled meetings. There is no saved meeting recording. Live speech segments are sent for translation.</p>
            </header>
            {past.length ? (
              <div className="mlist">
                {past.map((m) => (
                  <MeetingCard key={m.id} meeting={m} compact {...cardProps} />
                ))}
              </div>
            ) : (
              <p className="dash-empty">No past meetings yet.</p>
            )}
          </>
        )}

        {view === 'settings' && (
          <SettingsView user={user} onUpdateUser={onUpdateUser} prefs={prefs} setPrefs={setPrefs} onSignOut={onSignOut} notify={setToast} />
        )}

        {view === 'privacy' && (
          <PrivacyView user={user} onSignOut={onSignOut} notify={setToast} onOpenSettings={() => setView('settings')} />
        )}
      </main>

      {modal?.type === 'form' && (
        <MeetingForm meeting={current} user={user} defaultTz={tz} onSubmit={saveMeeting} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'details' && current && (
        <MeetingDetails meeting={current} {...cardProps} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'cancel' && current && (
        <div className="modal-backdrop" onMouseDown={() => setModal(null)}>
          <div className="modal confirm" role="alertdialog" aria-modal="true" aria-label="Cancel meeting" onMouseDown={(e) => e.stopPropagation()}>
            <h2>Cancel "{current.title}"?</h2>
            <p>
              The meeting will be marked as cancelled and nobody will be able to join. Its invitation link will show that
              it was cancelled.
            </p>
            <div className="confirm-actions">
              <button className="btn-ghost" onClick={() => setModal(null)} autoFocus>
                Keep meeting
              </button>
              <button className="leave-btn" onClick={confirmCancel}>
                Cancel meeting
              </button>
            </div>
          </div>
        </div>
      )}
      {modal?.type === 'passcode' && current && (
        <PasscodeGate meeting={current} onClose={() => setModal(null)} onPass={() => enter(current)} />
      )}

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}

function JoinView({ initial, cardProps, onInstant }) {
  const [code, setCode] = useState(initial ?? '');
  const [result, setResult] = useState(() => (initial ? { query: initial, meeting: findMeeting(initial) } : null));

  function lookup(e) {
    e.preventDefault();
    if (code.trim()) setResult({ query: code.trim(), meeting: findMeeting(code) });
  }

  const looksLikeRoom = result && !result.meeting && /^[A-Za-z0-9-]{4,16}$/.test(result.query);

  return (
    <>
      <header className="dash-head">
        <h1>Join a meeting</h1>
        <p>Enter a meeting ID or paste an invitation link.</p>
      </header>
      <form className="join-row" onSubmit={lookup}>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="PLG-XXXX-XXXX or invitation link"
          aria-label="Meeting ID or invitation link"
          spellCheck={false}
          autoFocus
        />
        <button className="btn-primary" type="submit" disabled={!code.trim()}>
          Find meeting
        </button>
      </form>

      {result?.meeting && (
        <div className="mgrid one">
          <MeetingCard meeting={result.meeting} {...cardProps} />
        </div>
      )}
      {result && !result.meeting && (
        <div className="dash-empty left">
          <p>
            No scheduled meeting matches that in this browser. In this prototype, scheduled meetings are stored on the
            device that created them.
          </p>
          {looksLikeRoom && (
            <button className="mbtn" onClick={() => onInstant(result.query.toUpperCase())}>
              <Video size={14} aria-hidden="true" />
              Open an instant room called {result.query.toUpperCase()}
            </button>
          )}
        </div>
      )}
    </>
  );
}

function PasscodeGate({ meeting, onPass, onClose }) {
  const [value, setValue] = useState('');
  const [wrong, setWrong] = useState(false);

  function submit(e) {
    e.preventDefault();
    // Prototype check. A real backend compares against a stored hash and only
    // then issues a join token.
    if (value.trim() === meeting.passcode) onPass();
    else setWrong(true);
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <form className="modal confirm" role="dialog" aria-modal="true" aria-label="Meeting passcode" onMouseDown={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>
          <KeyRound size={18} aria-hidden="true" /> Passcode required
        </h2>
        <p>"{meeting.title}" has a local prototype passcode. This is not server-enforced access control.</p>
        <label className="field">
          <span>Meeting passcode</span>
          <input value={value} onChange={(e) => (setValue(e.target.value), setWrong(false))} autoFocus autoComplete="off" />
          {wrong && <em className="err">That passcode is not correct.</em>}
        </label>
        <div className="confirm-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="mbtn primary big" disabled={!value.trim()}>
            Join
          </button>
        </div>
      </form>
    </div>
  );
}

