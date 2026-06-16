from pydantic import BaseModel, Field
from typing import List, Optional
from backend.llm.client import LLMClient
import json

class ParsedJD(BaseModel):
    job_title: str = Field(..., description="The official title of the position")
    skills_required: List[str] = Field(default_factory=list, description="List of technical and soft skills mentioned")
    experience_years: Optional[int] = Field(None, description="Minimum years of experience required")
    summary: str = Field(..., description="A 2-3 sentence summary of the role")
    domain: str = Field(..., description="Industry domain (e.g., Fintech, Healthcare, E-commerce)")

import json
import re

async def parse_jd(llm: LLMClient, jd_text: str) -> ParsedJD:
    system_prompt = (
        "You are an expert technical recruiter. Extract structured data from the job description provided. "
        "Respond ONLY with a valid JSON object matching the requested schema."
    )
    
    user_prompt = f"Job Description:\n{jd_text}\n\nReturn JSON with keys: job_title, skills_required, experience_years, summary, domain."
    
    response_text = await llm.complete(
        messages=[{"role": "user", "content": user_prompt}],
        system=system_prompt,
        max_tokens=1000,
        temperature=0.1
    )
    
    # Improved JSON extraction via regex
    match = re.search(r"(\{.*\})", response_text, re.DOTALL)
    if not match:
        raise ValueError("Could not find JSON object in LLM response")
    
    clean_json = match.group(1)
    data = json.loads(clean_json)
    return ParsedJD(**data)
