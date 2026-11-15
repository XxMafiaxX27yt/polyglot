"""
polyglot_core.py - Polyglot AI core (Part A)

Speech -> text -> translation -> speech, built on open pretrained models:

    speech recognition   OpenAI Whisper     openai/whisper-small
    translation          Meta NLLB-200      facebook/nllb-200-distilled-600M
    comparison engine    Google Gemini API  (optional, needs GEMINI_API_KEY)
    speech synthesis     Meta MMS-TTS       facebook/mms-tts-<lang>

Public API (the shapes are fixed in CONTRACT.md):

    transcribe(audio, lang_hint=None)              -> {"text", "lang", "mixed", "ms", ...}
    translate(text, src, tgt, engine="nllb")       -> {"text", "ms", ...}
    synthesize(text, lang)                         -> {"wav", "ms", ...}
    translate_speech(audio, targets, lang_hint)    -> {"original", "sourceLang", "mixed",
                                                       "results", "stageMs"}

Languages are the 2-letter codes the UI uses ("hi", "en", "ta", "bn", ...).
Only TESTED languages have measured results. The rest load on a best-effort basis.

Models load lazily on first use, on the GPU when there is one.
"""
from __future__ import annotations

import io
import json
import os
import re
import shutil
import subprocess
import tempfile
import threading
import time
import wave

__version__ = "0.1.0"

SR = 16000  # every model here works on 16 kHz mono audio

# UI code -> the code each model uses. "mms" is None where MMS-TTS has no voice.
LANGS = {
    "hi": {"name": "Hindi",      "nllb": "hin_Deva", "mms": "hin", "fleurs": "hi_in"},
    "en": {"name": "English",    "nllb": "eng_Latn", "mms": "eng", "fleurs": "en_us"},
    "bn": {"name": "Bengali",    "nllb": "ben_Beng", "mms": "ben", "fleurs": "bn_in"},
    "ta": {"name": "Tamil",      "nllb": "tam_Taml", "mms": "tam", "fleurs": "ta_in"},
    "te": {"name": "Telugu",     "nllb": "tel_Telu", "mms": "tel", "fleurs": "te_in"},
    "mr": {"name": "Marathi",    "nllb": "mar_Deva", "mms": "mar", "fleurs": "mr_in"},
    "kn": {"name": "Kannada",    "nllb": "kan_Knda", "mms": "kan", "fleurs": "kn_in"},
    "ml": {"name": "Malayalam",  "nllb": "mal_Mlym", "mms": "mal", "fleurs": "ml_in"},
    "gu": {"name": "Gujarati",   "nllb": "guj_Gujr", "mms": "guj", "fleurs": "gu_in"},
    "pa": {"name": "Punjabi",    "nllb": "pan_Guru", "mms": "pan", "fleurs": "pa_in"},
    "ur": {"name": "Urdu",       "nllb": "urd_Arab", "mms": "urd-script_arabic", "fleurs": "ur_pk"},
    "es": {"name": "Spanish",    "nllb": "spa_Latn", "mms": "spa", "fleurs": "es_419"},
    "fr": {"name": "French",     "nllb": "fra_Latn", "mms": "fra", "fleurs": "fr_fr"},
    "de": {"name": "German",     "nllb": "deu_Latn", "mms": "deu", "fleurs": "de_de"},
    "ar": {"name": "Arabic",     "nllb": "arb_Arab", "mms": "ara", "fleurs": "ar_eg"},
    "zh": {"name": "Chinese",    "nllb": "zho_Hans", "mms": None,  "fleurs": "cmn_hans_cn"},
    "ja": {"name": "Japanese",   "nllb": "jpn_Jpan", "mms": None,  "fleurs": "ja_jp"},
    "pt": {"name": "Portuguese", "nllb": "por_Latn", "mms": "por", "fleurs": "pt_br"},
    "it": {"name": "Italian",    "nllb": "ita_Latn", "mms": None,  "fleurs": "it_it"},
    "ko": {"name": "Korean",     "nllb": "kor_Hang", "mms": "kor", "fleurs": "ko_kr"},
}
TESTED = ["hi", "en", "ta", "bn"]

