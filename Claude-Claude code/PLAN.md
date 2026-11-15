# Polyglot Part A: plan and status

**Deadline:** Monday 16 Nov, 10:29 AM India time. Aim to submit a first version on Sunday evening.
**This file is the hand-off.** If Claude runs out of limit, Codex or Antigravity can continue from here.
**Last updated:** Sunday 15 Nov, 2:30 PM.

## What Part A is

The AI core and its honest test. This is the part the judges score.

- `polyglot_core.py`: speech → text → translation → speech, from open models (Whisper, NLLB-200, MMS-TTS). The live server (Part B) imports this file.
- `polyglot_eval.ipynb`: the Colab notebook to submit. It builds the pipeline, tests it against baselines, shows the worst mistakes and writes `results.json`.

**Our question:** does speech translation still work when people mix Hindi and English, and which way of handling it works best?

## Files

| File | What it is |
|---|---|
| `polyglot_core.py` | The AI core. Edit this, then rebuild the notebook. |
| `polyglot_eval.ipynb` | Built from the core plus the cells in `dev/build_notebook.py`. **Do not edit by hand.** |
| `DATA_GUIDE.md` | Step-by-step guide for recording the Hinglish test set. |
| `sentences_template.csv` | The column layout for the Hinglish sentences. |
| `sentences_draft.csv` | Gemini's 80 draft Hinglish sentences in the right layout (1 to 30 easy, 31 to 60 medium, 61 to 80 hard). **Not checked by a human yet.** The team picks 40 to 50, fixes the English, adds the Hindi and English control rows, and saves the result as `sentences.csv`. |
| `results.json` | **Not here yet.** It goes here after the full Colab run. The server and the Results page read it. |
| `dev/build_notebook.py` | All notebook cells live here. Run it to rebuild the `.ipynb`. |
| `dev/run_notebook.py` | Runs the notebook outside Colab to catch mistakes (`--fake` or `--real 2`). |
| `dev/smoke_test.py` | Quick real-model check of the core. |
| `dev/make_tts_check_set.py` | Robot-voice stand-in for the Hinglish set. A pipeline check only, never data. |

## Status

- [x] Core written and run on real speech on this laptop (CPU).
- [x] Notebook written. Every cell runs with stand-in models (`run_notebook.py --fake`).
- [x] Every cell also ran with the real models and real FLEURS data, on 2 sentences per language.
- [x] That real run found two bugs, both fixed and re-checked on real audio (see "Things already learned").
- [x] Shapes checked against what Part B and Part C built.
- [x] First run in Colab (QUICK_TEST on, T4 GPU, Saturday 14 Nov about 5:25 PM). It reached the end and wrote `results.json` with every section filled. That file is a test run: it stays in Downloads, not in this folder.
- [x] Full Colab run, 100 sentences per language, done twice: `whisper-small` as main (6:03 PM) and `whisper-large-v3` as main (7:30 PM, Saturday 14 Nov). `results.json` in this folder is the big-model run. No Gemini column (no key was set) and no Hinglish section yet.
- [x] Gemini's 80 draft Hinglish sentences put into `sentences_draft.csv`. Not checked by a human.
- [ ] Hinglish sentences chosen and translations checked by the team (`DATA_GUIDE.md`).
- [ ] Hinglish recordings made.
- [ ] Notebook re-run with the Hinglish set. Route chosen on dev, scores on test.
- [ ] Blind ratings filled in by the team.
- [ ] Worst-five examples read by a human, with the real reason written down.
- [ ] `results.json` copied into this folder again after the Hinglish re-run (the one here now has no Hinglish section).
- [x] Notebook saved in Colab and shared (Sunday 15 Nov, about 12:50 PM). The link opens without signing in: https://colab.research.google.com/drive/1bWloT4Yrqgbe1rOwcCyllEmfKYQhePhr?usp=sharing
- [x] Drafts written by Claude: the write-up (now the top of `../README.md`) and `../VIDEO_SCRIPT.md` (2 minutes). The user must read, correct and reword both. The team line and the ratings line in the write-up are still blanks.
- [x] App tested end to end with ChatGPT's updated UI and the real core, by Claude with robot-voice clips (see "The whole app, checked on the laptop").
- [x] One git repo, pushed to a private GitHub repo named `polyglot` on the user's account.
- [ ] A person tries the app by speaking in two browser tabs.
- [ ] Write-up reworded by the user, then pushed again. Video recorded. Repo made public if the rules need it. Submitted.

