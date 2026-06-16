'use client';

import React from 'react';
import { KanbanBoard } from '../../components/KanbanBoard';
import { usePipelineStore } from '../../store/pipeline';
import Link from 'next/link';
import { Settings, Plus } from 'lucide-react';

export default function PipelinePage() {
  const { job } = usePipelineStore();

  return (
    <div className="min-h-screen bg-black text-zinc-200 flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-900 bg-zinc-950/50 backdrop-blur-md sticky top-0 z-10 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-black text-xl tracking-tighter text-white">
            CATALYST<span className="text-zinc-600">SCOUT</span>
          </Link>
          <div className="h-4 w-[1px] bg-zinc-800" />
          <div>
            <h1 className="text-sm font-bold text-zinc-200">
              {job?.job_title || 'No Job Active'}
            </h1>
            <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-widest">
              {job?.domain || 'Pipeline'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Link 
            href="/scout" 
            className="flex items-center gap-2 px-3 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-xs font-bold text-zinc-400 hover:text-white hover:border-zinc-700 transition-all"
          >
            <Plus size={14} /> New Scout
          </Link>
          <button className="p-2 rounded bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-white transition-all">
            <Settings size={16} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-x-auto">
        <div className="min-w-[1200px] h-full">
          <KanbanBoard />
        </div>
      </main>
    </div>
  );
}
