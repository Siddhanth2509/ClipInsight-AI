'use client';
import React, { useState, useRef } from 'react';

interface GlareHoverProps {
  glowColor?: string;
  borderRadius?: number;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

export default function GlareHover({
  glowColor = 'rgba(255, 255, 255, 0.08)',
  borderRadius = 16,
  children,
  style = {}
}: GlareHoverProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    // Calculate mouse position relative to the container element
    setCoords({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        borderRadius: `${borderRadius}px`,
        overflow: 'hidden',
        ...style
      }}
    >
      {hovered && (
        <div
          style={{
            position: 'absolute',
            width: '180%',
            height: '180%',
            background: `radial-gradient(circle, ${glowColor} 0%, transparent 60%)`,
            left: `${coords.x - 90}%`,
            top: `${coords.y - 90}%`,
            pointerEvents: 'none',
            zIndex: 10,
            transform: 'translate(-50%, -50%)',
            mixBlendMode: 'overlay',
          }}
        />
      )}
      <div style={{ position: 'relative', zIndex: 2, height: '100%' }}>
        {children}
      </div>
    </div>
  );
}
