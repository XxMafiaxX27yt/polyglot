"""Builds polyglot_eval.ipynb from the cells below plus polyglot_core.py.

    python dev/build_notebook.py

Edit the cells here (not the .ipynb), then rebuild. The notebook embeds polyglot_core.py
with %%writefile, so the notebook is self-contained and the .py stays the single source.
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
CELLS = []

# The team's chosen Hinglish sentences travel inside the notebook, so nobody has to upload a file.
_sent_file = os.path.join(ROOT, "sentences.csv")
DEFAULT_SENTENCES = open(_sent_file, encoding="utf8").read() if os.path.exists(_sent_file) else ""
# The new sentences for the second Hinglish test (see SECOND_TEST_PLAN.md).
_conf_file = os.path.join(ROOT, "sentences_confirm.csv")
DEFAULT_CONFIRM = open(_conf_file, encoding="utf8").read() if os.path.exists(_conf_file) else ""


def md(cid, text):
    CELLS.append(("markdown", cid, text.strip("\n")))


def code(cid, text):
    CELLS.append(("code", cid, text.strip("\n")))


# =============================================================================
md("intro", r'''
# Polyglot: speak your language, hear theirs

**Veritas AI International High School Hackathon 2026 · Track: AI + Languages**

Polyglot turns speech in one language into speech in another, so two people who share no language can talk. This notebook is the AI behind it, and the test of how well it really works.

**Our question.** People in India mix Hindi and English inside one sentence: *"Kal meeting hai, so please complete the presentation."* Does speech translation still work on that, and can we make it work better?

| Part | What it does |
|---|---|
| 1 to 5 | Builds the pipeline from free, open models: Whisper (speech to text), NLLB-200 (translation), MMS-TTS (voice) |
| 6 to 10 | Tests it on the same sentences spoken in Hindi, Tamil, Bengali and English, against simple baselines |
| 11 to 14 | Tests it on our own Hinglish recordings and picks the best way to handle them |
| 15 to 17 | Shows the worst mistakes side by side, saves the results, and runs a live demo |

**To run it:** `Runtime` → `Change runtime type` → `T4 GPU`, then `Runtime` → `Run all`. A full run took about 25 minutes with the small speech model and takes longer with the big one. Tick `QUICK_TEST` in the first cell for a short run on 10 sentences per language.
''')

code("setup", r'''
#@title 1 · Setup and settings
import os, sys, subprocess, importlib, importlib.util, warnings, json, time, re, random, math, unicodedata, glob, tempfile
warnings.filterwarnings("ignore")
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")

def ensure(*pkgs):
    """Install anything that is missing."""
    missing = [p for p in pkgs if importlib.util.find_spec(p) is None]
    if missing:
        print("Installing", ", ".join(missing), "...")
        subprocess.run([sys.executable, "-m", "pip", "install", "-q", *missing], check=True)
        importlib.invalidate_caches()

ensure("sacrebleu", "jiwer", "rapidfuzz", "soundfile", "gradio")

# ---------------- settings you can change ----------------
QUICK_TEST = False        #@param {type:"boolean"}
N_PER_LANG = 100          #@param {type:"integer"}
USE_GOOGLE_DRIVE = True   #@param {type:"boolean"}
ASR_MODEL = "openai/whisper-large-v3"  #@param ["openai/whisper-small", "openai/whisper-medium", "openai/whisper-large-v3"]
COMPARE_ASR_MODEL = "openai/whisper-small"  #@param ["", "openai/whisper-small", "openai/whisper-medium", "openai/whisper-large-v3", "openai/whisper-large-v3-turbo"]
HINGLISH_SHEET = ""       #@param {type:"string"}
RUN_RECORDER = False      #@param {type:"boolean"}
RUN_RATER = True          #@param {type:"boolean"}
RUN_DEMO = True           #@param {type:"boolean"}
ELEVEN_VOICES = 2         #@param {type:"integer"}
ELEVEN_VOICE_NAMES = ""   #@param {type:"string"}
ELEVEN_MODEL = "eleven_v4"  #@param ["eleven_v4", "eleven_v3", "eleven_multilingual_v2"]
# ----------------------------------------------------------
LANGS_TESTED = ["hi", "ta", "bn", "en"]
SEED = 13
if QUICK_TEST:
    N_PER_LANG = 10
N_PER_LANG = int(os.environ.get("POLYGLOT_N", N_PER_LANG))

try:
    import google.colab  # noqa: F401
    IN_COLAB = True
except ImportError:
    IN_COLAB = False

DATA_DIR = "/content/polyglot" if IN_COLAB else os.path.abspath("polyglot_data")
if IN_COLAB and USE_GOOGLE_DRIVE:
    try:
        from google.colab import drive
        drive.mount("/content/drive")
        DATA_DIR = "/content/drive/MyDrive/polyglot"
    except Exception as e:
        print("Google Drive was not connected, so files are kept only until this session ends.", e)
DATA_DIR = os.environ.get("POLYGLOT_DATA", DATA_DIR)
RESULTS_DIR = os.path.join(DATA_DIR, "results")
HINGLISH_DIR = os.path.join(DATA_DIR, "hinglish")
CONFIRM_DIR = os.path.join(DATA_DIR, "hinglish_confirm")     # new sentences for the second Hinglish test
for d in (RESULTS_DIR, os.path.join(HINGLISH_DIR, "audio"), os.path.join(CONFIRM_DIR, "audio")):
    os.makedirs(d, exist_ok=True)

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
if IN_COLAB and not GEMINI_API_KEY:
    try:
        from google.colab import userdata
        GEMINI_API_KEY = userdata.get("GEMINI_API_KEY") or ""
    except Exception:
        pass

ELEVENLABS_API_KEY = os.environ.get("ELEVENLABS_API_KEY", "")
if IN_COLAB and not ELEVENLABS_API_KEY:
    try:
        from google.colab import userdata
        ELEVENLABS_API_KEY = userdata.get("ELEVENLABS_API_KEY") or ""
    except Exception:
        pass

print("Sentences per language:", N_PER_LANG)
print("Data folder:", DATA_DIR)
print("Gemini comparison:", "on" if GEMINI_API_KEY else "off (add a Colab secret called GEMINI_API_KEY to turn it on)")
print("Computer-made Hinglish voices:", "on" if ELEVENLABS_API_KEY else "off (add a Colab secret called ELEVENLABS_API_KEY to turn it on)")
''')

md("voices_md", r'''
## 1b · Hinglish sentences, and computer-made voices for them

Our Hinglish sentences travel inside this notebook. If an ElevenLabs key is set, this cell asks ElevenLabs (a text-to-speech service) to read every sentence aloud and saves the clips next to any recordings made by people. Those clips are **computer-made speech, not real speakers**. Their file names start with `tts-`, and every table below keeps them apart from human recordings.

This runs early so that a wrong key or an empty quota shows up in the first minute, not at the end of the run. Clips already on disk are not made again.
''')

code("voices", r'''
#@title 1b · Load the Hinglish sentences and make computer voices (only if a key is set)
import urllib.request, urllib.error
import pandas as pd
AUDIO_EXT =(".wav", ".m4a", ".mp3", ".ogg", ".webm", ".flac", ".aac", ".opus", ".mp4", ".3gp", ".amr")
DEFAULT_SENTENCES = __DEFAULT_SENTENCES__
DEFAULT_CONFIRM = __DEFAULT_CONFIRM__

def sheet_csv_url(link):
    m = re.search(r"/spreadsheets/d/([\w-]+)", link)
    if not m:
        return link
    gid = re.search(r"[#&?]gid=(\d+)", link)
    return f"https://docs.google.com/spreadsheets/d/{m.group(1)}/export?format=csv" + (f"&gid={gid.group(1)}" if gid else "")

def load_sentences(folder=None):
    """The first test's sentences, or the sentences in `folder` (used for the second test)."""
    if folder is None and HINGLISH_SHEET.strip():
        src = sheet_csv_url(HINGLISH_SHEET.strip())
    else:
        src = os.path.join(folder or HINGLISH_DIR, "sentences.csv")
        if not os.path.exists(src):
            return None
    df = pd.read_csv(src)
    ren = {}
    for c in df.columns:                      # accept friendly column names
        k = str(c).strip().lower()
        if k in ("id", "number", "no", "no.", "#", "s.no", "sr"): name = "id"
        elif "hinglish" in k or k in ("text", "sentence", "say this"): name = "text"
        elif "english" in k: name = "english"
        elif "difficult" in k: name = "difficulty"
        elif k in ("type", "kind", "style"): name = "type"
        elif k in ("group", "set", "match"): name = "group"
        else: continue
        if name not in ren.values():
            ren[c] = name
    df = df.rename(columns=ren)
    if "text" not in df or "english" not in df:
        raise ValueError(f"sentences need a 'text' and an 'english' column. Found: {list(df.columns)}")
    if "id" not in df:
        df["id"] = range(1, len(df) + 1)
    df["id"] = pd.to_numeric(df["id"], errors="coerce")
    df = df.dropna(subset=["id", "text", "english"]).copy()
    df["id"] = df["id"].astype(int)
    df["type"] = df["type"].fillna("hinglish").astype(str).str.strip().str.lower() if "type" in df else "hinglish"
    if "group" not in df:
        df["group"] = df["id"]
    for c in ("text", "english"):
        df[c] = df[c].astype(str).str.strip()
    return df.drop_duplicates("id").set_index("id")

def eleven_request(url, body=None):
    req = urllib.request.Request(url, data=None if body is None else json.dumps(body).encode("utf8"),
                                 headers={"xi-api-key": ELEVENLABS_API_KEY, "Content-Type": "application/json"},
                                 method="GET" if body is None else "POST")
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return r.read()
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"ElevenLabs answered {e.code}: {e.read().decode('utf8', 'replace')[:400]}")

def eleven_left():
    """Characters left in the ElevenLabs quota, or None if the key may not read it."""
    try:
        s = json.loads(eleven_request("https://api.elevenlabs.io/v1/user/subscription"))
        return int(s["character_limit"]) - int(s["character_count"])
    except Exception:
        return None

