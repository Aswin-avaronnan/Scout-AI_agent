import React from 'react';
import './globals.css';

export const metadata = {
  title: 'Catalyst Scout — AI Technical Recruiting Agent',
  description: 'Parse job descriptions, scout GitHub profiles, run AI interview simulations, and rank candidates. Bring your own API key. No data stored.',
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
  )
}