Not re-run after the last fixes: the full `--real 2` pass (the laptop was on battery). The two fixes were checked with a short real-model script instead, and the `--fake` pass was re-run.

## The whole app, checked on the laptop (Sunday 15 Nov, 1 to 2 PM)

**To start it:** double-click `../start_app.cmd`. It opens two windows: Gemini's server with the real core (`FAKE_CORE=0`, bound to `127.0.0.1` only) and ChatGPT's web app with `VITE_BACKEND_URL=http://localhost:8000`. Then open http://localhost:5173 in two Chrome or Edge tabs and use "Join as guest" with the same room code. The system `python` (3.14) has every library the server and core need. Leave `HOST` at `127.0.0.1` unless a second device must join; Gemini's own default is `0.0.0.0`, which opens the server to the whole network.

What was checked, all by Claude, none of it with a human speaking:

- ChatGPT's tests after its merge with the friend's new UI: 35 unit tests passed, 7 browser tests passed. Its integration test against Gemini's real server (fake core) failed once on a 5-second time limit during a slow start and passed on the second run.
- In a real browser: landing page, "Join as guest", the lobby and the call screen open. The app says "Live / fake core" with a warning banner in fake mode and "Live / AI core" with the real core. The Results page shows `results.json`, including the note that the Hinglish clips are computer-made.
- Real core through the server into the browser, using three robot-voice clips made with our own MMS-TTS (**a pipeline check only, never data**):
  - Hindi clip → English listener: "Hello, the weather is very nice today." Correct.
  - English clip → Hindi listener: "बैठक कल है, इसलिए कृपया प्रस्तुति समाप्त करें।" Correct.
  - Hinglish clip → English listener: heard "कल मेंकिम है, तो प्रेजेगेशन कमप्लिट कर दू" and said "If I'm going to work tomorrow, complete the projection." Wrong, and typical of `whisper-small`. The caption showed in the browser.
  - The audio sent back is newly made speech of the translation, not an echo of the speaker.
  - About 7 to 8 seconds per sentence on this laptop's CPU. Not a result to report.
- **Not checked:** a person speaking into a microphone in the browser (Claude's browser pane has no microphone), two real devices, and `whisper-large-v3` in the app (the laptop has no GPU, so the app uses `whisper-small`).
- The app's loading animation between screens took 20 to 30 seconds in Claude's browser pane. Not confirmed in Chrome; check it before recording the video.

## The single repo (Sunday 15 Nov, 2 PM)

- A git repo exists at the project root, on branch `main`.
- **It is on GitHub** since Sunday 15 Nov, about 2:30 PM: a **private** repo named `polyglot` on the user's own account, created by the user (`git remote -v` shows the address). Claude pushed and checked that GitHub holds the same commit as the laptop. Checked as private: the page answers 404 to someone who is not signed in.
- To upload later changes: `git add -A`, `git commit -m "..."`, `git push`. Git on this laptop is already signed in to GitHub through Git Credential Manager. `gh` is not installed.
- Private first, on Claude's advice: the README is still a draft and Gemini's README shows the Windows user name. Making it public (repo Settings → General → Danger Zone → Change visibility) is the user's click, after those are fixed and if the hackathon needs a public link.
- `../README.md` is the write-up (moved from `WRITEUP.md`, which no longer exists) plus "what is in this repo" and "how to run it". It is still a draft: the team line and the human-ratings line are blanks.
- Left out by `../.gitignore`: `node_modules`, `dist`, `.venv`, test output, `.env` files, `.claude/`, the two `UI-from-friend` folders, ChatGPT's backup folder and `VIDEO_SCRIPT.md`.
- Commits use a neutral local identity ("Polyglot Team"), because this laptop has no git name set and the contract says round 1 is judged blind. Change it with `git config user.name` and `git config user.email` inside the project if the team wants real names.
- **Before making it public, the user decides:** whether names may appear (blind judging; note the repo address itself shows the GitHub account name), and whether to fix `Gemini-Antigravity/README.md`, which shows the laptop's Windows user name in three file paths (Gemini's folder, so Claude has not edited it).
- The notebook file in the repo has no outputs. The copy with outputs is the Colab link in the README.

## Hinglish results (full run, Sunday 15 Nov, 1:45 AM; this is `results.json` now)