# Languages Whisper sometimes picks by mistake for our speakers. Only used so a
# wrong guess can still be translated instead of crashing.
_EXTRA_NLLB = {
    "ne": "npi_Deva", "sa": "san_Deva", "as": "asm_Beng", "sd": "snd_Arab",
    "si": "sin_Sinh", "ps": "pbt_Arab", "fa": "pes_Arab",
}
_MIXED_NAMES = {"hi": "Hinglish"}

CONFIG = {
    "asr_model": os.environ.get("POLYGLOT_ASR_MODEL", "openai/whisper-small"),
    "mt_model": os.environ.get("POLYGLOT_MT_MODEL", "facebook/nllb-200-distilled-600M"),
    "device": os.environ.get("POLYGLOT_DEVICE", ""),          # "" = GPU if present, else CPU
    # Languages auto-detect may choose from. None = the 20 UI languages, "all" = all of Whisper's.
    "candidates": None,
    # Code-mix flag. This default is a guess until the evaluation notebook calibrates it.
    "mix_threshold": float(os.environ.get("POLYGLOT_MIX_THRESHOLD", "0.15")),
    "latin_threshold": 0.20,
    # How speech is turned into another language. "cascade" = transcript -> NLLB.
    # "pivot" = Whisper's own speech-to-English, then NLLB from English.
    "route": {"default": os.environ.get("POLYGLOT_ROUTE", "cascade"),
              "mixed": os.environ.get("POLYGLOT_ROUTE_MIXED", "cascade")},
    "mt_beams": 4,
    "split_sentences": True,
    # Below this loudness a clip counts as silence (Whisper invents text on pure silence).
    # Keep it tiny: real recordings can be very quiet. FLEURS English is around 0.0004.
    "min_rms": 1e-4,
    "gemini_model": os.environ.get("GEMINI_MODEL", "gemini-2.5-flash"),
    "gemini_min_interval": 0.0,  # seconds between Gemini calls (raise it for free-tier batch runs)
}

_infer_lock = threading.RLock()
_asr: dict = {}
_mt: dict = {}
_tts: dict = {}


# --------------------------------------------------------------------------- audio

def wav_bytes(samples, sr: int = SR) -> bytes:
    """float samples in [-1, 1] -> 16-bit mono WAV bytes."""
    import numpy as np

    x = np.asarray(samples, dtype=np.float32).reshape(-1)
    pcm = (np.clip(x, -1.0, 1.0) * 32767.0).astype("<i2").tobytes()
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(int(sr))
        w.writeframes(pcm)
    return buf.getvalue()


