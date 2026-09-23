'use client';

import { useId, type ReactNode } from 'react';
import { Play } from 'lucide-react';
import { PageHeader } from '@/components/layout';
import { Button, Skeleton, cn } from '@/components/ui';
import { GameKeyframes } from './GameKeyframes';
import { GAME_TONES, type GameTone } from './tones';

export interface GameRule {
  icon: string;
  title: string;
  text?: string;
}

export interface GameIntroProps {
  title: string;
  /** Emoji grande de la portada (si no hay `visual`). */
  emoji: string;
  /** Frase gancho de la portada. */
  tagline: ReactNode;
  tone: GameTone;
  rules: readonly GameRule[];
  /** `false` mientras se carga el progreso: récord en Skeleton y «Jugar» desactivado. */
  ready: boolean;
  /** Récord (se muestra cuando `ready`). */
  record?: ReactNode;
  /** Ilustración en lugar del emoji (p. ej. la ruleta). */
  visual?: ReactNode;
  onPlay: () => void;
  playLabel?: string;
  /** Secciones extra bajo las reglas. */
  children?: ReactNode;
}

/** Presentación de un modo de juego: portada con récord y «Jugar», y reglas en tarjetas. */
export function GameIntro({
  title,
  emoji,
  tagline,
  tone,
  rules,
  ready,
  record,
  visual,
  onPlay,
  playLabel = 'Jugar',
  children,
}: GameIntroProps) {
  const t = GAME_TONES[tone];
  const rulesId = useId();

  return (
    <div className="mx-auto w-full max-w-2xl animate-fade-in">
      <GameKeyframes />
      <PageHeader back="/jugar" backLabel="Volver a Jugar" eyebrow="Modo de juego" title={title} />
      <div className="flex flex-col gap-6">
        <section
          aria-label={`Empezar ${title}`}
          className={cn('relative isolate overflow-hidden rounded-3xl border p-5 text-center shadow-card sm:p-8', t.hero)}
        >
          <span aria-hidden className={cn('absolute -top-20 -right-16 -z-10 size-56 rounded-full opacity-30 blur-3xl', t.glowA)} />
          <span aria-hidden className={cn('absolute -bottom-24 -left-20 -z-10 size-56 rounded-full opacity-20 blur-3xl', t.glowB)} />

          {visual ?? (
            <span aria-hidden className="inline-block text-7xl leading-none animate-float sm:text-8xl">
              {emoji}
            </span>
          )}
          <p className="mx-auto mt-4 max-w-md text-2xl leading-tight font-black sm:text-3xl">{tagline}</p>

          {record !== undefined && (
            <div className="mt-4 flex min-h-10 items-center justify-center">
              {ready ? record : <Skeleton rounded="full" className="h-10 w-60 max-w-full" />}
            </div>
          )}

          <Button
            size="lg"
            onClick={onPlay}
            disabled={!ready}
            loading={!ready}
            leftIcon={<Play aria-hidden fill="currentColor" />}
            className="mt-5 w-full sm:w-auto sm:min-w-60"
          >
            {playLabel}
          </Button>
        </section>

        <section aria-labelledby={rulesId}>
          <h2 id={rulesId} className="text-xl font-black">
            Cómo se juega
          </h2>
          <ul className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {rules.map((rule, i) => (
              <li
                key={rule.title}
                className="flex items-start gap-3 rounded-3xl border border-border bg-surface p-3.5 shadow-card animate-slide-up"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <span aria-hidden className={cn('grid size-11 shrink-0 place-items-center rounded-2xl text-2xl leading-none', t.icon)}>
                  {rule.icon}
                </span>
                <span className="min-w-0 pt-0.5">
                  <span className="block leading-snug font-black">{rule.title}</span>
                  {rule.text && <span className="mt-0.5 block text-sm leading-snug font-semibold text-muted">{rule.text}</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {children}
      </div>
    </div>
  );
}

/** Píldora de récord para la portada: «🏆 Récord: 37 respuestas correctas». */
export function RecordPill({ children, empty = false }: { children: ReactNode; empty?: boolean }) {
  return (
    <p
      className={cn(
        'inline-flex max-w-full items-center gap-2 rounded-full px-4 py-2 text-sm font-extrabold sm:text-base',
        empty ? 'bg-surface/70 text-muted' : 'bg-surface text-fg shadow-card',
      )}
    >
      <span aria-hidden>{empty ? '✨' : '🏆'}</span>
      <span className="min-w-0">{children}</span>
    </p>
  );
}
