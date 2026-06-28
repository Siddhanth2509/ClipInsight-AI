'use client';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

const THEME_SCENE_COLORS: Record<string, {
  coreEmissive: number;
  coreGlow: string;
  coreDark: string;
  corona: number;
  ring1: number;
  ring2: number;
  ring3: number;
  lightCore: number;
  lightCyan: number;
  satellites: number[];
}> = {
  purple: {
    coreEmissive: 0x7b2cbf, coreGlow: '#d4a3ff', coreDark: '#3c096c', corona: 0x9d4edd,
    ring1: 0x7c5cfc, ring2: 0x3dd9ff, ring3: 0x7c5cfc,
    lightCore: 0x9d4edd, lightCyan: 0x00f0ff,
    satellites: [0xff6b6b, 0x4ecdc4, 0xffd166, 0x118ab2, 0x06d6a0, 0x8338ec]
  },
  'ocean-blue': {
    coreEmissive: 0x0055ff, coreGlow: '#80b3ff', coreDark: '#002266', corona: 0x3388ff,
    ring1: 0x007cff, ring2: 0x00d4ff, ring3: 0x007cff,
    lightCore: 0x3388ff, lightCyan: 0x00d4ff,
    satellites: [0x3a86c8, 0x00f0ff, 0x70d6ff, 0xff70a6, 0xff9f1c, 0x2ec4b6]
  },
  'emerald-green': {
    coreEmissive: 0x059669, coreGlow: '#6ee7b7', coreDark: '#064e3b', corona: 0x34d399,
    ring1: 0x10b981, ring2: 0x34d399, ring3: 0x10b981,
    lightCore: 0x34d399, lightCyan: 0x00f0ff,
    satellites: [0x52b788, 0x74c69d, 0x95d5b2, 0xd8f3dc, 0x06d6a0, 0x40916c]
  },
  'sunset-orange': {
    coreEmissive: 0xea580c, coreGlow: '#fdba74', coreDark: '#7c2d12', corona: 0xfb923c,
    ring1: 0xf97316, ring2: 0xfacc15, ring3: 0xf97316,
    lightCore: 0xfb923c, lightCyan: 0xfacc15,
    satellites: [0xff9f1c, 0xffbf69, 0xffe5d9, 0xd8e2dc, 0xffcad4, 0xf4acb7]
  },
  'royal-gold': {
    coreEmissive: 0xd97706, coreGlow: '#fde047', coreDark: '#78350f', corona: 0xfacc15,
    ring1: 0xfbbf24, ring2: 0xfef08a, ring3: 0xfbbf24,
    lightCore: 0xfacc15, lightCyan: 0xfef08a,
    satellites: [0xd4a373, 0xe9d8a6, 0xee9b00, 0xca6702, 0xbb3e03, 0xae2012]
  },
  'rose-pink': {
    coreEmissive: 0xdb2777, coreGlow: '#fbcfe8', coreDark: '#831843', corona: 0xf472b6,
    ring1: 0xec4899, ring2: 0xf472b6, ring3: 0xec4899,
    lightCore: 0xf472b6, lightCyan: 0xfbcfe8,
    satellites: [0xff70a6, 0xff97b7, 0xffb5a7, 0xfec5bb, 0xfcd5ce, 0xfae1df]
  },
  'ice-white': {
    coreEmissive: 0x3b82f6, coreGlow: '#93c5fd', coreDark: '#1d4ed8', corona: 0x60a5fa,
    ring1: 0x2563eb, ring2: 0x06b6d4, ring3: 0x2563eb,
    lightCore: 0x60a5fa, lightCyan: 0x06b6d4,
    satellites: [0x2563eb, 0x3b82f6, 0x60a5fa, 0x93c5fd, 0x06b6d4, 0x0891b2]
  }
};

