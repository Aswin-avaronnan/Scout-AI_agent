import logging
import time
from fastapi import APIRouter, Header, HTTPException, UploadFile, File, Form, Request
from typing import Optional, List, Any
import json
import asyncio

from backend.config import settings
from backend.limiter import limiter
from backend.llm.client import get_client
from backend.tools.jd_parser import parse_jd, ParsedJD
from backend.tools.github_scout import GitHubScout, GitHubCandidateData, GitHubProfile
from backend.agent.scorer import Scorer
from backend.tools.analytics import track_event
from backend.tools.file_ingest import (
    pdf_to_markdown,
    parse_resume_md,
    parse_candidates_csv,
    parse_candidates_json
)

logger = logging.getLogger(__name__)
router = APIRouter()

MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10MB
MAX_CANDIDATES_PER_SHEET = 100

async def _read_file_with_limit(file: UploadFile, max_bytes: int) -> bytes:
    """Reads an UploadFile's bytes, rejecting anything over max_bytes."""
    data = await file.read()
    if len(data) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum allowed size is {max_bytes // (1024 * 1024)}MB."
        )
    return data

def _normalize_bool(val: Any) -> bool:
    if isinstance(val, bool):
        return val
    if isinstance(val, str):
        return val.strip().lower() in ("true", "1", "yes", "on")
    return bool(val)

@router.post("/upload/resume")
@limiter.limit(settings.rate_limit_upload)
async def upload_resume(
    request: Request,
    files: List[UploadFile] = File(None),
    file: Optional[UploadFile] = File(None),
    jd_text: str = Form(...),
    provider: str = Form("openai"),
    model: Optional[str] = Form(None),
    enrich_github: Any = Form(True),
    max_resumes: Optional[int] = Form(None),
    session_id: Optional[str] = Form(None),
    x_user_api_key: str = Header(...),
    x_github_token: Optional[str] = Header(None)
):
    """
    Ingests single or multiple PDF resumes, converts each to Markdown, parses candidate profiles via LLM,
    optionally scouts GitHub if a profile is present and enrich_github is True,
    and returns formatted candidate records for all uploaded resumes.
    """
    start_time = time.time()
    is_enrich_enabled = _normalize_bool(enrich_github)

    upload_list: List[UploadFile] = []
    if files:
        upload_list.extend(files)
    if file and file not in upload_list:
        upload_list.append(file)

    if not upload_list:
        raise HTTPException(status_code=400, detail="No resume files provided. Please upload at least one PDF resume.")

    if max_resumes is not None and max_resumes > 0:
        upload_list = upload_list[:max_resumes]

    if len(upload_list) > MAX_CANDIDATES_PER_SHEET:
        raise HTTPException(
            status_code=413,
            detail=f"Too many resume files ({len(upload_list)}). Maximum allowed per upload is {MAX_CANDIDATES_PER_SHEET}."
        )

    track_event(
        event_type="upload_resume",
        provider=provider,
        candidate_count=len(upload_list),
        session_id=session_id
    )

    try:
        # 1. Init LLM client and parse JD ONCE
        llm = get_client(provider, x_user_api_key, model=model)
        parsed_jd = await parse_jd(llm, jd_text)

        scorer = Scorer(llm)
        gh_scout = GitHubScout(token=x_github_token)
        sem = asyncio.Semaphore(3)

        # 2. Worker to process a single resume file
        async def process_single_resume(resume_file: UploadFile) -> dict:
            async with sem:
                filename = resume_file.filename or "resume.pdf"
                if not filename.lower().endswith(".pdf"):
                    return {
                        "filename": filename,
                        "error": f"File '{filename}' is not a PDF. Only PDF resumes are supported."
                    }
                    
                try:
                    file_bytes = await _read_file_with_limit(resume_file, MAX_UPLOAD_BYTES)
                    md_text = pdf_to_markdown(file_bytes)
                    extracted_profile = await parse_resume_md(llm, md_text)
                    
                    gh_username = None
                    if is_enrich_enabled and extracted_profile.github_url:
                        import re
                        url_match = re.search(r"github\.com/([^/]+)", extracted_profile.github_url)
                        if url_match:
                            gh_username = url_match.group(1)
                    
                    candidate_data = None
                    top_languages = []
                    github_found = False
                    
                    if gh_username and is_enrich_enabled:
                        try:
                            candidate_data = await gh_scout.get_candidate_data(gh_username)
                            top_languages = candidate_data.top_languages
                            github_found = True
                        except Exception as ge:
                            logger.warning(f"Failed to fetch GitHub data for '{gh_username}' from resume: {ge}")

                    if not candidate_data:
                        import uuid
                        resume_identifier = gh_username or f"resume-{uuid.uuid4().hex[:8]}"
                        profile = GitHubProfile(
                            username=resume_identifier,
                            name=extracted_profile.name,
                            bio=extracted_profile.bio,
                            location="Not provided (resume-only)",
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

                    match_eval = await scorer.calculate_match_score(parsed_jd, candidate_data)

                    return {
                        "username": candidate_data.profile.username,
                        "profile": candidate_data.profile.model_dump(),
                        "top_languages": top_languages,
                        "github_found": github_found,
                        "match_score": match_eval["score"],
                        "reasoning": match_eval["reasoning"],
                        "skill_match": match_eval["skill_match"],
                        "missing_skills": match_eval["missing_skills"],
                        "flagged_for_review": match_eval.get("flagged_for_review", False),
                        "filename": filename
                    }
                except Exception as e:
                    logger.warning(f"Failed to process resume '{filename}': {e}")
                    return {
                        "filename": filename,
                        "error": str(e)
                    }

        # 3. Process all resumes concurrently
        tasks = [process_single_resume(f) for f in upload_list]
        candidate_results = await asyncio.gather(*tasks)

        duration_ms = int((time.time() - start_time) * 1000)
        track_event(
            event_type="candidates_scored",
            provider=provider,
            candidate_count=len(upload_list),
            duration_ms=duration_ms,
            success=True,
            session_id=session_id
        )

        return {
            "job": parsed_jd.model_dump(),
            "candidates": candidate_results
        }
        
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except HTTPException:
        raise
    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)
        logger.exception("upload_resume failed")
        track_event(
            event_type="error",
            provider=provider,
            candidate_count=len(upload_list),
            duration_ms=duration_ms,
            success=False,
            error_type=type(e).__name__,
            session_id=session_id
        )
        raise HTTPException(status_code=500, detail="Failed to process resumes. Please check your files and try again.")

