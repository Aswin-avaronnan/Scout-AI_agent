# Catalyst Scout — AI Technical Recruiting Agent

**Source, score, and simulate interviews for GitHub candidates using your own LLM key. No account required. No data stored.**

🔗 **Live app:** [scout-ai-agent-khaki.vercel.app](https://scout-ai-agent-khaki.vercel.app/)
Open the link, paste an API key, start scouting — no installation, no signup.

[![CI](https://github.com/Aswin-avaronnan/Scout-AI_agent/actions/workflows/ci.yml/badge.svg)](https://github.com/Aswin-avaronnan/Scout-AI_agent/actions/workflows/ci.yml)
![Next.js](https://img.shields.io/badge/Next.js-14.2.35-black)
![FastAPI](https://img.shields.io/badge/FastAPI-0.136-009688)
![Python](https://img.shields.io/badge/Python-3.11%2B-blue)
![License](https://img.shields.io/badge/License-MIT-green)

---

## What it does

Give it a job description and a list of GitHub usernames (or a resume PDF, or a CSV). It:

1. **Parses the job description** — extracts title, required skills, years of experience, and domain using an LLM call.
2. **Scouts each candidate's GitHub profile** — pulls public repos, languages, and activity via the GitHub REST API. No scraping, no bulk search.
3. **Scores the match (0–100)** — with written reasoning, explicit skill coverage, and missing skill gaps. Not just a number.
4. **Runs AI-to-AI mock interviews** (optional) — one model plays a strict technical interviewer, another plays the candidate grounded in their real repos and bio. You get a live transcript and a structured hire recommendation.
5. **Tracks candidates on a Kanban board** — Sourced → Scored → Shortlisted — with a scoring formula you control.

Everything runs on **your API key**. It stays in your browser tab only and is never stored anywhere.

---

## Quickstart (hosted app)

1. Open the [live app](https://scout-ai-agent-khaki.vercel.app/).
2. Get a free API key — [Groq](https://console.groq.com/keys) is free and fast, good for trying this out.
3. Paste the key into the **Key Vault** on the landing page.
   - Optionally add a GitHub personal access token to raise your rate limit from 60 to 5,000 requests/hour.
4. Click **Start Scouting** → paste a job description → add GitHub usernames or upload a resume/CSV.
5. Review scored candidates on the pipeline board.
6. Click any candidate to run a simulated interview (1–10 configurable turns, streamed live).
7. Shortlist top candidates and export the full session as JSON from **Settings**.

---

## Supported LLM Providers

| Provider | Free Tier | Get a Key |
|---|---|---|
| **Groq** | ✅ Yes — fastest option | [console.groq.com](https://console.groq.com/keys) |
| **OpenAI** | ❌ Paid | [platform.openai.com](https://platform.openai.com/api-keys) |
| **Anthropic** | ❌ Paid | [console.anthropic.com](https://console.anthropic.com) |
| **Google Gemini** | ✅ Free tier via AI Studio | [aistudio.google.com](https://aistudio.google.com/apikey) |
| **OpenRouter** | ✅ Some models free | [openrouter.ai](https://openrouter.ai/keys) |

---

## How it works (architecture)

```
┌─────────────┐      HTTPS + X-User-Api-Key header      ┌───────────────┐
│   Next.js   │ ─────────────────────────────────────▶  │    FastAPI    │
│  (Vercel)   │ ◀─────────────────────────────────────  │   (Render)    │
└─────────────┘       JSON / Server-Sent Events          └──────┬────────┘
                                                                 │
                              ┌──────────────────────────────────┼──────────────────────┐
                              ▼                                  ▼                      ▼
                        GitHub REST API               Your chosen LLM API       Sentry (errors only)
                     (public profile data)         OpenAI / Anthropic / Gemini
                                                     Groq / OpenRouter
```

| Layer | Technology |
|---|---|
| Frontend | Next.js 14.2.35 (App Router), TypeScript, Tailwind CSS, Zustand |
| Backend | FastAPI 0.136, Python 3.11+, fully async |
| HTTP client | `httpx.AsyncClient` with 10s timeout |
| LLM providers | OpenAI, Anthropic, Google Gemini, Groq, OpenRouter |
| PDF parsing | `pymupdf4llm` |
| Validation | Pydantic v2 + `pydantic-settings` |
| Streaming | Server-Sent Events for live interview transcripts |
| Rate limiting | `slowapi` (IP-based, per endpoint) |
| Error monitoring | Sentry (frontend + backend) |
| Backend deploy | Render via Docker (`render.yaml` Blueprint) |
| Frontend deploy | Vercel |

---

## Feature Walkthrough

### 1. Job Description Parsing
Paste any raw JD text. An LLM call extracts `job_title`, `skills_required`, `experience_years`, `summary`, and `domain`. This structured object is reused across scoring and simulation so nothing is re-parsed mid-session.

### 2. GitHub Scouting
For each candidate username, the backend fetches:
- `GET /users/{username}` — profile, bio, company, location
- `GET /users/{username}/repos?sort=updated&per_page=30` — recent repositories
- Top-5 languages aggregated from repo metadata

Adding a GitHub token raises your rate limit from 60 → 5,000 requests/hour.

### 3. Scoring
One LLM call compares the parsed JD against the candidate's GitHub data. Returns:
- `match_score` (0–100)
- Written `reasoning` explaining the score
- `skill_match` — which required skills are covered
- `missing_skills` — gaps against the JD
- `flagged_for_review` — raised if the score looks suspicious (e.g., high score with zero repos)

### 4. Simulated Interviews *(optional, per candidate)*
Two independent LLM roles run in the same loop:
- **Interviewer** — given the JD; asks one focused technical question per turn; doesn't validate or hint.
- **Candidate persona** — given the real bio and repo data; instructed to honestly say "I haven't used that" rather than hallucinate expertise.

Configurable 1–10 turns (default 3), streamed live via SSE. After the final turn, the interviewer LLM produces:
- `technical_depth`, `communication`, `red_flags` scores
- `hire_recommendation`: Strong Hire / Hire / No Hire / Strong No Hire

### 5. Pipeline & Kanban
Candidates move through stages: **Sourced → Scored → Shortlisted**.

Final rank = `(match_score × match_weight) + (simulation_score × sim_weight)` — default 60/40, adjustable live from Settings. All ranks recalculate instantly when you move the slider.

### 6. Session Export
Settings → **Export Session** downloads your entire working session (JD, candidates, scores, transcripts) as JSON — generated entirely client-side. Your API key is never included.

---

## API Reference

All endpoints (except `/health`) require an `X-User-Api-Key` header. `X-GitHub-Token` is optional on any route that touches GitHub.

| Method | Path | Description | Rate Limit |
|---|---|---|---|
| `GET` | `/health` | Liveness check — returns version, env, status | — |
| `POST` | `/scout` | Parse JD + score a batch of GitHub usernames | 10 req/min per IP |
| `POST` | `/simulate` | Stream a live AI-to-AI interview (SSE) | 20 req/min per IP |
| `POST` | `/upload/resume` | Parse a PDF resume, cross-reference GitHub if link found | 10 req/min per IP |
| `POST` | `/upload/candidates` | Bulk score from a CSV or JSON sheet (≤ 100 rows) | 10 req/min per IP |

Request limits enforced server-side: max 25 usernames per `/scout` call, JD text ≤ 20,000 chars, files ≤ 10MB.

---

## Self-Hosting

### Prerequisites
- Python 3.11+
- Node.js 20+
- API key from at least one LLM provider

### Backend

```bash
# From the project root
pip install -r backend/requirements.txt
uvicorn backend.main:app --host 0.0.0.0 --port 7860 --reload
```

Create a `backend/.env` file (or set environment variables directly):

```env
PORT=7860
ALLOWED_ORIGINS=http://localhost:3000
ENVIRONMENT=development

# Optional — enables Sentry error monitoring
SENTRY_DSN=https://your-dsn@o0.ingest.sentry.io/0

# Optional — per-endpoint rate limits (requests per minute)
RATE_LIMIT_SCOUT=10/minute
RATE_LIMIT_SIMULATE=20/minute
RATE_LIMIT_UPLOAD=10/minute

# Optional — analytics (Supabase)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-service-role-key
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:7860

# Optional — Sentry frontend monitoring
NEXT_PUBLIC_SENTRY_DSN=https://your-dsn@o0.ingest.sentry.io/0
```

### Deploying Your Own Instance

**Backend → Render** (recommended — has a real free tier):

This repo includes `render.yaml`. Connect the repo in Render as a **Blueprint** and it auto-builds and redeploys on every push to `main`. After your first frontend deploy, update `ALLOWED_ORIGINS` in the Render dashboard to your real Vercel domain.

Also works on Google Cloud Run, HuggingFace Spaces (Docker SDK), Fly.io, or any platform that runs a Dockerfile and respects a `PORT` env var.

**Frontend → Vercel:**

```bash
cd frontend
vercel deploy
```

Set `NEXT_PUBLIC_API_BASE_URL` in the Vercel project's Environment Variables to your deployed backend URL, then trigger a redeploy (Next.js bakes `NEXT_PUBLIC_*` vars at build time).

---

## Security

| Control | Detail |
|---|---|
| **BYOK** | API keys live in `sessionStorage` only — never stored server-side, wiped when the tab closes |
| **Prompt injection defense** | All untrusted inputs (bios, repo names, JD text) are sanitised and wrapped in XML delimiters before LLM injection |
| **Score sanity checks** | Scores are clamped `[0, 100]`; suspiciously high scores with zero repo/language evidence are flagged and capped |
| **Rate limiting** | IP-based limits via `slowapi` on all write endpoints |
| **Security headers** | CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, HSTS, `Referrer-Policy` on every response |
| **CORS allowlist** | Backend only accepts browser requests from origins in `ALLOWED_ORIGINS` |
| **No error leakage** | Exceptions are logged server-side (Sentry) and never echoed to the client |
| **Key transit** | Keys travel via custom `X-User-Api-Key` header — plain HTML forms on other domains cannot trigger authenticated requests |

---

## Project Structure

```
Scout-AI_agent/
├── .github/workflows/ci.yml       # GitHub Actions — pytest + pip-audit + Next.js build + npm audit
├── render.yaml                    # Render Blueprint — backend deploy config
│
├── backend/
│   ├── main.py                    # FastAPI app, CORS, security headers, middleware, routing
│   ├── config.py                  # Pydantic Settings — validated at startup from env
│   ├── limiter.py                 # Shared slowapi rate limiter instance
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── llm/
│   │   └── client.py              # Unified LLM provider abstraction (OpenAI/Anthropic/Gemini/Groq)
│   ├── agent/
│   │   ├── scorer.py              # JD ↔ GitHub candidate match scoring with injection hardening
│   │   └── simulation.py          # AI-to-AI interview turn loop with output bounds
│   ├── tools/
│   │   ├── jd_parser.py           # Structured JD extraction
│   │   ├── github_scout.py        # GitHub REST API enrichment
│   │   ├── sanitizer.py           # Prompt injection patterns + score sanity checks
│   │   ├── analytics.py           # Anonymous usage event tracking (no PII)
│   │   └── file_ingest.py         # PDF / CSV / JSON parsing
│   ├── api/routes/
│   │   ├── scout.py               # POST /scout
│   │   ├── simulate.py            # POST /simulate (SSE)
│   │   └── upload.py              # POST /upload/resume, /upload/candidates
│   └── tests/
│       ├── test_api.py            # Integration — health, security headers, error isolation
│       ├── test_jd_parser.py      # JD extraction and injection filtering
│       ├── test_json_utils.py     # JSON repair (fences, trailing commas, truncation)
│       └── test_sanitizer.py      # Injection neutralisation, score clamping
│
└── frontend/
    ├── app/
    │   ├── page.tsx               # Onboarding + Key Vault
    │   ├── scout/page.tsx         # JD input
    │   ├── pipeline/page.tsx      # Kanban board
    │   ├── candidate/[id]/page.tsx# Candidate detail
    │   ├── simulate/page.tsx      # Live interview stream
    │   └── settings/page.tsx      # Weights, privacy, export
    ├── components/
    │   ├── KeyVault.tsx           # API key management + privacy notice
    │   ├── JDInput.tsx            # JD paste / upload trigger
    │   ├── CandidateCard.tsx      # Score card with shortlist + flag badge
    │   ├── KanbanBoard.tsx        # Pipeline board
    │   └── SimTranscript.tsx      # Live SSE interview with turn selector
    ├── store/
    │   ├── session.ts             # API keys (sessionStorage-persisted)
    │   └── pipeline.ts            # Candidates, JD, scoring weights
    ├── instrumentation.ts         # Sentry Node.js init
    ├── instrumentation-client.ts  # Sentry browser init
    ├── sentry.server.config.ts    # Sentry server config
    ├── sentry.edge.config.ts      # Sentry edge runtime config
    └── next.config.js             # CSP headers, Sentry build plugin
```

---

## CI/CD

| Stage | Tool | Trigger |
|---|---|---|
| Tests + security audit | **GitHub Actions** | Every push / PR to `main` |
| Backend deploy | **Render** (Docker + `render.yaml`) | Auto-deploy on merge to `main` |
| Frontend deploy | **Vercel** | Auto-deploy on merge to `main` |

The CI pipeline runs:
- `pytest backend/` — 15 unit and integration tests
- `pip-audit` — Python dependency vulnerability scan
- `npm run build` — TypeScript type check + Next.js production build
- `npm audit --audit-level=high` — Node dependency vulnerability scan

---

## Roadmap

- Token usage + estimated cost tracker per session
- Session re-import from a previously exported JSON file
- Read-only shareable HR links for a finished pipeline
- Dropdown model listing per provider for easier setup
- Analytics dashboard (`/admin/analytics`) for usage metrics

---

## License

MIT © Aswin Avaronnan