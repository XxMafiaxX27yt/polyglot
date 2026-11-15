"""Makes a tiny robot-voice "Hinglish" folder so the notebook's Hinglish cells can be run
end to end before the team's real recordings exist.

    python dev/make_tts_check_set.py <output folder>

THIS IS NOT DATA. The voices are synthetic (MMS-TTS). Never report numbers from it.
"""
import csv
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import polyglot_core as pc

# id, type, group, what a person would write, what the Hindi voice is given to read, correct English
ROWS = [
    (1, "hinglish", 1, "Kal meeting hai, so please presentation complete kar do.",
     "कल मीटिंग है, सो प्लीज़ प्रेज़ेंटेशन कम्प्लीट कर दो।", "The meeting is tomorrow, so please complete the presentation."),
    (2, "hinglish", 2, "Mujhe yeh homework Friday tak submit karna hai.",
     "मुझे यह होमवर्क फ्राइडे तक सबमिट करना है।", "I have to submit this homework by Friday."),
    (3, "hinglish", 3, "Aaj traffic bahut zyada hai, main late ho jaunga.",
     "आज ट्रैफ़िक बहुत ज़्यादा है, मैं लेट हो जाऊँगा।", "There is a lot of traffic today, I will be late."),
    (4, "hinglish", 4, "Kya tum mujhe apna phone number de sakte ho?",
     "क्या तुम मुझे अपना फ़ोन नंबर दे सकते हो?", "Can you give me your phone number?"),
    (5, "hinglish", 5, "Weekend pe movie dekhne chalein?",
     "वीकेंड पे मूवी देखने चलें?", "Shall we go and watch a movie on the weekend?"),
    (6, "hinglish", 6, "Mera laptop charge nahi ho raha hai.",
     "मेरा लैपटॉप चार्ज नहीं हो रहा है।", "My laptop is not charging."),
    (7, "hindi", 1, "कल बैठक है, इसलिए कृपया प्रस्तुति पूरी कर दो।",
     "कल बैठक है, इसलिए कृपया प्रस्तुति पूरी कर दो।", "The meeting is tomorrow, so please complete the presentation."),
    (8, "hindi", 3, "आज सड़क पर बहुत भीड़ है, मुझे देर हो जाएगी।",
     "आज सड़क पर बहुत भीड़ है, मुझे देर हो जाएगी।", "There is a lot of traffic today, I will be late."),
    (9, "hindi", 4, "क्या तुम मुझे अपना दूरभाष क्रमांक दे सकते हो?",
     "क्या तुम मुझे अपना दूरभाष क्रमांक दे सकते हो?", "Can you give me your phone number?"),
    (10, "hindi", 6, "मेरा संगणक बिजली नहीं ले रहा है।",
     "मेरा संगणक बिजली नहीं ले रहा है।", "My laptop is not charging."),
    (11, "english", 1, "The meeting is tomorrow, so please complete the presentation.",
     None, "The meeting is tomorrow, so please complete the presentation."),
    (12, "english", 3, "There is a lot of traffic today, I will be late.",
     None, "There is a lot of traffic today, I will be late."),
    (13, "english", 4, "Can you give me your phone number?", None, "Can you give me your phone number?"),
    (14, "english", 6, "My laptop is not charging.", None, "My laptop is not charging."),
]

out = sys.argv[1]
os.makedirs(os.path.join(out, "audio"), exist_ok=True)
with open(os.path.join(out, "sentences.csv"), "w", newline="", encoding="utf-8-sig") as f:
    w = csv.writer(f)
    w.writerow(["id", "type", "group", "text", "english"])
    for sid, typ, group, text, spoken, english in ROWS:
        w.writerow([sid, typ, group, text, english])
        wav = pc.synthesize(spoken or text, "en" if typ == "english" else "hi")["wav"]
        assert wav, f"no audio for sentence {sid}"
        with open(os.path.join(out, "audio", f"{sid:03d}_robot.wav"), "wb") as a:
            a.write(wav)
print(f"wrote {len(ROWS)} robot-voice clips to {out} (pipeline check only, not data)")
