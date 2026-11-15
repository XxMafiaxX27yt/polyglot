# Polyglot: shared contract (read this first)

Three AIs build three parts in separate folders. **Follow this contract exactly** so the parts plug together at the end.
If you need to change anything here, tell the team first. Do not change it on your own.

```
PolyGlot Hackathon Project/
  UI-from-friend/        the React UI (already built, demo mode)
  Claude-Claude code/    PART A: AI core + evaluation notebook   (Claude)
  Gemini-Antigravity/    PART B: backend server                   (Antigravity)
  ChatGPT-Codex/         PART C: live mode in the UI + results page (Codex)
```

## Update from Part A (Sat 14 Nov, afternoon)

`Claude-Claude code/polyglot_core.py` is now the **real** core, tested on real speech. Nothing in the contract below changed shape. These are additions and clarifications.

**For Part B (server)**

- Pass the speaker's own language as the hint. It is the one change that matters most for accuracy:
  `CORE.translate_speech(wav_16k, targets, lang_hint=speaker.lang)`
  Without a hint, Whisper has to guess the language, and it sometimes writes Hindi in Urdu script.
  The rule for users: "the language you chose is the language you speak. Hinglish speakers choose Hindi."
- The real core needs `torch`, `transformers` and `numpy` in the server's Python (plus `ffmpeg` on PATH). The first request loads about 3.5 GB of models, so call `polyglot_core.warmup()` once at startup.
- `translate_speech` also returns `route` and `langProbs`. Ignore them or log them.
- Chinese, Japanese and Italian have no MMS-TTS voice, so `wav` is `b""` for them. Text still arrives.

**For Part C (UI)**

- `results.json`: the `hinglish` section is **left out** until the team's recordings are scored. It is never `null`.
- Hinglish has no word error rate (`wer` is `null` there, on purpose). Show the `chrf` numbers.
- Each `mt` pair also has a `copy` entry: the "no translation" baseline. Showing it next to NLLB answers the judges' baseline question.
- Each `worst` item also has `task` (`speech-to-text`, `translation` or `hinglish`) and `score`. Translation items have `pair` (like `hi-en`), and `lang` is the target language. The list is ordered so the first five are the ones to show.
- Extra sections you may show if you have time: `s2t` (speech in, translated text out) and `hinglish.variants` (every route we tried).
- When `wav` is empty for a language, the browser's own `speak()` is a fine fallback.

**Where the results file goes:** after the Colab run, put `results.json` in `Claude-Claude code/`. The server already looks there.

## Why this split (hackathon rules)
- Round 1 is judged blind on **code + 1-page write-up + 2-min video**.
- Judges score: **beats a simple baseline, results per language, side-by-side failures, checks by a real speaker**.
- "A regular app built with AI coding tools doesn't count on its own." The AI + evaluation (Part A) is the core of the project. The app (Parts B + C) is the demo.
- Report real numbers only. The demo-mode numbers in the UI are fake and must never be reported.

## Languages
Use the UI's 2-letter codes everywhere (`hi`, `en`, `ta`, `bn`, ... from `UI-from-friend/src/data/languages.js`).
Part A maps them to NLLB codes internally. **Tested languages:** `hi`, `en`, `ta`, `bn`, plus Hinglish (`hi` with `mixed: "Hinglish"`). The other 16 are "untested", and the UI must not claim they work.

---

## PART A: AI core (`Claude-Claude code/polyglot_core.py`)

Pure Python, no web code. Part B imports it.

```python
transcribe(audio: bytes, lang_hint: str | None = None) -> dict
    # audio = 16 kHz mono WAV bytes
    # -> {"text": str, "lang": "hi", "mixed": "Hinglish" | None, "ms": int}

translate(text: str, src: str, tgt: str, engine: str = "nllb") -> dict
    # engine: "nllb" (main) or "gemini" (comparison)
    # -> {"text": str, "ms": int}

synthesize(text: str, lang: str) -> dict
    # -> {"wav": bytes, "ms": int}     # WAV bytes; may be b"" if no voice for lang

translate_speech(audio: bytes, targets: list[str], lang_hint=None) -> dict
    # convenience: transcribe once, translate + synthesize per target
    # -> {"original": str, "sourceLang": str, "mixed": str|None,
    #     "results": {tgt: {"text": str, "wav": bytes}},
    #     "stageMs": {"asr": int, "mt": int, "tts": int}}
```

