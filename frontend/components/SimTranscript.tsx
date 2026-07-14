'use client';

import React, { useEffect, useState, useRef } from 'react';
import { usePipelineStore, Candidate } from '../store/pipeline';
import { useSessionStore } from '../store/session';
import { Sparkles, Terminal, User, AlertCircle, RefreshCw, CheckCircle2 } from 'lucide-react';

interface SimTranscriptProps {
  candidateId: string;
  onBack: () => void;
}

export function SimTranscript({ candidateId, onBack }: SimTranscriptProps) {
  const { candidates, job, updateCandidateSim, moveCandidate } = usePipelineStore();
  const { provider, apiKey, githubToken, model } = useSessionStore();
  
  const candidate = candidates.find(c => c.id === candidateId);
  const [localTranscript, setLocalTranscript] = useState<{ turn_index: number; speaker: 'interviewer' | 'candidate'; text: string }[]>([]);
  const [status, setStatus] = useState<'idle' | 'running' | 'completed' | 'failed'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState<string | null>(null); // 'interviewer' or 'candidate'
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [localTranscript, isTyping]);

  // Run simulation stream
  const runSimulationStream = async () => {
    if (!candidate || !job) return;
    
    // Reset state
    setStatus('running');
    setErrorMsg(null);
    setLocalTranscript([]);
    setIsTyping('interviewer');
    
    // Update store to simulating
    updateCandidateSim(candidate.id, {
      simulation_status: 'simulating',
      simulation_transcript: [],
      simulation_eval: null
    });

    // Local accumulator, independent of React state timing, so the eval
    // handler below always has the true, up-to-date transcript to persist.
    const collectedTurns: { turn_index: number; speaker: 'interviewer' | 'candidate'; text: string }[] = [];

    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:7860';
    
    try {
      const response = await fetch(`${baseUrl}/simulate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Api-Key': apiKey,
          ...(githubToken ? { 'X-GitHub-Token': githubToken } : {})
        },
        body: JSON.stringify({
          jd: job,
          candidate_username: candidate.username,
          num_turns: 3,
          provider: provider,
          model: model
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || 'Simulation request failed');
      }

      if (!response.body) {
        throw new Error('Readable stream not supported on response');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        
        // Keep the last partial event in the buffer
        buffer = parts.pop() || '';

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith('data: ')) continue;
          
          const rawData = line.replace('data: ', '');
          const event = JSON.parse(rawData);

          if (event.type === 'turn') {
            const turn = event.data;
            const alreadyCollected = collectedTurns.some(
              t => t.turn_index === turn.turn_index && t.speaker === turn.speaker
            );
            if (!alreadyCollected) {
              collectedTurns.push(turn);
            }

            setLocalTranscript((prev) => {
              // Ensure we don't add duplicate turns
              const exists = prev.some(t => t.turn_index === turn.turn_index && t.speaker === turn.speaker);
              if (exists) return prev;
              
              // Toggle speaker typing indicator
              setIsTyping(turn.speaker === 'interviewer' ? 'candidate' : 'interviewer');
              return [...prev, turn];
            });
          } else if (event.type === 'eval') {
            const evalData = event.data;
            setIsTyping(null);
            setStatus('completed');
            
            // Save to Zustand pipeline store
            updateCandidateSim(candidate.id, {
              simulation_status: 'completed',
              simulation_eval: evalData,
              simulation_transcript: collectedTurns // Correct, up-to-date transcript
            });
            
            // Advance candidate stage to simulated
            moveCandidate(candidate.id, 'simulated');
            
          } else if (event.type === 'error') {
            throw new Error(event.data.message || 'Simulation error');
          }
        }
      }
    } catch (err: any) {
      console.error(err);
      setStatus('failed');
      setErrorMsg(err.message || 'An error occurred during simulation');
      setIsTyping(null);
      
      updateCandidateSim(candidate.id, {
        simulation_status: 'failed'
      });
    }
  };

  // Run on mount
  useEffect(() => {
    runSimulationStream();
  }, [candidateId]);

  if (!candidate) return null;

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] max-w-4xl mx-auto bg-zinc-950 border border-zinc-900 rounded-xl overflow-hidden shadow-2xl">
      {/* Session Monitor Header */}
      <div className="bg-zinc-900 border-b border-zinc-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Terminal size={14} className="text-zinc-500 font-mono" />
          <span className="text-xs font-mono text-zinc-400">
            SIMULATE // <span className="text-white font-bold">{candidate.profile.name || candidate.username}</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          {status === 'running' && (
            <span className="flex items-center gap-1.5 text-[10px] font-mono text-amber-500 uppercase font-bold animate-pulse">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span> Live Streaming
            </span>
          )}
          {status === 'completed' && (
            <span className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400 uppercase font-bold">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span> Session Complete
            </span>
          )}
          {status === 'failed' && (
            <span className="flex items-center gap-1.5 text-[10px] font-mono text-red-500 uppercase font-bold">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500"></span> Terminated
            </span>
          )}
        </div>
      </div>

      {/* Transcript Scroll Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {localTranscript.map((turn, idx) => {
          const isInterviewer = turn.speaker === 'interviewer';
          return (
            <div 
              key={idx} 
              className={`flex items-start gap-4 ${isInterviewer ? 'justify-start' : 'justify-end'}`}
            >
              {isInterviewer && (
                <div className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 font-bold text-xs shrink-0 select-none">
                  AI
                </div>
              )}
              
              <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-xs leading-relaxed space-y-1 shadow-md border ${
                isInterviewer 
                  ? 'bg-zinc-900 border-zinc-800 text-zinc-300 rounded-tl-none' 
                  : 'bg-zinc-800/20 border-zinc-700/50 text-white rounded-tr-none'
              }`}>
                <span className="block text-[8px] font-mono tracking-widest text-zinc-500 uppercase font-bold">
                  {isInterviewer ? 'Interviewer' : (candidate.profile.name || candidate.username)}
                </span>
                <p className="whitespace-pre-wrap">{turn.text}</p>
              </div>

              {!isInterviewer && (
                <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden shrink-0 select-none">
                  {candidate.profile.avatar_url ? (
                    <img src={candidate.profile.avatar_url} alt="Candidate avatar" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-500 font-bold text-xs">
                      {candidate.username[0].toUpperCase()}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Typing / Thinking Loader */}
        {isTyping && (
          <div className={`flex items-center gap-3 ${isTyping === 'interviewer' ? 'justify-start' : 'justify-end'}`}>
            {isTyping === 'interviewer' && (
              <div className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 shrink-0">
                AI
              </div>
            )}
            <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-full px-4 py-2.5 flex items-center gap-2">
              <span className="text-[10px] text-zinc-500 font-mono tracking-wide">
                {isTyping === 'interviewer' ? 'Interviewer' : (candidate.profile.name || candidate.username)} is formulating response
              </span>
              <div className="flex gap-1">
                <span className="h-1.5 w-1.5 bg-zinc-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="h-1.5 w-1.5 bg-zinc-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="h-1.5 w-1.5 bg-zinc-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
            </div>
            {isTyping === 'candidate' && (
              <div className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 overflow-hidden shrink-0">
                {candidate.profile.avatar_url ? (
                  <img src={candidate.profile.avatar_url} alt="Candidate avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-500 text-xs">
                    {candidate.username[0].toUpperCase()}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Completed Scorecard Block */}
        {status === 'completed' && candidate.simulation_eval && (
          <div className="border border-emerald-900/60 bg-emerald-950/10 rounded-xl p-6 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="text-emerald-400" size={18} />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Evaluation Completed</h3>
              </div>
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950 border border-emerald-800 px-2 py-0.5 rounded uppercase">
                {candidate.simulation_eval.hire_recommendation}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="bg-zinc-900/60 p-3 rounded-lg border border-zinc-800 text-center">
                <span className="text-[9px] uppercase font-bold text-zinc-500 font-mono">Tech Depth</span>
                <span className="block text-2xl font-black text-white mt-1">
                  {candidate.simulation_eval.technical_depth}%
                </span>
              </div>
              <div className="bg-zinc-900/60 p-3 rounded-lg border border-zinc-800 text-center">
                <span className="text-[9px] uppercase font-bold text-zinc-500 font-mono">Comm Quality</span>
                <span className="block text-2xl font-black text-white mt-1">
                  {candidate.simulation_eval.communication}%
                </span>
              </div>
            </div>

            {candidate.simulation_eval.red_flags && candidate.simulation_eval.red_flags.length > 0 && (
              <div className="bg-zinc-900/40 p-3 rounded-lg border border-zinc-850">
                <span className="text-[9px] uppercase font-bold text-red-400 font-mono block mb-1">Alert Flags</span>
                <ul className="list-disc pl-4 space-y-1 text-zinc-400 text-xs">
                  {candidate.simulation_eval.red_flags.map((flag, i) => (
                    <li key={i}>{flag}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Failed / Error Monitor Block */}
        {status === 'failed' && (
          <div className="border border-red-950 bg-red-950/10 rounded-xl p-5 space-y-3 flex items-start gap-3">
            <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={18} />
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Simulation Loop Interrupted</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {errorMsg || 'A critical error occurred while streaming the turn responses. The session has been halted.'}
              </p>
              <button
                onClick={runSimulationStream}
                className="mt-2 px-3 py-1.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-white rounded text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <RefreshCw size={12} /> Restart Simulation
              </button>
            </div>
          </div>
        )}

        <div ref={transcriptEndRef} />
      </div>

      {/* Control Footer */}
      <div className="bg-zinc-950 border-t border-zinc-900 px-6 py-4 flex justify-between items-center">
        <button
          onClick={onBack}
          className="px-4 py-2 bg-zinc-900 border border-zinc-800 text-xs font-bold text-zinc-400 hover:text-white rounded-lg hover:border-zinc-700 transition-all"
        >
          Return to Detail
        </button>

        {status === 'completed' && (
          <button
            onClick={() => onBack()}
            className="px-4 py-2 bg-white text-black text-xs font-bold rounded-lg hover:bg-zinc-200 transition-all flex items-center gap-1.5"
          >
             View Scorecard
          </button>
        )}
      </div>
    </div>
  );
}
