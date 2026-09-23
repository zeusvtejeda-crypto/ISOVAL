'use client';

import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { useReducedMotion } from '@/components/ui/use-reduced-motion';

export interface ConfettiProps {
  /** Número de piezas. */
  pieces?: number;
  /** Duración total en ms (las piezas se desvanecen al final). */
  duration?: number;
  /** `top`: lluvia desde arriba · `center`: explosión desde el centro. */
  origin?: 'top' | 'center';
  /** Se llama al terminar (también con movimiento reducido, sin animar). */
  onDone?: () => void;
}

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  rot: number;
  vr: number;
  wobble: number;
  vw: number;
  color: string;
  round: boolean;
}

const COLOR_VARS = [
  '--color-brand',
  '--color-accent',
  '--color-xp-glow',
  '--color-streak-glow',
  '--color-success',
  '--color-cat-lanthanide',
  '--color-cat-halogen',
  '--color-danger',
];
const FALLBACK_COLORS = ['#6841f0', '#00b4e0', '#ffb800', '#ff7a1a', '#0e7c3a', '#b23e88'];

function readPalette(): string[] {
  const styles = getComputedStyle(document.documentElement);
  const colors = COLOR_VARS.map((v) => styles.getPropertyValue(v).trim()).filter(Boolean);
  return colors.length > 0 ? colors : FALLBACK_COLORS;
}

function createPieces(count: number, origin: 'top' | 'center', width: number, height: number, palette: string[]): Piece[] {
  return Array.from({ length: count }, () => {
    const w = 6 + Math.random() * 7;
    const base = {
      w,
      h: w * (0.45 + Math.random() * 0.55),
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.3,
      wobble: Math.random() * Math.PI * 2,
      vw: 0.08 + Math.random() * 0.12,
      color: palette[Math.floor(Math.random() * palette.length)],
      round: Math.random() < 0.22,
    };
    if (origin === 'center') {
      const angle = Math.random() * Math.PI * 2;
      const speed = 5 + Math.random() * 11;
      return {
        ...base,
        x: width / 2 + (Math.random() - 0.5) * 40,
        y: height * 0.42,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 7,
      };
    }
    return {
      ...base,
      x: Math.random() * width,
      y: -20 - Math.random() * height * 0.35,
      vx: (Math.random() - 0.5) * 4,
      vy: 2 + Math.random() * 4,
    };
  });
}

/**
 * Confeti en un <canvas> a pantalla completa, sin dependencias. Se dispara al montarse y
 * se elimina solo al terminar; para repetirlo, vuelve a montarlo (p. ej. cambiando su `key`).
 * Con `prefers-reduced-motion` no se dibuja nada.
 */
export function Confetti({ pieces = 140, duration = 2600, origin = 'top', onDone }: ConfettiProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();
  const [finished, setFinished] = useState(false);

  const finish = useEffectEvent(() => {
    setFinished(true);
    onDone?.();
  });

  useEffect(() => {
    if (reduced) {
      const timer = window.setTimeout(() => finish(), 0);
      return () => window.clearTimeout(timer);
    }
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const parts = createPieces(Math.max(1, Math.floor(pieces)), origin, width, height, readPalette());
    const fadeStart = duration * 0.72;
    let start = 0;
    let last = 0;
    let raf = 0;

    const tick = (now: number) => {
      if (!start) {
        start = now;
        last = now;
      }
      const elapsed = now - start;
      const step = Math.min(3, (now - last) / 16.667);
      last = now;
      const alpha = elapsed > fadeStart ? Math.max(0, 1 - (elapsed - fadeStart) / (duration - fadeStart)) : 1;

      ctx.clearRect(0, 0, width, height);
      ctx.globalAlpha = alpha;
      for (const p of parts) {
        p.vy += 0.2 * step;
        p.vx *= 0.985;
        p.vy *= 0.985;
        p.x += p.vx * step;
        p.y += p.vy * step;
        p.rot += p.vr * step;
        p.wobble += p.vw * step;
        if (p.y > height + 40) continue;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.scale(1, Math.cos(p.wobble));
        ctx.fillStyle = p.color;
        if (p.round) {
          ctx.beginPath();
          ctx.arc(0, 0, p.w / 2.4, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        }
        ctx.restore();
      }

      if (elapsed < duration) {
        raf = window.requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, width, height);
        finish();
      }
    };
    raf = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [reduced, pieces, duration, origin]);

  if (finished) return null;
  return <canvas ref={canvasRef} aria-hidden className="pointer-events-none fixed inset-0 z-[70] size-full" />;
}