Also in Part A: `polyglot_eval.ipynb` (Colab). Scores per language (WER, chrF), Hinglish set, baseline vs fix, worst-5 examples, latency. It writes **`results.json`** in this shape:

```json
{
  "generated": "2026-11-15T12:00:00Z",
  "asr":  {"hi": {"wer": 0.21, "n": 100}, "ta": {...}, "hinglish": {...}},
  "mt":   {"en-hi": {"nllb": {"chrf": 52.1}, "gemini": {"chrf": 58.3}, "n": 100}, ...},
  "hinglish": {"baseline": {"wer": 0.0, "chrf": 0.0}, "fix": {"wer": 0.0, "chrf": 0.0}, "n": 50},
  "latencyMs": {"asr": 0, "mt": 0, "tts": 0},
  "worst": [{"lang": "ta", "input": "...", "model": "...", "correct": "...", "why": "..."}]
}
```

---

## PART B: backend (`Gemini-Antigravity/server.py`)

FastAPI + WebSocket. Imports `polyglot_core`. Must also run with **`FAKE_CORE=1`**: a stub core that returns canned text and a short beep WAV, so Part C can test without any AI models.

**Endpoint:** `ws://<host>:8000/ws?room=PLG-1234&user=<id>&name=<name>&lang=<listenLang>`

**Client → server**
| message | meaning |
|---|---|
| `{"type":"set_lang","lang":"ta"}` | listener changed language |
| `{"type":"audio_start","id":"u-17"}` | an utterance begins |
| *binary frames* | audio of that utterance (webm/opus from MediaRecorder) |
| `{"type":"audio_end","id":"u-17"}` | utterance finished, so process it |

The server converts the audio to 16 kHz mono WAV (ffmpeg). It runs `translate_speech` once per utterance, with the **distinct listen languages** of the other people in the room as targets (no duplicate work).

**Server → client** (these map 1:1 to the UI handlers in `translationService.js`)
| message | UI handler |
|---|---|
| `{"type":"participants","list":[{"id","name","lang"}]}` | update the tiles |
| `{"type":"utterance_start","id","speakerId","sourceLang","mixed","targetLang","translated"}` | `onUtteranceStart` |
| `{"type":"partial","id","original"?,"translated"?}` | `onPartial` |
| `{"type":"utterance_end","id","speakerId","sourceLang","mixed","targetLang","original","translated","latencyMs","stageMs":{"asr","mt","tts"}}` | `onUtteranceEnd` |
| `{"type":"audio","id","format":"wav"}`, then **one binary frame** | push into `TranslatedAudioQueue` |
| `{"type":"error","message"}` | show a toast |

`latencyMs` = **real measured** time from `audio_end` received to translated audio sent.
Also: `GET /health` returns `{"ok":true,"fake":bool}`, and `GET /results` serves `results.json` from Part A.

---

## PART C: UI live mode (`ChatGPT-Codex/`, a copy of `UI-from-friend` with changes)

1. `src/services/liveSession.js`: `createLiveSession({ getListenLang, getTranslateOn, getVolume, handlers, localStream, profile, onParticipants })` returns `{ stop() }`. Same handlers as `createDemoSession`.
   - Detect speech with the existing `useMicSpeaking`-style level check, record each utterance with `MediaRecorder`, and send it as `audio_start`, binary frames, then `audio_end`.
   - On `audio` messages, play the audio through `TranslatedAudioQueue`.
2. Live vs demo switch: when `VITE_BACKEND_URL` is set, use live mode. Otherwise keep demo mode with its "Demo mode / simulated" labels.
3. Remote participants come from the `participants` message. Avatar tiles are fine, and real WebRTC video is optional.
4. A **Results page** that shows `results.json` (from `GET /results`, or `public/results.json`): tables per language, baseline vs ours, and the worst-5 side by side.
5. Mark the 16 untested languages as "untested" in the language picker.

---

## Combining at the end
1. Copy `polyglot_core.py` next to `server.py`.
2. Run `server.py` (real core) on the machine or Colab with a GPU.
3. Run the UI with `VITE_BACKEND_URL` pointing to it.
4. Final code goes to one GitHub repo, with the write-up as the README.
