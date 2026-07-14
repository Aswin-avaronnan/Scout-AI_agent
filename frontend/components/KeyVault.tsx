'use client';

import React from 'react';
import { useSessionStore } from '../store/session';

const PROVIDERS = [
  { id: 'openai', name: 'OpenAI', defaultModel: 'gpt-4o-mini' },
  { id: 'anthropic', name: 'Anthropic', defaultModel: 'claude-3-haiku-20240307' },
  { id: 'google', name: 'Google Gemini', defaultModel: 'gemini-1.5-flash' },
  { id: 'groq', name: 'Groq', defaultModel: 'llama-3.3-70b-versatile' },
  { id: 'openrouter', name: 'OpenRouter', defaultModel: 'google/gemini-flash-1.5' },
];

export function KeyVault() {
  const { provider, apiKey, githubToken, model, setProvider, setApiKey, setGithubToken, setModel } = useSessionStore();

  return (
    <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-lg max-w-md mx-auto">
      <h2 className="text-xl font-bold mb-4 text-zinc-100">Key Vault</h2>
      <p className="text-sm text-zinc-400 mb-6">Keys stay in your browser. Never saved to server.</p>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-zinc-500 uppercase mb-1">Provider</label>
          <select
            value={provider}
            onChange={(e) => {
              const p = PROVIDERS.find(p => p.id === e.target.value);
              setProvider(e.target.value);
              if (p) setModel(p.defaultModel);
            }}
            className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 rounded px-3 py-2 outline-none focus:ring-1 focus:ring-zinc-600"
          >
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-500 uppercase mb-1">Model</label>
          <input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 rounded px-3 py-2 outline-none focus:ring-1 focus:ring-zinc-600"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-500 uppercase mb-1">{provider.toUpperCase()} API Key</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
            className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 rounded px-3 py-2 outline-none focus:ring-1 focus:ring-zinc-600"
          />
        </div>

        <div className="pt-4 border-t border-zinc-800">
          <label className="block text-xs font-medium text-zinc-500 uppercase mb-1">GitHub PAT (Optional)</label>
          <input
            type="password"
            value={githubToken}
            onChange={(e) => setGithubToken(e.target.value)}
            placeholder="ghp_..."
            className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 rounded px-3 py-2 outline-none focus:ring-1 focus:ring-zinc-600"
          />
          <p className="text-[10px] text-zinc-500 mt-1">Increases GitHub rate limit from 60 to 5000 req/hr.</p>
        </div>
      </div>
    </div>
  );
}
