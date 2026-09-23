import { BrainCircuit, Sprout } from 'lucide-react';
import { PageHeader } from '@/components/layout';
import { ButtonLink, EmptyState } from '@/components/ui';
import type { PracticeTarget } from './target';

interface EmptyCopy {
  icon: string;
  title: string;
  description: string;
}

function emptyCopy(target: PracticeTarget): EmptyCopy {
  switch (target.source) {
    case 'elements':
      return {
        icon: '🔍',
        title: 'No encontramos esos elementos',
        description: 'El enlace no trae elementos válidos. Elige uno en la tabla o empieza una sesión nueva.',
      };
    case 'block':
      return { icon: '📦', title: 'Ese bloque no existe', description: 'Elige un bloque en «Bloques y familias».' };
    case 'family':
      return { icon: '🧪', title: 'Esa familia no existe', description: 'Elige una familia en «Bloques y familias».' };
    case 'errores':
      return {
        icon: '🎉',
        title: '¡Aún no tienes errores!',
        description: 'Juega un poco: aquí aparecerán los elementos que se te resistan.',
      };
    case 'dificiles':
      return {
        icon: '💪',
        title: '¡Nada difícil por ahora!',
        description: 'Cuando falles algún elemento, lo verás aquí para reforzarlo.',
      };
    case 'repaso':
      return {
        icon: '✅',
        title: '¡Estás al día!',
        description: 'No tienes repasos pendientes. Aprende elementos nuevos o vuelve mañana.',
      };
    default:
      return { icon: '🧪', title: 'Nada que practicar', description: 'Empieza aprendiendo algunos elementos.' };
  }
}

/** Sin elementos que practicar: mensaje amable y accesos para seguir aprendiendo. */
export function PracticeEmpty({ target }: { target: PracticeTarget }) {
  const copy = emptyCopy(target);
  const wrongLink = target.invalid && (target.source === 'block' || target.source === 'family');
  return (
    <>
      <PageHeader back backLabel="Volver" eyebrow={`${target.emoji} Práctica`} title={target.title} />
      <EmptyState
        icon={copy.icon}
        title={copy.title}
        description={copy.description}
        className="flex-1 justify-center"
        action={
          <>
            {wrongLink && (
              <ButtonLink href="/bloques" variant="primary">
                Bloques y familias
              </ButtonLink>
            )}
            <ButtonLink href="/aprende" variant={wrongLink ? 'secondary' : 'primary'} leftIcon={<Sprout aria-hidden />}>
              Aprende 5
            </ButtonLink>
            <ButtonLink href="/estudiar" variant="secondary" leftIcon={<BrainCircuit aria-hidden />}>
              Estudiar ahora
            </ButtonLink>
          </>
        }
      />
    </>
  );
}
