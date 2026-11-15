# Second Hinglish test: the plan, written before the test

Written on Sunday 15 November 2026, about 3:30 PM India time. At that moment no clip for this test had been made and nothing had been scored. The repository's history shows when this file was added.

## Why a second test

In our first test we chose our Hinglish method on 12 practice sentences. The three methods were level there, so our rule picked the plain baseline. On the 18 test sentences, a different method (Whisper translating directly to English) scored 65 against the baseline's 54.

We had already seen that result, so claiming "direct translation is better" from the same 18 sentences would be choosing the winner after the race. A fair claim needs sentences that were never used.

## The question

On Hinglish sentences that were never used before, does **Whisper translating directly to English** score higher than the **baseline: Whisper writes the words with the language auto-detected, then NLLB translates**?

## The data

- **Sentences:** the 49 in `sentences_confirm.csv`. They were chosen by rule, not by hand: our draft list of 80, minus the 30 already used in the first test, minus sentence 67, whose English answer was unclear before any testing.
- **No sentence is removed after we see results.**
- **Answer key:** the English translations in that file, as drafted with Gemini. They are not changed after we see results.
- **Voices:** the same ElevenLabs computer voices and model as the first test, up to two voices per sentence. If the free quota runs out, the second voice covers fewer sentences and we report how many clips there were. If a team member records any of the sentences, those clips are scored and counted separately.

## The measure and the rule

- **Measure:** chrF against the answer key, over every clip in the set.
- **Difference:** direct minus baseline, with a 95% range from re-sampling **sentences** 500 times. All clips of one sentence stay together, so two voices saying the same sentence do not count as two independent tests.
- **Rule:**
  - whole range above zero → "confirmed: direct translation is better";
  - range includes zero → "not confirmed";
  - whole range below zero → "the baseline is better".
- We report the result whichever way it goes. The first test stays in the notebook unchanged.

## The human check

Team members who speak Hindi and English rate the meaning of the two outputs for one clip per sentence. The outputs are shown as A and B in random order, so the rater cannot tell which method wrote which. Scores: 2 = the meaning is right, 1 = partly right, 0 = wrong or nonsense.

We report the average score for each method, the share rated fully right, and how many sentences each method won. There is no pass or fail rule for this part. It is a second view by real speakers, next to the automatic score.

## Limits we already know

- The clips are computer voices, not people, so real speech is likely to be harder.
- The answer key was drafted by an AI and has not been checked by a professional translator.
- The raters are the team, not outsiders.
