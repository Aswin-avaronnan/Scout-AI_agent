'use client';

import React from 'react';
import { usePipelineStore, Candidate } from '../store/pipeline';
import { CandidateCard } from './CandidateCard';

const STAGES: { id: Candidate['stage']; label: string }[] = [
  { id: 'sourced', label: 'Sourced' },
  { id: 'scored', label: 'Scored' },
  { id: 'simulated', label: 'Simulated' },
  { id: 'shortlisted', label: 'Shortlisted' },
];

export function KanbanBoard() {
  const { candidates } = usePipelineStore();

  return (
    <div className="grid grid-cols-4 gap-6 h-full min-h-[600px]">
      {STAGES.map((stage) => {
        const stageCandidates = candidates.filter((c) => c.stage === stage.id);
        
        return (
          <div key={stage.id} className="flex flex-col gap-4">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-xs font-black uppercase tracking-tighter text-zinc-500">
                {stage.label}
              </h2>
              <span className="text-[10px] font-mono text-zinc-700 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">
                {stageCandidates.length}
              </span>
            </div>
            
            <div className="flex-1 bg-zinc-950/50 border border-zinc-900 rounded-xl p-3 space-y-3">
              {stageCandidates.length > 0 ? (
                stageCandidates
                  .sort((a, b) => b.match_score - a.match_score)
                  .map((candidate) => (
                    <CandidateCard key={candidate.id} candidate={candidate} />
                  ))
              ) : (
                <div className="h-24 border border-dashed border-zinc-800 rounded-lg flex items-center justify-center">
                  <span className="text-[10px] text-zinc-700 font-medium">Empty</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
