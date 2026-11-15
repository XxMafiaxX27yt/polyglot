"""Quick real-model check of polyglot_core (CPU is fine). Run:  python dev/smoke_test.py"""
import os, sys, time, json, subprocess, shutil, tempfile
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")
import torch
torch.set_num_threads(4)
import polyglot_core as pc

def show(label, obj):
    if isinstance(obj, dict):
        obj = {k: (f"<{len(v)} bytes>" if isinstance(v, (bytes, bytearray)) else v) for k, v in obj.items()}
    sys.stdout.buffer.write((f"{label}: " + json.dumps(obj, ensure_ascii=False, default=str) + "\n").encode("utf8"))
    sys.stdout.flush()

t0 = time.time()
show("info", pc.info())

hindi = "नमस्ते, आज मौसम बहुत अच्छा है।"
tts = pc.synthesize(hindi, "hi")
show("tts hi", tts)
assert len(tts["wav"]) > 10000, "no Hindi audio"
arr = pc.load_audio(tts["wav"])
show("audio seconds", round(len(arr) / pc.SR, 2))

show("transcribe auto (20 UI langs)", pc.transcribe(tts["wav"]))
show("transcribe all-99", pc.transcribe(tts["wav"], candidates="all"))
show("transcribe hint=hi", pc.transcribe(tts["wav"], lang_hint="hi"))
show("whisper translate", pc.transcribe_batch([arr], lang_hint="hi", task="translate", with_probs=False)[0])
probs = pc.detect_language_batch([arr])[0]
show("top langs", sorted(probs.items(), key=lambda kv: -kv[1])[:4])

for src, tgt, text in [("hi", "en", hindi), ("en", "hi", "The meeting is tomorrow, so please finish the presentation."),
                       ("en", "ta", "Where is the nearest hospital?"), ("hi", "ta", hindi),
                       ("en", "bn", "Thank you. Are there any questions? I will finish the slides tonight.")]:
    show(f"nllb {src}->{tgt}", pc.translate(text, src, tgt))
show("batch", pc.translate_batch(["Good morning.", "", "How are you?"], "en", "hi"))
show("same lang", pc.translate("hello", "en", "en"))

hinglish = "कल मीटिंग है, सो प्लीज़ प्रेज़ेंटेशन कम्प्लीट कर दो।"
h = pc.synthesize(hinglish, "hi")
res = pc.translate_speech(h["wav"], ["en", "ta", "hi"], lang_hint="hi")
show("translate_speech", {k: v for k, v in res.items() if k != "results"})
for code, r in res["results"].items():
    show(f"  -> {code}", r)
res2 = pc.translate_speech(h["wav"], ["en", "ta"], lang_hint="hi", route="pivot", tts=False)
show("pivot route", {c: r["text"] for c, r in res2["results"].items()})

# other audio formats through ffmpeg (what the browser sends is webm/opus)
if shutil.which("ffmpeg"):
    d = tempfile.mkdtemp()
    wav_p, webm_p = os.path.join(d, "a.wav"), os.path.join(d, "a.webm")
    open(wav_p, "wb").write(tts["wav"])
    subprocess.run(["ffmpeg", "-nostdin", "-loglevel", "error", "-y", "-i", wav_p, "-c:a", "libopus", webm_p], check=True)
    webm = open(webm_p, "rb").read()
    a2 = pc.load_audio(webm)
    show("webm decode seconds", round(len(a2) / pc.SR, 2))
    show("transcribe webm", pc.transcribe(webm, lang_hint="hi")["text"])
    shutil.rmtree(d, ignore_errors=True)

import numpy as np
show("silence", pc.transcribe(pc.wav_bytes(np.zeros(pc.SR * 2, dtype=np.float32))))
show("48k stereo tuple", round(len(pc.load_audio((48000, np.zeros((48000, 2), dtype=np.int16)))) / pc.SR, 2))
show("no voice (ja)", pc.synthesize("こんにちは", "ja"))
show("total seconds", round(time.time() - t0, 1))
