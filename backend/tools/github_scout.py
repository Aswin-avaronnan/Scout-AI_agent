import httpx
from typing import List, Dict, Any, Optional
from pydantic import BaseModel

class GitHubProfile(BaseModel):
    username: str
    name: Optional[str]
    bio: Optional[str]
    location: Optional[str]
    public_repos: int
    followers: int
    following: int
    html_url: str
    avatar_url: str

class GitHubRepo(BaseModel):
    name: str
    description: Optional[str]
    language: Optional[str]
    stargazers_count: int
    forks_count: int
    updated_at: str
    html_url: str

class GitHubCandidateData(BaseModel):
    profile: GitHubProfile
    repos: List[GitHubRepo]
    top_languages: List[str]

class GitHubScout:
    def __init__(self, token: Optional[str] = None):
        self.headers = {"Accept": "application/vnd.github.v3+json"}
        if token:
            self.headers["Authorization"] = f"token {token}"
        self.base_url = "https://api.github.com"

    async def get_candidate_data(self, username: str) -> GitHubCandidateData:
        async with httpx.AsyncClient(headers=self.headers) as client:
            # 1. Fetch profile
            profile_res = await client.get(f"{self.base_url}/users/{username}")
            profile_res.raise_for_status()
            profile_data = profile_res.json()
            profile = GitHubProfile(
                username=profile_data["login"],
                name=profile_data.get("name"),
                bio=profile_data.get("bio"),
                location=profile_data.get("location"),
                public_repos=profile_data["public_repos"],
                followers=profile_data["followers"],
                following=profile_data["following"],
                html_url=profile_data["html_url"],
                avatar_url=profile_data["avatar_url"]
            )

            # 2. Fetch repos (sorted by updated)
            repos_res = await client.get(
                f"{self.base_url}/users/{username}/repos",
                params={"sort": "updated", "per_page": 30}
            )
            repos_res.raise_for_status()
            repos_data = repos_res.json()
            repos = [
                GitHubRepo(
                    name=r["name"],
                    description=r.get("description"),
                    language=r.get("language"),
                    stargazers_count=r["stargazers_count"],
                    forks_count=r["forks_count"],
                    updated_at=r["updated_at"],
                    html_url=r["html_url"]
                ) for r in repos_data
            ]

            # 3. Aggregate languages
            lang_counts = {}
            for r in repos:
                if r.language:
                    lang_counts[r.language] = lang_counts.get(r.language, 0) + 1
            
            top_languages = sorted(lang_counts, key=lang_counts.get, reverse=True)[:5]

            return GitHubCandidateData(
                profile=profile,
                repos=repos,
                top_languages=top_languages
            )
