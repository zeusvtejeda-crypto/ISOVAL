import { BookOpen, Target, X } from 'lucide-react';
import { ButtonLink, IconButton, cn } from '@/components/ui';
import { CATEGORIES } from '@/data/categories';
import { ELEMENTS } from '@/data/elements';
import type { ElementCategory } from '@/types';
import { pluralize } from '@/utils/format';

interface FamilyInfoProps {
  category: ElementCategory;
  onClear: () => void;
}

/** Tarjeta de la familia filtrada: qué es y accesos para aprenderla o practicarla. */
export function FamilyInfo({ category, onClear }: FamilyInfoProps) {
  const meta = CATEGORIES[category];
  const count = ELEMENTS.filter((el) => el.category === category).length;
  return (
    <section
      aria-labelledby="family-info-title"
      className={cn('relative flex flex-col gap-3 rounded-3xl border-2 p-4 pr-14 animate-fade-in sm:flex-row sm:items-center sm:pr-4', meta.tileClass)}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span aria-hidden className="text-3xl leading-none">
          {meta.emoji}
        </span>
        <div className="min-w-0">
          <h2 id="family-info-title" className="text-lg leading-tight font-black">
            {meta.label}{' '}
            <span className="text-sm font-extrabold whitespace-nowrap opacity-75">
              · {count} {pluralize(count, 'elemento', 'elementos')}
            </span>
          </h2>
          <p className="mt-0.5 text-sm font-semibold">{meta.blurb}</p>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        <ButtonLink href={`/aprende?family=${category}`} size="sm" leftIcon={<BookOpen aria-hidden />}>
          Aprender
        </ButtonLink>
        <ButtonLink href={`/practicar?family=${category}`} size="sm" variant="secondary" leftIcon={<Target aria-hidden />}>
          Practicar
        </ButtonLink>
      </div>
      <span className="absolute top-2.5 right-2.5 flex sm:static">
        <IconButton label="Quitar filtro de familia" icon={<X />} size="sm" onClick={onClear} />
      </span>
    </section>
  );
}