def make_computer_voices(sent, folder=None):
    """Ask ElevenLabs to read each sentence. Saved as <id>_tts-<voice>.mp3, so they are never mistaken for people.
    One voice reads every sentence before the next voice starts, so a small quota still covers every sentence once."""
    global ELEVEN_MODEL
    adir = os.path.join(folder or HINGLISH_DIR, "audio")
    try:
        listed = json.loads(eleven_request("https://api.elevenlabs.io/v2/voices?page_size=100"))["voices"]
    except Exception:
        listed = json.loads(eleven_request("https://api.elevenlabs.io/v1/voices"))["voices"]
    # Free accounts may only use ElevenLabs' own default ("premade") voices through the API, so those go first.
    voices = sorted([v for v in listed if v.get("name")], key=lambda v: (v.get("category") != "premade", v["name"]))
    wanted = [w.strip().lower() for w in ELEVEN_VOICE_NAMES.split(",") if w.strip()]
    if wanted:
        voices = [v for v in voices if any(w in v["name"].lower() for w in wanted)]
    if not voices:
        raise RuntimeError("No ElevenLabs voice matched ELEVEN_VOICE_NAMES.")
    need, used, made, chars, refused = max(1, int(ELEVEN_VOICES)), [], 0, 0, 0
    for v in voices:
        if len(used) >= need or refused >= 12:
            break
        tag = "tts-" + (re.sub(r"[^a-z0-9]+", "", v["name"].lower())[:14] or v["voice_id"][:8].lower())
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{v['voice_id']}?output_format=mp3_44100_128"
        made_here = 0
        try:
            for sid, row in sent.iterrows():
                path = os.path.join(adir, f"{int(sid):03d}_{tag}.mp3")
                if os.path.exists(path) and os.path.getsize(path) > 1000:
                    continue
                try:
                    mp3 = eleven_request(url, {"text": row.text, "model_id": ELEVEN_MODEL})
                except RuntimeError as e:
                    if "model" not in str(e).lower() or made or ELEVEN_MODEL == "eleven_multilingual_v2":
                        raise
                    print(f"{ELEVEN_MODEL} was refused ({str(e)[:200]}). Trying eleven_multilingual_v2 instead.")
                    ELEVEN_MODEL = "eleven_multilingual_v2"
                    mp3 = eleven_request(url, {"text": row.text, "model_id": ELEVEN_MODEL})
                with open(path, "wb") as f:
                    f.write(mp3)
                made += 1; made_here += 1; chars += len(row.text)
                time.sleep(0.3)
        except RuntimeError as e:
            if made_here == 0 and ("paid_plan_required" in str(e) or "library voices" in str(e)):
                refused += 1                      # this voice is not open to a free account: try the next one
                print(f"  voice '{v['name']}' needs a paid plan, skipped.")
                continue
            raise
        used.append(v["name"])
    if not used:
        raise RuntimeError("No voice on this account can be used through the API on the free plan.")
    print(f"Computer voices used: {', '.join(used)} (model {ELEVEN_MODEL}).")
    print(f"Made {made} new clips ({chars} characters of quota). Clips already saved were kept.")

_sent_path = os.path.join(HINGLISH_DIR, "sentences.csv")
if DEFAULT_SENTENCES and not HINGLISH_SHEET.strip() and not os.path.exists(_sent_path):
    with open(_sent_path, "w", encoding="utf8", newline="") as f:
        f.write(DEFAULT_SENTENCES)
    print("Wrote the sentence list that came with this notebook to", _sent_path)

_conf_path = os.path.join(CONFIRM_DIR, "sentences.csv")
if DEFAULT_CONFIRM and not os.path.exists(_conf_path):
    with open(_conf_path, "w", encoding="utf8", newline="") as f:
        f.write(DEFAULT_CONFIRM)
    print("Wrote the second test's sentence list to", _conf_path)

sent = load_sentences()
c_sent = load_sentences(CONFIRM_DIR)
print("Hinglish sentences, first test:", "none yet" if sent is None else f"{len(sent)} rows ({', '.join(f'{n} {t}' for t, n in sent.type.value_counts().items())})")
print("Hinglish sentences, second test:", "none yet" if c_sent is None else f"{len(c_sent)} rows")
if ELEVENLABS_API_KEY:
    left = eleven_left()
    print("ElevenLabs characters left:", "could not be read" if left is None else left)
    for _name, _s, _folder in (("first test", sent, None), ("second test", c_sent, CONFIRM_DIR)):
        if _s is None:
            continue
        print(f"Voices for the {_name}:")
        try:
            make_computer_voices(_s, _folder)
        except Exception as e:
            print("  Computer voices were NOT finished:", str(e)[:500])
            print("  The notebook carries on with whatever recordings already exist.")
elif sent is not None:
    print("No ElevenLabs key, so no computer voices are made. Human recordings in the audio folders are still used.")
'''.replace("__DEFAULT_SENTENCES__", repr(DEFAULT_SENTENCES)).replace("__DEFAULT_CONFIRM__", repr(DEFAULT_CONFIRM)))

md("core_md", r'''
## 2 · The pipeline

The next cell is the whole AI core, saved as `polyglot_core.py` so the live app can import the same code. Four functions matter:

- `transcribe(audio)` : speech to text (Whisper). It also reports which language it heard.
- `translate(text, src, tgt)` : text to text (NLLB-200, or Gemini as a comparison).
- `synthesize(text, lang)` : text to speech (MMS-TTS).
- `translate_speech(audio, targets)` : all three, once per listener language.
''')

with open(os.path.join(ROOT, "polyglot_core.py"), encoding="utf8") as f:
    CORE_SRC = f.read()
code("core", "%%writefile polyglot_core.py\n" + CORE_SRC)

code("load", r'''
#@title 3 · Load the models
import polyglot_core as pc
importlib.reload(pc)

pc.CONFIG["asr_model"] = ASR_MODEL
pc.CONFIG["min_rms"] = 0.0   # score every test clip. FLEURS English is recorded very quietly, and a loudness check would drop it.
if GEMINI_API_KEY:
    os.environ["GEMINI_API_KEY"] = GEMINI_API_KEY
    pc.CONFIG["gemini_min_interval"] = 4.5   # stay under the free tier's requests-per-minute limit

INFO = pc.warmup(langs=("hi", "en"))
print(json.dumps(INFO, indent=2))
if INFO["device"] != "cuda":
    print("\nNO GPU FOUND, so this will be slow. Use Runtime > Change runtime type > T4 GPU.")
    if not QUICK_TEST and "POLYGLOT_N" not in os.environ:
        N_PER_LANG = min(N_PER_LANG, 10)
        print("Using only", N_PER_LANG, "sentences per language so the run can finish.")
''')

md("data_md", r'''
## 4 · Test data: the same sentences in four languages

We use **FLEURS** (Google), a public set of short sentences read aloud by native speakers in 102 languages. The sentences are professional translations of each other, so sentence 1234 in Hindi means the same as sentence 1234 in Tamil.

We pick sentences at random (fixed seed) from the **test split**, and use the *same* sentences in every language. Any difference between languages then comes from the language, not from easier or harder sentences. None of our models were trained on this data.
''')

code("fleurs", r'''
#@title 4 · Download the test data
import tarfile
import numpy as np, pandas as pd
from huggingface_hub import hf_hub_download
pd.set_option("display.max_colwidth", 220); pd.set_option("display.width", 250)

FLEURS_REPO = "google/fleurs"

def _unquote(t):
    """Some FLEURS rows are wrapped in spreadsheet-style quotes ("a ""b"" c"). Undo that."""
    t = t.strip()
    if len(t) > 1 and t[0] == '"' and t[-1] == '"' and '""' in t:
        t = t[1:-1].replace('""', '"')
    return t

def fleurs_meta(lang, split="test"):
    """One row per sentence: id -> audio file name and the written sentence."""
    cfg = pc.LANGS[lang]["fleurs"]
    path = hf_hub_download(FLEURS_REPO, f"data/{cfg}/{split}.tsv", repo_type="dataset")
    rows = []
    with open(path, encoding="utf8") as f:
        for line in f:
            p = line.rstrip("\n").split("\t")
            if len(p) >= 3 and p[0].strip().isdigit():
                rows.append((int(p[0]), p[1], _unquote(p[2])))
    return pd.DataFrame(rows, columns=["id", "file", "text"]).drop_duplicates("id").set_index("id")

def fleurs_audio(lang, meta, ids, split="test"):
    """Read only the clips we need from the archive: {sentence id: waveform at 16 kHz}."""
    cfg = pc.LANGS[lang]["fleurs"]
    path = hf_hub_download(FLEURS_REPO, f"data/{cfg}/audio/{split}.tar.gz", repo_type="dataset")
    want = {meta.loc[s, "file"]: s for s in ids}
    out = {}
    with tarfile.open(path, "r:gz") as tar:
        for m in tar:
            name = os.path.basename(m.name)
            if m.isfile() and name in want:
                out[want[name]] = pc.load_audio(tar.extractfile(m).read())
                if len(out) == len(want):
                    break
    return out

t0 = time.time()
fl = {l: fleurs_meta(l) for l in LANGS_TESTED}
common = sorted(set.intersection(*[set(m.index) for m in fl.values()]))
random.Random(SEED).shuffle(common)
SIDS = sorted(common[:N_PER_LANG])
text = {l: {s: str(fl[l].loc[s, "text"]) for s in SIDS} for l in LANGS_TESTED}
audio = {l: fleurs_audio(l, fl[l], SIDS) for l in LANGS_TESTED}
assert all(len(audio[l]) == len(SIDS) for l in LANGS_TESTED), "some clips are missing"

print(f"{len(common)} sentences exist in all {len(LANGS_TESTED)} languages. Using {len(SIDS)} of them.")
for l in LANGS_TESTED:
    mins = sum(len(a) for a in audio[l].values()) / pc.SR / 60
    print(f"  {pc.LANGS[l]['name']:8s} {len(audio[l])} clips, {mins:.1f} minutes of speech")
print(f"Loaded in {time.time() - t0:.0f} s.\n\nThe same sentence in each language:")
for l in LANGS_TESTED:
    print(f"  [{l}] {text[l][SIDS[0]]}")
''')

code("example", r'''
#@title 5 · One example, start to finish
from IPython.display import Audio, display

sid = SIDS[0]
clip = audio["hi"][sid]
print("INPUT: a Hindi speaker says this.")
display(Audio(clip, rate=pc.SR))

res = pc.translate_speech(clip, ["en", "ta"], lang_hint="hi")
print("Polyglot heard :", res["original"])
print("Actually said  :", text["hi"][sid])
for c in ["en", "ta"]:
    out = res["results"][c]
    print(f"\nOUTPUT in {pc.LANGS[c]['name']}: {out['text']}")
    print(f"A human translator wrote: {text[c][sid]}")
    if out["wav"]:
        display(Audio(out["wav"]))
print("\nTime per step (ms):", res["stageMs"])
''')

md("metrics_md", r'''
## 6 · How we score

- **Speech to text: word error rate (WER).** The share of words that are wrong, missing or extra. 0% is perfect. We also give the character error rate (CER), which is fairer for languages with long joined-up words such as Tamil.
- **Translation: chrF.** How much of the human translation's characters and word pieces the model's translation also has. 0 to 100, higher is better.
- **Every score comes with a 95% range**, from re-sampling the test sentences. If two ranges overlap a lot, the difference may just be luck.

