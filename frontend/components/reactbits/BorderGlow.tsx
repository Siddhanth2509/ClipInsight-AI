'use client';
import React from 'react';

interface BorderGlowProps {
  glowColor?: string;
  duration?: string;
  borderRadius?: number;
  children?: React.ReactNode;
}

export default function BorderGlow({
  glowColor = 'linear-gradient(90deg, #7C5CFC, #3DD9FF, #FFB6C1, #7C5CFC)',
  duration = '4s',
  borderRadius = 16,
  children
}: BorderGlowProps) {
  return (
    <div
      style={{
        position: 'relative',
        padding: '1px',
        borderRadius: `${borderRadius}px`,
        background: 'rgba(255,255,255,0.03)',
        overflow: 'hidden',
      }}
    >
      <style>{`
        @keyframes flowBorder {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .border-glow-bg {
          position: absolute;
          inset: -50%;
          background: ${glowColor};
          animation: flowBorder ${duration} linear infinite;
          transform-origin: center;
          z-index: 1;
        }
        .border-glow-inner {
          position: relative;
          z-index: 2;
          border-radius: ${borderRadius - 1}px;
          background: rgba(10, 18, 36, 0.98);
          overflow: hidden;
        }
      `}</style>
      <div className="border-glow-bg" />
      <div className="border-glow-inner">
        {children}
      </div>
    </div>
  );
}
