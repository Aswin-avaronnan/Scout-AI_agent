import React from 'react';
import './globals.css';
import * as Sentry from '@sentry/nextjs';
import type { Metadata } from 'next';

export function generateMetadata(): Metadata {
  return {
    title: 'Catalyst Scout — AI Technical Recruiting Agent',
    description: 'Parse job descriptions, scout GitHub profiles, run AI interview simulations, and rank candidates. Bring your own API key. No data stored.',
    other: {
      ...Sentry.getTraceData()
    }
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased bg-black text-zinc-200">
        {children}
      </body>
    </html>
  );
}