Before scoring we lower-case the text and strip punctuation. We wrote our own cleaner because Whisper's standard one deletes the vowel signs of Indian scripts, which makes the scores wrong.
''')

code("metrics", r'''
#@title 6 · Scoring functions
import jiwer, sacrebleu
from rapidfuzz.distance import Levenshtein

def norm_text(s):
    """Lower-case, drop punctuation, keep letters, digits and the vowel signs of Indian scripts."""
    s = unicodedata.normalize("NFKC", str(s if s is not None else "")).lower()
    out = []
    for ch in s:
        cat = unicodedata.category(ch)
        if cat[0] in "LMN":
            out.append(ch)
        elif ch in "'’" or cat == "Cf":
            continue                      # don't -> dont ; invisible joiners
        else:
            out.append(" ")
    return " ".join("".join(out).split())

def wer_parts(ref, hyp):
    r, h = norm_text(ref).split(), norm_text(hyp).split()
    return Levenshtein.distance(r, h), len(r)

def cer_parts(ref, hyp):
    r, h = norm_text(ref), norm_text(hyp)
    return Levenshtein.distance(r, h), len(r)

def chrf(hyps, refs):
    return sacrebleu.corpus_chrf(list(hyps), [list(refs)]).score

def chrf1(hyp, ref):
    return sacrebleu.sentence_chrf(str(hyp), [str(ref)]).score

def boot_ci(n, stat, n_boot=300, seed=SEED):
    """95% range of stat(idx) when the n test items are re-sampled with replacement."""
    r = np.random.default_rng(seed)
    vals = [stat(r.integers(0, n, n)) for _ in range(n_boot)]
    return float(np.percentile(vals, 2.5)), float(np.percentile(vals, 97.5))

def chrf_ci(hyps, refs, n_boot=100):
    hyps, refs = list(hyps), list(refs)
    lo, hi = boot_ci(len(refs), lambda i: chrf([hyps[j] for j in i], [refs[j] for j in i]), n_boot)
    return chrf(hyps, refs), lo, hi

def chrf_gain_ci(base, new, refs, n_boot=100):
    """How much better `new` is than `base` on the same sentences (chrF points) with its 95% range."""
    base, new, refs = list(base), list(new), list(refs)
    f = lambda i: chrf([new[j] for j in i], [refs[j] for j in i]) - chrf([base[j] for j in i], [refs[j] for j in i])
    lo, hi = boot_ci(len(refs), f, n_boot)
    return chrf(new, refs) - chrf(base, refs), lo, hi

def pick(probs, allowed=None):
    """Most likely language, optionally only among `allowed`."""
    items = probs.items() if allowed is None else [(c, probs.get(c, 0.0)) for c in allowed]
    return max(items, key=lambda kv: kv[1])[0]

print(norm_text("Don't STOP!  कल मीटिंग है, ठीक?"), "|", wer_parts("a b c d", "a x c"), "|", round(chrf1("hello there", "hello here"), 1))
''')

md("asr_md", r'''
## 7 · Speech to text, language by language

Whisper has to decide which language it is hearing before it writes anything. We compare three ways of deciding:

1. **Baseline: auto.** Whisper guesses among all 99 languages it knows. This is what you get out of the box.
2. **Room.** Whisper may only choose a language that someone in the call speaks (here: the four we test).
3. **Hint.** Each speaker tells the app their language once, when they join. This is what Polyglot does.
''')

code("asr", r'''
#@title 7 · Speech-to-text test
import matplotlib.pyplot as plt

lid = {}                                   # (lang, sentence) -> Whisper's language probabilities
for l in LANGS_TESTED:
    for s, p in zip(SIDS, pc.detect_language_batch([audio[l][s] for s in SIDS])):
        lid[(l, s)] = p

COND = {"auto": lambda l, p: pick(p), "room": lambda l, p: pick(p, LANGS_TESTED), "hint": lambda l, p: l}
COND_LABEL = {"auto": "Baseline: auto (99 languages)", "room": "Room (4 languages)", "hint": "Hint (speaker's language)"}

asr_cache = {}                             # (lang, sentence, language Whisper was told to write) -> transcript
def transcribe_forced(keys):
    todo = {}
    for k in dict.fromkeys(keys):
        if k not in asr_cache:
            todo.setdefault(k[2], []).append(k)
    for forced, ks in todo.items():
        outs = pc.transcribe_batch([audio[l][s] for l, s, _ in ks], lang_hint=forced, with_probs=False)
        for k, o in zip(ks, outs):
            asr_cache[k] = o["text"]

t0 = time.time()
transcribe_forced([(l, s, fn(l, lid[(l, s)])) for l in LANGS_TESTED for s in SIDS for fn in COND.values()])

rows = []
for l in LANGS_TESTED:
    for s in SIDS:
        for c, fn in COND.items():
            used = fn(l, lid[(l, s)])
            hyp = asr_cache[(l, s, used)]
            e, n = wer_parts(text[l][s], hyp)
            ce, cn = cer_parts(text[l][s], hyp)
            rows.append(dict(lang=l, sid=s, cond=c, used_lang=used, ref=text[l][s], hyp=hyp, werr=e, wn=n, cerr=ce, cn=cn))
asr_df = pd.DataFrame(rows)

def asr_table(df):
    out = []
    for (l, c), g in df.groupby(["lang", "cond"], sort=False):
        e, n = g.werr.to_numpy(), g.wn.to_numpy()
        lo, hi = boot_ci(len(g), lambda i: e[i].sum() / max(n[i].sum(), 1))
        out.append({"lang": l, "cond": c, "Language": pc.LANGS[l]["name"], "Setting": COND_LABEL[c],
                    "WER %": 100 * e.sum() / max(n.sum(), 1), "WER 95% range": f"{100 * lo:.1f} to {100 * hi:.1f}",
                    "CER %": 100 * g.cerr.sum() / max(g.cn.sum(), 1),
                    "Right language %": 100 * float((g.used_lang == g.lang).mean()), "Clips": len(g)})
    return pd.DataFrame(out)

asr_sum = asr_table(asr_df)
print(f"Done in {time.time() - t0:.0f} s. Lower WER is better.\n")
display(asr_sum.drop(columns=["lang", "cond"]).round(1))

g = asr_df[(asr_df.lang == "en") & (asr_df.cond == "hint")]
print(f"Check against the jiwer library (English): ours {g.werr.sum() / g.wn.sum():.4f}, "
      f"jiwer {jiwer.wer([norm_text(x) for x in g.ref], [norm_text(x) for x in g.hyp]):.4f}")

print("\nWhat language did the baseline think it heard? (rows: true language)")
auto = asr_df[asr_df.cond == "auto"]
display(pd.crosstab(auto.lang, auto.used_lang))

piv = asr_sum.pivot(index="Language", columns="Setting", values="WER %")[list(COND_LABEL.values())]
ax = piv.plot(kind="bar", figsize=(8, 4), rot=0)
ax.set_ylabel("Word error rate % (lower is better)"); ax.set_xlabel(""); ax.set_title(f"Speech to text on FLEURS ({len(SIDS)} sentences per language)")
plt.tight_layout(); plt.savefig(os.path.join(RESULTS_DIR, "fig_speech_to_text.png"), dpi=150); plt.show()
''')

md("asr_big_md", r'''
### 7b · Does the size of the speech model matter?

`whisper-small` is the model the hackathon brief suggests, and it is fast. Whisper also comes in bigger sizes that have heard far more speech. Our first full run used `whisper-small` and it made too many mistakes in Hindi, Tamil and Bengali, so the main model is now `whisper-large-v3`. Here the same clips go through the second model chosen in the first cell, with the speaker's language given to both, so the only thing that changes is the model.
''')

code("asr_big", r'''
#@title 7b · Compare a second speech model
BIG, big_df = None, None
RUN_BIG = bool(COMPARE_ASR_MODEL) and COMPARE_ASR_MODEL != ASR_MODEL and (INFO["device"] == "cuda" or bool(os.environ.get("POLYGLOT_COMPARE_ON_CPU")))
if RUN_BIG:
    t0 = time.time()
    try:
        pc.set_asr_model(COMPARE_ASR_MODEL)
        rows = []
        for l in LANGS_TESTED:
            outs = pc.transcribe_batch([audio[l][s] for s in SIDS], lang_hint=l, with_probs=False, batch_size=8)
            for s, o in zip(SIDS, outs):
                e, n = wer_parts(text[l][s], o["text"])
                ce, cn = cer_parts(text[l][s], o["text"])
                rows.append(dict(lang=l, sid=s, ref=text[l][s], hyp=o["text"], werr=e, wn=n, cerr=ce, cn=cn))
        big_df = pd.DataFrame(rows)
    except Exception as e:
        print("The second model could not be run, so this comparison is skipped:", str(e)[:300])
    finally:
        pc.set_asr_model(ASR_MODEL)            # back to the main model for the rest of the notebook

if big_df is not None:
    small = asr_df[asr_df.cond == "hint"]
    out = []
    for l in LANGS_TESTED:
        a, b = small[small.lang == l], big_df[big_df.lang == l]
        ea, eb, n = a.werr.to_numpy(), b.werr.to_numpy(), a.wn.to_numpy()
        lo, hi = boot_ci(len(a), lambda i: (eb[i].sum() - ea[i].sum()) / max(n[i].sum(), 1))
        out.append({"lang": l, "Language": pc.LANGS[l]["name"],
                    "wer_main": 100 * ea.sum() / n.sum(), "wer_big": 100 * eb.sum() / n.sum(),
                    "change": 100 * (eb.sum() - ea.sum()) / n.sum(), "Change 95% range": f"{100 * lo:+.1f} to {100 * hi:+.1f}",
                    "cer_main": 100 * a.cerr.sum() / a.cn.sum(), "cer_big": 100 * b.cerr.sum() / b.cn.sum()})
    BIG = pd.DataFrame(out)
    m, b = ASR_MODEL.split("/")[-1], COMPARE_ASR_MODEL.split("/")[-1]
    print(f"Done in {time.time() - t0:.0f} s. Both models were given the speaker's language. Lower is better.\n")
    display(BIG.rename(columns={"wer_main": f"WER % {m}", "wer_big": f"WER % {b}", "change": "WER change (points)",
                                "cer_main": f"CER % {m}", "cer_big": f"CER % {b}"}).drop(columns=["lang"]).round(1))
elif not RUN_BIG:
    print("Skipped: no second model chosen, or there is no GPU.")
''')

md("mt_md", r'''
## 8 · Translation, pair by pair

Here the input is the correct written sentence, so this measures translation alone. Each model is compared with:

