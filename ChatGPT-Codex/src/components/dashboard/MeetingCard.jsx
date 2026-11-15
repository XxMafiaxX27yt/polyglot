import { useEffect, useState } from 'react';
import { CalendarDays, Check, Clock, Copy, Link2, Lock, Pencil, Trash2, User, Users, Video, X } from 'lucide-react';
import {
  hostsMeeting,
  invitationText,
  inviteLink,
  joinState,
  startsInMs,
  statusOf,
} from '../../services/meetingsService.js';
import { countdown, fmtDate, fmtDuration, fmtTime, tzLabel } from '../../utils/time.js';

const SOON_MS = 10 * 60 * 1000;

export function statusLabel(meeting, now) {
  const status = statusOf(meeting, now);
  if (status === 'cancelled') return { text: 'Cancelled', tone: 'off' };
  if (status === 'completed') return { text: 'Completed', tone: 'quiet' };
  if (status === 'live') return { text: 'Live now', tone: 'hot' };
  const ms = startsInMs(meeting, now);
  if (ms <= SOON_MS) return { text: 'Starting soon', tone: 'hot' };
  return { text: `Starts ${countdown(ms)}`, tone: 'plain' };
}

/** Copy button that briefly confirms. */
export function CopyButton({ text, label, icon: Icon = Copy, className = 'mbtn' }) {
  const [done, setDone] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }
  return (
    <button type="button" className={className} onClick={copy}>
      {done ? <Check size={14} aria-hidden="true" /> : <Icon size={14} aria-hidden="true" />}
      {done ? 'Copied' : label}
    </button>
  );
}

export function MeetingCard({ meeting, user, tz, now, actions, compact = false }) {
  const label = statusLabel(meeting, now);
  const status = statusOf(meeting, now);
  const upcoming = status === 'scheduled' || status === 'live';
  const host = hostsMeeting(meeting, user);
  const join = joinState(meeting, now);

  return (
    <article className={`mcard${compact ? ' compact' : ''} ${label.tone}`}>
      <header>
        <h3>
          {meeting.passcode && <Lock size={13} aria-label="Passcode required" />}
          {meeting.title}
        </h3>
        <span className={`mstatus ${label.tone}`}>{label.text}</span>
      </header>

      <ul className="mmeta">
        <li>
          <CalendarDays size={14} aria-hidden="true" />
          {fmtDate(meeting.scheduledStartUtc, tz)}
        </li>
        <li>
          <Clock size={14} aria-hidden="true" />
          {fmtTime(meeting.scheduledStartUtc, tz)} {tzLabel(meeting.scheduledStartUtc, tz)} ·{' '}
          {fmtDuration(meeting.durationMinutes)}
        </li>
        <li>
          <User size={14} aria-hidden="true" />
          {host ? 'You are hosting' : `Host: ${meeting.hostName}`}
        </li>
        {meeting.invited.length > 0 && (
          <li>
            <Users size={14} aria-hidden="true" />
            {meeting.invited.length} invited
          </li>
        )}
      </ul>

      <footer>
        {upcoming && (
          <button
            type="button"
            className="mbtn primary"
            disabled={!join.ok}
            title={join.ok ? undefined : join.reason}
            onClick={() => actions.join(meeting)}
          >
            <Video size={14} aria-hidden="true" />
            Join
          </button>
        )}
        {upcoming && <CopyButton text={inviteLink(meeting)} label="Copy link" icon={Link2} />}
        <button type="button" className="mbtn" onClick={() => actions.details(meeting)}>
          Details
        </button>
        {upcoming && host && (
          <>
            <button type="button" className="mbtn icon" onClick={() => actions.edit(meeting)} aria-label="Edit meeting" title="Edit meeting">
              <Pencil size={14} />
            </button>
            <button
              type="button"
              className="mbtn icon danger"
              onClick={() => actions.cancel(meeting)}
              aria-label="Cancel meeting"
              title="Cancel meeting"
            >
              <Trash2 size={14} />
            </button>
          </>
        )}
      </footer>
    </article>
  );
}

export function MeetingDetails({ meeting, user, tz, now, actions, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const label = statusLabel(meeting, now);
  const status = statusOf(meeting, now);
  const upcoming = status === 'scheduled' || status === 'live';
  const host = hostsMeeting(meeting, user);
  const join = joinState(meeting, now);
  const otherZone = meeting.timezone !== tz;

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal details" role="dialog" aria-modal="true" aria-label="Meeting details" onMouseDown={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <div>
            <span className={`mstatus ${label.tone}`}>{label.text}</span>
            <h2>{meeting.title}</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        {meeting.description && <p className="details-desc">{meeting.description}</p>}

        <dl className="details-grid">
          <div>
            <dt>When</dt>
            <dd>
              {fmtDate(meeting.scheduledStartUtc, tz)}, {fmtTime(meeting.scheduledStartUtc, tz)}{' '}
              {tzLabel(meeting.scheduledStartUtc, tz)}
              {otherZone && (
                <small>
                  Scheduled as {fmtTime(meeting.scheduledStartUtc, meeting.timezone)} in{' '}
                  {meeting.timezone.replace(/_/g, ' ')}
                </small>
              )}
            </dd>
          </div>
          <div>
            <dt>Duration</dt>
            <dd>{fmtDuration(meeting.durationMinutes)}</dd>
          </div>
          <div>
            <dt>Host</dt>
            <dd>{host ? `${meeting.hostName} (you)` : meeting.hostName}</dd>
          </div>
          <div>
            <dt>Meeting ID</dt>
            <dd className="mono">{meeting.id}</dd>
          </div>
          <div>
            <dt>Access</dt>
            <dd>
              {meeting.passcode ? 'Passcode required' : 'Anyone with the link'}
              {meeting.passcode && host && <small>Passcode: {meeting.passcode}</small>}
            </dd>
          </div>
          <div>
            <dt>Invited</dt>
            <dd>{meeting.invited.length ? meeting.invited.join(', ') : 'Nobody yet'}</dd>
          </div>
        </dl>

        {upcoming && (
          <div className="invite-box">
            <div className="invite-link">
              <Link2 size={14} aria-hidden="true" />
              <span>{inviteLink(meeting)}</span>
            </div>
            <pre>{invitationText(meeting, tz)}</pre>
            <p className="help">
              Prototype: meetings are saved in this browser only, so this link opens the meeting only on this device.
            </p>
          </div>
        )}

        <footer className="sched-actions">
          {upcoming && host && (
            <>
              <button type="button" className="mbtn danger" onClick={() => actions.cancel(meeting)}>
                <Trash2 size={14} aria-hidden="true" />
                Cancel meeting
              </button>
              <button type="button" className="mbtn" onClick={() => actions.edit(meeting)}>
                <Pencil size={14} aria-hidden="true" />
                Edit
              </button>
            </>
          )}
          <span className="spacer" />
          {upcoming && <CopyButton text={invitationText(meeting, tz)} label="Copy invitation" />}
          {upcoming && (
            <button
              type="button"
              className="mbtn primary"
              disabled={!join.ok}
              title={join.ok ? undefined : join.reason}
              onClick={() => actions.join(meeting)}
            >
              <Video size={14} aria-hidden="true" />
              Join
            </button>
          )}
        </footer>
        {upcoming && !join.ok && <p className="help right">{join.reason}</p>}
      </div>
    </div>
  );
}
