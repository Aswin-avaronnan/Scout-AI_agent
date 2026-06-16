# Catalyst Scout v2 — Master Project Log

> **Purpose:** Single source of truth for decisions, progress, and context.
> Transfer this file to any AI agent to resume work with full context.
> Always update this file at the end of every working session.

---

## Project Identity

| Field | Value |
|---|---|
| Project name | Catalyst Scout v2 |
| Owner | Aswin Avaronnan |
| v1 repo | https://github.com/Aswin-avaronnan/Catalyst-hackathon-agent |
| v2 repo | TBD (new repo recommended) |
| Target deployment | Frontend: Vercel · Backend: HuggingFace Spaces (Docker) |
| Status | **PHASE-1 COMPLETE — awaiting CONFIRMATION FOR PHASE-2** |

---

## Product Summary

A browser-based AI recruiting SaaS for technical recruiters. Users bring their own LLM API key (Claude, OpenAI, Groq, Gemini, OpenRouter, or local Ollama). The platform:
- Parses job descriptions (text / PDF / URL)
- Scouts candidates from GitHub (public REST API) and Kaggle (public API)
- Accepts user-uploaded data (CSV / JSON / PDF resumes)
- Scores candidates using a configurable 60/40 formula (match vs simulation eval)
- Runs a real AI-to-AI interview simulation (LLM-A as interviewer, LLM-B as candidate)
- Ranks candidates ONLY after simulation completes
- Never stores API keys — they live in browser `sessionStorage` only

---

## Key Decisions Log

### 2026-06-01 — Initial planning session

**DEC-001: API key storage**
- Decision: `sessionStorage` only on the frontend. Never sent to or stored on the backend server. Key is passed as a request header (`X-User-Api-Key`, `X-Provider`) per request. Backend middleware strips these headers from all logs.
- Reason: Security, user trust, zero liability for key leakage.
- Status: Confirmed.

**DEC-002: Backend hosting**
- Decision: HuggingFace Spaces with Docker SDK (free tier).
- Alternatives considered:
  - Render free tier: sleeps after 15 min of inactivity — bad UX for a recruiter SaaS.
  - Railway: $5 credit then pay-per-use — acceptable fallback if HF has issues.
  - Google Cloud Run: free 2M req/month — good fallback but more setup.
  - Fly.io: good free tier but requires credit card.
- HF Spaces Docker: always-on (CPU Basic = free), git push deployment, supports FastAPI on port 7860, public HTTPS URL out of the box.
- **Port note:** HuggingFace Spaces Docker must expose port 7860. Uvicorn must bind to `0.0.0.0:7860`.
- Status: Confirmed.

**DEC-003: Frontend hosting**
- Decision: Vercel (free tier, Next.js native).
- Status: Confirmed.

**DEC-003b: PDF handling**
- Decision: Convert PDF to Markdown before LLM processing using `pymupdf4llm` (primary) with `markitdown` as fallback. Markdown is clean, structured, and LLMs parse it far better than raw text dumps.
- Pipeline: PDF upload → convert to MD in memory → pass MD string to JD parser or resume parser LLM call → discard binary. Never store the PDF server-side.
- Known limitation: Scanned PDFs (image-only) will produce empty or garbage markdown. Detect this (MD length < 100 chars after conversion) and return a clear error to the user: "This PDF appears to be a scanned image. Please upload a text-based PDF or paste the content manually."
- Status: Confirmed.

**DEC-004: Simulation design — testing phase**
- Decision: Current simulation is AI-to-AI (LLM-A interviewer, LLM-B as candidate persona). This is explicitly a TESTING PHASE to validate the pipeline, scoring, and transcript UX.
- UI must label this clearly: "AI Simulation (Beta)" — never imply this is a real candidate interaction.
- Future v3 plan: Replace LLM-B with a real candidate interface (WebRTC or WebSocket live interview). The interviewer LLM (LLM-A) remains. Recruiter watches in real time. The simulation layer will be removed or made optional at that point.
- This separation means the simulation engine must be designed as a pluggable module — `agent/simulation.py` should accept a `candidate_responder` interface so swapping AI → human is a single implementation change.
- Status: Confirmed. Simulation labeled as beta/testing in all UI copy.

