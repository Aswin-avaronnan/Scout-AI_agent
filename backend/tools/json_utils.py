import json
import re
from typing import Dict, Any

def extract_json_from_llm_response(text: str) -> Dict[str, Any]:
    """
    Safely extracts and parses a JSON object from an LLM response string.
    Handles markdown code fences, leading/trailing prose, single quotes, and trailing commas.
    """
    cleaned = text.strip()
    
    # 1. Strip markdown code fences if present
    if "```" in cleaned:
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\s*```$", "", cleaned)
        cleaned = cleaned.strip()

    # 2. Locate boundaries of the first opening '{' and last closing '}'
    first_brace = cleaned.find('{')
    last_brace = cleaned.rfind('}')
    
    if first_brace == -1 or last_brace == -1 or last_brace < first_brace:
        snippet = text[:200].replace("\n", " ")
        raise ValueError(f"Could not find JSON object in LLM response. Model said: \"{snippet}\"")
        
    json_str = cleaned[first_brace:last_brace + 1]
    
    # Attempt 1: Direct JSON parse
    try:
        return json.loads(json_str)
    except json.JSONDecodeError:
        pass
        
    # Attempt 2: Replace single quotes with double quotes
    try:
        repaired = json_str.replace("'", '"')
        return json.loads(repaired)
    except json.JSONDecodeError:
        pass

    # Attempt 3: Strip trailing commas before closing braces or brackets
    try:
        repaired = re.sub(r",\s*([\}\]])", r"\1", json_str)
        return json.loads(repaired)
    except json.JSONDecodeError:
        pass

    snippet = json_str[:200].replace("\n", " ")
    raise ValueError(f"Could not parse JSON object from LLM response. Content snippet: \"{snippet}\"")
