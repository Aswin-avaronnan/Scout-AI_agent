'use client';

import React, { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { SimTranscript } from '../../components/SimTranscript';

function SimulateContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = searchParams.get('id');

  if (!id) {
    return (
      <div className="min-h-screen bg-black text-zinc-200 flex flex-col items-center justify-center">
        <h1 className="text-xl font-bold mb-4">No Candidate ID Provided</h1>
        <button 
          onClick={() => router.push('/pipeline')} 
          className="text-sm text-zinc-400 hover:text-white underline font-mono text-zinc-500 hover:text-zinc-200"
        >
          BACK_TO_PIPELINE
        </button>
      </div>
    );
  }

  return (
    <SimTranscript 
      candidateId={id} 
      onBack={() => router.push(`/candidate/${encodeURIComponent(id)}`)} 
    />
  );
}

export default function SimulatePage() {
  return (
    <div className="min-h-screen bg-black text-zinc-200 p-8 flex flex-col justify-center">
      <Suspense fallback={
        <div className="flex flex-col items-center justify-center h-[calc(100vh-120px)] max-w-4xl w-full mx-auto bg-zinc-950 border border-zinc-900 rounded-xl">
          <div className="flex gap-2 items-center">
            <span className="h-2 w-2 bg-zinc-500 rounded-full animate-bounce"></span>
            <span className="h-2 w-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
            <span className="h-2 w-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
          </div>
          <span className="text-xs text-zinc-600 font-mono mt-4">INITIALIZING_SSE_STREAM</span>
        </div>
      }>
        <SimulateContent />
      </Suspense>
    </div>
  );
}
