# Host Controls & Screen Sharing

## Status — read this first

This repository is **frontend only**. It contains **no LiveKit integration, no
backend and no authentication system** (sign-in is a prototype that accepts any
email). So:

| Piece | State |
| --- | --- |
| Screen sharing: capture, presenter layout, stop, auto-stop, errors | **Works locally** in the sharer's own browser. Nobody else receives it until the track is published through LiveKit. |
| Host Controls panel, participant management, lock, end meeting | **UI works**, acting on the simulated demo participants in this browser. |
| Permission enforcement | **Not implemented.** It cannot be done in the frontend. See "Backend requirements". |
| Waiting room / admission | Not built. Needs the backend. |
| Chat, Settings buttons | Not added: there is no chat feature, and settings are the existing language, voice, captions and volume controls. |

Nothing below under "Backend requirements" exists yet. It is the contract to
agree with the backend developer before any shared API is changed.

## What is implemented

| Piece | Where |
| --- | --- |
| Screen capture hook | `src/hooks/useScreenShare.js` |
| Presenter layout + "Stop sharing" bar | `src/components/CallRoom.jsx`, `src/styles.css` |
| Host Controls panel | `src/components/HostPanel.jsx` |
| People list with mic / presenting / role status | `src/components/SidePanel.jsx` |
| Toolbar: Share screen, People, Host controls | `src/components/ControlBar.jsx` |
| Muted / removed participants stop speaking (demo) | `src/services/translationService.js` |

### Roles (frontend behaviour)

- **Host** — sees the Host Controls button and the Host tab. In demo mode the
  person who opens the room is always the host (`isHost` in `CallRoom.jsx`).
- **Co-host** — a badge the host can assign. In a live call a co-host should get
  the same panel as the host.
- **Participant** — own mic, own camera, screen share if permitted, listening
  language, voice effects, leave. No host panel.

### Screen sharing behaviour

- The browser's own picker offers entire screen, window or tab where supported.
- While sharing, the shared screen takes the main area; participant tiles move
  to a side strip (a bottom strip on narrow screens). The toolbar and the
  "is presenting / Stop sharing" bar sit outside the shared image, so nothing
  covers the content.
- Stops when: the user clicks Stop sharing (toolbar, share bar or Host panel),
  the user clicks the browser's own stop control, or the user leaves the call.
- Permission denied or picker cancelled → a notice appears, nothing is shared.
- Unsupported browser (most mobile browsers) → the button is disabled with an
  explanatory tooltip.
- Screen video is a separate track from translated audio, so starting a share
  does not touch the translation pipeline.

## Policies chosen

- **Simultaneous sharing: one presenter at a time.** A second person cannot
  start sharing while someone is presenting; they must wait, or the host stops
  the current share. This keeps the layout predictable and bandwidth low.
- **Remote unmute: not allowed.** The host can mute anyone, but can only *ask*
  someone to unmute. This matches LiveKit's default and avoids switching on
  someone's microphone without consent.
- **Host leaves:** if a co-host exists, the longest-standing co-host becomes
  host. Otherwise the longest-connected participant becomes host. If the host
  disconnects unexpectedly, wait 30 seconds for reconnection before transferring.
  The meeting ends only when the host chooses "End meeting for everyone" or the
  room is empty.
- **Presenter disconnects:** the share ends immediately and everyone returns to
  the normal grid.
- **Removed participant:** disconnected at once and cannot rejoin that meeting
  with the same identity.
- **Locked while someone is joining:** the join is refused if the token has not
  been issued yet; a participant already connected stays.

## Backend requirements (not built)

The frontend must never be the thing that decides who is a host.

### Tokens and roles

- The backend issues LiveKit access tokens. API key and secret stay on the server.
- The role lives server-side (e.g. in the meeting record and in participant
  metadata set by the server), **not** in anything the client sends.
- Participant tokens: `roomJoin`, `canPublish`, `canSubscribe`, and
  `canPublishSources` limited to what they may publish (microphone, camera,
  screen share if permitted). **No `roomAdmin`** for ordinary participants.
