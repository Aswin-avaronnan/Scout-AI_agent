from pydantic import BaseModel, Field
from typing import List, Optional
from backend.llm.client import LLMClient
from backend.tools.json_utils import extract_json_from_llm_response
import json
import re

class ParsedJD(BaseModel):
    job_title: str = Field("Software Engineer", description="The official title of the position")
    skills_required: List[str] = Field(default_factory=list, description="List of technical and soft skills mentioned")
    experience_years: Optional[float] = Field(None, description="Minimum years of experience required")
    summary: str = Field("Job description analysis", description="A 2-3 sentence summary of the role")
    domain: str = Field("Engineering", description="Industry domain (e.g., Fintech, Healthcare, E-commerce)")

async def parse_jd(llm: LLMClient, jd_text: str) -> ParsedJD:
    system_prompt = (
        "You are an expert technical recruiter. Extract structured data from the job description provided. "
        "Respond with ONLY a valid JSON object and nothing else — no markdown code fences, "
        "no preamble, no explanation outside the JSON."
    )

    user_prompt = (
        f"Job Description:\n{jd_text}\n\n"
        f"Respond with exactly this JSON shape, filled in with your real extraction "
        f"(this is an example only, not real values). Keep \"summary\" to 2-3 sentences maximum:\n"
        f'{{"job_title": "Senior Backend Engineer", "skills_required": ["Python", "FastAPI", "Docker"], '
        f'"experience_years": 4, "summary": "A two to three sentence summary of the role.", '
        f'"domain": "AI Infrastructure"}}'
    )

    response_text = await llm.complete(
        messages=[{"role": "user", "content": user_prompt}],
        system=system_prompt,
        max_tokens=1500,
        temperature=0.1
    )

    data = extract_json_from_llm_response(response_text)

    # Normalize key aliases if model returned alternate field names
    normalized = {
        "job_title": data.get("job_title") or data.get("title") or data.get("position") or "Software Engineer",
        "skills_required": data.get("skills_required") or data.get("skills") or data.get("requirements") or [],
        "experience_years": data.get("experience_years") or data.get("experience"),
        "summary": data.get("summary") or data.get("description") or data.get("overview") or "Job description analysis",
        "domain": data.get("domain") or data.get("industry") or data.get("category") or data.get("field") or "Engineering"
    }

    return ParsedJD(**normalized)