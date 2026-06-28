'use client';
import { useEffect, useRef } from 'react';

interface Petal {
  x: number; y: number;
  vx: number; vy: number;
  rotation: number; rotSpeed: number;
  size: number;
  opacity: number;
  swayAngle: number; swaySpeed: number;
  colorIdx: number;
}

const THEME_COLORS: Record<string, string[]> = {
  purple: [
    'rgba(255, 182, 193, 0.75)', // light pink
    'rgba(255, 160, 180, 0.70)', // sakura pink
    'rgba(220, 150, 210, 0.65)', // plum
    'rgba(190, 140, 255, 0.60)', // lavender
    'rgba(255, 210, 225, 0.75)', // blush
  ],
  'ocean-blue': [
    'rgba(173, 216, 230, 0.75)', // light blue
    'rgba(135, 206, 250, 0.70)', // sky blue
    'rgba(30, 144, 255, 0.65)',  // dodger blue
    'rgba(0, 191, 255, 0.60)',   // deep sky blue
    'rgba(176, 224, 230, 0.75)', // powder blue
  ],
  'emerald-green': [
    'rgba(168, 230, 207, 0.75)', // light mint
    'rgba(52, 211, 153, 0.70)',  // emerald mint
    'rgba(16, 185, 129, 0.65)',  // green
    'rgba(110, 231, 183, 0.60)', // soft green
    'rgba(209, 250, 229, 0.75)', // ice green
  ],
  'sunset-orange': [
    'rgba(255, 229, 180, 0.75)', // peach
    'rgba(251, 146, 60, 0.70)',  // orange
    'rgba(249, 115, 22, 0.65)',  // deep orange
    'rgba(253, 186, 116, 0.60)', // soft orange
    'rgba(254, 215, 170, 0.75)', // cream orange
  ],
  'royal-gold': [
    'rgba(254, 240, 138, 0.75)', // light gold
    'rgba(251, 191, 36, 0.70)',  // gold
    'rgba(245, 158, 11, 0.65)',  // amber
    'rgba(253, 224, 71, 0.60)',  // yellow
    'rgba(254, 249, 195, 0.75)', // light yellow
  ],
  'rose-pink': [
    'rgba(253, 242, 248, 0.75)', // pink blush
    'rgba(244, 114, 182, 0.70)', // rose pink
    'rgba(236, 72, 153, 0.65)',  // hot pink
    'rgba(249, 168, 212, 0.60)', // light rose
    'rgba(252, 231, 243, 0.75)', // pale rose
  ],
  'ice-white': [
    'rgba(219, 234, 254, 0.70)', // ice blue
    'rgba(244, 63, 94, 0.35)',   // translucent rose petal
    'rgba(147, 197, 253, 0.60)', // soft blue
    'rgba(255, 255, 255, 0.75)', // white
    'rgba(239, 246, 255, 0.70)', // blue cloud
  ]
};

export default function SakuraPetals() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let petals: Petal[] = [];
    let raf: number;
    let W = window.innerWidth, H = window.innerHeight;

    const resize = () => {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = W;
      canvas.height = H;
    };
    resize();
    window.addEventListener('resize', resize);

    // Generate offscreen canvas to cache petal draw (creates huge performance gain)
    let offscreenCanvases: HTMLCanvasElement[] = [];

    const buildCanvases = (colors: string[]) => {
      offscreenCanvases = colors.map(color => {
        const oc = document.createElement('canvas');
        oc.width = 32;
        oc.height = 32;
        const octx = oc.getContext('2d')!;
        
        octx.translate(16, 16);
        octx.beginPath();
        octx.moveTo(0, 12); // bottom point
        octx.bezierCurveTo(-8, 6, -11, -2, -5, -9); // left side curve
        octx.lineTo(-2, -6); // left tip cleft
        octx.lineTo(0, -4);  // notch center
        octx.lineTo(2, -6);  // right tip cleft
        octx.bezierCurveTo(11, -2, 8, 6, 0, 12); // right side curve
        octx.fillStyle = color;
        octx.fill();

        // subtle vein line
        octx.beginPath();
        octx.moveTo(0, 0);
        octx.lineTo(0, 9);
        octx.strokeStyle = 'rgba(255,255,255,0.2)';
        octx.lineWidth = 0.5;
        octx.stroke();

        return oc;
      });
    };

    // Initial build
    const initialTheme = localStorage.getItem('clipinsight-theme') || 'purple';
    buildCanvases(THEME_COLORS[initialTheme] || THEME_COLORS['purple']);

    // Listen for changes
    const handleThemeChange = (e: Event) => {
      const themeKey = (e as CustomEvent).detail;
      buildCanvases(THEME_COLORS[themeKey] || THEME_COLORS['purple']);
    };
    window.addEventListener('theme-change', handleThemeChange);

    const makePetal = (initialY = false): Petal => {
      const activeColors = THEME_COLORS[localStorage.getItem('clipinsight-theme') || 'purple'] || THEME_COLORS['purple'];
      return {
        x: Math.random() * W,
        y: initialY ? Math.random() * H : -20 - Math.random() * 60,
        vx: (Math.random() - 0.5) * 0.4,
        vy: 0.8 + Math.random() * 1.0,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.02,
        size: 8 + Math.random() * 8,
        opacity: 0.35 + Math.random() * 0.45,
        swayAngle: Math.random() * Math.PI * 2,
        swaySpeed: 0.008 + Math.random() * 0.012,
        colorIdx: Math.floor(Math.random() * activeColors.length),
      };
    };

    // Seed initial scattered petals
    for (let i = 0; i < 30; i++) {
      petals.push(makePetal(true));
    }

    const tick = () => {
      ctx.clearRect(0, 0, W, H);

      // Add new petals slowly
      if (petals.length < 40 && Math.random() < 0.1) {
        petals.push(makePetal(false));
      }

      petals = petals.filter(p => {
        p.swayAngle += p.swaySpeed;
        p.x += p.vx + Math.sin(p.swayAngle) * 0.45;
        p.y += p.vy;
        p.rotation += p.rotSpeed;

        // Draw cached petal from offscreen canvas
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.globalAlpha = p.opacity;
        const img = offscreenCanvases[p.colorIdx];
        if (img) {
          const scale = p.size / 16;
          ctx.drawImage(img, -16 * scale, -16 * scale, 32 * scale, 32 * scale);
        }
        ctx.restore();

        // Keep inside viewport bounds
        return p.y < H + 20 && p.x > -40 && p.x < W + 40;
      });

      raf = requestAnimationFrame(tick);
    };

    tick();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('theme-change', handleThemeChange);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed', inset: 0, zIndex: 2,
        pointerEvents: 'none', opacity: 0.5,
      }}
    />
  );
}