- The frontend reads its role from the server response / token metadata only to
  decide which buttons to show.

### Endpoints

Every endpoint authenticates the caller, loads their role for that room from the
server's own records, and rejects the request with `403` if it is not allowed.

| Endpoint | Who | Server action |
| --- | --- | --- |
| `POST /rooms/:id/token` | signed-in user | Refuse if room is locked or user was removed; else issue token |
| `POST /rooms/:id/participants/:pid/mute` | host, co-host | LiveKit `MutePublishedTrack` (mute only) |
| `POST /rooms/:id/participants/:pid/remove` | host, co-host (never on the host) | LiveKit `RemoveParticipant`, add to removed list |
| `POST /rooms/:id/participants/:pid/cohost` | host only | Update role record + `UpdateParticipant` metadata |
| `POST /rooms/:id/participants/:pid/stop-share` | host, co-host | Mute/unpublish their screen-share track, or revoke `canPublishSources` screen share via `UpdateParticipant` |
| `POST /rooms/:id/lock` | host, co-host | Set `locked` flag; token endpoint refuses new joins |
| `POST /rooms/:id/share/request` | any permitted participant | Grant only if nobody is presenting (one-presenter policy) |
| `POST /rooms/:id/end` | host only | LiveKit `DeleteRoom` |

### Rules to test on the server

- A participant cannot remove the host, end the meeting, change anyone's
  permissions, or unlock a locked meeting.
- Calling any endpoint above directly without the right role returns `403`.
- Only host and co-host can mute or remove others.
- Host transfer follows the policy above when the host leaves or drops.

### Frontend hand-off points

- `hostActions` in `CallRoom.jsx` — replace each local state change with a call
  to the matching endpoint, then update UI from LiveKit room events
  (participant connected/disconnected, track muted, metadata changed).
- `useScreenShare.js` — publish the captured track as a LiveKit screen-share
  track, and render remote screen-share tracks in the same `share-view`.
- `VideoTile` already takes a `stream` prop for remote camera tracks.

## LiveKit plan and infrastructure — things to confirm

I have not verified current LiveKit Cloud pricing or quotas, so check these on
LiveKit's pricing page rather than relying on this list:

- Free-tier limits on monthly participant minutes, bandwidth and concurrent
  participants — screen sharing uses noticeably more bandwidth than camera video.
- Whether the plan allows the number of rooms and participants needed for the demo.
- A server (even a small one) is required to hold the API secret, issue tokens
  and call the privileged room APIs. This cannot be done from the browser.
- Screen sharing needs HTTPS (or `localhost`) and is unavailable on most mobile
  browsers.
- A waiting room needs extra server state: issue a join token only after the
  host admits the person.

No paid service has been added.

## Testing

Run `npm.cmd run dev`, open http://localhost:5173 in Chrome or Edge, sign in and join.

**Screen sharing**
1. Click **Share screen** in the toolbar and pick a screen, window or tab. The
   shared content fills the main area; participants move to a side strip.
2. Click **Stop sharing** in the bar above the shared content → normal grid returns.
3. Share again and stop with the **browser's own** "Stop sharing" control → the
   app returns to the grid on its own.
4. Click **Share screen**, then cancel the picker → a notice says nothing is
   being shared.
5. Narrow the window → participants move to a strip under the shared screen.
6. While sharing, confirm captions and translated audio keep going.

**Host controls**
1. Click the shield **Host controls** button → the Host tab opens.
2. **Mute** a participant → their tile shows a muted mic and they stop speaking
   in the demo. **Ask to unmute** brings them back.
3. **Make co-host** → a Co-host badge appears on their tile and in People.
4. **Remove** → **Confirm remove** → their tile disappears and the count drops.
5. Toggle **Lock meeting** → a lock icon appears next to the meeting name.
6. **End meeting for everyone** → confirmation dialog → Cancel keeps the call;
   End returns to the lobby.

**Not testable yet** (needs the backend): every permission-enforcement rule,
remote participants seeing a share, the one-presenter rule, host transfer,
lock refusing a real join, reconnection.
