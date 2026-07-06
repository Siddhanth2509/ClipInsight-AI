'use client';
import React from 'react';

interface StarBorderProps {
  as?: React.ElementType;
  className?: string;
  color?: string;
  speed?: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
  onClick?: () => void;
}

export default function StarBorder({
  as: Component = 'button',
  className = '',
  color = '#7C5CFC',
  speed = '6s',
  children,
  style = {},
  onClick,
  ...props
}: StarBorderProps) {
  return (
    <Component
      className={`star-border-btn ${className}`}
      onClick={onClick}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2px',
        background: 'transparent',
        border: 'none',
        borderRadius: '12px',
        overflow: 'hidden',
        cursor: 'pointer',
        ...style,
      }}
      {...props}
    >
      <style>{`
        @keyframes rotateStar {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .star-border-glow {
          position: absolute;
          width: 200%;
          height: 200%;
          background: conic-gradient(
            from 0deg,
            transparent 0deg,
            transparent 120deg,
            ${color} 180deg,
            transparent 240deg,
            transparent 360deg
          );
          animation: rotateStar ${speed} linear infinite;
          top: -50%;
          left: -50%;
          z-index: 1;
        }
        .star-border-inner {
          position: relative;
          z-index: 2;
          width: 100%;
          height: 100%;
          background: rgba(12, 20, 38, 0.96);
          border-radius: 10px;
          display: flex;
          alignItems: center;
          justifyContent: center;
        }
      `}</style>
      <div className="star-border-glow" />
      <div className="star-border-inner" style={{ width: '100%', height: '100%' }}>
        {children}
      </div>
    </Component>
  );
}
