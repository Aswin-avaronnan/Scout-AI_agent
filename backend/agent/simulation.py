from typing import AsyncGenerator, Dict, Any, List, Optional
import json
import re
from backend.llm.client import LLMClient
from backend.tools.jd_parser import ParsedJD
from backend.tools.github_scout import GitHubCandidateData

async def simulate_interview(
    llm: LLMClient,
    jd: ParsedJD,
    candidate: GitHubCandidateData,
    num_turns: int = 3
) -> AsyncGenerator[Dict[str, Any], None]:
    """
    Simulates an interview between LLM-A (Interviewer) and LLM-B (Candidate Persona)
    and yields SSE events for each dialogue turn, followed by a final evaluation.
    """
    job_title = jd.job_title
    jd_summary = jd.summary
    skills = ", ".join(jd.skills_required)
    
    candidate_name = candidate.profile.name or candidate.profile.username
    profile_bio = candidate.profile.bio or "No bio provided."
    top_languages = ", ".join(candidate.top_languages)
    
    # Construct a concise repositories summary for the candidate persona
    repos_list = []
    for r in candidate.repos[:10]:  # Use top 10 repos
        desc = f" ({r.description})" if r.description else ""
        lang = f" in {r.language}" if r.language else ""
        repos_list.append(f"- {r.name}{lang}{desc}")
    repos_summary = "\n".join(repos_list) if repos_list else "No public repositories."

    # 1. System Prompt for Interviewer (LLM-A)
    system_prompt_a = (
        f"You are a senior technical interviewer for the position of '{job_title}'.\n"
        f"Job Description: {jd_summary}\n"
        f"Required Skills: {skills}\n\n"
        f"Your goal is to conduct a professional technical interview. "
        f"Ask exactly one targeted, specific, and direct technical question at a time.\n"
        f"Keep questions concise. Do not give hints, do not say 'Great job' or validate their answer directly. "
        f"Dig deeper into their responses or test their understanding of the required skills.\n"
        f"Be strict but professional."
    )

    # 2. System Prompt for Candidate Persona (LLM-B)
    system_prompt_b = (
        f"You are role-playing as {candidate_name}, a candidate interviewing for the role of '{job_title}'.\n"
        f"Your background:\n"
        f"- Bio: {profile_bio}\n"
        f"- Top Languages: {top_languages}\n"
        f"Your GitHub Repositories:\n{repos_summary}\n\n"
        f"Answer the interviewer's questions naturally, honestly, and strictly in character based on your background.\n"
        f"If the interviewer asks about a framework or skill you do not know or have not used in your repositories, be honest and say so.\n"
        f"Keep your answers concise, practical, and to the point (2-4 sentences). Do not over-perform or hallucinate expertise."
    )

    # Message history storage
    # history_a: Assistant=Interviewer, User=Candidate
    # history_b: User=Interviewer, Assistant=Candidate
    history_a: List[Dict[str, str]] = [
        {"role": "user", "content": "Begin the interview by welcoming the candidate and asking the first technical question."}
    ]
    history_b: List[Dict[str, str]] = []

    for turn in range(num_turns):
        # --- Interviewer Turn ---
        messages = list(history_a)

        question = await llm.complete(
            messages=messages,
            system=system_prompt_a,
            max_tokens=400,
            temperature=0.7
        )
        
        question = question.strip()
        
        # Record Interviewer's output
        history_a.append({"role": "assistant", "content": question})
        history_b.append({"role": "user", "content": question})

        yield {
            "type": "turn",
            "data": {
                "turn_index": turn,
                "speaker": "interviewer",
                "text": question
            }
        }

        # --- Candidate Turn ---
        answer = await llm.complete(
            messages=list(history_b),
            system=system_prompt_b,
            max_tokens=400,
            temperature=0.6
        )
        
        answer = answer.strip()
        
        # Record Candidate's output
        history_a.append({"role": "user", "content": answer})
        history_b.append({"role": "assistant", "content": answer})

        yield {
            "type": "turn",
            "data": {
                "turn_index": turn,
                "speaker": "candidate",
                "text": answer
            }
        }

    # --- Evaluation ---
    eval_prompt = (
        "The interview is complete. Evaluate this candidate based on their answers and background. "
        "Calculate a technical depth score (0-100) and a communication score (0-100).\n"
        "Respond with ONLY a valid JSON object and nothing else — no markdown code fences, "
        "no preamble, no explanation outside the JSON.\n"
        "Respond with exactly this JSON shape, filled in with your real assessment "
        "(this is an example only, not real values):\n"
        '{"technical_depth": 68, "communication": 74, '
        '"red_flags": ["Struggled to explain trade-offs in the caching question"], '
        '"hire_recommendation": "Hire"}\n'
        '"hire_recommendation" must be exactly one of: "Strong Hire", "Hire", "No Hire", "Strong No Hire".'
    )
    
    # Combine the eval prompt with the last user message to keep the alternating role sequence
    eval_messages = list(history_a)
    if eval_messages and eval_messages[-1]["role"] == "user":
        last_msg = eval_messages[-1]
        eval_messages[-1] = {
            "role": "user",
            "content": f"{last_msg['content']}\n\n[Evaluation Instruction: {eval_prompt}]"
        }
    else:
        eval_messages.append({"role": "user", "content": eval_prompt})

    eval_response = await llm.complete(
        messages=eval_messages,
        system=system_prompt_a,
        max_tokens=600,
        temperature=0.2
    )

    try:
        cleaned = eval_response.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", cleaned, flags=re.MULTILINE).strip()

        match = re.search(r"(\{.*\})", cleaned, re.DOTALL)
        if not match:
            raise ValueError("No JSON object found in response")

        clean_json = match.group(1)
        try:
            eval_data = json.loads(clean_json)
        except json.JSONDecodeError:
            eval_data = json.loads(clean_json.replace("'", '"'))
    except Exception as e:
        eval_data = {
            "technical_depth": 50,
            "communication": 50,
            "red_flags": [f"Failed to parse AI evaluation JSON format: {str(e)}"],
            "hire_recommendation": "No Hire"
        }

    # Add simulation_score as average
    eval_data["simulation_score"] = int((eval_data.get("technical_depth", 50) + eval_data.get("communication", 50)) / 2)

    yield {
        "type": "eval",
        "data": eval_data
    }
