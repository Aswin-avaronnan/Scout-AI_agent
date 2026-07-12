'use client';

import React from 'react';
import { usePipelineStore } from '../../store/pipeline';
import { useSessionStore } from '../../store/session';
import { KeyVault } from '../../components/KeyVault';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Sliders, Shield, Download, Trash2, CheckCircle2 } from 'lucide-react';

export default function SettingsPage() {
  const router = useRouter();
  const { matchWeight, simWeight, setWeights, clearPipeline, candidates, job } = usePipelineStore();
  const { clearSession } = useSessionStore();
  const [saveSuccess, setSaveSuccess] = React.useState(false);

  const handleMatchWeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const matchVal = parseInt(e.target.value, 10);
    setWeights(matchVal, 100 - matchVal);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleExport = () => {
    const dataStr = JSON.stringify({
      export_version: "1.0",
      exported_at: new Date().toISOString(),
      session: {
        jd: job,
        candidates: candidates,
        settings: {
          match_weight: matchWeight,
          sim_weight: simWeight
        }
      }
    }, null, 2);
    
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `catalyst-scout-session-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    if (confirm("Are you sure you want to clear your active session? This will wipe your current job and candidate list.")) {
      clearPipeline();
      router.push('/');
    }
  };

  return (
    <div className="min-h-screen bg-black text-zinc-200 pb-16">
      {/* Header */}
      <header className="border-b border-zinc-900 bg-zinc-950/50 backdrop-blur-md sticky top-0 z-10 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link 
            href="/pipeline" 
            className="p-2 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 transition-all"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-sm font-bold text-zinc-200">Settings</h1>
            <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-widest">
              Configure system parameters and keys
            </p>
          </div>
        </div>
      </header>

      {/* Main Content Containers */}
      <main className="max-w-4xl mx-auto px-8 pt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Left Column - Scoring Weights & Session Actions */}
        <div className="space-y-6">
          {/* Sliders Card */}
          <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-6 space-y-6">
            <h3 className="text-xs font-black uppercase text-zinc-500 tracking-wider flex items-center gap-2">
              <Sliders size={14} /> Scoring Weights
            </h3>
            
            <div className="space-y-4">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-zinc-400">Match Weight: {matchWeight}%</span>
                <span className="text-zinc-400">Simulation Weight: {simWeight}%</span>
              </div>
              
              <input
                type="range"
                min="0"
                max="100"
                value={matchWeight}
                onChange={handleMatchWeightChange}
                className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-white"
              />
              
              <p className="text-[10px] text-zinc-500 leading-relaxed leading-normal">
                Adjusts the 60/40 formula dynamically. Candidates' final rank score updates instantly across the Kanban board and candidate profile detail cards.
              </p>
            </div>

            {saveSuccess && (
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400">
                <CheckCircle2 size={12} /> Combined ranks updated
              </div>
            )}
          </div>

          {/* Session Utilities Card */}
          <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-6 space-y-6">
            <h3 className="text-xs font-black uppercase text-zinc-500 tracking-wider">Session Utilities</h3>
            
            <div className="space-y-3">
              <button
                onClick={handleExport}
                disabled={!job && candidates.length === 0}
                className="w-full py-2.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download size={14} /> Export Active Session JSON
              </button>
              
              <button
                onClick={handleReset}
                className="w-full py-2.5 bg-red-950/20 border border-red-900/30 hover:bg-red-950/40 text-red-400 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2"
              >
                <Trash2 size={14} /> Reset Current Session
              </button>
            </div>
          </div>
        </div>

        {/* Right Column - Keys */}
        <div className="space-y-6">
          <KeyVault />
        </div>
      </main>
    </div>
  );
}
