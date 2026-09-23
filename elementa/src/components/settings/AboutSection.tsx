import { ExternalLink } from 'lucide-react';
import { AppIcon } from '@/components/pwa';
import packageJson from '../../../package.json';

const SOURCES = [
  { name: 'IUPAC / CIAAW', what: 'masas atómicas', href: 'https://www.ciaaw.org/atomic-weights.htm' },
  { name: 'NIST', what: 'configuraciones electrónicas', href: 'https://www.nist.gov/pml/atomic-spectra-database' },
  { name: 'PubChem', what: 'familias, estados y electronegatividad', href: 'https://pubchem.ncbi.nlm.nih.gov/periodic-table/' },
] as const;

/** Identificador de la compilación (lo fija next.config.ts); se muestra abreviado. */
const BUILD = (process.env.NEXT_PUBLIC_BUILD_VERSION ?? '').slice(0, 8);

/** Versión de la app y fuentes de los datos científicos. */
export function AboutSection() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <AppIcon size={44} />
        <div className="min-w-0">
          <p className="leading-tight font-black">Elementa</p>
          <p className="text-sm font-semibold text-muted">
            Versión {packageJson.version}
            {BUILD && <span className="tabular"> · compilación {BUILD}</span>}
          </p>
        </div>
      </div>
      <div>
        <p className="text-sm font-semibold text-muted">Los datos de los 118 elementos vienen de fuentes oficiales:</p>
        <ul className="mt-1.5 flex flex-col">
          {SOURCES.map((source) => (
            <li key={source.name}>
              <a
                href={source.href}
                target="_blank"
                rel="noopener noreferrer"
                className="-mx-2 flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm hover:bg-surface-2"
              >
                <span className="shrink-0 font-extrabold text-brand">{source.name}</span>
                <span className="min-w-0 flex-1 py-1 leading-snug text-muted">· {source.what}</span>
                <ExternalLink aria-hidden className="size-4 shrink-0 text-muted" />
                <span className="sr-only">(se abre en otra pestaña)</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
