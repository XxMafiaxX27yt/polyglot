"""Runs the notebook's code cells outside Colab, to catch mistakes before anyone opens Colab.

    python dev/run_notebook.py --fake        fake models and data: checks all the plumbing in seconds
    python dev/run_notebook.py --real 2      real models and real FLEURS, 2 sentences per language
"""
import argparse
import csv
import json
import os
import random
import shutil
import sys
import tempfile
import types

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, ROOT)
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ap = argparse.ArgumentParser()
ap.add_argument("--fake", action="store_true")
ap.add_argument("--real", type=int, default=0)
ap.add_argument("--keep", action="store_true", help="keep the temp data folder")
ap.add_argument("--hinglish", default="", help="real mode: folder with sentences.csv and audio/ to copy in")
ap.add_argument("--threads", type=int, default=4)
args = ap.parse_args()
FAKE_MODE = args.fake or not args.real

import matplotlib

matplotlib.use("Agg")
import numpy as np

# ---- stand-ins for Colab-only things -------------------------------------------------
shown = {"audio": 0, "tables": 0}
try:
    import IPython.display  # noqa: F401
except ImportError:
    ip, disp = types.ModuleType("IPython"), types.ModuleType("IPython.display")

    class Audio:
        def __init__(self, data=None, rate=None, **kw):
            assert data is not None and len(data) > 0, "Audio() got nothing to play"
            shown["audio"] += 1

    def display(*objs):
        for o in objs:
            if hasattr(o, "to_string"):
                shown["tables"] += 1
                print(o.to_string(max_colwidth=60))
            elif not isinstance(o, Audio):
                print(o)

    disp.Audio, disp.display = Audio, display
    ip.display = disp
    ip.get_ipython = lambda: None      # matplotlib asks for these when IPython is loaded
    ip.version_info = (9, 0, 0)
    sys.modules["IPython"], sys.modules["IPython.display"] = ip, disp

tmp = tempfile.mkdtemp(prefix="polyglot_run_")
os.environ["POLYGLOT_DATA"] = tmp
os.environ["POLYGLOT_N"] = str(6 if FAKE_MODE else args.real)
if FAKE_MODE:
    os.environ["GEMINI_API_KEY"] = "fake-key"
else:
    os.environ.pop("GEMINI_API_KEY", None)
    import torch

    torch.set_num_threads(args.threads)
    if os.name == "nt":  # be polite to the rest of the laptop: below-normal priority
        import ctypes

        ctypes.windll.kernel32.SetPriorityClass(ctypes.windll.kernel32.GetCurrentProcess(), 0x00004000)

# ---- fake models and data ------------------------------------------------------------
WORDS = {
    "en": "the river city school market water people food road music light house friend morning doctor".split(),
    "hi": "नदी शहर स्कूल बाज़ार पानी लोग खाना सड़क संगीत रोशनी घर दोस्त सुबह डॉक्टर किताब".split(),
    "ta": "ஆறு நகரம் பள்ளி சந்தை தண்ணீர் மக்கள் உணவு சாலை இசை ஒளி வீடு நண்பன் காலை மருத்துவர் புத்தகம்".split(),
    "bn": "নদী শহর স্কুল বাজার জল মানুষ খাবার রাস্তা সঙ্গীত আলো বাড়ি বন্ধু সকাল ডাক্তার বই".split(),
}


