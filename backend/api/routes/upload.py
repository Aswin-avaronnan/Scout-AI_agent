import logging
from fastapi import APIRouter, Header, HTTPException, UploadFile, File, Form
from typing import Optional, List
import json
import asyncio
from backend.llm.client import get_client
from backend.tools.jd_parser import parse_jd, ParsedJD
from backend.tools.github_scout import GitHubScout, GitHubCandidateData, GitHubProfile
from backend.agent.scorer import Scorer
from backend.tools.file_ingest import (
    pdf_to_markdown,
    parse_resume_md,
    parse_candidates_csv,
    parse_candidates_json
)

logger = logging.getLogger(__name__)
router = APIRouter()

MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10MB — matches the limit already advertised in the UI
MAX_CANDIDATES_PER_SHEET = 100

async def _read_file_with_limit(file: UploadFile, max_bytes: int) -> bytes:
    """Reads an UploadFile's bytes, rejecting anything over max_bytes.
    Enforced server-side — the frontend's 'Max 10MB' label was previously cosmetic only."""
    data = await file.read()
    if len(data) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum allowed size is {max_bytes // (1024 * 1024)}MB."
        )
    return data

@router.post("/upload/resume")
async def upload_resume(
    file: UploadFile = File(...),
    jd_text: str = Form(...),
    provider: str = Form("openai"),
    model: Optional[str] = Form(None),
    x_user_api_key: str = Header(...),
    x_github_token: Optional[str] = Header(None)
):
    """
    Ingests a single PDF resume, converts to Markdown, parses candidate profile via LLM,
    scouts GitHub if a profile is present, and returns a formatted candidate record.
    """
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF resumes are supported.")
        
    try:
        # Read file bytes, enforcing the server-side size cap
        file_bytes = await _read_file_with_limit(file, MAX_UPLOAD_BYTES)
        
        # 1. Convert PDF to Markdown
        md_text = pdf_to_markdown(file_bytes)
        
        # 2. Init LLM client
        llm = get_client(provider, x_user_api_key, model=model)
        
        # 3. Parse JD and Resume concurrently
        parsed_jd_task = parse_jd(llm, jd_text)
        extracted_profile_task = parse_resume_md(llm, md_text)
        
        parsed_jd, extracted_profile = await asyncio.gather(
            parsed_jd_task,
            extracted_profile_task
        )
        
        # 4. Fetch GitHub data if username/url found
        gh_username = None
        if extracted_profile.github_url:
            import re
            url_match = re.search(r"github\.com/([^/]+)", extracted_profile.github_url)
            if url_match:
                gh_username = url_match.group(1)
        
        candidate_data = None
        top_languages = []
        
        if gh_username:
            try:
                gh_scout = GitHubScout(token=x_github_token)
                candidate_data = await gh_scout.get_candidate_data(gh_username)
                top_languages = candidate_data.top_languages
            except Exception:
                # If GitHub lookup fails, fallback to resume-only profile
                pass
                
        if not candidate_data:
            # Fallback layout using extracted resume details
            profile = GitHubProfile(
                username=gh_username or extracted_profile.email or extracted_profile.name.replace(" ", "").lower(),
                name=extracted_profile.name,
                bio=extracted_profile.bio,
                location="Unknown (from Resume)",
                public_repos=0,
                followers=0,
                following=0,
                html_url=extracted_profile.github_url or "",
                avatar_url=""
            )
            candidate_data = GitHubCandidateData(
                profile=profile,
                repos=[],
                top_languages=extracted_profile.skills[:5]
            )
            top_languages = extracted_profile.skills[:5]
            
        # 5. Score candidate matching
        scorer = Scorer(llm)
        match_eval = await scorer.calculate_match_score(parsed_jd, candidate_data)
        
        candidate_result = {
            "username": candidate_data.profile.username,
            "profile": candidate_data.profile.model_dump(),
            "top_languages": top_languages,
            "match_score": match_eval["score"],
            "reasoning": match_eval["reasoning"],
            "skill_match": match_eval["skill_match"],
            "missing_skills": match_eval["missing_skills"]
        }
        
        return {
            "job": parsed_jd.model_dump(),
            "candidates": [candidate_result]
        }
        
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except HTTPException:
        # Let intentional HTTP errors (e.g. 413 file-too-large) pass through as-is
        raise
    except Exception as e:
        logger.exception("upload_resume failed")
        raise HTTPException(status_code=500, detail="Failed to process resume. Please check the file and try again.")

