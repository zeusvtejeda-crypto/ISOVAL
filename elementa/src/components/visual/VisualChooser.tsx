'use client';

import { useMemo } from 'react';
import { PageHeader } from '@/components/layout';
import { Card } from '@/components/ui';
import { useProgress } from '@/hooks/useProgress';
import { skillTotals } from '@/components/stats/stats-data';
import { VISUAL_MODES, type VisualMode, type VisualModeId } from './modes';
import { TableArt } from './TableArt';
import { VisualModeCard } from './VisualModeCard';

export interface VisualChooserProps {
  onStart: (mode: VisualMode) => void;
}

/** Selector de retos visuales sobre la tabla periódica. */
export function VisualChooser({ onStart }: VisualChooserProps) {
  const { state } = useProgress();
  const mixed = VISUAL_MODES.find((m) => m.id === 'mixto');
  const rest = VISUAL_MODES.filter((m) => m.id !== 'mixto');

  // Tu precisión en la habilidad de cada reto (todas las preguntas de esa habilidad, no solo las visuales).
  const accuracy = useMemo(() => {
    const out: Partial<Record<VisualModeId, number>> = {};
    for (const mode of VISUAL_MODES) {
      if (!mode.skill) continue;
      const { correct, total } = skillTotals(state, mode.skill);
      if (total > 0) out[mode.id] = correct / total;
    }
    return out;
  }, [state]);

  return (
    <>
      <PageHeader
        back="/jugar"
        backLabel="Volver a Jugar"
        eyebrow="Modo de juego"
        title="Visual"
        subtitle="Aprende dónde vive cada elemento tocando la tabla."
      />

      <Card as="section" aria-labelledby="visual-hero-title" padding="lg" className="mb-6 overflow-hidden">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-7">
          <TableArt className="w-full pt-5 sm:w-[46%] sm:shrink-0" />
          <div className="min-w-0">
            <h2 id="visual-hero-title" className="text-xl leading-tight font-black sm:text-2xl">
              Tu memoria, en el mapa
            </h2>
            <p className="mt-1 text-sm font-semibold text-muted sm:text-base">
              Grupo, periodo y familia: cuando sabes <em>dónde</em> está un elemento, ya sabes mucho de él.
            </p>
            <ul className="mt-3 flex flex-col gap-1 text-sm font-bold">
              <li>
                <span aria-hidden>↕️ </span>Grupo = columna (1–18)
              </li>
              <li>
                <span aria-hidden>↔️ </span>Periodo = fila (1–7)
              </li>
              <li>
                <span aria-hidden>🎨 </span>Cada familia tiene su zona
              </li>
            </ul>
          </div>
        </div>
      </Card>

      <section aria-labelledby="visual-modes-title">
        <h2 id="visual-modes-title" className="mb-3 text-lg font-black sm:text-xl">
          Elige un reto
        </h2>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {rest.map((mode, i) => (
            <li key={mode.id} className="flex animate-slide-up" style={{ animationDelay: `${i * 50}ms` }}>
              <VisualModeCard mode={mode} onStart={onStart} accuracy={accuracy[mode.id] ?? null} />
            </li>
          ))}
          {mixed && (
            <li className="flex animate-slide-up sm:col-span-2" style={{ animationDelay: `${rest.length * 50}ms` }}>
              <VisualModeCard mode={mixed} onStart={onStart} featured />
            </li>
          )}
        </ul>
      </section>

      <div className="mt-6 flex flex-col items-center gap-1 text-center text-sm font-bold text-muted">
        <p>
          <span aria-hidden>💡 </span>
          En el móvil, desliza la tabla o toca «Ajustar a pantalla» para verla entera.
        </p>
        <p>
          <span aria-hidden>🎁 </span>
          +10 XP por acierto (+15 en las difíciles) · +20 XP al terminar
        </p>
      </div>
    </>
  );
}