- **Baseline: no translation.** Just hand back the source sentence. For two languages in different scripts this scores close to zero, and that is the point: it is the floor every translator must beat.
- **Gemini** (when a key is set), a large general model, as an outside comparison. Gemini may have seen these public sentences on the web, so its score here could be flattering.
''')

code("mt", r'''
#@title 8 · Translation test
PAIRS = [("hi", "en"), ("ta", "en"), ("bn", "en"), ("en", "hi"), ("en", "ta"), ("en", "bn"), ("hi", "ta")]
ENGINE_LABEL = {"copy": "Baseline: no translation", "nllb": "NLLB-200 (ours)", "gemini": "Gemini (comparison)"}

_gem_path = os.path.join(RESULTS_DIR, "gemini_cache.json")
_gem_cache = json.load(open(_gem_path, encoding="utf8")) if os.path.exists(_gem_path) else {}

def gemini_translate(texts, src, tgt):
    """Gemini translations, remembered on disk so a re-run does not spend the free quota again."""
    key = lambda t: f"{pc.CONFIG['gemini_model']}|{src}|{tgt}|{t}"
    todo = [t for t in dict.fromkeys(texts) if key(t) not in _gem_cache]
    for a in range(0, len(todo), 20):
        part = todo[a:a + 20]
        for t, o in zip(part, pc.translate_batch(part, src, tgt, engine="gemini")):
            _gem_cache[key(t)] = o
        json.dump(_gem_cache, open(_gem_path, "w", encoding="utf8"), ensure_ascii=False)
    return [_gem_cache[key(t)] for t in texts]

GEMINI_OK = bool(GEMINI_API_KEY)
t0 = time.time()
rows = []
for src, tgt in PAIRS:
    srcs, refs = [text[src][s] for s in SIDS], [text[tgt][s] for s in SIDS]
    outs = {"copy": srcs, "nllb": pc.translate_batch(srcs, src, tgt)}
    if GEMINI_OK:
        try:
            outs["gemini"] = gemini_translate(srcs, src, tgt)
        except Exception as e:
            GEMINI_OK = False
            print("Gemini stopped answering, so the rest runs without it:", str(e)[:200])
    for eng, hyps in outs.items():
        for s, i, r, h in zip(SIDS, srcs, refs, hyps):
            rows.append(dict(pair=f"{src}-{tgt}", src=src, tgt=tgt, sid=s, engine=eng, input=i, ref=r, hyp=h, chrf=chrf1(h, r)))
mt_df = pd.DataFrame(rows)

def mt_table(df):
    out = []
    for (pair, eng), g in df.groupby(["pair", "engine"], sort=False):
        score, lo, hi = chrf_ci(g.hyp, g.ref)
        out.append({"pair": pair, "engine": eng, "Pair": f"{pc.LANGS[g.src.iloc[0]]['name']} → {pc.LANGS[g.tgt.iloc[0]]['name']}",
                    "Translator": ENGINE_LABEL[eng], "chrF": score, "lo": lo, "hi": hi,
                    "95% range": f"{lo:.1f} to {hi:.1f}", "Sentences": len(g)})
    return pd.DataFrame(out)

mt_sum = mt_table(mt_df)
print(f"Done in {time.time() - t0:.0f} s. Higher chrF is better.\n")
display(mt_sum.drop(columns=["pair", "engine", "lo", "hi"]).round(1))

piv = mt_sum.pivot(index="Pair", columns="Translator", values="chrF")
piv = piv[[c for c in ENGINE_LABEL.values() if c in piv.columns]].loc[mt_sum.Pair.drop_duplicates()]
ax = piv.plot(kind="bar", figsize=(9, 4), rot=20)
ax.set_ylabel("chrF (higher is better)"); ax.set_xlabel(""); ax.set_title(f"Translation on FLEURS ({len(SIDS)} sentences per pair)")
plt.tight_layout(); plt.savefig(os.path.join(RESULTS_DIR, "fig_translation.png"), dpi=150); plt.show()
''')

md("s2t_md", r'''
## 9 · Speech in, translated text out

In a call, translation starts from what Whisper *heard*, mistakes included. This shows how much quality is lost at each step:

- **Perfect transcript → NLLB**: the ceiling, if speech-to-text made no mistakes.
- **Whisper → NLLB**: the real pipeline (a "cascade").
- **Whisper translates directly**: Whisper can also turn speech straight into English, skipping the written Hindi or Tamil.
''')

code("s2t", r'''
#@title 9 · Speech-to-translation test
t0 = time.time()
rows = []
def gold_mt(src, tgt):
    g = mt_df[(mt_df.pair == f"{src}-{tgt}") & (mt_df.engine == "nllb")].set_index("sid")
    return [g.loc[s, "hyp"] for s in SIDS]

for src in [l for l in LANGS_TESTED if l != "en"]:
    refs = [text["en"][s] for s in SIDS]
    heard = [asr_cache[(src, s, src)] for s in SIDS]
    direct = [o["text"] for o in pc.transcribe_batch([audio[src][s] for s in SIDS], lang_hint=src, task="translate", with_probs=False)]
    for name, hyps in {"Perfect transcript → NLLB": gold_mt(src, "en"), "Whisper → NLLB": pc.translate_batch(heard, src, "en"),
                       "Whisper translates directly": direct}.items():
        for s, r, h in zip(SIDS, refs, hyps):
            rows.append(dict(pair=f"{src}-en", src=src, tgt="en", sid=s, system=name, ref=r, hyp=h))
    heard_en = [asr_cache[("en", s, "en")] for s in SIDS]
    refs = [text[src][s] for s in SIDS]
    for name, hyps in {"Perfect transcript → NLLB": gold_mt("en", src), "Whisper → NLLB": pc.translate_batch(heard_en, "en", src)}.items():
        for s, r, h in zip(SIDS, refs, hyps):
            rows.append(dict(pair=f"en-{src}", src="en", tgt=src, sid=s, system=name, ref=r, hyp=h))
s2t_df = pd.DataFrame(rows)

out = []
for (pair, system), g in s2t_df.groupby(["pair", "system"], sort=False):
    score, lo, hi = chrf_ci(g.hyp, g.ref)
    out.append({"pair": pair, "system": system, "Pair": f"{pc.LANGS[g.src.iloc[0]]['name']} speech → {pc.LANGS[g.tgt.iloc[0]]['name']} text",
                "System": system, "chrF": score, "95% range": f"{lo:.1f} to {hi:.1f}"})
s2t_sum = pd.DataFrame(out)
print(f"Done in {time.time() - t0:.0f} s. Higher chrF is better.\n")
S2T_ORDER = ["Perfect transcript → NLLB", "Whisper → NLLB", "Whisper translates directly"]
s2t_table = s2t_sum.pivot(index="Pair", columns="System", values="chrF").loc[s2t_sum.Pair.drop_duplicates(), S2T_ORDER].round(1)
display(s2t_table.astype(object).where(s2t_table.notna(), "n/a"))   # Whisper can only translate into English
''')

code("latency", r'''
#@title 10 · Speed
n_lat = min(20, len(SIDS))
rows = []
for s in SIDS[:n_lat]:
    clip = audio["hi"][s]
    r = pc.translate_speech(clip, ["en", "ta"], lang_hint="hi")
    rows.append({"clip_s": len(clip) / pc.SR, **r["stageMs"]})
lat_df = pd.DataFrame(rows)
lat_df["total"] = lat_df.asr + lat_df.mt + lat_df.tts
LAT = {k: int(lat_df[k].median()) for k in ["asr", "mt", "tts", "total"]}
print(f"One Hindi speaker, two listeners (English and Tamil), {n_lat} clips of about {lat_df.clip_s.median():.0f} s, on {INFO['gpu'] or 'CPU'}:")
print(f"  speech to text      {LAT['asr']:5d} ms")
print(f"  translation (x2)    {LAT['mt']:5d} ms")
print(f"  voice (x2)          {LAT['tts']:5d} ms")
print(f"  total (median)      {LAT['total']:5d} ms    slowest clip {int(lat_df.total.max())} ms")
print("\nThis is computing time after the speaker stops. It leaves out the network and the wait to notice that they stopped.")
''')

md("hinglish_md", r'''
## 11 · Our own data: Hinglish

FLEURS is clean, read-aloud, single-language speech. Real Indian conversation is not. So we made our own test set of Hinglish sentences. The sentences were drafted with Gemini and chosen by us.

**Where the speech comes from.** Clips recorded by team members count as real speech. Clips whose name starts with `tts-` were read by ElevenLabs, a text-to-speech service: they are computer-made, cleaner than a real person, and may not say Hinglish the way a real speaker does. The tables below say how many of each kind were used and score them apart.

**What to put in the data folder** (printed by the setup cell):

- `hinglish/sentences.csv` with the columns `id`, `type`, `text`, `english`. `type` is `hinglish`, `hindi` or `english`. `english` is the correct English translation, checked by us.
- `hinglish/audio/` with one recording per sentence and speaker, named like `007_asha.wav` (sentence id, then your name). Phone recordings (`.m4a`, `.mp3`) work too.

Or tick `RUN_RECORDER` in the first cell, and record straight from the browser with the tool below. `HINGLISH_SHEET` can point to a Google Sheet (shared as "anyone with the link") instead of the csv.

**Fair testing.** We split the *sentences* 40/60. The first part (dev) is only used to choose which method to use. All reported scores come from the second part (test), which played no part in that choice.
''')

code("hinglish_load", r'''
#@title 11 · Load our recordings
def find_recordings(folder=None):
    recs = []
    for p in sorted(glob.glob(os.path.join(folder or HINGLISH_DIR, "audio", "*"))):
        stem, ext = os.path.splitext(os.path.basename(p))
        m = re.match(r"^0*(\d+)(?:[_\- ]+(.+))?$", stem)
        if m and ext.lower() in AUDIO_EXT:
            recs.append(dict(id=int(m.group(1)), speaker=(m.group(2) or "speaker1").lower(), path=p))
    return pd.DataFrame(recs, columns=["id", "speaker", "path"])

sent = load_sentences()
recs = find_recordings()
HAVE_HINGLISH = sent is not None and len(recs) > 0 and len(set(recs.id) & set(sent.index)) >= 5
if not HAVE_HINGLISH:
    print("No Hinglish test set yet, so parts 12 to 14 are skipped.")
    print(f"  sentences: {'none' if sent is None else len(sent)}   recordings: {len(recs)}   folder: {HINGLISH_DIR}")
