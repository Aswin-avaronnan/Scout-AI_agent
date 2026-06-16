'use client';

import React, { useState } from 'react';
import { fetchBackend } from '../lib/api';
import { useRouter } from 'next/navigation';
import { usePipelineStore } from '../store/pipeline';

export function JDInput() {
  const [jdText, setJdText] = useState('');
  const [usernames, setUsernames] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const setPipelineData = usePipelineStore((state) => state.setPipelineData);
  const { provider, model } = useSessionStore();

  const handleScout = async () => {
    if (!jdText || !usernames) return;
    setLoading(true);
    
    try {
      const usernameList = usernames.split(',').map(u => u.trim()).filter(u => u);
      const data = await fetchBackend('/scout', {
        method: 'POST',
        body: JSON.stringify({
          jd_text: jdText,
          github_usernames: usernameList,
          provider: provider,
          model: model,
        }),
      });
      
      setPipelineData(data); 
      router.push('/pipeline');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Scouting failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl space-y-8">
      <div className="space-y-2">
        <label className="text-xs font-bold text-zinc-500 uppercase">Job Description</label>
        <textarea
          value={jdText}
          onChange={(e) => setJdText(e.target.value)}
          placeholder="Paste the full job description here..."
          className="w-full h-64 bg-zinc-900 border border-zinc-800 rounded-lg p-4 text-zinc-200 outline-none focus:ring-1 focus:ring-zinc-700 resize-none"
        />
      </div>

      <div className="space-y-2">
        <label className="text-xs font-bold text-zinc-500 uppercase">GitHub Usernames (comma separated)</label>
        <input
          type="text"
          value={usernames}
          onChange={(e) => setUsernames(e.target.value)}
          placeholder="aswin-avaronnan, torvalds, gaearon..."
          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-4 text-zinc-200 outline-none focus:ring-1 focus:ring-zinc-700"
        />
      </div>

      <button
        onClick={handleScout}
        disabled={loading || !jdText || !usernames}
        className="w-full py-4 bg-white text-black font-bold rounded-lg hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-zinc-600 transition-all"
      >
        {loading ? 'Scouting Candidates...' : 'Run Scouting Pipeline'}
      </button>
    </div>
  );
}
