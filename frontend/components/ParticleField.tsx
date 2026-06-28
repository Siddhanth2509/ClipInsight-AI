'use client';
import { useEffect, useRef } from 'react';

interface Node { x:number; y:number; vx:number; vy:number; r:number; phase:number; baseR:number; }

export default function ParticleField() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;

    let nodes: Node[] = [], raf: number;
    let W = window.innerWidth, H = window.innerHeight;
    const MAX_DIST = 140;

    const resize = () => {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width  = W;
      canvas.height = H;
      const count = Math.min(Math.floor(W * H / 25000), 28); // slightly fewer nodes for performance
      nodes = Array.from({length: count}, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.12,
        vy: (Math.random() - 0.5) * 0.12,
        r: 1.2 + Math.random() * 1.8,
        baseR: 1.2 + Math.random() * 1.8,
        phase: Math.random() * Math.PI * 2,
      }));
    };
    resize();
    window.addEventListener('resize', resize);

    const tick = () => {
      ctx.clearRect(0, 0, W, H);
      
      // Update nodes positions
      nodes.forEach(n => {
        n.phase += 0.008; 
        n.r = n.baseR + Math.sin(n.phase) * 0.5;
        n.x += n.vx; 
        n.y += n.vy;
        if (n.x < -10) n.x = W + 10;
        if (n.x > W + 10) n.x = -10;
        if (n.y < -10) n.y = H + 10;
        if (n.y > H + 10) n.y = -10;
      });

      // Draw edges (Optimized: draw simple low-opacity color strokes instead of expensive linear gradients)
      ctx.lineWidth = 0.5;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d = dx*dx + dy*dy; // avoid Math.sqrt, compare squared distance
          if (d > MAX_DIST * MAX_DIST) continue;
          
          const alpha = (1 - Math.sqrt(d) / MAX_DIST) * 0.08;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          // Use solid color with opacity instead of canvas linear gradients
          ctx.strokeStyle = `rgba(124, 92, 252, ${alpha})`;
          ctx.stroke();
        }
      }

      // Draw node particles
      nodes.forEach(n => {
        // Simple circle fills instead of nested radial gradients
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(124, 92, 252, 0.05)';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(61, 217, 255, 0.7)';
        ctx.fill();
      });

      raf = requestAnimationFrame(tick);
    };

    tick();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={ref} style={{ position:'fixed', inset:0, zIndex:0, pointerEvents:'none', opacity:0.4 }} />;
}
