# Polyglot: speak your language, hear theirs

**Track:** AI + Languages
**Team:** names are on the submission form
**Notebook with every result:** https://colab.research.google.com/drive/1LiMgOwAx-dico1DhB2wfxfALFQOxnr7m?usp=sharing
**Preview of the app's screens:** https://xxmafiaxx27yt.github.io/polyglot/ (the call there is a scripted demo; its Results page shows our real numbers)

## The problem

In India, people in one family or one office often do not share a first language, and many of us mix Hindi and English in the same sentence: "Kal meeting hai, so please complete the presentation." Translation tools are built and tested on clean, single-language speech, and they are much weaker for Hindi, Tamil and Bengali than for English. We wanted to know how well free, open models really work for these languages, and whether they survive Hinglish.

## What we built

Polyglot takes speech in one language and gives back text and speech in another, so two people can talk without a shared language. Speech goes in, Whisper writes it down, NLLB-200 translates it, and MMS-TTS speaks it. A small server and a web app wrap this into a call between two browsers. The scored part is the notebook, which tests each step.

## What we added

We started from two suggested projects, **4.4.2 Translation quality test** and **4.4.3 Speech recognition across accents**, and added:

- **Our own question and data:** does it still work on Hinglish? We wrote 30 Hinglish sentences, plus 10 of them again in pure Hindi and pure English, to see whether mixing is what breaks it.
- **The steps joined together:** we measured how much speech mistakes damage the final translation, not just each step alone.
- **Two fixes tested:** telling Whisper the speaker's language, and using a larger Whisper model.
- **A second route:** Whisper translating straight to English, against the usual two-step route.
- **A working call app** built on the same code.

## How it works

- **Data:** 100 FLEURS sentences each in Hindi, Tamil, Bengali and English, read by native speakers. Our own Hinglish clips are **computer voices from ElevenLabs, not real speakers**; no person's voice was recorded.
- **Models:** `whisper-large-v3` (and `whisper-small` for comparison), `nllb-200-distilled-600M`, `mms-tts`. All are used as they come; we trained nothing.
- **Fair testing:** FLEURS's test split is used only for scoring. For Hinglish we chose the method on 12 sentences and scored it on the other 18.
- **Scores:** word error rate (WER, lower is better) for speech to text; chrF (higher is better) for translation; each with a 95% range.

## Results

| | English | Hindi | Tamil | Bengali |
|---|---|---|---|---|
| Speech to text, `whisper-small` (WER) | 6% | 78% | 76% | 131% |
| Speech to text, `whisper-large-v3` (WER) | 4% | 29% | 49% | 84% |
| Baseline: no translation (chrF, to English) | – | 0.6 | 0.6 | 0.5 |
| NLLB from perfect text (chrF, to English) | – | 64 | 58 | 59 |
| NLLB from real speech (chrF, to English) | – | 55 | 43 | 36 |

1. **Translation beats its baseline easily** (49 to 64 chrF on seven language pairs, against under 1 for no translation). Most of the loss comes from mistakes in hearing the speech.
2. **The speech model matters most.** The small model got three in four Hindi words wrong. The large one cut that to 29%, but takes 6 to 7 seconds per sentence on a T4 GPU against 4.
3. **Telling Whisper the language helps real Hindi speech:** 29% errors against 40% when it guesses (the baseline). It guessed the wrong language on 16 clips in 100.
4. **On Hinglish our chosen method did not beat the baseline.** Both scored 54 chrF. The three methods were level on the practice sentences, so our rule picked the baseline. On the test sentences Whisper translating directly scored 65. We did not switch after seeing the test scores; with 18 sentences this was a lead, not a result.
5. **A second test confirmed the lead.** We wrote the rules down first (`Claude-Claude code/SECOND_TEST_PLAN.md`, pushed before any run), then tried direct translation against the baseline on 49 new sentences (98 clips). Direct scored 63.9 chrF (95% range 59.7 to 67.0), the baseline 55.5 (52.0 to 58.9). The gap is +8.4 points (range +4.0 to +12.4), so by our rule direct translation is better on Hinglish. It held for both voices (63.0 and 64.7 against 55.4 and 55.6). One team member then rated all 98 translations blind, from 0 to 2, without knowing which method made which: direct averaged 1.61 with 71% fully right, the baseline 1.18 with 35%. Direct was rated higher on 22 sentences, the same on 21 and lower on 6 (average gap +0.43, range +0.18 to +0.65).
6. **Mixing cost little here:** the same voices scored 97 in English, 55.5 in pure Hindi and 54 in Hinglish. The drop is Hindi itself.