**DEC-005: GitHub scouting — candidate-provided links only**
- Decision: No bulk GitHub searching or scraping unknown profiles. Backend only fetches a GitHub profile when a candidate record explicitly includes a `github_url` field provided by the recruiter (via CSV upload, JSON, or manual entry).
- Reason: Better signal quality (real applicants who chose to share), zero legal grey area, no rate limit pressure from bulk searching.
- Flow: Recruiter uploads candidate data → each row may include a `github_url` → backend fetches only that profile on demand when recruiter opens candidate detail view.
- Endpoints used per candidate (3 requests max):
  - `GET /users/{username}` — profile
  - `GET /users/{username}/repos?per_page=30&sort=updated` — recent repos
  - `GET /repos/{owner}/{repo}/languages` — top 3 repos only
- Rate limits: 60 req/hr unauthenticated (~20 enrichments/hr). GitHub PAT in key vault raises this to 5000 req/hr.
- If no `github_url` provided: scored on resume/profile data only. GitHub badge shows "Not provided".
- Bulk search removed from scope entirely.
- Status: Confirmed.

**DEC-006: Kaggle scouting**
- Decision: Phase 3. Use Kaggle public API (`kaggle.com/api/v1`). Requires user to provide Kaggle username+key (same session-only treatment as LLM keys). Surfaces: competition rank, dataset contributions, notebook medals.
- Status: Phase 3, not blocking.

**DEC-007: LLM provider abstraction + Ollama local mode**
- Decision: Single `LLMClient` class with a `complete(messages, system, max_tokens)` interface. Routes based on provider string.
  - OpenAI-compatible (OpenAI, Groq, OpenRouter): use `openai` Python SDK with custom `base_url`.
  - Anthropic (Claude): use `anthropic` SDK.
  - Google (Gemini): use `google-generativeai` SDK.
  - Ollama (local): special case — see below.
- Ollama local mode: When user selects Ollama, the frontend calls the local Ollama server DIRECTLY (`http://localhost:11434` or user-provided base URL) — it does NOT route through the HuggingFace backend. The backend cannot reach the user's local machine, so this is the only correct architecture.
  - Scouting and scoring logic still runs on the HuggingFace backend (no LLM call needed for those).
  - Only the LLM inference calls (JD parsing, simulation, scoring eval) are redirected to local Ollama.
  - Frontend has a small Ollama client module (`lib/ollama.ts`) that mirrors the same interface as the backend API calls, so switching is transparent to the UI components.
  - User must have Ollama running locally with a model pulled. UI shows a "Test connection" button that pings `{base_url}/api/tags` before proceeding.
- Status: Confirmed.

**DEC-008: Scoring formula**
- Decision: Carry forward v1's 60/40 but make weights adjustable via a slider (0–100 split).
  - Match score (default 60%): skill overlap, experience level, domain, location
  - Simulation eval score (default 40%): structured LLM evaluation of the AI-to-AI transcript
- Final ranking only after simulation. Before simulation, cards show match score only with a "Pending simulation" badge.
- Status: Confirmed.

**DEC-009: Simulation requires explicit user confirmation**
- Decision: Simulation is NEVER triggered automatically. The recruiter must click "Run Simulation" on a candidate's detail page and confirm a dialog before any LLM calls are made.
- Reason: Each simulation consumes the user's API tokens. Running it without consent would be a trust violation. Recruiter may also want to review match score first before deciding whether a simulation is worth running.
- UI: "Run Simulation" button on candidate detail view → confirmation modal showing estimated token cost range and a clear "This uses your API key" notice → user clicks Confirm → simulation starts and streams.
- Simulation cannot be triggered from the pipeline board (Kanban) directly — only from inside the candidate detail view.
- Status: Confirmed.

