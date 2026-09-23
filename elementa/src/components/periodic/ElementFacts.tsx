import type { ReactNode } from 'react';
import { Badge, cn } from '@/components/ui';
import { CATEGORIES, PHASE_EMOJI } from '@/data/categories';
import type { ChemicalElement } from '@/types';
import { elementPhaseLabel, formatConfig, formatMass } from '@/utils/format';

interface Fact {
  label: string;
  value: ReactNode;
  hint?: string;
  wide?: boolean;
}

function facts(el: ChemicalElement): Fact[] {
  const category = CATEGORIES[el.category];
  const list: Fact[] = [
    { label: 'Número atómico', value: el.atomicNumber },
    {
      label: 'Masa atómica',
      value: `${formatMass(el)} u`,
      hint: el.massIsMassNumber ? 'Isótopo más estable' : undefined,
    },
    { label: 'Grupo', value: el.group ?? 'Bloque f', hint: el.group === null ? 'Fila inferior' : undefined },
    { label: 'Periodo', value: el.period },
    {
      label: 'Familia',
      // Texto en `fg`: varios colores de familia no llegan a 4.5:1 sobre `surface-2`.
      value: (
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden>{category.emoji}</span>
          {category.singular}
        </span>
      ),
    },
    {
      label: 'Estado',
      value: (
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden>{PHASE_EMOJI[el.phase]}</span>
          {elementPhaseLabel(el)}
        </span>
      ),
      hint:
        el.phase === 'unknown'
          ? 'Nunca se ha visto en cantidad'
          : el.phasePredicted
            ? 'Nunca se ha visto una muestra'
            : 'A 25 °C',
    },
    { label: 'Bloque', value: el.block },
  ];
  if (el.electronegativity !== null) {
    list.push({ label: 'Electronegatividad', value: el.electronegativity, hint: 'Escala de Pauling' });
  }
  list.push({
    label: 'Configuración electrónica',
    value: <span className="tracking-wide">{formatConfig(el.electronConfiguration)}</span>,
    hint: el.predicted ? 'Predicción teórica' : undefined,
    wide: true,
  });
  return list;
}

/** Datos del elemento en tarjetas pequeñas (2 columnas en móvil, 3 desde `sm`). */
export function ElementFacts({ element, className }: { element: ChemicalElement; className?: string }) {
  return (
    <div className={className}>
      {(element.radioactive || element.predicted) && (
        <div className="mb-3 flex flex-wrap gap-2">
          {element.radioactive && (
            <Badge tone="warning" size="md" icon={<span aria-hidden>☢️</span>}>
              Radiactivo
            </Badge>
          )}
          {element.predicted && (
            <Badge tone="accent" size="md" icon={<span aria-hidden>🔮</span>}>
              Propiedades teóricas
            </Badge>
          )}
        </div>
      )}
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {facts(element).map((fact) => (
          <div
            key={fact.label}
            className={cn('min-w-0 rounded-2xl bg-surface-2 px-3.5 py-3', fact.wide && 'col-span-2 sm:col-span-3')}
          >
            <dt className="text-xs font-extrabold text-muted">{fact.label}</dt>
            <dd className="mt-0.5 text-lg leading-snug font-black break-words tabular">{fact.value}</dd>
            {fact.hint && <dd className="text-xs font-semibold text-muted">{fact.hint}</dd>}
          </div>
        ))}
      </dl>
    </div>
  );
}
