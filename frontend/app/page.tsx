'use client';

import React from 'react';
import { KeyVault } from '../components/KeyVault';
import Link from 'next/link';
import { useSessionStore } from '../store/session';

export default function OnboardingPage() {
  const { apiKey } = useSessionStore();

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-200 flex flex-col items-center justify-center p-4">
      <div className="max-w-2xl w-full text-center mb-12">
        <h1 className="text-4xl font-extrabold tracking-tight text-white mb-4">
          Catalyst Scout <span className="text-zinc-500 text-2xl font-normal">v2</span>
        </h1>
        <p className="text-zinc-400 text-lg">
          AI-powered technical recruiting agent. Scout from GitHub, score with LLMs, and run interview simulations.
        </p>
      </div>

      <KeyVault />

      <div className="mt-12 text-center">
        <Link 
          href="/scout"
          className={`px-8 py-3 rounded-md font-bold transition-all ${
            apiKey 
              ? 'bg-white text-black hover:bg-zinc-200' 
              : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
          }`}
          onClick={(e) => !apiKey && e.preventDefault()}
        >
          {apiKey ? 'Start Scouting' : 'Enter API Key to Start'}
        </Link>
        {!apiKey && (
          <p className="text-xs text-zinc-600 mt-4 italic">
            Your key is required to perform LLM analysis and scoring.
          </p>
        )}
      </div>
    </main>
  );
}
