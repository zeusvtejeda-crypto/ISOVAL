'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useNow } from '@/hooks/useNow';
import { useProgress } from '@/hooks/useProgress';
import { parsePracticeParams, type PracticeParams } from './params';
import { PracticeEmpty } from './PracticeEmpty';
import { PracticeHub } from './PracticeHub';
import { PracticeIntro, practiceQuestionCount } from './PracticeIntro';
import { PracticeRun, type PracticePlan } from './PracticeRun';
import { PracticeSkeleton } from './PracticeSkeleton';
import { isFocusSource, resolvePracticeTarget } from './target';

function PracticeFlow({ params }: { params: PracticeParams }) {
  const { state, ready } = useProgress();
  const now = useNow();
  const [count, setCount] = useState(params.count);
  const [plan, setPlan] = useState<PracticePlan | null>(null);
  const planIds = useRef(0);
  const target = useMemo(() => resolvePracticeTarget(params, state, now), [params, state, now]);

  // La presentación empieza arriba al volver de una sesión.
  const running = plan !== null;
  useEffect(() => {
    if (!running) window.scrollTo({ top: 0, behavior: 'instant' });
  }, [running]);

  const practiceElements = (elements: number[]) => {
    if (!plan || elements.length === 0) return;
    planIds.current += 1;
    // Los fallos de la sesión se practican enfocados: cada uno sale varias veces.
    setPlan({ ...plan, id: planIds.current, title: 'Tus errores', elements, focused: true });
  };

  if (!ready) return <PracticeSkeleton />;
  if (plan) {
    return <PracticeRun key={plan.id} plan={plan} onExit={() => setPlan(null)} onPracticeElements={practiceElements} />;
  }
  if (target.source === 'none') return <PracticeHub />;
  if (target.elements.length === 0) return <PracticeEmpty target={target} />;

  const start = () => {
    if (practiceQuestionCount(target, count) === 0) return;
    planIds.current += 1;
    setPlan({
      id: planIds.current,
      title: target.title,
      elements: [...target.elements],
      types: [...target.types],
      count,
      focused: isFocusSource(target.source),
    });
  };

  return (
    <PracticeIntro
      target={target}
      suggestedCount={params.count}
      count={count}
      onCountChange={setCount}
      onStart={start}
    />
  );
}

/**
 * /practicar: práctica genérica. Lee `?focus=errores|dificiles|repaso`, `?elements=19,26`,
 * `?block=b1`, `?family=<categoría>`, `?n=10` y `?types=…`. Un cambio de parámetros reinicia el flujo.
 * Debe renderizarse dentro de `<Suspense>` (usa `useSearchParams`).
 */
export function PracticeApp() {
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const params = useMemo(() => parsePracticeParams(new URLSearchParams(query)), [query]);
  return <PracticeFlow key={query} params={params} />;
}
