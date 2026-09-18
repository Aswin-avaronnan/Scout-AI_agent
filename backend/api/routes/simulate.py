import logging
import time
from fastapi import APIRouter, Header, HTTPException, Request
from fastapi.responses import StreamingResponse
from typing import Optional
import json
import asyncio
from pydantic import BaseModel, Field

from backend.config import settings
from backend.limiter import limiter
from backend.llm.client import get_client
from backend.tools.jd_parser import ParsedJD
from backend.tools.github_scout import GitHubScout
from backend.agent.simulation import simulate_interview
from backend.tools.analytics import track_event

logger = logging.getLogger(__name__)
router = APIRouter()

MAX_SIMULATION_TURNS = 10

class SimulateRequest(BaseModel):
    jd: ParsedJD
    candidate_username: str
    num_turns: Optional[int] = Field(3, ge=1, le=MAX_SIMULATION_TURNS)
    provider: str = "openai"
    model: Optional[str] = None
    session_id: Optional[str] = None

@router.post("/simulate")
@limiter.limit(settings.rate_limit_simulate)
async def simulate_endpoint(
    request: Request,
    body: SimulateRequest,
    x_user_api_key: str = Header(...),
    x_github_token: Optional[str] = Header(None)
):
    start_time = time.time()
    
    # 1. Fetch Candidate Data on the fly (skip GitHub API call if it's a synthetic resume identifier)
    candidate_data = None
    is_resume_id = body.candidate_username.startswith("resume-")
    
    if not is_resume_id:
        try:
            gh_scout = GitHubScout(token=x_github_token)
            candidate_data = await gh_scout.get_candidate_data(body.candidate_username)
        except Exception as e:
            logger.warning(f"GitHub lookup skipped/failed during simulation for '{body.candidate_username}': {e}")

    if not candidate_data:
        from backend.tools.github_scout import GitHubProfile, GitHubCandidateData
        profile = GitHubProfile(
            username=body.candidate_username,
            name=body.candidate_username,
            bio="Candidate profile sourced from uploaded resume / candidate data.",
            location="Not provided",
            public_repos=0,
            followers=0,
            following=0,
            html_url="",
            avatar_url=""
        )
        candidate_data = GitHubCandidateData(
            profile=profile,
            repos=[],
            top_languages=[]
        )

    try:
        # 2. Init LLM
        llm = get_client(body.provider, x_user_api_key, model=body.model)
    except Exception as e:
        logger.warning(f"Failed to initialize LLM client for simulation: {e}")
        track_event(
            event_type="error",
            provider=body.provider,
            duration_ms=int((time.time() - start_time) * 1000),
            success=False,
            error_type="LLMInitError",
            session_id=body.session_id
        )
        raise HTTPException(
            status_code=400,
            detail=f"Failed to initialize LLM client: {str(e)}"
        )

    # 3. Stream simulation turns via Server-Sent Events (SSE)
    async def sse_generator():
        try:
            async for event in simulate_interview(
                llm=llm,
                jd=body.jd,
                candidate=candidate_data,
                num_turns=body.num_turns or 3
            ):
                yield f"data: {json.dumps(event)}\n\n"

            duration_ms = int((time.time() - start_time) * 1000)
            track_event(
                event_type="simulation_run",
                provider=body.provider,
                duration_ms=duration_ms,
                success=True,
                session_id=body.session_id
            )
        except Exception as e:
            logger.exception(f"Simulation streaming interrupted for candidate '{body.candidate_username}': {e}")
            duration_ms = int((time.time() - start_time) * 1000)
            track_event(
                event_type="error",
                provider=body.provider,
                duration_ms=duration_ms,
                success=False,
                error_type=type(e).__name__,
                session_id=body.session_id
            )
            err_data = {
                "type": "error",
                "data": {
                    "message": str(e),
                    "error_code": "E-008"
                }
            }
            yield f"data: {json.dumps(err_data)}\n\n"

    return StreamingResponse(sse_generator(), media_type="text/event-stream")
