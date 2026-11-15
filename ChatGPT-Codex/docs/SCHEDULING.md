# Meeting Scheduling & Upcoming Meetings

## Status — read this first

This repository is **frontend only**: no backend, no database, no real
authentication and no LiveKit integration. So scheduling is implemented as a
working **prototype that stores meetings in the browser's `localStorage`**.

| Piece | State |
| --- | --- |
| Dashboard, navigation, schedule/edit/cancel, upcoming, past, calendar, invitations | **Works** in one browser |
| Persistent storage shared between users and devices | **Not built** — needs the backend |
| Invitation links | Open the meeting **only in the browser that created it** |
| Host-only editing, passcodes, access rules | UI behaviour only. **Not security** — `localStorage` can be edited by anyone |
| Email invitations | Not built. There is no email integration; the host copies the invitation |
| LiveKit room creation / join tokens | Not built. Joining opens the existing demo call |
| "Two users scheduling at once", "unauthorised editing attempts" | **Cannot be tested** without a server |

## What is implemented

| Piece | Where |
| --- | --- |
| Meeting storage seam (create, update, cancel, lookup, status, invitation) | `src/services/meetingsService.js` |
| Time-zone conversion and formatting | `src/utils/time.js` |
| Dashboard shell, Home, Join, Upcoming, Past, Settings | `src/components/dashboard/Dashboard.jsx` |
| Schedule / edit form with validation | `src/components/dashboard/MeetingForm.jsx` |
| Meeting cards, details and invitation | `src/components/dashboard/MeetingCard.jsx` |
| Day / week / month calendar | `src/components/dashboard/CalendarView.jsx` |
| Invitation-link handling (`?join=<token>`) | `src/App.jsx` |

### Behaviour

- **Scheduling never opens a call.** It only saves a record. The lobby and call
  start when someone presses Join.
- **Times** are stored as UTC (`scheduledStartUtc`) together with the time zone
  the host chose. They are displayed in the viewer's time zone, which is
  detected automatically and can be changed in Settings.
- **Validation:** title required, valid date and time, start must be in the
  future (checked in the chosen time zone), invitee emails well-formed,
  passcode at least 4 characters when access is "Passcode required".
- **Meeting ID** `PLG-XXXX-XXXX` and a 144-bit **invitation token** come from
  the browser's cryptographic random generator.
- **Status:** `scheduled → live → completed`, or `cancelled`. In the prototype
  `live` and `completed` are worked out from the clock (start time and
  duration), not from what happened in a room.
- **Joining** is allowed from 10 minutes before the start until the scheduled
  end. Cards show "Starts in …", "Starting soon" or "Live now".
- **Editing** changes the same record, so the existing invitation link always
  shows the current details. **Cancelling** keeps the record with status
  `cancelled`, so the link explains that the meeting was cancelled instead of
  breaking.
- **Nothing is recorded.** Past meetings only show the stored schedule details.

## Backend requirements (not built)

Agree these with the backend developer; adapt names to the existing API
conventions rather than duplicating anything.

### Model

```
Meeting
  id                    string, unique
  title                 string
  description           string
  host_id               user id (from the authenticated session)
  scheduled_start_utc   timestamp (UTC)
  duration_minutes      integer
  timezone              IANA zone name the host scheduled in
  status                scheduled | live | completed | cancelled
  invitation_token      random, at least 128 bits, unique
  passcode_hash         nullable — store a hash, never the passcode
  invited               list of emails / user ids
  created_at, updated_at
```

### Endpoints

| Endpoint | Notes |
| --- | --- |
| `POST /api/meetings` | Host = authenticated user. Validate fields and reject past times **on the server**. Does not create a LiveKit room. |
| `GET /api/meetings/upcoming`, `GET /api/meetings/past` | Only meetings the caller hosts or is invited to. |
| `GET /api/meetings/{id}` | Same visibility rule. Never return the passcode or its hash to non-hosts. |
| `PATCH /api/meetings/{id}` | Host or authorised co-host only, else `403`. |
| `DELETE /api/meetings/{id}` | Host only. Sets status `cancelled`; keep the row. |
| `GET /api/invitations/{token}` | Public summary for an invitation link (title, time, host, status). |
| `POST /api/meetings/{id}/join` | Checks status, lock, passcode and invitation, then creates or retrieves the LiveKit room and returns a join token. |

### Rules the server must enforce

- Only the host or an authorised co-host can edit or cancel.
- A user cannot read or modify another user's meetings.
- All date/time input is validated server-side; the client is not trusted.
- Passcode-protected or invite-only meetings refuse unauthorised joins.
- LiveKit and database credentials never reach the browser.
- The room is created at join time and closed when empty — scheduling must not
  leave a room open.
- Status changes come from real events: `live` when the first participant
  joins, `completed` when the room closes.

### Frontend hand-off

Keep the function names in `meetingsService.js` (`listMeetings`,
`createMeeting`, `updateMeeting`, `cancelMeeting`, `findMeeting`, …) and replace
their bodies with API calls. They are synchronous today, so the dashboard will
need `await` and loading states added at the call sites in `Dashboard.jsx`.

## Testing

Run `npm.cmd run dev`, open http://localhost:5173, sign in.

1. **Schedule:** Dashboard → Schedule Meeting. Leave the title empty → error.
   Pick today with a time already passed → "That time has already passed".
   Fill it in properly → the details dialog opens with the invitation.
2. **Upcoming:** the card shows title, date, time, duration, host, invited
   count and a countdown. Join is disabled until 10 minutes before the start.
3. **Join now:** schedule a meeting a few minutes ahead → the card says
   "Starting soon" → Join opens the lobby with that meeting's ID and title.
4. **Edit:** pencil icon → change the title or time → the card and the details
   update; the invitation link is unchanged.
5. **Cancel:** bin icon → confirm → the meeting moves to Past as "Cancelled".
6. **Invitation link:** Details → copy the link → open it in a new tab of the
   same browser → after sign-in the Join page shows that meeting.
7. **Calendar:** Upcoming Meetings → Calendar. Dates with meetings have an
   orange dot. Switch Day / Week / Month and use the arrows and Today.
8. **Time zones:** Settings → change Time zone → the same meeting shows a
   different local time, and Details shows the zone it was scheduled in.
9. **Passcode:** schedule with "Passcode required". As host you join directly.
   The passcode prompt only appears for a non-host, which in this prototype
   means signing in with a different email that was on the invite list.
10. **Past:** Past Meetings lists completed and cancelled meetings.

To reset the prototype data, clear `polyglot.meetings` in the browser's local
storage.
