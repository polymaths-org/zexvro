import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { motion, MotionValue, useTransform } from 'motion/react';

interface GlassCube3DProps {
  size?: number;
  className?: string;
  mouseX: MotionValue<number>;
  mouseY: MotionValue<number>;
  isPrism?: boolean;
  spinSpeed?: number;
  float?: boolean;
  floatDelay?: number;
}

const PRISM_VERT = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying vec3 vViewDir;
  varying vec3 vLocalPos;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    vLocalPos = position;
    vViewDir = normalize(cameraPosition - worldPos.xyz);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const PRISM_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uIntensity;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying vec3 vViewDir;
  varying vec3 vLocalPos;

  // Spectral rainbow from wavelength-ish t in [0,1]
  vec3 spectrum(float t) {
    t = fract(t);
    return 0.5 + 0.5 * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67)));
  }

  void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(vViewDir);

    float fresnel = pow(1.0 - max(dot(N, V), 0.0), 2.8);
    float fresnelHard = pow(1.0 - max(dot(N, V), 0.0), 5.0);

    // View-dependent chromatic dispersion (R/G/B offset along normal)
    float disp = 0.22 + 0.08 * sin(uTime * 0.7);
    float nR = fresnel + disp * 0.55;
    float nG = fresnel;
    float nB = fresnel - disp * 0.45;

    // Animated iridescent film interference
    float phase = dot(N, V) * 4.5 + uTime * 0.45 + vLocalPos.x * 1.2 + vLocalPos.y * 0.8;
    vec3 irid = spectrum(phase * 0.12);
    vec3 irid2 = spectrum(phase * 0.12 + 0.35 + sin(uTime * 0.3) * 0.08);

    // Face-edge prism sparkle via local coords
    vec3 absLocal = abs(vLocalPos);
    float edge = 1.0 - smoothstep(0.72, 0.92, max(absLocal.x, max(absLocal.y, absLocal.z)));
    float edgeSharp = pow(1.0 - edge, 3.5);

    // Rotating caustic-like bands
    float band = sin(vLocalPos.x * 6.0 + vLocalPos.y * 4.0 - uTime * 1.4)
               * cos(vLocalPos.z * 5.0 + uTime * 0.9);
    band = smoothstep(0.2, 0.95, band * 0.5 + 0.5);

    vec3 prismCore = mix(irid, irid2, 0.5 + 0.5 * sin(uTime * 0.5));
    prismCore *= uIntensity;

    // Chromatic fresnel rim
    vec3 chromaRim = vec3(
      clamp(nR + 0.15, 0.0, 1.5),
      clamp(nG, 0.0, 1.2),
      clamp(nB + 0.2, 0.0, 1.5)
    ) * prismCore;

    // Specular-like hot spots
    vec3 L1 = normalize(vec3(sin(uTime * 0.6), 0.8, cos(uTime * 0.6)));
    vec3 L2 = normalize(vec3(-cos(uTime * 0.4), -0.3, sin(uTime * 0.5)));
    float spec1 = pow(max(dot(reflect(-L1, N), V), 0.0), 48.0);
    float spec2 = pow(max(dot(reflect(-L2, N), V), 0.0), 24.0);
    vec3 highlight = spectrum(uTime * 0.08 + spec1) * spec1 * 1.6
                   + spectrum(0.4 + uTime * 0.05) * spec2 * 0.9;

    // Glass body — mostly transparent with cool tint
    vec3 glassBody = vec3(0.55, 0.72, 1.0) * 0.08
                   + prismCore * 0.18 * (0.35 + fresnel)
                   + prismCore * band * 0.35
                   + chromaRim * 0.85
                   + highlight
                   + edgeSharp * spectrum(uTime * 0.1 + fresnel) * 0.55;

    float alpha = 0.12 + fresnel * 0.55 + fresnelHard * 0.25 + edgeSharp * 0.35 + band * 0.12;
    alpha = clamp(alpha, 0.08, 0.92);

    // Soft bloom lift on edges
    glassBody += fresnelHard * vec3(0.9, 0.95, 1.0) * 0.35;

    gl_FragColor = vec4(glassBody, alpha);
  }