def _read_wav_stdlib(data: bytes):
    import numpy as np

    with wave.open(io.BytesIO(data), "rb") as w:
        ch, width, sr, n = w.getnchannels(), w.getsampwidth(), w.getframerate(), w.getnframes()
        raw = w.readframes(n)
    if width == 2:
        x = np.frombuffer(raw, "<i2").astype(np.float32) / 32768.0
    elif width == 4:
        x = np.frombuffer(raw, "<i4").astype(np.float32) / 2147483648.0
    elif width == 1:
        x = (np.frombuffer(raw, np.uint8).astype(np.float32) - 128.0) / 128.0
    else:
        raise wave.Error(f"unsupported sample width {width}")
    if ch > 1:
        x = x[: len(x) // ch * ch].reshape(-1, ch).mean(axis=1)
    return x, sr


def _ffmpeg_decode(src) -> "np.ndarray":
    """Decode any audio (bytes or a file path) to 16 kHz mono float32 with ffmpeg."""
    import numpy as np

    exe = shutil.which("ffmpeg")
    if not exe:
        raise RuntimeError("This audio is not a plain WAV and ffmpeg is not installed to convert it.")
    tmp = None
    try:
        if isinstance(src, (bytes, bytearray, memoryview)):
            fd, tmp = tempfile.mkstemp(suffix=".audio")
            with os.fdopen(fd, "wb") as f:
                f.write(bytes(src))
            path = tmp
        else:
            path = os.fspath(src)
        cmd = [exe, "-nostdin", "-loglevel", "error", "-i", path,
               "-f", "f32le", "-ac", "1", "-ar", str(SR), "pipe:1"]
        p = subprocess.run(cmd, capture_output=True)
        if p.returncode != 0:
            raise RuntimeError("ffmpeg could not read the audio: " + p.stderr.decode("utf8", "replace")[-300:])
        return np.frombuffer(p.stdout, "<f4").copy()
    finally:
        if tmp and os.path.exists(tmp):
            os.remove(tmp)


def _resample(x, sr_from: int):
    import numpy as np

    if sr_from == SR or len(x) == 0:
        return x.astype(np.float32)
    try:
        from math import gcd
        from scipy.signal import resample_poly

        g = gcd(int(sr_from), SR)
        return resample_poly(x, SR // g, int(sr_from) // g).astype(np.float32)
    except ImportError:
        pass
    if shutil.which("ffmpeg"):
        return _ffmpeg_decode(wav_bytes(x, sr_from))
    n = int(round(len(x) * SR / sr_from))  # last resort: plain interpolation
    return np.interp(np.linspace(0, len(x) - 1, n), np.arange(len(x)), x).astype(np.float32)


def load_audio(src) -> "np.ndarray":
    """Anything audio-like -> float32 mono 16 kHz numpy array.

    Accepts WAV bytes, any encoded audio bytes (webm, m4a, mp3: needs ffmpeg), a file
    path, a numpy array already at 16 kHz, or a (sample_rate, array) pair.
    """
    import numpy as np

    if isinstance(src, tuple) and len(src) == 2:
        sr, arr = src
        arr = np.asarray(arr)
        scale = 32768.0 if arr.dtype.kind in "iu" else 1.0
        arr = arr.astype(np.float32) / scale
        if arr.ndim > 1:
            arr = arr.mean(axis=1)
        return _resample(arr, int(sr))
    if isinstance(src, np.ndarray):
        scale = 32768.0 if src.dtype.kind in "iu" else 1.0
        arr = src.astype(np.float32) / scale
        return arr.mean(axis=1) if arr.ndim > 1 else arr
    if isinstance(src, (str, os.PathLike)):
        with open(src, "rb") as f:
            data = f.read()
    else:
        data = bytes(src)
    if data[:4] == b"RIFF":
        try:
            x, sr = _read_wav_stdlib(data)
            return _resample(x, sr)
        except Exception:
            pass
    try:
        import soundfile as sf

        x, sr = sf.read(io.BytesIO(data), dtype="float32", always_2d=True)
        return _resample(x.mean(axis=1), sr)
    except Exception:
        pass
    return _ffmpeg_decode(data)


# --------------------------------------------------------------------------- models

def _quiet():
    """Hide transformers' harmless generate() warnings so notebook output stays readable."""
    try:
        from transformers.utils import logging as hf_logging

        hf_logging.set_verbosity_error()
    except Exception:
        pass


def _device() -> str:
    if CONFIG.get("device"):
        return CONFIG["device"]
    import torch

    return "cuda" if torch.cuda.is_available() else "cpu"


def info() -> dict:
    import torch
    import transformers

    dev = _device()
    return {
        "core": __version__,
        "asr_model": CONFIG["asr_model"],
        "mt_model": CONFIG["mt_model"],
        "tts_model": "facebook/mms-tts-<lang>",
        "device": dev,
        "gpu": torch.cuda.get_device_name(0) if dev == "cuda" else None,
        "torch": torch.__version__,
        "transformers": transformers.__version__,
    }


def _load_asr() -> dict:
    name = CONFIG["asr_model"]
    if _asr.get("name") == name:
        return _asr
    import torch
    from transformers import WhisperForConditionalGeneration, WhisperProcessor

    _quiet()

    with _infer_lock:
        if _asr:  # switching models: free the old one first, so two never sit on the GPU together
            import gc

            _asr.clear()
            gc.collect()
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
        proc = WhisperProcessor.from_pretrained(name)
        model = WhisperForConditionalGeneration.from_pretrained(name)
        dev = _device()
        model = model.to(dev)
        if dev == "cuda":
            model = model.half()
        model.eval()
        lang_to_id = getattr(model.generation_config, "lang_to_id", None)
        if not lang_to_id:  # English-only or unusual checkpoint
            from transformers.models.whisper.tokenization_whisper import LANGUAGES

            lang_to_id = {f"<|{c}|>": proc.tokenizer.convert_tokens_to_ids(f"<|{c}|>") for c in LANGUAGES}
        codes = [k.strip("<|>") for k in lang_to_id]
        ids = torch.tensor(list(lang_to_id.values()), dtype=torch.long, device=dev)
        _asr.clear()
        _asr.update(name=name, proc=proc, model=model, device=dev, codes=codes, ids=ids,
                    index={c: i for i, c in enumerate(codes)})
    return _asr


def set_asr_model(name: str) -> dict:
    """Switch the speech-to-text model, for example to compare a bigger Whisper."""
    CONFIG["asr_model"] = name
    _load_asr()
    return info()


def _load_mt() -> dict:
    name = CONFIG["mt_model"]
    if _mt.get("name") == name:
        return _mt
    from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

    _quiet()

    with _infer_lock:
        tok = AutoTokenizer.from_pretrained(name)
        model = AutoModelForSeq2SeqLM.from_pretrained(name)
        dev = _device()
        model = model.to(dev)
        if dev == "cuda":
            model = model.half()
        model.eval()
        _mt.clear()
        _mt.update(name=name, tok=tok, model=model, device=dev)
    return _mt


def _load_tts(lang: str):
    """MMS-TTS voice for one language, or None when there isn't one."""
    if lang in _tts:
        return _tts[lang]
    code = LANGS.get(lang, {}).get("mms")
    entry = None
    if code:
        try:
            from transformers import AutoTokenizer, VitsModel

            _quiet()

            with _infer_lock:
                name = f"facebook/mms-tts-{code}"
                tok = AutoTokenizer.from_pretrained(name)
                model = VitsModel.from_pretrained(name).to(_device()).eval()
                entry = {"name": name, "tok": tok, "model": model}
        except Exception as e:  # no voice for this language, or no internet
            print(f"[polyglot] no MMS-TTS voice for '{lang}': {type(e).__name__}: {str(e)[:120]}")
    _tts[lang] = entry
    return entry


def warmup(langs=("hi", "en"), tts: bool = True) -> dict:
    """Load the models now, so the first real request is not slow."""
    import numpy as np

    t0 = time.perf_counter()
    _load_asr()
    _load_mt()
    tone = (0.1 * np.sin(2 * np.pi * 220 * np.arange(SR) / SR)).astype(np.float32)
    transcribe_batch([tone], lang_hint="en", with_probs=True)
    translate_batch(["hello"], "en", "hi")
    if tts:
        for lang in langs:
            synthesize("ok", lang)
    return {**info(), "warmup_s": round(time.perf_counter() - t0, 1)}


# --------------------------------------------------------------------------- speech -> text

def _features(arrays):
    a = _asr
    fe = a["proc"].feature_extractor
    out = fe(arrays, sampling_rate=SR, return_tensors="pt", return_attention_mask=True)
    model = a["model"]
    feats = out["input_features"].to(device=a["device"], dtype=model.dtype)
    mask = out.get("attention_mask")
    if mask is not None:
        mask = mask.to(a["device"])
    return feats, mask


def _lang_probs(feats):
    """Whisper's own language guess: one decoder step, softmax over its language tokens."""
    import torch

    model = _asr["model"]
    with torch.no_grad():
        enc = model.get_encoder()(feats)
        start = model.config.decoder_start_token_id
        dec = torch.full((feats.shape[0], 1), start, dtype=torch.long, device=feats.device)
        logits = model(encoder_outputs=enc, decoder_input_ids=dec).logits[:, -1, :].float()
        probs = torch.softmax(logits[:, _asr["ids"]], dim=-1)
    return probs.cpu().numpy()


def _candidate_codes(candidates):
    if candidates is None:
        candidates = CONFIG.get("candidates")
    if candidates == "all":
        return None
    return list(candidates) if candidates else list(LANGS)


def _pick_lang(prob_row, candidates) -> str:
    codes = _asr["codes"]
    allowed = _candidate_codes(candidates)
    if allowed is None:
        return codes[int(prob_row.argmax())]
    best, best_p = None, -1.0
    for c in allowed:
        i = _asr["index"].get(c)
        if i is not None and prob_row[i] > best_p:
            best, best_p = c, float(prob_row[i])
    return best or codes[int(prob_row.argmax())]


def latin_ratio(text: str) -> float:
    """Share of words written in Latin letters (English words left inside Hindi text)."""
    words = re.findall(r"[^\W\d_]+", text or "")
    if not words:
        return 0.0
    return sum(1 for w in words if re.search(r"[A-Za-z]", w)) / len(words)


def mix_score(probs: dict) -> float:
    """0 = clearly one language, 0.5 = Hindi and English equally likely."""
    p_hi, p_en = probs.get("hi", 0.0), probs.get("en", 0.0)
    return min(p_hi, p_en) / (p_hi + p_en + 1e-9)


def _mix_flag(lang: str, probs: dict, text: str):
    name = _MIXED_NAMES.get(lang)
    if not name:
        return None
    if mix_score(probs) >= CONFIG["mix_threshold"] or latin_ratio(text) >= CONFIG["latin_threshold"]:
        return name
    return None


def _generate(feats, mask, lang: str, task: str):
    import torch

    a = _asr
    kw = {"language": lang, "task": task}
    if mask is not None:
        kw["attention_mask"] = mask
    with torch.no_grad():
        ids = a["model"].generate(feats, **kw)
    texts = a["proc"].batch_decode(ids, skip_special_tokens=True, clean_up_tokenization_spaces=False)
    return [t.strip() for t in texts]


def detect_language_batch(audios, batch_size: int = 16) -> list:
    """Whisper's language probabilities for each clip: [{"hi": 0.91, "ur": 0.05, ...}, ...]."""
    a = _load_asr()
    arrays = [load_audio(x) for x in audios]
    out = []
    for s in range(0, len(arrays), batch_size):
        with _infer_lock:
            feats, _ = _features(arrays[s:s + batch_size])
            probs = _lang_probs(feats)
        for row in probs:
            out.append({c: float(p) for c, p in zip(a["codes"], row)})
    return out


def transcribe_batch(audios, lang_hint=None, candidates=None, task: str = "transcribe",
                     batch_size: int = 16, with_probs: bool = True) -> list:
    """Transcribe many clips.

    lang_hint   None (detect), one code for all clips, or a list with one code (or None) per clip.
    candidates  languages detection may pick from (see CONFIG["candidates"]).
    task        "transcribe", or "translate" for Whisper's built-in speech -> English.
    """
    import numpy as np

    a = _load_asr()
    arrays = [load_audio(x) for x in audios]
    n = len(arrays)
    hints = list(lang_hint) if isinstance(lang_hint, (list, tuple)) else [lang_hint] * n
    for h in hints:
        if h is not None and h not in a["index"]:
            raise ValueError(f"Whisper has no language '{h}'")
    out = [None] * n
    for s in range(0, n, batch_size):
        idx = list(range(s, min(n, s + batch_size)))
        t0 = time.perf_counter()
        silent = [len(arrays[i]) < 0.25 * SR or float(np.sqrt(np.mean(arrays[i] ** 2))) < CONFIG["min_rms"]
                  for i in idx]
        with _infer_lock:
            feats, mask = _features([arrays[i] for i in idx])
            need_probs = with_probs or any(hints[i] is None for i in idx)
            probs = _lang_probs(feats) if need_probs else None
            langs = [hints[i] or _pick_lang(probs[j], candidates) for j, i in enumerate(idx)]
            texts = [""] * len(idx)
            for lang in sorted(set(langs)):
                rows = [j for j, l in enumerate(langs) if l == lang and not silent[j]]
                if not rows:
                    continue
                decoded = _generate(feats[rows], mask[rows] if mask is not None else None, lang, task)
                for j, t in zip(rows, decoded):
                    texts[j] = t
        ms = int(round((time.perf_counter() - t0) * 1000 / len(idx)))
        for j, i in enumerate(idx):
            item = {"text": texts[j], "lang": langs[j], "mixed": None, "ms": ms}
            if probs is not None:
                pd_ = {c: float(p) for c, p in zip(a["codes"], probs[j])}
                top = sorted(pd_.items(), key=lambda kv: -kv[1])[:5]
                item["langProbs"] = {c: round(p, 4) for c, p in top}
                item["mixScore"] = round(mix_score(pd_), 4)
                item["latinRatio"] = round(latin_ratio(texts[j]), 3)
                if task == "transcribe":
                    item["mixed"] = _mix_flag(langs[j], pd_, texts[j])
            out[i] = item
    return out


def transcribe(audio, lang_hint=None, candidates=None) -> dict:
    """Speech -> text.  audio: 16 kHz mono WAV bytes (other formats are converted)."""
    t0 = time.perf_counter()
    r = transcribe_batch([audio], lang_hint=lang_hint, candidates=candidates)[0]
    r["ms"] = int(round((time.perf_counter() - t0) * 1000))
    return r


# --------------------------------------------------------------------------- text -> text

def nllb_code(lang: str):
    if lang in LANGS:
        return LANGS[lang]["nllb"]
    return _EXTRA_NLLB.get(lang)


def _split_sentences(text: str) -> list:
    """NLLB was trained on single sentences and can drop later ones, so feed it one at a time."""
    parts = [p.strip() for p in re.split(r"(?<=[.!?।॥])\s+", text.strip()) if p.strip()]
    merged = []
    for p in parts:
        if merged and len(merged[-1]) < 12:
            merged[-1] += " " + p
        else:
            merged.append(p)
    return merged or [text.strip()]


def _nllb_translate(texts: list, src: str, tgt: str, batch_size: int) -> list:
    import torch

    m = _load_mt()
    tok, model = m["tok"], m["model"]
    out = [""] * len(texts)
    order = sorted((i for i, t in enumerate(texts) if t.strip()), key=lambda i: len(texts[i]))
    with _infer_lock:
        tok.src_lang = nllb_code(src)
        bos = tok.convert_tokens_to_ids(nllb_code(tgt))
        for s in range(0, len(order), batch_size):
            chunk = order[s:s + batch_size]
            enc = tok([texts[i] for i in chunk], return_tensors="pt", padding=True,
                      truncation=True, max_length=256).to(m["device"])
            with torch.no_grad():
                gen = model.generate(**enc, forced_bos_token_id=bos,
                                     num_beams=CONFIG["mt_beams"], max_length=256)
            for i, t in zip(chunk, tok.batch_decode(gen, skip_special_tokens=True)):
                out[i] = t.strip()
    return out


_gem_last = [0.0]


def _gemini_request(method: str, url: str, body=None, timeout: int = 90):
    import urllib.error
    import urllib.request

    key = os.environ.get("GEMINI_API_KEY") or CONFIG.get("gemini_api_key")
    if not key:
        raise RuntimeError("GEMINI_API_KEY is not set")
    data = json.dumps(body).encode("utf8") if body is not None else None
    last = None
    for wait in (0, 6, 15, 30, 60):
        if wait:
            time.sleep(wait)
        gap = CONFIG["gemini_min_interval"] - (time.time() - _gem_last[0])
        if gap > 0:
            time.sleep(gap)
        _gem_last[0] = time.time()
        req = urllib.request.Request(url, data=data, method=method, headers={
            "Content-Type": "application/json", "x-goog-api-key": key})
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return json.loads(r.read().decode("utf8"))
        except urllib.error.HTTPError as e:
            detail = e.read().decode("utf8", "replace")[:300]
            last = RuntimeError(f"Gemini HTTP {e.code}: {detail}")
            last.code = e.code
            if e.code not in (429, 500, 502, 503, 504):
                raise last
        except Exception as e:  # network hiccup: retry
            last = RuntimeError(f"Gemini request failed: {type(e).__name__}: {e}")
    raise last


_GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta"


def _gemini_pick_model() -> str:
    """Find a current Flash model if the configured one no longer exists."""
    data = _gemini_request("GET", f"{_GEMINI_BASE}/models?pageSize=200")
    names = [m["name"].split("/")[-1] for m in data.get("models", [])
             if "generateContent" in m.get("supportedGenerationMethods", [])]
    skip = ("tts", "image", "live", "audio", "embedding", "exp", "preview", "lite", "8b")
    good = [n for n in names if "flash" in n and not any(s in n for s in skip)]
    if not good:
        good = [n for n in names if "flash" in n] or names
    if not good:
        raise RuntimeError("No usable Gemini model found for this API key")
    return sorted(good)[-1]


def gemini_generate(prompt: str, json_mode: bool = False) -> str:
    cfg = {"temperature": 0}
    if json_mode:  # ask for a JSON array of strings and nothing else
        cfg["responseMimeType"] = "application/json"
        cfg["responseSchema"] = {"type": "ARRAY", "items": {"type": "STRING"}}
    body = {"contents": [{"parts": [{"text": prompt}]}], "generationConfig": cfg}
    try:
        data = _gemini_request("POST", f"{_GEMINI_BASE}/models/{CONFIG['gemini_model']}:generateContent", body)
    except RuntimeError as e:
        if getattr(e, "code", None) != 404:
            raise
        CONFIG["gemini_model"] = _gemini_pick_model()
        data = _gemini_request("POST", f"{_GEMINI_BASE}/models/{CONFIG['gemini_model']}:generateContent", body)
    cands = data.get("candidates") or []
    if not cands:
        raise RuntimeError("Gemini returned no answer: " + json.dumps(data)[:200])
    parts = cands[0].get("content", {}).get("parts", [])
    return "".join(p.get("text", "") for p in parts if not p.get("thought")).strip()


def _gemini_translate(texts: list, src: str, tgt: str, chunk: int = 20) -> list:
    s_name = LANGS.get(src, {}).get("name", src)
    t_name = LANGS.get(tgt, {}).get("name", tgt)
    head = (
        f"You are a professional translator. Translate each numbered item from {s_name} into {t_name}.\n"
        f"The source can mix {s_name} with English words (code-switching) and can come from speech "
        "recognition, so it may contain small errors. Translate the meaning naturally and completely.\n"
    )
    out = [""] * len(texts)
    todo = [i for i, t in enumerate(texts) if t.strip()]
    for s in range(0, len(todo), chunk):
        part = todo[s:s + chunk]
        items = "\n".join(f"{k + 1}. {texts[i]}" for k, i in enumerate(part))
        prompt = (head + f"Return ONLY a JSON array of exactly {len(part)} strings, in the same order, "
                         "with no explanations.\n\n" + items)
        got = None
        try:
            got = json.loads(gemini_generate(prompt, json_mode=True))
        except (ValueError, RuntimeError) as e:
            if "GEMINI_API_KEY" in str(e):
                raise
        if isinstance(got, dict) and len(got) == 1:      # {"translations": [...]}
            got = next(iter(got.values()))
        if isinstance(got, list) and len(got) == len(part):
            for i, t in zip(part, got):
                out[i] = str(t).strip()
        else:  # count mismatch or bad JSON: go one by one
            for i in part:
                out[i] = gemini_generate(
                    head + f"Return only the {t_name} translation, nothing else.\n\n{texts[i]}").strip()
    return out


def translate_batch(texts, src: str, tgt: str, engine: str = "nllb", batch_size: int = 16) -> list:
    """Translate a list of texts. Returns a list of strings in the same order."""
    texts = [str(t or "") for t in texts]
    if src == tgt:
        return texts
    if engine == "gemini":
        return _gemini_translate(texts, src, tgt)
    if engine != "nllb":
        raise ValueError(f"unknown engine '{engine}'")
    if nllb_code(src) is None or nllb_code(tgt) is None:
        return texts  # a language NLLB is not set up for here: leave the text as it is
    if not CONFIG["split_sentences"]:
        return _nllb_translate(texts, src, tgt, batch_size)
    flat, owner = [], []
    for i, t in enumerate(texts):
        for piece in (_split_sentences(t) if t.strip() else []):
            flat.append(piece)
            owner.append(i)
    done = _nllb_translate(flat, src, tgt, batch_size)
    out = [[] for _ in texts]
    for i, t in zip(owner, done):
        out[i].append(t)
    return [" ".join(p) for p in out]


def translate(text: str, src: str, tgt: str, engine: str = "nllb") -> dict:
    """Text -> text.  engine: "nllb" (main) or "gemini" (comparison, falls back to NLLB)."""
    t0 = time.perf_counter()
    note = None
    try:
        out = translate_batch([text], src, tgt, engine=engine)[0]
    except Exception as e:
        if engine == "nllb":
            raise
        note = f"{engine} failed ({type(e).__name__}: {str(e)[:120]}), used nllb"
        engine = "nllb"
        out = translate_batch([text], src, tgt, engine="nllb")[0]
    r = {"text": out, "ms": int(round((time.perf_counter() - t0) * 1000)), "engine": engine}
    if note:
        r["note"] = note
    return r


# --------------------------------------------------------------------------- text -> speech

def synthesize(text: str, lang: str) -> dict:
    """Text -> speech.  Returns {"wav": WAV bytes, "ms"}. "wav" is b"" when the language has no voice."""
    import numpy as np
    import torch

    t0 = time.perf_counter()
    text = (text or "").strip()
    entry = _load_tts(lang) if text else None
    if not entry:
        return {"wav": b"", "ms": 0}
    tok, model = entry["tok"], entry["model"]
    if getattr(tok, "is_uroman", False):
        try:
            import uroman

            text = uroman.Uroman().romanize_string(text)
        except Exception:
            return {"wav": b"", "ms": 0}
    sr = int(model.config.sampling_rate)
    chunks = []
    with _infer_lock:
        for piece in _split_sentences(text):
            enc = tok(piece, return_tensors="pt")
            if enc["input_ids"].shape[-1] == 0:
                continue
            enc = {k: v.to(model.device) for k, v in enc.items()}
            with torch.no_grad():
                wave_t = model(**enc).waveform[0]
            chunks.append(wave_t.float().cpu().numpy())
            chunks.append(np.zeros(int(0.12 * sr), dtype=np.float32))
    if not chunks:
        return {"wav": b"", "ms": 0}
    audio = np.concatenate(chunks[:-1])
    return {"wav": wav_bytes(audio, sr), "ms": int(round((time.perf_counter() - t0) * 1000)), "sr": sr}


# --------------------------------------------------------------------------- speech -> speech

def translate_speech(audio, targets, lang_hint=None, engine: str = "nllb", candidates=None,
                     tts: bool = True, route=None) -> dict:
    """One utterance in, one translation per target language out.

    Transcribes once, then translates and speaks once per distinct target. A target equal
    to the speaker's language gets the original text and no audio.
    """
    arr = load_audio(audio)
    targets = list(dict.fromkeys(targets))

    t0 = time.perf_counter()
    asr = transcribe_batch([arr], lang_hint=lang_hint, candidates=candidates)[0]
    asr_ms = (time.perf_counter() - t0) * 1000
    src, original, mixed = asr["lang"], asr["text"], asr["mixed"]
    route = route or CONFIG["route"]["mixed" if mixed else "default"]

    t0 = time.perf_counter()
    texts = {}
    others = [t for t in targets if t != src]
    if original and others:
        if route == "pivot" and src != "en":
            english = transcribe_batch([arr], lang_hint=src, task="translate", with_probs=False)[0]["text"]
            for t in others:
                texts[t] = english if t == "en" else translate_batch([english], "en", t, engine=engine)[0]
        else:
            for t in others:
                texts[t] = translate(original, src, t, engine=engine)["text"]
    mt_ms = (time.perf_counter() - t0) * 1000

    t0 = time.perf_counter()
    results = {}
    for t in targets:
        if t == src:
            results[t] = {"text": original, "wav": b""}
        else:
            text = texts.get(t, "")
            results[t] = {"text": text, "wav": synthesize(text, t)["wav"] if (tts and text) else b""}
    tts_ms = (time.perf_counter() - t0) * 1000

    return {
        "original": original,
        "sourceLang": src,
        "mixed": mixed,
        "results": results,
        "stageMs": {"asr": int(round(asr_ms)), "mt": int(round(mt_ms)), "tts": int(round(tts_ms))},
        "route": route,
        "langProbs": asr.get("langProbs", {}),
    }


# --------------------------------------------------------------------------- command line

if __name__ == "__main__":
    import argparse

    ap = argparse.ArgumentParser(description="Polyglot: translate one audio file.")
    ap.add_argument("audio", help="audio file (wav, m4a, mp3, webm, ...)")
    ap.add_argument("--to", nargs="+", default=["en"], help="target language codes, e.g. en ta")
    ap.add_argument("--lang", default=None, help="language being spoken, if known (e.g. hi)")
    ap.add_argument("--engine", default="nllb", choices=["nllb", "gemini"])
    ap.add_argument("--save", default=None, help="folder to save the translated speech into")
    args = ap.parse_args()

    res = translate_speech(args.audio, args.to, lang_hint=args.lang, engine=args.engine)
    print(json.dumps({k: v for k, v in res.items() if k != "results"}, ensure_ascii=False, indent=2))
    for code, r in res["results"].items():
        print(f"[{code}] {r['text']}   ({len(r['wav'])} bytes of audio)")
        if args.save and r["wav"]:
            os.makedirs(args.save, exist_ok=True)
            with open(os.path.join(args.save, f"out_{code}.wav"), "wb") as f:
                f.write(r["wav"])
