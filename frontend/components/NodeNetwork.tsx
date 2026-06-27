'use client';
import { useEffect, useRef } from 'react';

interface Node {
  x: number; y: number;
  vx: number; vy: number;
  r: number; baseR: number;
  pulsePhase: number;
  glowColor: string;
  opacity: number;
}

interface Packet {
  fromIdx: number; toIdx: number;
  progress: number; speed: number;
  color: string; size: number;
}

interface Edge {
  a: number; b: number; progress: number;
}

const GLOW_COLORS = [
  'rgba(168,85,247,',   // electric purple
  'rgba(185,64,112,',   // deep rose
  'rgba(99,102,241,',   // indigo
  'rgba(52,211,153,',   // jade
  'rgba(251,191,36,',   // gold
];

export default function NodeNetwork() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId: number;
    let nodes: Node[] = [];
    let edges: Edge[] = [];
    let packets: Packet[] = [];

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Build node graph
    const init = () => {
      nodes = [];
      edges = [];
      packets = [];

      const count = Math.min(Math.floor((canvas.width * canvas.height) / 22000), 28);

      for (let i = 0; i < count; i++) {
        nodes.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.28,
          vy: (Math.random() - 0.5) * 0.28,
          r: 3 + Math.random() * 5,
          baseR: 3 + Math.random() * 5,
          pulsePhase: Math.random() * Math.PI * 2,
          glowColor: GLOW_COLORS[Math.floor(Math.random() * GLOW_COLORS.length)],
          opacity: 0.55 + Math.random() * 0.45,
        });
      }

      // Connect nearby nodes
      const MAX_DIST = 260;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          if (Math.sqrt(dx * dx + dy * dy) < MAX_DIST) {
            edges.push({ a: i, b: j, progress: 0 });
          }
        }
      }

      // Seed initial packets
      for (let k = 0; k < 6; k++) spawnPacket();
    };

    const spawnPacket = () => {
      if (edges.length === 0) return;
      const e = edges[Math.floor(Math.random() * edges.length)];
      packets.push({
        fromIdx: Math.random() > 0.5 ? e.a : e.b,
        toIdx:   Math.random() > 0.5 ? e.b : e.a,
        progress: 0,
        speed: 0.003 + Math.random() * 0.006,
        color: GLOW_COLORS[Math.floor(Math.random() * GLOW_COLORS.length)],
        size: 2 + Math.random() * 2,
      });
    };

    let t = 0;
    const MAX_DIST_DYNAMIC = 260;

    const draw = () => {
      t++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Update nodes
      nodes.forEach(n => {
        n.x += n.vx; n.y += n.vy;
        if (n.x < -40) n.x = canvas.width + 40;
        if (n.x > canvas.width + 40) n.x = -40;
        if (n.y < -40) n.y = canvas.height + 40;
        if (n.y > canvas.height + 40) n.y = -40;
        n.pulsePhase += 0.018;
        n.r = n.baseR + Math.sin(n.pulsePhase) * 1.5;
      });

      // Rebuild edges dynamically
      if (t % 60 === 0) {
        edges = [];
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const dx = nodes[i].x - nodes[j].x;
            const dy = nodes[i].y - nodes[j].y;
            if (Math.sqrt(dx * dx + dy * dy) < MAX_DIST_DYNAMIC) {
              edges.push({ a: i, b: j, progress: 0 });
            }
          }
        }
      }

      // Draw edges
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const na = nodes[i], nb = nodes[j];
          const dx = na.x - nb.x, dy = na.y - nb.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < MAX_DIST_DYNAMIC) {
            const alpha = (1 - dist / MAX_DIST_DYNAMIC) * 0.22;

            // Gradient line for the glow effect
            const grad = ctx.createLinearGradient(na.x, na.y, nb.x, nb.y);
            grad.addColorStop(0, `rgba(168,85,247,${alpha})`);
            grad.addColorStop(0.5, `rgba(185,64,112,${alpha * 1.4})`);
            grad.addColorStop(1, `rgba(99,102,241,${alpha})`);

            ctx.save();
            ctx.beginPath();
            ctx.moveTo(na.x, na.y);
            ctx.lineTo(nb.x, nb.y);
            ctx.strokeStyle = grad;
            ctx.lineWidth = 0.7;
            ctx.stroke();

            // Outer glow line
            ctx.beginPath();
            ctx.moveTo(na.x, na.y);
            ctx.lineTo(nb.x, nb.y);
            ctx.strokeStyle = `rgba(168,85,247,${alpha * 0.35})`;
            ctx.lineWidth = 2.5;
            ctx.filter = 'blur(2px)';
            ctx.stroke();
            ctx.filter = 'none';
            ctx.restore();
          }
        }
      }

      // Draw nodes
      nodes.forEach(n => {
        const col = n.glowColor;

        // Outer glow halo
        ctx.save();
        const halo = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 5);
        halo.addColorStop(0, `${col}0.22)`);
        halo.addColorStop(0.5, `${col}0.06)`);
        halo.addColorStop(1, `${col}0)`);
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r * 5, 0, Math.PI * 2);
        ctx.fillStyle = halo;
        ctx.fill();

        // Core dot
        const core = ctx.createRadialGradient(n.x - n.r * 0.3, n.y - n.r * 0.3, 0, n.x, n.y, n.r);
        core.addColorStop(0, `rgba(255,255,255,${n.opacity})`);
        core.addColorStop(0.4, `${col}${n.opacity})`);
        core.addColorStop(1, `${col}0.1)`);
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = core;
        ctx.fill();

        // Subtle ring
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r + 2, 0, Math.PI * 2);
        ctx.strokeStyle = `${col}0.25)`;
        ctx.lineWidth = 0.8;
        ctx.stroke();
        ctx.restore();
      });

      // Update & draw packets
      packets = packets.filter(p => {
        p.progress += p.speed;
        if (p.progress >= 1) { spawnPacket(); return false; }

        const from = nodes[p.fromIdx], to = nodes[p.toIdx];
        if (!from || !to) return false;

        const px = from.x + (to.x - from.x) * p.progress;
        const py = from.y + (to.y - from.y) * p.progress;

        // Packet trail
        ctx.save();
        const trail = 8;
        for (let i = trail; i > 0; i--) {
          const tp = Math.max(0, p.progress - (p.speed * i * 3));
          const tx = from.x + (to.x - from.x) * tp;
          const ty = from.y + (to.y - from.y) * tp;
          ctx.beginPath();
          ctx.arc(tx, ty, p.size * (i / trail) * 0.8, 0, Math.PI * 2);
          ctx.fillStyle = `${p.color}${(i / trail) * 0.3})`;
          ctx.fill();
        }

        // Packet glow
        const pGlow = ctx.createRadialGradient(px, py, 0, px, py, p.size * 4);
        pGlow.addColorStop(0, `${p.color}0.6)`);
        pGlow.addColorStop(1, `${p.color}0)`);
        ctx.beginPath();
        ctx.arc(px, py, p.size * 4, 0, Math.PI * 2);
        ctx.fillStyle = pGlow;
        ctx.fill();

        // Packet core
        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,0.92)`;
        ctx.fill();
        ctx.restore();

        return true;
      });

      // Spawn packets periodically
      if (t % 90 === 0 && packets.length < 18) spawnPacket();

      rafId = requestAnimationFrame(draw);
    };

    init();
    draw();

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        opacity: 0.75,
      }}
    />
  );
}
