import { useEffect, useState } from 'react';
import { Download, LogOut, MonitorSmartphone, Trash2 } from 'lucide-react';
import RequestStatus from '../legal/RequestStatus.jsx';
import { Marked } from '../legal/LegalPage.jsx';
import { LEGAL_DOCS } from '../../legal/documents.js';
import { OPERATOR, REGIONS } from '../../legal/config.js';
import { backendConnected } from '../../services/api.js';
import { sessionStartedAt } from '../../services/account.js';
import { listMeetings } from '../../services/meetingsService.js';
import {
  CONSENT_LABELS,
  consentHistory,
  downloadLocalData,
  eraseLocalData,
  getCookiePrefs,
  getRegionId,
  latestConsent,
  listPrivacyRequests,
  listSessions,
  recordConsent,
  setCookiePrefs,
  setRegionId,
  signOutOtherSessions,
  submitPrivacyRequest,
} from '../../services/privacyService.js';
import { useRequest } from '../../hooks/useRequest.js';

const when = (iso) => (iso ? new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Unknown');

/** Best-effort description of this device from what the browser reports. */
function thisDevice() {
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua) ? 'Microsoft Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'Unknown device';
  return `${browser} on ${os}`;
}

function Switch({ checked, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className={`switch${checked ? ' on' : ''}`} onClick={() => onChange(!checked)}>
      <i />
    </button>
  );
}

const SERVER_REQUESTS = {
  export: {
    title: 'Request a copy of your data',
    body: 'Polyglot will prepare a copy of the personal data held on its servers and tell you when it is ready.',
    action: 'Request export',
    done: 'Export requested.',
  },
  'delete-data': {
    title: 'Request deletion of personal data',
    body: 'Ask for eligible personal data held on Polyglot’s servers to be deleted while keeping your account. Some data may have to be kept where the law requires it.',
    action: 'Request deletion',
    done: 'Deletion requested.',
    danger: true,
  },
  'delete-account': {
    title: 'Delete your account',
    body: 'Your account, profile and scheduled meetings will be permanently deleted. This cannot be undone.',
    action: 'Request account deletion',
    done: 'Account deletion requested.',
    danger: true,
    retype: true,
  },
};

/** Confirmation for a server-side privacy request. Success is shown only on a real server response. */
function ServerRequestDialog({ kind, user, onClose, onSent }) {
  const spec = SERVER_REQUESTS[kind];
  const [typed, setTyped] = useState('');
  const request = useRequest();
  const confirmed = !spec.retype || typed.trim().toLowerCase() === user.email.toLowerCase();

  async function send() {
    const ok = await request.run(
      () => submitPrivacyRequest(kind),
      (res) => `${spec.done}${res?.reference ? ` Reference ${res.reference}.` : ''} It is not complete until the status below says so.`
    );
    if (ok) onSent();
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal confirm safety" role="alertdialog" aria-modal="true" aria-label={spec.title} onMouseDown={(e) => e.stopPropagation()}>
        <h2>{spec.title}</h2>
        <p>{spec.body}</p>
        <p>
          Expected processing time: <Marked text={OPERATOR.deletionTime} />
        </p>
        {spec.retype && (
          <>
            <p>In the live service you will be asked to sign in again before this is accepted.</p>
            <label className="field">
              <span>Type your email to confirm</span>
              <input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} />
            </label>
          </>
        )}
        <RequestStatus request={request} />
        <div className="confirm-actions">
          <button className="btn-ghost" onClick={onClose} autoFocus>
            {request.status === 'ok' ? 'Close' : 'Cancel'}
          </button>
          <button className={spec.danger ? 'leave-btn' : 'mbtn primary big'} onClick={send} disabled={!confirmed || request.busy || request.status === 'ok'}>
            {request.busy ? 'Sending…' : spec.action}
          </button>
        </div>
      </div>
    </div>
  );
}

