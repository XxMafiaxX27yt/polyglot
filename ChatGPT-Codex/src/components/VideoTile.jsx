import { useEffect, useRef } from 'react';
import { Headphones, MicOff } from 'lucide-react';

export default function VideoTile({
  name,
  initials,
  avatar = null, // profile picture shown when the camera is off
  hue = 24,
  stream = null,
  showVideo = false,
  micOn = true,
  speaking = false,
  isLocal = false,
  role = null, // "Host" | "Co-host"
  speakLabel = null, // e.g. "Japanese · auto-detected"
  hearLabel = null, // e.g. "English"
}) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && videoRef.current.srcObject !== stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, showVideo]);

  return (
    <div className={`tile${speaking ? ' speaking' : ''}`}>
      {showVideo && stream ? (
        <video ref={videoRef} className={isLocal ? 'mirrored' : ''} autoPlay playsInline muted={isLocal} />
      ) : (
        <div className="tile-avatar-wrap" style={{ '--hue': hue }}>
          <div className="tile-avatar">{avatar ? <img src={avatar} alt="" /> : initials}</div>
        </div>
      )}

      <div className="tile-top">
        {speakLabel && <span className="chip chip-dark">{speakLabel}</span>}
        {hearLabel && (
          <span className="chip chip-orange">
            <Headphones size={12} aria-hidden="true" />
            {hearLabel}
          </span>
        )}
      </div>

      <div className="tile-bottom">
        <span className="tile-name">
          {speaking && (
            <span className="wave" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
          )}
          {!micOn && <MicOff size={13} className="tile-muted" aria-label="Muted" />}
          {name}
          {isLocal && <em> (You)</em>}
          {role && <em className="role">{role}</em>}
        </span>
      </div>
    </div>
  );
}
