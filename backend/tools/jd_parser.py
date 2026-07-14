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
        "Respond with ONLY a valid JSON object and nothing else — no markdown code fences, "
        "no preamble, no explanation outside the JSON."
    )

    user_prompt = (
        f"Job Description:\n{jd_text}\n\n"
        f"Respond with exactly this JSON shape, filled in with your real extraction "
        f"(this is an example only, not real values):\n"
        f'{{"job_title": "Senior Backend Engineer", "skills_required": ["Python", "FastAPI", "Docker"], '
        f'"experience_years": 4, "summary": "A two to three sentence summary of the role.", '
        f'"domain": "AI Infrastructure"}}'
    )

    response_text = await llm.complete(
        messages=[{"role": "user", "content": user_prompt}],
        system=system_prompt,
        max_tokens=1000,
        temperature=0.1
    )

    # Strip markdown code fences some models wrap JSON in despite instructions not to
    cleaned = response_text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", cleaned, flags=re.MULTILINE).strip()

    match = re.search(r"(\{.*\})", cleaned, re.DOTALL)
    if not match:
        snippet = response_text[:200].replace("\n", " ")
        raise ValueError(f"Could not find JSON object in LLM response. Model said: \"{snippet}\"")

    clean_json = match.group(1)
    try:
        data = json.loads(clean_json)
    except json.JSONDecodeError:
        repaired = clean_json.replace("'", '"')
        data = json.loads(repaired)

    return ParsedJD(**data)
