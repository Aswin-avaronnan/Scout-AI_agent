# Catalyst Scout

**AI recruiting copilot that sources, scores, and interviews candidates straight from GitHub — using your own API key, not ours.**

🔗 **Live app:** [catalyst-scout.vercel.app](https://catalyst-scout.vercel.app) *(replace with your actual Vercel URL after deploying)*
No signup. No installation. Nothing to configure. Open the link, paste an API key, start scouting.

---

## What this is

You give it a job description and a list of GitHub usernames (or a resume, or a CSV of candidates). It:

1. **Reads the job description** and extracts the real requirements — title, must-have skills, years of experience, domain.
2. **Pulls each candidate's public GitHub profile** — repos, languages, activity — no scraping, no bulk search, just the GitHub API.
3. **Scores the match** (0–100) with reasoning for *why*, plus which required skills are covered and which are missing.
4. **Optionally runs an AI-to-AI mock interview** — one model plays a strict technical interviewer, another plays the candidate persona (grounded in their actual repos and bio), and you get a live transcript plus a structured hire recommendation.
5. **Ranks everyone on a Kanban board** — Sourced → Scored → Simulated — using a scoring formula you control.

Nothing about this requires an account. **You bring your own LLM API key**, it lives in your browser tab only, and it's gone the moment you close the tab.

---

## Quickstart (using the hosted app)

1. Open the [live app](https://catalyst-scout.vercel.app).
2. Get a free API key from one provider — [Groq](https://console.groq.com/keys) is genuinely free and fast, good for trying this out.
3. Paste the key into the **Key Vault** on the landing page. Optionally add a GitHub personal access token too — it's not required, but it raises your GitHub rate limit from 60 requests/hour to 5,000.
4. Click **Start Scouting**, paste in a job description, add candidate GitHub usernames (or upload a resume PDF / CSV list).
5. Review scored candidates on the pipeline board. Open any candidate to optionally run a simulated interview.
6. Adjust how much match-score vs. interview-score counts toward the final rank from **Settings**, or export your whole session as JSON at any time.

That's the entire product. No further setup.

---

## Why BYOK (Bring Your Own Key)

This is a deliberate architectural choice, not a limitation:

- Your API key is stored in the browser's `sessionStorage` only — never in a database, never in a server log, wiped automatically when the tab closes.
- It's sent to the backend as a request header (`X-User-Api-Key`) on each call and passed straight through to your chosen LLM provider. The backend never persists it.
- Every LLM call is billed directly to *your* account, at *your* provider's rates. There's no markup, no shared quota, no "out of credits" wall.
- If you'd rather not trust a hosted app with a key at all, this is fully self-hostable — see below.

---

## How it works (architecture)

```
┌─────────────┐        HTTPS + X-User-Api-Key header        ┌──────────────┐
│   Next.js    │ ───────────────────────────────────────▶  │   FastAPI     │
│  (Vercel)    │ ◀───────────────────────────────────────  │  (Render)     │
└─────────────┘         JSON / Server-Sent Events           └──────┬───────┘
                                                                     │
                                              ┌──────────────────────┼──────────────────────┐
                                              ▼                      ▼                       ▼
                                        GitHub REST API      Your chosen LLM API      (nothing is stored —
                                     (public profile data)  (OpenAI/Anthropic/Gemini/  stateless per request)
                                                              Groq/OpenRouter)
```

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS, Zustand |
| Backend | FastAPI, Python 3.11+, fully async |
| HTTP client | `httpx.AsyncClient` |
| LLM providers | OpenAI, Anthropic, Google Gemini, Groq, OpenRouter (any OpenAI-compatible endpoint) |
| PDF parsing | `pymupdf4llm` |
| Validation | Pydantic v2 |
| Streaming | Server-Sent Events for live interview transcripts |
| Backend hosting | Render (Docker) — also runs on HuggingFace Spaces, Google Cloud Run, or any Docker host |
| Frontend hosting | Vercel |

---

## Feature walkthrough

### 1. Job description parsing
Paste raw text. An LLM call extracts `job_title`, `skills_required`, `experience_years`, a short `summary`, and `domain` — this structured object is reused across scoring and simulation so nothing gets re-parsed.

### 2. GitHub scouting
For each candidate, the backend hits the GitHub REST API directly:
- `GET /users/{username}` — profile
- `GET /users/{username}/repos?sort=updated&per_page=30` — recent repos
- Languages are aggregated from repo metadata into a top-5 list

Unauthenticated requests get GitHub's standard 60 req/hour limit; adding a personal access token in the Key Vault raises that to 5,000 req/hour.

### 3. Scoring
One LLM call compares the parsed JD against the candidate's GitHub data and returns a 0–100 match score, a short written rationale, and explicit `skill_match` / `missing_skills` lists — so you can see *why* someone scored the way they did, not just the number.

### 4. Simulated interviews (optional, per-candidate)
Two independent LLM roles run in the same conversation loop:
- **Interviewer** — briefed on the job description, asks one focused technical question per turn, doesn't validate or hint.
- **Candidate persona** — briefed on the candidate's real bio and repositories, instructed to honestly say "I haven't used that" rather than hallucinate expertise.

Default is 3 turns (configurable 1–10), streamed live to the browser via SSE. After the final turn, the interviewer LLM produces a structured evaluation: `technical_depth`, `communication`, `red_flags`, and a `hire_recommendation` (Strong Hire / Hire / No Hire / Strong No Hire).

### 5. Ranking & pipeline
Final rank = `(match_score × match_weight) + (simulation_score × sim_weight)`, default 60/40, adjustable live from Settings — every candidate's rank recalculates instantly across the board when you move the slider.

### 6. Session export
Settings → Export Session downloads your entire working session (JD, candidates, scores, transcripts) as a JSON file, generated entirely client-side. Your API key is never included in the export.

---

## Supported LLM providers

| Provider | Get a key | Notes |
|---|---|---|
| Groq | [console.groq.com](https://console.groq.com/keys) | Free tier, fast — best for trying the app out |
| OpenAI | [platform.openai.com](https://platform.openai.com/api-keys) | Default model `gpt-4o-mini` |
| Anthropic | [console.anthropic.com](https://console.anthropic.com) | Default model `claude-3-haiku-20240307` |
| Google Gemini | [aistudio.google.com](https://aistudio.google.com/apikey) | Free tier available, default `gemini-1.5-flash` |
| OpenRouter | [openrouter.ai](https://openrouter.ai/keys) | Access to nearly any model through one key |

---

## API reference

All endpoints (except `/health`) require an `X-User-Api-Key` header. `X-GitHub-Token` is optional on any route that touches GitHub.

| Method | Path | Description | Limits |
|---|---|---|---|
| `GET` | `/health` | Liveness check | — |
| `POST` | `/scout` | Parse a JD + score a list of GitHub usernames in parallel | max 25 usernames/request, JD text ≤ 20,000 chars |
| `POST` | `/simulate` | Stream a live AI-to-AI interview (SSE) for one candidate | `num_turns` between 1–10 |
| `POST` | `/upload/resume` | Parse a single PDF resume, cross-reference with GitHub if a profile link is found | PDF only, ≤ 10MB |
| `POST` | `/upload/candidates` | Bulk score candidates from a CSV or JSON sheet | ≤ 100 rows, ≤ 10MB |

All requests over these limits return a clear `4xx` with a human-readable message — nothing fails silently or times out unexpectedly.

---

## Self-hosting

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn backend.main:app --host 0.0.0.0 --port 7860 --reload
```

Environment variables (all optional — sane defaults for local dev):

```env
PORT=7860
ALLOWED_ORIGINS=http://localhost:3000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

```env
# frontend/.env.local
NEXT_PUBLIC_API_BASE_URL=http://localhost:7860
```

### Deploying your own instance

**Backend → Render** (recommended, has a real free tier):
This repo includes `render.yaml` — connect the repo in Render as a **Blueprint** and it builds, deploys, and redeploys automatically on every push. Update `ALLOWED_ORIGINS` in `render.yaml` to your real frontend domain once you have one.

Also works unmodified on Google Cloud Run, HuggingFace Spaces (Docker SDK), Fly.io, or any platform that runs a Dockerfile and respects a `PORT` env var.

**Frontend → Vercel**:
```bash
cd frontend
vercel deploy
```
Set `NEXT_PUBLIC_API_BASE_URL` in the Vercel project's environment variables to your deployed backend URL, then redeploy (Next.js bakes `NEXT_PUBLIC_*` vars in at build time, so a redeploy is required after changing it).

---

## Security notes

- **No server-side key custody** — API keys never touch a database or disk on the backend; they're relayed per-request and discarded.
- **CORS allowlist** — the backend only accepts browser requests from origins explicitly listed in `ALLOWED_ORIGINS`.
- **Request caps** — every endpoint enforces limits on payload size, candidate count, and interview length server-side, not just in the UI, to prevent abuse of the hosted instance.
- **No raw error leakage** — internal exceptions are logged server-side and never echoed to the client; API responses return generic, safe error messages.
- **Custom-header auth** — keys travel via custom HTTP headers rather than form fields, which also means a plain HTML form on another site can't silently trigger authenticated-looking requests against this API.

---

## Project structure

```
Scout-AI_agent/
├── render.yaml                     # Render Blueprint — backend deploy config
├── backend/
│   ├── main.py                     # FastAPI app entry point, CORS, routing
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── llm/
│   │   └── client.py                # Unified LLM provider abstraction
│   ├── agent/
│   │   ├── scorer.py                # JD ↔ candidate match scoring
│   │   └── simulation.py            # AI-to-AI interview turn loop
│   ├── tools/
│   │   ├── jd_parser.py             # Structured JD extraction
│   │   ├── github_scout.py          # GitHub REST API enrichment
│   │   └── file_ingest.py           # PDF / CSV / JSON parsing
│   └── api/routes/
│       ├── scout.py                 # POST /scout
│       ├── simulate.py              # POST /simulate (SSE)
│       └── upload.py                # POST /upload/resume, /upload/candidates
│
└── frontend/
    ├── app/
    │   ├── page.tsx                  # Onboarding + Key Vault
    │   ├── scout/page.tsx            # JD input
    │   ├── pipeline/page.tsx         # Kanban board
    │   ├── candidate/[id]/page.tsx   # Candidate detail
    │   ├── simulate/page.tsx         # Live interview stream
    │   └── settings/page.tsx         # Weights, key vault, export
    ├── components/
    │   ├── KeyVault.tsx
    │   ├── JDInput.tsx
    │   ├── CandidateCard.tsx
    │   ├── KanbanBoard.tsx
    │   └── SimTranscript.tsx
    ├── store/
    │   ├── session.ts                # API keys (sessionStorage-persisted)
    │   └── pipeline.ts               # Candidates, JD, scoring weights
    └── lib/api.ts                    # Typed fetch wrapper → backend
```

---

## Roadmap

- Token usage + cost tracker per session
- Read-only, shareable HR links for a finished pipeline
- Per-IP rate limiting on the hosted instance
- Session re-import from a previously exported JSON file
- drop down model listing for hazzle free initiation

---
## License

MIT © Aswin Avaronnan