export default function HeroScene() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    /* ── Scene & Camera ── */
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.set(0, 0, 7.5);

    /* ── Renderer ── */
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    mount.appendChild(renderer.domElement);

    /* ── Initial Theme configuration ── */
    const initialTheme = localStorage.getItem('clipinsight-theme') || 'purple';
    let activeCfg = THEME_SCENE_COLORS[initialTheme] || THEME_SCENE_COLORS['purple'];

    /* ── Lights ── */
    scene.add(new THREE.AmbientLight(0x0a0520, 0.5));

    const coreLight = new THREE.PointLight(activeCfg.lightCore, 15, 15);
    coreLight.position.set(0, 0, 0);
    scene.add(coreLight);

    const cyanLight = new THREE.PointLight(activeCfg.lightCyan, 8, 12);
    cyanLight.position.set(3, 2, 2);
    scene.add(cyanLight);

    /* ── Procedural Plasma Texture for Core ── */
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    const texture = new THREE.CanvasTexture(canvas);

    const updatePlasmaTexture = (time: number) => {
      const grad = ctx.createRadialGradient(128, 128, 10, 128, 128, 128);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.2, activeCfg.coreGlow);
      grad.addColorStop(0.5, activeCfg.coreGlow);
      grad.addColorStop(0.8, activeCfg.coreDark);
      grad.addColorStop(1, '#000000');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 256, 256);

      // Add cellular plasma noise ripples
      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
      for (let i = 0; i < 6; i++) {
        const angle = time * 2 + i * Math.PI / 3;
        const r = 40 + Math.sin(time * 3 + i) * 15;
        const x = 128 + Math.cos(angle) * r;
        const y = 128 + Math.sin(angle) * r;
        ctx.beginPath();
        ctx.arc(x, y, 20 + Math.sin(time + i) * 8, 0, Math.PI * 2);
        ctx.fill();
      }
      texture.needsUpdate = true;
    };

    /* ── AI Core Sphere ── */
    const coreGeo = new THREE.SphereGeometry(1.0, 64, 64);
    const coreMat = new THREE.MeshStandardMaterial({
      map: texture,
      emissive: activeCfg.coreEmissive,
      emissiveIntensity: 2.2,
      roughness: 0.1,
      metalness: 0.9,
      transparent: true,
      opacity: 0.95,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    scene.add(coreMesh);

    // Inner glowing sphere for intense core center
    const innerCoreGeo = new THREE.SphereGeometry(0.75, 32, 32);
    const innerCoreMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
    });
    const innerCore = new THREE.Mesh(innerCoreGeo, innerCoreMat);
    scene.add(innerCore);

    // Outer plasma corona shield
    const coronaGeo = new THREE.SphereGeometry(1.3, 32, 32);
    const coronaMat = new THREE.MeshBasicMaterial({
      color: activeCfg.corona,
      transparent: true,
      opacity: 0.08,
      side: THREE.BackSide,
    });
    const coronaMesh = new THREE.Mesh(coronaGeo, coronaMat);
    scene.add(coronaMesh);

    /* ── 3D Grid Wireframe Torus Rings ── */
    const ringData = [
      { r: 2.3, tube: 0.12, radSegs: 8, tubSegs: 64, tiltX: 0.4, tiltZ: 0.3, speed: 0.005, opacity: 0.35 },
      { r: 2.9, tube: 0.10, radSegs: 8, tubSegs: 64, tiltX: 1.0, tiltZ: 0.5, speed: -0.004, opacity: 0.30 },
      { r: 3.5, tube: 0.08, radSegs: 6, tubSegs: 64, tiltX: 1.4, tiltZ: -0.2, speed: 0.003, opacity: 0.25 },
    ];
    const ringMeshes: THREE.Mesh[] = [];

    ringData.forEach((d, idx) => {
      const geo = new THREE.TorusGeometry(d.r, d.tube, d.radSegs, d.tubSegs);
      const ringColor = idx === 0 ? activeCfg.ring1 : idx === 1 ? activeCfg.ring2 : activeCfg.ring3;
      const mat = new THREE.MeshBasicMaterial({
        color: ringColor,
        wireframe: true,
        transparent: true,
        opacity: d.opacity,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = d.tiltX;
      mesh.rotation.z = d.tiltZ;
      (mesh as any)._speed = d.speed;
      scene.add(mesh);
      ringMeshes.push(mesh);
    });

    /* ── Satellite Nodes ── */
    const satData = [
      { ringIdx: 0, angle: 0, size: 0.09 },
      { ringIdx: 0, angle: Math.PI, size: 0.08 },
      { ringIdx: 1, angle: Math.PI * 0.5, size: 0.09 },
      { ringIdx: 1, angle: Math.PI * 1.5, size: 0.08 },
      { ringIdx: 2, angle: Math.PI * 0.3, size: 0.08 },
      { ringIdx: 2, angle: Math.PI * 1.3, size: 0.07 },
    ];
    const satGroups: { group: THREE.Group; ringIdx: number; angle: number; color: number }[] = [];

    satData.forEach((d, idx) => {
      const group = new THREE.Group();
      const sColor = activeCfg.satellites[idx % activeCfg.satellites.length];
      
      // Node core
      const coreGeo = new THREE.SphereGeometry(d.size, 16, 16);
      const coreMat = new THREE.MeshBasicMaterial({ color: sColor });
      const core = new THREE.Mesh(coreGeo, coreMat);
      group.add(core);

      // Soft glow aura shell
      const auraGeo = new THREE.SphereGeometry(d.size * 2.5, 16, 16);
      const auraMat = new THREE.MeshBasicMaterial({
        color: sColor,
        transparent: true,
        opacity: 0.25,
        blending: THREE.AdditiveBlending,
      });
      const aura = new THREE.Mesh(auraGeo, auraMat);
      group.add(aura);

      scene.add(group);
      satGroups.push({ group, ringIdx: d.ringIdx, angle: d.angle, color: sColor });
    });

    /* ── Neural Thread Lines ── */
    const threads: { line: THREE.Line; sat: typeof satGroups[0] }[] = [];
    satGroups.forEach(s => {
      const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
      const mat = new THREE.LineBasicMaterial({
        color: s.color,
        transparent: true,
        opacity: 0.25,
        blending: THREE.AdditiveBlending,
      });
      const line = new THREE.Line(geo, mat);
      scene.add(line);
      threads.push({ line, sat: s });
    });

    /* ── Moving Data Packets (Pulsing Lights along Threads) ── */
    const packets: { mesh: THREE.Mesh; sat: typeof satGroups[0]; progress: number; speed: number }[] = [];
    satGroups.forEach(s => {
      for (let j = 0; j < 2; j++) {
        const pGeo = new THREE.SphereGeometry(0.04, 8, 8);
        const pMat = new THREE.MeshBasicMaterial({
          color: s.color,
          transparent: true,
          opacity: 0.8,
          blending: THREE.AdditiveBlending,
        });
        const mesh = new THREE.Mesh(pGeo, pMat);
        scene.add(mesh);
        packets.push({
          mesh,
          sat: s,
          progress: Math.random(),
          speed: 0.008 + Math.random() * 0.008,
        });
      }
    });

    /* ── Background Particles (twinkling starfield) ── */
    const pCount = 250;
    const pPos = new Float32Array(pCount * 3);
    const pColor = new Float32Array(pCount * 3);
    const colors = [new THREE.Color(0x7c5cfc), new THREE.Color(0x00f0ff), new THREE.Color(0xffffff)];

    for (let i = 0; i < pCount; i++) {
      pPos[i * 3] = (Math.random() - 0.5) * 22;
      pPos[i * 3 + 1] = (Math.random() - 0.5) * 22;
      pPos[i * 3 + 2] = (Math.random() - 0.5) * 12 - 4;

      const col = colors[Math.floor(Math.random() * colors.length)];
      pColor[i * 3] = col.r;
      pColor[i * 3 + 1] = col.g;
      pColor[i * 3 + 2] = col.b;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    pGeo.setAttribute('color', new THREE.BufferAttribute(pColor, 3));
    
    const pMat = new THREE.PointsMaterial({
      size: 0.05,
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
    });
    const starField = new THREE.Points(pGeo, pMat);
    scene.add(starField);

    /* ── Resize Handling ── */
    const resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        if (width === 0 || height === 0) continue;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
      }
    });
    resizeObserver.observe(mount);

    /* ── Visibility Handling ── */
    let isInView = true;
    const intersectionObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        isInView = entry.isIntersecting;
      });
    }, { threshold: 0.05 });
    intersectionObserver.observe(mount);

    /* ── Mouse Parallax ── */
    let targetX = 0, targetY = 0, currentX = 0, currentY = 0;
    const onMouse = (e: MouseEvent) => {
      targetX = (e.clientX / window.innerWidth - 0.5) * 0.45;
      targetY = (e.clientY / window.innerHeight - 0.5) * 0.3;
    };
    window.addEventListener('mousemove', onMouse);

    /* ── Animation Loop ── */
    let time = 0;
    let raf: number;

    const animate = () => {
      raf = requestAnimationFrame(animate);
      if (!isInView) return; // skip rendering entirely when offscreen
      time += 0.01;

      // Update cellular plasma texture
      updatePlasmaTexture(time);

      // Smooth mouse parallax
      currentX += (targetX - currentX) * 0.05;
      currentY += (targetY - currentY) * 0.05;
      scene.rotation.y = currentX;
      scene.rotation.x = currentY;

      // Core rotate & breathe
      coreMesh.rotation.y += 0.003;
      coreMesh.rotation.x += 0.001;
      const breathe = 1.0 + Math.sin(time * 0.7) * 0.05;
      coreMesh.scale.setScalar(breathe);
      innerCore.scale.setScalar(breathe);
      innerCoreMat.opacity = 0.7 + Math.sin(time * 3) * 0.2; // pulse center glow
      coronaMesh.scale.setScalar(breathe * 1.08);

      // Rotate torus wireframes
      ringMeshes.forEach(r => {
        r.rotation.y += (r as any)._speed;
        r.rotation.x += (r as any)._speed * 0.3;
      });

      // Update satellite node positions along their respective torus rings
      satGroups.forEach((s, idx) => {
        const ring = ringMeshes[s.ringIdx];
        const data = ringData[s.ringIdx];
        
        // Calculate orbit step
        s.angle += Math.abs(data.speed) * 0.8;
        
        const localPos = new THREE.Vector3(
          Math.cos(s.angle) * data.r,
          Math.sin(s.angle) * data.r * 0.45,
          0
        );
        localPos.applyEuler(ring.rotation);
        s.group.position.copy(localPos);

        // Soft aura breathing glow
        s.group.children[1].scale.setScalar(2.0 + Math.sin(time * 4 + idx) * 0.4);
      });

      // Update neural thread connections
      threads.forEach(({ line, sat }) => {
        const pos = line.geometry.attributes.position as THREE.BufferAttribute;
        pos.setXYZ(0, sat.group.position.x, sat.group.position.y, sat.group.position.z);
        pos.setXYZ(1, 0, 0, 0); // connect directly to the center core
        pos.needsUpdate = true;
        
        // Pulse thread opacity
        (line.material as THREE.LineBasicMaterial).opacity = 0.15 + Math.abs(Math.sin(time * 2 + sat.angle)) * 0.4;
      });

      // Update data packets traveling along threads
      packets.forEach(p => {
        p.progress += p.speed;
        if (p.progress >= 1.0) {
          p.progress = 0;
          p.speed = 0.008 + Math.random() * 0.008; // randomize speed on reset
        }

        // Interpolate position from satellite to core (0,0,0)
        const satPos = p.sat.group.position;
        const packetPos = new THREE.Vector3().lerpVectors(satPos, new THREE.Vector3(0,0,0), p.progress);
        p.mesh.position.copy(packetPos);

        // Fade out packet as it gets close to the core
        (p.mesh.material as THREE.MeshBasicMaterial).opacity = (1.0 - p.progress) * 0.9;
        // Make it scale slightly as it moves
        p.mesh.scale.setScalar(0.7 + (1.0 - p.progress) * 0.6);
      });

      // Animate background starfield twinkle
      const starAttr = starField.geometry.attributes.position as THREE.BufferAttribute;
      const count = starAttr.count;
      for (let i = 0; i < count; i++) {
        if (i % 5 === 0) {
          pPos[i * 3 + 2] += Math.sin(time + i) * 0.002; // soft forward drift
        }
      }
      starAttr.needsUpdate = true;

      // Animate lights intensity
      coreLight.intensity = 15 + Math.sin(time * 2.5) * 5;

      renderer.render(scene, camera);
    };
    const handleThemeChange = (e: Event) => {
      const themeKey = (e as CustomEvent).detail;
      activeCfg = THEME_SCENE_COLORS[themeKey] || THEME_SCENE_COLORS['purple'];

      // Update lights
      coreLight.color.setHex(activeCfg.lightCore);
      cyanLight.color.setHex(activeCfg.lightCyan);

      // Update core emissive & corona color
      coreMat.emissive.setHex(activeCfg.coreEmissive);
      coronaMat.color.setHex(activeCfg.corona);

      // Update rings colors
      ringMeshes.forEach((mesh, idx) => {
        const ringColor = idx === 0 ? activeCfg.ring1 : idx === 1 ? activeCfg.ring2 : activeCfg.ring3;
        (mesh.material as THREE.MeshBasicMaterial).color.setHex(ringColor);
      });

      // Update satellites & lines & packets
      satGroups.forEach((sat, idx) => {
        const sColor = activeCfg.satellites[idx % activeCfg.satellites.length];
        (sat.group.children[0].material as THREE.MeshBasicMaterial).color.setHex(sColor);
        (sat.group.children[1].material as THREE.MeshBasicMaterial).color.setHex(sColor);
        sat.color = sColor;
      });

      threads.forEach((t, idx) => {
        const sColor = activeCfg.satellites[idx % activeCfg.satellites.length];
        (t.line.material as THREE.LineBasicMaterial).color.setHex(sColor);
      });

      packets.forEach(p => {
        const sColor = p.sat.color;
        (p.mesh.material as THREE.MeshBasicMaterial).color.setHex(sColor);
      });
    };
    window.addEventListener('theme-change', handleThemeChange);

    animate();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMouse);
      window.removeEventListener('theme-change', handleThemeChange);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      mount.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none' }}
    />
  );
}