else:
    rec = recs.merge(sent, left_on="id", right_index=True).reset_index(drop=True)
    h_audio = [pc.load_audio(p) for p in rec.path]
    groups = sorted(set(rec.group))
    random.Random(SEED).shuffle(groups)
    n_dev = max(1, round(0.4 * len(groups)))
    DEV_GROUPS = set(groups[:n_dev])
    rec["split"] = ["dev" if g in DEV_GROUPS else "test" for g in rec.group]
    mins = sum(len(a) for a in h_audio) / pc.SR / 60
    rec["voice"] = ["computer" if s.startswith("tts") else "human" for s in rec.speaker]
    N_HUMAN, N_COMPUTER = int((rec.voice == "human").sum()), int((rec.voice == "computer").sum())
    print(f"{len(rec)} recordings of {rec.id.nunique()} sentences by {rec.speaker.nunique()} speaker(s), {mins:.1f} minutes.")
    print(f"  recorded by people: {N_HUMAN}    computer-made (ElevenLabs text-to-speech): {N_COMPUTER}")
    if N_HUMAN == 0:
        print("  NOTE: every clip here is computer-made speech. These scores show how the system handles a clean")
        print("  synthetic voice reading Hinglish. They are not a test on real speakers, and real speech is usually harder.")
    display(rec.groupby(["type", "split"]).agg(recordings=("id", "size"), sentences=("id", "nunique")))
''')

code("recorder", r'''
#@title 12 · Recording tool (tick RUN_RECORDER in the first cell)
if RUN_RECORDER and sent is None:
    print("Add hinglish/sentences.csv (or HINGLISH_SHEET) first, so the tool knows what to show.")
elif RUN_RECORDER:
    import gradio as gr

    def rec_prompt(i):
        row = sent.iloc[i]
        return f"**Sentence {i + 1} of {len(sent)}** (id {sent.index[i]}, {row['type']})\n\n# {row['text']}"

    def rec_save(i, speaker, clip):
        name = re.sub(r"\W+", "", (speaker or "").lower())
        if not name:
            return i, rec_prompt(i), clip, "Type your first name at the top first."
        if clip is None:
            return i, rec_prompt(i), clip, "Record the sentence first."
        arr = pc.load_audio(clip)
        path = os.path.join(HINGLISH_DIR, "audio", f"{int(sent.index[i]):03d}_{name}.wav")
        with open(path, "wb") as f:
            f.write(pc.wav_bytes(arr))
        j = min(i + 1, len(sent) - 1)
        return j, rec_prompt(j), None, f"Saved {os.path.basename(path)} ({len(arr) / pc.SR:.1f} s)."

    def rec_move(i, step):
        j = max(0, min(len(sent) - 1, i + step))
        return j, rec_prompt(j), None, ""

    with gr.Blocks(title="Polyglot recorder") as rec_app:
        gr.Markdown("## Polyglot recorder\nRead each sentence the way you would say it to a friend. Record only your own voice.")
        idx = gr.State(0)
        speaker = gr.Textbox(label="Your first name")
        prompt = gr.Markdown(rec_prompt(0))
        mic = gr.Audio(sources=["microphone"], type="numpy", label="Record")
        status = gr.Markdown()
        with gr.Row():
            back = gr.Button("Back")
            save = gr.Button("Save and next", variant="primary")
            skip = gr.Button("Skip")
        save.click(rec_save, [idx, speaker, mic], [idx, prompt, mic, status])
        back.click(lambda i: rec_move(i, -1), [idx], [idx, prompt, mic, status])
        skip.click(lambda i: rec_move(i, 1), [idx], [idx, prompt, mic, status])
    rec_app.launch(share=True)
    print("Send the public link only to your teammates. When everyone is done, re-run from part 11.")
''')

md("hinglish_run_md", r'''
## 13 · Does mixing languages break translation?

Each recording goes through four routes to English:

| Route | What happens |
|---|---|
| **Baseline: no translation** | Hand back the words as they were said. Hinglish is already part English, so this is not zero. |
| **Baseline: auto** | Whisper guesses the language, then NLLB translates. The out-of-the-box pipeline. |
| **Hint** | The speaker's language is given (Hindi), then NLLB translates. |
| **Pivot** | Whisper turns the speech straight into English. |
| **Hint + Gemini** | Like Hint, but Gemini does the translation (comparison only). |

We choose between the open routes on the dev sentences, then report every route on the test sentences.
''')

code("hinglish_run", r'''
#@title 13 · Hinglish test
ROUTE_LABEL = {"copy": "Baseline: no translation", "auto": "Baseline: auto → NLLB", "hint": "Hint → NLLB",
               "pivot": "Pivot: Whisper → English", "hint+gemini": "Hint → Gemini (comparison)"}
OPEN_ROUTES = ["auto", "hint", "pivot"]
HING = None

if HAVE_HINGLISH:
    t0 = time.time()
    hp = pc.detect_language_batch(h_audio)
    rec["auto_lang"] = [pick(p) for p in hp]
    rec["mix_score"] = [pc.mix_score(p) for p in hp]
    rec["hint_lang"] = rec["type"].map({"hinglish": "hi", "hindi": "hi", "english": "en"}).fillna("hi")

    def hear(langs):
        out = [""] * len(rec)
        for lang in sorted(set(langs)):
            idx = [i for i, l in enumerate(langs) if l == lang]
            for i, o in zip(idx, pc.transcribe_batch([h_audio[i] for i in idx], lang_hint=lang, with_probs=False)):
                out[i] = o["text"]
        return out

    def to_english(texts, langs, engine="nllb"):
        out = list(texts)
        for lang in sorted(set(langs) - {"en"}):
            idx = [i for i, l in enumerate(langs) if l == lang]
            part = [texts[i] for i in idx]
            done = gemini_translate(part, lang, "en") if engine == "gemini" else pc.translate_batch(part, lang, "en")
            for i, o in zip(idx, done):
                out[i] = o
        return out

    rec["heard_auto"] = hear(list(rec.auto_lang))
    rec["heard_hint"] = hear(list(rec.hint_lang))
    rec["latin_ratio"] = [pc.latin_ratio(t) for t in rec.heard_hint]
    rec["out_copy"] = rec["text"]
    rec["out_auto"] = to_english(list(rec.heard_auto), list(rec.auto_lang))
    rec["out_hint"] = to_english(list(rec.heard_hint), list(rec.hint_lang))
    rec["out_pivot"] = [o["text"] for o in pc.transcribe_batch(h_audio, lang_hint=list(rec.hint_lang), task="translate", with_probs=False)]
    routes = ["copy", "auto", "hint", "pivot"]
    if GEMINI_OK:
        try:
            rec["out_hint+gemini"] = to_english(list(rec.heard_hint), list(rec.hint_lang), engine="gemini")
            routes.append("hint+gemini")
        except Exception as e:
            print("Gemini skipped:", str(e)[:200])

    mixed = rec[rec.type == "hinglish"]
    dev, test = mixed[mixed.split == "dev"], mixed[mixed.split == "test"]
    dev_scores = {r: chrf(dev["out_" + r], dev.english) for r in OPEN_ROUTES}
    OURS = max(dev_scores, key=dev_scores.get)
    print(f"Done in {time.time() - t0:.0f} s.")
    print("Dev sentences (used only to choose):", {ROUTE_LABEL[r]: round(v, 1) for r, v in dev_scores.items()})
    print(f"Chosen route: {ROUTE_LABEL[OURS]}\n")

    out = []
    for r in routes:
        score, lo, hi = chrf_ci(test["out_" + r], test.english)
        gain, glo, ghi = chrf_gain_ci(test.out_auto, test["out_" + r], test.english)
        out.append({"route": r, "Route": ROUTE_LABEL[r] + ("  ← ours" if r == OURS else ""), "chrF": score,
                    "95% range": f"{lo:.1f} to {hi:.1f}", "vs baseline auto": gain, "gain range": f"{glo:+.1f} to {ghi:+.1f}"})
    hing_sum = pd.DataFrame(out)
    print(f"TEST sentences: {test.id.nunique()} sentences, {len(test)} recordings. Higher chrF is better.")
    display(hing_sum.drop(columns=["route"]).round(1))

    print("What language did Whisper think our Hinglish was?")
    display(test.auto_lang.value_counts().rename("recordings").to_frame().T)

    print("By speaker (test):")
    display(test.groupby("speaker").apply(lambda g: pd.Series({
        "recordings": len(g), "baseline auto chrF": chrf(g.out_auto, g.english), "ours chrF": chrf(g["out_" + OURS], g.english)})).round(1))

    print("By kind of voice (test). 'computer' means ElevenLabs text-to-speech, not a person:")
    display(test.groupby("voice").apply(lambda g: pd.Series({
        "recordings": len(g), "baseline auto chrF": chrf(g.out_auto, g.english), "ours chrF": chrf(g["out_" + OURS], g.english)})).round(1))

    HING = {"ours": OURS, "dev": dev_scores, "table": hing_sum, "test": test, "routes": routes}
''')

code("hinglish_controls", r'''
#@title 13b · Same speakers, three ways of talking (needs 'hindi' and 'english' control sentences)
CONTROLS = None
if HAVE_HINGLISH and rec[rec.split == "test"].type.nunique() > 1:
    tst = rec[rec.split == "test"]
    out = []
    for typ, g in tst.groupby("type"):
        out.append({"How it was said": typ, "Recordings": len(g),
                    "Baseline auto chrF": chrf(g.out_auto, g.english), "Ours chrF": chrf(g["out_" + OURS], g.english),
                    "Whisper picked the speaker's language %": 100 * float((g.auto_lang == g.hint_lang).mean())})
    CONTROLS = pd.DataFrame(out)
    print("Same speakers and microphones, so the differences come from the way of talking:")
    display(CONTROLS.round(1))

    # Can we tell Hinglish from plain Hindi automatically?  Threshold chosen on dev, scored on test.
    hh = rec[rec.type.isin(["hinglish", "hindi"])]
    if hh[hh.split == "test"].type.nunique() == 2 and hh[hh.split == "dev"].type.nunique() == 2:
        def auc(pos, neg):
            pos, neg = np.asarray(pos, float), np.asarray(neg, float)
            return float(((pos[:, None] > neg[None, :]).sum() + 0.5 * (pos[:, None] == neg[None, :]).sum()) / (len(pos) * len(neg)))
        d, t = hh[hh.split == "dev"], hh[hh.split == "test"]
        det = []
        for feat, label in [("mix_score", "Whisper's language probabilities"), ("latin_ratio", "English-letter words in the transcript")]:
            cands = sorted(set(d[feat]))
            acc = lambda th, df: float(((df[feat] >= th) == (df.type == "hinglish")).mean())
            th = max(cands, key=lambda x: acc(x, d))
            det.append({"Signal": label, "AUC (test)": auc(t[t.type == "hinglish"][feat], t[t.type == "hindi"][feat]),
                        "Threshold (from dev)": th, "Accuracy % (test)": 100 * acc(th, t),
                        "Baseline: always say Hinglish %": 100 * float((t.type == "hinglish").mean())})
        DETECT = pd.DataFrame(det)
        print("\nSpotting Hinglish automatically (AUC 0.5 = guessing, 1.0 = perfect):")
        display(DETECT.round(3))
