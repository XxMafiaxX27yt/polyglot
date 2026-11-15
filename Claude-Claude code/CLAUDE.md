# Polyglot Part A (Claude's folder)

Read `PLAN.md` first (status, how to run, what was learned), then `../CONTRACT.md` (the interface Parts B and C depend on).

- The user is a high school student in a 48-hour hackathon. Deadline: Monday 16 Nov 2026, 10:29 AM India time. Explain in plain words and keep updates short.
- This folder is Part A only. `../Gemini-Antigravity` (server) and `../ChatGPT-Codex` (UI) belong to other AIs. Read them freely, but do not edit them without the user's say-so.
- Never edit `polyglot_eval.ipynb` by hand. Edit `dev/build_notebook.py` or `polyglot_core.py`, then run `python dev/build_notebook.py` and `python dev/run_notebook.py --fake`. Both must pass.
- Never report numbers from fake, 2-sentence or robot-voice runs. Never leave a test `results.json` in this folder: the server serves whatever is there as real results.
- Laptop rules: one heavy job at a time, only with the charger in, and tell the user before starting. Do not `pip install pyarrow` (Windows Smart App Control blocks it and pandas breaks). Do not change security settings.
- The user's Claude usage is limited. Be lean, and keep `PLAN.md` current so another AI can take over.
