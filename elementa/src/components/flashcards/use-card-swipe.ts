'use client';

import { useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent } from 'react';

export type SwipeDirection = 'left' | 'right';

interface SwipeOptions {
  /** Identifica la tarjeta: al cambiar, el desplazamiento vuelve a 0 sin animación. */
  cardKey: string | null;
  enabled: boolean;
  onSwipe: (direction: SwipeDirection) => void;
  /** Distancia (px) a partir de la que el gesto cuenta. */
  threshold?: number;
}

interface DragState {
  key: string | null;
  dx: number;
  dragging: boolean;
}

interface Origin {
  x: number;
  y: number;
  id: number;
  axis: 'x' | 'y' | null;
}

const IDLE: DragState = { key: null, dx: 0, dragging: false };
/** Movimiento mínimo antes de decidir si el gesto es horizontal o vertical (scroll). */
const SLOP = 10;

/**
 * Deslizar la tarjeta a la derecha (lo sabía) o a la izquierda (no lo sabía). Solo gestos
 * horizontales: el scroll vertical sigue funcionando (`touch-action: pan-y`). Tras arrastrar se
 * anula el clic que giraría la tarjeta.
 */
export function useCardSwipe({ cardKey, enabled, onSwipe, threshold = 96 }: SwipeOptions) {
  const [state, setState] = useState<DragState>(IDLE);
  const origin = useRef<Origin | null>(null);
  const suppressClick = useRef(false);
  const drag = state.key === cardKey ? state : IDLE;

  const reset = () => {
    origin.current = null;
    setState({ key: cardKey, dx: 0, dragging: false });
  };

  const onPointerDown = (e: PointerEvent<HTMLElement>) => {
    suppressClick.current = false;
    if (!enabled || (e.pointerType === 'mouse' && e.button !== 0)) return;
    origin.current = { x: e.clientX, y: e.clientY, id: e.pointerId, axis: null };
  };

  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    const o = origin.current;
    if (!o || o.id !== e.pointerId || !enabled) return;
    const dx = e.clientX - o.x;
    const dy = e.clientY - o.y;
    if (o.axis === null) {
      if (Math.abs(dx) > SLOP && Math.abs(dx) > Math.abs(dy) * 1.2) {
        o.axis = 'x';
        e.currentTarget.setPointerCapture?.(e.pointerId);
      } else if (Math.abs(dy) > SLOP) {
        origin.current = null;
        return;
      }
    }
    if (o.axis === 'x') setState({ key: cardKey, dx, dragging: true });
  };

  const onPointerUp = (e: PointerEvent<HTMLElement>) => {
    const o = origin.current;
    if (!o || o.id !== e.pointerId) return;
    if (o.axis !== 'x') {
      origin.current = null;
      return;
    }
    suppressClick.current = true;
    const dx = e.clientX - o.x;
    origin.current = null;
    if (enabled && Math.abs(dx) >= threshold) {
      const sign = dx > 0 ? 1 : -1;
      setState({ key: cardKey, dx: sign * Math.max(window.innerWidth, 480), dragging: false });
      onSwipe(sign > 0 ? 'right' : 'left');
    } else {
      setState({ key: cardKey, dx: 0, dragging: false });
    }
  };

  const onClickCapture = (e: MouseEvent<HTMLElement>) => {
    if (!suppressClick.current) return;
    suppressClick.current = false;
    e.stopPropagation();
    e.preventDefault();
  };

  const style: CSSProperties = {
    transform: drag.dx !== 0 ? `translateX(${drag.dx}px) rotate(${drag.dx * 0.04}deg)` : undefined,
    transition: drag.dragging ? 'none' : 'transform 320ms var(--ease-snappy)',
    touchAction: 'pan-y',
  };

  return {
    /** Desplazamiento horizontal actual (px). */
    dx: drag.dx,
    dragging: drag.dragging,
    /** Progreso del gesto hacia el umbral: −1 (izquierda) … 1 (derecha). */
    progress: Math.max(-1, Math.min(1, drag.dx / threshold)),
    style,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: reset, onClickCapture },
  };
}
