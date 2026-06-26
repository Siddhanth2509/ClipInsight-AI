'use client';
import { useEffect, useRef } from 'react';

/* ═══════════════════════════════════════════════════════════════════════════
   SakuraScene — Cinematic Three.js background
   ─────────────────────────────────────────────────────────────────────────
   Mouse-reactive animation:
   • When mouse moves → animation kicks in at full speed/opacity (smoothly)
   • When mouse is idle for 25 seconds → animation fades to near-zero gently
   • Transition is always gradual (eased), never a hard cut
   ═══════════════════════════════════════════════════════════════════════════ */

export default function SakuraScene() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let frameId: number;
    let renderer: any, scene: any, camera: any;
    let petalSystem: any, lanterns: any[] = [], torii: any;
    let gsapCtx: any;

    const init = async () => {
      const THREE = await import('three');
      const { gsap } = await import('gsap');
      const { ScrollTrigger } = await import('gsap/ScrollTrigger');
      gsap.registerPlugin(ScrollTrigger);

      const mount = mountRef.current;
      if (!mount) return;

      const W = window.innerWidth, H = window.innerHeight;

      // ── Renderer ──────────────────────────────────────────────────────────
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(W, H);
      renderer.setClearColor(0x000000, 0);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.2;
      mount.appendChild(renderer.domElement);

      // ── Scene + Camera ────────────────────────────────────────────────────
      scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(0x0E0820, 0.0028);

      camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 1000);
      camera.position.set(0, 0, 90);

      // ── Ambient Light ──────────────────────────────────────────────────────
      const ambLight = new THREE.AmbientLight(0xffb7c5, 0.4);
      scene.add(ambLight);
      const pointLight1 = new THREE.PointLight(0xff85a2, 2.5, 200);
      pointLight1.position.set(30, 40, 10);
      scene.add(pointLight1);
      const pointLight2 = new THREE.PointLight(0xc9a96e, 1.5, 150);
      pointLight2.position.set(-40, -20, -20);
      scene.add(pointLight2);

      // ── 1. SAKURA PETAL PARTICLE SYSTEM ───────────────────────────────────
      const PETAL_COUNT = 8000;
      const positions  = new Float32Array(PETAL_COUNT * 3);
      const velocities = new Float32Array(PETAL_COUNT * 3);
      const rotations  = new Float32Array(PETAL_COUNT);
      const sizes      = new Float32Array(PETAL_COUNT);
      const opacities  = new Float32Array(PETAL_COUNT);

      const colorOptions = [
        new THREE.Color('#FFB7C5'),
        new THREE.Color('#FF85A2'),
        new THREE.Color('#FFE4EE'),
        new THREE.Color('#E8557A'),
        new THREE.Color('#FFC0CB'),
      ];
      const colors = new Float32Array(PETAL_COUNT * 3);

      for (let i = 0; i < PETAL_COUNT; i++) {
        const i3 = i * 3;
        positions[i3]     = (Math.random() - 0.5) * 300;
        positions[i3 + 1] = (Math.random() - 0.5) * 200 + 40;
        positions[i3 + 2] = (Math.random() - 0.5) * 200;

        velocities[i3]     = (Math.random() - 0.5) * 0.06;
        velocities[i3 + 1] = -(Math.random() * 0.08 + 0.04);
        velocities[i3 + 2] = (Math.random() - 0.5) * 0.04;

        rotations[i] = Math.random() * Math.PI * 2;
        sizes[i]     = Math.random() * 3.5 + 1.0;
        opacities[i] = Math.random() * 0.7 + 0.3;

        const c = colorOptions[Math.floor(Math.random() * colorOptions.length)];
        colors[i3]     = c.r;
        colors[i3 + 1] = c.g;
        colors[i3 + 2] = c.b;
      }

      const petalGeo = new THREE.BufferGeometry();
      petalGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      petalGeo.setAttribute('color',    new THREE.BufferAttribute(colors, 3));
      petalGeo.setAttribute('size',     new THREE.BufferAttribute(sizes, 1));

      // Custom petal-shaped point texture via canvas
      const petalCanvas = document.createElement('canvas');
      petalCanvas.width = petalCanvas.height = 64;
      const pCtx = petalCanvas.getContext('2d')!;
      const grad = pCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0,   'rgba(255,183,197,1)');
      grad.addColorStop(0.4, 'rgba(255,133,162,0.8)');
      grad.addColorStop(0.8, 'rgba(232, 85,122,0.3)');
      grad.addColorStop(1,   'rgba(255,183,197,0)');
      pCtx.beginPath();
      pCtx.ellipse(32, 28, 18, 30, -0.3, 0, Math.PI * 2);
      pCtx.fillStyle = grad;
      pCtx.fill();
      const petalTex = new THREE.CanvasTexture(petalCanvas);

      const petalMat = new THREE.PointsMaterial({
        size: 1.2,
        map: petalTex,
        vertexColors: true,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
      });

      petalSystem = new THREE.Points(petalGeo, petalMat);
      scene.add(petalSystem);

      // ── 2. GLOWING LANTERN ORBS ───────────────────────────────────────────
      const lanternData = [
        { pos: [35, 20, -30], color: '#C9A96E', r: 3.5, intensity: 1.8 },
        { pos: [-45, 10, -50], color: '#E8A070', r: 2.8, intensity: 1.4 },
        { pos: [10, -15, -40], color: '#FFB7C5', r: 4,   intensity: 2.0 },
        { pos: [-20, 30, -20], color: '#C9A96E', r: 2.2, intensity: 1.2 },
      ];

      lanternData.forEach(l => {
        const coreGeo = new THREE.SphereGeometry(l.r, 16, 16);
        const coreMat = new THREE.MeshBasicMaterial({
          color: l.color, transparent: true, opacity: 0.9,
          blending: THREE.AdditiveBlending, depthWrite: false,
        });
        const core = new THREE.Mesh(coreGeo, coreMat);
        core.position.set(...l.pos as [number,number,number]);

        const haloGeo = new THREE.SphereGeometry(l.r * 3.5, 16, 16);
        const haloMat = new THREE.MeshBasicMaterial({
          color: l.color, transparent: true, opacity: 0.06,
          blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide,
        });
        const halo = new THREE.Mesh(haloGeo, haloMat);
        halo.position.set(...l.pos as [number,number,number]);

        const pLight = new THREE.PointLight(l.color, l.intensity, 80);
        pLight.position.set(...l.pos as [number,number,number]);

        scene.add(core, halo, pLight);
        lanterns.push({ core, halo, light: pLight, origPos: [...l.pos] });
      });

      // ── 3. TORII GATE WIREFRAME ───────────────────────────────────────────
      const toriiGroup = new THREE.Group();
      const wireMat = new THREE.LineBasicMaterial({
        color: '#E8557A', transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending,
      });
      const createWireBox = (w: number, h: number, d: number, x: number, y: number, z: number) => {
        const geo = new THREE.BoxGeometry(w, h, d);
        const edges = new THREE.EdgesGeometry(geo);
        const line = new THREE.LineSegments(edges, wireMat);
        line.position.set(x, y, z);
        toriiGroup.add(line);
      };
      createWireBox(3, 50, 3,  -22, -5, -80);
      createWireBox(3, 50, 3,   22, -5, -80);
      createWireBox(55, 4, 4,    0, 22, -80);
      createWireBox(62, 3, 3,    0, 17, -80);
      scene.add(toriiGroup);

      // ── 4. BACKGROUND STAR FIELD ──────────────────────────────────────────
      const starCount = 600;
      const starPos = new Float32Array(starCount * 3);
      for (let i = 0; i < starCount * 3; i++) {
        starPos[i] = (Math.random() - 0.5) * 500;
      }
      const starGeo = new THREE.BufferGeometry();
      starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
      const starMat = new THREE.PointsMaterial({
        size: 0.4, color: '#FAF0F5', transparent: true, opacity: 0.3,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      scene.add(new THREE.Points(starGeo, starMat));

      // ── Mouse Parallax + Activity Tracking ────────────────────────────────
      //
      //  animActivity:    0.0 = fully dormant, 1.0 = fully alive
      //  targetActivity:  what we're easing toward
      //  idleTimer:       setTimeout handle — starts countdown on last move
      //
      //  Behaviour:
      //  • On page load    → start at gentle ambient activity (0.35) for 25s
      //  • On mouse move   → targetActivity = 1.0, restart 25s idle countdown
      //  • After 25s idle  → targetActivity = 0.18 (gentle ambient, not off)
      //  • Every frame     → animActivity lerps toward targetActivity
      //    (smooth ~80 frames ≈ 1.3s at 60fps to fully transition)
      //
      const mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
      // Start with a comfortable ambient level so petals always drift softly
      let animActivity   = 0.35;  // current eased value — starts visible
      let targetActivity = 0.35;  // gentle ambient on page load
      let idleTimerRef: ReturnType<typeof setTimeout> | null = null;

      const IDLE_TIMEOUT_MS = 25000; // 25 seconds before fading to ambient
      const IDLE_AMBIENT    = 0.18;  // minimum "alive" activity when idle

      const startIdleCountdown = () => {
        if (idleTimerRef) clearTimeout(idleTimerRef);
        idleTimerRef = setTimeout(() => {
          // Fade to gentle ambient after 25s of no mouse movement
          targetActivity = IDLE_AMBIENT;
        }, IDLE_TIMEOUT_MS);
      };

      const onMouseMove = (e: MouseEvent) => {
        mouse.targetX = (e.clientX / window.innerWidth - 0.5) * 2;
        mouse.targetY = -(e.clientY / window.innerHeight - 0.5) * 2;

        // Fully wake animation on every mouse move
        targetActivity = 1.0;
        startIdleCountdown(); // restart the 25s countdown
      };

      window.addEventListener('mousemove', onMouseMove);

      // Start the idle countdown immediately so ambient state kicks in after 25s
      // without any user interaction.
      startIdleCountdown();

      // ── GSAP Scroll ───────────────────────────────────────────────────────
      const scrollState = { progress: 0, speed: 1 };
      gsapCtx = gsap.context(() => {
        gsap.to(scrollState, {
          progress: 1,
          speed: 2.5,
          scrollTrigger: {
            trigger: document.body,
            start: 'top top',
            end: 'bottom bottom',
            scrub: 1.5,
          },
        });
        gsap.to(camera.position, {
          y: -20,
          scrollTrigger: {
            trigger: document.body,
            start: 'top top',
            end: 'bottom bottom',
            scrub: 2,
          },
        });
      });

      // ── Resize Handler ─────────────────────────────────────────────────────
      const onResize = () => {
        const W = window.innerWidth, H = window.innerHeight;
        camera.aspect = W / H;
        camera.updateProjectionMatrix();
        renderer.setSize(W, H);
      };
      window.addEventListener('resize', onResize);

      // ── Animation Loop ─────────────────────────────────────────────────────
      let t = 0;
      // Smooth camera state — separate from mouse to prevent jitter
      let camX = 0, camY = 0;
      const posAttr = petalGeo.getAttribute('position') as import('three').BufferAttribute;

      const animate = () => {
        frameId = requestAnimationFrame(animate);

        // ── Ease animActivity toward targetActivity ────────────────────────
        // 0.015 lerp = ~80 frames to fully transition (≈1.3s at 60fps)
        // This is intentionally slower than before for silky transitions.
        animActivity += (targetActivity - animActivity) * 0.015;

        // Always render, even when nearly dormant — prevents black flash
        // Only skip heavy petal updates when truly near-zero
        if (animActivity < 0.01) {
          renderer.render(scene, camera);
          return;
        }

        // Time advances proportionally to activity — feels natural
        t += 0.006 * (animActivity * 0.7 + 0.3); // always ticks, just slower

        // ── Smooth camera (anti-jitter) ──────────────────────────────────
        // Use separate smoothed camX/Y — avoids the "judder" of directly
        // applying mouse delta to camera position each frame.
        const targetCamX = mouse.x * 12;
        const targetCamY = mouse.y * 8;
        camX += (targetCamX - camX) * 0.03; // very smooth — 0.03 = ~30 frames lag
        camY += (targetCamY - camY) * 0.03;

        // Smooth mouse cursor position (parallax target)
        mouse.x += (mouse.targetX - mouse.x) * 0.04;
        mouse.y += (mouse.targetY - mouse.y) * 0.04;

        camera.position.x = camX;
        camera.position.y = camY;
        camera.lookAt(0, 0, 0);

        // ── Update petal positions ────────────────────────────────────────
        // Petals always drift gently even at ambient activity
        const speed = scrollState.speed * Math.max(animActivity, 0.15);
        const posArray = posAttr.array as Float32Array;
        for (let i = 0; i < PETAL_COUNT; i++) {
          const i3 = i * 3;
          // Gentle horizontal drift with sine wave — no jitter
          posArray[i3]     += (velocities[i3]     + Math.sin(t * 0.4 + i * 0.009) * 0.012) * Math.max(animActivity, 0.12);
          posArray[i3 + 1] += velocities[i3 + 1] * speed;
          posArray[i3 + 2] += velocities[i3 + 2] * Math.max(animActivity, 0.1);

          // Recycle petals that fall below the scene
          if (posArray[i3 + 1] < -100) {
            posArray[i3 + 1] = 100;
            posArray[i3]     = (Math.random() - 0.5) * 300;
          }
        }
        posAttr.needsUpdate = true;

        // ── Petal opacity — scales with activity but always slightly visible
        petalMat.opacity = 0.12 + 0.73 * animActivity;

        // ── Drift lanterns smoothly ────────────────────────────────────────
        lanterns.forEach((l, i) => {
          l.core.position.x = l.origPos[0] + Math.sin(t * 0.25 + i) * 4;
          l.core.position.y = l.origPos[1] + Math.cos(t * 0.2  + i * 1.3) * 3;
          l.halo.position.copy(l.core.position);
          l.light.position.copy(l.core.position);
          // Light intensity always has a minimum glow — no hard flicker
          l.light.intensity = (0.3 + 1.2 * animActivity) + Math.sin(t * 0.7 + i) * 0.2 * animActivity;
        });

        // ── Torii slow rotation ────────────────────────────────────────────
        toriiGroup.rotation.y = Math.sin(t * 0.06) * 0.018;

        renderer.render(scene, camera);
      };
      animate();

      return () => {
        if (idleTimerRef) clearTimeout(idleTimerRef);
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('resize', onResize);
      };
    };

    const cleanupPromise = init();

    return () => {
      cancelAnimationFrame(frameId);
      if (gsapCtx) gsapCtx.revert();
      cleanupPromise.then(fn => fn && fn());
      if (renderer) {
        renderer.dispose();
        mountRef.current?.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={mountRef}
      style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}
    />
  );
}
