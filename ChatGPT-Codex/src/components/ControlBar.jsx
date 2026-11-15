import {
  Captions,
  CaptionsOff,
  Check,
  Copy,
  Globe,
  Languages,
  MessageSquareText,
  Mic,
  MicOff,
  Maximize,
  Minimize,
  MonitorUp,
  MonitorX,
  PhoneOff,
  ShieldCheck,
  Users,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
} from 'lucide-react';

/** Icon-only control with a tooltip. */
function Btn({ icon, tip, onClick, variant = '', pressed, disabled, badge }) {
  return (
    <button
      type="button"
      className={`cbtn ${variant}`}
      onClick={onClick}
      aria-pressed={pressed}
      aria-label={tip}
      data-tip={tip}
      disabled={disabled}
    >
      {icon}
      {badge != null && <span className="cbtn-badge">{badge}</span>}
    </button>
  );
}

export default function ControlBar({
  media,
  lang,
  room,
  elapsed,
  copied,
  onCopyRoom,
  translateOn,
  onToggleTranslate,
  captionsOn,
  onToggleCaptions,
  volume,
  onVolume,
  panel,
  onPanel,
  peopleCount,
  onOpenLanguages,
  onLeave,
  voiceControl,
  isHost,
  share,
  onToggleMute,
  fullscreen,
  onToggleFullscreen,
  liveMode = false,
}) {
  return (
    <footer className="controls">
      <div className="controls-info">
        <span className="controls-time">{elapsed}</span>
        <i className="controls-sep" />
        <button type="button" className="controls-room" onClick={onCopyRoom} data-tip="Copy room code">
          {copied ? 'Copied' : room}
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>

      <div className="controls-center">
        <Btn
          icon={media.micOn ? <Mic size={20} /> : <MicOff size={20} />}
          tip={!media.hasMic ? 'No microphone available' : media.micOn ? 'Mute microphone' : 'Unmute microphone'}
          variant={media.micOn ? '' : 'muted'}
          pressed={!media.micOn}
          disabled={!media.hasMic}
          onClick={media.toggleMic}
        />
        <Btn
          icon={media.camOn ? <Video size={20} /> : <VideoOff size={20} />}
          tip={!media.hasCam ? 'No camera available' : media.camOn ? 'Turn camera off' : 'Turn camera on'}
          variant={media.camOn ? '' : 'muted'}
          pressed={!media.camOn}
          disabled={!media.hasCam}
          onClick={media.toggleCam}
        />
        <Btn
          icon={share.sharing ? <MonitorX size={20} /> : <MonitorUp size={20} />}
          tip={!share.supported ? 'Screen sharing is not supported in this browser' : share.sharing ? 'Stop sharing' : 'Preview screen locally'}
          variant={share.sharing ? 'on' : ''}
          pressed={share.sharing}
          disabled={!share.supported}
          onClick={share.sharing ? share.stop : share.start}
        />

        <i className="controls-sep" />

        <button type="button" className="lang-pill" onClick={onOpenLanguages} data-tip="Change speaking and listening language" aria-label="Change speaking and listening language">
          <Globe size={18} aria-hidden="true" />
          <span className="lang-pill-text">
            <small>I hear</small>
            <b lang={lang.code}>{lang.name}</b>
          </span>
        </button>
        <Btn
          icon={<Languages size={20} />}
          tip={translateOn ? (liveMode ? 'Translation on — show original captions and mute audio' : 'Translation on — switch to original audio') : 'Translation off — switch to translated audio'}
          variant={translateOn ? 'on' : ''}
          pressed={translateOn}
          onClick={onToggleTranslate}
        />
        <Btn
          icon={captionsOn ? <Captions size={20} /> : <CaptionsOff size={20} />}
          tip={captionsOn ? 'Hide captions' : 'Show captions'}
          variant={captionsOn ? 'on' : ''}
          pressed={captionsOn}
          onClick={onToggleCaptions}
        />
        {voiceControl}
        <div className="volume">
          <button
            type="button"
            className="volume-mute"
            onClick={onToggleMute}
            aria-pressed={volume === 0}
            aria-label={volume > 0 ? 'Mute call audio' : 'Unmute call audio'}
            data-tip={volume > 0 ? 'Mute call audio' : 'Unmute call audio'}
          >
            {volume > 0 ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={(e) => onVolume(Number(e.target.value))}
            aria-label="Call volume"
            style={{ '--fill': `${volume * 100}%` }}
          />
        </div>

        <i className="controls-sep" />

        <button type="button" className="leave-btn" onClick={onLeave}>
          <PhoneOff size={18} aria-hidden="true" />
          Leave
        </button>
      </div>

      <div className="controls-side">
        {onToggleFullscreen && (
          <Btn
            icon={fullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
            tip={fullscreen ? 'Exit full screen' : 'Full screen'}
            pressed={fullscreen}
            onClick={onToggleFullscreen}
          />
        )}
        <Btn
          icon={<Users size={20} />}
          tip="People"
          variant={panel === 'people' ? 'on' : ''}
          pressed={panel === 'people'}
          badge={peopleCount}
          onClick={() => onPanel('people')}
        />
        {true && (
          <Btn
            icon={<ShieldCheck size={20} />}
            tip="Host controls"
            variant={panel === 'host' ? 'on' : ''}
            pressed={panel === 'host'}
            onClick={() => onPanel('host')}
          />
        )}
        <Btn
          icon={<MessageSquareText size={20} />}
          tip="Transcript"
          variant={panel === 'transcript' ? 'on' : ''}
          pressed={panel === 'transcript'}
          onClick={() => onPanel('transcript')}
        />
      </div>
    </footer>
  );
}

