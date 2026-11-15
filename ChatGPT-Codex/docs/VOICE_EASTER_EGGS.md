# Polyglot Voice Easter Eggs

Optional themed voices for translated speech. A voice mode changes **how** the
translation is voiced for one listener. It never changes the translated words
and never touches anyone else's playback.

## What is implemented (frontend)

| Piece | Where |
| --- | --- |
| Voice modes (Normal, J.A.R.V.I.S., Mystery, Robot, Wizard + secret Deep Space) | `src/data/voiceModes.js` |
| Voice Effects button and popup (toggle, mode list, preview, latency readout) | `src/components/VoiceEffects.jsx` |
| Preferences, secret unlock, latency tracking, auto-disable | `src/components/CallRoom.jsx` |
| Voice-selection layer between translation and TTS (demo) | `src/services/translationService.js` |
| Styled speech + client-side audio effects | `src/audio/player.js` |

- **Default is Normal** and effects are **off** until the listener turns them on.
- Preferences are stored per browser (`localStorage`, key `polyglot.voice`).
- Original (untranslated) audio is never restyled, and original and translated
  audio never play at the same time.
- All styles are original presets. None clones or imitates a real person, actor
  or copyrighted character.

## Provider limitations — read this

**Demo mode has no real themed voices.** With no backend connected, speech comes
from the browser's built-in speech synthesis, which only exposes pitch and rate.
So today each mode is the same system voice at a different pitch and speed:

| Mode | Demo (browser voice) | Live (planned) |
| --- | --- | --- |
| Normal | pitch 1.0, rate 1.05 | provider's standard voice |
| J.A.R.V.I.S. | lower pitch, steady rate | calm licensed voice + `assistant` effect |
| Mystery | high pitch, faster | expressive licensed voice (needs provider support) |
| Robot | very low pitch | standard voice + `robot` ring-modulation effect |
| Wizard | low pitch, slow | deep licensed voice + `hall` echo effect |
| Deep Space (secret) | lowest pitch, slowest | deep voice + `hall` effect |

Browser speech synthesis cannot be routed through Web Audio, so the `robot`,
`assistant` and `hall` effects in `TranslatedAudioQueue.setVoiceEffect()` only
apply to audio streamed from the backend. **Those effects are written but have
not been tested against real backend audio yet.**

Mystery needs a genuinely different voice or pitch shift; if the chosen TTS
provider has no suitable licensed voice, show it as unavailable rather than
faking it.

## Secret unlock

On the meeting screen, either:

- type `polyglot` (anywhere except a text field), or
- click the POLYGLOT logo in the top bar five times within 2.5 seconds.

This reveals the hidden **Deep Space** mode in the Voice Effects list. Neither
trigger overlaps with a meeting control.

## Latency

- **Speech start** (shown in the popup) is measured on the device: time from
  requesting speech to audio starting. **Added by effect** is the selected
  mode's average minus Normal's average.
- In demo mode pitch/rate changes add no processing step. The Web Audio effects
  use no lookahead, so they add no buffering delay by design.
- If a mode averages more than **250 ms** slower than Normal over three or more
  utterances, it is switched back to Normal automatically and the popup says why.
- The "first audio" figure in the top bar is still **simulated** in demo mode.
  Translation latency and TTS generation latency must be measured by the backend.

No latency numbers are reported here because none have been measured against a
real pipeline yet.

## Backend integration requirements

Nothing below is built yet; agree it with the backend developer before changing
any API contract.

1. **Per-listener preference.** Each client sends only its own preference, e.g.
   `{ "type": "listener.prefs", "lang": "en", "voice": "robot" }`. The server
   stores it per connection. One listener's change must not affect another.
2. **Voice selection sits after translation.** Pipeline stays
   `audio → ASR → translation → [voice selection] → TTS → listener`. Changing
   voice must not re-run ASR or translation.
3. **Translate once per target language.** Listeners who share a language share
   one translation, whatever their voice.
4. **Synthesize once per (utterance, language, provider voice).** Cache on that
   key. Robot / J.A.R.V.I.S. / Wizard can reuse the *same* TTS audio as Normal
   or a shared base voice, because their character is added client-side by
   `setVoiceEffect()`. Only modes needing a different provider voice cost an
   extra TTS call.
5. **Stream, don't buffer.** Send audio chunks as they are generated; the client
   queue (`TranslatedAudioQueue`) plays them gaplessly.
6. **Report timings per utterance**: `asrMs`, `translationMs`, `ttsFirstByteMs`,
   so the UI can show real numbers instead of simulated ones.
7. **Capabilities.** Tell the client which voice ids the provider supports, so
   unsupported modes can be hidden or marked unavailable.
8. **No new paid services or API keys in the frontend** without team approval.

## Testing

1. `npm.cmd run dev`, open http://localhost:5173 in Chrome or Edge, sign in and join.
2. Click the sparkle **Voice effects** button in the control bar.
3. Turn the toggle on, pick each mode, press **Preview** — the sample sentence
   should sound different per mode. The next demo line also uses the new voice.
4. Turn the toggle off — playback returns to Normal while your selection is kept.
5. Change the mode while someone is speaking — captions and transcript text must
   not change (no re-translation).
6. Switch **Translating** off — original audio plays unstyled.
7. Type `polyglot`, or click the logo five times — a toast appears and
   **Deep Space** is added to the list. Reload: it stays unlocked.
8. Open the app in a second browser profile — its voice setting is independent.
9. Pick a listening language with no installed system voice — the existing
   notice appears and no voice mode is faked.
