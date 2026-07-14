'use client';

import React from 'react';
import { Candidate } from '../store/pipeline';
import { User, Github, Star, ExternalLink, FileText } from 'lucide-react';
import Link from 'next/link';

export function CandidateCard({ candidate }: { candidate: Candidate }) {
  const isSimulated = candidate.simulation_status === 'completed' && candidate.simulation_eval;
  const displayScore = isSimulated ? candidate.combined_score : candidate.match_score;
  const scoreLabel = isSimulated ? 'Score' : 'Match';
  // github_found is only present on resume-uploaded candidates; anything sourced
  // directly via /scout or a sheet upload has a real GitHub username, so treat
  // undefined as "yes, this is real" rather than assuming the negative.
  const hasRealGithub = candidate.github_found !== false;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 hover:border-zinc-700 transition-all space-y-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center overflow-hidden border border-zinc-700">
            {candidate.profile.avatar_url ? (
              <img src={candidate.profile.avatar_url} alt={candidate.username} className="w-full h-full object-cover" />
            ) : (
              <User size={20} className="text-zinc-500" />
            )}
          </div>
          <div>
            <h3 className="font-bold text-sm text-white truncate max-w-[120px]">
              {candidate.profile.name || candidate.username}
            </h3>
            <div className="flex items-center gap-1 text-[10px] text-zinc-500 font-mono">
              {hasRealGithub ? (
                <>
                  <Github size={10} />
                  <span>{candidate.username}</span>
                </>
              ) : (
                <>
                  <FileText size={10} />
                  <span>Resume-only profile</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <div className="text-xl font-black text-white">
            {displayScore}<span className="text-[10px] text-zinc-600 font-normal">%</span>
          </div>
          <span className="text-[8px] uppercase tracking-wider text-zinc-500 font-bold">{scoreLabel}</span>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {candidate.top_languages.slice(0, 3).map(lang => (
            <span key={lang} className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-[10px] text-zinc-300">
              {lang}
            </span>
          ))}
          {candidate.simulation_status === 'simulating' && (
            <span className="px-1.5 py-0.5 rounded bg-amber-950/50 border border-amber-900 text-[8px] font-bold text-amber-400 animate-pulse uppercase tracking-wider">
              Simulating
            </span>
          )}
          {candidate.simulation_status === 'pending' && (
            <span className="px-1.5 py-0.5 rounded bg-zinc-950 border border-zinc-800 text-[8px] font-bold text-zinc-500 uppercase tracking-wider">
              Pending Sim
            </span>
          )}
          {candidate.simulation_status === 'failed' && (
            <span className="px-1.5 py-0.5 rounded bg-red-950/50 border border-red-900 text-[8px] font-bold text-red-400 uppercase tracking-wider">
              Sim Failed
            </span>
          )}
        </div>
        <p className="text-[11px] text-zinc-400 line-clamp-2 italic leading-relaxed">
          "{candidate.reasoning}"
        </p>
      </div>

      <div className="pt-2 border-t border-zinc-800 flex justify-between items-center">
        <div className="flex gap-2">
          {candidate.profile.public_repos > 0 && (
            <div className="flex items-center gap-1 text-[10px] text-zinc-500">
              <Star size={10} />
              <span>{candidate.profile.public_repos} repos</span>
            </div>
          )}
        </div>
        <Link 
          href={`/candidate/${candidate.id}`}
          className="text-[10px] font-bold text-zinc-400 hover:text-white flex items-center gap-1"
        >
          Details <ExternalLink size={10} />
        </Link>
      </div>
    </div>
  );
}