**DEC-010: Token budget tracker**
- Decision: Build as v2.1 feature (Phase 3 or after). Track total tokens consumed per session, estimated cost per provider. Display in a small status bar in the UI.
- Status: Deferred to v2.1.

**DEC-010: HR sharing**
- Decision: Build as v2.1 feature. For MVP, ephemeral session only. Future: generate a read-only share link (signed URL or short-lived token) that an HR team member can open to view the ranked shortlist — read-only, no API key required.
- Status: Deferred to v2.1.

**DEC-011: Authentication**
- Decision: No auth for v1. Fully ephemeral. Future: Clerk or Supabase Auth.
- Status: Deferred.

---

## Architecture Summary

```
Frontend (Next.js, Vercel)
  └── sessionStorage: {provider, apiKey, githubToken?}
  └── Pages: Onboarding → JD Input → Sourcing → Pipeline → Simulation → Settings
  └── State: Zustand (in-memory, not persisted)
  └── Streaming: EventSource (SSE) for agent thought log and sim transcript

Backend (FastAPI, HuggingFace Spaces, Docker, port 7860)
  └── Agent Core: Observe → Think → Evaluate → Generate → Critique → Finalize
  └── Tool Layer: github_scout, kaggle_scout, file_ingest, jd_parser, scorer
  └── Simulation Engine: turn-based LLM-A ↔ LLM-B loop, SSE stream output
  └── LLM Client: unified interface for all providers
  └── Middleware: strips X-User-Api-Key from logs
  └── No database. Stateless per request.
```

---

## File Structure

