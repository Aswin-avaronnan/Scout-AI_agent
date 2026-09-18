import pytest
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient
from backend.main import app
from backend.tools.github_scout import GitHubCandidateData, GitHubProfile, GitHubRepo

client = TestClient(app)

def test_health_check_and_security_headers():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["version"] == "2.0.0"
    
    # Verify Phase 0.2 security headers
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"
    assert response.headers["Referrer-Policy"] == "strict-origin-when-cross-origin"

@patch("backend.api.routes.scout.get_client")
@patch("backend.api.routes.scout.GitHubScout")
def test_scout_error_isolation(mock_gh_class, mock_get_client):
    """
    Asserts the full per-candidate error-isolation behavior:
    If one candidate lookup fails (e.g. 404 Not Found), the batch still returns
    with the valid candidate scored and the failing candidate tagged with 'error'.
    """
    # 1. Mock LLM client
    mock_llm = AsyncMock()
    # JD parse response
    jd_json = '{"job_title": "Backend Dev", "skills_required": ["Python"], "experience_years": 3, "summary": "Backend", "domain": "Tech"}'
    # Scorer response
    score_json = '{"score": 82, "reasoning": "Strong match on Python", "skill_match": ["Python"], "missing_skills": []}'
    mock_llm.complete.side_effect = [jd_json, score_json]
    mock_get_client.return_value = mock_llm

    # 2. Mock GitHub scout
    mock_gh_instance = AsyncMock()
    valid_candidate = GitHubCandidateData(
        profile=GitHubProfile(
            username="valid-user",
            name="Valid Dev",
            bio="Python developer",
            location="Remote",
            public_repos=12,
            followers=10,
            following=5,
            html_url="https://github.com/valid-user",
            avatar_url="https://avatars.githubusercontent.com/u/1"
        ),
        repos=[GitHubRepo(
            name="cool-python-repo",
            description="A repo",
            language="Python",
            stargazers_count=5,
            forks_count=1,
            updated_at="2026-01-01",
            html_url="https://github.com/valid-user/cool-python-repo"
        )],
        top_languages=["Python"]
    )

    async def mock_get_candidate(username):
        if username == "valid-user":
            return valid_candidate
        raise ValueError("GitHub user not found: 404")

    mock_gh_instance.get_candidate_data.side_effect = mock_get_candidate
    mock_gh_class.return_value = mock_gh_instance

    response = client.post(
        "/scout",
        json={
            "jd_text": "We are seeking a Python developer with experience in building web APIs.",
            "github_usernames": ["valid-user", "nonexistent-user-404"],
            "provider": "openai"
        },
        headers={
            "X-User-Api-Key": "sk-test-key-mock"
        }
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["job"]["job_title"] == "Backend Dev"
    candidates = payload["candidates"]
    assert len(candidates) == 2

    # Verify first candidate succeeded
    c1 = next(c for c in candidates if c["username"] == "valid-user")
    assert c1["match_score"] == 82
    assert "error" not in c1

    # Verify second candidate failed gracefully without breaking batch
    c2 = next(c for c in candidates if c["username"] == "nonexistent-user-404")
    assert "error" in c2
    assert "404" in c2["error"]
