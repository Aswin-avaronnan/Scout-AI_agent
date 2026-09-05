'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, ChevronDown } from 'lucide-react';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (delay: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay, ease: 'easeOut' },
  }),
};

export function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center px-6 text-center overflow-hidden">
      {/* Grid background */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      {/* Radial vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,black_80%)]" />

      {/* Content */}
      <div className="relative z-10 max-w-4xl mx-auto">
        <motion.div
          custom={0}
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          className="inline-flex items-center gap-2 px-3 py-1 mb-8 rounded-full border border-zinc-800 bg-zinc-950 text-[10px] font-bold uppercase tracking-widest text-zinc-400"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          AI Recruiting Agent · Beta
        </motion.div>

        <motion.h1
          custom={0.15}
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          className="text-5xl md:text-7xl font-extrabold tracking-tight text-white leading-[1.05] mb-6"
        >
          Scout smarter.
          <br />
          <span className="text-zinc-400">Hire faster.</span>
        </motion.h1>

        <motion.p
          custom={0.3}
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          className="max-w-xl mx-auto text-zinc-400 text-lg md:text-xl leading-relaxed mb-12"
        >
          Parse job descriptions, scout GitHub, run AI interview simulations, and rank candidates — with your own API key. Nothing stored on our servers.
        </motion.p>

        <motion.div
          custom={0.45}
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link
            href="/onboarding"
            className="group inline-flex items-center gap-2 px-7 py-3.5 bg-white text-black text-sm font-bold rounded-lg hover:bg-zinc-100 transition-all"
          >
            Try Catalyst Scout
            <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
          </Link>
          <a
            href="#how-it-works"
            className="inline-flex items-center gap-2 px-7 py-3.5 border border-zinc-800 text-zinc-400 text-sm font-medium rounded-lg hover:border-zinc-600 hover:text-zinc-300 transition-all"
          >
            How it works
            <ChevronDown size={15} />
          </a>
        </motion.div>

        <motion.p
          custom={0.6}
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          className="mt-8 text-xs text-zinc-600"
        >
          Bring your own key · No account required · Open source
        </motion.p>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 0.6 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <ChevronDown size={18} className="text-zinc-700 animate-bounce" />
      </motion.div>
    </section>
  );
}