All 100 clips are **ElevenLabs computer voices** (2 voices, model `eleven_v4`), no human recordings. 30 sentences were split by the notebook: 12 to choose the method (dev), 18 to score (test, 36 clips). FLEURS numbers are the same as the earlier big-model run. Speed this run: 5.9 s (the earlier run measured 7.3 s, so quote it as 6 to 7 s).

- **Test scores, Hinglish → English (chrF):** no translation 28.5, auto → NLLB 54.0, hint → NLLB 54.0, Whisper direct ("pivot") 65.0.
- **Our rule picked "auto" on dev**, where the three routes were level (63.4, 62.7, 62.9). So "ours" equals the baseline and the reported gain is 0. On test, pivot was 11 points higher. **Do not switch to pivot now**: that would be choosing the method on the test set. Report it as a lead from 18 sentences, not a result. The range for pivot against the baseline is in the notebook's part 13 table, not in `results.json`.
- **The hint made no difference** (54.0 both): Whisper picked Hindi on every clip. These are clean computer voices; on real FLEURS Hindi, auto got the language wrong 16% of the time.
- **Same voices, three ways of talking (test):** English 97, pure Hindi 55.5, Hinglish 54.0. So on this set mixing costs almost nothing beyond what Hindi already costs. Not a matched comparison: 14 clips each for English and Hindi against 36 Hinglish.
- **Mistakes worth showing (a human should confirm each):**
  - "per head 350 rupaye" was written "पर हेड" and translated "but the head will cost Rs 350". "पर" is Hindi for "but". An English word, written in Hindi letters, was read as a Hindi word.
  - "7 baje" was heard as "साथ बजे" ("with o'clock"), and the 7 was lost.
  - "subah se" was heard as "सुभाई से" and became "from Subhai". This may be the computer voice saying it oddly, not Whisper's fault. Listen to clip 027.
  - "Paytm kar de" (Paytm as a verb) became "pay".
- **Still missing:** blind human ratings (`ratings_sheet.csv` is in Drive), the Gemini column, any human recording.

## Hinglish test: decided on Sunday 15 Nov, early morning

