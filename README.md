# Mwesh Backend

> **FastAPI backend for the Mwesh “Write with me” poetry experience.**

This service provides the server-side continuation layer that lets the poetry site generate continuations using the author's supplied writing samples.

## Architecture

```text
Mwesh website
     │
     ▼
FastAPI /continue
     │
     ▼
Voice / poem samples
     │
     ▼
LLM provider
     │
     ▼
Generated continuation
```

The static site retains a fallback path when the backend is unavailable.

## Key files

- `voice_prompt.py` — poetry samples and voice-conditioning prompt
- `main.py` — FastAPI application
- `requirements.txt` — Python dependencies

## Local development

```bash
cd backend
pip install -r requirements.txt
export ANTHROPIC_API_KEY=...
uvicorn main:app --reload --port 8000
```

The frontend can point its continuation endpoint at the local server or a deployed backend.

## Production considerations

Before exposing the service publicly:

- restrict CORS to the actual frontend domain
- keep API credentials in environment/secret configuration
- add rate limiting
- monitor provider usage
- avoid committing credentials or private configuration

## Relationship to Mwesh

This repository is the backend companion to the static Mwesh poetry experience. The browser project can remain functional without it because the frontend has a fallback path.

## Status

🚧 **Active development**