elif HAVE_HINGLISH:
    print("No 'hindi' or 'english' control sentences were recorded, so this comparison is skipped.")
''')

md("confirm_md", r'''
### 13c · A second test on new sentences

The first test left us with a lead, not a result. On its 18 test sentences, Whisper translating directly scored higher than the baseline, but our own rule had not chosen it. We had already seen those scores, so we could not simply switch methods: that would be choosing the winner after the race.

So we wrote the rules down first (`SECOND_TEST_PLAN.md` in our repository, added before this part was ever run) and then tested on sentences that had never been used.

- **Sentences:** the rest of our draft list, 49 sentences, picked by rule: everything the first test did not use, minus one sentence whose answer key was unclear.
- **Question:** does **Whisper → English directly** beat the **baseline (auto → NLLB)**?
- **Rule:** we call it confirmed only if the whole 95% range of the difference is above zero. The range comes from re-sampling *sentences*, so two voices saying the same sentence are not counted as two independent tests.
- Whatever the result, it is reported below, and the first test stays as it was.
''')

code("confirm", r'''
#@title 13c · Second test on new sentences
CONFIRM = None
try:
    c_sent = load_sentences(CONFIRM_DIR)
    c_recs = find_recordings(CONFIRM_DIR)
    crec = pd.DataFrame()
    if c_sent is not None and len(c_recs):
        crec = (c_recs.merge(c_sent[c_sent.type == "hinglish"], left_on="id", right_index=True)
                .sort_values(["id", "speaker"]).reset_index(drop=True))
    if len(crec) < 10:
        print(f"No second test set yet ({len(crec)} usable recordings in {CONFIRM_DIR}), so this part is skipped.")
    else:
        t0 = time.time()
        c_audio = [pc.load_audio(p) for p in crec.path]
        crec["voice"] = ["computer" if s.startswith("tts") else "human" for s in crec.speaker]
        crec["auto_lang"] = [pick(p) for p in pc.detect_language_batch(c_audio)]

        # Baseline, exactly as in part 13: Whisper guesses the language and writes the words, then NLLB translates.
        heard = [""] * len(crec)
        for lang in sorted(set(crec.auto_lang)):
            idx = [i for i, l in enumerate(crec.auto_lang) if l == lang]
            for i, o in zip(idx, pc.transcribe_batch([c_audio[i] for i in idx], lang_hint=lang, with_probs=False)):
                heard[i] = o["text"]
        out_auto = list(heard)
        for lang in sorted(set(crec.auto_lang) - {"en"}):
            idx = [i for i, l in enumerate(crec.auto_lang) if l == lang]
            for i, o in zip(idx, pc.translate_batch([heard[i] for i in idx], lang, "en")):
                out_auto[i] = o
        crec["heard_auto"], crec["out_copy"], crec["out_auto"] = heard, crec["text"], out_auto
        # Direct, exactly as "pivot" in part 13: Whisper turns the speech straight into English.
        crec["out_pivot"] = [o["text"] for o in pc.transcribe_batch(c_audio, lang_hint=["hi"] * len(crec), task="translate", with_probs=False)]

        A, P, R = list(crec.out_auto), list(crec.out_pivot), list(crec.english)
        def gain_on(rows):
            return chrf([P[j] for j in rows], [R[j] for j in rows]) - chrf([A[j] for j in rows], [R[j] for j in rows])
        ids = crec.id.to_numpy()
        uniq = np.unique(ids)
        rows_of = {s: np.flatnonzero(ids == s) for s in uniq}
        rng = np.random.default_rng(SEED)
        boots = [gain_on(np.concatenate([rows_of[s] for s in rng.choice(uniq, len(uniq))])) for _ in range(500)]
        gain, glo, ghi = float(gain_on(np.arange(len(crec)))), float(np.percentile(boots, 2.5)), float(np.percentile(boots, 97.5))
        verdict = ("confirmed: direct translation is better" if glo > 0 else
                   "the baseline is better" if ghi < 0 else "not confirmed")

        a_s, a_lo, a_hi = chrf_ci(A, R)
        p_s, p_lo, p_hi = chrf_ci(P, R)
        c_s = float(chrf(crec.out_copy, R))
        n_h, n_c = int((crec.voice == "human").sum()), int((crec.voice == "computer").sum())
        print(f"Done in {time.time() - t0:.0f} s. {crec.id.nunique()} new sentences, {len(crec)} recordings "
              f"({n_h} by people, {n_c} computer-made). Higher chrF is better.")
        display(pd.DataFrame([
            {"Route": ROUTE_LABEL["copy"], "chrF": c_s, "95% range": ""},
            {"Route": ROUTE_LABEL["auto"], "chrF": a_s, "95% range": f"{a_lo:.1f} to {a_hi:.1f}"},
            {"Route": ROUTE_LABEL["pivot"], "chrF": p_s, "95% range": f"{p_lo:.1f} to {p_hi:.1f}"}]).round(1))
        print(f"Direct minus baseline: {gain:+.1f} chrF points. 95% range, re-sampling sentences: {glo:+.1f} to {ghi:+.1f}.")
        print("RESULT BY OUR RULE:", verdict.upper())
        print("\nBy voice:")
        display(crec.groupby("speaker").apply(lambda g: pd.Series({
            "recordings": len(g), "baseline chrF": chrf(g.out_auto, g.english), "direct chrF": chrf(g.out_pivot, g.english)})).round(1))
        print("What language did Whisper think these clips were?")
        display(crec.auto_lang.value_counts().rename("recordings").to_frame().T)

        summary = (f"Second test on {crec.id.nunique()} new sentences ({len(crec)} clips): Whisper translating directly scored "
                   f"{p_s:.1f} chrF and the baseline {a_s:.1f}, a difference of {gain:+.1f} (95% range {glo:+.1f} to {ghi:+.1f}). "
                   f"By the rule we wrote down beforehand: {verdict}.")
        CONFIRM = {"question": "On new sentences, does Whisper translating directly beat the baseline (auto, then NLLB)?",
                   "n": int(len(crec)), "sentences": int(crec.id.nunique()), "speakers": int(crec.speaker.nunique()),
                   "human_recordings": n_h, "computer_recordings": n_c,
                   "copy": round(c_s, 2), "baseline": round(float(a_s), 2), "direct": round(float(p_s), 2),
                   "gain": round(gain, 2), "gain_range": [round(glo, 2), round(ghi, 2)], "verdict": verdict,
                   "summary": summary, "rec": crec}
except Exception as e:
    CONFIRM = None
    print("The second test could not be finished, so it is left out:", repr(e)[:600])
''')

md("ratings_md", r'''
## 14 · Checked by real speakers

chrF only counts matching letters. It cannot tell whether a translation *means* the right thing. So team members who speak Hindi and English rate the meaning themselves.

- The rater sees what was said, the correct English, and two translations called **A** and **B**. Which system wrote which is hidden and shuffled for every sentence.
- **2** = the meaning is right, **1** = partly right, **0** = wrong or nonsense.
- One clip per sentence is rated. If the second test ran, its sentences are the ones rated, comparing the baseline with direct translation.

The tool below opens a small page for rating. Every answer is saved straight away. After rating, run cell 14b and the Save cell again.
''')

code("ratings", r'''
#@title 14 · Blind rating tool
RATE = None
try:
    if CONFIRM is not None:
        r_src, r_name, r_pair = CONFIRM["rec"], "second test", ("auto", "pivot")
    elif HING is not None:
        r_src, r_name, r_pair = HING["test"], "first test", ("auto", OURS if OURS != "auto" else "pivot")
    else:
        r_src = None
    if r_src is None:
        print("No Hinglish outputs to rate yet.")
    else:
        pool = r_src.sort_values(["id", "speaker"]).reset_index(drop=True)
        keep = [g.index[n % len(g)] for n, (_, g) in enumerate(pool.groupby("id", sort=True))]   # voices take turns
        pool = pool.loc[keep].reset_index(drop=True)
        rng = random.Random(SEED)
        sheet, key = [], {}
        for k, row in pool.iterrows():
            a, b = r_pair if rng.random() < 0.5 else r_pair[::-1]
            key[str(k)] = {"A": a, "B": b}
            sheet.append({"row": k, "said": row["text"], "correct_english": row["english"],
                          "output_A": row["out_" + a], "output_B": row["out_" + b], "rating_A": "", "rating_B": "", "notes": ""})
        RATE = {"sheet": pd.DataFrame(sheet), "key": key, "set": r_name, "pair": r_pair}
        RATE["sheet"].to_csv(os.path.join(RESULTS_DIR, "ratings_sheet.csv"), index=False, encoding="utf-8-sig")
        json.dump(key, open(os.path.join(RESULTS_DIR, "ratings_key.json"), "w"))
        print(f"{len(sheet)} sentences from the {r_name} are ready to rate: {ROUTE_LABEL[r_pair[0]]}  against  {ROUTE_LABEL[r_pair[1]]}.")
except Exception as e:
    RATE = None
    print("The rating sheet could not be made:", repr(e)[:600])

def rate_show(i):
    r = RATE["sheet"].iloc[i]
    head = (f"**Sentence {i + 1} of {len(RATE['sheet'])}**\n\n**What was said:** {r['said']}\n\n"
            f"**What it means:** {r['correct_english']}")
    return head, str(r["output_A"]), str(r["output_B"])

def rate_save(i, rater, ra, rb):
    name = re.sub(r"\W+", "", (rater or "").lower())
    if not name:
        return (i, *rate_show(i), ra, rb, "Type your first name at the top first.")
    if ra is None or rb is None:
        return (i, *rate_show(i), ra, rb, "Give both A and B a score first.")
    path = os.path.join(RESULTS_DIR, f"ratings_filled_{name}.csv")
    df = pd.read_csv(path) if os.path.exists(path) else RATE["sheet"].copy()
    if len(df) != len(RATE["sheet"]) or list(df["said"]) != list(RATE["sheet"]["said"]):
        df = RATE["sheet"].copy()                 # an older sheet with other sentences: start this rater again
    for col, val in (("rating_A", ra), ("rating_B", rb)):
        df[col] = df[col].astype(object)
        df.loc[df["row"] == i, col] = int(val)
    df.to_csv(path, index=False, encoding="utf-8-sig")
    done = int(pd.to_numeric(df["rating_A"], errors="coerce").notna().sum())
    j = min(i + 1, len(df) - 1)
    note = f"Saved. You have rated {done} of {len(df)}." + ("  All done, thank you!" if done == len(df) else "")
    return (j, *rate_show(j), None, None, note)

