'use client';
import { useEffect, useRef } from 'react';

export default function MagneticCursor() {
  const dotRef  = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dot  = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    let raf: number;
    let mx = -300, my = -300;
    let dx = -300, dy = -300;
    let rx = -300, ry = -300;
    let clicking = false;
    let hovering = false;

    const onMove = (e: MouseEvent) => { mx = e.clientX; my = e.clientY; };
    const onDown = () => { clicking = true; dot.style.transform = 'translate(-50%,-50%) scale(0.6)'; ring.style.transform = 'translate(-50%,-50%) scale(0.85)'; };
    const onUp   = () => { clicking = false; dot.style.transform = 'translate(-50%,-50%) scale(1)'; };

    const onEnter = (e: Event) => {
      const t = e.target as HTMLElement;
      if (t.closest('button,a,input,[data-cursor]')) {
        hovering = true;
        ring.style.width  = '52px'; ring.style.height = '52px';
        ring.style.borderColor = 'rgba(124,92,252,0.8)';
        ring.style.boxShadow = '0 0 16px rgba(124,92,252,0.4), inset 0 0 8px rgba(124,92,252,0.1)';
        dot.style.background  = 'linear-gradient(135deg,#7C5CFC,#3DD9FF)';
        dot.style.boxShadow   = '0 0 16px rgba(124,92,252,0.9)';
      }
    };
    const onLeave = (e: Event) => {
      const t = e.target as HTMLElement;
      if (t.closest('button,a,input,[data-cursor]')) {
        hovering = false;
        ring.style.width  = '32px'; ring.style.height = '32px';
        ring.style.borderColor = 'rgba(124,92,252,0.45)';
        ring.style.boxShadow = 'none';
        dot.style.background  = '#fff';
        dot.style.boxShadow   = '0 0 8px rgba(255,255,255,0.7)';
      }
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mousedown', onDown);
    window.addEventListener('mouseup',   onUp);
    document.addEventListener('mouseover',  onEnter, true);
    document.addEventListener('mouseout',   onLeave, true);

    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const loop = () => {
      dx = lerp(dx, mx, 0.92); dy = lerp(dy, my, 0.92);
      rx = lerp(rx, mx, 0.12); ry = lerp(ry, my, 0.12);
      dot.style.left  = `${dx}px`; dot.style.top  = `${dy}px`;
      ring.style.left = `${rx}px`; ring.style.top = `${ry}px`;
      raf = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('mouseup',   onUp);
      document.removeEventListener('mouseover',  onEnter, true);
      document.removeEventListener('mouseout',   onLeave, true);
    };
  }, []);

  return (
    <>
      <style>{`* { cursor: none !important; }`}</style>
      <div ref={dotRef} style={{
        position:'fixed', width:8, height:8, borderRadius:'50%',
        background:'#fff', pointerEvents:'none', zIndex:99999,
        transform:'translate(-50%,-50%)', top:0, left:0,
        boxShadow:'0 0 8px rgba(255,255,255,0.7)',
        transition:'background 0.2s, box-shadow 0.2s, width 0.15s, height 0.15s',
        willChange:'left,top,transform',
      }} />
      <div ref={ringRef} style={{
        position:'fixed', width:32, height:32, borderRadius:'50%',
        border:'1.5px solid rgba(124,92,252,0.45)',
        pointerEvents:'none', zIndex:99998,
        transform:'translate(-50%,-50%)', top:0, left:0,
        transition:'width 0.3s, height 0.3s, border-color 0.3s, box-shadow 0.3s',
        willChange:'left,top',
      }} />
    </>
  );
}
