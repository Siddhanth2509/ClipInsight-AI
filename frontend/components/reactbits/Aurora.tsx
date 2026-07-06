'use client';
import React from 'react';
import './Aurora.css';

interface AuroraProps {
  colorStops?: string[];
  amplitude?: number;
  speed?: string;
}

export default function Aurora({
  colorStops = ['#7C5CFC', '#3DD9FF', '#FFB6C1', '#57D98D'],
  amplitude = 1.0,
  speed = '12s'
}: AuroraProps) {
  return (
    <div className="aurora-container" style={{ '--speed': speed } as React.CSSProperties}>
      <div className="aurora-wave" style={{ background: colorStops[0], filter: 'blur(60px)', opacity: 0.15 * amplitude }} />
      <div className="aurora-wave" style={{ background: colorStops[1], filter: 'blur(80px)', opacity: 0.2 * amplitude }} />
      <div className="aurora-wave" style={{ background: colorStops[2], filter: 'blur(70px)', opacity: 0.15 * amplitude }} />
      <div className="aurora-wave" style={{ background: colorStops[3], filter: 'blur(90px)', opacity: 0.1 * amplitude }} />
    </div>
  );
}
