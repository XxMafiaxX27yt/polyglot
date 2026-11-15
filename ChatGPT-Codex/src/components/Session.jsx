import { useState } from 'react';
import Dashboard from './dashboard/Dashboard.jsx';
import Lobby from './Lobby.jsx';
import CallRoom from './CallRoom.jsx';
import CircleRevealLoader from './CircleRevealLoader.jsx';
import { useLocalMedia } from '../hooks/useLocalMedia.js';
import { loadPrefs } from '../utils/prefs.js';
const newRoomCode = () => `PLG-${Math.floor(1000 + Math.random() * 9000)}`;
const newUserId = () => globalThis.crypto?.randomUUID?.() ?? `u-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export default function Session({ user, joinToken, onUpdateUser, onSignOut, onResults }) {
  const [meeting, setMeeting] = useState(() => user.guest && (!joinToken || /^PLG-[A-Z0-9-]+$/i.test(joinToken)) ? { room: joinToken || newRoomCode(), lang: loadPrefs().lang } : null);
  if (!meeting) return <Dashboard user={user} joinToken={joinToken} onStart={setMeeting} onUpdateUser={onUpdateUser} onSignOut={onSignOut} onResults={onResults} />;
  return <MeetingFlow user={user} meeting={meeting} onExit={() => setMeeting(null)} onResults={onResults} />;
}
function MeetingFlow({ user, meeting, onExit, onResults }) {
  const [prefs] = useState(loadPrefs);
  const media = useLocalMedia({ micId: prefs.micId, camId: prefs.camId });
  const [inCall, setInCall] = useState(false);
  const [profile, setProfile] = useState(() => ({ id: newUserId(), name: user.name, avatar: user.avatar, room: meeting.room, title: meeting.title, lang: meeting.lang ?? prefs.lang }));
  return inCall ? <><CircleRevealLoader key="call" /><CallRoom profile={profile} media={media} onLeave={() => setInCall(false)} /></> : <><CircleRevealLoader key="lobby" /><Lobby profile={profile} onChange={(patch) => setProfile((p) => ({ ...p, ...patch }))} media={media} onJoin={() => setInCall(true)} onExit={onExit} onResults={onResults} /></>;
}
