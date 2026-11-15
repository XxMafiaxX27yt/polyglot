import { useEffect, useRef, useState } from 'react';
import { AudioLines, Bot, Check, Cpu, Orbit, Play, Search, Sparkles, WandSparkles } from 'lucide-react';
import { VOICE_MODES } from '../data/voiceModes.js';

const ICONS = { normal: AudioLines, jarvis: Cpu, mystery: Search, robot: Bot, wizard: WandSparkles, cosmic: Orbit };

const ms = (v) => (v == null ? '—' : `${Math.round(v)} ms`);

/** Voice Effects button + compact popup for the meeting control bar. */
export default function VoiceEffects({ enabled, onEnabled, mode, onMode, unlocked, stats, notice, onPreview }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => !rootRef.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const modes = VOICE_MODES.filter((m) => !m.secret || unlocked);
  const active = enabled && mode !== 'normal';
  const extra = stats.normal != null && stats.selected != null ? stats.selected - stats.normal : null;

  return (
    <div className="voicefx" ref={rootRef}>
      <button
        type="button"
        className={`cbtn${active ? ' on' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Voice effects"
        {...(!open && { 'data-tip': 'Voice effects' })}
      >
        <Sparkles size={20} />
      </button>

      {open && (
        <div className="voicefx-pop" role="dialog" aria-label="Voice effects">
          <header>
            <div>
              <strong>Voice effects</strong>
              <span>Only changes what you hear.</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              aria-label="Enable voice effects"
              className={`switch${enabled ? ' on' : ''}`}
              onClick={() => onEnabled(!enabled)}
            >
              <i />
            </button>
          </header>

          <div className={`voicefx-list${enabled ? '' : ' off'}`} role="radiogroup" aria-label="Voice mode">
            {modes.map((m) => {
              const Icon = ICONS[m.id] ?? AudioLines;
              const selected = m.id === mode;
              return (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={!enabled}
                  className={`voicefx-item${selected ? ' selected' : ''}`}
                  onClick={() => onMode(m.id)}
                >
                  <Icon size={18} aria-hidden="true" />
                  <span>
                    <b>{m.label}</b>
                    <small>{m.desc}</small>
                  </span>
                  {selected && <Check size={16} aria-hidden="true" />}
                </button>
              );
            })}
          </div>

          <footer>
            <button type="button" className="voicefx-preview" onClick={onPreview}>
              <Play size={14} aria-hidden="true" />
              Preview
            </button>
            <dl>
              <div>
                <dt>Speech start</dt>
                <dd>{ms(stats.selected)}</dd>
              </div>
              <div>
                <dt>Added by effect</dt>
                <dd>{extra == null ? '—' : `${extra >= 0 ? '+' : ''}${Math.round(extra)} ms`}</dd>
              </div>
            </dl>
          </footer>
          <p className="voicefx-note">
            {notice ||
              'Demo: styles adjust the pitch and speed of your browser voice. Speech-start times are measured on this device.'}
          </p>
        </div>
      )}
    </div>
  );
}
