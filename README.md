# Mwesh backend

The piece that makes "Write with me" actually use your voice instead of the
site's built-in fallback.

## Files
- `voice_prompt.py` — edit this one. Put your real poems in `POEM_SAMPLES`.
- `main.py` — the FastAPI app. Shouldn't need edits unless you change providers.
- `requirements.txt` — Python dependencies.

## Run it locally
```
cd backend
pip install -r requirements.txt
export ANTHROPIC_API_KEY=sk-...
uvicorn main:app --reload --port 8000
```
Test it:
```
curl -X POST http://localhost:8000/continue \
  -H "Content-Type: application/json" \
  -d '{"history": ["The river keeps the names we forget to say out loud"]}'
```

## Wire it to the site
In `script.js`, set:
```js
const CONTINUE_API_URL = "http://localhost:8000/continue"; // or your deployed URL
```

## Deploying this without it spinning down
This is the one part of the project that genuinely needs a live server (an
LLM call can't run in a static site). Free tiers that sleep (Render, Railway
free) will cause the first request after a while to be slow — annoying but
not broken, since script.js's fallback covers total failures, not slow ones.
Options if that matters to you:
- Accept the cold start on a free tier — cheapest, simplest.
- A small always-on VPS (~$4-6/mo — Hetzner, DigitalOcean droplet).
- Cloudflare Workers / Vercel Edge Functions calling the Anthropic API
  directly, skipping FastAPI entirely — no spin-down, pay-per-request, no
  idle server to keep alive.

## Before this is public
- Replace `allow_origins=["*"]` in `main.py` with your real domain.
- Put `ANTHROPIC_API_KEY` in your host's secret/env config, never in code.
- Consider basic rate limiting (e.g. `slowapi`) so one visitor can't run up
  your API bill.
