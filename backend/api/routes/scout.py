from fastapi import APIRouter, Header, HTTPException, Body
from typing import List, Optional
from backend.llm.client import get_client
from backend.tools.jd_parser import parse_jd
from backend.tools.github_scout import GitHubScout
from backend.agent.scorer import Scorer
from pydantic import BaseModel

router = APIRouter()

class ScoutRequest(BaseModel):
    jd_text: str
    github_usernames: List[str]
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
        raise HTTPException(status_code=500, detail=str(e))
