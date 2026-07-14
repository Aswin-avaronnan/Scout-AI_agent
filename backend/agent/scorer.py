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
            "Respond with ONLY a valid JSON object and nothing else — no markdown code fences, "
            "no preamble, no explanation outside the JSON."
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
            f"Respond with exactly this JSON shape, filled in with your real assessment "
            f"(this is an example only, not real values). Keep \"reasoning\" to one concise "
            f"sentence, under 30 words, regardless of how much GitHub activity the candidate has:\n"
            f'{{"score": 72, "reasoning": "Strong match on backend and Python experience, '
            f'limited evidence of cloud deployment work", "skill_match": ["Python", "Docker"], '
            f'"missing_skills": ["Kubernetes"]}}'
        )

        response_text = await self.llm.complete(
            messages=[{"role": "user", "content": user_prompt}],
            system=system_prompt,
            max_tokens=1500,
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
            return json.loads(clean_json)
        except json.JSONDecodeError:
            repaired = clean_json.replace("'", '"')
            return json.loads(repaired)