class Fake:
    """Deterministic stand-ins for the model calls. A clip's LENGTH is its identity."""

    def __init__(self):
        self.reg = {}      # clip length -> dict(lang, text, en)
        self.pairs = {}    # (src, source text) -> {tgt: text}
        self.next_len = 16000

    def clip(self, lang, text, en):
        self.next_len += 1
        arr = (0.05 * np.sin(np.arange(self.next_len) / 20.0)).astype(np.float32)
        self.reg[self.next_len] = dict(lang=lang, text=text, en=en)
        return arr

    @staticmethod
    def _noise(text, seed, p=0.2):
        r = random.Random(seed)
        w = [x for x in text.split() if r.random() > p] or text.split()[:1]
        return " ".join(w)

    def install(self, pc):
        real_load = pc.load_audio

        def info(a):
            return self.reg[len(real_load(a))]

        def detect_language_batch(audios, batch_size=16):
            out = []
            for a in audios:
                i = info(a)
                r = random.Random(len(real_load(a)))
                p = {"hi": 0.02, "en": 0.02, "ta": 0.02, "bn": 0.02, "ur": 0.02, "as": 0.01}
                wrong = {"hi": "ur", "bn": "as"}.get(i["lang"])
                if wrong and r.random() < 0.3:
                    p[wrong], p[i["lang"]] = 0.6, 0.3
                else:
                    p[i["lang"]] = 0.85
                if i.get("mixed"):
                    p["en"] = 0.25
                out.append(p)
            return out

        def transcribe_batch(audios, lang_hint=None, candidates=None, task="transcribe", batch_size=16, with_probs=True):
            hints = list(lang_hint) if isinstance(lang_hint, (list, tuple)) else [lang_hint] * len(audios)
            out = []
            for a, h in zip(audios, hints):
                i, n = info(a), len(real_load(a))
                lang = h or i["lang"]
                if task == "translate":
                    t = self._noise(i["en"], n + 7)
                elif lang != i["lang"]:
                    t = " ".join(reversed(i["text"].split()))[: max(3, len(i["text"]) // 2)]
                else:
                    t = self._noise(i["text"], n, 0.15)
                out.append({"text": t, "lang": lang, "mixed": None, "ms": 5})
            return out

        def translate_batch(texts, src, tgt, engine="nllb", batch_size=16):
            if src == tgt:
                return list(texts)
            out = []
            for t in texts:
                known = self.pairs.get((src, t), {}).get(tgt)
                base = known if known else f"[{tgt}] {t}"
                out.append(self._noise(base, sum(map(ord, t + tgt + engine)), 0.1 if engine == "gemini" else 0.25))
            return out

        def synthesize(text, lang):
            return {"wav": pc.wav_bytes(np.zeros(8000, np.float32)) if text else b"", "ms": 3}

        def translate_speech(audio, targets, lang_hint=None, engine="nllb", candidates=None, tts=True, route=None):
            a = transcribe_batch([audio], lang_hint=lang_hint)[0]
            res = {}
            for t in dict.fromkeys(targets):
                txt = a["text"] if t == a["lang"] else translate_batch([a["text"]], a["lang"], t, engine)[0]
                res[t] = {"text": txt, "wav": b"" if t == a["lang"] else synthesize(txt, t)["wav"]}
            return {"original": a["text"], "sourceLang": a["lang"], "mixed": None, "results": res,
                    "stageMs": {"asr": 300, "mt": 200, "tts": 100}, "route": route or "cascade", "langProbs": {}}

        pc.detect_language_batch, pc.transcribe_batch, pc.translate_batch = detect_language_batch, transcribe_batch, translate_batch
        pc.synthesize, pc.translate_speech = synthesize, translate_speech
        pc.set_asr_model = lambda name: {"asr_model": name}
        return {"core": pc.__version__, "asr_model": "fake", "mt_model": "fake", "device": "cuda", "gpu": "Fake GPU"}

    def fleurs(self, langs, n):
        sids = list(range(1001, 1001 + n))
        text = {l: {} for l in langs}
        audio = {l: {} for l in langs}
        for s in sids:
            r = random.Random(s)
            idx = [r.randrange(15) for _ in range(8)]
            sent = {l: " ".join(WORDS[l][i] for i in idx) + (" 42" if s % 4 == 0 else "") for l in langs}
            for l in langs:
                text[l][s] = sent[l].capitalize() + "."
            for l in langs:
                self.pairs[(l, text[l][s])] = {t: text[t][s] for t in langs}
                audio[l][s] = self.clip(l, text[l][s], text["en"][s])
        return sids, text, audio

    def hinglish(self, pc, folder):
        os.makedirs(os.path.join(folder, "audio"), exist_ok=True)
        rows, k = [], 0
        for g in range(1, 15):
            r = random.Random(g)
            idx = [r.randrange(15) for _ in range(6)]
            en = " ".join(WORDS["en"][i] for i in idx)
            hi = " ".join(WORDS["hi"][i] for i in idx)
            mix = " ".join((WORDS["en"] if j % 2 else WORDS["hi"])[i] for j, i in enumerate(idx))
            styles = [("hinglish", mix)] + ([("hindi", hi), ("english", en)] if g <= 6 else [])
            for typ, txt in styles:
                k += 1
                rows.append({"number": k, "type": typ, "Hinglish sentence": txt, "correct English translation": en,
                             "group": g, "difficulty": "easy", "what might be tricky": "-"})
                self.pairs[("hi", txt)] = {"en": en}
                for spk in ("asha", "ravi"):
                    arr = self.clip("en" if typ == "english" else "hi", txt, en)
                    self.reg[len(arr)]["mixed"] = typ == "hinglish"
                    with open(os.path.join(folder, "audio", f"{k:03d}_{spk}.wav"), "wb") as f:
                        f.write(pc.wav_bytes(arr))
        with open(os.path.join(folder, "sentences.csv"), "w", newline="", encoding="utf-8-sig") as f:
            w = csv.DictWriter(f, fieldnames=list(rows[0]))
            w.writeheader()
            w.writerows(rows)


FAKE = Fake()
OVERRIDE = {}
if FAKE_MODE:
    OVERRIDE["load"] = "import polyglot_core as pc\nINFO = FAKE.install(pc)\nprint(INFO)"
    OVERRIDE["fleurs"] = ("import numpy as np, pandas as pd\nSIDS, text, audio = FAKE.fleurs(LANGS_TESTED, N_PER_LANG)\n"
                          "FAKE.hinglish(pc, HINGLISH_DIR)\nprint(len(SIDS), 'fake sentences')")

# ---- run ------------------------------------------------------------------------------
nb = json.load(open(os.path.join(ROOT, "polyglot_eval.ipynb"), encoding="utf8"))
G = {"__name__": "__main__", "FAKE": FAKE}
launched = []
os.chdir(tmp)   # the notebook also writes results.json to the current folder: keep test output out of the project
if not FAKE_MODE:
    os.environ["POLYGLOT_COMPARE_ON_CPU"] = "1"   # exercise the model-swap cell here, with a tiny model
for cell in nb["cells"]:
    if cell["cell_type"] != "code":
        continue
    cid = cell["metadata"]["id"]
    src = "".join(cell["source"])
    if src.startswith("%%writefile"):
        continue
    src = OVERRIDE.get(cid, src)
    if cid == "setup" and not FAKE_MODE:
        # On the laptop the big model is too slow, so the real check uses small as main and tiny as second.
        assert 'ASR_MODEL = "openai/whisper-large-v3"' in src and 'COMPARE_ASR_MODEL = "openai/whisper-small"' in src
        src = src.replace('COMPARE_ASR_MODEL = "openai/whisper-small"', 'COMPARE_ASR_MODEL = "openai/whisper-tiny"')
        src = src.replace('ASR_MODEL = "openai/whisper-large-v3"', 'ASR_MODEL = "openai/whisper-small"')
    if cid == "hinglish_load" and args.hinglish:
        shutil.copytree(args.hinglish, G["HINGLISH_DIR"], dirs_exist_ok=True)
    print(f"\n{'=' * 30} cell: {cid} {'=' * 30}", flush=True)
    exec(compile(src, f"<cell {cid}>", "exec"), G)
    if cid == "setup":
        try:
            import gradio as gr

            gr.Blocks.launch = lambda self, *a, **k: launched.append(self) or print("(launch skipped in test)")
            G["RUN_RECORDER"] = True
        except ImportError:
            G["RUN_DEMO"] = G["RUN_RECORDER"] = False
            print("(gradio not installed here: demo and recorder cells are skipped)")

# ---- checks ---------------------------------------------------------------------------
print(f"\n{'=' * 30} checks {'=' * 30}")
res = json.load(open(os.path.join(G["RESULTS_DIR"], "results.json"), encoding="utf8"))
assert set(res) >= {"generated", "asr", "mt", "latencyMs", "worst"}, sorted(res)
assert res.get("hinglish", {}) is not None, "hinglish must be left out, never null"
for l in G["LANGS_TESTED"]:
    assert 0 <= res["asr"][l]["wer"] and res["asr"][l]["n"] == len(G["SIDS"]), res["asr"][l]
for pair, v in res["mt"].items():
    assert "chrf" in v["nllb"] and isinstance(v["n"], int), (pair, v)
assert set(res["latencyMs"]) >= {"asr", "mt", "tts"}
for w in res["worst"]:
    assert set(w) >= {"lang", "input", "model", "correct", "why"}, w
    assert all(isinstance(w[k], str) for k in ("lang", "input", "model", "correct", "why")), w
print("first five failures shown on the Results page:", [(w["task"], w.get("pair", w["lang"])) for w in res["worst"][:5]])
if G.get("HAVE_HINGLISH"):
    h = res["hinglish"]
    assert set(h) >= {"baseline", "fix", "n"} and "chrf" in h["baseline"] and "chrf" in h["fix"], h
    assert res["asr"]["hinglish"]["wer"] is None
    print("hinglish:", json.dumps({k: h[k] for k in ("baseline", "fix", "variants", "n", "sentences", "speakers")}, ensure_ascii=False))
if "demo_run" in G:
    clip = (48000, (np.random.default_rng(0).normal(0, 3000, 48000)).astype(np.int16))
    if FAKE_MODE:
        clip = G["audio"]["hi"][G["SIDS"][0]]
    out = G["demo_run"](clip, "hi", "en", "nllb")
    assert isinstance(out[0], str) and isinstance(out[1], str), out
    print("demo_run ok:", out[1][:60], "|", out[3])
if "rec_save" in G:
    i2, _, _, msg = G["rec_save"](0, "Test Person", (16000, np.zeros(16000, np.int16)))
    assert "Saved" in msg, msg
    print("recorder ok:", msg)
print("results.json keys ok. files:", sorted(os.listdir(G["RESULTS_DIR"])))
print("tables shown:", shown["tables"], "audio players:", shown["audio"], "gradio apps:", len(launched))
if not args.keep:
    shutil.rmtree(tmp, ignore_errors=True)
print("\nALL CELLS RAN")
