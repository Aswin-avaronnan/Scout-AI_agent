from typing import Dict, Any, List
from backend.llm.client import LLMClient
from backend.tools.jd_parser import ParsedJD
from backend.tools.github_scout import GitHubCandidateData
import json
import re

class Scorer:
    def __init__(self, llm: LLMClient):
        self.llm = llm

    async def calculate_match_score(self, jd: ParsedJD, candidate: GitHubCandidateData) -> Dict[str, Any]:
        system_prompt = (
            "You are a technical recruiting expert. Compare a job description with a candidate's GitHub profile. "
            "Calculate a match score from 0 to 100. "
            "Respond ONLY with a valid JSON object."
        )

        user_prompt = (
            f"Job Description:\n"
            f"Title: {jd.job_title}\n"
            f"Skills: {', '.join(jd.skills_required)}\n"
            f"Exp: {jd.experience_years} years\n\n"
            f"Candidate GitHub:\n"
            f"Bio: {candidate.profile.bio}\n"
            f"Top Languages: {', '.join(candidate.top_languages)}\n"
            f"Public Repos: {candidate.profile.public_repos}\n"
            f"Recent Repos: {', '.join([r.name for r in candidate.repos[:5]])}\n\n"
            f"Return JSON: {{'score': float, 'reasoning': str, 'skill_match': List[str], 'missing_skills': List[str]}}"
        )

        response_text = await self.llm.complete(
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
        return json.loads(clean_json)
