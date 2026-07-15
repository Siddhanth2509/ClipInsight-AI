'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

const GLSL_PERLIN_4D = `
vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
vec4 fade(vec4 t) {return t*t*t*(t*(t*6.0-15.0)+10.0);}

float perlin4d(vec4 P){
  vec4 Pi0 = floor(P);
  vec4 Pi1 = Pi0 + 1.0;
  Pi0 = mod(Pi0, 289.0);
  Pi1 = mod(Pi1, 289.0);
  vec4 Pf0 = fract(P);
  vec4 Pf1 = Pf0 - 1.0;
  vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
  vec4 iy = vec4(Pi0.yy, Pi1.yy);
  vec4 iz0 = vec4(Pi0.zzzz);
  vec4 iz1 = vec4(Pi1.zzzz);
  vec4 iw0 = vec4(Pi0.wwww);
  vec4 iw1 = vec4(Pi1.wwww);

  vec4 ixy = permute(permute(ix) + iy);
  vec4 ixy0 = permute(ixy + iz0);
  vec4 ixy1 = permute(ixy + iz1);
  vec4 ixy00 = permute(ixy0 + iw0);
  vec4 ixy01 = permute(ixy0 + iw1);
  vec4 ixy10 = permute(ixy1 + iw0);
  vec4 ixy11 = permute(ixy1 + iw1);

  vec4 gx00 = ixy00 / 7.0;
  vec4 gy00 = floor(gx00) / 7.0;
  vec4 gz00 = floor(gy00) / 6.0;
  gx00 = fract(gx00) - 0.5;
  gy00 = fract(gy00) - 0.5;
  gz00 = fract(gz00) - 0.5;
  vec4 gw00 = vec4(0.75) - abs(gx00) - abs(gy00) - abs(gz00);
  vec4 sw00 = step(gw00, vec4(0.0));
  gx00 -= sw00 * (step(0.0, gx00) - 0.5);
  gy00 -= sw00 * (step(0.0, gy00) - 0.5);

  vec4 gx01 = ixy01 / 7.0;
  vec4 gy01 = floor(gx01) / 7.0;
  vec4 gz01 = floor(gy01) / 6.0;
  gx01 = fract(gx01) - 0.5;
  gy01 = fract(gy01) - 0.5;
  gz01 = fract(gz01) - 0.5;
  vec4 gw01 = vec4(0.75) - abs(gx01) - abs(gy01) - abs(gz01);
  vec4 sw01 = step(gw01, vec4(0.0));
  gx01 -= sw01 * (step(0.0, gx01) - 0.5);
  gy01 -= sw01 * (step(0.0, gy01) - 0.5);

  vec4 gx10 = ixy10 / 7.0;
  vec4 gy10 = floor(gx10) / 7.0;
  vec4 gz10 = floor(gy10) / 6.0;
  gx10 = fract(gx10) - 0.5;
  gy10 = fract(gy10) - 0.5;
  gz10 = fract(gz10) - 0.5;
  vec4 gw10 = vec4(0.75) - abs(gx10) - abs(gy10) - abs(gz10);
  vec4 sw10 = step(gw10, vec4(0.0));
  gx10 -= sw10 * (step(0.0, gx10) - 0.5);
  gy10 -= sw10 * (step(0.0, gy10) - 0.5);

  vec4 gx11 = ixy11 / 7.0;
  vec4 gy11 = floor(gx11) / 7.0;
  vec4 gz11 = floor(gy11) / 6.0;
  gx11 = fract(gx11) - 0.5;
  gy11 = fract(gy11) - 0.5;
  gz11 = fract(gz11) - 0.5;
  vec4 gw11 = vec4(0.75) - abs(gx11) - abs(gy11) - abs(gz11);
  vec4 sw11 = step(gw11, vec4(0.0));
  gx11 -= sw11 * (step(0.0, gx11) - 0.5);
  gy11 -= sw11 * (step(0.0, gy11) - 0.5);

  vec4 g0000 = vec4(gx00.x,gy00.x,gz00.x,gw00.x);
  vec4 g1000 = vec4(gx00.y,gy00.y,gz00.y,gw00.y);
  vec4 g0100 = vec4(gx00.z,gy00.z,gz00.z,gw00.z);
  vec4 g1100 = vec4(gx00.w,gy00.w,gz00.w,gw00.w);
  vec4 g0010 = vec4(gx10.x,gy10.x,gz10.x,gw10.x);
  vec4 g1010 = vec4(gx10.y,gy10.y,gz10.y,gw10.y);
  vec4 g0110 = vec4(gx10.z,gy10.z,gz10.z,gw10.z);
  vec4 g1110 = vec4(gx10.w,gy10.w,gz10.w,gw10.w);
  vec4 g0001 = vec4(gx01.x,gy01.x,gz01.x,gw01.x);
  vec4 g1001 = vec4(gx01.y,gy01.y,gz01.y,gw01.y);
  vec4 g0101 = vec4(gx01.z,gy01.z,gz01.z,gw01.z);
  vec4 g1101 = vec4(gx01.w,gy01.w,gz01.w,gw01.w);
  vec4 g0011 = vec4(gx11.x,gy11.x,gz11.x,gw11.x);
  vec4 g1011 = vec4(gx11.y,gy11.y,gz11.y,gw11.y);
  vec4 g0111 = vec4(gx11.z,gy11.z,gz11.z,gw11.z);
  vec4 g1111 = vec4(gx11.w,gy11.w,gz11.w,gw11.w);

  vec4 norm00 = taylorInvSqrt(vec4(dot(g0000, g0000), dot(g0100, g0100), dot(g1000, g1000), dot(g1100, g1100)));
  g0000 *= norm00.x;
  g0100 *= norm00.y;
  g1000 *= norm00.z;
  g1100 *= norm00.w;

  vec4 norm01 = taylorInvSqrt(vec4(dot(g0001, g0001), dot(g0101, g0101), dot(g1001, g1001), dot(g1101, g1101)));
  g0001 *= norm01.x;
  g0101 *= norm01.y;
  g1001 *= norm01.z;
  g1101 *= norm01.w;

  vec4 norm10 = taylorInvSqrt(vec4(dot(g0010, g0010), dot(g0110, g0110), dot(g1010, g1010), dot(g1110, g1110)));
  g0010 *= norm10.x;
  g0110 *= norm10.y;
  g1010 *= norm10.z;
  g1110 *= norm10.w;

  vec4 norm11 = taylorInvSqrt(vec4(dot(g0011, g0011), dot(g0111, g0111), dot(g1011, g1011), dot(g1111, g1111)));
  g0011 *= norm11.x;
  g0111 *= norm11.y;
  g1011 *= norm11.z;
  g1111 *= norm11.w;

  float n0000 = dot(g0000, Pf0);
  float n1000 = dot(g1000, vec4(Pf1.x, Pf0.yzw));
  float n0100 = dot(g0100, vec4(Pf0.x, Pf1.y, Pf0.zw));
  float n1100 = dot(g1100, vec4(Pf1.xy, Pf0.zw));
  float n0010 = dot(g0010, vec4(Pf0.xy, Pf1.z, Pf0.w));
  float n1010 = dot(g1010, vec4(Pf1.x, Pf0.y, Pf1.z, Pf0.w));
  float n0110 = dot(g0110, vec4(Pf0.x, Pf1.yz, Pf0.w));
  float n1110 = dot(g1110, vec4(Pf1.xyz, Pf0.w));
  float n0001 = dot(g0001, vec4(Pf0.xyz, Pf1.w));
  float n1001 = dot(g1001, vec4(Pf1.x, Pf0.yz, Pf1.w));
  float n0101 = dot(g0101, vec4(Pf0.x, Pf1.y, Pf0.z, Pf1.w));
  float n1101 = dot(g1101, vec4(Pf1.xy, Pf0.z, Pf1.w));
  float n0011 = dot(g0011, vec4(Pf0.xy, Pf1.zw));
  float n1011 = dot(g1011, vec4(Pf1.x, Pf0.y, Pf1.zw));
  float n0111 = dot(g0111, vec4(Pf0.x, Pf1.yzw));
  float n1111 = dot(g1111, Pf1);

  vec4 fade_xyzw = fade(Pf0);
  vec4 n_0w = mix(vec4(n0000, n1000, n0100, n1100), vec4(n0001, n1001, n0101, n1101), fade_xyzw.w);
  vec4 n_1w = mix(vec4(n0010, n1010, n0110, n1110), vec4(n0011, n1011, n0111, n1111), fade_xyzw.w);
  vec4 n_zw = mix(n_0w, n_1w, fade_xyzw.z);
  vec2 n_yzw = mix(n_zw.xy, n_zw.zw, fade_xyzw.y);
  float n_xyzw = mix(n_yzw.x, n_yzw.y, fade_xyzw.x);
  return 2.2 * n_xyzw;
}
`;

