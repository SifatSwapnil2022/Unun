'use client';

import { useEffect, useRef } from 'react';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  OrthographicCamera,
  Points,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderer,
} from 'three';

/*
 * Embers rising from the stove. Every spark is one GL point whose whole path is
 * computed in the vertex shader from a random seed and the clock, so the CPU does
 * no per-frame work beyond advancing one uniform.
 */
const vertexShader = /* glsl */ `
  attribute vec4 aSeed; // x: lane, y: phase, z: size and speed, w: character

  uniform float uTime;
  uniform float uAspect;
  uniform float uPixelRatio;
  uniform float uScale;
  uniform vec2 uPointer;

  varying float vLife;
  varying float vCharacter;
  varying float vSoftness;

  void main() {
    float speed = mix(0.035, 0.11, aSeed.z);
    float life = fract(aSeed.y + uTime * speed);

    // Sparks start below the bottom edge, weighted towards the right where the pan sits.
    float x = mix(-0.2, 1.05, aSeed.x);
    x += sin(uTime * (0.6 + aSeed.w) + aSeed.y * 31.0) * 0.045 * (0.4 + life);
    x -= life * 0.18 * (aSeed.w - 0.3);
    float y = mix(-1.08, 1.1, pow(life, 0.85));

    // The pointer acts like a breath of air and pushes nearby sparks aside.
    vec2 position = vec2(x, y);
    vec2 away = position - uPointer;
    away.x *= uAspect;
    float push = smoothstep(0.35, 0.0, length(away));
    position += normalize(away + 0.0001) * push * 0.08;

    gl_Position = vec4(position, 0.0, 1.0);
    // Most sparks are small. A few large, soft ones sit out of focus in front.
    float size = mix(3.0, 26.0, pow(aSeed.z, 4.0));
    gl_PointSize = size * (1.0 - life * 0.7) * uPixelRatio * uScale;
    vSoftness = smoothstep(8.0, 26.0, size);

    vLife = life;
    vCharacter = aSeed.w;
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTime;

  varying float vLife;
  varying float vCharacter;
  varying float vSoftness;

  void main() {
    float distanceFromCentre = length(gl_PointCoord - 0.5);
    float core = smoothstep(0.5, 0.0, distanceFromCentre);
    float flicker = 0.75 + 0.25 * sin(uTime * (6.0 + vCharacter * 9.0) + vCharacter * 40.0);
    float fade = smoothstep(0.0, 0.08, vLife) * (1.0 - smoothstep(0.55, 1.0, vLife));

    vec3 hot = vec3(1.0, 0.76, 0.28);
    vec3 cooling = vec3(1.0, 0.357, 0.122);
    vec3 colour = mix(hot, cooling, smoothstep(0.0, 0.5, vLife));

    // Large sparks are dimmer and softer, as if out of focus.
    float sharp = core * core;
    float alpha = mix(sharp, core * 0.35, vSoftness) * flicker * fade;

    gl_FragColor = vec4(colour, alpha);
  }
`;

const STATIC_FRAME_TIME = 8;

function seeds(count: number): Float32Array {
  const data = new Float32Array(count * 4);
  for (let i = 0; i < data.length; i += 1) {
    data[i] = Math.random();
  }
  return data;
}

export function EmberCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    if (!canvas || !host) return;

    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({
        canvas,
        alpha: true,
        antialias: false,
        powerPreference: 'low-power',
      });
    } catch {
      // No WebGL: the CSS glow behind the canvas is the whole backdrop.
      return;
    }

    const pixelRatio = Math.min(window.devicePixelRatio, 2);
    renderer.setPixelRatio(pixelRatio);
    renderer.setClearColor(0x000000, 0);

    const count = host.clientWidth < 640 ? 150 : 360;
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      'position',
      new BufferAttribute(new Float32Array(count * 3), 3),
    );
    geometry.setAttribute('aSeed', new BufferAttribute(seeds(count), 4));

    const uniforms = {
      uTime: { value: 0 },
      uAspect: { value: 1 },
      uPixelRatio: { value: pixelRatio },
      uScale: { value: 1 },
      uPointer: { value: new Vector2(10, 10) },
    };

    const material = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: AdditiveBlending,
    });

    const points = new Points(geometry, material);
    points.frustumCulled = false;

    const scene = new Scene();
    scene.add(points);
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const pointerTarget = new Vector2(10, 10);
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    let frame = 0;
    let inView = true;
    let last = performance.now();

    const resize = () => {
      const { clientWidth: width, clientHeight: height } = host;
      if (width === 0 || height === 0) return;
      renderer.setSize(width, height, false);
      uniforms.uAspect.value = width / height;
      uniforms.uScale.value = Math.max(0.8, Math.min(height / 800, 1.4));
      if (reducedMotion.matches) renderer.render(scene, camera);
    };

    const tick = (now: number) => {
      frame = 0;
      // Clamp the step so a background tab does not fast-forward the fire on return.
      uniforms.uTime.value += Math.min((now - last) / 1000, 0.05);
      last = now;
      uniforms.uPointer.value.lerp(pointerTarget, 0.08);
      renderer.render(scene, camera);
      schedule();
    };

    const schedule = () => {
      if (frame !== 0 || !inView || document.hidden || reducedMotion.matches) return;
      last = performance.now();
      frame = requestAnimationFrame(tick);
    };

    const stop = () => {
      if (frame !== 0) cancelAnimationFrame(frame);
      frame = 0;
    };

    const onPointerMove = (event: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      pointerTarget.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -(((event.clientY - rect.top) / rect.height) * 2 - 1),
      );
    };

    const onVisibility = () => {
      if (document.hidden) stop();
      else schedule();
    };

    const onMotionPreference = () => {
      if (reducedMotion.matches) {
        stop();
        uniforms.uTime.value = STATIC_FRAME_TIME;
        renderer.render(scene, camera);
      } else {
        schedule();
      }
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);

    const viewObserver = new IntersectionObserver(([entry]) => {
      inView = entry?.isIntersecting ?? true;
      if (inView) schedule();
      else stop();
    });
    viewObserver.observe(host);

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    reducedMotion.addEventListener('change', onMotionPreference);

    resize();
    onMotionPreference();

    return () => {
      stop();
      resizeObserver.disconnect();
      viewObserver.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('visibilitychange', onVisibility);
      reducedMotion.removeEventListener('change', onMotionPreference);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />;
}
