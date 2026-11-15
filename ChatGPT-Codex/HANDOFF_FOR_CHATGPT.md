# Hand-off for ChatGPT (Codex): adjust Part C to the new UI

Written by Claude (Part A) on Sunday 15 Nov, at the user's request. Read `../CONTRACT.md` first. The contract has not changed.

## What the user wants

**Do not redo your work.** Your live mode, Results page and tests in this folder stay. Adjust this folder so it has the look and screens of the friend's newer UI, with your work still running inside it.

## The situation

- This folder (`ChatGPT-Codex/`) is your Part C: the **old** UI plus live mode and the Results page. It works against the server and has tests.
- `../UI-from-friend-v2/` is a **newer UI** from the user's friend. It was built separately from the old UI, so it has none of your work. It adds screens (dashboard, scheduling, host controls, voice effects, settings, privacy pages) but only plays a scripted demo. Its own notes are in `../UI-from-friend-v2/docs/API_INTEGRATION.md`.
- `../UI-from-friend-v2/` came from a zip without `node_modules`. Run `npm install` there if you want to see it running.

## The job

Bring the new UI's screens and styling **into this folder**, and keep these working:

1. `src/services/liveSession.js`, `src/services/backendConfig.js`, `src/services/resultsService.js`.
2. `src/components/Results.jsx` and `results.css`, reachable from the new navigation.
3. The live/demo switch: live when `VITE_BACKEND_URL` is set, otherwise the labelled demo.
4. The "untested" mark on the 16 languages that were not tested.
5. Your tests, updated where file names or screens changed.

Files that both you and the friend changed, so they need a careful merge and not an overwrite: `App.jsx`, `Session.jsx`, `CallRoom.jsx`, `Lobby.jsx`, `ControlBar.jsx`, `VideoTile.jsx`, `audio/player.js`, `services/translationService.js`, `hooks/useLocalMedia.js`, `data/languages.js`, `styles.css`.

Files that exist only in the new UI can be copied in as they are (for example the `dashboard`, `legal` and settings components, `VoiceEffects.jsx`, `HostPanel.jsx`, `data/voiceModes.js`, `utils/`, the extra `services/` and `hooks/`).

## Rules the user has agreed

- **Save the working version first.** Before changing anything, commit it or copy this folder (for example to `../ChatGPT-Codex-backup/`). The demo needs a version that is known to work if the merge is not finished in time. The deadline is Monday 16 Nov, 10:29 AM India time.
- Keep a **"Join as guest"** path that needs no login. The friend may add a Supabase login later, and the demo must work if that login fails.
- Do not report any number from demo mode. Real numbers come only from `../Claude-Claude code/results.json`.
- Do not edit `../Claude-Claude code/` or `../Gemini-Antigravity/`.

## Things that changed in Part A since your last pass

- The speech model is now `whisper-large-v3`. On a T4 GPU one sentence takes about 7 seconds end to end, so the UI should show a clear "translating" state and not look frozen.
- `results.json` may soon gain a `hinglish` section with two new fields: `hinglish.speech` (`human_recordings`, `computer_recordings`, `computer_voice`) and `hinglish.note`. If `hinglish.note` is present, **show it next to the Hinglish scores**: it says that some clips are computer-made speech and not real speakers.
- The themed voices in the new UI ("Voice Effects") are a listener-side sound effect. They must never change the translated text.

## Done means

- This folder shows the new UI, joins a room on the real server, two browsers hear each other's translations, and the Results page shows `results.json`.
- Demo mode still works with no backend and is labelled as a demo.
- Your tests pass, and the README says how to run it.