const THEME_GLSL_COLORS: Record<string, { color1: string; color2: string }> = {
  purple: { color1: '#7C5CFC', color2: '#3DD9FF' },
  'ocean-blue': { color1: '#0369A1', color2: '#0EA5E9' },
  'emerald-green': { color1: '#059669', color2: '#10B981' },
  'sunset-orange': { color1: '#EA580C', color2: '#F97316' },
  'royal-gold': { color1: '#B45309', color2: '#D97706' },
  'rose-pink': { color1: '#BE185D', color2: '#DB2777' },
  'ice-white': { color1: '#2563eb', color2: '#06b6d4' },
};

export default function LiquidBlobBackground() {
  const mountRef = useRef<HTMLDivElement>(null);
  const activeColorsRef = useRef({
    c1: new THREE.Color('#7C5CFC'),
    c2: new THREE.Color('#3DD9FF'),
  });

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const W = window.innerWidth;
    const H = window.innerHeight;

    // ── Renderer ──
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    // ── Scene + Camera ──
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 100);
    camera.position.set(0, 0, 8);

    // ── Lighting ──
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(5, 5, 5);
    scene.add(dirLight);

    // ── Custom Liquid Blob Mesh ──
    const geom = new THREE.SphereGeometry(1.9, 128, 128);

    // Initial colors
    const savedTheme = localStorage.getItem('clipinsight-theme') || 'purple';
    const initialColors = THEME_GLSL_COLORS[savedTheme] || THEME_GLSL_COLORS.purple;
    activeColorsRef.current.c1.set(initialColors.color1);
    activeColorsRef.current.c2.set(initialColors.color2);

    // Create shader material
    const uniforms = {
      iTime: { value: 0.0 },
      iMouse: { value: new THREE.Vector2(0, 0) },
      uColor1: { value: activeColorsRef.current.c1 },
      uColor2: { value: activeColorsRef.current.c2 },
      uScrollPercent: { value: 0.0 },
    };

    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: `
        uniform float iTime;
        uniform vec2 iMouse;
        uniform float uScrollPercent;
        varying float vDisplacement;
        varying vec3 vNormal;
        varying vec3 vPosition;

        ${GLSL_PERLIN_4D}

        void main() {
          vNormal = normal;
          vPosition = position;

          // Displace coordinates using 4D Simplex noise
          float timeScale = iTime * 0.45;
          
          // Modify displacement frequency/strength dynamically on scroll
          float freq = 1.35 + (uScrollPercent * 0.65);
          float strength = 0.35 + (uScrollPercent * 0.15);
          
          vec4 noiseCoord = vec4(position * freq, timeScale + (iMouse.x + iMouse.y) * 0.15);
          float noise = perlin4d(noiseCoord);
          
          vDisplacement = noise; // pass strength to fragment shader

          vec3 newPosition = position + normal * noise * strength;
          
          gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
        }
      `,
      fragmentShader: `
        uniform float iTime;
        uniform float uScrollPercent;
        uniform vec3 uColor1;
        uniform vec3 uColor2;
        varying float vDisplacement;
        varying vec3 vNormal;
        varying vec3 vPosition;

        void main() {
          // Normalize displacement representation
          float pulse = (vDisplacement + 1.0) * 0.5;

          // Blend coordinates and normals for high fidelity fluid color mixing
          vec3 baseColor = mix(uColor1, uColor2, pulse + vPosition.x * 0.15);
          
          // Add smooth shading highlights
          vec3 light = normalize(vec3(0.5, 1.0, 0.75));
          float d = max(dot(vNormal, light), 0.0);
          
          vec3 finalColor = baseColor * (d * 0.8 + 0.3);
          
          // Highlight edge shine
          float shine = pow(max(dot(vNormal, vec3(0.0, 0.0, 1.0)), 0.0), 3.0);
          finalColor += vec3(0.2, 0.25, 0.35) * shine * 0.5;

          // Fade out background blob entirely as we scroll past the second section (page 2)
          float alpha = 0.26 - (uScrollPercent * 0.26);
          
          gl_FragColor = vec4(finalColor, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const blobMesh = new THREE.Mesh(geom, material);
    // Align blob to the right side to stay behind content
    blobMesh.position.set(1.8, 0, 0);
    scene.add(blobMesh);

    // ── Parallax and Interaction Event Listeners ──
    let targetMouseX = 0;
    let targetMouseY = 0;
    let currentMouseX = 0;
    let currentMouseY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      targetMouseX = (e.clientX / window.innerWidth - 0.5) * 1.5;
      targetMouseY = (e.clientY / window.innerHeight - 0.5) * 1.5;
    };
    window.addEventListener('mousemove', handleMouseMove);

    // Resize Event
    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      
      // Scale position on smaller screens
      if (w < 768) {
        blobMesh.position.set(0, -1.0, 0);
        blobMesh.scale.setScalar(0.75);
      } else {
        blobMesh.position.set(1.8, 0, 0);
        blobMesh.scale.setScalar(1.0);
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize(); // run once initially

    // ── Animation Loop ──
    let time = 0;
    let animationFrameId: number;

    const render = () => {
      animationFrameId = requestAnimationFrame(render);

      time += 0.012;
      uniforms.iTime.value = time;

      // Sync theme colors dynamically on every frame to guarantee synchronization
      const activeTheme = document.documentElement.getAttribute('data-theme') || 'purple';
      const themeColors = THEME_GLSL_COLORS[activeTheme] || THEME_GLSL_COLORS.purple;
      
      const targetC1 = new THREE.Color(themeColors.color1);
      const targetC2 = new THREE.Color(themeColors.color2);
      
      uniforms.uColor1.value.lerp(targetC1, 0.08);
      uniforms.uColor2.value.lerp(targetC2, 0.08);

      // Smooth mouse tracking interpolation
      currentMouseX += (targetMouseX - currentMouseX) * 0.05;
      currentMouseY += (targetMouseY - currentMouseY) * 0.05;
      uniforms.iMouse.value.set(currentMouseX, currentMouseY);

      // Track scroll progress to translate blob canvas and fade strength
      const scrollY = parseFloat(document.documentElement.style.getPropertyValue('--scroll-y') || '0');
      const scrollPercent = parseFloat(document.documentElement.style.getPropertyValue('--scroll-percent') || '0');
      uniforms.uScrollPercent.value = scrollPercent;

      // Slide coordinates to create subtle parallax depth
      blobMesh.position.y = -scrollY * 0.0015;

      renderer.render(scene, camera);
    };
    render();

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      renderer.dispose();
      geom.dispose();
      material.dispose();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        mixBlendMode: 'screen',
      }}
    />
  );
}
