import { ElementTile } from '@/components/periodic';
import { ELEMENTS_BY_NUMBER } from '@/data/elements';

const OXYGEN = ELEMENTS_BY_NUMBER[8];

const TIPS = [
  { emoji: '↔️', text: 'Las columnas son los grupos (1–18): sus elementos se parecen entre sí.' },
  { emoji: '↕️', text: 'Las filas son los periodos (1–7): el número crece de izquierda a derecha.' },
  { emoji: '🎨', text: 'El color indica la familia. Filtra una arriba para verla destacada.' },
];

/** Mini guía para leer la tabla y una casilla de ejemplo. */
export function TableGuide() {
  return (
    <section aria-labelledby="table-guide-title" className="rounded-3xl border border-border bg-surface p-4 shadow-card sm:p-5">
      <h2 id="table-guide-title" className="font-black">
        Cómo leer la tabla
      </h2>
      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center">
        {OXYGEN && (
          <figure className="flex shrink-0 items-center gap-3">
            <ElementTile element={OXYGEN} size="md" decorative />
            <figcaption className="text-sm leading-snug font-bold text-muted">
              <span className="block">
                <span className="text-fg">8</span> · número atómico
              </span>
              <span className="block">
                <span className="text-fg">O</span> · símbolo
              </span>
              <span className="block">
                <span className="text-fg">Oxígeno</span> · nombre
              </span>
            </figcaption>
          </figure>
        )}
        <ul className="flex flex-col gap-2 text-sm font-semibold sm:border-l sm:border-border sm:pl-5">
          {TIPS.map((tip) => (
            <li key={tip.text} className="flex gap-2">
              <span aria-hidden>{tip.emoji}</span>
              <span>{tip.text}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
