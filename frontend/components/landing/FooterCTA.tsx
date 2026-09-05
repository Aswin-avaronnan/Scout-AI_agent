'use client';

import React, { useRef } from 'react';
import Link from 'next/link';
import { motion, useInView } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

export function FooterCTA() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <section className="px-6 md:px-12 py-32 border-t border-zinc-900">
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 24 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6 }}
        className="max-w-2xl mx-auto text-center"
      >
        <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-6 leading-tight">
          Ready to start?
        </h2>
        <p className="text-zinc-500 mb-10 text-sm leading-relaxed">
          No account. No credit card. Bring your API key and go.
        </p>

        <Link
          href="/onboarding"
          className="group inline-flex items-center gap-2 px-8 py-4 bg-white text-black text-sm font-bold rounded-lg hover:bg-zinc-100 transition-all"
        >
          Try Catalyst Scout — Free
          <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </motion.div>

      {/* Footer */}
      <div className="mt-24 pt-8 border-t border-zinc-900 flex flex-col sm:flex-row items-center justify-between gap-4 max-w-6xl mx-auto">
        <span className="text-xs text-zinc-700">
          Catalyst Scout v2 · Built by{' '}
          <a
            href="https://github.com/Aswin-avaronnan"
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Aswin Avaronnan
          </a>
        </span>
        <div className="flex items-center gap-6">
          <a
            href="https://github.com/Aswin-avaronnan/Scout-AI_agent"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            GitHub
          </a>
          <Link
            href="/onboarding"
            className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            Launch app
          </Link>
        </div>
      </div>
    </section>
  );
}