```
catalyst-scout-v2/
├── backend/
│   ├── agent/
│   │   ├── core.py           # Main agent loop (Observe→Finalize)
│   │   ├── scorer.py         # 60/40 scoring engine
│   │   └── simulation.py     # AI-to-AI interview loop
│   ├── tools/
│   │   ├── github_scout.py   # GitHub REST API integration
│   │   ├── kaggle_scout.py   # Kaggle API integration (Phase 3)
│   │   ├── jd_parser.py      # Structured JD extraction via LLM
│   │   └── file_ingest.py    # CSV/JSON/PDF resume parsing
│   ├── llm/
│   │   └── client.py         # Unified LLM provider abstraction
│   ├── api/
│   │   ├── routes/
│   │   │   ├── scout.py      # POST /scout — full scouting pipeline
│   │   │   ├── simulate.py   # POST /simulate — SSE stream
│   │   │   ├── parse_jd.py   # POST /parse-jd
│   │   │   └── upload.py     # POST /upload — file ingest
│   │   └── middleware/
│   │       └── log_strip.py  # Strips API key headers from logs
│   ├── main.py               # FastAPI app entry point
│   ├── Dockerfile            # HuggingFace Spaces compatible (port 7860)
│   └── requirements.txt
│
├── frontend/
│   ├── app/
│   │   ├── page.tsx          # Onboarding / key setup
│   │   ├── scout/
│   │   │   └── page.tsx      # JD input + sourcing config
│   │   ├── pipeline/
│   │   │   └── page.tsx      # Kanban board
│   │   ├── candidate/
│   │   │   └── [id]/page.tsx # Candidate detail
│   │   ├── simulate/
│   │   │   └── page.tsx      # Simulation transcript view
│   │   └── settings/
│   │       └── page.tsx      # Provider change, weight slider
│   ├── store/
│   │   └── session.ts        # Zustand store (API key, pipeline state)
│   ├── lib/
│   │   └── api.ts            # Typed fetch wrappers to backend
│   ├── components/
│   │   ├── KeyVault.tsx       # Provider selector + key input
│   │   ├── JDInput.tsx        # Job description input panel
│   │   ├── CandidateCard.tsx  # Pipeline card component
│   │   ├── KanbanBoard.tsx    # 4-column pipeline board
│   │   ├── SimTranscript.tsx  # SSE-streamed conversation view
│   │   └── ScoreBreakdown.tsx # Visual score breakdown
│   ├── package.json
│   └── next.config.ts
│
└── docs/
    ├── CATALYST_SCOUT_V2_MASTER.md  ← this file
    ├── DECISIONS.md                 (mirror of decisions above)
    └── API.md                       (endpoint reference)
| Status | **PHASE 1 COMPLETE — Phase 2 (Simulation) ready to start** |

---

## Build Progress

### Phase 1 — Core (Target: weeks 1–5)
- [x] Backend: `llm/client.py` — provider abstraction
- [x] Backend: `tools/jd_parser.py` — structured JD extraction
- [x] Backend: `tools/github_scout.py` — REST API integration
- [x] Backend: `agent/scorer.py` — 60/40 engine
- [x] Backend: `api/routes/scout.py` + `main.py`
- [x] Backend: `Dockerfile` (HuggingFace Spaces compatible)
- [x] Frontend: `store/session.ts` — Zustand with sessionStorage sync
- [x] Frontend: `page.tsx` — onboarding / key vault
- [x] Frontend: `scout/page.tsx` — JD input + GitHub search
- [x] Frontend: `pipeline/page.tsx` — Kanban board
- [x] Frontend: `components/KeyVault.tsx`

### Phase 2 — Simulation (Target: weeks 6–8)

- [ ] Backend: `agent/simulation.py` — AI-to-AI turn loop
- [ ] Backend: `api/routes/simulate.py` — SSE stream endpoint
- [ ] Backend: Post-simulation scoring integration
- [ ] Frontend: `simulate/page.tsx` — transcript view
- [ ] Frontend: `components/SimTranscript.tsx` — SSE consumer
- [ ] Frontend: Ranking UI unlocked after simulation only

### Phase 3 — Polish + Deployment (Target: weeks 9–11)
- [ ] Backend: `tools/kaggle_scout.py`
- [ ] Backend: `tools/file_ingest.py` — PDF/CSV/JSON
- [ ] Backend: `api/routes/upload.py`
- [ ] Frontend: Export to PDF/CSV
- [ ] Frontend: Settings page (weight slider, provider change)
- [ ] Deployment: HuggingFace Spaces (Docker) backend live
- [ ] Deployment: Vercel frontend live
- [ ] Landing page

### v2.1 (Future)
- [ ] Token usage + cost tracker
- [ ] HR share link (read-only, signed URL)
- [ ] User auth (Clerk or Supabase)
- [ ] Kaggle PAT in session vault

---

## Coding Standards

- Python: type-annotated, Pydantic v2 models, async throughout
- No blocking I/O in async routes — use `httpx.AsyncClient`
- All LLM calls wrapped in try/except with structured error responses
- Frontend: TypeScript strict mode, no `any`
- No hardcoded strings — all config via environment variables (backend) or Zustand store (frontend)
- API responses always include a `request_id` for traceability

---

## Environment Variables (Backend)

```
# Backend .env (not committed)
CORS_ORIGINS=https://your-vercel-domain.vercel.app
PORT=7860
LOG_LEVEL=info
# No LLM keys here — they come from request headers per session
```

## Environment Variables (Frontend)

```
# Frontend .env.local (not committed)
NEXT_PUBLIC_API_BASE_URL=https://your-hf-space.hf.space
```

---

## GitHub API — Rate Limit Strategy

| Mode | Limit | When used |
|---|---|---|
| Unauthenticated | 60 req/hr | Default |
| User PAT provided | 5000 req/hr | User optionally provides GitHub token in key vault |

Endpoints per candidate profile fetch: ~3 requests (profile + repos + languages).
At 60 req/hr unauthenticated: supports ~20 candidate lookups per hour.
Recommend: prompt user to add a GitHub PAT for bulk scouting.

---

## Simulation Design Detail

**Trigger rule:** Simulation is NEVER automatic. It requires:
1. Recruiter opens candidate detail view
2. Recruiter clicks "Run Simulation" button
3. Confirmation modal appears — shows estimated token range, provider being used, and "This uses your API key" notice
4. Recruiter clicks "Confirm & Run"
5. Only then does the backend start the turn loop and SSE stream

```
System prompt A (Interviewer):
  "You are a senior technical interviewer for the role: {job_title}.
   Job description: {jd_summary}. Required skills: {skills}.
   Ask one targeted technical question at a time. Be direct and specific.
   Do not give hints or accept vague answers. After {N} rounds, output a JSON
   evaluation: {technical_depth, communication, red_flags, hire_recommendation}."

