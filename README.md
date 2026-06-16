# Catalyst Scout v2

> AI-powered recruiting assistant for technical recruiters. Upload a job description, source candidates from GitHub, run AI-to-AI interview simulations, and get a ranked shortlist — all using your own LLM API key. Zero installation. Zero key storage.

---

## What It Does

1. **Parse JDs** — paste text, upload a PDF, or provide a URL; the agent extracts structured requirements.
2. **Scout candidates** — enriches candidate records with real GitHub profile data (repos, languages, activity).
3. **Score & rank** — configurable 60/40 formula: skill match score + AI simulation evaluation score.
4. **Simulate interviews** — an LLM-A interviewer questions an LLM-B candidate persona in a turn-based loop, streamed live to the UI.
5. **Pipeline board** — Kanban view with four stages: Sourced → Scored → Simulated → Shortlisted.

> **BYOK model**: your API key lives in `sessionStorage` only. It is passed per-request as an HTTP header and never logged, stored, or sent to any database.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui |
| State management | Zustand (in-memory + `sessionStorage` sync) |
| Backend | FastAPI, Python 3.11+, async throughout |
| HTTP client | `httpx.AsyncClient` (no blocking I/O in async routes) |
| LLM providers | OpenAI, Anthropic (Claude), Google (Gemini), Groq, OpenRouter, Ollama (local) |
| PDF parsing | `pymupdf4llm` → Markdown (fallback: `markitdown`) |
| Data validation | Pydantic v2 |
| Streaming | Server-Sent Events (SSE) for simulation transcript + agent thought log |
| Backend deployment | HuggingFace Spaces (Docker, port 7860, always-on free tier) |
| Frontend deployment | Vercel |
| License | MIT |

---

## Project Structure

```
catalyst-scout-v2/
├── backend/
│   ├── agent/
│   │   ├── core.py            # Observe → Think → Evaluate → Generate → Critique → Finalize loop
│   │   ├── scorer.py          # 60/40 weighted scoring engine
│   │   └── simulation.py      # AI-to-AI interview turn loop
│   ├── tools/
│   │   ├── github_scout.py    # GitHub REST API enrichment (profile + repos + languages)
│   │   ├── kaggle_scout.py    # Kaggle API (Phase 3)
│   │   ├── jd_parser.py       # Structured JD extraction via LLM
│   │   └── file_ingest.py     # CSV / JSON / PDF resume parsing
│   ├── llm/
│   │   └── client.py          # Unified provider abstraction (OpenAI / Anthropic / Gemini / Groq)
│   ├── api/
│   │   ├── routes/
│   │   │   ├── scout.py       # POST /scout
│   │   │   ├── simulate.py    # POST /simulate  (SSE)
│   │   │   ├── parse_jd.py    # POST /parse-jd
│   │   │   └── upload.py      # POST /upload
│   │   └── middleware/
│   │       └── log_strip.py   # Strips X-User-Api-Key from all logs
│   ├── main.py                # FastAPI app entry point
│   ├── Dockerfile             # HuggingFace Spaces compatible (port 7860)
│   └── requirements.txt
│
└── frontend/
    ├── app/
    │   ├── page.tsx            # Onboarding / key vault
    │   ├── scout/page.tsx      # JD input + sourcing config
    │   ├── pipeline/page.tsx   # Kanban board
    │   ├── candidate/[id]/page.tsx
    │   ├── simulate/page.tsx   # Streaming transcript view
    │   └── settings/page.tsx   # Weight sliders, provider swap
    ├── store/
    │   └── session.ts          # Zustand store (keys + pipeline state)
    ├── lib/
    │   ├── api.ts              # Typed fetch wrappers → backend
    │   └── ollama.ts           # Local Ollama client (bypasses backend entirely)
    └── components/
        ├── KeyVault.tsx
        ├── JDInput.tsx
        ├── CandidateCard.tsx
        ├── KanbanBoard.tsx
        ├── SimTranscript.tsx
        └── ScoreBreakdown.tsx
```

---

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- An API key for at least one supported LLM provider (or local Ollama)

### Backend (local)

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 7860 --reload
```

Create `backend/.env`:

```env
CORS_ORIGINS=http://localhost:3000
PORT=7860
LOG_LEVEL=info
# No LLM keys here — they come from request headers per session
```

### Frontend (local)

```bash
cd frontend
npm install
npm run dev
```

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:7860
```

---

## Deployment

### Backend → HuggingFace Spaces

1. Create a new Space → Docker SDK.
2. Push the `backend/` folder (the `Dockerfile` is already configured for port 7860).
3. The Space URL becomes your `NEXT_PUBLIC_API_BASE_URL`.

```dockerfile
# Dockerfile binds uvicorn to 0.0.0.0:7860 — required by HuggingFace Spaces
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
```

### Frontend → Vercel

```bash
cd frontend
vercel deploy
```

Set environment variable in the Vercel dashboard:

