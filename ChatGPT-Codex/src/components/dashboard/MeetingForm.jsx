import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { addDays, dateToKey, timeZones, utcToInputs, zonedToUtc } from '../../utils/time.js';

const DURATIONS = [15, 30, 45, 60, 90, 120, 180];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const parseEmails = (text) =>
  text
    .split(/[\s,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

/** Schedule a new meeting, or edit one when `meeting` is given. */
export default function MeetingForm({ meeting, user, defaultTz, onSubmit, onClose }) {
  const editing = !!meeting;
  const initial = useMemo(() => {
    if (meeting) {
      const { date, time } = utcToInputs(meeting.scheduledStartUtc, meeting.timezone);
      return {
        title: meeting.title,
        description: meeting.description,
        date,
        time,
        timezone: meeting.timezone,
        duration: meeting.durationMinutes,
        invited: meeting.invited.join(', '),
        access: meeting.passcode ? 'passcode' : 'open',
        passcode: meeting.passcode ?? '',
      };
    }
    // Default: tomorrow at 10:00 in the user's own time zone.
    const today = utcToInputs(new Date().toISOString(), defaultTz).date;
    return {
      title: '',
      description: '',
      date: addDays(today, 1),
      time: '10:00',
      timezone: defaultTz,
      duration: 30,
      invited: '',
      access: 'open',
      passcode: '',
    };
  }, [meeting, defaultTz]);

  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const zones = useMemo(() => timeZones(form.timezone), [form.timezone]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function submit(e) {
    e.preventDefault();
    const found = {};
    const emails = parseEmails(form.invited);
    const badEmail = emails.find((x) => !EMAIL.test(x));
    let start = null;

    if (!form.title.trim()) found.title = 'Give the meeting a title.';
    if (!form.date) found.date = 'Pick a date.';
    if (!form.time) found.time = 'Pick a start time.';
    if (form.date && form.time) {
      start = zonedToUtc(form.date, form.time, form.timezone);
      if (Number.isNaN(start.getTime())) found.date = 'That date is not valid.';
      else if (start.getTime() <= Date.now()) found.time = 'That time has already passed. Pick a future time.';
    }
    if (badEmail) found.invited = `"${badEmail}" is not a valid email address.`;
    if (form.access === 'passcode' && form.passcode.trim().length < 4) found.passcode = 'Use at least 4 characters.';

    setErrors(found);
    if (Object.keys(found).length) return;

    const error = onSubmit({
      title: form.title,
      description: form.description,
      scheduledStartUtc: start.toISOString(), // always stored in UTC
      timezone: form.timezone,
      durationMinutes: Number(form.duration),
      invited: [...new Set(emails)],
      passcode: form.access === 'passcode' ? form.passcode.trim() : null,
    });
    if (error) setErrors({ form: error });
  }

  const today = dateToKey(new Date(Date.now() - 86400000)); // loose floor; exact check is on submit

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <form
        className="modal sched"
        role="dialog"
        aria-modal="true"
        aria-label={editing ? 'Edit meeting' : 'Schedule meeting'}
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={submit}
        noValidate
      >
        <header className="modal-head">
          <div>
            <h2>{editing ? 'Edit meeting' : 'Schedule a meeting'}</h2>
            <p>No call is opened now — the room is created when people join.</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <div className="sched-body">
          <label className="field">
            <span>Meeting title</span>
            <input
              value={form.title}
              onChange={(e) => set({ title: e.target.value })}
              placeholder="e.g. Weekly project sync"
              maxLength={80}
              autoFocus
            />
            {errors.title && <em className="err">{errors.title}</em>}
          </label>

          <label className="field">
            <span>Description (optional)</span>
            <textarea
              value={form.description}
              onChange={(e) => set({ description: e.target.value })}
              rows={2}
              maxLength={400}
              placeholder="What is this meeting about?"
            />
          </label>

          <div className="sched-grid">
            <label className="field">
              <span>Date</span>
              <input type="date" min={today} value={form.date} onChange={(e) => set({ date: e.target.value })} />
              {errors.date && <em className="err">{errors.date}</em>}
            </label>
            <label className="field">
              <span>Start time</span>
              <input type="time" value={form.time} onChange={(e) => set({ time: e.target.value })} />
              {errors.time && <em className="err">{errors.time}</em>}
            </label>
            <label className="field">
              <span>Duration</span>
              <select value={form.duration} onChange={(e) => set({ duration: e.target.value })}>
                {DURATIONS.map((d) => (
                  <option key={d} value={d}>
                    {d < 60 ? `${d} minutes` : `${d / 60} hour${d > 60 ? 's' : ''}`}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="sched-grid two">
            <label className="field">
              <span>Time zone</span>
              <select value={form.timezone} onChange={(e) => set({ timezone: e.target.value })}>
                {zones.map((z) => (
                  <option key={z} value={z}>
                    {z.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Host</span>
              <input value={`${user.name} (you)`} readOnly />
            </label>
          </div>

          <label className="field">
            <span>Invite participants (optional)</span>
            <textarea
              value={form.invited}
              onChange={(e) => set({ invited: e.target.value })}
              rows={2}
              placeholder="Email addresses, separated by commas"
            />
            {errors.invited ? (
              <em className="err">{errors.invited}</em>
            ) : (
              <em className="help">No emails are sent. Copy the invitation and share it yourself.</em>
            )}
          </label>

          <div className="sched-grid two">
            <label className="field">
              <span>Access</span>
              <select value={form.access} onChange={(e) => set({ access: e.target.value })}>
                <option value="open">Anyone with the link</option>
                <option value="passcode">Passcode required</option>
              </select>
            </label>
            {form.access === 'passcode' && (
              <label className="field">
                <span>Meeting passcode</span>
                <input
                  value={form.passcode}
                  onChange={(e) => set({ passcode: e.target.value })}
                  maxLength={32}
                  autoComplete="off"
                />
                {errors.passcode && <em className="err">{errors.passcode}</em>}
              </label>
            )}
          </div>

          {errors.form && (
            <p className="notice" role="alert">
              {errors.form}
            </p>
          )}
        </div>

        <footer className="sched-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary">
            {editing ? 'Save changes' : 'Schedule meeting'}
          </button>
        </footer>
      </form>
    </div>
  );
}
