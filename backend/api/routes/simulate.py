from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import StreamingResponse
from typing import Optional
import json
import asyncio
from pydantic import BaseModel
from backend.llm.client import get_client
from backend.tools.jd_parser import ParsedJD
from backend.tools.github_scout import GitHubScout
from backend.agent.simulation import simulate_interview

router = APIRouter()

class SimulateRequest(BaseModel):
    jd: ParsedJD
    candidate_username: str
    num_turns: Optional[int] = 3
    provider: str = "openai"
    model: Optional[str] = None

@router.post("/simulate")
async def simulate_endpoint(
    request: SimulateRequest,
    x_user_api_key: str = Header(...),
    x_github_token: Optional[str] = Header(None)
):
    try:
        # 1. Fetch Candidate Data on the fly to get full repositories
        gh_scout = GitHubScout(token=x_github_token)
        candidate_data = await gh_scout.get_candidate_data(request.candidate_username)
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to fetch candidate GitHub details: {str(e)}"
        )

    try:
        # 2. Init LLM
        llm = get_client(request.provider, x_user_api_key, model=request.model)
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to initialize LLM client: {str(e)}"
        )

    # 3. Stream simulation turns via Server-Sent Events (SSE)
    async def sse_generator():
        try:
            async for event in simulate_interview(
                llm=llm,
                jd=request.jd,
                candidate=candidate_data,
                num_turns=request.num_turns or 3
            ):
                yield f"data: {json.dumps(event)}\n\n"
        except Exception as e:
            # Yield error event in SSE format
            err_data = {
                "type": "error",
                "data": {
                    "message": str(e),
                    "error_code": "E-008"
                }
            }
            yield f"data: {json.dumps(err_data)}\n\n"

    return StreamingResponse(sse_generator(), media_type="text/event-stream")
