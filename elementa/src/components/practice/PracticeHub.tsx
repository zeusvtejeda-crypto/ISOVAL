'use client';

import { ChevronRight } from 'lucide-react';
import { ExamTypeCard } from '@/components/exam/ExamTypeCard';
import { PageHeader } from '@/components/layout';
import { Badge, type Tone } from '@/components/ui';
import { FAMILY_GROUPS, STUDY_BLOCKS } from '@/data/blocks';
import { useNow } from '@/hooks/useNow';
import { useProgress } from '@/hooks/useProgress';
import { pluralize } from '@/utils/format';
import { practiceCounts } from './target';

interface HubOption {
  href: string;
  emoji: string;
  title: string;
  description: string;
  tone: Tone;
  badge: string;
}

/** `/practicar` sin parámetros: elige qué reforzar (errores, difíciles, repasos, bloques). */
export function PracticeHub() {
  const { state } = useProgress();
  const now = useNow();
  const counts = practiceCounts(state, now);

  const options: HubOption[] = [
    {
      href: '/practicar?focus=errores',
      emoji: '🎯',
      title: 'Mis errores',
      description: 'Los elementos que fallaste hace poco.',
      tone: 'danger',
      badge:
        counts.mistakes > 0
          ? `${counts.mistakes} ${pluralize(counts.mistakes, 'elemento', 'elementos')}`
          : counts.weak > 0
            ? 'Usa tus difíciles'
            : 'Sin errores',
    },
    {
      href: '/practicar?focus=dificiles',
      emoji: '💪',
      title: 'Los difíciles',
      description: 'Los que menos dominas, hasta que los domines.',
      tone: 'streak',
      badge: counts.weak > 0 ? `${counts.weak} por reforzar` : 'Nada difícil',
    },
    {
      href: '/practicar?focus=repaso',
      emoji: '🔁',
      title: 'Repaso pendiente',
      description: 'Lo que toca repasar hoy para no olvidarlo.',
      tone: 'brand',
      badge: counts.due > 0 ? `${counts.due} ${pluralize(counts.due, 'pendiente', 'pendientes')}` : 'Al día',
    },
    {
      href: '/bloques',
      emoji: '🧱',
      title: 'Bloques y familias',
      description: 'Practica de 10 en 10 o por familias.',
      tone: 'accent',
      badge: `${STUDY_BLOCKS.length} bloques · ${FAMILY_GROUPS.length} familias`,
    },
  ];

  return (
    <>
      <PageHeader back backLabel="Volver" eyebrow="Refuerza" title="Practicar" subtitle="Elige qué quieres reforzar hoy." />
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {options.map((option, i) => (
          <li key={option.href} className="flex animate-slide-up" style={{ animationDelay: `${i * 50}ms` }}>
            <ExamTypeCard
              emoji={option.emoji}
              title={option.title}
              description={option.description}
              tone={option.tone}
              href={option.href}
              actionIcon={<ChevronRight />}
              meta={<Badge tone={option.tone}>{option.badge}</Badge>}
            />
          </li>
        ))}
      </ul>
    </>
  );
}
