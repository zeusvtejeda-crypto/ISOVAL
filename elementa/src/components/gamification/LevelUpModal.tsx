'use client';

import { useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { levelEmoji, levelTitle } from '@/utils/levels';
import { LevelEmblem } from './LevelEmblem';

export interface LevelUpModalProps {
  open: boolean;
  level: number;
  onClose: () => void;
}

/** Modal de subida de nivel con el nuevo título. */
export function LevelUpModal({ open, level, onClose }: LevelUpModalProps) {
  const okRef = useRef<HTMLButtonElement>(null);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="¡Subiste de nivel!"
      size="sm"
      initialFocusRef={okRef}
      footer={
        <Button ref={okRef} block size="lg" onClick={onClose}>
          ¡Genial!
        </Button>
      }
    >
      <div className="flex flex-col items-center py-2 text-center">
        <div className="relative animate-bounce-in">
          <span aria-hidden className="absolute inset-0 rounded-[2rem] animate-pulse-ring" />
          <LevelEmblem level={level} size="xl" />
        </div>
        <p className="mt-6 text-sm font-black uppercase tracking-wider text-brand">Nivel {level}</p>
        <p className="mt-1 text-2xl font-black">
          <span aria-hidden className="mr-2">
            {levelEmoji(level)}
          </span>
          {levelTitle(level)}
        </p>
        <p className="mt-2 max-w-xs text-muted">
          ¡Es tu nuevo título! Sigue sumando XP para llegar al nivel {level + 1}.
        </p>
      </div>
    </Modal>
  );
}
