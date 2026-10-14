import { useEffect, useRef } from 'react'
import { tokenRgb } from '@/lib/color'

/**
 * The living backdrop. Each colour theme has its own scene, all sharing one horizon line so Morph's
 * layout feels the same everywhere:
 *   Lavender: the planet from the brand film, aurora rolling over its rim, stars.
 *   Ocean:    a moonlit (or sunlit) sea, waves and a shimmering reflection.
 *   Sunrise:  the sun coming up behind hills, slow rays and drifting clouds.
 *   Forest:   layered pine ridges, mist drifting between them, fireflies at night.
 *   Rose:     rolling hills, blossom petals drifting down.
 *   Snow:     snow-capped mountains, snowfall in three depths.
 *   Desert:   layered dunes with lit and shaded faces, a low sun or moon, shimmering air by day.
 * Colours come from the active theme; the light brightens and quickens while Morph is thinking
 * (html[data-morph="thinking"]). Advanced settings control speed (data-bg-motion) and strength
 * (data-bg-brightness).
 *
 * Cheap on purpose: rendered at reduced resolution (the light is soft anyway), capped at 30 fps,
 * paused when the window is hidden, and drawn once (no loop) when motion is off.
 */

const VERTEX = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`

const FRAGMENT = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uPhase;
uniform float uScale;
uniform vec3 uBg;
uniform vec3 uBgTop;
uniform vec3 uPlanet;
uniform vec3 uHaze;
uniform vec3 uRim;
uniform vec3 uAccent;
uniform vec3 uDeep;
uniform vec3 uHi;
uniform float uDark;
uniform float uEnergy;
uniform float uHorizon;
uniform float uBright;
uniform int uScene;

const vec3 STAR = vec3(0.9, 0.92, 1.0);

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = p * 2.03 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}

// Sparse twinkling stars; mask fades them out (0) or in (1).
float stars(float mask) {
  if (mask <= 0.0) return 0.0;
  vec2 grid = gl_FragCoord.xy / (14.0 * uScale);
  vec2 cell = floor(grid);
  float h = hash(cell);
  if (h < 0.975) return 0.0;
  vec2 star = cell + vec2(hash(cell + 3.1), hash(cell + 7.7));
  float twinkle = 0.55 + 0.45 * sin(uTime * (0.6 + h * 1.8) + h * 40.0);
  return (1.0 - smoothstep(0.0, 0.22, length(grid - star))) * twinkle * 0.55 * mask;
}

// Anti-aliased "is this pixel below the line" for silhouettes.
float below(float line, float y) {
  float px = 1.5 / uRes.y;
  return 1.0 - smoothstep(line - px, line + px, y);
}

// Lavender: the planet from the brand film.
vec3 space(vec2 p, vec2 uv, float t, float horizon) {
  vec3 col = mix(uBg, uBgTop, smoothstep(0.0, 1.0, uv.y));
  float radius = 2.6 * max(uRes.x / uRes.y, 1.0);
  float d = length(p - vec2(0.0, horizon - radius)) - radius;
  float above = max(d, 0.0);
  float centre = exp(-p.x * p.x * 1.3);

  float warp = fbm(vec2(p.x * 1.6, above * 4.0) + vec2(t * 2.0, -t));
  float band = fbm(vec2(p.x * 1.8 + warp * 1.6 - t * 3.0, above * 5.0 - t * 1.5));
  float curtain = smoothstep(0.38, 0.95, band) * exp(-above * 3.0);
  vec3 aurora = mix(uHaze, uAccent, smoothstep(0.3, 0.9, band));
  col += aurora * curtain * (0.5 + 0.5 * centre) * (0.6 + 0.9 * uEnergy) * mix(0.6, 1.0, uDark);
  col += uRim * exp(-above * 13.0) * (0.35 + 0.65 * centre) * (0.45 + 0.4 * uEnergy);

  if (d < 0.0) {
    float depth = -d;
    col = mix(uPlanet, uBg, smoothstep(0.0, 0.4, depth));
    col += uRim * exp(-depth * 38.0) * 0.45 * (0.4 + 0.6 * centre);
  }
  col += uRim * (1.0 - smoothstep(0.0, 0.0035, abs(d))) * (0.5 + 0.5 * centre);
  col += STAR * stars(uDark * smoothstep(0.0, 0.2, above));
  return col;
}

// Ocean: sky with a moon (sun by day), the sea below with perspective waves and a glinting reflection.
vec3 ocean(vec2 p, vec2 uv, float t, float horizon) {
  float aspect = uRes.x / uRes.y;
  float lightX = 0.42 * min(aspect, 1.8);
  vec3 lightCol = mix(uHi, vec3(1.0), 0.6);
  vec3 col = mix(uBg, uBgTop, smoothstep(horizon, 1.0, uv.y));
  if (uv.y >= horizon) {
    float above = uv.y - horizon;
    col += uHaze * exp(-above * 7.0) * 0.55;
    float ld = length(p - vec2(lightX, horizon + 0.56));
    col += lightCol * (1.0 - smoothstep(0.032, 0.037, ld)) * mix(0.75, 0.95, uDark);
    col += lightCol * exp(-ld * 6.0) * 0.14;
    float cloud = smoothstep(0.58, 0.85, fbm(vec2(p.x * 1.2 + t * 0.7, uv.y * 6.0 + 3.0)));
    col = mix(col, mix(uBgTop, uHaze, 0.35), cloud * 0.35 * smoothstep(horizon + 0.12, horizon + 0.3, uv.y));
    col += STAR * stars(uDark * smoothstep(0.08, 0.3, above));
  } else {
    float depth = horizon - uv.y;
    float z = 0.06 / (depth + 0.01);
    float waves = fbm(vec2(p.x * z * 1.1 + t * 1.2, z * 1.6 + t * 4.0));
    float ripple = noise(vec2(p.x * z * 4.0 - t * 3.0, z * 4.0 + t * 9.0));
    vec3 near = uDark > 0.5 ? mix(uBg, uDeep, 0.24) : mix(uDeep, uBgTop, 0.45);
    vec3 far = mix(near, uHaze, 0.45);
    col = mix(far, near, smoothstep(0.0, 0.18, depth));
    col += (waves - 0.5) * 0.2 * mix(uHaze, uHi, 0.5);
    float column = exp(-abs(p.x - lightX) * (5.0 + depth * 10.0));
    float glint = smoothstep(0.55, 0.9, ripple * (0.6 + waves));
    col += lightCol * column * (0.1 + glint * 0.9) * (0.7 + 0.6 * uEnergy);
    col = mix(col, uBg + uHaze * 0.6, exp(-depth * 40.0) * 0.5);
  }
  return col;
}

// Sunrise: the sun rising behind rolling hills, with slow rays and clouds lit from below.
vec3 sunrise(vec2 p, vec2 uv, float t, float horizon) {
  vec3 warm = mix(uAccent, vec3(1.0, 0.85, 0.6), 0.45);
  vec3 col = mix(uBg, uBgTop, smoothstep(0.0, 1.0, uv.y));
  float above = uv.y - horizon;
  col += warm * exp(-max(above, 0.0) * 3.2) * mix(0.35, 0.55, uDark);
  // The sun lifts a little while Morph is thinking.
  vec2 sun = vec2(0.0, horizon - 0.035 + 0.05 * uEnergy + 0.008 * sin(t * 2.0));
  vec2 q = p - sun;
  float r = length(q);
  vec3 sunCol = mix(warm, vec3(1.0, 0.95, 0.85), 0.3);
  if (above > 0.0) {
    float rays = pow(0.5 + 0.5 * sin(atan(q.y, q.x) * 16.0 + t * 4.0), 8.0) * exp(-r * 2.4);
    col += sunCol * rays * 0.22 * (0.6 + 0.8 * uEnergy);
    float band = fbm(vec2(p.x * 1.4 + t * 0.9, uv.y * 7.0));
    float cloud = smoothstep(0.55, 0.85, band) * smoothstep(horizon + 0.06, horizon + 0.2, uv.y) * (1.0 - smoothstep(horizon + 0.35, horizon + 0.6, uv.y));
    col = mix(col, mix(uBgTop, warm, exp(-r * 1.6)), cloud * 0.55);
    col += STAR * stars(uDark * smoothstep(0.3, 0.6, above));
  }
  col += sunCol * (1.0 - smoothstep(0.125, 0.132, r)) * 0.85;
  col += sunCol * exp(-r * 4.5) * 0.25;

  float hill = horizon - 0.01 + 0.012 * sin(p.x * 3.0 + 1.0) + 0.02 * fbm(vec2(p.x * 1.6, 2.0));
  vec3 ground = uDark > 0.5 ? mix(uBg, uDeep, 0.2) : mix(uDeep, uBg, 0.45);
  ground += warm * exp(-max(hill - uv.y, 0.0) * 40.0) * 0.25;
  return mix(col, ground, below(hill, uv.y));
}

// One ridge of pine trees: triangle tops of varying height along x.
float treeLine(float x, float seed, float base, float height, float density) {
  float cell = x * density + seed;
  float spike = 1.0 - abs(fract(cell) - 0.5) * 2.0;
  float h = 0.5 + 0.5 * hash(vec2(floor(cell), seed));
  return base + height * h * spike + 0.03 * (noise(vec2(x * 2.5, seed)) - 0.5);
}

// Forest: ridges from far (hazy) to near (dark), mist drifting between them, fireflies at night.
vec3 forest(vec2 p, vec2 uv, float t, float horizon) {
  vec3 col = mix(uBg, uBgTop, smoothstep(0.0, 1.0, uv.y));
  col += uHaze * exp(-abs(uv.y - horizon - 0.12) * 4.0) * 0.55;
  col += STAR * stars(uDark * smoothstep(horizon + 0.25, horizon + 0.5, uv.y));
  if (uDark < 0.5) {
    float shaft = pow(max(0.0, sin((p.x * 0.8 + uv.y * 0.5) * 9.0 + t * 0.6)), 10.0);
    col += uRim * shaft * 0.08 * smoothstep(horizon, 1.0, uv.y);
  }
  vec3 front = uDark > 0.5 ? mix(uBg, uDeep, 0.16) : mix(uDeep, uBg, 0.3);
  vec3 back = mix(uHaze, uBgTop, uDark > 0.5 ? 0.55 : 0.35);
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float base = horizon + 0.11 - fi * 0.075;
    float ridge = treeLine(p.x + t * 0.004 * (fi + 1.0), fi * 13.7 + 1.3, base, 0.07 + fi * 0.035, 10.0 - fi * 2.0);
    col = mix(col, mix(back, front, fi / 3.0), below(ridge, uv.y));
    float mist = fbm(vec2(p.x * 1.3 - t * (0.5 + fi * 0.25), uv.y * 9.0 + fi * 4.0));
    col = mix(col, back, smoothstep(0.5, 0.9, mist) * exp(-abs(uv.y - base + 0.02) * 14.0) * 0.4);
  }
  if (uDark > 0.5) {
    float aspect = uRes.x / uRes.y;
    for (int i = 0; i < 12; i++) {
      float fi = float(i);
      vec2 pos = vec2(
        (hash(vec2(fi, 1.0)) - 0.5) * aspect * 0.95 + 0.06 * sin(t * 3.0 + fi * 1.7),
        horizon - 0.02 - 0.18 * hash(vec2(fi, 2.0)) + 0.03 * sin(t * 2.3 + fi * 2.9)
      );
      float blink = 0.5 + 0.5 * sin(uTime * 1.5 + fi * 4.1);
      col += uHi * exp(-length(p - pos) * 160.0) * blink * (0.9 + uEnergy);
    }
  }
  return col;
}

// Rose: rolling hills at dusk or dawn, blossom petals drifting down.
vec3 blossom(vec2 p, vec2 uv, float t, float horizon) {
  vec3 col = mix(uBg, uBgTop, smoothstep(0.0, 1.0, uv.y));
  col += uHaze * exp(-abs(uv.y - horizon - 0.1) * 4.0) * 0.5;
  col += STAR * stars(uDark * smoothstep(horizon + 0.3, horizon + 0.6, uv.y));
  float far = horizon + 0.03 + 0.03 * sin(p.x * 2.2 + 0.5) + 0.015 * fbm(vec2(p.x * 2.0, 5.0));
  float near = horizon - 0.05 + 0.025 * sin(p.x * 3.1 + 2.0) + 0.01 * fbm(vec2(p.x * 3.0, 9.0));
  col = mix(col, mix(uHaze, uBgTop, uDark > 0.5 ? 0.55 : 0.35), below(far, uv.y));
  col = mix(col, uDark > 0.5 ? mix(uBg, uDeep, 0.22) : mix(uDeep, uBg, 0.45), below(near, uv.y));
  float aspect = uRes.x / uRes.y;
  vec3 petalCol = mix(uHi, vec3(1.0, 0.92, 0.95), 0.3);
  for (int i = 0; i < 18; i++) {
    float fi = float(i);
    float fall = 0.03 + 0.03 * hash(vec2(fi, 3.0));
    float y = 1.1 - fract(hash(vec2(fi, 4.0)) + uTime * fall) * 1.3;
    float x = (hash(vec2(fi, 5.0)) - 0.5) * aspect + 0.08 * sin(uTime * 0.6 + fi * 2.3);
    float a = uTime * (0.6 + hash(vec2(fi, 6.0))) + fi;
    vec2 d = mat2(cos(a), sin(a), -sin(a), cos(a)) * (p - vec2(x, y));
    float petal = 1.0 - smoothstep(0.7, 1.0, length(d / vec2(0.016, 0.009)));
    col = mix(col, petalCol, petal * 0.85);
  }
  return col;
}

// One mountain ridge: sharp peaks shaped by noise.
float mountain(float x, float seed, float base, float height) {
  float n = fbm(vec2(x * 1.7 + seed, seed));
  float peaks = 1.0 - abs(sin(x * 2.4 + seed * 3.0 + n * 2.0));
  return base + height * (0.55 * peaks + 0.45 * n);
}

// Snow: snow-capped mountains, flakes falling in three depths.
vec3 snowfall(vec2 p, vec2 uv, float t, float horizon) {
  vec3 col = mix(uBg, uBgTop, smoothstep(0.0, 1.0, uv.y));
  col += uHaze * exp(-abs(uv.y - horizon - 0.08) * 5.0) * 0.4;
  col += STAR * stars(uDark * smoothstep(horizon + 0.3, horizon + 0.55, uv.y));
  vec3 snowCol = mix(vec3(1.0), uHi, 0.25) * (uDark > 0.5 ? 0.78 : 1.0);
  for (int i = 0; i < 2; i++) {
    float fi = float(i);
    float ridge = mountain(p.x, 2.0 + fi * 5.0, horizon + 0.02 - fi * 0.09, 0.22 - fi * 0.08);
    vec3 rock = i == 0 ? mix(uHaze, uBgTop, 0.5) : (uDark > 0.5 ? mix(uBg, uDeep, 0.25) : mix(uDeep, uBgTop, 0.5));
    float cap = smoothstep(ridge - 0.07 - 0.03 * fbm(vec2(p.x * 9.0, fi)), ridge - 0.012, uv.y);
    col = mix(col, mix(rock, snowCol, cap * (0.85 - fi * 0.3)), below(ridge, uv.y));
  }
  vec3 flake = uDark > 0.5 ? vec3(1.0) : mix(vec3(1.0), uDeep, 0.3);
  for (int l = 0; l < 3; l++) {
    float fl = float(l);
    vec2 q = p * (22.0 - fl * 6.0);
    q.y += uTime * (0.6 + fl * 0.35);
    q.x += sin(uTime * 0.4 + fl) * 0.8 + q.y * 0.05;
    vec2 cell = floor(q);
    if (hash(cell + fl * 17.0) > 0.82) {
      vec2 pos = cell + vec2(hash(cell + 1.3), hash(cell + 2.7));
      col = mix(col, flake, (1.0 - smoothstep(0.05, 0.12 + fl * 0.04, length(q - pos))) * (0.35 + fl * 0.2));
    }
  }
  return col;
}

// Desert: layered dunes with lit and shaded faces, a low sun (or moon), shimmering air by day.
vec3 dunes(vec2 p, vec2 uv, float t, float horizon) {
  vec3 warm = mix(uAccent, vec3(1.0, 0.9, 0.7), 0.4);
  vec3 col = mix(uBg, uBgTop, smoothstep(0.0, 1.0, uv.y));
  col += warm * exp(-max(uv.y - horizon, 0.0) * 4.0) * mix(0.25, 0.4, uDark);
  vec2 orb = vec2(-0.38 * min(uRes.x / uRes.y, 1.8), horizon + 0.34);
  float od = length(p - orb);
  vec3 orbCol = uDark > 0.5 ? mix(uHi, vec3(1.0), 0.6) : mix(warm, vec3(1.0), 0.5);
  col += orbCol * (1.0 - smoothstep(0.07, 0.076, od)) * 0.8;
  col += orbCol * exp(-od * 5.0) * 0.16;
  col += STAR * stars(uDark * smoothstep(horizon + 0.15, horizon + 0.4, uv.y));
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float x = p.x * (1.4 + fi * 0.6) + fi * 1.7 + t * 0.02 * (fi + 1.0);
    float h = horizon + 0.02 - fi * 0.075 + 0.05 * sin(x) + 0.03 * sin(x * 2.3 + 1.0) + 0.015 * fbm(vec2(x * 1.5, fi));
    float slope = cos(x) + 0.69 * cos(x * 2.3 + 1.0);
    vec3 sand = uDark > 0.5 ? mix(uBg, uDeep, 0.3 - fi * 0.05) : mix(uDeep, uBgTop, 0.55 - fi * 0.12);
    vec3 face = mix(sand * 0.85, mix(sand, warm, uDark > 0.5 ? 0.12 : 0.3), smoothstep(-0.4, 0.4, -slope));
    face = mix(face, mix(uHaze, uBgTop, 0.4), (2.0 - fi) * 0.15);
    col = mix(col, face, below(h, uv.y));
  }
  if (uDark < 0.5) col += warm * 0.03 * sin(uv.y * 400.0 + uTime * 3.0) * exp(-abs(uv.y - horizon) * 30.0);
  return col;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = vec2((uv.x - 0.5) * (uRes.x / uRes.y), uv.y);
  float horizon = 1.0 - uHorizon;
  vec3 col;
  if (uScene == 1) col = ocean(p, uv, uPhase, horizon);
  else if (uScene == 2) col = sunrise(p, uv, uPhase, horizon);
  else if (uScene == 3) col = forest(p, uv, uPhase, horizon);
  else if (uScene == 4) col = blossom(p, uv, uPhase, horizon);
  else if (uScene == 5) col = snowfall(p, uv, uPhase, horizon);
  else if (uScene == 6) col = dunes(p, uv, uPhase, horizon);
  else col = space(p, uv, uPhase, horizon);
  // Advanced → Background brightness: scales how far the scene departs from the plain background.
  col = mix(uBg, col, uBright);
  // Dither so the soft gradients don't band.
  col += (hash(gl_FragCoord.xy + fract(uTime)) - 0.5) / 255.0;
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`

