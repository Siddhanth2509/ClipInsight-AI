'use client';
import { useState, useEffect, useRef } from 'react';

const PIPELINE_STEPS = [
  { icon: '🔗', label: 'URL Input',    color: '#7C5CFC' },
  { icon: '📥', label: 'Fetch Video',  color: '#7C5CFC' },
  { icon: '🎞', label: 'Frames',       color: '#9B7BFD' },
  { icon: '👁', label: 'Vision AI',    color: '#3DD9FF' },
  { icon: '🎙', label: 'Speech',       color: '#3DD9FF' },
  { icon: '📝', label: 'OCR',          color: '#57D98D' },
  { icon: '🎵', label: 'Music',        color: '#F5C96A' },
  { icon: '😊', label: 'Emotion',      color: '#F5C96A' },
  { icon: '📈', label: 'Trends',       color: '#9B7BFD' },
  { icon: '🧠', label: 'LLM',         color: '#7C5CFC' },
  { icon: '📊', label: 'Report',       color: '#57D98D' },
];

interface Props {
  isRunning?: boolean;
  onComplete?: () => void;
}

export default function PipelineAnimation({ isRunning = false, onComplete }: Props) {
  const [activeIndex, setActiveIndex] = useState(-1);
  const [completedSet, setCompletedSet] = useState<Set<number>>(new Set());
  const intervalRef = useRef<NodeJS.Timeout>();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Step animation
  useEffect(() => {
    if (!isRunning) {
      setActiveIndex(-1);
      setCompletedSet(new Set());
      return;
    }
    let idx = 0;
    setActiveIndex(0);
    intervalRef.current = setInterval(() => {
      idx++;
      if (idx >= PIPELINE_STEPS.length) {
        clearInterval(intervalRef.current);
        setActiveIndex(PIPELINE_STEPS.length - 1);
        onComplete?.();
        return;
      }
      setCompletedSet(prev => new Set([...prev, idx - 1]));
      setActiveIndex(idx);
    }, 600);
    return () => clearInterval(intervalRef.current);
  }, [isRunning]);

  // Canvas particle stream
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf: number;

    interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number; }
    let particles: Particle[] = [];
    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    canvas.width = W; canvas.height = H;

    const spawn = () => {
      if (!isRunning) return;
      const stepW = W / PIPELINE_STEPS.length;
      const sx = (activeIndex >= 0 ? activeIndex : 0) * stepW + stepW / 2;
      const color = PIPELINE_STEPS[Math.max(0, activeIndex)]?.color || '#7C5CFC';
      for (let i = 0; i < 3; i++) {
        particles.push({
          x: sx, y: H / 2,
          vx: (Math.random() - 0.5) * 2,
          vy: (Math.random() - 0.5) * 2 - 0.5,
          life: 1, color, size: 1.5 + Math.random() * 1.5,
        });
      }
    };

    let t = 0;
    const draw = () => {
      t++;
      ctx.clearRect(0, 0, W, H);
      if (t % 4 === 0) spawn();
      particles = particles.filter(p => {
        p.x += p.vx; p.y += p.vy; p.life -= 0.025;
        if (p.life <= 0) return false;
        ctx.save();
        ctx.globalAlpha = p.life * 0.7;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 6; ctx.shadowColor = p.color;
        ctx.fill();
        ctx.restore();
        return true;
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [isRunning, activeIndex]);

  return (
    <div style={{ position: 'relative', padding: '32px 0' }}>
      {/* Particle overlay */}
      <canvas ref={canvasRef} style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, width: '100%', height: '100%',
      }} />

      {/* Track */}
      <div style={{
        display: 'flex', alignItems: 'center', overflowX: 'auto',
        gap: 0, padding: '8px 4px', position: 'relative', zIndex: 1,
        scrollbarWidth: 'none',
      }}>
        {PIPELINE_STEPS.map((step, i) => {
          const isDone   = completedSet.has(i);
          const isActive = activeIndex === i;
          const isPast   = isDone || isActive;

          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              {/* Node */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 56, height: 56,
                  borderRadius: 14,
                  background: isActive
                    ? `${step.color}22`
                    : isDone
                      ? `${step.color}15`
                      : 'rgba(18,24,38,0.8)',
                  border: `1px solid ${isActive ? step.color : isDone ? `${step.color}60` : 'rgba(255,255,255,0.07)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.3rem',
                  boxShadow: isActive ? `0 0 0 4px ${step.color}20, 0 0 30px ${step.color}50` : 'none',
                  transition: 'all 0.4s cubic-bezier(0.34,1.56,0.64,1)',
                  animation: isActive ? 'none' : undefined,
                  transform: isActive ? 'scale(1.12)' : isDone ? 'scale(1.03)' : 'scale(1)',
                }}>
                  {isDone
                    ? <span style={{ color: step.color, fontWeight: 700, fontSize: '1.1rem' }}>✓</span>
                    : step.icon}
                </div>
                <span style={{
                  fontSize: '0.65rem',
                  fontFamily: "'Inter', sans-serif",
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: isActive ? step.color : isDone ? 'rgba(248,250,252,0.5)' : 'rgba(100,116,139,0.8)',
                  transition: 'color 0.3s',
                  whiteSpace: 'nowrap',
                }}>
                  {step.label}
                </span>
              </div>

              {/* Connector */}
              {i < PIPELINE_STEPS.length - 1 && (
                <div style={{
                  width: 44, height: 2, position: 'relative',
                  flexShrink: 0, marginBottom: 36,
                }}>
                  {/* Base line */}
                  <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, height: '100%',
                    background: isPast
                      ? `linear-gradient(90deg, ${step.color}60, ${PIPELINE_STEPS[i+1]?.color || step.color}40)`
                      : 'rgba(255,255,255,0.07)',
                    transition: 'background 0.4s',
                  }} />
                  {/* Traveling packet */}
                  {(isActive || isDone) && (
                    <div style={{
                      position: 'absolute', top: '50%', transform: 'translateY(-50%)',
                      width: 6, height: 6, borderRadius: '50%',
                      background: step.color,
                      boxShadow: `0 0 8px ${step.color}`,
                      animation: 'packet-move 0.6s linear infinite',
                    }} />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes packet-move {
          0%   { left: -3px; opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { left: calc(100% - 3px); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
