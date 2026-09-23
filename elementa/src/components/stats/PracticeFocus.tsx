import Link from 'next/link';
import { ChevronRight, Dumbbell } from 'lucide-react';
import { ButtonLink, Card, ProgressBar, cn, type Tone } from '@/components/ui';
import { getElement } from '@/data/elements';
import type { MasteryTier, ProgressState } from '@/types';
import { formatNumber, formatPercent } from '@/utils/format';
import { TIER_META, masteryTier } from '@/utils/mastery';
import { SKILL_META, typesForSkill } from './labels';
import { skillWeakElements, type FamilyStat, type SkillStat } from './stats-data';

const TIER_TONE: Record<MasteryTier, Tone> = {
  practice: 'danger',
  learning: 'streak',
  almost: 'warning',
  mastered: 'success',
};

export interface PracticeFocusProps {
  state: ProgressState;
  families: readonly FamilyStat[];
  weakElements: ReadonlyArray<{ atomicNumber: number; mastery: number }>;
  skills: readonly SkillStat[];
}

function Subheading({ children }: { children: string }) {
  return <h4 className="text-xs font-black tracking-wider text-muted uppercase">{children}</h4>;
}

/** "Lo que debes practicar": familias flojas, elementos flojos y precisión por habilidad, con enlaces a practicar. */
export function PracticeFocus({ state, families, weakElements, skills }: PracticeFocusProps) {
  const empty = families.length === 0 && weakElements.length === 0 && skills.length === 0;

  return (
    <Card as="section" aria-labelledby="practice-focus-title" className="flex flex-col gap-5">
      <div>
        <h3 id="practice-focus-title" className="text-lg leading-tight font-black">
          <span aria-hidden className="mr-1.5">
            🎯
          </span>
          Lo que debes practicar
        </h3>
        <p className="mt-0.5 text-sm font-semibold text-muted">Tus puntos débiles, listos para convertirse en fuertes.</p>
      </div>

      {empty && (
        <p className="rounded-2xl bg-surface-2 p-4 font-bold">
          <span aria-hidden>🔍 </span>
          Cuando respondas algunas preguntas, aquí verás qué reforzar.
        </p>
      )}

      {weakElements.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <Subheading>Elementos más flojos</Subheading>
          <ul className="flex flex-wrap gap-2">
            {weakElements.map(({ atomicNumber, mastery }) => {
              const el = getElement(atomicNumber);
              const meta = TIER_META[masteryTier(mastery)];
              return (
                <li key={atomicNumber}>
                  <Link
                    href={`/practicar?elements=${atomicNumber}`}
                    aria-label={`Practicar ${el.name}: dominio ${mastery}%`}
                    className="flex min-h-11 items-center gap-2 rounded-2xl border-2 border-border bg-surface px-3 font-bold transition-[transform,border-color] hover:border-border-strong active:scale-[0.96]"
                  >
                    <span className="font-black">{el.symbol}</span>
                    <span aria-hidden className={cn('text-xs font-black tabular', meta.textClass)}>
                      {meta.emoji} {mastery}%
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <ButtonLink
            href="/practicar?focus=dificiles"
            size="sm"
            variant="secondary"
            leftIcon={<Dumbbell aria-hidden />}
            className="self-start"
          >
            Practicar los más flojos
          </ButtonLink>
        </div>
      )}

      {families.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Subheading>Familias por reforzar</Subheading>
          <ul className="flex flex-col">
            {families.map((f) => (
              <li key={f.group.id}>
                <Link
                  href={`/practicar?family=${f.group.id}`}
                  className="group -mx-2 flex min-h-11 items-center gap-3 rounded-2xl px-2 py-1.5 transition-colors hover:bg-surface-2"
                >
                  <span aria-hidden className="text-xl leading-none">
                    {f.group.emoji}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-bold">{f.group.title}</span>
                  <span className={cn('shrink-0 text-sm font-black tabular', TIER_META[masteryTier(f.average)].textClass)}>
                    {f.average}%<span className="sr-only"> de dominio medio</span>
                  </span>
                  <ChevronRight aria-hidden className="size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {skills.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <Subheading>Precisión por habilidad</Subheading>
          <ul className="flex flex-col gap-3">
            {skills.map((s) => {
              const meta = SKILL_META[s.skill];
              const pct = Math.round(s.accuracy * 100);
              const weak = skillWeakElements(state, s.skill);
              const href = `/practicar?elements=${weak.join(',')}&types=${typesForSkill(s.skill).join(',')}`;
              return (
                <li key={s.skill} className="flex items-center gap-3">
                  <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-lg">
                    {meta.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <ProgressBar
                      value={s.accuracy}
                      tone={TIER_TONE[masteryTier(pct)]}
                      size="sm"
                      label={meta.label}
                      showValue
                      valueText={`${formatPercent(s.accuracy)} · ${formatNumber(s.correct)}/${formatNumber(s.total)}`}
                      ariaLabel={`Precisión en ${meta.label.toLowerCase()}`}
                    />
                  </div>
                  {weak.length > 0 && pct < 100 ? (
                    <Link
                      href={href}
                      aria-label={`Practicar ${meta.label.toLowerCase()}`}
                      className="grid size-11 shrink-0 place-items-center rounded-2xl text-brand transition-colors hover:bg-brand-soft active:scale-95"
                    >
                      <Dumbbell aria-hidden className="size-5" />
                    </Link>
                  ) : (
                    <span aria-hidden className="grid size-11 shrink-0 place-items-center text-lg">
                      ✅
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Card>
  );
}
