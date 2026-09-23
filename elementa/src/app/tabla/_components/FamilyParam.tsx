'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { CATEGORIES } from '@/data/categories';
import type { ElementCategory } from '@/types';

/** `?family=<categoría>` → categoría válida o `null`. */
export function parseFamilyParam(value: string | null): ElementCategory | null {
  return value && Object.hasOwn(CATEGORIES, value) ? (value as ElementCategory) : null;
}

/**
 * Aplica una vez el filtro inicial de `/tabla?family=<categoría>` (p. ej. desde «Ver tabla» en
 * /bloques). Después el filtro es estado local. Lee `useSearchParams`: debe ir dentro de `<Suspense>`.
 */
export function FamilyParam({ onFamily }: { onFamily: (category: ElementCategory) => void }) {
  const family = parseFamilyParam(useSearchParams().get('family'));
  const applied = useRef(false);
  useEffect(() => {
    if (!family || applied.current) return;
    applied.current = true;
    onFamily(family);
  }, [family, onFamily]);
  return null;
}
