# Polyglot — Legal, Privacy & Safety: delivery report

## Read this first

- This repository is **frontend only**. There is still no backend, so nothing here
  talks to a real server. Every server-dependent control is wired to
  `src/services/api.js`, which fails with **"Not sent"** until `VITE_API_URL` is
  set. No control simulates success.
- The policy pages are **drafts written for a student project**. They contain
  highlighted placeholders and have not been reviewed by a lawyer. Having them
  does not make Polyglot compliant with the DPDP Act, GDPR, UK GDPR, COPPA or
  any other law, and the app never claims it does.
- The endpoints below are **proposals** for the backend engineer, not existing
  contracts.

## 1. New pages

| Page | Address |
| --- | --- |
| Policies index | `#/legal` |
| Privacy Policy | `#/legal/privacy` |
| Terms of Service | `#/legal/terms` |
| Acceptable Use Policy | `#/legal/acceptable-use` |
| Cookie Policy | `#/legal/cookies` |
| AI Transparency Notice | `#/legal/ai` |
| Community Guidelines | `#/legal/community` |
| Recording & Consent Policy | `#/legal/recording` |
| Data Retention & Deletion Policy | `#/legal/retention` |
| About POLYGLOT | `#/legal/about` |
| Help & Privacy Support | `#/help`, `#/help/support`, `#/help/privacy`, `#/help/data`, `#/help/abuse`, `#/help/security` |
| Consent screen | shown after sign-in until the current policy version is accepted |
| Privacy & Security | dashboard sidebar |

Legal and help pages open **on top of** the app (hash routes), so opening one
during a meeting does not end the call.

## 2. New components and files

| File | Purpose |
| --- | --- |
| `src/legal/config.js` | Operator details (placeholders), policy version/date, region notes. **Edit here** |
| `src/legal/documents.js` | All policy text as data. **Edit here** |
| `src/components/legal/LegalPage.jsx` | Document renderer, index, table of contents, region notes, `Marked` placeholder highlighter, `OverlayPage` |
| `src/components/legal/HelpPage.jsx` | Contacts and the support / privacy / data / abuse / security form |
| `src/components/legal/ConsentGate.jsx` | Registration consent |
| `src/components/legal/CookieBanner.jsx` | Accept all / Reject optional / Customise |
| `src/components/legal/SiteFooter.jsx` | Company / Legal / Safety footer |
| `src/components/legal/SafetyDialogs.jsx` | `ReportDialog`, `BlockDialog`, `PrivacyStatusDialog`, `AI_DISCLAIMER` |
| `src/components/legal/RequestStatus.jsx` | Sending / error / success line |
| `src/components/dashboard/PrivacyView.jsx` | Privacy & Security page |
| `src/services/api.js` | The only place that calls the backend |
| `src/services/privacyService.js` | Consent, cookie choice, export/erase, and server request functions |
| `src/services/recording.js` | Recording kept off; the checklist for ever enabling it |
| `src/hooks/useRequest.js` | Loading/error/success state for a request |
| `src/utils/route.js` | Hash router for overlay pages |

Modified: `App.jsx`, `Landing.jsx`, `SignIn.jsx`, `Lobby.jsx`, `CallRoom.jsx`,
`SidePanel.jsx`, `HostPanel.jsx`, `dashboard/Dashboard.jsx`,
`dashboard/SettingsView.jsx`, `services/account.js`, `styles.css`.

## 3. Frontend routes

`#/legal`, `#/legal/<id>`, `#/help`, `#/help/<topic>` (see section 1). The rest of
the app still uses in-memory views (landing, sign-in, dashboard, lobby, call).

## 4. Required backend APIs (proposed)

All need an authenticated session unless marked Public. Roles must be checked
on the server.

| Feature | Method + path | Request | Response |
| --- | --- | --- | --- |
| Record consent | `POST /consents` | type, granted, policyVersion | stored record with server timestamp |
| Consent history | `GET /consents` | — | list |
| Privacy request | `POST /privacy/requests` | kind (`export`, `delete-data`, `delete-account`), detail | id, reference, status |
| Request status | `GET /privacy/requests` | — | id, kind, status, createdAt, reference |
| Safety report | `POST /safety/reports` | meetingId, participantId?, category, description | reference |
| Block participant | `POST /meetings/{id}/participants/{pid}/block` | — | — |
| Support / complaint | `POST /support/requests` (Public) | type, email, message, kind?, meetingId? | reference |
| List sessions | `GET /auth/sessions` | — | id, device, lastActiveAt, current |
| Sign out others | `DELETE /auth/sessions/others` | — | — |
| Change password | `POST /auth/password` | current, new | — |
| Restrict screen sharing | `POST /rooms/{id}/share-policy` | hostsOnly | — |
| Region / age policy | `GET /config/legal` | — | region, minimum age, policy version |

Already wired in the frontend: privacy requests, request status, reports, block,
support, sessions, sign out others. **Not yet wired** (consent is stored
locally only): `POST /consents`, `GET /consents`, password, share policy,
legal config.

Account deletion must require re-authentication on the server; the frontend
only asks the user to retype their email.

## 5. Database fields required

- **consents**: id, user_id, type (terms/age/ai/marketing/analytics), granted,
  policy_version, created_at, ip/user-agent if counsel advises, source.
- **users** (additions): region, age_band or date-of-birth policy field,
  guardian_consent_status, guardian_contact (if a parental flow is adopted),
  marketing_opt_in, analytics_opt_in, deletion_requested_at.
