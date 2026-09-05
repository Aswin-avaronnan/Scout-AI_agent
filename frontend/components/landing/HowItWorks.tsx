'use client';

import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';

const steps = [
  {
    number: '01',
    title: 'Paste your JD',
    description: 'Drop in a job description — text, PDF, or URL. The agent parses it into a structured skills profile.',
  },
  {
    number: '02',
    title: 'Add candidates',
    description: 'Provide GitHub usernames, upload a CSV sheet, or upload individual PDF resumes. Mix and match.',
  },
  {
    number: '03',
    title: 'Scout runs',
    description: 'GitHub enrichment and LLM match scoring run in parallel. Cards appear on your Kanban board as results stream in.',
  },
  {
    number: '04',
    title: 'Run simulations',
    description: 'Open any candidate, click "Run Simulation." Two LLMs conduct a full technical interview. You watch it stream live.',
  },
  {
    number: '05',
    title: 'Review rankings',
    description: 'Candidates are ranked by combined score (match + simulation). Drag across Kanban columns, export your session.',
  },
];

function Step({ step, index }: { step: typeof steps[0]; index: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x: -16 }}
      animate={isInView ? { opacity: 1, x: 0 } : {}}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="flex gap-6 group"
    >
      {/* Step number + line */}
      <div className="flex flex-col items-center">
        <div className="w-9 h-9 rounded-full border border-zinc-800 bg-zinc-950 flex items-center justify-center shrink-0 group-hover:border-zinc-600 transition-colors">
          <span className="text-[10px] font-black text-zinc-500 group-hover:text-zinc-300 transition-colors font-mono">
            {step.number}
          </span>
        </div>
        {index < steps.length - 1 && (
          <div className="w-px flex-1 bg-zinc-900 mt-2" />
        )}
      </div>

      {/* Content */}
      <div className={`pb-10 ${index === steps.length - 1 ? 'pb-0' : ''}`}>
        <h3 className="text-sm font-bold text-zinc-100 mb-1.5">{step.title}</h3>
        <p className="text-xs text-zinc-500 leading-relaxed max-w-sm">{step.description}</p>
      </div>
    </motion.div>
  );
}

export function HowItWorks() {
  return (
    <section id="how-it-works" className="px-6 md:px-12 py-24 border-t border-zinc-900">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-start">
        {/* Left — label + heading */}
        <div className="md:sticky md:top-32">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3">
            How it works
          </p>
          <h2 className="text-3xl md:text-4xl font-extrabold text-white leading-tight mb-6">
            From JD to ranked shortlist in minutes.
          </h2>
          <p className="text-sm text-zinc-500 leading-relaxed">
            The entire pipeline — parsing, scouting, scoring, simulating — runs through your own LLM API key. No black-box vendor lock-in.
          </p>
        </div>

        {/* Right — steps */}
        <div>
          {steps.map((step, i) => (
            <Step key={step.number} step={step} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
