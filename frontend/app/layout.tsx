import React from 'react';
import './globals.css';

export const metadata = {
  title: 'Catalyst Scout v2',
  description: 'AI-powered technical recruiting assistant',
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
