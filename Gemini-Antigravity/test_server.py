"""
End-to-end async test suite for Gemini-Antigravity/server.py (Part B).
Starts a real uvicorn server and tests HTTP + WebSocket flows with real sockets.
"""

from __future__ import annotations

import asyncio
import json
import os
import socket
import subprocess
import tempfile
from pathlib import Path

os.environ["FAKE_CORE"] = "1"

import httpx  # noqa: E402
import uvicorn  # noqa: E402
import websockets  # noqa: E402
import server  # noqa: E402


def _get_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return int(s.getsockname()[1])


def _make_webm_opus_sample() -> bytes:
    """Use ffmpeg to encode a short WAV tone into real webm/opus bytes (like MediaRecorder)."""
    wav_bytes = server._make_beep_wav(freq_hz=440.0, duration_s=0.3)
    cmd = [
        server.FFMPEG_BIN,
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        "pipe:0",
        "-c:a",
        "libopus",
        "-b:a",
        "32k",
        "-f",
        "webm",
        "pipe:1",
    ]
    proc = subprocess.run(
        cmd,
        input=wav_bytes,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=10,
        check=False,
    )
    if proc.returncode == 0 and proc.stdout:
        return proc.stdout
    return wav_bytes


async def _recv_json_until(ws, predicate, timeout: float = 5.0):
    async with asyncio.timeout(timeout):
        while True:
            raw = await ws.recv()
            assert isinstance(raw, str), f"Expected text JSON frame, got binary ({len(raw)} bytes)"
            msg = json.loads(raw)
            if predicate(msg):
                return msg