function EraseDialog({ user, onClose, onErased }) {
  const [typed, setTyped] = useState('');
  const [failed, setFailed] = useState(false);
  const confirmed = typed.trim().toLowerCase() === user.email.toLowerCase();

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal confirm safety" role="alertdialog" aria-modal="true" aria-label="Erase data from this browser" onMouseDown={(e) => e.stopPropagation()}>
        <h2>Erase everything from this browser?</h2>
        <p>
          Your profile, picture, settings, scheduled meetings and consent history stored in this browser will be removed
          immediately and you will be signed out. This cannot be undone.
        </p>
        <label className="field">
          <span>Type your email to confirm</span>
          <input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} autoFocus />
        </label>
        {failed && (
          <p className="req-status bad" role="alert">
            Some data could not be removed. Clear this site’s data in your browser settings to finish.
          </p>
        )}
        <div className="confirm-actions">
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="leave-btn" disabled={!confirmed} onClick={() => (eraseLocalData() ? onErased() : setFailed(true))}>
            Erase and sign out
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PrivacyView({ user, onSignOut, notify, onOpenSettings }) {
  const [history, setHistory] = useState(() => consentHistory(user.email));
  const [analytics, setAnalytics] = useState(() => !!getCookiePrefs()?.analytics);
  const [region, setRegion] = useState(getRegionId);
  const [dialog, setDialog] = useState(null); // 'erase' | keyof SERVER_REQUESTS
  const requests = useRequest();
  const sessions = useRequest();
  const others = useRequest();

  const marketing = !!latestConsent(user.email, 'marketing')?.granted;
  const meetingCount = listMeetings(user).length;

  const loadRequests = () => requests.run(listPrivacyRequests, '');
  useEffect(() => {
    loadRequests();
    sessions.run(listSessions, '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const sync = () => setAnalytics(!!getCookiePrefs()?.analytics);
    window.addEventListener('polyglot:cookies-changed', sync);
    return () => window.removeEventListener('polyglot:cookies-changed', sync);
  }, []);

  function setOptional(type, granted) {
    if (!recordConsent(user.email, [{ type, granted }])) return notify('Could not save that choice in this browser.');
    if (type === 'analytics') setCookiePrefs({ analytics: granted });
    setHistory(consentHistory(user.email));
    notify(`${CONSENT_LABELS[type]}: ${granted ? 'allowed' : 'consent withdrawn'}`);
  }

  return (
    <>
      <header className="dash-head">
        <h1>Privacy &amp; Security</h1>
        <p>See what Polyglot holds about you, control optional permissions, and manage your data.</p>
      </header>

      {!backendConnected && (
        <p className="notice" role="status">
          Prototype: Polyglot has no server yet, so everything about you is stored only in this browser. Actions on
          browser data below are real. Requests that need a server will say “Not sent” instead of pretending to work.
        </p>
      )}

      <div className="settings">
        <section className="set-card">
          <h2>Your information</h2>
          <dl className="set-list">
            <div>
              <dt>Email</dt>
              <dd>{user.email}</dd>
            </div>
            <div>
              <dt>Display name</dt>
              <dd>{user.name || 'Not set'}</dd>
            </div>
            <div>
              <dt>Profile picture</dt>
              <dd>{user.avatar ? 'Uploaded' : 'None'}</dd>
            </div>
            <div>
              <dt>Scheduled meetings</dt>
              <dd>{meetingCount}</dd>
            </div>
            <div>
              <dt>Meeting recordings and transcripts</dt>
              <dd>None — Polyglot does not keep them</dd>
            </div>
            <div>
              <dt>Password</dt>
              <dd>Not stored in this browser</dd>
            </div>
          </dl>
          <div className="set-actions">
            <em className="help">Stored in this browser. Edit your name and picture in Settings.</em>
            <button type="button" className="mbtn" onClick={onOpenSettings}>
              Edit profile
            </button>
          </div>
        </section>

        <section className="set-card">
          <h2>Permissions and consent</h2>
          <div className="set-row">
            <div>
              <strong>Essential service</strong>
              <span>Terms, Privacy Policy and AI processing of meeting speech. Required to use Polyglot; to withdraw, delete your account.</span>
            </div>
            <em className="tag">Required</em>
          </div>
          <div className="set-row">
            <div>
              <strong>Analytics</strong>
              <span>Anonymous usage statistics. No analytics tool is installed today.</span>
            </div>
            <Switch checked={analytics} onChange={(v) => setOptional('analytics', v)} label="Analytics" />
          </div>
          <div className="set-row">
            <div>
              <strong>Product update emails</strong>
              <span>Occasional news about Polyglot. Never required.</span>
            </div>
            <Switch checked={marketing} onChange={(v) => setOptional('marketing', v)} label="Product update emails" />
          </div>
          <label className="field">
            <span>Your region</span>
            <select
              value={region}
              onChange={(e) => {
                setRegion(e.target.value);
                setRegionId(e.target.value);
              }}
            >
              {REGIONS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
            <em className="help">
              Used to show the privacy notes for where you live. <a href="#/legal/privacy">See your rights</a>
            </em>
          </label>

          <h3>Consent history</h3>
          {history.length ? (
            <div className="legal-table">
              <table>
                <thead>
                  <tr>
                    <th>Consent</th>
                    <th>Decision</th>
                    <th>Policy version</th>
                    <th>When</th>
                  </tr>
                </thead>
                <tbody>
                  {[...history].reverse().map((c, i) => (
                    <tr key={i}>
                      <td>{CONSENT_LABELS[c.type] ?? c.type}</td>
                      <td>
                        {c.granted ? 'Given' : 'Not given / withdrawn'}
                        {c.detail ? ` (${c.detail})` : ''}
                      </td>
                      <td>{c.version}</td>
                      <td>{when(c.at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="help">No consent decisions recorded yet.</p>
          )}
          {!backendConnected && <em className="help">Recorded in this browser only. The live service must keep this record on the server.</em>}
        </section>

        <section className="set-card">
          <h2>Your data</h2>
          <div className="set-row">
            <div>
              <strong>Download my data</strong>
              <span>A file with everything Polyglot has stored in this browser.</span>
            </div>
            <button type="button" className="mbtn" onClick={() => (downloadLocalData(), notify('Your data file was downloaded'))}>
              <Download size={14} aria-hidden="true" />
              Download
            </button>
          </div>
          <div className="set-row">
            <div>
              <strong>Erase data from this browser</strong>
              <span>Removes your profile, settings, meetings and consent history here, immediately.</span>
            </div>
            <button type="button" className="mbtn danger" onClick={() => setDialog('erase')}>
              <Trash2 size={14} aria-hidden="true" />
              Erase
            </button>
          </div>

          <h3>Requests to Polyglot</h3>
          <div className="set-row">
            <div>
              <strong>Export of server-held data</strong>
              <span>Ask Polyglot for a copy of the personal data on its servers.</span>
            </div>
            <button type="button" className="mbtn" onClick={() => setDialog('export')}>
              Request export
            </button>
          </div>
          <div className="set-row">
            <div>
              <strong>Delete personal data</strong>
              <span>Ask for eligible personal data to be deleted, keeping your account.</span>
            </div>
            <button type="button" className="mbtn" onClick={() => setDialog('delete-data')}>
              Request deletion
            </button>
          </div>
          <div className="set-row">
            <div>
              <strong>Delete account</strong>
              <span>Permanently delete your account and everything in it.</span>
            </div>
            <button type="button" className="mbtn danger" onClick={() => setDialog('delete-account')}>
              Delete account
            </button>
          </div>

          <h3>Request status</h3>
          {requests.busy && <p className="help">Loading your requests…</p>}
          {requests.status === 'error' && (
            <p className="help">
              {backendConnected ? requests.message : 'No requests have been sent. Tracking needs the Polyglot server, which is not connected yet.'}
            </p>
          )}
          {requests.status === 'ok' &&
            (requests.data?.length ? (
              <ul className="req-list">
                {requests.data.map((r) => (
                  <li key={r.id}>
                    <strong>{SERVER_REQUESTS[r.kind]?.title ?? r.kind}</strong>
                    <span>
                      {r.status} · requested {when(r.createdAt)}
                      {r.reference ? ` · ${r.reference}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="help">You have no open requests.</p>
            ))}
        </section>

        <section className="set-card">
          <h2>Security</h2>
          <h3>Active sessions</h3>
          <div className="set-row">
            <div>
              <strong>
                <MonitorSmartphone size={15} aria-hidden="true" /> {thisDevice()} <em className="tag">This session</em>
              </strong>
              <span>Signed in {when(sessionStartedAt())}</span>
            </div>
            <button type="button" className="mbtn" onClick={onSignOut}>
              <LogOut size={14} aria-hidden="true" />
              Sign out
            </button>
          </div>
          {sessions.status === 'ok' &&
            sessions.data
              ?.filter((s) => !s.current)
              .map((s) => (
                <div className="set-row" key={s.id}>
                  <div>
                    <strong>{s.device ?? 'Unknown device'}</strong>
                    <span>Last active {when(s.lastActiveAt)}</span>
                  </div>
                </div>
              ))}
          {sessions.status === 'error' && (
            <p className="help">
              {backendConnected ? sessions.message : 'Sessions on other devices cannot be listed until the Polyglot server is connected.'}
            </p>
          )}
          <div className="set-actions">
            <button type="button" className="mbtn" disabled={others.busy} onClick={() => others.run(signOutOtherSessions, 'Signed out of all other sessions.')}>
              Sign out of other sessions
            </button>
            <RequestStatus request={others} />
          </div>

          <h3>Password</h3>
          <p className="help">
            Password change is not available: password sign-in is not connected in this prototype, and no password is
            kept in this browser. Suspicious sign-in alerts also need the server.
          </p>
        </section>

        <section className="set-card">
          <h2>Policies</h2>
          <div className="policy-links">
            {LEGAL_DOCS.map((d) => (
              <a key={d.id} href={`#/legal/${d.id}`}>
                {d.title}
              </a>
            ))}
            <a href="#/help">Help &amp; Privacy Support</a>
          </div>
        </section>
      </div>

      {dialog === 'erase' && <EraseDialog user={user} onClose={() => setDialog(null)} onErased={onSignOut} />}
      {dialog && dialog !== 'erase' && (
        <ServerRequestDialog kind={dialog} user={user} onClose={() => setDialog(null)} onSent={loadRequests} />
      )}
    </>
  );
}
