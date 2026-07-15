'use client';
import dynamic from 'next/dynamic';

const MagneticCursor = dynamic(() => import('./MagneticCursor'), { ssr: false });
const LiquidBackground = dynamic(() => import('./LiquidBackground'), { ssr: false });
const SakuraPetals   = dynamic(() => import('./SakuraPetals'),   { ssr: false });

export default function GlobalOverlays() {
  return (
    <>
      <LiquidBackground />
      <SakuraPetals />
      <MagneticCursor />
    </>
  );
}
