import Link from 'next/link';
import { TONE_SOFT, cn, type Tone } from '@/components/ui';
import type { PersonalRecords } from '@/types';
import { formatNumber, pluralize } from '@/utils/format';

interface RecordItem {
  key: string;
  emoji: string;
  title: string;
  value: number;
  /** Unidad tras el número ("aciertos"); vacía para porcentajes. */
  unit: (n: number) => string;
  percent?: boolean;
  /** Modo donde se consigue (o `null` si es global). */
  href: string | null;
  tone: Tone;
}

export interface RecordsGridProps {
  records: PersonalRecords;
  /** Mejor racha de días con la meta cumplida. */
  bestDayStreak: number;
}

/** Récords personales: Contrarreloj, Supervivencia, Modo Racha, mejor examen y rachas. */
export function RecordsGrid({ records, bestDayStreak }: RecordsGridProps) {
  const items: RecordItem[] = [
    {
      key: 'timeAttack',
      emoji: '⏱️',
      title: 'Contrarreloj',
      value: records.timeAttackBest,
      unit: (n) => pluralize(n, 'acierto', 'aciertos'),
      href: '/contrarreloj',
      tone: 'streak',
    },
    {
      key: 'survival',
      emoji: '❤️',
      title: 'Supervivencia',
      value: records.survivalBest,
      unit: (n) => pluralize(n, 'acierto', 'aciertos'),
      href: '/supervivencia',
      tone: 'danger',
    },
    {
      key: 'streakMode',
      emoji: '🔥',
      title: 'Modo Racha',
      value: records.streakModeBest,
      unit: (n) => pluralize(n, 'seguido', 'seguidos'),
      href: '/racha',
      tone: 'streak',
    },
    {
      key: 'exam',
      emoji: '📝',
      title: 'Mejor examen',
      value: Math.round(records.bestExamPct),
      unit: () => '',
      percent: true,
      href: '/examen',
      tone: 'accent',
    },
    {
      key: 'answers',
      emoji: '🧠',
      title: 'Mejor racha de aciertos',
      value: records.bestAnswerStreak,
      unit: (n) => pluralize(n, 'seguido', 'seguidos'),
      href: null,
      tone: 'brand',
    },
    {
      key: 'days',
      emoji: '📆',
      title: 'Mejor racha de días',
      value: bestDayStreak,
      unit: (n) => pluralize(n, 'día', 'días'),
      href: null,
      tone: 'xp',
    },
  ];

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {items.map((item) => {
        const has = item.value > 0;
        const valueText = item.percent ? `${item.value}%` : formatNumber(item.value);
        const unitText = item.unit(item.value);
        const body = (
          <>
            <span aria-hidden className={cn('grid size-10 place-items-center rounded-2xl text-xl leading-none', TONE_SOFT[item.tone])}>
              {item.emoji}
            </span>
            <span className="mt-2 block text-sm font-bold text-muted">{item.title}</span>
            {has ? (
              <span className="block text-2xl leading-tight font-black">
                {valueText}
                {unitText && <span className="ml-1 text-sm font-extrabold text-muted">{unitText}</span>}
              </span>
            ) : (
              <span className="block text-lg leading-tight font-black text-muted">
                —<span className="ml-1.5 text-xs font-bold">{item.href ? '¡Estrénalo!' : 'Aún sin récord'}</span>
              </span>
            )}
          </>
        );
        const classes = 'flex h-full flex-col rounded-3xl border border-border bg-surface p-4 shadow-card';
        return (
          <li key={item.key}>
            {item.href ? (
              <Link
                href={item.href}
                className={cn(
                  classes,
                  'transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-float active:scale-[0.98] motion-reduce:hover:translate-y-0',
                )}
              >
                {body}
              </Link>
            ) : (
              <div className={classes}>{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
