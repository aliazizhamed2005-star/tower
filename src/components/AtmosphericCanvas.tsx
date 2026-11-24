import React, { useEffect, useRef } from 'react';

interface AtmosphericCanvasProps {
  active: boolean;
}

interface CloudPuff {
  x: number;
  y: number;
  width: number;
  height: number;
  speedX: number;
  phase: number;
  alpha: number;
  spriteIndex: number;
}

interface HazeMote {
  x: number;
  y: number;
  radius: number;
  speedX: number;
  speedY: number;
  phase: number;
  phaseSpeed: number;
  maxAlpha: number;
  warm: boolean;
}

function createCloudSprite(
  rgbaInner: string,
  rgbaMid: string
): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.save();
  ctx.scale(2, 1);
  const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, rgbaInner);
  grad.addColorStop(0.45, rgbaMid);
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  ctx.restore();

  return canvas;
}

export const AtmosphericCanvas: React.FC<AtmosphericCanvasProps> = ({ active }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Pre-bake 3 soft volumetric cloud/haze sprites once (zero per-frame gradient allocation)
    const sprites = [
      createCloudSprite('rgba(165, 178, 196, 0.14)', 'rgba(130, 144, 165, 0.05)'),
      createCloudSprite('rgba(200, 169, 110, 0.10)', 'rgba(200, 169, 110, 0.03)'),
      createCloudSprite('rgba(244, 240, 234, 0.11)', 'rgba(210, 214, 222, 0.03)'),
    ].filter((s): s is HTMLCanvasElement => s !== null);

    let width = window.innerWidth;
    let height = window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    const resize = () => {
      width = canvas.clientWidth || window.innerWidth;
      height = canvas.clientHeight || window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();

    // Initialize distant drifting cloud strata
    const cloudCount = 9;
    const clouds: CloudPuff[] = Array.from({ length: cloudCount }, (_, idx) => {
      const band = idx / cloudCount;
      const w = 340 + (idx % 4) * 140;
      const h = w * 0.44;
      return {
        x: ((idx * 0.23) % 1.2 - 0.1) * width,
        y: height * (0.06 + band * 0.62),
        width: w,
        height: h,
        speedX: (4.5 + (idx % 3) * 2.4) * (idx % 2 === 0 ? 1 : -0.65),
        phase: idx * 1.15,
        alpha: 0.45 + (idx % 3) * 0.16,
        spriteIndex: idx % Math.max(1, sprites.length),
      };
    });

    // Initialize lightweight atmospheric light motes
    const moteCount = width < 768 ? 20 : 34;
    const motes: HazeMote[] = Array.from({ length: moteCount }, (_, idx) => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: 0.75 + (idx % 3) * 0.55,
      speedX: (Math.random() - 0.35) * 6,
      speedY: -(2.2 + Math.random() * 4.5),
      phase: Math.random() * Math.PI * 2,
      phaseSpeed: 0.45 + Math.random() * 0.65,
      maxAlpha: 0.08 + Math.random() * 0.14,
      warm: idx % 3 === 0,
    }));

    const drawFrame = (elapsedSec: number) => {
      ctx.clearRect(0, 0, width, height);

      // Layer 1: Distant drifting clouds / atmospheric haze bands
      for (let i = 0; i < clouds.length; i++) {
        const c = clouds[i];
        const sprite = sprites[c.spriteIndex];
        if (!sprite) continue;

        const breath = 0.85 + 0.15 * Math.sin(elapsedSec * 0.22 + c.phase);
        const yDrift = Math.sin(elapsedSec * 0.14 + c.phase) * 8;
        ctx.globalAlpha = c.alpha * breath;
        ctx.drawImage(sprite, c.x, c.y + yDrift, c.width, c.height);
      }

      // Layer 2: Subtle sunlit horizon haze motes
      for (let i = 0; i < motes.length; i++) {
        const m = motes[i];
        const pulse = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(elapsedSec * m.phaseSpeed + m.phase));
        ctx.globalAlpha = m.maxAlpha * pulse;
        ctx.fillStyle = m.warm ? '#DFC48F' : '#F4F0EA';
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
    };

    // Draw initial frame immediately (and stay static if reduced motion or inactive)
    drawFrame(0);

    if (!active || prefersReducedMotion) {
      const observer = new ResizeObserver(() => {
        resize();
        drawFrame(0);
      });
      observer.observe(canvas);
      return () => observer.disconnect();
    }

    let rafId = 0;
    let lastTs = performance.now();
    let elapsed = 0;

    const step = (now: number) => {
      if (document.hidden) {
        lastTs = now;
        rafId = window.requestAnimationFrame(step);
        return;
      }

      const dt = Math.min(0.05, Math.max(0.001, (now - lastTs) / 1000));
      lastTs = now;
      elapsed += dt;

      for (let i = 0; i < clouds.length; i++) {
        const c = clouds[i];
        c.x += c.speedX * dt;
        if (c.speedX > 0 && c.x > width + 60) {
          c.x = -c.width - 40;
        } else if (c.speedX < 0 && c.x < -c.width - 60) {
          c.x = width + 40;
        }
      }

      for (let i = 0; i < motes.length; i++) {
        const m = motes[i];
        m.x += (m.speedX + Math.sin(elapsed * 0.4 + m.phase) * 2.2) * dt;
        m.y += m.speedY * dt;

        if (m.y < -12) {
          m.y = height + 12;
          m.x = Math.random() * width;
        }
        if (m.x < -12) m.x = width + 12;
        if (m.x > width + 12) m.x = -12;
      }

      drawFrame(elapsed);
      rafId = window.requestAnimationFrame(step);
    };

    rafId = window.requestAnimationFrame(step);

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    return () => {
      window.cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, [active]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="absolute inset-0 w-full h-full pointer-events-none"
    />
  );
};
