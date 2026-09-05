'use client';

import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { ShieldCheck } from 'lucide-react';

const providers = ['OpenAI', 'Anthropic', 'Google Gemini', 'Groq', 'OpenRouter'];

export function KeyCallout() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <section className="px-6 md:px-12 py-24 border-t border-zinc-900">
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 24 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6 }}
        className="max-w-2xl mx-auto text-center"
      >
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full border border-zinc-800 bg-zinc-950 mb-6">
          <ShieldCheck size={20} className="text-zinc-400" />
        </div>

        <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4">
          Your keys. Your data.
        </h2>

        <p className="text-zinc-400 text-base leading-relaxed mb-10">
          Catalyst Scout never stores your API key on any server. Keys live in your browser's{' '}
          <code className="text-xs bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded font-mono text-zinc-300">
            sessionStorage
          </code>{' '}
          only — wiped the moment the tab closes. We built it this way on purpose.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-2 mb-10">
          {providers.map((p) => (
            <span
              key={p}
              className="px-3 py-1.5 text-xs font-medium border border-zinc-800 text-zinc-400 rounded-full bg-zinc-950"
            >
              {p}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
          {[
            { label: 'No server storage', detail: 'Keys never leave your browser session.' },
            { label: 'No account required', detail: 'No sign-up, no email, no tracking.' },
            { label: 'Open source', detail: 'Inspect every line. Trust is verified, not assumed.' },
          ].map((item) => (
            <div
              key={item.label}
              className="p-4 bg-zinc-950 border border-zinc-900 rounded-xl"
            >
              <p className="text-xs font-bold text-zinc-200 mb-1">{item.label}</p>
              <p className="text-[11px] text-zinc-500 leading-relaxed">{item.detail}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
