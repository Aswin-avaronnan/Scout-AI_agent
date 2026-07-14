import logging
from fastapi import APIRouter, Header, HTTPException, Body
from typing import List, Optional
from pydantic import BaseModel, Field
from backend.llm.client import get_client
from backend.tools.jd_parser import parse_jd
from backend.tools.github_scout import GitHubScout
from backend.agent.scorer import Scorer

logger = logging.getLogger(__name__)
router = APIRouter()

MAX_CANDIDATES_PER_REQUEST = 25
MAX_JD_TEXT_CHARS = 20_000

class ScoutRequest(BaseModel):
    jd_text: str = Field(..., min_length=1, max_length=MAX_JD_TEXT_CHARS)
    github_usernames: List[str] = Field(..., min_length=1, max_length=MAX_CANDIDATES_PER_REQUEST)
    provider: str = "openai"
    model: Optional[str] = None

import asyncio

@router.post("/scout")
async def scout_candidates(
    request: ScoutRequest,
    x_user_api_key: str = Header(...),
    x_github_token: Optional[str] = Header(None)
):
    try:
        # 1. Init LLM
        llm = get_client(request.provider, x_user_api_key, model=request.model)
        
        # 2. Parse JD
        parsed_jd = await parse_jd(llm, request.jd_text)
        
        # 3. Scout and Score candidates in parallel
        gh_scout = GitHubScout(token=x_github_token)
        scorer = Scorer(llm)
        
        async def process_candidate(username):
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
                    "missing_skills": match_eval["missing_skills"]
                }
            except Exception as e:
                # Per-candidate errors are shown to the requesting user for their own
                # submitted usernames, so surfacing the message here is intentional UX,
                # not a cross-user information leak.
                return {
                    "username": username,
                    "error": str(e)
                }

        tasks = [process_candidate(u) for u in request.github_usernames]
        results = await asyncio.gather(*tasks)
        
        return {
            "job": parsed_jd.model_dump(),
            "candidates": results
        }

    except Exception as e:
        # Log the real error server-side; never echo internal exception details
        # (library internals, provider payloads, file paths) back to the client.
        logger.exception("scout_candidates failed")
        raise HTTPException(status_code=500, detail="Scouting pipeline failed. Please check your inputs and try again.")
