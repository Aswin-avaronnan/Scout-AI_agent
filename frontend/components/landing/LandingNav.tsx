'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 px-6 md:px-12 py-4 flex items-center justify-between transition-all duration-300 ${
        scrolled
          ? 'bg-black/80 backdrop-blur-md border-b border-zinc-900'
          : 'bg-transparent'
      }`}
    >
      <span className="text-sm font-bold text-white tracking-tight">
        Catalyst Scout <span className="text-zinc-500 font-normal">v2</span>
      </span>
      <Link
        href="/onboarding"
        className="px-4 py-1.5 text-xs font-bold bg-white text-black rounded hover:bg-zinc-200 transition-colors"
      >
        Try it →
      </Link>
    </nav>
  );
}