@router.post("/upload/candidates")
async def upload_candidates(
    file: UploadFile = File(...),
    jd_text: str = Form(...),
    provider: str = Form("openai"),
    model: Optional[str] = Form(None),
    x_user_api_key: str = Header(...),
    x_github_token: Optional[str] = Header(None)
):
    """
    Ingests a CSV or JSON candidate sheet, parses job description,
    and runs the parallel scouting pipeline for all candidates.
    """
    filename = file.filename.lower()
    is_csv = filename.endswith(".csv")
    is_json = filename.endswith(".json")
    
    if not (is_csv or is_json):
        raise HTTPException(status_code=400, detail="Only CSV or JSON candidate sheets are supported.")
        
    try:
        file_bytes = await _read_file_with_limit(file, MAX_UPLOAD_BYTES)
        
        # 1. Parse sheets
        if is_csv:
            candidate_list = parse_candidates_csv(file_bytes)
        else:
            candidate_list = parse_candidates_json(file_bytes)

        if len(candidate_list) > MAX_CANDIDATES_PER_SHEET:
            raise HTTPException(
                status_code=413,
                detail=f"Too many candidates in sheet ({len(candidate_list)}). "
                       f"Maximum allowed is {MAX_CANDIDATES_PER_SHEET} per upload."
            )
            
        # 2. Init LLM & Parse JD
        llm = get_client(provider, x_user_api_key, model=model)
        parsed_jd = await parse_jd(llm, jd_text)
        
        # 3. Parallel scouting pipeline
        gh_scout = GitHubScout(token=x_github_token)
        scorer = Scorer(llm)
        
        async def process_candidate(candidate_entry):
            username = candidate_entry["username"]
            display_name = candidate_entry.get("name")
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
                # If GitHub lookup fails, create basic profile card using sheet data
                try:
                    profile = GitHubProfile(
                        username=username,
                        name=display_name or username,
                        bio=f"Failed to load from GitHub: {str(e)}",
                        location="Unknown",
                        public_repos=0,
                        followers=0,
                        following=0,
                        html_url=f"https://github.com/{username}",
                        avatar_url=""
                    )
                    dummy_candidate = GitHubCandidateData(
                        profile=profile,
                        repos=[],
                        top_languages=[]
                    )
                    match_eval = await scorer.calculate_match_score(parsed_jd, dummy_candidate)
                    return {
                        "username": username,
                        "profile": profile.model_dump(),
                        "top_languages": [],
                        "match_score": match_eval["score"],
                        "reasoning": match_eval["reasoning"],
                        "skill_match": match_eval["skill_match"],
                        "missing_skills": match_eval["missing_skills"]
                    }
                except Exception as inner_e:
                    return {
                        "username": username,
                        "error": f"Failed to scout or score candidate: {str(inner_e)}"
                    }
                    
        tasks = [process_candidate(c) for c in candidate_list]
        results = await asyncio.gather(*tasks)
        
        return {
            "job": parsed_jd.model_dump(),
            "candidates": results
        }
        
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except HTTPException:
        # Let intentional HTTP errors (e.g. 413 too-large/too-many) pass through as-is
        raise
    except Exception as e:
        logger.exception("upload_candidates failed")
        raise HTTPException(status_code=500, detail="Failed to process candidates list. Please check the file and try again.")
