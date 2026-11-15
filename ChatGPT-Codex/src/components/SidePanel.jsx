import { useEffect, useRef } from 'react';
import { ArrowRight, Ban, Flag, Mic, MicOff, MonitorUp, X } from 'lucide-react';
import HostPanel from './HostPanel.jsx';
import { getLanguage } from '../data/languages.js';

const seconds = (ms) => `${(ms / 1000).toFixed(2)}s`;

function Transcript({ entries, names, latencyLabel }) {
  const endRef = useRef(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [entries.length]);

  if (entries.length === 0) {
    return <p className="panel-empty">The transcript appears here as people speak.</p>;
  }
  return (
    <ol className="transcript">
      {entries.map((e) => (
        <li key={e.id}>
          <div className="t-head">
            <strong>{names[e.speakerId] ?? 'Unknown'}</strong>
            <span className="t-langs">
              {e.mixed ?? getLanguage(e.sourceLang).name}
              {e.translated && (
                <>
                  <ArrowRight size={11} aria-hidden="true" />
                  {getLanguage(e.targetLang).name}
                </>
              )}
            </span>
            {e.translated && <span className="t-latency">{Number.isFinite(e.latencyMs) ? seconds(e.latencyMs) : '—'} · {latencyLabel}</span>}
          </div>
          {e.translated ? (
            <>
              <p className="t-translated" lang={e.targetLang}>
                {e.translated}
              </p>
              <p className="t-original" lang={e.sourceLang}>
                {e.original}
              </p>
            </>
          ) : (
            <p className="t-translated" lang={e.sourceLang}>
              {e.original}
            </p>
          )}
        </li>
      ))}
      <div ref={endRef} />
    </ol>
  );
}

function People({ me, listenLang, remotes, people, detected, micOn, sharing, isHost, liveMode, onReport, onBlock }) {
  return (
    <>
    <ul className="people">
      <li>
        <span className="p-avatar me">{me.initials}</span>
        <div>
          <strong>
            {me.name} (You) {isHost && <em className="role">Host (demo)</em>}
          </strong>
          <span>
            Hears {getLanguage(listenLang).name}
            {sharing && ' · Presenting'}
          </span>
        </div>
        <span className="p-icons">
          {sharing && <MonitorUp size={15} className="accent" aria-label="Presenting" />}
          {micOn ? <Mic size={15} aria-label="Mic on" /> : <MicOff size={15} className="bad" aria-label="Muted" />}
        </span>
      </li>
      {remotes.map((p) => {
        const d = detected[p.id];
        const s = people[p.id] ?? {};
        return (
          <li key={p.id}>
            <span className="p-avatar">{p.initials}</span>
            <div>
              <strong>
                {p.name} {s.coHost && <em className="role">Co-host</em>}
              </strong>
              <span>{d ? `Speaking ${d.mixed ?? getLanguage(d.lang).name} · auto-detected` : 'Language not detected yet'}</span>
            </div>
            <span className="p-icons">
              {liveMode ? <Mic size={15} aria-label="Microphone status unavailable" /> : s.muted ? <MicOff size={15} className="bad" aria-label="Muted" /> : <Mic size={15} aria-label="Mic on" />}
              <button className="icon-btn sm" onClick={() => onReport(p)} aria-label={`Report ${p.name}`} title="Report">
                <Flag size={15} />
              </button>
              <button className="icon-btn sm" onClick={() => onBlock(p)} aria-label={`Block ${p.name}`} title="Block">
                <Ban size={15} />
              </button>
            </span>
          </li>
        );
      })}
    </ul>
    <div className="people-safety">
      <button className="host-btn" onClick={() => onReport(null)}>
        <Flag size={14} aria-hidden="true" />
        Report inappropriate behaviour
      </button>
      <p className="host-fine">
        Reports are private. <a href="#/legal/community">Community Guidelines</a>
      </p>
    </div>
    </>
  );
}

export default function SidePanel({
  tab,
  onTab,
  onClose,
  entries,
  me,
  listenLang,
  remotes,
  allParticipants,
  people,
  detected,
  micOn,
  sharing,
  isHost,
  locked,
  shareRestricted,
  hostActions,
  onReport,
  onBlock,
  liveMode = false,
  latencyLabel = 'simulated',
}) {
  const names = Object.fromEntries(allParticipants.map((p) => [p.id, p.name]));
  const tabs = [
    ['transcript', 'Transcript'],
    ['people', `People · ${remotes.length + 1}`],
    ['host', 'Host'],
  ];

  return (
    <aside className="panel">
      <header className="panel-head">
        <div className="tabs" role="tablist">
          {tabs.map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => onTab(id)}>
              {label}
            </button>
          ))}
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close panel">
          <X size={18} />
        </button>
      </header>
      <div className="panel-body">
        {tab === 'transcript' && <Transcript entries={entries} names={names} latencyLabel={latencyLabel} />}
        {tab === 'people' && (
          <People
            me={me}
            isHost={isHost}
            liveMode={liveMode}
            listenLang={listenLang}
            remotes={remotes}
            people={people}
            detected={detected}
            micOn={micOn}
            sharing={sharing}
            onReport={onReport}
            onBlock={onBlock}
          />
        )}
        {tab === 'host' && !isHost && <p className="panel-empty">Live host controls are unavailable: this backend has no host roles, mute, removal or lock commands. The controls can be explored in demo mode.</p>}
        {tab === 'host' && isHost && (
          <HostPanel me={me} remotes={remotes} people={people} sharing={sharing} locked={locked} shareRestricted={shareRestricted} actions={hostActions} />
        )}
      </div>
    </aside>
  );
}


