'use client';
import React, { useRef, useEffect } from 'react';

interface ClickSparkProps {
  sparkColor?: string;
  sparkSize?: number;
  sparkCount?: number;
  duration?: number;
  children?: React.ReactNode;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  color: string;
}

export default function ClickSpark({
  sparkColor = '#7C5CFC',
  sparkSize = 3,
  sparkCount = 10,
  duration = 800,
  children
}: ClickSparkProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const sparksRef = useRef<Spark[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const resizeCanvas = () => {
      if (containerRef.current && canvasRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        canvasRef.current.width = rect.width;
        canvasRef.current.height = rect.height;
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const updateSparks = () => {
      const sparks = sparksRef.current;
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.x += s.vx;
        s.y += s.vy;
        s.alpha -= 1 / (duration / 16); // fade out over duration
        if (s.alpha <= 0) {
          sparks.splice(i, 1);
        }
      }
    };

    const drawSparks = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const sparks = sparksRef.current;
      for (const s of sparks) {
        ctx.save();
        ctx.globalAlpha = s.alpha;
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(s.x, s.y, sparkSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    };

    const loop = () => {
      updateSparks();
      drawSparks();
      animId = requestAnimationFrame(loop);
    };

    loop();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animId);
    };
  }, [sparkSize, duration]);

  const handleClick = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const newSparks: Spark[] = [];
    const colors = [sparkColor, '#3DD9FF', '#FFB6C1', '#57D98D'];

    for (let i = 0; i < sparkCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 2 + 1;
      newSparks.push({
        x: clickX,
        y: clickY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        alpha: 1,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    sparksRef.current.push(...newSparks);
  };

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      style={{ position: 'relative', display: 'inline-block', width: '100%' }}
    >
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 10,
        }}
      />
      {children}
    </div>
  );
}