async def main() -> None:
    port = _get_free_port()
    config = uvicorn.Config(server.app, host="127.0.0.1", port=port, log_level="warning")
    uv_server = uvicorn.Server(config)
    server_task = asyncio.create_task(uv_server.serve())

    try:
        base_url = f"http://127.0.0.1:{port}"
        ws_base = f"ws://127.0.0.1:{port}"

        # Wait for server to come up
        async with httpx.AsyncClient(base_url=base_url, timeout=5.0) as http:
            for _ in range(30):
                try:
                    r = await http.get("/health")
                    if r.status_code == 200:
                        break
                except Exception:
                    await asyncio.sleep(0.05)

            # 1. Test GET /health & startup warmup()
            r_health = await http.get("/health")
            assert r_health.status_code == 200
            assert r_health.json() == {"ok": True, "fake": True}
            assert getattr(server.CORE, "warmed_up", False) is True, "Expected warmup() to run at startup"
            print("[PASS] GET /health & startup warmup() ->", r_health.json(), flush=True)

            # 2. Test GET /results
            sample_results = {
                "generated": "2026-11-15T12:00:00Z",
                "asr": {"hi": {"wer": 0.21, "n": 100}, "ta": {"wer": 0.24, "n": 100}, "hinglish": {"wer": 0.19, "n": 50}},
                "mt": {"en-hi": {"nllb": {"chrf": 52.1}, "gemini": {"chrf": 58.3}, "n": 100}},
                "hinglish": {"baseline": {"wer": 0.34, "chrf": 41.2}, "fix": {"wer": 0.19, "chrf": 55.8}, "n": 50},
                "latencyMs": {"asr": 180, "mt": 95, "tts": 140},
                "worst": [{"lang": "ta", "input": "test", "model": "out", "correct": "ref", "why": "idiom"}],
            }
            with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8") as tmp:
                json.dump(sample_results, tmp)
                tmp_path = tmp.name

            try:
                os.environ["RESULTS_PATH"] = tmp_path
                r_res = await http.get("/results")
                assert r_res.status_code == 200
                assert r_res.json()["hinglish"]["fix"]["chrf"] == 55.8
                print("[PASS] GET /results -> serves results.json accurately", flush=True)
            finally:
                os.environ.pop("RESULTS_PATH", None)
                Path(tmp_path).unlink(missing_ok=True)

        # 3. Test WebSocket multi-participant room, set_lang, audio_start/binary/audio_end, and target deduplication
        webm_bytes = _make_webm_opus_sample()
        assert len(webm_bytes) > 50

        async with (
            websockets.connect(f"{ws_base}/ws?room=PLG-1234&user=u-alice&name=Alice&lang=en") as ws_alice,
            websockets.connect(f"{ws_base}/ws?room=PLG-1234&user=u-bob&name=Bob&lang=ta") as ws_bob,
            websockets.connect(f"{ws_base}/ws?room=PLG-1234&user=u-charlie&name=Charlie&lang=ta") as ws_charlie,
        ):
            p_alice = await _recv_json_until(ws_alice, lambda m: m.get("type") == "participants" and len(m["list"]) == 3)
            await _recv_json_until(ws_bob, lambda m: m.get("type") == "participants" and len(m["list"]) == 3)
            await _recv_json_until(ws_charlie, lambda m: m.get("type") == "participants" and len(m["list"]) == 3)
            assert [p["id"] for p in p_alice["list"]] == ["u-alice", "u-bob", "u-charlie"]
            print("[PASS] WebSocket room join & participants broadcast ->", p_alice["list"], flush=True)

            # Test set_lang from Charlie (ta -> bn)
            await ws_charlie.send(json.dumps({"type": "set_lang", "lang": "bn"}))
            p_updated = await _recv_json_until(
                ws_alice,
                lambda m: m.get("type") == "participants"
                and any(p["id"] == "u-charlie" and p["lang"] == "bn" for p in m["list"]),
            )
            await _recv_json_until(
                ws_bob,
                lambda m: m.get("type") == "participants"
                and any(p["id"] == "u-charlie" and p["lang"] == "bn" for p in m["list"]),
            )
            await _recv_json_until(
                ws_charlie,
                lambda m: m.get("type") == "participants"
                and any(p["id"] == "u-charlie" and p["lang"] == "bn" for p in m["list"]),
            )
            print("[PASS] set_lang broadcast ->", p_updated["list"], flush=True)

            # Track calls to CORE.translate_speech to verify distinct target languages and lang_hint
            calls: list[tuple[list[str], str | None]] = []
            orig_translate_speech = server.CORE.translate_speech

            def wrapped_translate_speech(audio: bytes, targets: list[str], lang_hint=None):
                calls.append((list(targets), lang_hint))
                return orig_translate_speech(audio, targets, lang_hint=lang_hint)

            server.CORE.translate_speech = wrapped_translate_speech
            try:
                await ws_alice.send(json.dumps({"type": "audio_start", "id": "u-17"}))
                mid = len(webm_bytes) // 2
                await ws_alice.send(webm_bytes[:mid])
                await ws_alice.send(webm_bytes[mid:])
                await ws_alice.send(json.dumps({"type": "audio_end", "id": "u-17"}))

                # Verify Bob's message sequence (lang='ta')
                m1_bob = json.loads(await asyncio.wait_for(ws_bob.recv(), timeout=5.0))
                assert m1_bob["type"] == "utterance_start", m1_bob
                assert m1_bob["id"] == "u-17"
                assert m1_bob["speakerId"] == "u-alice"
                assert m1_bob["targetLang"] == "ta"
                assert m1_bob["translated"] is True

                m2_bob = json.loads(await asyncio.wait_for(ws_bob.recv(), timeout=5.0))
                assert m2_bob["type"] == "partial", m2_bob
                assert m2_bob["id"] == "u-17"
                assert m2_bob.get("original")
                assert m2_bob.get("translated")

                m3_bob = json.loads(await asyncio.wait_for(ws_bob.recv(), timeout=5.0))
                assert m3_bob == {"type": "audio", "id": "u-17", "format": "wav"}, m3_bob
                wav_bob = await asyncio.wait_for(ws_bob.recv(), timeout=5.0)
                assert isinstance(wav_bob, bytes) and wav_bob[:4] == b"RIFF" and len(wav_bob) > 100

                m4_bob = json.loads(await asyncio.wait_for(ws_bob.recv(), timeout=5.0))
                assert m4_bob["type"] == "utterance_end", m4_bob
                assert m4_bob["id"] == "u-17"
                assert m4_bob["speakerId"] == "u-alice"
                assert m4_bob["targetLang"] == "ta"
                assert isinstance(m4_bob["translated"], str) and len(m4_bob["translated"]) > 0
                assert isinstance(m4_bob["latencyMs"], int) and m4_bob["latencyMs"] > 0
                assert set(m4_bob["stageMs"].keys()) == {"asr", "mt", "tts"}
                print("[PASS] Bob (ta) received full utterance flow & WAV audio ->", m4_bob, flush=True)

                # Verify Charlie's message sequence (lang='bn')
                m1_c = json.loads(await asyncio.wait_for(ws_charlie.recv(), timeout=5.0))
                m2_c = json.loads(await asyncio.wait_for(ws_charlie.recv(), timeout=5.0))
                m3_c = json.loads(await asyncio.wait_for(ws_charlie.recv(), timeout=5.0))
                wav_c = await asyncio.wait_for(ws_charlie.recv(), timeout=5.0)
                m4_c = json.loads(await asyncio.wait_for(ws_charlie.recv(), timeout=5.0))
                assert m1_c["type"] == "utterance_start" and m1_c["targetLang"] == "bn"
                assert m2_c["type"] == "partial"
                assert m3_c == {"type": "audio", "id": "u-17", "format": "wav"}
                assert isinstance(wav_c, bytes) and wav_c[:4] == b"RIFF"
                assert m4_c["type"] == "utterance_end" and m4_c["targetLang"] == "bn"
                print("[PASS] Charlie (bn) received full utterance flow & WAV audio ->", m4_c, flush=True)

                assert len(calls) == 1, f"Expected translate_speech to run once per utterance, got {len(calls)}"
                assert calls[0] == (["ta", "bn"], "en"), f"Expected (['ta', 'bn'], 'en'), got {calls[0]}"
                print("[PASS] translate_speech called once with distinct targets & speaker lang_hint:", calls[0], flush=True)
            finally:
                server.CORE.translate_speech = orig_translate_speech

        print("\nALL END-TO-END TESTS PASSED!", flush=True)
    finally:
        uv_server.should_exit = True
        await server_task


if __name__ == "__main__":
    asyncio.run(main())
