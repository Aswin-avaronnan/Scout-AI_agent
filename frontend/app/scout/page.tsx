'use client';

import React from 'react';
import { JDInput } from '../../components/JDInput';

export default function ScoutPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200 p-8">
      <div className="max-w-4xl mx-auto space-y-12">
        <header className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-white">Scouting Pipeline</h1>
            <p className="text-zinc-500">Input job requirements and candidate profiles.</p>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-zinc-600 uppercase font-bold tracking-widest">Step 01</span>
            <div className="h-1 w-24 bg-zinc-800 mt-1">
              <div className="h-full w-1/2 bg-white"></div>
            </div>
          </div>
        </header>

        <JDInput />
      </div>
    </div>
  );
}
