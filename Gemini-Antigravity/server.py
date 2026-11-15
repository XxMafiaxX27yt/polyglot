"""
Polyglot Part B — FastAPI + WebSocket Backend Server.

Follows CONTRACT.md:
- WebSocket endpoint: ws://<host>:8000/ws?room=PLG-1234&user=<id>&name=<name>&lang=<listenLang>
- Client -> server:
    {"type": "set_lang", "lang": "ta"}
    {"type": "audio_start", "id": "u-17"}
    <binary frames> (webm/opus or other audio from MediaRecorder)
    {"type": "audio_end", "id": "u-17"}
- Server -> client:
    {"type": "participants", "list": [{"id", "name", "lang"}]}
    {"type": "utterance_start", "id", "speakerId", "sourceLang", "mixed", "targetLang", "translated"}
    {"type": "partial", "id", "original"?, "translated"?}
    {"type": "utterance_end", "id", "speakerId", "sourceLang", "mixed", "targetLang", "original", "translated", "latencyMs", "stageMs": {"asr", "mt", "tts"}}
    {"type": "audio", "id", "format": "wav"} followed immediately by one binary frame (WAV bytes)
    {"type": "error", "message"}
- HTTP endpoints:
    GET /health  -> {"ok": true, "fake": bool}
    GET /results -> serves results.json from Part A
"""

from __future__ import annotations

import asyncio
import glob
import io
import json
import logging
import math
import os
import shutil
import struct
import subprocess
import sys
import tempfile
import time
import uuid
import wave
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("polyglot.server")

HERE = Path(__file__).resolve().parent
PROJECT_ROOT = HERE.parent
PART_A_DIR = PROJECT_ROOT / "Claude-Claude code"


# ---------------------------------------------------------------------------
# Fake core (used when FAKE_CORE=1 or when polyglot_core is not yet present)
# ---------------------------------------------------------------------------

