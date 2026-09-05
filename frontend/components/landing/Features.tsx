'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef } from 'react';
import { FileText, Github, MessagesSquare, Upload, SlidersHorizontal, ShieldCheck } from 'lucide-react';

const features = [
  {
    icon: FileText,
    title: 'Parse Job Descriptions',
    description:
      'Paste text, upload a PDF, or drop a URL. The agent extracts required skills, seniority, domain, and tech stack into a structured profile.',
  },
  {
    icon: Github,
    title: 'Scout GitHub Profiles',
    description:
      'Provide GitHub usernames and the agent fetches real profile data — repos, top languages, contribution signals — at up to 5000 req/hr with your PAT.',
  },
  {
    icon: MessagesSquare,
    title: 'AI Interview Simulation',
    description:
      'Two LLMs play interviewer and candidate in a turn-based loop. The transcript streams live. Final evaluation scores technical depth and communication.',
  },
  {
    icon: Upload,
    title: 'Bulk Import Candidates',
    description:
      'Upload a CSV, JSON, or PDF resume. The pipeline processes all candidates in parallel and scores them against the job description.',
  },
  {
    icon: SlidersHorizontal,
    title: 'Configurable 60/40 Scoring',
    description:
      'Match score and simulation score are combined with adjustable weights. Tune the formula to match your hiring priorities on the fly.',
  },
  {
    icon: ShieldCheck,
    title: 'Zero Data Retention',
    description:
      'Your API keys never leave the browser — stored in sessionStorage, wiped on tab close. No account, no tracking, no stored data on our backend.',
  },
];

function FeatureCard({ feature, index }: { feature: typeof features[0]; index: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-60px' });
  const Icon = feature.icon;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: (index % 3) * 0.1 }}
      className="p-6 bg-zinc-950 border border-zinc-900 rounded-xl hover:border-zinc-700 transition-colors group"
    >
      <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4 group-hover:border-zinc-600 transition-colors">
        <Icon size={15} className="text-zinc-400" />
      </div>
      <h3 className="text-sm font-bold text-zinc-100 mb-2">{feature.title}</h3>
      <p className="text-xs text-zinc-500 leading-relaxed">{feature.description}</p>
    </motion.div>
  );
}

export function Features() {
  return (
    <section className="px-6 md:px-12 py-24 max-w-6xl mx-auto">
      <div className="text-center mb-14">
        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3">
          What it does
        </p>
        <h2 className="text-3xl md:text-4xl font-extrabold text-white">
          Everything a recruiting agent should do
        </h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {features.map((feature, i) => (
          <FeatureCard key={feature.title} feature={feature} index={i} />
        ))}
      </div>
    </section>
  );
}