- The user's friend will not record his voice, and the user chose **ElevenLabs computer voices** for the Hinglish audio. The notebook labels these as computer-made everywhere (file names start with `tts-`, tables split "human" and "computer", and `results.json` gets `hinglish.speech` and `hinglish.note`). Never present them as real speakers.
- `sentences.csv` in this folder is the chosen set: 30 Hinglish sentences (10 easy, 10 medium, 10 hard, from Gemini's 80) plus 10 pure-Hindi and 10 pure-English control rows written by Claude. **No human has checked the English translations or the Hindi control rows yet.**
- `build_notebook.py` copies `sentences.csv` into the notebook. In Colab it is written to Drive if no `sentences.csv` is there, so nothing has to be uploaded. To change the sentences: edit `sentences.csv`, rebuild, and delete the old copy in `MyDrive/polyglot/hinglish/`.
- New notebook cell "1b" makes the clips when a Colab secret `ELEVENLABS_API_KEY` exists. Settings in the first cell: `ELEVEN_VOICES` (how many voices, default 2), `ELEVEN_VOICE_NAMES` (pick voices by name), `ELEVEN_MODEL` (default `eleven_v4`, falls back to `eleven_multilingual_v2` if refused). Clips are kept on Drive, so a re-run does not spend quota again.
- First Colab try (Sunday, about 1:30 AM): the key worked, but ElevenLabs answered 402 "Free users cannot use library voices via the API". Fix: cell 1b now tries ElevenLabs' default ("premade") voices first and skips any voice that needs a paid plan. That fix is not yet confirmed in Colab.
- **The ElevenLabs call has never finished a clip** (Claude has no key, by design). The rest passed `--fake`. Expect about 5,500 characters for 2 voices; the free plan is listed as 10,000 credits a month.
- Human recordings can still be added later to `MyDrive/polyglot/hinglish/audio/` and are scored separately.
- `../ChatGPT-Codex/HANDOFF_FOR_CHATGPT.md` (written with the user's say-so) asks ChatGPT to keep its work and adjust its own folder to the friend's new UI, saving the working version first and keeping "Join as guest".

## Friend's new UI (received Saturday night, 14 Nov)

- It is in `../UI-from-friend-v2` (copied from his zip without `node_modules`; run `npm install` there before use). The older version in `../UI-from-friend` is untouched.
- **It holds no voice recordings.** Its "voices" are a Voice Effects feature (Normal, Robot, Wizard and so on) that changes how the translated speech sounds. The Hinglish test still has no audio.
- It is frontend only: the conversation is scripted and nothing calls the server yet (its own `docs/API_INTEGRATION.md` says so). Sign-in accepts any email. No Supabase code is in it.
- Not a Part A job. Wiring it to the server belongs to Parts B and C.

## How to run in Colab

1. Go to colab.research.google.com → File → Upload notebook → choose `polyglot_eval.ipynb`.
2. Runtime → Change runtime type → **T4 GPU**.
3. First time: tick **QUICK_TEST** in the first cell, then Runtime → Run all. It asks to connect Google Drive, so say yes. About 7 minutes.
4. If it reaches the end, un-tick QUICK_TEST and Run all again. About 25 minutes.
5. Download `results.json` from Drive (`MyDrive/polyglot/results/`) into this folder.
6. If a cell fails, copy the red error text to Claude.

Optional: for the Gemini comparison column, add a Colab secret named `GEMINI_API_KEY` (key icon in the left bar). Everything runs without it.

Settings in the first cell: `ASR_MODEL` is the speech model used everywhere (now `whisper-large-v3`). `COMPARE_ASR_MODEL` is a second one that part 7b compares it with (now `whisper-small`). The run times above were measured with the small model as main, so expect longer.

## How it works, in short

- **Speech to text.** Whisper must first decide the language. We test three ways: auto (99 languages), room (only the call's languages), hint (the speaker's own setting). The app uses the hint.
- **Model size (7b).** The same clips through a second Whisper size, to see how much the size changes.
- **Translation.** NLLB-200, one sentence at a time. Baseline: no translation. Comparison: Gemini.
- **Hinglish.** Four routes to English: no translation, auto → NLLB, hint → NLLB, and "pivot" (Whisper turns speech straight into English). The best open route is chosen on 40% of the sentences and scored on the other 60%.
- **Scores.** WER and CER for speech to text, chrF for translation, each with a 95% range. Blind human ratings for Hinglish.

## Current results: big Whisper as main model (100 sentences per language, real numbers)

Full Colab run, Saturday 14 Nov, 7:30 PM, T4 GPU, `whisper-large-v3`. This is the `results.json` in this folder. The quick test with the big model also passed.

- **Speech to text with the language hint (WER, lower is better):** English 4%, Hindi 29%, Tamil 49%, Bengali 84%. The small model on the same clips: 6%, 78%, 76%, 131%.
- **Bengali is still the weak one.** Its character error (CER) is 30%, far below its word error, so many "wrong words" are spelling or spacing slips. A Bengali reader should confirm. Some clips still come out partly in English letters, and one clip still looped.
- **The hint now helps Hindi:** 29% with the hint against 40% on auto. Auto picked the wrong language on 16 Hindi clips in 100.
- **Speech to translated English (chrF, higher is better; perfect-text score in brackets):** Hindi 55 (64), Tamil 43 (58), Bengali 36 (59). With the small model these were 35, 34 and 13.
- **From English** nothing changed: 54 to Hindi, 54 to Tamil, 49 to Bengali, within 1 to 3 points of perfect text.
- **Whisper translating directly no longer wins anywhere:** Hindi 49 against 55, Tamil 27 against 43, Bengali 35 against 36 (a tie). No ranges on these.
- **Speed is the cost: 7.3 seconds** median for one Hindi speaker with English and Tamil listeners (speech to text alone is 5.4 s). The small model took 4.0 s.
- **Not decided:** whether 7.3 s is acceptable for the live demo. `whisper-large-v3-turbo` is a faster option that has not been tested here.
- Translation-only scores are the same as before, as expected (same NLLB, same text).

## Earlier run: small Whisper as main model

Kept for comparison in `dev/results_small_model_full_run.json` (6:03 PM run). The numbers below are from that run.

- **Speech to text, `whisper-small` with the language hint (WER, lower is better):** English 6%, Hindi 77%, Tamil 78%, Bengali 129%.
- **Same clips, `whisper-large-v3`:** English 4%, Hindi 29%, Tamil 48%, Bengali 84%.
- **Why the small model scores so badly:** on some clips it gets stuck repeating one word hundreds of times (one Hindi clip scored WER 1138%). Bengali often comes out in Hindi script or in marks from other scripts.
- **The hint did not help Hindi:** auto 71% against hint 77%, even though auto picked the wrong language on 11 clips in 100. Not explained yet. Likely the repeat loops, which swamp the average.
- **Translation from perfect text (chrF, higher is better):** NLLB scores 49 to 64 on all seven pairs. The no-translation baseline scores under 1.
- **Speech to translated text:** speech mistakes cost a lot when the speaker is not English. Hindi → English falls from 64 to 35, Tamil → English from 58 to 34, Bengali → English from 59 to 13. From English the loss is 1 to 3 points.
- **Whisper translating directly** beats Whisper → NLLB for Bengali (22 against 13) and is about level for Hindi (38 against 35). It loses for Tamil (19 against 34). These have no ranges, so treat small gaps as ties.
- **Speed:** 4.0 seconds median for one Hindi speaker with English and Tamil listeners.
- **Decided by the user (Saturday 14 Nov, evening):** the main model is now `whisper-large-v3`, and part 7b compares it with `whisper-small`. The notebook was rebuilt and `--fake` passed. `run_notebook.py --real` swaps in small and tiny so the laptop can cope.
- `polyglot_core.py` still defaults to `whisper-small`, because the laptop has no GPU. The live server picks the model with the `POLYGLOT_ASR_MODEL` setting.

## Things learned before the full run

All from 2 test sentences per language or from robot voices, so these are leads to check in the full run, not results.

- **FLEURS English is recorded very quietly** (about 100 times quieter than the Hindi clips). A "skip silent audio" check in the core threw every English clip away and gave a false 100% error rate. The check now only catches true silence, and the notebook turns it off for testing.
- **`whisper-small` is close to useless for Bengali.** Told the language was Bengali, it wrote one clip in Hindi script and filled another with one repeated mark. That is the model, not our code, and it is why part 7b tests a bigger model.
- **`whisper-small` on Hindi makes enough mistakes to wreck the translation.** One clip about plants came out in English as "all the pups appear to be octopuses".
- Whisper's standard text cleaner deletes the vowel signs of Indian scripts, so WER comes out wrong. The notebook has its own cleaner.
- Some FLEURS sentences carry stray spreadsheet quote marks. The notebook strips them.
- NLLB turned the Bengali for "pH" into "Ph.D.". A good example for the write-up, if it shows up again in the full run.
- On robot-voice Hinglish, NLLB turned "please" (written प्लीस by Whisper) into "police". The pivot route got "please" right.
- `pyarrow` must not be installed on this laptop: Windows Smart App Control blocks it and pandas stops importing. The notebook reads FLEURS from plain `.tsv` and `.tar.gz` files, so it does not need it.

## Next steps, in order

0. Done: ElevenLabs clips made, full run with Hinglish finished, notebook shared, app checked, local repo made. **Now, all for the user:** try the app by voice in two tabs; fill in the blind ratings or say in the write-up that they were not done; reword the write-up in `../README.md`; record the video from `../VIDEO_SCRIPT.md`; tell Claude to push the final changes; make the GitHub repo public if the rules need a public link; submit before Monday 16 Nov, 10:29 AM India time.
1. Done: quick and full Colab runs with the big model. Open question for the user: is 7.3 s fast enough for the demo, or test `whisper-large-v3-turbo`?
2. Data person: start `DATA_GUIDE.md` now. It does not depend on any code.
3. Antigravity: add the one-line language hint from `../CONTRACT.md` ("Update from Part A").
4. Done: full Colab run, `results.json` copied here.
5. Record Hinglish, re-run from part 11, fill in the blind ratings.
6. Read the worst-five tables and write the real reasons into the write-up.
7. Combine with Part B and Part C (see `../CONTRACT.md`, "Combining at the end"). For a live demo that feels fast, the core needs a GPU.

## Stretch ideas (only if everything above is done)

- Hinglish → Tamil, if someone who speaks Tamil can check the references.
- Spotting Hinglish from short windows of audio.

## For another AI taking over

- Change cells in `dev/build_notebook.py`, then run `python dev/build_notebook.py` and `python dev/run_notebook.py --fake`. Both must pass before the notebook goes back to Colab.
- The function shapes are fixed in `../CONTRACT.md`. Parts B and C depend on them.
- Never report numbers from `--fake`, from `--real 2`, or from the robot-voice set. Real numbers come only from the full Colab run.
- Never leave a test-run `results.json` in this folder. The server serves whatever is there.
