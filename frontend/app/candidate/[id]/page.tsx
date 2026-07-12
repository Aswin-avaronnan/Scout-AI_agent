'use client';

import React, { useState } from 'react';
import { usePipelineStore } from '../../../store/pipeline';
import { useSessionStore } from '../../../store/session';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, Github, MapPin, Users, Star, 
  CheckCircle2, XCircle, Play, AlertTriangle, 
  HelpCircle, Sparkles, Award, ShieldAlert
} from 'lucide-react';

export default function CandidateDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { candidates, job, matchWeight, simWeight } = usePipelineStore();
  const { provider, model } = useSessionStore();
  const [showConfirm, setShowConfirm] = useState(false);

  const candidate = candidates.find(c => c.id === decodeURIComponent(params.id));

  if (!candidate) {
    return (
      <div className="min-h-screen bg-black text-zinc-200 flex flex-col items-center justify-center">
        <h1 className="text-xl font-bold mb-4">Candidate Not Found</h1>
        <Link href="/pipeline" className="text-sm text-zinc-400 hover:text-white underline">
          Back to Pipeline
        </Link>
      </div>
    );
  }

  const isSimulated = candidate.simulation_status === 'completed' && candidate.simulation_eval;

  // Cost estimates based on provider
  const getCostEstimate = () => {
    if (provider === 'groq') return 'Free (Groq free tier)';
    if (provider === 'openai') return '~$0.01 (GPT-4o-mini)';
    if (provider === 'anthropic') return '~$0.003 (Claude Haiku)';
    return 'Minimal (Standard API rates)';
  };

  const triggerSimulation = () => {
    // Route to simulate page with the candidate ID
    router.push(`/simulate?id=${encodeURIComponent(candidate.id)}`);
  };

  return (
    <div className="min-h-screen bg-black text-zinc-200 pb-16">
      {/* Sticky Top Nav */}
      <header className="border-b border-zinc-900 bg-zinc-950/50 backdrop-blur-md sticky top-0 z-10 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link 
            href="/pipeline" 
            className="p-2 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 transition-all"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-sm font-bold text-zinc-200">Candidate Profile</h1>
            <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-widest">
              {candidate.profile.name || candidate.username}
            </p>
          </div>
        </div>
        <div className="text-xs text-zinc-500 bg-zinc-900/50 px-3 py-1 rounded border border-zinc-800/80">
          Target Job: <span className="text-white font-bold">{job?.job_title}</span>
        </div>
      </header>

      {/* Main Grid Layout */}
      <main className="max-w-6xl mx-auto px-8 pt-8 grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Left Column - Profile Summary & Controls */}
        <div className="space-y-6">
          <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-6 space-y-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-24 h-24 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden">
                {candidate.profile.avatar_url ? (
                  <img src={candidate.profile.avatar_url} alt={candidate.username} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-600 text-3xl font-black">
                    {candidate.username[0].toUpperCase()}
                  </div>
                )}
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">
                  {candidate.profile.name || candidate.username}
                </h2>
                <div className="flex items-center justify-center gap-1.5 text-xs text-zinc-500 font-mono mt-1">
                  <Github size={12} />
                  <a href={candidate.profile.html_url} target="_blank" rel="noreferrer" className="hover:underline hover:text-zinc-300 flex items-center gap-0.5">
                    {candidate.username}
                  </a>
                </div>
              </div>
            </div>

            {candidate.profile.bio && (
              <p className="text-xs text-zinc-400 text-center leading-relaxed italic">
                "{candidate.profile.bio}"
              </p>
            )}

            <div className="border-t border-zinc-900 pt-4 grid grid-cols-3 gap-2 text-center text-xs font-mono">
              <div className="bg-zinc-900/40 p-2 rounded border border-zinc-900/80">
                <span className="block text-white font-bold">{candidate.profile.public_repos}</span>
                <span className="text-[9px] text-zinc-600 uppercase font-bold">Repos</span>
              </div>
              <div className="bg-zinc-900/40 p-2 rounded border border-zinc-900/80">
                <span className="block text-white font-bold">{candidate.profile.followers}</span>
                <span className="text-[9px] text-zinc-600 uppercase font-bold">Followers</span>
              </div>
              <div className="bg-zinc-900/40 p-2 rounded border border-zinc-900/80">
                <span className="block text-white font-bold">{candidate.profile.following}</span>
                <span className="text-[9px] text-zinc-600 uppercase font-bold">Following</span>
              </div>
            </div>

            {candidate.profile.location && (
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <MapPin size={14} className="text-zinc-600" />
                <span>{candidate.profile.location}</span>
              </div>
            )}
          </div>

          {/* Action Panel */}
          <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-6 space-y-4">
            <h3 className="text-xs font-black uppercase text-zinc-500 tracking-wider">Simulation Controls</h3>
            
            {candidate.simulation_status === 'completed' ? (
              <div className="space-y-3">
                <div className="bg-emerald-950/20 border border-emerald-900/50 rounded-lg p-3 text-xs text-emerald-400">
                  Interview simulation successfully run and scored!
                </div>
                <button
                  onClick={() => setShowConfirm(true)}
                  className="w-full py-3 bg-zinc-900 border border-zinc-800 text-white text-xs font-bold rounded-lg hover:bg-zinc-800 hover:border-zinc-700 transition-all flex items-center justify-center gap-2"
                >
                  Re-run Interview Simulation
                </button>
              </div>
            ) : candidate.simulation_status === 'simulating' ? (
              <button
                onClick={triggerSimulation}
                className="w-full py-3 bg-amber-600 text-black text-xs font-bold rounded-lg hover:bg-amber-500 transition-all flex items-center justify-center gap-2 animate-pulse"
              >
                Simulation In Progress (View)
              </button>
            ) : (
              <button
                onClick={() => setShowConfirm(true)}
                className="w-full py-3 bg-white text-black text-xs font-bold rounded-lg hover:bg-zinc-200 transition-all flex items-center justify-center gap-2"
              >
                <Play size={14} fill="black" /> Run Interview Simulation
              </button>
            )}
            
            <p className="text-[10px] text-zinc-600 text-center leading-normal">
              AI simulation performs a turn-based technical Q&A using your configured provider keys.
            </p>
          </div>
        </div>

        {/* Right Column - Scores, Match & Simulation Results */}
        <div className="md:col-span-2 space-y-6">
          
          {/* Main Score Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-5 flex flex-col justify-between">
              <span className="text-[10px] uppercase font-bold text-zinc-600 tracking-widest">Match Score</span>
              <div className="flex items-baseline gap-1 mt-4">
                <span className="text-3xl font-black text-white">{candidate.match_score}</span>
                <span className="text-xs text-zinc-500">%</span>
              </div>
              <span className="text-[10px] text-zinc-500 mt-2 font-mono">Weight: {matchWeight}%</span>
            </div>
            
            <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-5 flex flex-col justify-between">
              <span className="text-[10px] uppercase font-bold text-zinc-600 tracking-widest">Simulation Score</span>
              <div className="flex items-baseline gap-1 mt-4">
                {isSimulated ? (
                  <>
                    <span className="text-3xl font-black text-white">
                      {candidate.simulation_eval?.simulation_score}
                    </span>
                    <span className="text-xs text-zinc-500">%</span>
                  </>
                ) : (
                  <span className="text-lg font-bold text-zinc-600">Pending</span>
                )}
              </div>
              <span className="text-[10px] text-zinc-500 mt-2 font-mono">Weight: {simWeight}%</span>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col justify-between ring-1 ring-zinc-700/50">
              <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-widest">Combined Rank Score</span>
              <div className="flex items-baseline gap-1 mt-4">
                <span className="text-3xl font-black text-white">{candidate.combined_score}</span>
                <span className="text-xs text-zinc-500">%</span>
              </div>
              <span className="text-[9px] text-zinc-400 mt-2 flex items-center gap-1">
                <Sparkles size={10} className="text-amber-400" /> Sorted dynamically
              </span>
            </div>
          </div>

          {/* AI Analysis / Scoring Breakdown */}
          {isSimulated && (
            <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-6 space-y-6">
              <div className="flex justify-between items-center pb-4 border-b border-zinc-900">
                <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                  <Award size={14} className="text-amber-500" /> Simulation Scorecard
                </h3>
                <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                  candidate.simulation_eval?.hire_recommendation.includes('Strong Hire') 
                    ? 'bg-emerald-950 border border-emerald-800 text-emerald-400' 
                    : candidate.simulation_eval?.hire_recommendation.includes('Hire')
                      ? 'bg-zinc-900 border border-zinc-800 text-zinc-300'
                      : 'bg-red-950 border border-red-800 text-red-400'
                }`}>
                  {candidate.simulation_eval?.hire_recommendation}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-zinc-900/30 p-4 border border-zinc-900 rounded-lg">
                  <span className="text-[10px] text-zinc-500 font-bold uppercase block">Technical Depth</span>
                  <div className="flex items-center gap-3 mt-2">
                    <div className="flex-1 bg-zinc-900 h-2 rounded-full overflow-hidden">
                      <div className="h-full bg-white rounded-full" style={{ width: `${candidate.simulation_eval?.technical_depth}%` }}></div>
                    </div>
                    <span className="text-sm font-bold text-white">{candidate.simulation_eval?.technical_depth}%</span>
                  </div>
                </div>

                <div className="bg-zinc-900/30 p-4 border border-zinc-900 rounded-lg">
                  <span className="text-[10px] text-zinc-500 font-bold uppercase block">Communication Quality</span>
                  <div className="flex items-center gap-3 mt-2">
                    <div className="flex-1 bg-zinc-900 h-2 rounded-full overflow-hidden">
                      <div className="h-full bg-white rounded-full" style={{ width: `${candidate.simulation_eval?.communication}%` }}></div>
                    </div>
                    <span className="text-sm font-bold text-white">{candidate.simulation_eval?.communication}%</span>
                  </div>
                </div>
              </div>

              {candidate.simulation_eval?.red_flags && candidate.simulation_eval.red_flags.length > 0 && (
                <div className="bg-red-950/15 border border-red-900/30 rounded-lg p-4 space-y-2">
                  <span className="text-[10px] text-red-400 font-black uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldAlert size={12} /> Key Red Flags / Discrepancies
                  </span>
                  <ul className="list-disc pl-4 space-y-1">
                    {candidate.simulation_eval.red_flags.map((flag, idx) => (
                      <li key={idx} className="text-xs text-zinc-400 leading-normal">{flag}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Sourcing / JD Match Details */}
          <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-6 space-y-6">
            <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400">Match Details</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-3">
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 size={12} className="text-emerald-500" /> Matched Skills
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {candidate.skill_match && candidate.skill_match.length > 0 ? (
                    candidate.skill_match.map(skill => (
                      <span key={skill} className="px-2 py-0.5 rounded bg-emerald-950/20 border border-emerald-900/50 text-[10px] text-emerald-400 font-mono">
                        {skill}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-zinc-600 italic">No skills matched directly.</span>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <XCircle size={12} className="text-zinc-600" /> Missing / Unverified Skills
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {candidate.missing_skills && candidate.missing_skills.length > 0 ? (
                    candidate.missing_skills.map(skill => (
                      <span key={skill} className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-400 font-mono">
                        {skill}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-zinc-600 italic">All skills verified.</span>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-zinc-900/20 border border-zinc-900 rounded-lg p-4 space-y-2">
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Scoring Reasoning</span>
              <p className="text-xs text-zinc-400 leading-relaxed italic">
                "{candidate.reasoning}"
              </p>
            </div>
          </div>

        </div>
      </main>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl max-w-md w-full p-6 space-y-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-amber-950/40 rounded-full border border-amber-900 text-amber-500">
                <AlertTriangle size={24} />
              </div>
              <div className="space-y-2">
                <h3 className="text-base font-bold text-white">Trigger Interview Simulation</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  You are about to launch a turn-based AI simulation between the Interviewer agent and {candidate.profile.name || candidate.username}.
                </p>
              </div>
            </div>

            <div className="bg-zinc-900/50 border border-zinc-900 rounded-lg p-4 space-y-3 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-zinc-500">Active Provider:</span>
                <span className="text-zinc-300 font-bold uppercase">{provider}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Selected Model:</span>
                <span className="text-zinc-300 font-bold">{model}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Estimated Cost:</span>
                <span className="text-white font-bold">{getCostEstimate()}</span>
              </div>
            </div>

            <div className="bg-zinc-900/30 border border-dashed border-zinc-800 rounded-lg p-3 text-[10px] text-zinc-500 leading-normal flex items-start gap-2">
              <HelpCircle size={14} className="shrink-0 text-zinc-600 mt-0.5" />
              <span>
                Each simulation uses your browser-cached API key directly and is charged by your LLM provider. This action cannot be aborted mid-way without losing progress.
              </span>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 text-xs font-bold text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-lg transition-all"
              >
                Cancel
              </button>
              <button
                onClick={triggerSimulation}
                className="px-4 py-2 text-xs font-bold bg-white text-black hover:bg-zinc-200 rounded-lg transition-all"
              >
                Confirm & Run
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
