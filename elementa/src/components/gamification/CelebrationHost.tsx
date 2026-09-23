'use client';

import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useChrome } from '@/components/layout/ChromeContext';
import { useSound } from '@/hooks/useSound';
import { progressStore, type ProgressEvent } from '@/store/progress-store';
import { todayKey } from '@/utils/dates';
import { computeStreak } from '@/utils/streak';
import { planCelebration } from './celebration-plan';
import { CelebrationToasts, type CelebrationToast } from './CelebrationToasts';
import { Confetti } from './Confetti';
import { LevelUpModal } from './LevelUpModal';
import { XpFloat } from './XpFloat';

const TOAST_MS = 4500;
const XP_FLOAT_MS = 1200;
/** Ventana para sumar XP consecutiva en un solo "+N XP". */
const XP_MERGE_MS = 900;
const SOUND_GAP_MS = 1200;
/** Avisos visibles a la vez: 1 en pantallas de enfoque, 3 en el resto. */
const MAX_VISIBLE = 3;
const MAX_VISIBLE_IMMERSIVE = 1;
/** Avisos como mucho en cola (visibles incluidos): los más antiguos en espera se descartan. */
const MAX_QUEUED = 6;
/**
 * Rutas donde las celebraciones esperan (avisos, confeti, modal de nivel y sonido) hasta que el usuario
 * navega a otra: en el primer uso no deben tapar el resultado del diagnóstico.
 */
const HOLD_ROUTES = ['/bienvenida'];