System prompt B (Candidate):
  "You are {candidate_name}, a candidate with the following background: {profile_summary}.
   Your skills: {skills}. Answer interview questions naturally and honestly based
   on this background. Do not over-perform. Stay in character."

Turn loop:
  for turn in range(N_turns):    # N = 3–5 (configurable)
    question = llm_a.complete(history)
    answer   = llm_b.complete(history + [question])
    history.append(question, answer)
    yield SSE event: {turn, speaker, text}

  eval = llm_a.complete(history + ["Now evaluate this candidate."])
  yield SSE event: {type: "eval", data: eval_json}
```

Token budget per simulation (estimate at 3 turns, gpt-4o-mini / claude-haiku):
- ~2000 tokens input + ~800 tokens output per turn × 3 turns = ~8400 tokens
- At Groq llama3 free tier: effectively zero cost to user
- At Claude Haiku: ~$0.003 per simulation run
- Platform cost: $0 (user's key)

---

## UI Design Principles

1. Desktop-first — recruiters work at a desk
2. Neutral palette — slate/zinc (Tailwind), Inter/Geist font, no emojis anywhere
3. Shadcn/ui components throughout — consistent, accessible
4. Every async action shows explicit progress state (skeleton, spinner, SSE stream)
5. Agent thought log always visible in a collapsible side panel
6. Mobile is read-only (view pipeline, share link) — not primary
7. Keyboard shortcuts: `J`/`K` navigate cards, `Enter` open, `A` approve, `R` reject
8. Simulation requires explicit confirmation — confirmation modal must show estimated token cost and "This uses your API key" notice before any LLM call fires. No auto-trigger under any circumstance.

---

## Error Handling Strategy

### Philosophy
Every error falls into one of three severity levels. The system responds differently to each. The user is always informed, never left in a broken silent state. No error is ever swallowed silently.

| Level | Definition | Response |
|---|---|---|
| Recoverable | Partial failure, session intact | Inline error message, retry option |
| Session-breaking | Unrecoverable for current operation | Error panel + session export download |
| Critical | Entire session unusable | Full-page error + session export + clear instructions |

---

### Error Categories and Handling

**E-001: Invalid or expired API key**
- Detection: Provider returns 401/403 on first call.
- Response: Inline error on the key vault with the exact provider message. Prompt user to re-enter key. Do not clear other session state.
- No session export needed — no work has been done yet.

**E-002: API rate limit hit (provider-side)**
- Detection: Provider returns 429.
- Response: Show a rate limit banner with a countdown if `Retry-After` header is present. Queue is paused. Resume automatically when window resets OR user can manually retry. Session state preserved.
- For simulation mid-run: pause the turn loop, show "Rate limited — will resume in Xs" in the transcript view. Do not discard completed turns.

**E-003: GitHub rate limit hit**
- Detection: GitHub returns 403 with `X-RateLimit-Remaining: 0`.
- Response: Show inline on the candidate card — "GitHub enrichment paused (rate limit). Add a GitHub PAT in settings to continue, or wait until {reset_time}."
- Candidates without GitHub data are still scored on resume data. Processing continues for other candidates.

**E-004: LLM call timeout or network failure**
- Detection: `httpx.TimeoutException`, `httpx.ConnectError`, or response takes > 30s.
- Response for JD parsing: Retry once automatically. If second attempt fails, show error and let user try again manually.
- Response for simulation mid-run: Mark turn as failed in transcript. Offer "Retry this turn" button. Do not restart entire simulation.
- Response for scoring: Retry once. If fails, show partial score with a "Score incomplete" badge.

**E-005: Malformed LLM response (JSON parse failure)**
- Detection: LLM returns text that doesn't match expected JSON schema.
- Response: Log the raw response. Retry the call once with an explicit "respond only with valid JSON" reminder appended. If second attempt also fails, show "AI response was malformed — try a different model or provider" with the option to retry.

**E-006: PDF conversion failure**
- Detection: `pymupdf4llm` raises exception OR output markdown < 100 chars.
- Response: Inline error: "Could not extract text from this PDF. It may be a scanned image. Please upload a text-based PDF or paste the content manually." Offer text paste as fallback. Do not crash the session.

**E-007: File upload validation failure**
- Detection: File type not in allowed list, file > 10MB, or CSV missing required columns.
- Response: Immediate inline validation error before upload is processed. Required CSV columns are documented in the UI with a downloadable template.

**E-008: Simulation fails mid-run (unrecoverable)**
- Detection: Two consecutive turn failures, or LLM returns an error that cannot be retried (e.g. content policy violation, account suspended).
- Response: Stop the simulation. Show completed turns in the transcript. Display error card at the bottom of the transcript. Offer session export. Candidate moves back to "Scored" column on the Kanban — not lost.

**E-009: Backend unreachable (HuggingFace Spaces down)**
- Detection: Frontend fetch returns network error or 502/503.
- Response: Full-page connection error banner (non-blocking — user can still view previously loaded candidates in the Kanban). Show "Backend offline" status in the header. Retry with exponential backoff (1s, 2s, 4s, max 3 attempts). After 3 failures, show "Backend appears to be down. Your session data is safe — " + session export button.

**E-010: Ollama local server unreachable**
- Detection: Frontend ping to `{base_url}/api/tags` fails.
- Response: Inline error on the key vault: "Cannot reach Ollama at {base_url}. Make sure Ollama is running and a model is pulled (`ollama pull {model}`)." With a "Test again" button. Do not proceed until connection is confirmed.

---

### Session Export — Design

When any session-breaking error occurs, the system offers a session export. This is also available at any time via Settings → "Export session."

**What is exported:**
```json
{
  "export_version": "1.0",
  "exported_at": "ISO-8601 timestamp",
  "session": {
    "jd": { "raw": "...", "parsed": { ... } },
    "candidates": [
      {
        "id": "...",
        "name": "...",
        "source": "upload|github|manual",
        "profile": { ... },
        "github_data": { ... },
        "match_score": 0.0,
        "simulation_status": "completed|pending|failed",
        "simulation_transcript": [ ... ],
        "simulation_eval": { ... },
        "combined_score": 0.0,
        "pipeline_stage": "sourced|scored|simulated|shortlisted"
      }
    ],
    "settings": {
      "match_weight": 60,
      "sim_weight": 40
    }
  },
  "error_context": {
    "error_code": "E-008",
    "error_message": "...",
    "occurred_at": "ISO-8601 timestamp",
    "last_successful_operation": "..."
  }
}
```

**What is NOT exported:**
- API keys (never in session state at all)
- GitHub PAT
- Any provider credentials

**Delivery:**
- Frontend generates the JSON blob entirely in the browser using current Zustand state.
- Triggers `URL.createObjectURL(blob)` → auto-download as `catalyst-scout-session-{timestamp}.json`.
- Nothing is sent to the backend for this operation.
- File is not kept in any storage — once the download triggers, the blob URL is revoked.

**Re-import (v2.1 feature):**
- User can re-upload the session JSON to restore pipeline state in a new session.
- API keys must be re-entered — they are never in the export file.

---

### Frontend Error UI Patterns

Three visual components handle all errors:

1. **Inline error** (`<InlineError>`) — appears directly below the input/action that failed. Dismissable. Red text, no modal. Used for: key validation, file upload, field errors.

2. **Toast notification** (`<ErrorToast>`) — bottom-right, auto-dismisses after 6s (stays for errors requiring action). Used for: rate limits, retryable network errors, non-blocking warnings.

3. **Error panel** (`<ErrorPanel>`) — full-width banner inside the current page, not a modal. Shows error code, human-readable message, recommended action, and session export button if applicable. Used for: simulation failures, backend unreachable, unrecoverable errors. Never blocks the entire UI — user can still navigate away.

No modals for errors. Modals block the user. Error panels let the recruiter copy the error, export the session, and decide what to do — without being trapped.

---

### Backend Error Response Schema

Every backend error returns a consistent JSON shape:

```json
{
  "error": true,
  "error_code": "E-004",
  "error_category": "network_timeout",
  "message": "LLM request timed out after 30s",
  "retryable": true,
  "retry_after_seconds": null,
  "request_id": "req_abc123",
  "partial_result": null
}
```

`partial_result` is populated when partial work was completed before the error (e.g., 2 of 5 simulation turns completed). Frontend uses this to preserve partial state rather than discarding everything.

---

## Log Entries

### 2026-06-13 — Phase 1 Core Implementation Completed
- **Backend Architecture**: Implemented unified `LLMClient` supporting OpenAI, Anthropic, Google, and Groq.
- **Scouting Engine**: Built `JDParser` for structured extraction and `GitHubScout` for profile/repo enrichment.
- **Scoring**: Initialized `Scorer` to perform LLM-based match evaluation (the 60% weight).
- **Frontend Architecture**: Established Zustand stores for secure `sessionStorage` key management and pipeline state.
- **UI/UX**: Completed Onboarding, Scouting Input, and Kanban Board views with a professional "Zinc" aesthetic.
- **DevOps**: Created `Dockerfile` ready for HuggingFace Spaces.
- **Outcome**: System can now take a JD and list of usernames, fetch real GitHub data, score candidates, and display them in a ranked pipeline.

### 2026-06-13 — Phase 1 Code Review & Optimization
- **Backend Optimization**: Transitioned from sequential to **parallel candidate processing** using `asyncio.gather`. Latency reduced from $O(N)$ to $O(1)$ (effectively capped by the slowest single LLM/GitHub call).
- **Extraction Robustness**: Replaced fragile string-based JSON parsing with **regex-based extraction** (`re.DOTALL`) to handle conversational LLM outputs.
- **Frontend Architecture Fixes**:
    - Eliminated dangerous global `window` access for state; now uses standard Zustand `getState()` within API utilities.
    - Fixed hardcoded provider bug: `JDInput` now correctly pulls `provider` and `model` from the secure session store.
    - Implemented **Pipeline Persistence**: Added `sessionStorage` persistence to the pipeline store. Candidates survive refreshes but are wiped when the tab closes (Privacy First).
- **Refinement**: Switched Pydantic calls to `model_dump()` (v2 standard) for consistent serialization.

---

## Notes for Next Agent / Session

If you are an AI agent picking up this project, start here:
1. Read this file fully before writing a single line of code.
2. Check the Build Progress section to see what is done vs pending.
3. Ask the user which module to implement next — do not assume.
4. Follow the file structure exactly as defined above.
5. Every function must be fully typed and async-capable.
6. `llm/client.py` must be implemented before anything else — every other module depends on it.
7. Dockerfile must bind uvicorn to `0.0.0.0:7860` for HuggingFace Spaces.
8. Ollama is handled FRONTEND-SIDE (`lib/ollama.ts`), not the backend.
9. PDF → Markdown conversion in memory before any LLM call. Never pass raw PDF bytes.
10. Simulation always requires explicit user confirmation. Never auto-trigger.
11. Every error uses the standard backend error schema + one of the three frontend error UI components. No silent failures anywhere.
12. Session export is browser-side only — Zustand state → JSON blob → download. Backend never involved.
13. GitHub enrichment is on-demand, candidate-provided URLs only. No bulk searching.

---

*Last updated: 2026-06-13 — Phase 1 complete, core pipeline functional*
