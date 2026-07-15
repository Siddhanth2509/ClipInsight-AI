'use client';
import dynamic from 'next/dynamic';

const MagneticCursor = dynamic(() => import('./MagneticCursor'), { ssr: false });
const ParticleField  = dynamic(() => import('./ParticleField'),  { ssr: false });
const SakuraPetals   = dynamic(() => import('./SakuraPetals'),   { ssr: false });

export default function GlobalOverlays() {
  return (
    <>
      <ParticleField />
      <SakuraPetals />
      <MagneticCursor />
    </>
  );
}
