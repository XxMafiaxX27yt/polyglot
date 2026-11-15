# Current API integration status

`../CONTRACT.md` is authoritative. The friend's v2 notes described a separate scripted frontend; those proposed endpoints are not the contract used by this merged app.

| Feature | Current source |
| --- | --- |
| Mode/origin | `VITE_BACKEND_URL`; unset means labeled demo |
| Live room | Contract `/ws?room=...&user=...&name=...&lang=...` |
| Microphone | MediaRecorder audio_start / binary frames / audio_end |
| Participants/captions/WAV | Contract WebSocket events |
| Core status | `GET /health`, fake/real/unverified clearly distinguished |
| Evaluation | `GET /results`; optional existing public fallback |
| Authentication/profile | Local prototype only; guest entry bypasses login |
| Scheduling/calendar/passcodes | Per-browser prototype; not shared or enforced by Part B |
| Host mute/remove/lock | Demo only; unavailable for live rooms |
| Camera/screen | Local capture preview only; no remote video transport |
| Voice styles | Listener-side WAV effects; translated words unchanged |
| Safety/privacy requests | Not connected; `api.js` reports Not sent without calling proposed endpoints |

Do not set `VITE_API_URL` expecting Part B to implement the friend's proposed account, scheduling, LiveKit or privacy APIs. They require a separate agreed backend contract. Existing local settings and draft legal/privacy screens remain available, with their prototype status preserved.

The room language is also the speaker's ASR hint. Hinglish speakers choose Hindi. Remote microphone state and host roles are not present in the participants message; do not treat local UI state as server authorization.
