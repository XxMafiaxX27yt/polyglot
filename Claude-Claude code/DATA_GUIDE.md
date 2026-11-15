# Hinglish test set: guide for the data person

This is the part of Polyglot that no AI can do. Judges score "your own data" and "checks by a real speaker" highly, and this is both.

**Goal:** about 50 Hinglish sentences, each with a correct English translation, recorded in your own voices. Budget about 90 minutes for the whole team.

## Step 1: Choose the sentences (30 min)

1. Take Gemini's draft list of 80 Hinglish sentences.
2. Keep the 40 to 50 that sound like something you would really say. Drop anything stiff or strange.
3. **Read every English translation and fix it.** The translation is the answer key. If the key is wrong, every score is wrong.
4. Make sure some sentences have numbers, names and slang. Those are where translators break, and we want to find that out.

## Step 2: Add control sentences (15 min)

Pick 10 to 15 of your Hinglish sentences. For each one, write the same meaning two more ways:

- in **pure Hindi** (no English words)
- in **pure English**

Give all three the same `group` number. This lets us compare the same person saying the same thing three ways, so we can show whether *mixing* is what causes the errors.

## Step 3: Put them in a sheet

Use a Google Sheet (easiest for a team) or a file called `sentences.csv`. One row per sentence, with these columns:

| id | type | group | text | english |
|---|---|---|---|---|
| 1 | hinglish | 1 | Kal meeting hai, so please presentation complete kar do. | The meeting is tomorrow, so please complete the presentation. |
| 2 | hindi | 1 | कल बैठक है, इसलिए कृपया प्रस्तुति पूरी कर दो। | The meeting is tomorrow, so please complete the presentation. |
| 3 | english | 1 | The meeting is tomorrow, so please complete the presentation. | The meeting is tomorrow, so please complete the presentation. |
| 4 | hinglish | 4 | Mera laptop charge nahi ho raha hai. | My laptop is not charging. |

- `id`: a different number for every row.
- `type`: `hinglish`, `hindi` or `english`.
- `group`: rows that mean the same thing share a number. A sentence with no partners uses its own id.
- `text`: exactly what the speaker should say. Write Hinglish the way you would text it.
- `english`: the correct English translation.

`sentences_template.csv` in this folder has the right headers.

**To use a Google Sheet:** Share → "Anyone with the link" → Viewer. Paste the link into `HINGLISH_SHEET` in the notebook's first cell.
**To use a file:** put `sentences.csv` in Google Drive at `MyDrive/polyglot/hinglish/sentences.csv`.

## Step 4: Record (30 to 45 min)

**Easiest way: the recorder inside the notebook.**

1. One person opens the notebook in Colab, ticks `RUN_RECORDER` in the first cell and runs the cells down to part 12.
2. A public link appears. Send it to your teammates only.
3. Everyone opens the link on a phone or laptop, types their first name, and records each sentence. Each recording is saved automatically.
4. When everyone is done, un-tick `RUN_RECORDER` and run the notebook from part 11.

**Other way: phone voice recorder.** Record one file per sentence and name it with the sentence id and your name, like `007_asha.m4a`. Upload the files to Google Drive at `MyDrive/polyglot/hinglish/audio/`.

**Recording rules**

- Only your own voices. Do not record anyone outside the team. This is a hackathon rule.
- Say it the way you would say it to a friend. Normal speed, no acting.
- A quiet room, with the phone about a hand away from your mouth.
- If you stumble, record it again.
- More than one of you should record every sentence. Different voices make the test fairer.

## Step 5: Rate the translations (20 min, on Sunday)

After the notebook runs, it writes `ratings_sheet.csv` in `MyDrive/polyglot/results/`. Each row shows what was said, the correct English, and two outputs labelled A and B. You are not told which system wrote which, so you cannot favour ours.

For each output give a score:

- **2** = the meaning is right
- **1** = partly right
- **0** = wrong or nonsense

Save it in the same folder as `ratings_filled.csv`, and re-run part 14 of the notebook.

## Privacy

Your recordings stay in your own Google Drive. The submission only needs the notebook, with its scores and text outputs. Decide as a team whether you want to share the audio itself. You do not have to.