function isHoldRoute(pathname: string): boolean {
  return HOLD_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

/**
 * Escucha `progressStore.onEvent` y celebra: "+10 XP" flotante, avisos de logros y de meta diaria,
 * modal de subida de nivel con confeti (en pantallas inmersivas, un aviso en su lugar) y sonidos.
 * Los eventos de un mismo cambio se celebran juntos (`planCelebration`). En modo inmersivo solo se ve
 * un aviso compacto a la vez, bajo la cabecera. Se monta una sola vez en `app/layout.tsx`.
 */
export function CelebrationHost() {
  const sound = useSound();
  const { immersive } = useChrome();
  const holding = isHoldRoute(usePathname() ?? '/');
  const [xpFloat, setXpFloat] = useState<{ key: string; amount: number } | null>(null);
  /** Cola de avisos: los primeros `limit` están a la vista. */
  const [toasts, setToasts] = useState<CelebrationToast[]>([]);
  const [levelModal, setLevelModal] = useState({ open: false, level: 1 });
  const [confetti, setConfetti] = useState<{ key: number; pieces: number } | null>(null);

  const nextId = useRef(0);
  const timers = useRef(new Map<string, number>());
  const lastXpAt = useRef(0);
  const lastSoundAt = useRef(0);
  /** Eventos del tick actual (se celebran juntos). */
  const batch = useRef<ProgressEvent[]>([]);
  /** Eventos retenidos mientras se está en una ruta de espera. */
  const held = useRef<ProgressEvent[]>([]);

  const limit = immersive ? MAX_VISIBLE_IMMERSIVE : MAX_VISIBLE;
  const visible = toasts.slice(0, limit);
  const visibleKey = visible.map((t) => t.id).join(',');

  const schedule = (key: string, ms: number, fn: () => void) => {
    const map = timers.current;
    const prev = map.get(key);
    if (prev !== undefined) window.clearTimeout(prev);
    map.set(
      key,
      window.setTimeout(() => {
        map.delete(key);
        fn();
      }, ms),
    );
  };

  const dismissToast = (id: number) => {
    const map = timers.current;
    const key = `toast-${id}`;
    const timer = map.get(key);
    if (timer !== undefined) window.clearTimeout(timer);
    map.delete(key);
    setToasts((list) => list.filter((t) => t.id !== id));
  };

  const celebrate = useEffectEvent((events: ProgressEvent[]) => {
    if (holding) {
      // La XP flotante es un gesto del momento: no se guarda para después.
      held.current.push(...events.filter((e) => e.type !== 'xp'));
      return;
    }
    const state = progressStore.getState();
    const plan = planCelebration(events, {
      immersive,
      streak: computeStreak(state.daily, todayKey(new Date())).current,
    });
    const now = performance.now();

    if (plan.xp > 0) {
      const merge = now - lastXpAt.current < XP_MERGE_MS;
      lastXpAt.current = now;
      nextId.current += 1;
      const key = `xp-${nextId.current}`;
      setXpFloat((prev) => ({ key, amount: merge && prev ? prev.amount + plan.xp : plan.xp }));
      schedule('xp', XP_FLOAT_MS, () => setXpFloat(null));
    }
    if (plan.sound && now - lastSoundAt.current >= SOUND_GAP_MS) {
      lastSoundAt.current = now;
      sound.levelUp();
    }
    if (plan.confetti > 0) {
      nextId.current += 1;
      setConfetti({ key: nextId.current, pieces: plan.confetti });
    }
    const modalLevel = plan.levelModal;
    if (modalLevel !== null) {
      setLevelModal((m) => ({ open: true, level: m.open ? Math.max(m.level, modalLevel) : modalLevel }));
    }
    if (plan.toasts.length > 0) {
      const added = plan.toasts.map((toast) => {
        nextId.current += 1;
        return { ...toast, id: nextId.current };
      });
      setToasts((list) => {
        const next = [...list, ...added];
        // Sobran avisos: se descartan los más antiguos que aún esperan (nunca los que están a la vista).
        const excess = next.length - MAX_QUEUED;
        if (excess > 0) next.splice(limit, excess);
        return next;
      });
    }
  });

  const flushBatch = useEffectEvent(() => {
    const events = batch.current;
    batch.current = [];
    if (events.length > 0) celebrate(events);
  });

  useEffect(() => {
    return progressStore.onEvent((event) => {
      batch.current.push(event);
      // Un cambio emite sus eventos seguidos (xp, meta, logros, nivel): se agrupan en el mismo tick.
      if (batch.current.length === 1) queueMicrotask(() => flushBatch());
    });
  }, []);

  // Al salir de una ruta de espera se celebra lo retenido.
  useEffect(() => {
    if (holding || held.current.length === 0) return;
    const events = held.current;
    held.current = [];
    celebrate(events);
  }, [holding]);

  // Cada aviso empieza a contar cuando se hace visible.
  const startToastTimers = useEffectEvent((ids: number[]) => {
    for (const id of ids) {
      const key = `toast-${id}`;
      if (!timers.current.has(key)) {
        schedule(key, TOAST_MS, () => setToasts((list) => list.filter((t) => t.id !== id)));
      }
    }
  });

  useEffect(() => {
    if (visibleKey) startToastTimers(visibleKey.split(',').map(Number));
  }, [visibleKey]);

  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach((timer) => window.clearTimeout(timer));
      map.clear();
    };
  }, []);

  return (
    <>
      {xpFloat && !holding && (
        <XpFloat
          key={xpFloat.key}
          amount={xpFloat.amount}
          // En modo inmersivo el aviso ocupa ese hueco bajo la cabecera: el "+N XP" sube por debajo de él.
          className={
            immersive && visible.length > 0
              ? 'top-[calc(env(safe-area-inset-top)+8.5rem)] sm:top-[calc(env(safe-area-inset-top)+9.25rem)]'
              : undefined
          }
        />
      )}
      <CelebrationToasts toasts={holding ? [] : visible} onDismiss={dismissToast} immersive={immersive} />
      <LevelUpModal
        open={levelModal.open && !holding}
        level={levelModal.level}
        onClose={() => setLevelModal((m) => ({ ...m, open: false }))}
      />
      {confetti && !holding && (
        <Confetti
          key={confetti.key}
          pieces={confetti.pieces}
          origin={confetti.pieces > 120 ? 'center' : 'top'}
          onDone={() => setConfetti((c) => (c?.key === confetti.key ? null : c))}
        />
      )}
    </>
  );
}