const RENDER_SCALE = 0.6
const FRAME_MS = 1000 / 30
const HORIZON = 0.74
const SCENES: Record<string, number> = { lavender: 0, ocean: 1, sunrise: 2, forest: 3, rose: 4, snow: 5, desert: 6 }
const SPEED: Record<string, number> = { still: 0, slow: 0.45, normal: 1, lively: 1.8 }

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)!
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? 'shader')
  return shader
}

export function ShaderBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const gl = canvas?.getContext('webgl', { antialias: false, alpha: false, preserveDrawingBuffer: false })
    if (!canvas || !gl) return // CSS horizon (.backdrop) stays as the fallback.

    let program: WebGLProgram
    try {
      program = gl.createProgram()!
      gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX))
      gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT))
      gl.linkProgram(program)
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? 'link')
    } catch (err) {
      console.warn('Morph backdrop shader unavailable, using CSS fallback', err)
      canvas.style.display = 'none'
      return
    }
    gl.useProgram(program)
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const aPos = gl.getAttribLocation(program, 'aPos')
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)
    const u = (name: string) => gl.getUniformLocation(program, name)
    canvas.dataset.ready = 'true'

    const root = document.documentElement
    const reduced = matchMedia('(prefers-reduced-motion: reduce)')
    const speed = () => (reduced.matches || root.dataset.motion === 'reduced' ? 0 : (SPEED[root.dataset.bgMotion ?? 'normal'] ?? 1))
    let energy = root.dataset.morph === 'thinking' ? 1 : 0
    // Scene time is integrated frame by frame, so changing speed (or Morph starting to think) never jumps.
    let phase = 12
    let clock = 0

    const applyTheme = () => {
      const set = (name: string, token: string) => gl.uniform3fv(u(name), tokenRgb(token))
      set('uBg', '--bg')
      set('uBgTop', '--bg-top')
      set('uPlanet', '--planet')
      set('uHaze', '--haze')
      set('uRim', '--rim')
      set('uAccent', '--morph')
      set('uDeep', '--morph-deep')
      set('uHi', '--morph-hi')
      gl.uniform1f(u('uDark'), root.dataset.theme === 'dark' ? 1 : 0)
      gl.uniform1f(u('uHorizon'), HORIZON)
      gl.uniform1i(u('uScene'), SCENES[root.dataset.palette ?? 'lavender'] ?? 0)
      gl.uniform1f(u('uBright'), Number(root.dataset.bgBrightness ?? 1) || 1)
    }

    const resize = () => {
      const scale = Math.min(devicePixelRatio || 1, 1) * RENDER_SCALE
      canvas.width = Math.max(1, Math.round(innerWidth * scale))
      canvas.height = Math.max(1, Math.round(innerHeight * scale))
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.uniform2f(u('uRes'), canvas.width, canvas.height)
      gl.uniform1f(u('uScale'), scale)
    }

    const draw = () => {
      gl.uniform1f(u('uTime'), clock)
      gl.uniform1f(u('uPhase'), phase)
      gl.uniform1f(u('uEnergy'), energy)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }

    let frame = 0
    let last = 0
    const loop = (now: number) => {
      frame = requestAnimationFrame(loop)
      if (now - last < FRAME_MS) return
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0
      last = now
      const target = root.dataset.morph === 'thinking' ? 1 : 0
      energy += (target - energy) * Math.min(1, dt * 1.6)
      const s = speed()
      clock += dt * s
      phase += dt * s * (0.03 + 0.05 * energy)
      draw()
    }
    const run = () => {
      cancelAnimationFrame(frame)
      last = 0
      if (speed() === 0 || document.hidden) draw()
      else frame = requestAnimationFrame(loop)
    }

    resize()
    applyTheme()
    draw()
    run()

    // Theme changes redraw immediately so the theme-reveal snapshot already shows the new scene.
    const observer = new MutationObserver(() => {
      applyTheme()
      draw()
      run()
    })
    observer.observe(root, {
      attributes: true,
      attributeFilter: ['data-theme', 'data-palette', 'data-bg-motion', 'data-bg-brightness', 'data-motion']
    })
    const onResize = () => {
      resize()
      draw()
    }
    addEventListener('resize', onResize)
    document.addEventListener('visibilitychange', run)
    reduced.addEventListener('change', run)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      removeEventListener('resize', onResize)
      document.removeEventListener('visibilitychange', run)
      reduced.removeEventListener('change', run)
    }
  }, [])

  return <canvas ref={canvasRef} className="backdrop-gl" aria-hidden="true" />
}