- **privacy_requests**: id, user_id, kind, status, reference, created_at,
  completed_at, handled_by, notes.
- **safety_reports**: id, reporter_id, meeting_id, reported_participant_id,
  category, description, status, created_at, reviewed_by. Never exposed to
  other participants.
- **blocks**: blocker_id, blocked_id, created_at.
- **sessions**: id, user_id, device, ip (if stored), created_at,
  last_active_at, revoked_at.
- **support_requests**: id, type, email, message, kind, meeting_id, reference,
  status, created_at.
- **meetings** (additions): locked, share_hosts_only.
- No tables for recordings or transcripts — they are not stored.

## 6. Environment variables

| Name | Purpose | Secret? |
| --- | --- | --- |
| `VITE_API_URL` | Base URL of the backend. Unset today | No |
| `VITE_LIVEKIT_URL` | Media server URL (from earlier report) | No |

No secret may ever be given a `VITE_` name: those are shipped to the browser.

## 7. Unfinished integrations

| Feature | State today |
| --- | --- |
| Consent record | Saved in the browser with version and time. **Not on a server** |
| Cookie / analytics choice | Works. No analytics script exists; `analyticsAllowed()` is the gate for a future one |
| Download my data | Works for browser-held data (which is all there is) |
| Erase data from this browser | Works, immediate |
| Server export / deletion / account deletion | Form and confirmation built; shows "Not sent" |
| Request status tracking | Shows "not connected" |
| Report participant / behaviour | Form built and validated; shows "Not sent" |
| Block participant | Confirmation built; shows "Not sent". Deliberately **not** faked as a local hide |
| Help / complaint forms | Validated; shows "Not sent"; reference number shown if the server returns one |
| Active sessions | This session shown from browser info; others need the server |
| Sign out of other sessions | Shows "Not sent" |
| Password change, suspicious-login alerts | Not built — no password auth exists |
| Waiting room | Not built — needs the server |
| Restrict screen sharing | Host switch works on demo state only |
| Under-18 flow | Prototype lets under-18s continue with a warning; it blocks them as soon as `VITE_API_URL` is set, until a reviewed parental-consent process exists |
| Region detection | Manual selector only |

## 8. Testing instructions

Run `npm.cmd run dev` and open http://localhost:5173 in Chrome or Edge.

1. **Cookie banner** — appears on first visit. Try Customise, Reject optional,
   Accept all. Reopen it with "Cookie choices" in the footer.
2. **Footer** — every link in Company / Legal / Safety opens a page;
   "Back to Polyglot" or Esc returns.
3. **Policies** — check the date, the draft label, the highlighted
   placeholders, the table of contents, and the region selector at the bottom of
   the Privacy Policy.
4. **Consent** — sign in with any email. Nothing is pre-ticked; "Agree and
   continue" stays disabled until both required boxes and an age are chosen.
   "Decline and sign out" returns to the landing page.
5. **Privacy & Security** (sidebar) — toggle Analytics and Product update
   emails and watch Consent history grow; Download my data; try a server request
   and confirm it says "Not sent"; try Erase data from this browser.
6. **Meeting** — lobby shows the AI notice. In the call, the top bar shows
   "AI translation on" and "Not recorded"; click the first to see the status
   dialog and disclaimer. People tab: Report and Block on each participant, and
   "Report inappropriate behaviour". Host tab: "Restrict screen sharing".
7. **Help** — `#/help`: submit empty to see validation, then a valid request to
   see "Not sent".

What I verified in the browser preview: steps 1–7 by inspecting the page, with
no console errors. **Not verified:** the downloaded file itself (I did not
trigger the download), real camera/microphone/screen prompts (blocked in the
preview pane), and anything against a real server.

## 9. Security and privacy issues found

1. **Sign-in is not authentication.** Any email and password is accepted. All
   "account" data therefore belongs to whoever uses the browser.
2. **Personal data sits in `localStorage`** (email, name, picture, meetings,
   passcodes). Any script on the page can read it; it must move to the server.
3. **Meeting passcodes are stored and compared in plain text in the browser.**
   The server must hash them and do the check.
4. **Host status is decided by the frontend** (`isHost = true` in demo). The
   server must issue roles.
5. **Consent records are only in the browser** and can be edited or cleared by
   the user, so they are not evidence of consent.
6. **No server-side enforcement of any safety action** (lock, remove, block,
   share restriction).
7. **No rate limiting or abuse protection** exists for the forms yet; the
   backend must add it.
8. **The age question is self-declared** and proves nothing.
9. No API keys, tokens or passwords are stored or hard-coded in the frontend —
   checked.
10. The app makes **no end-to-end encryption claim**. Keep it that way unless
    the infrastructure is verified.

## 10. Needs legal review before public launch

- Every policy document, and every highlighted placeholder: operator identity
  and address, contacts, grievance officer, governing law, providers and their
  regions, retention periods, processing times.
- Minimum age and the parental-consent process (DPDP Act treats under-18s as
  children; EU 13–16; COPPA under 13). Note that the team itself may be under
  18 — who the legal operator is matters.
- Whether consent is the right legal basis for AI processing in each region,
  and the exact consent wording.
- Contracts with AI and media providers: retention, model-training use,
  cross-border transfers and the transfer mechanism.
- Cookie-consent behaviour per region.
- Limitation of liability and disclaimer wording in the Terms.
- Grievance and complaint handling timelines.
- Any future recording feature (see `src/services/recording.js`).
- The "not an interpreting or emergency service" disclaimer.
