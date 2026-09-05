import React from 'react';
import { LandingNav } from '../components/landing/LandingNav';
import { Hero } from '../components/landing/Hero';
import { Features } from '../components/landing/Features';
import { HowItWorks } from '../components/landing/HowItWorks';
import { KeyCallout } from '../components/landing/KeyCallout';
import { FooterCTA } from '../components/landing/FooterCTA';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-black text-zinc-200">
      <LandingNav />
      <Hero />
      <Features />
      <HowItWorks />
      <KeyCallout />
      <FooterCTA />
    </div>
  );
}
