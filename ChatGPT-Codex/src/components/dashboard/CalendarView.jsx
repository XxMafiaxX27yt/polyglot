import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { statusOf } from '../../services/meetingsService.js';
import { addDays, dayKey, fmtKey, fmtTime, keyToDate } from '../../utils/time.js';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const startOfWeek = (key) => addDays(key, -keyToDate(key).getUTCDay());
const startOfMonth = (key) => `${key.slice(0, 8)}01`;

function shiftMonth(key, n) {
  const d = keyToDate(startOfMonth(key));
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
}

/** Month / week / day calendar of scheduled meetings, in the viewer's time zone. */
export default function CalendarView({ meetings, tz, now, onOpen }) {
  const today = dayKey(new Date(now).toISOString(), tz);
  const [view, setView] = useState('month');
  const [selected, setSelected] = useState(today);

  const byDay = useMemo(() => {
    const map = {};
    for (const m of meetings) {
      if (statusOf(m, now) === 'cancelled') continue;
      (map[dayKey(m.scheduledStartUtc, tz)] ??= []).push(m);
    }
    Object.values(map).forEach((list) => list.sort((a, b) => a.scheduledStartUtc.localeCompare(b.scheduledStartUtc)));
    return map;
  }, [meetings, tz, now]);

  const move = (dir) =>
    setSelected((key) => (view === 'month' ? shiftMonth(key, dir) : addDays(key, view === 'week' ? 7 * dir : dir)));

  const title =
    view === 'month'
      ? fmtKey(selected, { month: 'long', year: 'numeric' })
      : view === 'week'
        ? `Week of ${fmtKey(startOfWeek(selected), { day: 'numeric', month: 'short', year: 'numeric' })}`
        : fmtKey(selected, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const monthStart = startOfMonth(selected);
  const gridStart = startOfWeek(monthStart);
  const monthCells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const weekCells = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(selected), i));

  const entry = (m) => (
    <button key={m.id} type="button" className="cal-entry" onClick={() => onOpen(m)}>
      <b>{fmtTime(m.scheduledStartUtc, tz)}</b>
      <span>{m.title}</span>
    </button>
  );

  return (
    <div className="cal">
      <header className="cal-head">
        <div className="cal-nav">
          <button type="button" className="icon-btn" onClick={() => move(-1)} aria-label="Previous">
            <ChevronLeft size={18} />
          </button>
          <strong>{title}</strong>
          <button type="button" className="icon-btn" onClick={() => move(1)} aria-label="Next">
            <ChevronRight size={18} />
          </button>
          <button type="button" className="mbtn" onClick={() => setSelected(today)}>
            Today
          </button>
        </div>
        <div className="tabs" role="tablist" aria-label="Calendar view">
          {['day', 'week', 'month'].map((v) => (
            <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)}>
              {v[0].toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </header>

      {view === 'month' && (
        <>
          <div className="cal-grid cal-weekdays" aria-hidden="true">
            {WEEKDAYS.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="cal-grid">
            {monthCells.map((key) => {
              const count = byDay[key]?.length ?? 0;
              const outside = key.slice(0, 7) !== selected.slice(0, 7);
              return (
                <button
                  key={key}
                  type="button"
                  className={`cal-day${outside ? ' outside' : ''}${key === today ? ' today' : ''}${key === selected ? ' selected' : ''}`}
                  onClick={() => setSelected(key)}
                  aria-label={`${fmtKey(key, { day: 'numeric', month: 'long' })}, ${count} meeting${count === 1 ? '' : 's'}`}
                  aria-pressed={key === selected}
                >
                  <span>{Number(key.slice(8))}</span>
                  {count > 0 && <i className="cal-dot">{count > 1 ? count : ''}</i>}
                </button>
              );
            })}
          </div>
        </>
      )}

      {view === 'week' && (
        <div className="cal-week">
          {weekCells.map((key) => (
            <div key={key} className={`cal-col${key === today ? ' today' : ''}${key === selected ? ' selected' : ''}`}>
              <button type="button" className="cal-col-head" onClick={() => setSelected(key)}>
                <span>{WEEKDAYS[keyToDate(key).getUTCDay()]}</span>
                <b>{Number(key.slice(8))}</b>
              </button>
              {(byDay[key] ?? []).map(entry)}
            </div>
          ))}
        </div>
      )}

      {view !== 'week' && (
        <section className="cal-list">
          {view === 'month' && <h4>{fmtKey(selected, { weekday: 'long', day: 'numeric', month: 'long' })}</h4>}
          {(byDay[selected] ?? []).length ? (
            byDay[selected].map(entry)
          ) : (
            <p className="dash-empty small">No meetings on this day.</p>
          )}
        </section>
      )}
    </div>
  );
}
