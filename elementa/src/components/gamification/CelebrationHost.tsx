'use client';

import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { useChrome } from '@/components/layout/ChromeContext';
import { ACHIEVEMENTS_BY_ID } from '@/data/achievements';
import { useSound } from '@/hooks/useSound';
import { progressStore, type ProgressEvent } from '@/store/progress-store';
import { levelEmoji, levelTitle } from '@/utils/levels';
import { CelebrationToasts, type CelebrationToast } from './CelebrationToasts';
import { Confetti } from './Confetti';
import { LevelUpModal } from './LevelUpModal';
import { XpFloat } from './XpFloat';

const TOAST_MS = 4500;
const XP_FLOAT_MS = 1200;
/** Ventana para sumar XP consecutiva en un solo "+N XP". */
const XP_MERGE_MS = 900;
const SOUND_GAP_MS = 1200;
const MAX_TOASTS = 3;

/**
 * Escucha `progressStore.onEvent` y celebra: "+10 XP" flotante, avisos de logros y de meta diaria,
 * modal de subida de nivel con confeti (en pantallas inmersivas, un aviso en su lugar) y sonidos.
 * Se monta una sola vez en `app/layout.tsx`.
 */
export function CelebrationHost() {
  const sound = useSound();
  const { immersive } = useChrome();
  const [xpFloat, setXpFloat] = useState<{ key: string; amount: number } | null>(null);
  const [toasts, setToasts] = useState<CelebrationToast[]>([]);
  const [levelModal, setLevelModal] = useState({ open: false, level: 1 });
  const [confetti, setConfetti] = useState<{ key: number; pieces: number } | null>(null);

  const nextId = useRef(0);
  const timers = useRef(new Map<string, number>());
  const lastXpAt = useRef(0);
  const lastSoundAt = useRef(0);

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

  const handleEvent = useEffectEvent((event: ProgressEvent) => {
    const now = performance.now();

    const celebrate = () => {
      if (now - lastSoundAt.current < SOUND_GAP_MS) return;
      lastSoundAt.current = now;
      sound.levelUp();
    };

    const pushToast = (toast: Omit<CelebrationToast, 'id'>) => {
      nextId.current += 1;
      const id = nextId.current;
      setToasts((list) => [...list, { ...toast, id }].slice(-MAX_TOASTS));
      schedule(`toast-${id}`, TOAST_MS, () => setToasts((list) => list.filter((t) => t.id !== id)));
    };

    const fireConfetti = (pieces: number) => {
      nextId.current += 1;
      setConfetti({ key: nextId.current, pieces });
    };

    switch (event.type) {
      case 'xp': {
        if (event.amount <= 0) return;
        const merge = now - lastXpAt.current < XP_MERGE_MS;
        lastXpAt.current = now;
        nextId.current += 1;
        const key = `xp-${nextId.current}`;
        setXpFloat((prev) => ({ key, amount: merge && prev ? prev.amount + event.amount : event.amount }));
        schedule('xp', XP_FLOAT_MS, () => setXpFloat(null));
        return;
      }
      case 'levelUp': {
        celebrate();
        fireConfetti(170);
        if (immersive) {
          pushToast({
            kind: 'level',
            emoji: levelEmoji(event.level),
            title: `¡Nivel ${event.level}!`,
            body: `Ahora eres ${levelTitle(event.level)}.`,
          });
        } else {
          setLevelModal((m) => ({ open: true, level: m.open ? Math.max(m.level, event.level) : event.level }));
        }
        return;
      }
      case 'achievement': {
        const def = ACHIEVEMENTS_BY_ID[event.id];
        celebrate();
        pushToast({
          kind: 'achievement',
          emoji: def?.emoji ?? '🏅',
          title: def?.title ?? '¡Nuevo logro!',
          body: def?.description,
          href: '/logros',
        });
        return;
      }
      case 'goalMet': {
        celebrate();
        fireConfetti(80);
        pushToast({
          kind: 'goal',
          emoji: '🎯',
          title: '¡Meta diaria cumplida!',
          body: 'Tu racha sigue viva 🔥',
        });
        return;
      }
    }
  });

  useEffect(() => {
    return progressStore.onEvent((event) => handleEvent(event));
  }, []);

  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach((timer) => window.clearTimeout(timer));
      map.clear();
    };
  }, []);

  return (
    <>
      {xpFloat && <XpFloat key={xpFloat.key} amount={xpFloat.amount} />}
      <CelebrationToasts toasts={toasts} onDismiss={dismissToast} hideLinks={immersive} />
      <LevelUpModal
        open={levelModal.open}
        level={levelModal.level}
        onClose={() => setLevelModal((m) => ({ ...m, open: false }))}
      />
      {confetti && (
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