**Where it fails**

- "per head 350 rupaye" → "**but** the head will cost Rs 350". Whisper wrote "per" in Hindi letters as "पर", which is the Hindi word for "but".
- "7 baje" was heard as "साथ बजे" ("with o'clock"), and the 7 was lost.
- Bengali is still poor (84% WER). Its letter-level error is 30%, so many errors look like spelling and spacing. We have not had a Bengali reader check this.

**What this cannot show:** the Hinglish clips are computer voices and the two tests have 18 and 49 sentences; the blind ratings come from one rater, who is on our team; only four of the app's 20 languages are tested (the app marks the rest as untested); on a laptop without a GPU the live app uses the small model and makes more mistakes than the numbers above.

## What we'd do next

Record real Hinglish speakers and repeat the second test on them, since computer voices are cleaner than people. Then make the app use direct translation whenever the listener wants English, and have a Bengali reader check the Bengali errors.

## Sources

- **Data:** [FLEURS](https://huggingface.co/datasets/google/fleurs) (CC-BY 4.0).
- **Models:** [Whisper large-v3](https://huggingface.co/openai/whisper-large-v3) and [small](https://huggingface.co/openai/whisper-small); [NLLB-200 distilled 600M](https://huggingface.co/facebook/nllb-200-distilled-600M) (CC-BY-NC 4.0); [MMS-TTS](https://huggingface.co/facebook/mms-tts) (CC-BY-NC 4.0).
- **Libraries:** [Transformers](https://github.com/huggingface/transformers), [sacrebleu](https://github.com/mjpost/sacrebleu) (chrF), [jiwer](https://github.com/jitsi/jiwer) and [RapidFuzz](https://github.com/rapidfuzz/RapidFuzz) (WER), [Gradio](https://gradio.app), FastAPI, React, Vite.
- **AI tools:** [Claude Code](https://claude.com/claude-code) (the AI core, the notebook and this write-up's first draft), [Gemini / Antigravity](https://ai.google.dev) (the server, and the first draft of the Hinglish sentences), [ChatGPT / Codex](https://openai.com/codex) (the web app), [ElevenLabs](https://elevenlabs.io) (computer voices for the Hinglish clips).

---

## What is in this repo

| Folder | What it is |
|---|---|
| `Claude-Claude code/` | Part A, the scored part. The AI core (`polyglot_core.py`), the evaluation notebook (`polyglot_eval.ipynb`), its output (`results.json`) and our Hinglish sentences (`sentences.csv`). |
| `Gemini-Antigravity/` | Part B. The server that passes speech between browsers and the AI core. |
| `ChatGPT-Codex/` | Part C. The web app: the call screen and the Results page. |
| `CONTRACT.md` | The agreement that lets the three parts plug together. |

Each part was built with a different AI coding assistant, working from the shared contract. That is where the folder names come from.

## How to run it

**See the results (nothing to install).** Open the notebook link at the top.

**Run the evaluation again.** Upload `Claude-Claude code/polyglot_eval.ipynb` to Google Colab, choose a T4 GPU, then Runtime → Run all. The Hinglish voices need an ElevenLabs key saved as a Colab secret named `ELEVENLABS_API_KEY`; without it that part is skipped.

**Run the app on Windows.**

1. Install Python (with `fastapi`, `uvicorn`, `websockets`, `torch`, `transformers` and `numpy`), Node.js, and `ffmpeg` on the PATH.
2. Double-click `start_app.cmd`. Two windows open: the server and the web app. The server needs about a minute to load the models.
3. Open http://localhost:5173 in Chrome or Edge, in two tabs. In each, choose **Join as guest**, pick a language, and use the same room code.
4. Speak in one tab. The other tab shows the translation and plays it a few seconds later. Use headphones.

Without a GPU the server uses `whisper-small`. On a machine with a GPU, set `POLYGLOT_ASR_MODEL=openai/whisper-large-v3` before starting it. To try the screens with no AI models at all, set `FAKE_CORE=1`: the server then returns fixed text and a beep, and the app labels it as a fake core.
