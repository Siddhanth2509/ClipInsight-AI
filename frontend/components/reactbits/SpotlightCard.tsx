'use client';
import React, { useRef, useState } from 'react';

interface SpotlightCardProps {
  spotlightColor?: string;
  borderColor?: string;
  borderRadius?: number;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

export default function SpotlightCard({
  spotlightColor = 'rgba(124, 92, 252, 0.15)',
  borderColor = 'rgba(124, 92, 252, 0.25)',
  borderRadius = 16,
  children,
  style = {}
}: SpotlightCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setCoords({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        borderRadius: `${borderRadius}px`,
        border: `1px solid ${borderColor}`,
        background: 'rgba(255,255,255,0.02)',
        overflow: 'hidden',
        transition: 'border-color 0.25s ease',
        ...style
      }}
    >
      {hovered && (
        <div
          style={{
            position: 'absolute',
            width: '320px',
            height: '320px',
            background: `radial-gradient(circle, ${spotlightColor} 0%, transparent 70%)`,
            left: `${coords.x - 160}px`,
            top: `${coords.y - 160}px`,
            pointerEvents: 'none',
            zIndex: 1,
          }}
        />
      )}
      <div style={{ position: 'relative', zIndex: 2 }}>
        {children}
      </div>
    </div>
  );
}
