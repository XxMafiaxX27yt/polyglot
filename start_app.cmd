@echo off
rem Starts Polyglot on this computer: the server with the real AI models, and the web app.
rem Two windows open. Close them (or press Ctrl+C in each) to stop the app.

if not exist "%~dp0ChatGPT-Codex\node_modules" (
  echo First run: installing the web app's packages. This takes a few minutes.
  pushd "%~dp0ChatGPT-Codex"
  call npm ci
  popd
)

start "Polyglot server" /D "%~dp0Gemini-Antigravity" cmd /k "set FAKE_CORE=0&& set HOST=127.0.0.1&& set PYTHONDONTWRITEBYTECODE=1&& python server.py"
start "Polyglot web app" /D "%~dp0ChatGPT-Codex" cmd /k "set VITE_BACKEND_URL=http://localhost:8000&& npm run dev"

echo.
echo Two windows have opened.
echo  1. Wait until the "Polyglot server" window says: Uvicorn running on http://127.0.0.1:8000
echo     The first start takes about a minute while the AI models load.
echo  2. Open http://localhost:5173 in Chrome or Edge, in two tabs.
echo  3. In each tab choose "Join as guest" and use the same room code.
echo.
pause
