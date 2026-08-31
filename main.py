"""
Mwesh poem-continuation backend.

One endpoint: POST /continue
Request:  {"history": ["line 1", "line 2", ...]}
Response: {"line": "..."}

This matches exactly what mwesh-site/script.js's generateNextLine() calls.
Uses the Anthropic API (swap the `call_model` function if you'd rather use
OpenAI or another provider — everything else stays the same).

Run locally:
    pip install -r requirements.txt
    export ANTHROPIC_API_KEY=sk-...
    uvicorn main:app --reload --port 8000

Then set CONTINUE_API_URL in script.js to http://localhost:8000/continue
for local testing, or your deployed URL in production.
"""

import os
import re

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import anthropic

from voice_prompt import SYSTEM_PROMPT

app = FastAPI(title="Mwesh poem continuation")

# Lock this down to your real site's domain before going live —
# "*" is fine for local testing only.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST"],
    allow_headers=["*"],
)

client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

# Very small, cheap first line of defense before anything hits the model.
# This is not a substitute for the model's own judgment (the system prompt
# already tells it to steer away from harmful content) — it's just a fast
# reject for the obvious cases.
BLOCKED_PATTERNS = [
    r"\bkill\s+yourself\b",
    r"\bchild\s+porn",
]

class ContinueRequest(BaseModel):
    history: list[str]

class ContinueResponse(BaseModel):
    line: str

def is_blocked(text: str) -> bool:
    lowered = text.lower()
    return any(re.search(p, lowered) for p in BLOCKED_PATTERNS)

def call_model(history: list[str]) -> str:
    conversation = "\n".join(history[-12:])  # keep the prompt small and cheap
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=120,
        system=SYSTEM_PROMPT,
        messages=[
            {"role": "user", "content": f"Continue this poem:\n\n{conversation}"}
        ],
    )
    return "".join(block.text for block in response.content if block.type == "text").strip()

@app.post("/continue", response_model=ContinueResponse)
def continue_poem(req: ContinueRequest) -> ContinueResponse:
    history = [h for h in req.history if h and h.strip()][-12:]

    if not history or any(is_blocked(line) for line in history):
        return ContinueResponse(line="")

    try:
        line = call_model(history)
    except Exception:
        return ContinueResponse(line="")

    if is_blocked(line):
        return ContinueResponse(line="")

    return ContinueResponse(line=line)

@app.get("/health")
def health():
    return {"status": "ok"}
