# Polyglot: speak your language, hear theirs

**Team:** (names here, if the rules allow names) · **Track:** AI + Languages · **Notebook with all results:** https://colab.research.google.com/drive/1bWloT4Yrqgbe1rOwcCyllEmfKYQhePhr?usp=sharing

DRAFT by Claude from `results.json`. Read every line, change it into your own words, and delete this line.

## Our question

People in India mix Hindi and English in one sentence: "Kal meeting hai, so please complete the presentation." Does speech translation still work on that, and which way of handling it works best?

## What we built

A pipeline made only of open models: Whisper (speech to text), NLLB-200 (translation) and MMS-TTS (voice). A small server and web app use it so two people can talk in different languages. The notebook tests the pipeline and nothing in it is simulated.

## How we tested

- **Public data:** 100 FLEURS sentences each in Hindi, Tamil, Bengali and English, read by native speakers.
- **Our own data:** 30 Hinglish sentences, plus 10 of them again in pure Hindi and pure English. The clips are **computer voices from ElevenLabs, not real speakers**, so these scores are probably better than real life.
- **Baselines:** no translation at all; Whisper guessing the language with no hint; Whisper translating directly to English.
- **Fair choice:** we chose our Hinglish method on 12 sentences and scored it on the other 18.
- **Scores:** word error rate (WER, lower is better) for speech to text, chrF (higher is better) for translation.

## What we found

| | English | Hindi | Tamil | Bengali |
|---|---|---|---|---|
| Speech to text, `whisper-small` (WER) | 6% | 78% | 76% | 131% |
| Speech to text, `whisper-large-v3` (WER) | 4% | 29% | 49% | 84% |
| Translation to English from perfect text (chrF) | – | 64 | 58 | 59 |
| Translation to English from real speech (chrF) | – | 55 | 43 | 36 |

1. **The speech model matters most.** The small model the brief suggested got three in four Hindi words wrong and sometimes repeated one word hundreds of times. The large model cut Hindi errors to 29%. It costs speed: about 6 to 7 seconds per sentence on a T4 GPU, against 4.
2. **Translation is not the weak part.** From perfect text NLLB scores 49 to 64 on all seven pairs; no translation scores under 1. Most of the loss comes from speech mistakes.
3. **Telling Whisper the speaker's language helps real Hindi speech:** 29% errors against 40% when it guesses. It guessed the wrong language on 16 clips in 100.
4. **On Hinglish our chosen method did not beat the baseline.** Both scored 54. On the 12 practice sentences the three methods were level, so our rule picked the baseline method. On the test sentences Whisper translating directly scored 65. We did not switch after seeing the test scores; with 18 sentences this is a lead to check, not a result.
5. **Mixing cost little here.** The same voices scored 97 in English, 55.5 in pure Hindi and 54 in Hinglish. The drop is Hindi, not the mixing.

## Where it breaks

- "per head 350 rupaye" → "**but** the head will cost Rs 350". Whisper wrote "per" in Hindi letters as "पर", which is the Hindi word for "but".
- "7 baje" was heard as "साथ बजे", and the 7 was lost.
- Bengali is still poor. Its letter-level error is 30%, so many word errors look like spelling and spacing. (Not yet checked by a Bengali reader.)

## Limits

Computer voices, not people, for Hinglish. Only 18 test sentences. The Hinglish sentences were drafted with Gemini and chosen by us. Human ratings: (fill in after the blind rating sheet, or say they were not done). Four of the app's 20 languages are tested; the app marks the rest as untested. On a laptop with no GPU the live app runs the small speech model, so the demo makes more mistakes than the notebook's large-model numbers.

## What we would do next

Record real Hinglish speakers, test direct translation on a larger set, and try a faster large model for live calls.

Credits and licences are listed at the end of the notebook.

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