def rate_move(i, step):
    j = max(0, min(len(RATE["sheet"]) - 1, i + step))
    return (j, *rate_show(j), None, None, "")

RATE_APP_OK = False
if RATE is not None and RUN_RATER:
    try:
        import gradio as gr
        with gr.Blocks(title="Polyglot ratings") as rate_app:
            gr.Markdown("## Polyglot: rate the translations\nYou see what was said, what it means, and two translations called A and B. "
                        "You are not told which system wrote which. Score the **meaning** of each one: "
                        "**2** = right, **1** = partly right, **0** = wrong or nonsense.")
            r_idx = gr.State(0)
            r_who = gr.Textbox(label="Your first name")
            _h, _a, _b = rate_show(0)
            r_head = gr.Markdown(_h)
            with gr.Row():
                with gr.Column():
                    r_a = gr.Textbox(label="Translation A", value=_a, interactive=False, lines=3)
                    r_sa = gr.Radio([0, 1, 2], label="Score for A")
                with gr.Column():
                    r_b = gr.Textbox(label="Translation B", value=_b, interactive=False, lines=3)
                    r_sb = gr.Radio([0, 1, 2], label="Score for B")
            r_note = gr.Markdown()
            with gr.Row():
                r_back = gr.Button("Back")
                r_next = gr.Button("Save and next", variant="primary")
            _outs = [r_idx, r_head, r_a, r_b, r_sa, r_sb, r_note]
            r_next.click(rate_save, [r_idx, r_who, r_sa, r_sb], _outs)
            r_back.click(lambda i: rate_move(i, -1), [r_idx], _outs)
        rate_app.launch(share=True)
        RATE_APP_OK = True
        print("Open the public link (send it to the teammates who will rate). Each person types their own first name.")
        print("When everyone has finished, run cell 14b and then the Save cell again.")
    except Exception as e:
        print("The rating page could not be opened:", repr(e)[:600])
        print("You can still rate by hand: open ratings_sheet.csv in", RESULTS_DIR)
        print("Fill in rating_A and rating_B with 0, 1 or 2, and save it there as ratings_filled_yourname.csv.")
''')

code("ratings_count", r'''
#@title 14b · Count the ratings (run this again after people have rated)
RATINGS, RATING_INFO = None, None
try:
    got, skipped = [], 0
    if RATE is not None:
        sh = RATE["sheet"].set_index("row")
        for f in sorted(glob.glob(os.path.join(RESULTS_DIR, "ratings_filled*.csv"))):
            who = os.path.splitext(os.path.basename(f))[0].replace("ratings_filled", "").strip("_") or "rater"
            for _, r in pd.read_csv(f).iterrows():
                va, vb = pd.to_numeric(r.get("rating_A"), errors="coerce"), pd.to_numeric(r.get("rating_B"), errors="coerce")
                if pd.isna(va) or pd.isna(vb):
                    continue
                k = int(r["row"])
                if k not in sh.index or str(sh.loc[k, "said"]) != str(r["said"]) or str(sh.loc[k, "output_A"]) != str(r["output_A"]):
                    skipped += 1                      # rated on an older sheet: do not mix it in
                    continue
                sides = RATE["key"][str(k)]
                got.append({"rater": who, "row": k, sides["A"]: float(va), sides["B"]: float(vb)})
    got = pd.DataFrame(got)
    if skipped:
        print(f"{skipped} ratings were left out because they belong to an older rating sheet.")
    if len(got):
        base, new = RATE["pair"]
        per = got.groupby("row")[[base, new]].mean()          # average the raters for each sentence
        RATINGS = pd.DataFrame({"mean_rating": [got[base].mean(), got[new].mean()],
                                "fully_right": [100 * float((got[base] == 2).mean()), 100 * float((got[new] == 2).mean())],
                                "rated": [int(len(got)), int(len(got))]}, index=[ROUTE_LABEL[base], ROUTE_LABEL[new]])
        RATINGS.index.name = "system"
        diff = (per[new] - per[base]).to_numpy()
        lo, hi = boot_ci(len(diff), lambda i: float(diff[i].mean()), 1000)
        pts = [(float(per.loc[k, RATE["key"][str(k)][s]]), chrf1(sh.loc[k, f"output_{s}"], sh.loc[k, "correct_english"]))
               for k in per.index for s in "AB"]
        rho = float(pd.Series([p[0] for p in pts]).corr(pd.Series([p[1] for p in pts]), method="spearman"))
        RATING_INFO = {"rated_set": RATE["set"], "raters": int(got.rater.nunique()), "sentences": int(len(per)),
                       "compared": [ROUTE_LABEL[base], ROUTE_LABEL[new]],
                       "second_better": int((diff > 0).sum()), "same": int((diff == 0).sum()), "first_better": int((diff < 0).sum()),
                       "mean_difference": round(float(diff.mean()), 3), "difference_range": [round(lo, 3), round(hi, 3)],
                       "agreement_with_chrf": None if rho != rho else round(rho, 2)}
        print(f"Blind ratings by {RATING_INFO['raters']} team member(s) on {len(per)} sentences of the {RATE['set']} (0 to 2):")
        display(RATINGS.round(2))
        print(f"Sentence by sentence: {ROUTE_LABEL[new]} was rated higher on {RATING_INFO['second_better']}, the same on "
              f"{RATING_INFO['same']}, lower on {RATING_INFO['first_better']}.")
        print(f"Average difference: {diff.mean():+.2f} points (95% range {lo:+.2f} to {hi:+.2f}).")
        print("Do the ratings agree with chrF? Spearman correlation:", RATING_INFO["agreement_with_chrf"])
    else:
        print("No ratings yet. Use the rating page from cell 14, then run this cell and the Save cell again.")
except Exception as e:
    RATINGS, RATING_INFO = None, None
    print("The ratings could not be counted:", repr(e)[:600])
''')

md("worst_md", r'''
## 15 · Where it fails

The five worst results for each language, with the model's output next to the correct answer. The "why" column is an automatic first guess. We read each one ourselves and wrote what we found in the write-up.
''')

code("worst", r'''
#@title 15 · The worst mistakes, side by side
def why_guess(inp, hyp, ref, used=None, true=None):
    notes = []
    if not str(hyp).strip():
        notes.append("no output at all")
    if used and true and used != true:
        notes.append(f"heard the wrong language ({used})")
    if re.search(r"\d", f"{inp} {ref}"):
        notes.append("has numbers")
    if len(str(hyp)) < 0.6 * len(str(ref)):
        notes.append("part of the sentence is missing")
    if len(str(hyp)) > 1.6 * len(str(ref)):
        notes.append("extra or made-up words")
    w = norm_text(hyp).split()
    if len(w) >= 6 and len(set(w)) < 0.5 * len(w):
        notes.append("repeats itself")
    return "auto-guess: " + ("; ".join(notes) if notes else "no obvious pattern, needs a human look")

WORST = []
print("SPEECH TO TEXT (with the speaker's language given)")
for l in LANGS_TESTED:
    g = asr_df[(asr_df.lang == l) & (asr_df.cond == "hint")].copy()
    g["wer"] = g.werr / g.wn.clip(lower=1)
    top = g.sort_values("wer", ascending=False).head(5)
    for _, r in top.iterrows():
        WORST.append({"task": "speech-to-text", "lang": l, "input": f"speech clip {r.sid}", "model": r.hyp, "correct": r.ref,
                      "score": f"WER {100 * r.wer:.0f}%", "why": why_guess("", r.hyp, r.ref)})
    print(f"\n{pc.LANGS[l]['name']}")
    display(top[["wer", "hyp", "ref"]].rename(columns={"wer": "WER", "hyp": "model wrote", "ref": "correct"}).round(2))

print("\nTRANSLATION (NLLB)")
for src, tgt in PAIRS:
    g = mt_df[(mt_df.pair == f"{src}-{tgt}") & (mt_df.engine == "nllb")]
    top = g.sort_values("chrf").head(5)
    for _, r in top.iterrows():
        WORST.append({"task": "translation", "lang": tgt, "pair": f"{src}-{tgt}", "input": r.input, "model": r.hyp, "correct": r.ref,
                      "score": f"chrF {r.chrf:.0f}", "why": why_guess(r.input, r.hyp, r.ref)})
    print(f"\n{pc.LANGS[src]['name']} → {pc.LANGS[tgt]['name']}")
    display(top[["chrf", "input", "hyp", "ref"]].rename(columns={"chrf": "chrF", "hyp": "model wrote", "ref": "correct"}).round(1))

if HING:
    t = HING["test"].copy()
    t["chrf"] = [chrf1(h, r) for h, r in zip(t["out_" + OURS], t.english)]
    top = t.sort_values("chrf").head(5)
    for _, r in top.iterrows():
        WORST.append({"task": "hinglish", "lang": "hinglish", "input": r["text"], "model": r["out_" + OURS], "correct": r["english"],
                      "score": f"chrF {r['chrf']:.0f}", "heard": r["heard_hint"],
                      "why": why_guess(r["text"], r["out_" + OURS], r["english"], r["auto_lang"], r["hint_lang"])})
    print(f"\nHINGLISH → English ({ROUTE_LABEL[OURS]})")
    display(top[["chrf", "text", "heard_hint", "out_" + OURS, "english"]].rename(columns={
        "chrf": "chrF", "text": "said", "heard_hint": "Whisper heard", "out_" + OURS: "model wrote", "english": "correct"}).round(1))

# Order for the results file: our Hinglish failures first, then the worst of each group in turn.
_groups = {}
for w in WORST:
    _groups.setdefault((w["task"], w.get("pair", w["lang"])), []).append(w)
_hing = _groups.pop(("hinglish", "hinglish"), [])
_rest = [g[i] for i in range(5) for g in _groups.values() if i < len(g)]
WORST = _hing + _rest
''')

code("save", r'''
#@title 16 · Save the results
def _asr_entry(l):
    g = asr_sum[asr_sum.lang == l].set_index("cond")
    return {"wer": round(g.loc["hint", "WER %"] / 100, 4), "cer": round(g.loc["hint", "CER %"] / 100, 4),
            "wer_auto": round(g.loc["auto", "WER %"] / 100, 4), "wer_room": round(g.loc["room", "WER %"] / 100, 4),
            "lang_right_auto": round(g.loc["auto", "Right language %"] / 100, 4),
            "lang_right_room": round(g.loc["room", "Right language %"] / 100, 4), "n": int(g.loc["hint", "Clips"])}