def _make_beep_wav(
    freq_hz: float = 440.0,
    duration_s: float = 0.28,
    sample_rate: int = 16000,
    volume: float = 0.25,
) -> bytes:
    """Generate a clean 16 kHz 16-bit mono PCM WAV beep with fade-in/out."""
    num_samples = max(1, int(sample_rate * duration_s))
    fade_samples = min(int(sample_rate * 0.025), num_samples // 2)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        frames = bytearray()
        for i in range(num_samples):
            env = 1.0
            if fade_samples > 0:
                if i < fade_samples:
                    env = i / fade_samples
                elif i >= num_samples - fade_samples:
                    env = (num_samples - 1 - i) / fade_samples
            sample = math.sin(2.0 * math.pi * freq_hz * (i / sample_rate))
            val = int(max(-1.0, min(1.0, sample * volume * env)) * 32767)
            frames.extend(struct.pack("<h", val))
        wf.writeframes(bytes(frames))
    return buf.getvalue()


_FAKE_UTTERANCES: list[dict[str, Any]] = [
    {
        "lang": "hi",
        "mixed": "Hinglish",
        "text": "Kal meeting hai, so please complete the presentation.",
        "t": {
            "en": "The meeting is tomorrow, so please complete the presentation.",
            "hi": "कल मीटिंग है, इसलिए कृपया प्रेजेंटेशन पूरा करें।",
            "ta": "நாளை கூட்டம் உள்ளது, எனவே தயவுசெய்து விளக்கக்காட்சியை முடிக்கவும்.",
            "bn": "কাল মিটিং আছে, তাই দয়া করে প্রেজেন্টেশনটি শেষ করুন।",
        },
    },
    {
        "lang": "hi",
        "mixed": None,
        "text": "नमस्ते सभी को, आज की मीटिंग शुरू करते हैं।",
        "t": {
            "en": "Hello everyone, let's start today's meeting.",
            "hi": "नमस्ते सभी को, आज की मीटिंग शुरू करते हैं।",
            "ta": "அனைவருக்கும் வணக்கம், இன்றைய கூட்டத்தைத் தொடங்குவோம்.",
            "bn": "সবাইকে নমস্কার, आजকের মিটিং শুরু করি।",
        },
    },
    {
        "lang": "ta",
        "mixed": None,
        "text": "நன்றி. ஏதேனும் கேள்விகள் உள்ளதா?",
        "t": {
            "en": "Thank you. Are there any questions?",
            "hi": "धन्यवाद। क्या कोई सवाल है?",
            "ta": "நன்றி. ஏதேனும் கேள்விகள் உள்ளதா?",
            "bn": "ধন্যবাদ। কোনো প্রশ্ন আছে কি?",
        },
    },
    {
        "lang": "bn",
        "mixed": None,
        "text": "সব কিছু পরিষ্কার, কাল দেখা হবে।",
        "t": {
            "en": "Everything is clear, see you tomorrow.",
            "hi": "सब कुछ साफ़ है, कल मिलते हैं।",
            "ta": "எல்லாம் தெளிவாக உள்ளது, நாளை சந்திப்போம்.",
            "bn": "সব কিছু পরিষ্কার, কাল দেখা হবে।",
        },
    },
    {
        "lang": "en",
        "mixed": None,
        "text": "Let's review the evaluation metrics for each language.",
        "t": {
            "en": "Let's review the evaluation metrics for each language.",
            "hi": "चलिए प्रत्येक भाषा के लिए मूल्यांकन मेट्रिक्स की समीक्षा करते हैं।",
            "ta": "ஒவ்வொரு மொழிக்குமான மதிப்பீட்டு அளவீடுகளை மதிப்பாய்வு செய்வோம்.",
            "bn": "চলুন প্রতিটি ভাষার জন্য মূল্যায়ন মেট্রিক্স পর্যালোচনা করি।",
        },
    },
]


class _FakeCore:
    """Stub core matching Part A's polyglot_core.py interface for FAKE_CORE=1."""

    def __init__(self) -> None:
        self._seq = 0
        self._beep_wav = _make_beep_wav()
        self.warmed_up = False

    def warmup(self) -> None:
        self.warmed_up = True

    def transcribe(self, audio: bytes, lang_hint: str | None = None) -> dict[str, Any]:
        t0 = time.perf_counter()
        time.sleep(0.03)
        item = _FAKE_UTTERANCES[self._seq % len(_FAKE_UTTERANCES)]
        self._seq += 1
        lang = (
            item["lang"]
            if item.get("mixed")
            else (lang_hint if lang_hint in ("hi", "en", "ta", "bn") else item["lang"])
        )
        ms = max(1, int(round((time.perf_counter() - t0) * 1000)))
        return {
            "text": item["text"],
            "lang": lang,
            "mixed": item["mixed"],
            "ms": ms,
        }

    def translate(
        self, text: str, src: str, tgt: str, engine: str = "nllb"
    ) -> dict[str, Any]:
        t0 = time.perf_counter()
        time.sleep(0.02)
        if src == tgt:
            out = text
        else:
            matched = None
            for item in _FAKE_UTTERANCES:
                if item["text"] == text:
                    matched = item["t"].get(tgt)
                    break
            out = matched or f"[{tgt}] {text}"
        ms = max(1, int(round((time.perf_counter() - t0) * 1000)))
        return {"text": out, "ms": ms}

    def synthesize(self, text: str, lang: str) -> dict[str, Any]:
        t0 = time.perf_counter()
        time.sleep(0.02)
        ms = max(1, int(round((time.perf_counter() - t0) * 1000)))
        return {"wav": self._beep_wav, "ms": ms}

    def translate_speech(
        self,
        audio: bytes,
        targets: list[str],
        lang_hint: str | None = None,
    ) -> dict[str, Any]:
        asr = self.transcribe(audio, lang_hint=lang_hint)
        original = asr["text"]
        src_lang = asr["lang"]
        mixed = asr.get("mixed")

        results: dict[str, dict[str, Any]] = {}
        mt_total_ms = 0
        tts_total_ms = 0

        for tgt in dict.fromkeys(targets):
            mt_res = self.translate(original, src_lang, tgt)
            mt_total_ms += int(mt_res.get("ms", 0))
            tts_res = self.synthesize(mt_res["text"], tgt)
            tts_total_ms += int(tts_res.get("ms", 0))
            results[tgt] = {
                "text": mt_res["text"],
                "wav": tts_res["wav"],
            }

        return {
            "original": original,
            "sourceLang": src_lang,
            "mixed": mixed,
            "results": results,
            "stageMs": {
                "asr": int(asr.get("ms", 0)),
                "mt": mt_total_ms,
                "tts": tts_total_ms,
            },
        }


def _load_core() -> tuple[Any, bool]:
    """Load Part A's polyglot_core or fall back to _FakeCore when FAKE_CORE=1."""
    fake_env = os.environ.get("FAKE_CORE", "").strip().lower()
    if fake_env in ("1", "true", "yes"):
        logger.info("FAKE_CORE=1 enabled: using stub polyglot_core.")
        return _FakeCore(), True

    for candidate in (HERE, PART_A_DIR):
        if candidate.exists() and str(candidate) not in sys.path:
            sys.path.insert(0, str(candidate))

    try:
        import polyglot_core  # type: ignore

        logger.info("Loaded real polyglot_core from %s", getattr(polyglot_core, "__file__", "module"))
        return polyglot_core, False
    except Exception as exc:
        if fake_env in ("0", "false", "no"):
            raise RuntimeError(f"Failed to import polyglot_core with FAKE_CORE=0: {exc}") from exc
        logger.warning(
            "Could not import polyglot_core (%s); falling back to FAKE_CORE=1 stub.",
            exc,
        )
        return _FakeCore(), True


CORE, IS_FAKE = _load_core()


# ---------------------------------------------------------------------------
# Audio conversion to 16 kHz mono WAV via ffmpeg
# ---------------------------------------------------------------------------

def _find_ffmpeg() -> str:
    """Find ffmpeg on PATH or in standard Windows WinGet installation locations."""
    found = shutil.which("ffmpeg")
    if found:
        return found

    if os.name == "nt":
        local_appdata = os.environ.get("LOCALAPPDATA", "")
        if local_appdata:
            pattern = os.path.join(
                local_appdata,
                "Microsoft",
                "WinGet",
                "Packages",
                "*FFmpeg*",
                "**",
                "ffmpeg.exe",
            )
            matches = glob.glob(pattern, recursive=True)
            if matches:
                return matches[0]
    return "ffmpeg"


FFMPEG_BIN = _find_ffmpeg()


def _is_already_16k_mono_wav(data: bytes) -> bool:
    """Fast-path check if input bytes are already a 16 kHz mono 16-bit PCM WAV."""
    if len(data) < 44 or data[:4] != b"RIFF" or data[8:12] != b"WAVE":
        return False
    try:
        with wave.open(io.BytesIO(data), "rb") as wf:
            return (
                wf.getnchannels() == 1
                and wf.getsampwidth() == 2
                and wf.getframerate() == 16000
                and wf.getcomptype() == "NONE"
            )
    except Exception:
        return False


def convert_to_16k_mono_wav(raw_audio: bytes) -> bytes:
    """Convert incoming MediaRecorder audio (webm/opus, ogg, mp4, wav) to 16 kHz mono WAV."""
    if not raw_audio:
        if IS_FAKE:
            return _make_beep_wav(freq_hz=0.0, duration_s=0.1, volume=0.0)
        raise ValueError("Empty audio buffer received.")

    if _is_already_16k_mono_wav(raw_audio):
        return raw_audio

    # Attempt 1: fast in-memory pipe via stdin/stdout
    cmd_pipe = [
        FFMPEG_BIN,
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        "pipe:0",
        "-ar",
        "16000",
        "-ac",
        "1",
        "-c:a",
        "pcm_s16le",
        "-f",
        "wav",
        "pipe:1",
    ]
    try:
        proc = subprocess.run(
            cmd_pipe,
            input=raw_audio,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=15,
            check=False,
        )
        if proc.returncode == 0 and proc.stdout.startswith(b"RIFF"):
            return proc.stdout
    except FileNotFoundError:
        if IS_FAKE:
            logger.warning("ffmpeg not found in FAKE_CORE mode; returning silent WAV fallback.")
            return _make_beep_wav(freq_hz=0.0, duration_s=0.1, volume=0.0)
        raise RuntimeError("ffmpeg binary not found on system PATH.")

    # Attempt 2: temp file fallback for containers requiring seek (e.g. mp4/m4a)
    with tempfile.TemporaryDirectory(prefix="polyglot_audio_") as tmpdir:
        in_path = os.path.join(tmpdir, "input.bin")
        out_path = os.path.join(tmpdir, "output.wav")
        with open(in_path, "wb") as f:
            f.write(raw_audio)
        cmd_file = [
            FFMPEG_BIN,
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            in_path,
            "-ar",
            "16000",
            "-ac",
            "1",
            "-c:a",
            "pcm_s16le",
            "-f",
            "wav",
            out_path,
        ]
        proc2 = subprocess.run(
            cmd_file,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=15,
            check=False,
        )
        if proc2.returncode == 0 and os.path.exists(out_path):
            with open(out_path, "rb") as f:
                wav_data = f.read()
            if wav_data.startswith(b"RIFF"):
                return wav_data

        err_msg = proc2.stderr.decode("utf-8", errors="replace").strip()
        if IS_FAKE:
            logger.info("Non-audio bytes in FAKE_CORE mode (%s); using synthetic WAV.", err_msg or "unrecognized header")
            return _make_beep_wav(freq_hz=0.0, duration_s=0.1, volume=0.0)
        raise ValueError(f"ffmpeg audio conversion failed: {err_msg or 'invalid audio stream'}")


# ---------------------------------------------------------------------------
# Room & WebSocket state management
# ---------------------------------------------------------------------------

@dataclass
class ClientConn:
    conn_id: str
    room: str
    user_id: str
    name: str
    lang: str
    ws: WebSocket
    send_lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    current_utt_id: str | None = None
    audio_buffer: bytearray = field(default_factory=bytearray)

    async def send_json_safe(self, payload: dict[str, Any]) -> bool:
        try:
            async with self.send_lock:
                await asyncio.wait_for(
                    self.ws.send_text(json.dumps(payload, ensure_ascii=False)),
                    timeout=3.0,
                )
            return True
        except Exception as exc:
            logger.debug("Failed sending JSON to %s: %s", self.user_id, exc)
            return False

    async def send_audio_packet_safe(self, utt_id: str, wav_bytes: bytes) -> bool:
        """Send {'type':'audio','id':...,'format':'wav'} and its binary WAV frame atomically."""
        try:
            async with self.send_lock:
                header = {"type": "audio", "id": utt_id, "format": "wav"}
                await asyncio.wait_for(
                    self.ws.send_text(json.dumps(header, ensure_ascii=False)),
                    timeout=3.0,
                )
                await asyncio.wait_for(
                    self.ws.send_bytes(wav_bytes),
                    timeout=5.0,
                )
            return True
        except Exception as exc:
            logger.debug("Failed sending audio packet to %s: %s", self.user_id, exc)
            return False


class RoomManager:
    def __init__(self) -> None:
        self._rooms: dict[str, list[ClientConn]] = {}
        self._lock = asyncio.Lock()

    async def join(self, client: ClientConn) -> None:
        async with self._lock:
            conns = self._rooms.setdefault(client.room, [])
            conns.append(client)
        await self.broadcast_participants(client.room)

    async def leave(self, client: ClientConn) -> None:
        async with self._lock:
            conns = self._rooms.get(client.room, [])
            self._rooms[client.room] = [c for c in conns if c.conn_id != client.conn_id]
            if not self._rooms[client.room]:
                self._rooms.pop(client.room, None)
                return
        await self.broadcast_participants(client.room)

    async def set_lang(self, client: ClientConn, new_lang: str) -> None:
        client.lang = new_lang
        await self.broadcast_participants(client.room)

    async def get_room_clients(self, room: str) -> list[ClientConn]:
        async with self._lock:
            return list(self._rooms.get(room, []))

    async def broadcast_participants(self, room: str) -> None:
        conns = await self.get_room_clients(room)
        if not conns:
            return

        # Deduplicate by user_id (latest active connection wins) while keeping join order
        by_user: dict[str, dict[str, str]] = {}
        for c in conns:
            by_user[c.user_id] = {
                "id": c.user_id,
                "name": c.name,
                "lang": c.lang,
            }
        msg = {"type": "participants", "list": list(by_user.values())}
        await asyncio.gather(*(c.send_json_safe(msg) for c in conns), return_exceptions=True)


ROOMS = RoomManager()


# ---------------------------------------------------------------------------
# Utterance processing pipeline
# ---------------------------------------------------------------------------

async def process_utterance(
    speaker: ClientConn,
    utt_id: str,
    raw_audio: bytes,
    t_audio_end: float,
) -> None:
    """Convert utterance audio, run translate_speech once for distinct target langs, and fan out."""
    try:
        room_clients = await ROOMS.get_room_clients(speaker.room)
        if not room_clients:
            return

        # Other people in the room (by user_id first; if two tabs share a user_id, by conn_id)
        other_clients = [c for c in room_clients if c.user_id != speaker.user_id]
        if not other_clients:
            other_clients = [c for c in room_clients if c.conn_id != speaker.conn_id]

        # If solo testing in a single tab (no other participants in room), send back to speaker
        recipients = other_clients if other_clients else [speaker]

        # Distinct listen languages of the recipients in the room (no duplicate work)
        targets = list(dict.fromkeys(c.lang for c in recipients if c.lang))
        if not targets:
            targets = ["en"]

        # 1. Convert MediaRecorder audio to 16 kHz mono WAV via ffmpeg
        wav_16k = await asyncio.to_thread(convert_to_16k_mono_wav, raw_audio)

        # 2. Run translate_speech ONCE per utterance across distinct target languages,
        #    passing speaker.lang as lang_hint per Part A contract update.
        core_out = await asyncio.to_thread(
            CORE.translate_speech,
            wav_16k,
            targets,
            lang_hint=speaker.lang,
        )

        original: str = (core_out.get("original") or "").strip()
        if not original:
            return

        source_lang: str = core_out.get("sourceLang") or "en"
        mixed: str | None = core_out.get("mixed")
        results_by_lang: dict[str, dict[str, Any]] = core_out.get("results") or {}
        raw_stage_ms: dict[str, Any] = core_out.get("stageMs") or {}
        stage_ms = {
            "asr": int(raw_stage_ms.get("asr", 0)),
            "mt": int(raw_stage_ms.get("mt", 0)),
            "tts": int(raw_stage_ms.get("tts", 0)),
        }

        # 3. Fan out events + audio to each recipient in the room
        async def _deliver(recipient: ClientConn) -> None:
            target_lang = recipient.lang or "en"
            is_translated = bool(target_lang != source_lang)
            tgt_data = results_by_lang.get(target_lang) or {}
            translated_text = (tgt_data.get("text") or "").strip() if is_translated else None
            wav_out: bytes = tgt_data.get("wav") or b""

            # a) utterance_start
            await recipient.send_json_safe(
                {
                    "type": "utterance_start",
                    "id": utt_id,
                    "speakerId": speaker.user_id,
                    "sourceLang": source_lang,
                    "mixed": mixed,
                    "targetLang": target_lang,
                    "translated": is_translated,
                }
            )

            # b) partial (populates live captions)
            partial_payload: dict[str, Any] = {
                "type": "partial",
                "id": utt_id,
                "original": original,
            }
            if is_translated and translated_text:
                partial_payload["translated"] = translated_text
            await recipient.send_json_safe(partial_payload)

            # c) audio + one binary frame (when WAV bytes are available)
            if is_translated and isinstance(wav_out, (bytes, bytearray)) and len(wav_out) > 0:
                await recipient.send_audio_packet_safe(utt_id, bytes(wav_out))

            # Measure real time from audio_end received to translated audio sent
            latency_ms = max(1, int(round((time.perf_counter() - t_audio_end) * 1000)))

            # d) utterance_end
            await recipient.send_json_safe(
                {
                    "type": "utterance_end",
                    "id": utt_id,
                    "speakerId": speaker.user_id,
                    "sourceLang": source_lang,
                    "mixed": mixed,
                    "targetLang": target_lang,
                    "original": original,
                    "translated": translated_text if is_translated else None,
                    "latencyMs": latency_ms,
                    "stageMs": stage_ms,
                }
            )

        await asyncio.gather(*(_deliver(r) for r in recipients), return_exceptions=True)

    except Exception as exc:
        logger.exception("Error processing utterance %s from %s", utt_id, speaker.user_id)
        await speaker.send_json_safe(
            {
                "type": "error",
                "message": str(exc),
            }
        )


# ---------------------------------------------------------------------------
# FastAPI app & routes
# ---------------------------------------------------------------------------

_WARMED_UP = False


def _ensure_warmup() -> None:
    global _WARMED_UP
    if _WARMED_UP:
        return
    if hasattr(CORE, "warmup"):
        logger.info("Running polyglot_core.warmup()...")
        CORE.warmup()
        logger.info("polyglot_core.warmup() complete.")
    _WARMED_UP = True


@asynccontextmanager
async def _lifespan(_app: FastAPI):
    await asyncio.to_thread(_ensure_warmup)
    yield


app = FastAPI(title="Polyglot Backend Server", version="1.0.0", lifespan=_lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def get_health() -> dict[str, bool]:
    """Health check endpoint required by CONTRACT.md."""
    return {"ok": True, "fake": IS_FAKE}


def _find_results_json() -> Path | None:
    """Locate results.json produced by Part A (polyglot_eval.ipynb)."""
    env_path = os.environ.get("RESULTS_PATH", "").strip()
    candidates = [
        Path(env_path) if env_path else None,
        HERE / "results.json",
        PART_A_DIR / "results.json",
        PROJECT_ROOT / "results.json",
        PROJECT_ROOT / "ChatGPT-Codex" / "public" / "results.json",
    ]
    for path in candidates:
        if path and path.is_file():
            return path
    return None


@app.get("/results")
async def get_results() -> JSONResponse:
    """Serve results.json from Part A."""
    path = _find_results_json()
    if path is not None:
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            return JSONResponse(content=data)
        except Exception as exc:
            return JSONResponse(
                status_code=500,
                content={"error": f"Failed to parse {path.name}: {exc}"},
            )

    return JSONResponse(
        status_code=404,
        content={
            "error": "results.json not found yet. Run Part A's polyglot_eval.ipynb to generate it."
        },
    )


@app.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    room: str = Query(default="PLG-0000"),
    user: str = Query(default=""),
    name: str = Query(default="Guest"),
    lang: str = Query(default="en"),
) -> None:
    """
    Main room WebSocket endpoint:
    ws://<host>:8000/ws?room=PLG-1234&user=<id>&name=<name>&lang=<listenLang>
    """
    await websocket.accept()

    clean_room = (room or "PLG-0000").strip()
    clean_name = (name or "Guest").strip() or "Guest"
    clean_lang = (lang or "en").strip().lower() or "en"
    clean_user = (user or "").strip() or f"u-{uuid.uuid4().hex[:8]}"

    client = ClientConn(
        conn_id=uuid.uuid4().hex,
        room=clean_room,
        user_id=clean_user,
        name=clean_name,
        lang=clean_lang,
        ws=websocket,
    )

    logger.info(
        "Client joined room=%s user=%s name=%r lang=%s",
        client.room,
        client.user_id,
        client.name,
        client.lang,
    )
    await ROOMS.join(client)

    try:
        while True:
            message = await websocket.receive()
            msg_type = message.get("type")
            if msg_type == "websocket.disconnect":
                break

            text_data = message.get("text")
            bytes_data = message.get("bytes")

            if text_data is not None:
                try:
                    payload = json.loads(text_data)
                except json.JSONDecodeError:
                    await client.send_json_safe(
                        {"type": "error", "message": "Invalid JSON message"}
                    )
                    continue

                if not isinstance(payload, dict):
                    await client.send_json_safe(
                        {"type": "error", "message": "Expected JSON object message"}
                    )
                    continue

                event_type = payload.get("type")

                if event_type == "set_lang":
                    new_lang = str(payload.get("lang") or "").strip().lower()
                    if new_lang:
                        await ROOMS.set_lang(client, new_lang)

                elif event_type == "audio_start":
                    utt_id = str(payload.get("id") or f"u-{uuid.uuid4().hex[:8]}")
                    client.current_utt_id = utt_id
                    client.audio_buffer = bytearray()

                elif event_type == "audio_end":
                    t_audio_end = time.perf_counter()
                    utt_id = str(
                        payload.get("id")
                        or client.current_utt_id
                        or f"u-{uuid.uuid4().hex[:8]}"
                    )
                    raw_audio = bytes(client.audio_buffer)
                    client.audio_buffer = bytearray()
                    client.current_utt_id = None

                    # Process utterance asynchronously so WebSocket stays responsive
                    asyncio.create_task(
                        process_utterance(client, utt_id, raw_audio, t_audio_end)
                    )

                else:
                    await client.send_json_safe(
                        {
                            "type": "error",
                            "message": f"Unknown message type: {event_type!r}",
                        }
                    )

            elif bytes_data is not None:
                client.audio_buffer.extend(bytes_data)

    except WebSocketDisconnect:
        pass
    except Exception as exc:
        logger.exception("WebSocket error for user=%s: %s", client.user_id, exc)
    finally:
        await ROOMS.leave(client)
        logger.info("Client left room=%s user=%s", client.room, client.user_id)


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", "8000"))
    host = os.environ.get("HOST", "0.0.0.0")
    uvicorn.run(app, host=host, port=port)
