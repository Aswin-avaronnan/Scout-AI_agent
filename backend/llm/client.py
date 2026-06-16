import abc
from typing import List, Dict, Any, Optional
import httpx
from openai import AsyncOpenAI
from anthropic import AsyncAnthropic
import google.generativeai as genai

class LLMClient(abc.ABC):
    @abc.abstractmethod
    async def complete(
        self, 
        messages: List[Dict[str, str]], 
        system: Optional[str] = None, 
        max_tokens: int = 1000,
        temperature: float = 0.7
    ) -> str:
        pass

class OpenAICompatibleClient(LLMClient):
    def __init__(self, api_key: str, base_url: Optional[str] = None, model: str = "gpt-4o-mini"):
        self.client = AsyncOpenAI(api_key=api_key, base_url=base_url)
        self.model = model

    async def complete(self, messages, system=None, max_tokens=1000, temperature=0.7):
        payload = [{"role": "system", "content": system}] if system else []
        payload.extend(messages)
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=payload,
            max_tokens=max_tokens,
            temperature=temperature
        )
        return response.choices[0].message.content

class AnthropicClient(LLMClient):
    def __init__(self, api_key: str, model: str = "claude-3-haiku-20240307"):
        self.client = AsyncAnthropic(api_key=api_key)
        self.model = model

    async def complete(self, messages, system=None, max_tokens=1000, temperature=0.7):
        response = await self.client.messages.create(
            model=self.model,
            system=system if system else "",
            messages=messages,
            max_tokens=max_tokens,
            temperature=temperature
        )
        return response.content[0].text

class GeminiClient(LLMClient):
    def __init__(self, api_key: str, model: str = "gemini-1.5-flash"):
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel(model)

    async def complete(self, messages, system=None, max_tokens=1000, temperature=0.7):
        # Gemini expects different format, simple map for now
        history = []
        for m in messages[:-1]:
            role = "user" if m["role"] == "user" else "model"
            history.append({"role": role, "parts": [m["content"]]})
        
        chat = self.model.start_chat(history=history)
        last_msg = messages[-1]["content"]
        
        config = genai.types.GenerationConfig(
            max_output_tokens=max_tokens,
            temperature=temperature
        )
        
        # System instruction handled at model init usually, 
        # but for per-call flexibility we can prepend to prompt if needed
        prompt = f"System: {system}\n\n{last_msg}" if system else last_msg
        
        response = await chat.send_message_async(prompt, generation_config=config)
        return response.text

def get_client(provider: str, api_key: str, model: Optional[str] = None) -> LLMClient:
    if provider == "openai":
        return OpenAICompatibleClient(api_key, model=model or "gpt-4o-mini")
    elif provider == "groq":
        return OpenAICompatibleClient(api_key, base_url="https://api.groq.com/openai/v1", model=model or "llama3-8b-8192")
    elif provider == "openrouter":
        return OpenAICompatibleClient(api_key, base_url="https://openrouter.ai/api/v1", model=model or "google/gemini-flash-1.5")
    elif provider == "anthropic":
        return AnthropicClient(api_key, model=model or "claude-3-haiku-20240307")
    elif provider == "google":
        return GeminiClient(api_key, model=model or "gemini-1.5-flash")
    else:
        raise ValueError(f"Unknown provider: {provider}")
