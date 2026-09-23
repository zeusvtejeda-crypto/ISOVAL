'use client';

import { useMemo } from 'react';
import { useNow } from '@/hooks/useNow';
import { useProgress } from '@/hooks/useProgress';
import { pluralize } from '@/utils/format';
import { planStudySession } from '@/utils/planner';

export interface StudyPreview {
  newCount: number;
  reviewCount: number;
  hardCount: number;
  questionCount: number;
  minutes: number;
}

/**
 * Vista previa de la sesión inteligente de hoy (la misma que arma `/estudiar`).
 * `null` hasta que carga el progreso: el plan usa aleatoriedad y la fecha, así que solo se
 * calcula en el cliente con el progreso listo (nunca en el render del servidor).
 */
export function useStudyPreview(): StudyPreview | null {
  const { state, ready } = useProgress();
  const now = useNow();

  return useMemo(() => {
    if (!ready) return null;
    const plan = planStudySession(state, now);
    return {
      newCount: plan.newElements.length,
      reviewCount: plan.reviews.length,
      hardCount: plan.hard.length,
      questionCount: plan.questions.length,
      minutes: plan.estimatedMinutes,
    };
  }, [ready, state, now]);
}

/** Partes legibles: ["5 nuevos", "3 repasos", "2 difíciles"] (omite las que son 0). */
export function previewParts(p: StudyPreview): string[] {
  const parts: string[] = [];
  if (p.newCount > 0) parts.push(`${p.newCount} ${pluralize(p.newCount, 'nuevo', 'nuevos')}`);
  if (p.reviewCount > 0) parts.push(`${p.reviewCount} ${pluralize(p.reviewCount, 'repaso', 'repasos')}`);
  if (p.hardCount > 0) parts.push(`${p.hardCount} ${pluralize(p.hardCount, 'difícil', 'difíciles')}`);
  if (parts.length === 0) parts.push('Repaso variado');
  return parts;
}
