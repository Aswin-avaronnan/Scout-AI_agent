import logging
import time
from fastapi import APIRouter, Header, HTTPException, Request
from typing import List, Optional
from pydantic import BaseModel, Field
import asyncio

from backend.config import settings
from backend.limiter import limiter
from backend.llm.client import get_client
from backend.tools.jd_parser import parse_jd
from backend.tools.github_scout import GitHubScout
from backend.agent.scorer import Scorer
from backend.tools.analytics import track_event

logger = logging.getLogger(__name__)
router = APIRouter()

MAX_CANDIDATES_PER_REQUEST = 25
MAX_JD_TEXT_CHARS = 20_000

class ScoutRequest(BaseModel):
    jd_text: str = Field(..., min_length=1, max_length=MAX_JD_TEXT_CHARS)
    github_usernames: List[str] = Field(..., min_length=1, max_length=MAX_CANDIDATES_PER_REQUEST)
    provider: str = "openai"
    model: Optional[str] = None
    session_id: Optional[str] = None

@router.post("/scout")
@limiter.limit(settings.rate_limit_scout)
async def scout_candidates(
    request: Request,
    body: ScoutRequest,
    x_user_api_key: str = Header(...),
    x_github_token: Optional[str] = Header(None)
):
    start_time = time.time()
    num_candidates = len(body.github_usernames)

    track_event(
        event_type="jd_submitted",
        provider=body.provider,
        candidate_count=num_candidates,
        session_id=body.session_id
    )

    try:
        # 1. Init LLM
        llm = get_client(body.provider, x_user_api_key, model=body.model)
        
        # 2. Parse JD
        parsed_jd = await parse_jd(llm, body.jd_text)
        
        # 3. Scout and Score candidates in parallel
        gh_scout = GitHubScout(token=x_github_token)
        scorer = Scorer(llm)
        
        async def process_candidate(username: str):
            try:
                candidate_data = await gh_scout.get_candidate_data(username)
                match_eval = await scorer.calculate_match_score(parsed_jd, candidate_data)
                
                return {
                    "username": username,
                    "profile": candidate_data.profile.model_dump(),
                    "top_languages": candidate_data.top_languages,
                    "match_score": match_eval["score"],
                    "reasoning": match_eval["reasoning"],
                    "skill_match": match_eval["skill_match"],
                    "missing_skills": match_eval["missing_skills"],
                    "flagged_for_review": match_eval.get("flagged_for_review", False),
                    "flag_reasons": match_eval.get("flag_reasons", [])
                }
            except Exception as e:
                logger.warning(f"Candidate '{username}' processing failed: {e}")
                return {
                    "username": username,
                    "error": str(e)
                }

        tasks = [process_candidate(u) for u in body.github_usernames]
        results = await asyncio.gather(*tasks)
        
        duration_ms = int((time.time() - start_time) * 1000)
        track_event(
            event_type="candidates_scored",
            provider=body.provider,
            candidate_count=num_candidates,
            duration_ms=duration_ms,
            success=True,
            session_id=body.session_id
        )

        return {
            "job": parsed_jd.model_dump(),
            "candidates": results
        }

    except HTTPException:
        raise
    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)
        logger.exception("scout_candidates failed")
        track_event(
            event_type="error",
            provider=body.provider,
            candidate_count=num_candidates,
            duration_ms=duration_ms,
            success=False,
            error_type=type(e).__name__,
            session_id=body.session_id
        )
        raise HTTPException(status_code=500, detail="Scouting pipeline failed. Please check your inputs and try again.")