`;

const EDGE_VERT = /* glsl */ `
  varying float vAlong;
  void main() {
    vAlong = position.x + position.y + position.z;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const EDGE_FRAG = /* glsl */ `
  uniform float uTime;
  varying float vAlong;

  vec3 spectrum(float t) {
    return 0.5 + 0.5 * cos(6.28318 * (fract(t) + vec3(0.0, 0.33, 0.67)));
  }

  void main() {
    vec3 c = spectrum(vAlong * 0.15 + uTime * 0.18);
    float pulse = 0.55 + 0.45 * sin(uTime * 2.0 + vAlong * 2.5);
    gl_FragColor = vec4(c * 1.4, 0.55 * pulse);
  }
`;

export const GlassCube3D: React.FC<GlassCube3DProps> = ({
  size = 120,
  className = '',
  mouseX,
  mouseY,
  isPrism = true,
  spinSpeed = 1,
  float = false,
  floatDelay = 0,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const parallaxX = useTransform(mouseX, [-0.5, 0.5], [-size * 0.1, size * 0.1]);
  const parallaxY = useTransform(mouseY, [-0.5, 0.5], [-size * 0.1, size * 0.1]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
    camera.position.z = 3.8;

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(size, size);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    const canvas = renderer.domElement;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    canvas.style.pointerEvents = 'none';
    canvas.style.display = 'block';
    mount.appendChild(canvas);

    const geometry = new THREE.BoxGeometry(1.55, 1.55, 1.55, 1, 1, 1);

    // Outer prism glass (custom spectral shader)
    const prismUniforms = {
      uTime: { value: 0 },
      uIntensity: { value: isPrism ? 1.15 : 0.7 },
    };

    const prismMat = new THREE.ShaderMaterial({
      vertexShader: PRISM_VERT,
      fragmentShader: PRISM_FRAG,
      uniforms: prismUniforms,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });

    const cube = new THREE.Mesh(geometry, prismMat);
    scene.add(cube);

    // Spectral wireframe edges
    const edgesGeo = new THREE.EdgesGeometry(geometry, 20);
    const edgeMat = new THREE.ShaderMaterial({
      vertexShader: EDGE_VERT,
      fragmentShader: EDGE_FRAG,
      uniforms: { uTime: prismUniforms.uTime },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const edges = new THREE.LineSegments(edgesGeo, edgeMat);
    cube.add(edges);

    scene.add(new THREE.AmbientLight(0xffffff, 0.35));
    const key = new THREE.DirectionalLight(0xffffff, 1.2);
    key.position.set(3, 4, 5);
    scene.add(key);

    const cyan = new THREE.PointLight(0x22d3ee, 3.5, 12);
    cyan.position.set(-2.2, 1.5, 2);
    scene.add(cyan);

    const pink = new THREE.PointLight(0xec4899, 3.5, 12);
    pink.position.set(2.2, -1.3, -2);
    scene.add(pink);

    let angle = Math.random() * Math.PI * 2;
    let frame = 0;
    let raf = 0;
    const clock = new THREE.Clock();

    const animate = () => {
      raf = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      prismUniforms.uTime.value = t;
      angle += 0.004 * spinSpeed;
      frame += 1;

      cyan.position.x = Math.sin(angle) * 2.6;
      cyan.position.z = Math.cos(angle) * 2.6;
      pink.position.x = -Math.sin(angle * 0.85) * 2.4;
      pink.position.z = -Math.cos(angle * 0.85) * 2.4;

      cube.rotation.x += 0.0026 * spinSpeed;
      cube.rotation.y += 0.0042 * spinSpeed;
      cube.rotation.z += 0.0011 * spinSpeed;

      cube.position.y = float ? Math.sin(frame * 0.012 + floatDelay) * 0.07 : 0;

      const mx = mouseX.get();
      const my = mouseY.get();
      cube.rotation.y += mx * 0.004;
      cube.rotation.x += my * 0.003;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(raf);
      if (mount.contains(canvas)) mount.removeChild(canvas);
      geometry.dispose();
      prismMat.dispose();
      edgesGeo.dispose();
      edgeMat.dispose();
      renderer.dispose();
    };
  }, [size, isPrism, spinSpeed, float, floatDelay, mouseX, mouseY]);

  return (
    <motion.div
      className={`relative flex items-center justify-center ${className}`}
      style={{ x: parallaxX, y: parallaxY }}
    >
      {/* Spectral bloom aura */}
      <div
        style={{ width: size * 1.55, height: size * 1.55 }}
        className="absolute rounded-full pointer-events-none opacity-80"
      >
        <div className="absolute inset-0 rounded-full bg-radial from-cyan-400/25 via-fuchsia-500/12 to-transparent blur-2xl animate-pulse" />
        <div className="absolute inset-[18%] rounded-full bg-radial from-violet-400/20 via-pink-400/10 to-transparent blur-xl" />
      </div>
      <div
        ref={mountRef}
        style={{ width: size, height: size }}
        className="relative z-10 select-none pointer-events-none"
      />
    </motion.div>
  );
};