@router.post("/upload/candidates")
@limiter.limit(settings.rate_limit_upload)
async def upload_candidates(
    request: Request,
    file: UploadFile = File(...),
    jd_text: str = Form(...),
    provider: str = Form("openai"),
    model: Optional[str] = Form(None),
    enrich_github: Any = Form(True),
    session_id: Optional[str] = Form(None),
    x_user_api_key: str = Header(...),
    x_github_token: Optional[str] = Header(None)
):
    """
    Ingests a CSV or JSON candidate sheet, parses job description,
    and runs the parallel scouting pipeline for all candidates.
    """
    start_time = time.time()
    filename = file.filename.lower()
    is_csv = filename.endswith(".csv")
    is_json = filename.endswith(".json")
    is_enrich_enabled = _normalize_bool(enrich_github)
    
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

        track_event(
            event_type="upload_candidates",
            provider=provider,
            candidate_count=len(candidate_list),
            session_id=session_id
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
            
            candidate_data = None
            if is_enrich_enabled:
                try:
                    candidate_data = await gh_scout.get_candidate_data(username)
                except Exception as ge:
                    logger.warning(f"Enrichment GitHub lookup failed for sheet candidate '{username}': {ge}")

            if candidate_data:
                try:
                    match_eval = await scorer.calculate_match_score(parsed_jd, candidate_data)
                    return {
                        "username": username,
                        "profile": candidate_data.profile.model_dump(),
                        "top_languages": candidate_data.top_languages,
                        "github_found": True,
                        "match_score": match_eval["score"],
                        "reasoning": match_eval["reasoning"],
                        "skill_match": match_eval["skill_match"],
                        "missing_skills": match_eval["missing_skills"],
                        "flagged_for_review": match_eval.get("flagged_for_review", False)
                    }
                except Exception as inner_e:
                    logger.warning(f"Failed to score candidate '{username}': {inner_e}")
                    return {
                        "username": username,
                        "error": f"Failed to score candidate: {str(inner_e)}"
                    }
            else:
                try:
                    profile = GitHubProfile(
                        username=username,
                        name=display_name or username,
                        bio="Sheet candidate (GitHub enrichment disabled or unavailable)",
                        location="Unknown",
                        public_repos=0,
                        followers=0,
                        following=0,
                        html_url=candidate_entry.get("github_url") or f"https://github.com/{username}",
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
                        "github_found": False,
                        "match_score": match_eval["score"],
                        "reasoning": match_eval["reasoning"],
                        "skill_match": match_eval["skill_match"],
                        "missing_skills": match_eval["missing_skills"],
                        "flagged_for_review": match_eval.get("flagged_for_review", False)
                    }
                except Exception as inner_e:
                    logger.warning(f"Failed to process sheet candidate '{username}': {inner_e}")
                    return {
                        "username": username,
                        "error": f"Failed to process candidate: {str(inner_e)}"
                    }
                    
        tasks = [process_candidate(c) for c in candidate_list]
        results = await asyncio.gather(*tasks)

        duration_ms = int((time.time() - start_time) * 1000)
        track_event(
            event_type="candidates_scored",
            provider=provider,
            candidate_count=len(candidate_list),
            duration_ms=duration_ms,
            success=True,
            session_id=session_id
        )

        return {
            "job": parsed_jd.model_dump(),
            "candidates": results
        }
        
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except HTTPException:
        raise
    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)
        logger.exception("upload_candidates failed")
        track_event(
            event_type="error",
            provider=provider,
            duration_ms=duration_ms,
            success=False,
            error_type=type(e).__name__,
            session_id=session_id
        )
        raise HTTPException(status_code=500, detail="Failed to process candidates list. Please check the file and try again.")