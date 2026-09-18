import abc
import asyncio
import logging
from typing import List, Dict, Any, Optional
import httpx
from openai import AsyncOpenAI
from anthropic import AsyncAnthropic
import google.generativeai as genai

logger = logging.getLogger(__name__)

async def _call_with_retry(func, max_retries: int = 3, initial_delay: float = 2.0):
    delay = initial_delay
    for attempt in range(max_retries + 1):
        try:
            return await func()
        except Exception as e:
            err_str = str(e).lower()
            is_rate_limit = any(k in err_str for k in ("429", "quota", "rate limit", "resource_exhausted", "exceeded your current quota", "too many requests"))
            if is_rate_limit and attempt < max_retries:
                logger.warning(f"LLM API rate limit / quota hit (attempt {attempt + 1}/{max_retries + 1}). Retrying in {delay}s...")
                await asyncio.sleep(delay)
                delay *= 2.0
            else:
                raise e

class LLMClient(abc.ABC):
    @abc.abstractmethod
    async def complete(
        self, 
        messages: List[Dict[str, str]], 
        system: Optional[str] = None, 
        max_tokens: int = 2000,
        temperature: float = 0.7
    ) -> str:
        pass

class OpenAICompatibleClient(LLMClient):
    def __init__(self, api_key: str, base_url: Optional[str] = None, model: str = "gpt-4o-mini"):
        self.client = AsyncOpenAI(api_key=api_key, base_url=base_url, timeout=30.0, max_retries=0)
        self.model = model

    async def complete(self, messages, system=None, max_tokens=2000, temperature=0.7):
        async def _do_call():
            payload = [{"role": "system", "content": system}] if system else []
            payload.extend(messages)
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=payload,
                max_tokens=max_tokens,
                temperature=temperature
            )
            return response.choices[0].message.content
        return await _call_with_retry(_do_call)

class AnthropicClient(LLMClient):
    def __init__(self, api_key: str, model: str = "claude-3-haiku-20240307"):
        self.client = AsyncAnthropic(api_key=api_key, timeout=30.0, max_retries=0)
        self.model = model

    async def complete(self, messages, system=None, max_tokens=2000, temperature=0.7):
        async def _do_call():
            response = await self.client.messages.create(
                model=self.model,
                system=system if system else "",
                messages=messages,
                max_tokens=max_tokens,
                temperature=temperature
            )
            return response.content[0].text
        return await _call_with_retry(_do_call)

class GeminiClient(LLMClient):
    def __init__(self, api_key: str, model: str = "gemini-1.5-flash"):
        genai.configure(api_key=api_key)
        self.model_name = model

    async def complete(self, messages, system=None, max_tokens=2000, temperature=0.7):
        async def _do_call():
            history = []
            for m in messages[:-1]:
                role = "user" if m["role"] == "user" else "model"
                history.append({"role": role, "parts": [m["content"]]})

            model = genai.GenerativeModel(self.model_name, system_instruction=system)
            chat = model.start_chat(history=history)
            last_msg = messages[-1]["content"]

            config = genai.types.GenerationConfig(
                max_output_tokens=max_tokens,
                temperature=temperature
            )

            response = await asyncio.wait_for(
                chat.send_message_async(last_msg, generation_config=config),
                timeout=30.0
            )
            return response.text
        return await _call_with_retry(_do_call)

def get_client(provider: str, api_key: str, model: Optional[str] = None) -> LLMClient:
    if provider == "openai":
        return OpenAICompatibleClient(api_key, model=model or "gpt-4o-mini")
    elif provider == "groq":
        return OpenAICompatibleClient(api_key, base_url="https://api.groq.com/openai/v1", model=model or "llama-3.3-70b-versatile")
    elif provider == "openrouter":
        return OpenAICompatibleClient(api_key, base_url="https://openrouter.ai/api/v1", model=model or "google/gemini-flash-1.5")
    elif provider == "anthropic":
        return AnthropicClient(api_key, model=model or "claude-3-haiku-20240307")
    elif provider == "google":
        return GeminiClient(api_key, model=model or "gemini-1.5-flash")
    else:
        raise ValueError(f"Unknown provider: {provider}")
