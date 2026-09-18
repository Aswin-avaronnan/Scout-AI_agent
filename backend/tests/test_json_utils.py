import pytest
from backend.tools.json_utils import extract_json_from_llm_response

def test_clean_json():
    raw = '{"score": 85, "reasoning": "Great fit", "skill_match": ["Python"]}'
    res = extract_json_from_llm_response(raw)
    assert res["score"] == 85
    assert res["skill_match"] == ["Python"]

def test_markdown_code_fences():
    raw = '''```json
    {
      "score": 90,
      "reasoning": "Strong match",
      "skill_match": ["TypeScript", "React"]
    }
    ```'''
    res = extract_json_from_llm_response(raw)
    assert res["score"] == 90
    assert "TypeScript" in res["skill_match"]

def test_json_with_preamble_and_postscript():
    raw = '''Here is the candidate assessment:
    {"score": 75, "reasoning": "Solid backend skills"}
    Hope this helps!'''
    res = extract_json_from_llm_response(raw)
    assert res["score"] == 75

def test_single_quotes_repair():
    raw = "{'score': 80, 'reasoning': 'Good experience', 'skill_match': ['Docker']}"
    res = extract_json_from_llm_response(raw)
    assert res["score"] == 80

def test_trailing_commas_repair():
    raw = '{"score": 70, "reasoning": "Acceptable", "skill_match": ["Go",],}'
    res = extract_json_from_llm_response(raw)
    assert res["score"] == 70

def test_truncated_json_repair():
    # Model output cut off mid-stream
    raw = '{"score": 88, "reasoning": "Excellent proficiency in distributed systems", "skill_match": ["Kafka", "Rust"'
    res = extract_json_from_llm_response(raw)
    assert res["score"] == 88
    assert "Kafka" in res["skill_match"]

def test_invalid_json_raises_value_error():
    with pytest.raises(ValueError) as exc:
        extract_json_from_llm_response("Sorry, I cannot evaluate this profile.")
    assert "Could not find JSON object" in str(exc.value)
