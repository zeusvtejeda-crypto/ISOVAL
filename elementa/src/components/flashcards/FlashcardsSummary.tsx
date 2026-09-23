'use client';

import { House, Layers, RotateCcw } from 'lucide-react';
import { Confetti } from '@/components/gamification/Confetti';
import { ElementChips } from '@/components/learn/ElementChips';
import { SummaryRow } from '@/components/learn/SummaryParts';
import { SummaryAchievements } from '@/components/quiz/SummaryAchievements';
import { Button, ButtonLink, ProgressRing, StatTile, cn, type Tone } from '@/components/ui';
import { formatDuration, formatNumber, formatPercent, pluralize } from '@/utils/format';
import { getFlashcardMode } from './modes';
import { RATINGS } from './ratings';
import { knownCount, type FlashcardSessionResult } from './session';

export interface FlashcardsSummaryProps {
  result: FlashcardSessionResult;
  /** «Repasar las difíciles»: nueva ronda con las tarjetas «No lo sabía» y «Casi». */
  onRetryDifficult: () => void;
  /** «Otro mazo»: vuelve a la configuración. */
  onNewDeck: () => void;
  homeHref?: string;
}

function cheer(ratio: number): string {
  if (ratio === 1) return '¡Perfecto! Te las sabías todas.';
  if (ratio >= 0.8) return '¡Excelente memoria!';
  if (ratio >= 0.5) return '¡Buen repaso! Las difíciles volverán pronto.';
  return 'Repasar es aprender: dale otra vuelta a las difíciles.';
}

function ringTone(ratio: number): Tone {
  if (ratio >= 0.8) return 'success';
  if (ratio >= 0.5) return 'brand';
  return 'warning';
}

/** Resumen de la sesión: tarjetas, calificaciones, XP, mejoras, difíciles y acciones. */
export function FlashcardsSummary({ result, onRetryDifficult, onNewDeck, homeHref = '/' }: FlashcardsSummaryProps) {
  const { counts, reviews, difficult } = result;
  const mode = getFlashcardMode(result.deck.modeId);
  const total = reviews.length;
  const known = knownCount(counts);
  const ratio = total > 0 ? known / total : 0;
  const cards = result.deck.elements.length;
  const repeats = Math.max(0, total - cards);
  const celebrate = total >= 5 && ratio >= 0.8;

  return (
    <section
      aria-labelledby="flashcards-summary-title"
      className="mx-auto flex w-full max-w-xl flex-col gap-4 pb-4 animate-fade-in"
    >
      {celebrate && <Confetti pieces={110} />}

      <header className="pt-2 text-center">
        <p className="text-sm font-black tracking-wide text-brand uppercase">
          {mode.title} · {result.deck.title}
        </p>
        <h1 id="flashcards-summary-title" className="mt-1 text-3xl font-black sm:text-4xl">
          ¡Mazo completado! <span aria-hidden>🎉</span>
        </h1>
        <p className="mt-1.5 font-semibold text-muted sm:text-lg">{cheer(ratio)}</p>
      </header>

      <div className="flex items-center justify-center gap-5 rounded-3xl border border-border bg-surface p-5 shadow-card sm:gap-8">
        <ProgressRing
          value={ratio}
          size={112}
          stroke={12}
          tone={ringTone(ratio)}
          label={`Te las sabías: ${formatPercent(ratio)}`}
        >
          <span className="text-2xl font-black tabular">{formatPercent(ratio)}</span>
        </ProgressRing>
        <div className="min-w-0">
          <p className="text-5xl leading-none font-black tabular animate-bounce-in">{cards}</p>
          <p className="mt-1.5 font-bold text-muted">
            {pluralize(cards, 'tarjeta repasada', 'tarjetas repasadas')}
          </p>
          {repeats > 0 && (
            <p className="mt-0.5 text-sm font-semibold text-muted">
              + {repeats} {pluralize(repeats, 'repetición', 'repeticiones')}
            </p>
          )}
        </div>
      </div>

      <section aria-labelledby="flashcards-ratings" className="rounded-3xl border border-border bg-surface p-4 shadow-card">
        <h2 id="flashcards-ratings" className="font-black">
          Tus respuestas
        </h2>
        <div aria-hidden className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-surface-2">
          {RATINGS.map((r) =>
            counts[r.id] > 0 ? (
              <span
                key={r.id}
                className={cn('h-full', r.barClass)}
                style={{ width: `${(counts[r.id] / Math.max(1, total)) * 100}%` }}
              />
            ) : null,
          )}
        </div>
        <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {RATINGS.map((r, i) => (
            <li
              key={r.id}
              style={{ animationDelay: `${i * 70}ms` }}
              className={cn('flex items-center gap-2 rounded-2xl px-3 py-2 animate-pop', r.softClass)}
            >
              <span aria-hidden className="text-xl leading-none">
                {r.emoji}
              </span>
              <span className="min-w-0">
                <span className="block text-xl leading-none font-black tabular">{counts[r.id]}</span>
                <span className="block truncate text-xs font-bold text-fg/80">{r.label}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <StatTile icon="⚡" tone="xp" label="XP ganada" value={`+${formatNumber(result.xpGained)} XP`} />
        <StatTile icon="⏱" tone="brand" label="Tiempo" value={formatDuration(result.durationMs)} />
      </div>

      <SummaryAchievements ids={result.unlockedAchievements} />
      {/* Listas compactas: una fila de fichas cada una, lo que no cabe se resume en «+N». */}
      {(result.improved.length > 0 || difficult.length > 0) && (
        <div className="divide-y divide-border rounded-3xl border border-border bg-surface p-4 shadow-card">
          {result.improved.length > 0 && (
            <SummaryRow emoji="📈" title="Hoy mejoraste">
              <ElementChips atomicNumbers={result.improved} showNames tone="success" singleRow label="Elementos que mejoraste" />
            </SummaryRow>
          )}
          {difficult.length > 0 && (
            <SummaryRow emoji="🔁" title="Elementos que debes repasar">
              <ElementChips atomicNumbers={difficult} showNames tone="danger" singleRow label="Elementos que debes repasar" />
            </SummaryRow>
          )}
        </div>
      )}

      <div className="mt-2 flex flex-col gap-2.5">
        {difficult.length > 0 && (
          <Button size="lg" block leftIcon={<RotateCcw aria-hidden />} onClick={onRetryDifficult}>
            Repasar las difíciles ({difficult.length})
          </Button>
        )}
        <Button
          variant={difficult.length > 0 ? 'secondary' : 'primary'}
          size="lg"
          block
          leftIcon={<Layers aria-hidden />}
          onClick={onNewDeck}
        >
          Otro mazo
        </Button>
        <ButtonLink href={homeHref} variant="ghost" size="lg" block leftIcon={<House aria-hidden />}>
          Volver al inicio
        </ButtonLink>
      </div>
    </section>
  );
}
