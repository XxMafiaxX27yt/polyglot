import { useState } from 'react';
import { Lock, LockOpen, Mic, MicOff, MonitorUp, ShieldCheck, UserMinus, VideoOff } from 'lucide-react';

/**
 * Host Controls: participant management, meeting security, meeting management.
 *
 * Every action here is a REQUEST. In a live call the backend must check the
 * caller's role before acting — hiding this panel is not a permission check.
 */
export default function HostPanel({ me, remotes, people, sharing, locked, shareRestricted, actions }) {
  const [confirmRemove, setConfirmRemove] = useState(null);

  return (
    <div className="host">
      <section>
        <h3>Participants</h3>
        <ul className="host-people">
          <li>
            <span className="p-avatar me">{me.initials}</span>
            <div className="host-who">
              <strong>
                {me.name} (You) <em className="role">Host</em>
              </strong>
              <span>{sharing ? 'Presenting their screen' : 'Not presenting'}</span>
            </div>
            {sharing && (
              <button className="host-btn" onClick={actions.stopShare}>
                <MonitorUp size={14} aria-hidden="true" />
                Stop share
              </button>
            )}
          </li>

          {remotes.map((p) => {
            const s = people[p.id];
            return (
              <li key={p.id}>
                <span className="p-avatar">{p.initials}</span>
                <div className="host-who">
                  <strong>
                    {p.name} {s.coHost && <em className="role">Co-host</em>}
                  </strong>
                  <span className="host-status">
                    {s.muted ? <MicOff size={13} className="bad" /> : <Mic size={13} />}
                    {s.muted ? 'Muted by host' : 'Mic on'}
                    <VideoOff size={13} />
                    Camera off
                  </span>
                </div>
                <div className="host-actions">
                  <button className="host-btn" onClick={() => actions.setMuted(p.id, !s.muted)}>
                    {s.muted ? 'Ask to unmute' : 'Mute'}
                  </button>
                  <button className="host-btn" onClick={() => actions.setCoHost(p.id, !s.coHost)}>
                    {s.coHost ? 'Remove co-host' : 'Make co-host'}
                  </button>
                  {confirmRemove === p.id ? (
                    <button
                      className="host-btn danger solid"
                      onClick={() => {
                        setConfirmRemove(null);
                        actions.remove(p.id);
                      }}
                    >
                      Confirm remove
                    </button>
                  ) : (
                    <button className="host-btn danger" onClick={() => setConfirmRemove(p.id)}>
                      <UserMinus size={14} aria-hidden="true" />
                      Remove
                    </button>
                  )}
                </div>
              </li>
            );
          })}
          {remotes.length === 0 && <li className="host-empty">No other participants in the meeting.</li>}
        </ul>
      </section>

      <section>
        <h3>Meeting security</h3>
        <div className="host-row">
          <div>
            <strong>
              {locked ? <Lock size={14} aria-hidden="true" /> : <LockOpen size={14} aria-hidden="true" />}
              {locked ? 'Meeting locked' : 'Meeting open'}
            </strong>
            <span>
              {locked
                ? 'Nobody new can join until you unlock it.'
                : 'Anyone with the room code can join.'}
            </span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={locked}
            aria-label="Lock meeting"
            className={`switch${locked ? ' on' : ''}`}
            onClick={() => actions.setLocked(!locked)}
          >
            <i />
          </button>
        </div>
        <div className="host-row">
          <div>
            <strong>
              <MonitorUp size={14} aria-hidden="true" />
              {shareRestricted ? 'Only hosts can share' : 'Everyone can share'}
            </strong>
            <span>Restrict screen sharing to the host and co-hosts.</span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={shareRestricted}
            aria-label="Restrict screen sharing"
            className={`switch${shareRestricted ? ' on' : ''}`}
            onClick={() => actions.setShareRestricted(!shareRestricted)}
          >
            <i />
          </button>
        </div>
        <p className="host-fine">
          Waiting room is not available yet — it needs the backend. To deal with an unauthorised participant, remove
          them above and lock the meeting.
        </p>
      </section>

      <section>
        <h3>Meeting</h3>
        <button className="host-end" onClick={actions.endForAll}>
          End meeting for everyone
        </button>
        <p className="host-fine">Participants can always leave on their own with the Leave button.</p>
      </section>

      <p className="host-demo">
        <ShieldCheck size={14} aria-hidden="true" />
        Demo: these actions apply to the simulated participants in this browser only. In a live call the server must
        authorise every one of them.
      </p>
    </div>
  );
}
