import json
import re
from typing import Dict, Any

def _repair_truncated_json(json_str: str) -> Dict[str, Any]:
    """
    Attempts to repair truncated JSON (e.g., cut off mid-string or missing closing braces/brackets).
    """
    s = json_str.strip()
    
    # 1. Check for unclosed string literal by counting unescaped quotes
    quote_count = 0
    i = 0
    while i < len(s):
        if s[i] == '"' and (i == 0 or s[i-1] != '\\'):
            quote_count += 1
        i += 1
        
    if quote_count % 2 != 0:
        s += '"'
        
    # 2. Strip any trailing comma, colon, or whitespace at the end
    s = re.sub(r"[,:\s]+$", "", s)

    # 3. Balance opening and closing braces/brackets
    open_braces = 0
    open_brackets = 0
    in_string = False
    
    for idx, ch in enumerate(s):
        if ch == '"' and (idx == 0 or s[idx-1] != '\\'):
            in_string = not in_string
        elif not in_string:
            if ch == '{':
                open_braces += 1
            elif ch == '}':
                open_braces = max(0, open_braces - 1)
            elif ch == '[':
                open_brackets += 1
            elif ch == ']':
                open_brackets = max(0, open_brackets - 1)
                
    s += ']' * open_brackets
    s += '}' * open_braces
    
    return json.loads(s)

def extract_json_from_llm_response(text: str) -> Dict[str, Any]:
    """
    Safely extracts and parses a JSON object from an LLM response string.
    Handles markdown code fences, leading/trailing prose, single quotes, trailing commas,
    and truncated outputs missing closing braces.
    """
    cleaned = text.strip()
    
    # 1. Strip markdown code fences if present
    if "```" in cleaned:
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\s*```$", "", cleaned)
        cleaned = cleaned.strip()

    # 2. Locate boundaries of the first opening '{'
    first_brace = cleaned.find('{')
    if first_brace == -1:
        snippet = text[:200].replace("\n", " ")
        raise ValueError(f"Could not find JSON object in LLM response. Model said: \"{snippet}\"")

    last_brace = cleaned.rfind('}')
    
    # If a valid closing brace exists after the opening brace, try normal extraction first
    if last_brace > first_brace:
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

    # 3. Fallback: Attempt truncated JSON repair from first brace to end of string
    try:
        truncated_str = cleaned[first_brace:]
        return _repair_truncated_json(truncated_str)
    except Exception:
        pass

    snippet = text[:200].replace("\n", " ")
    raise ValueError(f"Could not parse JSON object from LLM response. Content snippet: \"{snippet}\"")
