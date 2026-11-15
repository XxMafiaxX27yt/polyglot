# Polyglot — Part C, newer UI merge

The screens and styling from `UI-from-friend-v2` now run around Part C's existing live translation and Results page. All product edits are in `ChatGPT-Codex`. The shared contract and Parts A/B were not edited.

## Start

```powershell
npm ci
# Omit this environment variable for the labeled scripted demo.
$env:VITE_BACKEND_URL = 'http://localhost:8000'
npm run dev
```

Open http://localhost:5173 in Edge or Chrome. Choose **Join as guest**: no account, password, consent-record storage, or authentication service is needed. Enter your name and the same room code on two tabs/devices. The lobby's **Dashboard** button opens scheduling, upcoming/past meetings, settings, and privacy screens. The existing sign-in screen remains a local prototype; its guest button is always available.

For another device, start Vite with `npm run dev -- --host 0.0.0.0` and use a backend origin reachable from that device. Microphones need localhost or HTTPS; an HTTPS frontend needs HTTPS/WSS backend access. Restart Vite after changing the backend URL. Part B needs to allow the frontend origin for HTTP health/results requests.

## What works

- Live mode when `VITE_BACKEND_URL` is set; otherwise the labeled scripted demo. Connection failure never silently falls back to demo.
- Contract WebSocket participant lists, captions, audio-only WebM recording, translated WAV playback, microphone/volume/caption controls and language changes.
- Clear recording and sent-for-translation states. Allow several seconds (7 seconds or longer) for real-core processing. The contract has no completion acknowledgement to the speaker, so "Audio sent" never pretends the other listener has finished receiving it.
- V2 call layout, avatar/profile tiles, fullscreen, voice effects, local screen preview and privacy dialogs.
- Device selection with cleanup of replaced streams and canceled/unmounted permission requests. Guest listening still works with unavailable media or blocked persistent storage.
- Per-browser dashboard, scheduling, calendar, appearance, device and voice preferences. Scheduling, guest/local profile identity, invitations and passcodes are prototypes, not server-enforced access controls. Guest identity lasts for the current app visit.
- Results from the existing backend `GET /results`, with ASR, copy baseline vs NLLB, optional Gemini, Hinglish chrF/provenance/note, stage latency, optional speech-to-text-translation routes, and ordered worst-five examples. Missing values remain unavailable; intentional null Hinglish WER is explained.

**Choose the language you speak.** The same contract language selection supplies the listening preference and the speaker's recognition hint. Hinglish speakers choose Hindi. Hindi, English, Tamil, Bengali and Hinglish are the contract's tested scope; the other 16 catalogue choices are marked **Untested**, including in Settings. Actual quality comes from Results, not a scope label.

## Contract limits preserved

Remote video and screen publication are not implemented: camera/screen media stays in the local preview; remote tiles are avatars. Live **Original captions** mutes translated playback and shows source text; original audio is not delivered by the backend. Microphone uploads continue while unmuted even if translated playback is off.

Voice Effects changes only local sound after translation, never translated words or server requests. Robot, assistant and hall effects process WAV audio in this listener's Web Audio queue. Mystery has no live WAV effect, which the UI states. Browser demo styles use pitch/rate; missing backend TTS for Chinese, Japanese or Italian can fall back to an available device voice. Untested languages remain marked untested.

Live host roles, remote mute/remove/lock, account authentication, safety/privacy submissions and shared scheduling are not part of the current backend contract. Live host controls show an unavailable explanation. Demo host controls manipulate only scripted participants. Proposed administrative APIs from the friend's notes are not called. Legal/privacy pages remain the friend's clearly labeled draft documents; importing them does not establish a production policy or verified backend retention rules.

There is no saved meeting-recording feature in the frontend. MediaRecorder captures short live speech segments for backend processing. The UI keeps captions in call memory, not persistent meeting history. Ask the backend operator about server-side retention.

## Results and data

Real numbers originate in `../Claude-Claude code/results.json`; Part B already serves that artifact at `/results`. Open **Results** from the landing page, lobby or dashboard, or navigate to `/#/results` (`/#results` and `/results` are supported too). Results and legal overlays keep the underlying call mounted.

No evaluation artifact has been copied into `public/`. Automatic approval review rejected that optional public copy because it might expose private evaluation data. The agreed backend endpoint remains the normal source. With no backend and no separately provided public file, Results honestly reports unavailable data. Test-only numbers remain in tests; demo latency is always labeled simulated and is never used for evaluation.

## Working backup

Before any merge edits, the full working Part C folder was copied to:

`../ChatGPT-Codex-backup-before-v2-20261115`

Key files were verified by SHA-256 against the source immediately after copying. The backup includes dependencies, source, tests and the prior production build. It has not been updated during this merge. To use it, open that folder and run `npm run dev -- --port 5178`; do not overwrite it with the merged version.

## Verify

```powershell
npm test
npm run build
npm run test:e2e
npm run test:integration
```

Unit tests cover transport/audio lifecycles, voice effects/text integrity, device/screen permission races, Results schema/provenance, and loading the actual Part A artifact read-only. Browser tests cover the two-client contract peer, guest flow, demo labels, Results, dashboard scheduling/settings, unavailable live host controls and denied media/storage. Tests use synthetic microphones, never the user's microphone.

The optional integration test starts the actual sibling Part B with `FAKE_CORE=1` on 8020 and a frontend on 5181. It checks WebM uploads and WAV responses in both directions and loads the existing real evaluation artifact through `/results`. It does not evaluate real models. All servers started by the tests stop afterward; screenshots/traces go to ignored test output folders.

On this Windows installation Device Guard blocks the virtual-environment Python launcher. Use the already installed base interpreter and the existing environment packages instead:

```powershell
$baseHomeLine = Get-Content -LiteralPath '..\Gemini-Antigravity\.venv\pyvenv.cfg' | Select-String '^home = '
$baseHome = $baseHomeLine.ToString().Substring(7).Trim()
$env:PART_B_PYTHON = Join-Path $baseHome 'python.exe'
$env:PYTHONPATH = (Resolve-Path '..\Gemini-Antigravity\.venv\Lib\site-packages').Path
npm run test:integration
```

Python bytecode writes are disabled for this test, so Parts A/B are not changed. Edge is the default Playwright browser; use `PLAYWRIGHT_CHANNEL=chrome` for an installed Chrome. Rollup uses its official WebAssembly package because the machine blocks its native module; no machine policy was changed.

## Credits

Original and newer UI from the user's friend, built with assistance from Claude. Part C by Codex. Circle Reveal Loader adapted from Goodmotion (https://goodmotion.vercel.app/); liquid-glass effects adapted from a community LiquidGlassSignUp component. React, Vite, GSAP and lucide-react.

Verified after the v2 merge: production build passed; 35 unit tests, seven browser tests and the actual Part B fake-core integration test passed. The final sent-status change also passed its focused two-client regression. Real GPU-model audio was not re-evaluated in this UI merge; the Results file is Part A's existing evaluation artifact.
