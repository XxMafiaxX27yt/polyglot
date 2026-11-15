# Polyglot — Part B: Backend Server (`Gemini-Antigravity`)

FastAPI + WebSocket backend implementing **Part B** of [CONTRACT.md](../CONTRACT.md).

## Files

- `server.py` — FastAPI + WebSocket room server (`/ws`, `GET /health`, `GET /results`) with `ffmpeg` audio conversion (to 16 kHz mono WAV) and built-in `FAKE_CORE=1` stub support.
- `requirements.txt` — Python dependencies (`fastapi`, `uvicorn[standard]`, `websockets`, `pydantic`).
- `test_server.py` — End-to-end async test suite verifying `/health`, `/results`, WebSocket room management, `set_lang`, `audio_start` / binary `webm/opus` frames / `audio_end`, `ffmpeg` conversion, target-language deduplication, and `utterance_start` / `partial` / `audio` / `utterance_end` events.

## Running the Server

### 1. Stub mode (`FAKE_CORE=1`) — no AI models required
```powershell
$env:FAKE_CORE="1"
python server.py
```

### 2. Real AI Core mode (with Part A's `polyglot_core.py`)
`server.py` automatically looks for `polyglot_core.py` in `./` (`Gemini-Antigravity/`) and in `../Claude-Claude code/`.
```powershell
$env:FAKE_CORE="0"
python server.py
```

## Running the End-to-End Tests
```powershell
python test_server.py
```
