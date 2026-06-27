'use client';
import { useEffect, useRef } from 'react';

interface Node {
  x: number; y: number;
  vx: number; vy: number;
  r: number; baseR: number;
  phase: number;
  color: [number,number,number];
}

const COLORS: [number,number,number][] = [
  [124, 92, 252],   // purple
  [61, 217, 255],   // cyan
  [124, 92, 252],   // purple (more weight)
  [61, 217, 255],   // cyan
  [155, 123, 253],  // light purple
  [87, 217, 141],   // green
];

export default function NodeNetwork() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf: number;
    let nodes: Node[] = [];

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      init();
    };

    const init = () => {
      const count = Math.min(Math.floor((canvas.width * canvas.height) / 20000), 32);
      nodes = Array.from({ length: count }, () => {
        const c = COLORS[Math.floor(Math.random() * COLORS.length)];
        return {
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.22,
          vy: (Math.random() - 0.5) * 0.22,
          r: 2 + Math.random() * 3,
          baseR: 2 + Math.random() * 3,
          phase: Math.random() * Math.PI * 2,
          color: c,
        };
      });
    };

    resize();
    window.addEventListener('resize', resize);

    let t = 0;
    const MAX_DIST = 220;

    const draw = () => {
      t++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Update
      nodes.forEach(n => {
        n.x += n.vx; n.y += n.vy;
        if (n.x < -20) n.x = canvas.width  + 20;
        if (n.x > canvas.width  + 20) n.x = -20;
        if (n.y < -20) n.y = canvas.height + 20;
        if (n.y > canvas.height + 20) n.y = -20;
        n.phase += 0.015;
        n.r = n.baseR + Math.sin(n.phase) * 1;
      });

      // Edges
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const dist = Math.sqrt(dx*dx + dy*dy);
          if (dist > MAX_DIST) continue;

          const alpha = (1 - dist / MAX_DIST) * 0.18;
          const [r1,g1,b1] = a.color;
          const [r2,g2,b2] = b.color;

          const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
          grad.addColorStop(0, `rgba(${r1},${g1},${b1},${alpha})`);
          grad.addColorStop(1, `rgba(${r2},${g2},${b2},${alpha})`);

          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = grad;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      }

      // Nodes
      nodes.forEach(n => {
        const [r,g,b] = n.color;

        // Halo
        const halo = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 6);
        halo.addColorStop(0, `rgba(${r},${g},${b},0.14)`);
        halo.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r * 6, 0, Math.PI * 2);
        ctx.fillStyle = halo;
        ctx.fill();

        // Core
        const core = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
        core.addColorStop(0, `rgba(255,255,255,0.9)`);
        core.addColorStop(0.5, `rgba(${r},${g},${b},0.8)`);
        core.addColorStop(1, `rgba(${r},${g},${b},0.1)`);
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = core;
        ctx.fill();
      });

      raf = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas ref={canvasRef} style={{
      position: 'fixed', inset: 0, zIndex: 0,
      pointerEvents: 'none', opacity: 0.65,
    }} />
  );
}
