import pymupdf
import pymupdf4llm
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import json
import re
import csv
import io
from backend.llm.client import LLMClient

class ExtractedResumeProfile(BaseModel):
    name: str = Field(..., description="Full name of the candidate")
    email: Optional[str] = Field(None, description="Email address")
    github_url: Optional[str] = Field(None, description="GitHub profile URL if present")
    bio: Optional[str] = Field(None, description="A 1-2 sentence professional bio or summary of experience")
    skills: List[str] = Field(default_factory=list, description="List of technical skills and tools mentioned")
    experience_years: Optional[int] = Field(None, description="Estimated years of professional experience")

def pdf_to_markdown(pdf_bytes: bytes) -> str:
    """
    Converts PDF bytes to a structured Markdown string using pymupdf4llm.
    Throws a ValueError if conversion yields insufficient text (e.g. scanned image).
    """
    try:
        doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
        md_text = pymupdf4llm.to_markdown(doc)
        
        # Guard against scanned PDFs (image-only)
        if len(md_text.strip()) < 100:
            raise ValueError(
                "This PDF appears to be a scanned image or has unreadable text. "
                "Please upload a text-based PDF or paste the content manually."
            )
        return md_text
    except Exception as e:
        if isinstance(e, ValueError):
            raise e
        raise ValueError(f"Failed to extract text from PDF: {str(e)}")

async def parse_resume_md(llm: LLMClient, md_text: str) -> ExtractedResumeProfile:
    """
    Parses a Markdown-formatted resume to extract structured profile information.
    """
    system_prompt = (
        "You are an expert technical recruiting agent. Extract structured profile data "
        "from the candidate's resume markdown content. Respond ONLY with a valid JSON "
        "object matching the requested schema."
    )
    
    user_prompt = (
        f"Resume Markdown:\n{md_text}\n\n"
        "Return JSON with keys: name, email, github_url, bio, skills, experience_years."
    )
    
    response_text = await llm.complete(
        messages=[{"role": "user", "content": user_prompt}],
        system=system_prompt,
        max_tokens=1000,
        temperature=0.1
    )
    
    # Extract JSON via regex
    match = re.search(r"(\{.*\})", response_text, re.DOTALL)
    if not match:
        raise ValueError("Could not find JSON object in LLM response")
    
    clean_json = match.group(1)
    data = json.loads(clean_json)
    return ExtractedResumeProfile(**data)

def parse_candidates_csv(csv_bytes: bytes) -> List[Dict[str, str]]:
    """
    Parses a CSV candidate sheet. Returns a list of candidate details.
    Required columns: username (or github_username / github_url).
    """
    text = csv_bytes.decode("utf-8-sig") # handles UTF-8 BOM
    reader = csv.DictReader(io.StringIO(text))
    
    candidates = []
    for row in reader:
        # Check standard column headers
        username = row.get("username") or row.get("github_username") or row.get("GitHub Username")
        github_url = row.get("github_url") or row.get("GitHub URL")
        name = row.get("name") or row.get("Name") or row.get("Full Name")
        
        # Extract username from github url if needed
        if not username and github_url:
            # Matches github.com/username
            url_match = re.search(r"github\.com/([^/]+)", github_url)
            if url_match:
                username = url_match.group(1)
        
        if username:
            candidates.append({
                "username": username.strip(),
                "name": name.strip() if name else username.strip(),
                "github_url": github_url.strip() if github_url else f"https://github.com/{username.strip()}"
            })
            
    if not candidates:
        raise ValueError("No candidates found in CSV. Ensure you have a 'username' or 'github_url' column.")
    return candidates

def parse_candidates_json(json_bytes: bytes) -> List[Dict[str, str]]:
    """
    Parses a JSON candidate sheet. Can be a list of candidate objects.
    """
    try:
        data = json.loads(json_bytes.decode("utf-8"))
        if not isinstance(data, list):
            # If it's a dictionary wrapping a list
            if isinstance(data, dict) and "candidates" in data:
                data = data["candidates"]
            else:
                raise ValueError("JSON must be an array of candidate objects or contain a 'candidates' list key.")
        
        candidates = []
        for idx, item in enumerate(data):
            username = item.get("username") or item.get("github_username")
            github_url = item.get("github_url")
            name = item.get("name")
            
            if not username and github_url:
                url_match = re.search(r"github\.com/([^/]+)", github_url)
                if url_match:
                    username = url_match.group(1)
            
            if username:
                candidates.append({
                    "username": username.strip(),
                    "name": name.strip() if name else username.strip(),
                    "github_url": github_url.strip() if github_url else f"https://github.com/{username.strip()}"
                })
        
        if not candidates:
            raise ValueError("No valid candidates found in JSON. Ensure candidate objects have a 'username' or 'github_url' key.")
        return candidates
    except Exception as e:
        if isinstance(e, ValueError):
            raise e
        raise ValueError(f"Failed to parse JSON candidate list: {str(e)}")