```
NEXT_PUBLIC_API_BASE_URL=https://your-space.hf.space
```

---

## Supported LLM Providers

| Provider | Auth header | Notes |
|---|---|---|
| OpenAI | `X-User-Api-Key` | GPT-4o, GPT-4o-mini |
| Anthropic | `X-User-Api-Key` | Claude 3.5 Haiku, Sonnet, Opus |
| Google | `X-User-Api-Key` | Gemini 1.5 Flash / Pro |
| Groq | `X-User-Api-Key` | Llama 3.3 70B — effectively free |
| OpenRouter | `X-User-Api-Key` | Any model via unified API |
| Ollama | _(none)_ | Calls `localhost:11434` directly from the browser — backend is **not** involved |

Keys are stored in `sessionStorage` only. They are cleared when the browser tab closes. The backend middleware strips them from all logs before they are written.

---

## Scoring Formula

```
final_score = (match_score × match_weight) + (sim_score × sim_weight)

defaults: match_weight = 0.60, sim_weight = 0.40
```

Weights are adjustable via the Settings page (0–100 slider). Final ranking is only shown after the simulation completes. Before that, candidates display their match score with a **"Pending simulation"** badge.

---

## Simulation

The simulation is an AI-to-AI interview:

- **LLM-A** acts as a senior technical interviewer briefed on the JD.
- **LLM-B** acts as the candidate persona, briefed on the candidate's profile.
- Runs for 3–5 configurable turns, streamed live via SSE.
- After the final turn, LLM-A produces a structured JSON evaluation (`technical_depth`, `communication`, `red_flags`, `hire_recommendation`).

**Simulation is never automatic.** It requires:
1. Opening the candidate detail view.
2. Clicking **"Run Simulation"**.
3. Confirming a modal that shows estimated token cost and **"This uses your API key"**.

Token cost estimate per run at 3 turns: ~8,400 tokens (~$0.003 on Claude Haiku, ~$0 on Groq).

---

## GitHub Scouting

Only candidate-provided GitHub URLs are fetched — no bulk searching or scraping.

Per candidate, up to 3 API requests are made:
- `GET /users/{username}` — profile
- `GET /users/{username}/repos?per_page=30&sort=updated` — recent repos
- `GET /repos/{owner}/{repo}/languages` — top 3 repos

| Mode | Rate limit |
|---|---|
| Unauthenticated | 60 req/hr (~20 candidates/hr) |
| GitHub PAT provided | 5,000 req/hr |

Users can optionally add a GitHub PAT in the key vault for bulk scouting.

---

## Error Handling

The system uses a 10-code error taxonomy with no silent failures:

| Code | Cause | Response |
|---|---|---|
| E-001 | Invalid/expired API key | Inline error on key vault, re-entry prompt |
| E-002 | LLM provider rate limit | Banner with countdown, auto-resume |
| E-003 | GitHub rate limit | Inline on candidate card, processing continues |
| E-004 | LLM timeout / network failure | Auto-retry once, then manual retry option |
| E-005 | Malformed LLM JSON response | Auto-retry with explicit JSON prompt |
| E-006 | PDF extraction failure | Inline error, text-paste fallback offered |
| E-007 | File upload validation failure | Immediate inline validation, CSV template download |
| E-008 | Simulation fails mid-run | Completed turns preserved, candidate returns to Scored |
| E-009 | Backend unreachable | Exponential backoff (3 attempts), session export offered |
| E-010 | Ollama server unreachable | Inline error with `ollama pull` instructions |

Every backend error returns a consistent JSON shape including `error_code`, `retryable`, `retry_after_seconds`, `request_id`, and `partial_result`.

---

## Session Export

Session state can be exported at any time via **Settings → Export Session**. The export is generated entirely in the browser (Zustand state → JSON blob → download). Nothing is sent to the backend.

The export includes: JD (raw + parsed), all candidate records, simulation transcripts, scores, pipeline stages, and error context if applicable. **API keys are never included.**

---

## Roadmap

### Phase 1 — Core Pipeline ✅
- LLM client abstraction, JD parser, GitHub scout, scorer, Kanban UI

### Phase 2 — Simulation (in progress)
- `agent/simulation.py`, SSE stream endpoint, simulation transcript UI, post-simulation ranking

### Phase 3 — Polish
- Kaggle scouting, PDF/CSV file ingest, export to PDF/CSV, Settings page, live deployment

### v2.1 — Future
- Token usage + cost tracker per session
- Read-only HR share links (signed URL)
- User authentication (Clerk or Supabase)
- Session re-import from export file

---

## Contributing

1. Fork the repo.
2. Create a feature branch: `git checkout -b feat/your-feature`.
3. Follow the coding standards: typed Python, Pydantic v2, async throughout; TypeScript strict mode, no `any`.
4. Open a PR against `main`.

---

## License

[MIT](LICENSE) © 2026 Aswin Avaronnan
