import { Clock, ListChecks, Play } from 'lucide-react';
import { Button, cn, type Tone, TONE_SOFT } from '@/components/ui';
import type { StudyPlan } from '@/utils/planner';
import { pluralize } from '@/utils/format';
import { ElementChips, type ChipTone } from './ElementChips';

export interface StudyPlanViewProps {
  plan: StudyPlan;
  onStart: () => void;
}

interface PlanRowProps {
  emoji: string;
  tone: Tone;
  title: string;
  hint: string;
  atomicNumbers: readonly number[];
  chipTone?: ChipTone;
}

function PlanRow({ emoji, tone, title, hint, atomicNumbers, chipTone = 'neutral' }: PlanRowProps) {
  const empty = atomicNumbers.length === 0;
  return (
    <li className={cn('flex gap-3.5 py-3.5 first:pt-0 last:pb-0', empty && 'opacity-75')}>
      <span aria-hidden className={cn('grid size-12 shrink-0 place-items-center rounded-2xl text-2xl', TONE_SOFT[tone])}>
        {emoji}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-lg leading-tight font-black">{title}</p>
        <p className="text-sm font-semibold text-muted">{hint}</p>
        {!empty && (
          <ElementChips atomicNumbers={atomicNumbers} tone={chipTone} max={10} label={title} className="mt-2" />
        )}
      </div>
    </li>
  );
}

/** Elementos distintos de las preguntas, en orden de aparición. */
function questionElements(plan: StudyPlan): number[] {
  return Array.from(new Set(plan.questions.map((q) => q.atomicNumber)));
}

/** Pantalla «Sesión de hoy»: qué se va a estudiar, cuánto dura y «Comenzar sesión». */
export function StudyPlanView({ plan, onStart }: StudyPlanViewProps) {
  const nNew = plan.newElements.length;
  const nReview = plan.reviews.length;
  const nHard = plan.hard.length;
  const upToDate = nNew + nReview + nHard === 0;
  const questions = plan.questions.length;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 animate-fade-in">
      {upToDate && (
        <div role="status" className="flex items-center gap-3 rounded-3xl border-2 border-success/30 bg-success-soft p-4">
          <span aria-hidden className="text-3xl leading-none">
            ✨
          </span>
          <div className="min-w-0">
            <p className="text-lg leading-tight font-black text-success">¡Estás al día!</p>
            <p className="text-sm font-semibold text-fg/80">No tienes repasos pendientes. Te preparamos un repaso variado.</p>
          </div>
        </div>
      )}

      <section aria-labelledby="plan-title" className="rounded-3xl border border-border bg-surface p-5 shadow-card">
        <h2 id="plan-title" className="mb-4 flex items-center gap-2 text-xl font-black">
          <span aria-hidden>📋</span> Sesión de hoy
        </h2>
        <ul className="divide-y divide-border">
          {upToDate ? (
            <PlanRow
              emoji="🎲"
              tone="accent"
              title="Repaso variado"
              hint="Elementos que ya conoces, para que no se te olviden."
              atomicNumbers={questionElements(plan)}
            />
          ) : (
            <>
              <PlanRow
                emoji="🌱"
                tone="success"
                title={`${nNew} ${pluralize(nNew, 'elemento nuevo', 'elementos nuevos')}`}
                hint={nNew > 0 ? 'Primero los conocerás, uno por uno.' : 'Hoy no hay elementos nuevos.'}
                atomicNumbers={plan.newElements}
                chipTone="success"
              />
              <PlanRow
                emoji="🔁"
                tone="brand"
                title={`${nReview} ${pluralize(nReview, 'repaso', 'repasos')}`}
                hint={nReview > 0 ? 'Justo a tiempo, antes de que se te olviden.' : 'Nada pendiente por hoy.'}
                atomicNumbers={plan.reviews}
                chipTone="brand"
              />
              <PlanRow
                emoji="🎯"
                tone="danger"
                title={`${nHard} ${pluralize(nHard, 'elemento difícil', 'elementos difíciles')}`}
                hint={nHard > 0 ? 'Los que más te cuestan, con preguntas clave.' : '¡Ninguno se te resiste!'}
                atomicNumbers={plan.hard}
                chipTone="danger"
              />
            </>
          )}
        </ul>

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl bg-surface-2 px-4 py-3 text-sm font-bold">
          <span className="inline-flex items-center gap-2">
            <Clock aria-hidden className="size-4 text-brand" />
            Duración aproximada: {plan.estimatedMinutes} {pluralize(plan.estimatedMinutes, 'minuto', 'minutos')}
          </span>
          <span className="inline-flex items-center gap-2">
            <ListChecks aria-hidden className="size-4 text-brand" />
            {questions} {pluralize(questions, 'pregunta', 'preguntas')}
          </span>
        </div>
      </section>

      <Button size="lg" block leftIcon={<Play aria-hidden />} onClick={onStart}>
        Comenzar sesión
      </Button>
      <p className="text-center text-sm font-semibold text-muted">
        {nNew > 0 ? 'Primero conocerás los nuevos y luego responderás preguntas.' : 'Tu progreso se guarda con cada respuesta.'}
      </p>
    </div>
  );
}