RESULTS = {
    "generated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    "models": INFO,
    "sentences_per_language": len(SIDS),
    "quick_test": bool(QUICK_TEST or len(SIDS) < 50),
    "asr": {l: _asr_entry(l) for l in LANGS_TESTED},
    "mt": {},
    "s2t": {},
    "latencyMs": {**LAT, "note": "median computing time: one Hindi speaker, English and Tamil listeners"},
    "worst": WORST,
}
for pair, g in mt_sum.groupby("pair", sort=False):
    RESULTS["mt"][pair] = {r.engine: {"chrf": round(r.chrF, 2), "ci": [round(r.lo, 2), round(r.hi, 2)]} for r in g.itertuples()}
    RESULTS["mt"][pair]["n"] = int(g.Sentences.iloc[0])
for r in s2t_sum.itertuples():
    RESULTS["s2t"].setdefault(r.pair, {})[r.system] = round(r.chrF, 2)
if BIG is not None:
    RESULTS["asr_compare_model"] = COMPARE_ASR_MODEL
    for r in BIG.itertuples():
        RESULTS["asr"][r.lang]["wer_compare"] = round(r.wer_big / 100, 4)
        RESULTS["asr"][r.lang]["cer_compare"] = round(r.cer_big / 100, 4)
    big_df.to_csv(os.path.join(RESULTS_DIR, "speech_to_text_outputs_second_model.csv"), index=False, encoding="utf-8-sig")

if HING:
    tab = HING["table"].set_index("route")
    test = HING["test"]
    RESULTS["asr"]["hinglish"] = {"wer": None, "n": int(len(test)),
                                  "note": "No WER: we wrote Hinglish in Latin letters and Whisper writes Devanagari, so word matching would be unfair."}
    RESULTS["hinglish"] = {
        "baseline": {"wer": None, "chrf": round(tab.loc["auto", "chrF"], 2), "name": ROUTE_LABEL["auto"]},
        "fix": {"wer": None, "chrf": round(tab.loc[OURS, "chrF"], 2), "name": ROUTE_LABEL[OURS], "route": OURS,
                "gain": round(tab.loc[OURS, "vs baseline auto"], 2), "gain_range": tab.loc[OURS, "gain range"]},
        "copy": {"chrf": round(tab.loc["copy", "chrF"], 2), "name": ROUTE_LABEL["copy"]},
        "variants": {r: round(tab.loc[r, "chrF"], 2) for r in HING["routes"]},
        "dev": {r: round(v, 2) for r, v in HING["dev"].items()},
        "n": int(len(test)), "sentences": int(test.id.nunique()), "speakers": int(test.speaker.nunique()),
    }
    RESULTS["hinglish"]["speech"] = {"human_recordings": int((test.voice == "human").sum()),
                                     "computer_recordings": int((test.voice == "computer").sum())}
    if RESULTS["hinglish"]["speech"]["computer_recordings"]:
        RESULTS["hinglish"]["speech"]["computer_voice"] = f"ElevenLabs text-to-speech ({ELEVEN_MODEL})"
        RESULTS["hinglish"]["note"] = ("Some or all Hinglish clips are computer-made speech (ElevenLabs), not real speakers. "
                                       "Real speech is usually harder, so read these scores as an upper estimate.")
    if CONTROLS is not None:
        RESULTS["hinglish"]["by_style"] = json.loads(CONTROLS.round(2).to_json(orient="records"))
    notes = [RESULTS["hinglish"].get("note", "")]
    if CONFIRM is not None:
        RESULTS["hinglish"]["confirm"] = {k: v for k, v in CONFIRM.items() if k != "rec"}
        notes.append(CONFIRM["summary"])
        CONFIRM["rec"].drop(columns=["path"]).to_csv(os.path.join(RESULTS_DIR, "hinglish_second_test_outputs.csv"), index=False, encoding="utf-8-sig")
    if RATINGS is not None:
        RESULTS["hinglish"]["human_ratings"] = json.loads(RATINGS.round(3).reset_index().to_json(orient="records"))
        RESULTS["hinglish"]["human_ratings_info"] = RATING_INFO
        m = RATINGS["mean_rating"]
        notes.append(f"Blind ratings by {RATING_INFO['raters']} team member(s) on {RATING_INFO['sentences']} sentences "
                     f"(0 to 2): {m.index[1]} {m.iloc[1]:.2f}, {m.index[0]} {m.iloc[0]:.2f}.")
    if any(notes):
        RESULTS["hinglish"]["note"] = " ".join(n for n in notes if n)
    rec.drop(columns=["path"]).to_csv(os.path.join(RESULTS_DIR, "hinglish_outputs.csv"), index=False, encoding="utf-8-sig")

asr_df.to_csv(os.path.join(RESULTS_DIR, "speech_to_text_outputs.csv"), index=False, encoding="utf-8-sig")
mt_df.to_csv(os.path.join(RESULTS_DIR, "translation_outputs.csv"), index=False, encoding="utf-8-sig")
for path in (os.path.join(RESULTS_DIR, "results.json"), "results.json"):
    with open(path, "w", encoding="utf8") as f:
        json.dump(RESULTS, f, ensure_ascii=False, indent=1)
print("Saved results.json and every model output to", RESULTS_DIR)
print(json.dumps({k: RESULTS.get(k) for k in ("asr", "mt", "hinglish", "latencyMs")}, ensure_ascii=False, indent=1)[:3000])
''')

code("demo", r'''
#@title 17 · Live demo: speak, then hear the translation
if RUN_DEMO:
    import gradio as gr
    NAMES = {c: v["name"] for c, v in pc.LANGS.items()}

    def demo_run(clip, spoken, target, engine):
        if clip is None:
            return "", "", None, "Record or upload something first."
        r = pc.translate_speech(clip, [target], lang_hint=None if spoken == "auto" else spoken, engine=engine,
                                candidates=LANGS_TESTED)
        out = r["results"][target]
        heard = f"{r['original']}\n[{NAMES.get(r['sourceLang'], r['sourceLang'])}" + (f", {r['mixed']}" if r["mixed"] else "") + "]"
        sound = (pc.SR, pc.load_audio(out["wav"])) if out["wav"] else None
        ms = r["stageMs"]
        return heard, out["text"], sound, f"speech to text {ms['asr']} ms · translation {ms['mt']} ms · voice {ms['tts']} ms"

    with gr.Blocks(title="Polyglot") as demo:
        gr.Markdown("# Polyglot\nSpeak your language. Hear theirs. *A prototype: it makes mistakes, see the results above.*")
        with gr.Row():
            with gr.Column():
                d_mic = gr.Audio(sources=["microphone", "upload"], type="numpy", label="Speak, or upload a clip")
                d_spoken = gr.Dropdown([("Detect it for me", "auto")] + [(NAMES[c], c) for c in LANGS_TESTED], value="hi", label="I am speaking")
                d_target = gr.Dropdown([(NAMES[c], c) for c in LANGS_TESTED], value="en", label="Translate into")
                d_engine = gr.Radio(["nllb"] + (["gemini"] if GEMINI_API_KEY else []), value="nllb", label="Translator")
                d_go = gr.Button("Translate", variant="primary")
            with gr.Column():
                d_heard = gr.Textbox(label="What Polyglot heard", lines=3)
                d_text = gr.Textbox(label="Translation", lines=3)
                d_audio = gr.Audio(label="Translated speech", autoplay=True)
                d_time = gr.Markdown()
        d_go.click(demo_run, [d_mic, d_spoken, d_target, d_engine], [d_heard, d_text, d_audio, d_time])
    demo.launch(share=True)
''')

md("outro", r'''
## What this does not show

- **Small test sets.** 100 sentences per language, and a few dozen Hinglish sentences from a handful of speakers. The 95% ranges show how uncertain each number is.
- **Read speech.** FLEURS and our recordings are read aloud, one clean sentence at a time. Real calls have noise, interruptions and people talking over each other.
- **Not live streaming.** Each sentence is translated after the speaker finishes it. Clips longer than 30 seconds are cut.
- **Numbers and names.** The voice model cannot read digits aloud, and names are often changed.
- **Hinglish has no word error rate here.** We wrote Hinglish in Latin letters, Whisper writes Devanagari, so we score the final English and our own ratings.
- **Gemini may have seen FLEURS.** Those sentences are public, so its scores on them may be too high. Our own recordings do not have this problem.

## Sources

| What | Link | Licence |
|---|---|---|
| Whisper (speech to text) | https://huggingface.co/openai/whisper-large-v3 (compared with https://huggingface.co/openai/whisper-small) | MIT |
| NLLB-200 (translation) | https://huggingface.co/facebook/nllb-200-distilled-600M | CC-BY-NC 4.0 |
| MMS-TTS (voice) | https://huggingface.co/facebook/mms-tts | CC-BY-NC 4.0 |
| FLEURS (test speech and translations) | https://huggingface.co/datasets/google/fleurs | CC-BY 4.0 |
| Gemini API (comparison translator, and first draft of the Hinglish sentences) | https://ai.google.dev | Google terms |
| ElevenLabs (computer-made voices for the Hinglish test clips named `tts-`) | https://elevenlabs.io | ElevenLabs terms |
| Hugging Face Transformers | https://github.com/huggingface/transformers | Apache-2.0 |
| sacrebleu (chrF), jiwer and rapidfuzz (WER) | https://github.com/mjpost/sacrebleu · https://github.com/jitsi/jiwer · https://github.com/rapidfuzz/RapidFuzz | Apache-2.0 · Apache-2.0 · MIT |
| Gradio (demo) | https://gradio.app | Apache-2.0 |

AI tools used while building: Claude (Anthropic), ChatGPT / Codex (OpenAI), Gemini / Antigravity (Google). The Hinglish sentences were drafted with Gemini, then chosen, corrected and recorded by us.
''')


# =============================================================================
def build(path=None):
    path = path or os.path.join(ROOT, "polyglot_eval.ipynb")
    cells = []
    for kind, cid, src in CELLS:
        lines = src.split("\n")
        source = [ln + "\n" for ln in lines[:-1]] + [lines[-1]]
        cell = {"cell_type": kind, "metadata": {"id": cid}, "source": source}
        if kind == "code":
            cell.update(outputs=[], execution_count=None)
        cells.append(cell)
    nb = {
        "nbformat": 4,
        "nbformat_minor": 0,
        "metadata": {
            "colab": {"provenance": [], "gpuType": "T4", "toc_visible": True},
            "accelerator": "GPU",
            "kernelspec": {"name": "python3", "display_name": "Python 3"},
            "language_info": {"name": "python"},
        },
        "cells": cells,
    }
    with open(path, "w", encoding="utf8", newline="\n") as f:
        json.dump(nb, f, ensure_ascii=False, indent=1)
    return path, len(cells)


if __name__ == "__main__":
    p, n = build()
    print(f"wrote {p} ({n} cells, {os.path.getsize(p) / 1024:.0f} KB)")
