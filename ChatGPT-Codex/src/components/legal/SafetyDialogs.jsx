import { useState } from 'react';
import { Ban, Flag, Mic, MicOff, MonitorUp, Sparkles, Video, VideoOff, CircleOff } from 'lucide-react';
import RequestStatus from './RequestStatus.jsx';
import { blockParticipant, submitReport } from '../../services/privacyService.js';
import { recordingState } from '../../services/recording.js';
import { useRequest } from '../../hooks/useRequest.js';

export const AI_DISCLAIMER =
  'POLYGLOT uses artificial intelligence to translate conversations in real time. Translations and generated speech may contain inaccuracies. Users should independently verify important information. POLYGLOT is not a certified interpreting service or emergency communication service.';

const CATEGORIES = [
  ['harassment', 'Harassment or bullying'],
  ['hate', 'Hateful or violent content'],
  ['sexual', 'Sexual or inappropriate content'],
  ['impersonation', 'Impersonation or fraud'],
  ['recording', 'Recording without consent'],
  ['uninvited', 'Uninvited or unauthorised participant'],
  ['other', 'Something else'],
];

function Dialog({ label, onClose, children, as: Tag = 'div', ...rest }) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <Tag className="modal confirm safety" role="dialog" aria-modal="true" aria-label={label} onMouseDown={(e) => e.stopPropagation()} {...rest}>
        {children}
      </Tag>
    </div>
  );
}

/** Private report to the safety team. `person` is optional (general behaviour report). */
export function ReportDialog({ person, meetingId, onClose }) {
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [missing, setMissing] = useState(false);
  const request = useRequest();

  async function submit(e) {
    e.preventDefault();
    if (!category) return setMissing(true);
    await request.run(
      () => submitReport({ meetingId, participantId: person?.id ?? null, category, description: description.trim() }),
      (res) => `Report submitted${res?.reference ? `. Reference ${res.reference}` : ''}. Thank you.`
    );
  }

  return (
    <Dialog as="form" label="Report" onClose={onClose} onSubmit={submit} noValidate>
      <h2>
        <Flag size={18} aria-hidden="true" /> {person ? `Report ${person.name}` : 'Report inappropriate behaviour'}
      </h2>
      <p>Reports are private. Other participants, including the person reported, are not told who sent them.</p>
      <label className="field">
        <span>Category</span>
        <select value={category} onChange={(e) => (setCategory(e.target.value), setMissing(false))} aria-invalid={missing} autoFocus>
          <option value="">Choose a category</option>
          {CATEGORIES.map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
        {missing && <em className="err">Choose a category.</em>}
      </label>
      <label className="field">
        <span>What happened? (optional)</span>
        <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} />
      </label>
      <label className="field">
        <span>Meeting ID</span>
        <input value={meetingId} readOnly />
      </label>
      <RequestStatus request={request} />
      <div className="confirm-actions">
        <button type="button" className="btn-ghost" onClick={onClose}>
          {request.status === 'ok' ? 'Close' : 'Cancel'}
        </button>
        <button type="submit" className="mbtn primary big" disabled={request.busy || request.status === 'ok'}>
          {request.busy ? 'Sending…' : 'Submit report'}
        </button>
      </div>
      <p className="host-fine">In immediate danger? Leave the meeting and call your local emergency number.</p>
    </Dialog>
  );
}

/** Blocking has to be enforced by the server, so it is a request — never a local "hide". */
export function BlockDialog({ person, meetingId, onClose, onBlocked }) {
  const request = useRequest();

  async function confirm() {
    const ok = await request.run(() => blockParticipant(meetingId, person.id), `${person.name} is blocked.`);
    if (ok) onBlocked?.(person.id);
  }

  return (
    <Dialog label={`Block ${person.name}`} onClose={onClose}>
      <h2>
        <Ban size={18} aria-hidden="true" /> Block {person.name}?
      </h2>
      <p>You will no longer see or hear each other in Polyglot meetings. They are not notified. You can report them as well.</p>
      <RequestStatus request={request} />
      <div className="confirm-actions">
        <button className="btn-ghost" onClick={onClose} autoFocus>
          {request.status === 'ok' ? 'Close' : 'Cancel'}
        </button>
        <button className="leave-btn" onClick={confirm} disabled={request.busy || request.status === 'ok'}>
          {request.busy ? 'Blocking…' : 'Block'}
        </button>
      </div>
    </Dialog>
  );
}

/** "What is happening to my audio and video right now" — opened from the AI indicator. */
export function PrivacyStatusDialog({ liveMode = false, micOn, camOn, hasMic, hasCam, sharing, translateOn, onClose }) {
  const rec = recordingState();
  const rows = [
    [micOn ? Mic : MicOff, 'Microphone', !hasMic ? 'No microphone available' : micOn ? 'On' : 'Muted'],
    [camOn ? Video : VideoOff, 'Camera', !hasCam ? 'No camera available' : camOn ? 'On' : 'Off'],
    [MonitorUp, 'Screen sharing', sharing ? 'Local screen preview only' : 'Not previewing a screen'],
    [Sparkles, 'AI translation', liveMode ? (translateOn ? 'Live translated speech and captions' : 'Original captions; translated playback muted. Uploads continue while unmuted.') : (translateOn ? 'Scripted demo translation' : 'Original scripted demo audio')],
    [CircleOff, 'Recording', `${rec.label}. Polyglot has no recording feature.`],
  ];

  return (
    <Dialog label="AI and privacy in this meeting" onClose={onClose}>
      <h2>
        <Sparkles size={18} aria-hidden="true" /> AI and privacy in this meeting
      </h2>
      <ul className="privacy-rows">
        {rows.map(([Icon, label, value]) => (
          <li key={label}>
            <Icon size={16} aria-hidden="true" />
            <strong>{label}</strong>
            <span>{value}</span>
          </li>
        ))}
      </ul>
      <p>{AI_DISCLAIMER}</p>
      <p>
        In a live call, your speech is sent to the configured backend to be converted to text, translated and spoken by a
        synthetic voice. The voice you hear is AI-generated, not the speaker’s own.
      </p>
      <p className="notice">{liveMode ? 'Live mode: microphone segments are sent while unmuted, even when translated playback is off. Camera and screen previews stay local. Ask the backend operator about retention.' : 'Demo mode: the other participants are scripted and no microphone, camera or screen media is sent.'}</p>
      <p className="host-fine">
        <a href="#/legal/ai">AI Transparency Notice</a> · <a href="#/legal/recording">Recording &amp; Consent</a> ·{' '}
        <a href="#/legal/privacy">Privacy Policy</a>
      </p>
      <div className="confirm-actions">
        <button className="mbtn primary big" onClick={onClose} autoFocus>
          Got it
        </button>
      </div>
    </Dialog>
  );
}

