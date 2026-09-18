import re
import logging
from typing import Optional, List, Dict, Any

logger = logging.getLogger(__name__)

INJECTION_PATTERNS = [
    r"\bignore\s+(all\s+)?(previous|prior|above)\s+instructions?\b",
    r"\bdisregard\s+(all\s+)?(previous|prior|above)\s+instructions?\b",
    r"\bforget\s+(all\s+)?(previous|prior|above)\s+instructions?\b",
    r"\boverride\s+(all\s+)?(previous|prior|above|system)\s+instructions?\b",
    r"\bsystem\s+prompt\b",
    r"\bnew\s+system\s+instruction(s)?\b",
    r"\byou\s+are\s+now\s+(an?|in)\b",
    r"\bdeveloper\s+mode\b",
    r"\bdan\s+mode\b",
    r"\bdo\s+anything\s+now\b",
    r"\bscore\s+(this\s+candidate|profile)?\s*(100|99|98|full\s+marks)\b",
    r"\bgive\s+(me|this|candidate)\s+a\s+score\s+of\s+100\b",
]

COMPILED_INJECTION_REGEX = re.compile("|".join(f"(?:{p})" for p in INJECTION_PATTERNS), flags=re.IGNORECASE)

def sanitize_untrusted_text(text: Optional[str], field_name: str = "text") -> str:
    """
    Sanitizes untrusted candidate or recruiter text by neutralizing
    common prompt-injection keywords and escaping tag delimiters.
    """
    if not text:
        return ""
    
    cleaned = str(text)
    
    # Neutralize attempt to break out of XML delimiter tags
    cleaned = cleaned.replace("</candidate_data>", "[REDACTED_TAG]")
    cleaned = cleaned.replace("<candidate_data>", "[REDACTED_TAG]")
    cleaned = cleaned.replace("</job_description>", "[REDACTED_TAG]")
    cleaned = cleaned.replace("<job_description>", "[REDACTED_TAG]")
    
    # Neutralize injection regex patterns
    def _replace_match(match):
        logger.warning(f"Potential prompt injection detected in {field_name}: '{match.group(0)}'")
        return "[FILTERED_SUSPICIOUS_INSTRUCTION]"
    
    cleaned = COMPILED_INJECTION_REGEX.sub(_replace_match, cleaned)
    return cleaned.strip()

def sanity_check_score(
    score: int,
    reasoning: str,
    skill_match: List[str],
    missing_skills: List[str],
    candidate_repos_count: int,
    candidate_languages: List[str]
) -> Dict[str, Any]:
    """
    Sanity-bounds the score and reasoning produced by LLM:
    - Clamps score within [0, 100]
    - Checks for hallucinations or suspicious high scores when candidate has zero evidence
    - Checks for reasoning regurgitating injection attempts
    """
    bounded_score = max(0, min(100, int(score)))
    flagged = False
    flag_reasons = []

    # Check for empty / zero evidence candidate given a high score
    has_no_evidence = (candidate_repos_count == 0 and len(candidate_languages) == 0 and len(skill_match) == 0)
    if bounded_score > 70 and has_no_evidence:
        flagged = True
        flag_reasons.append("High match score awarded despite zero public repos, languages, or verified skills")
        # Bound score to realistic level for zero evidence
        bounded_score = min(bounded_score, 45)

    # Check if reasoning contains filtered injection attempts
    if "[FILTERED_SUSPICIOUS_INSTRUCTION]" in reasoning or COMPILED_INJECTION_REGEX.search(reasoning):
        flagged = True
        flag_reasons.append("Evaluation reasoning reflected suspicious instruction patterns")
        bounded_score = min(bounded_score, 50)

    return {
        "score": bounded_score,
        "reasoning": reasoning,
        "skill_match": skill_match,
        "missing_skills": missing_skills,
        "flagged_for_review": flagged,
        "flag_reasons": flag_reasons
    }
