import { CATEGORIES, PHASE_LABELS } from '@/data/categories';
import type { ChemicalElement, ElementCategory, Phase } from '@/types';

const SUPERSCRIPTS: Record<string, string> = {
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
};

const numberFormatter = new Intl.NumberFormat('es-MX');

/** "15.999"; entre corchetes si es el número másico del isótopo más estable: "[98]". */
export function formatMass(el: Pick<ChemicalElement, 'atomicMass' | 'massIsMassNumber'>): string {
  return el.massIsMassNumber ? `[${el.atomicMass}]` : String(el.atomicMass);
}

/** "[He] 2s2 2p4" → "[He] 2s² 2p⁴". */
export function formatConfig(cfg: string): string {
  return cfg.replace(/([spdf])(\d+)/g, (_, orbital: string, count: string) => {
    const sup = count
      .split('')
      .map((c) => SUPERSCRIPTS[c] ?? c)
      .join('');
    return `${orbital}${sup}`;
  });
}

/** Número con separador de miles en español: 1482 → "1,482". */
export function formatNumber(n: number): string {
  return numberFormatter.format(Number.isFinite(n) ? n : 0);
}

/** 0.82 → "82%". */
export function formatPercent(ratio: number): string {
  const safe = Number.isFinite(ratio) ? ratio : 0;
  return `${Math.round(safe * 100)}%`;
}

/** "45 s", "3 min 20 s", "7 h 32 min". */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round((Number.isFinite(ms) ? ms : 0) / 1000));
  if (totalSeconds < 60) return `${totalSeconds} s`;
  const totalMinutes = Math.floor(totalSeconds / 60);
  if (totalMinutes < 60) {
    const s = totalSeconds % 60;
    return s === 0 ? `${totalMinutes} min` : `${totalMinutes} min ${s} s`;
  }
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** "Grupo 1" o "Bloque f" para lantánidos y actínidos. */
export function groupLabel(el: Pick<ChemicalElement, 'group'>): string {
  return el.group === null ? 'Bloque f' : `Grupo ${el.group}`;
}

/** "Sólido", "Líquido", "Gas", "Desconocido". */
export function phaseLabel(phase: Phase): string {
  return PHASE_LABELS[phase];
}

/** "Gas noble" o, con `plural`, "Gases nobles". */
export function categoryLabel(cat: ElementCategory, plural = false): string {
  const meta = CATEGORIES[cat];
  return plural ? meta.label : meta.singular;
}

/** Minúsculas y sin acentos, para búsquedas y comparaciones. */
export function normalizeText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/** Devuelve solo la palabra en singular o plural: `${n} ${pluralize(n, 'elemento', 'elementos')}`. */
export function pluralize(n: number, singular: string, plural: string): string {
  return n === 1 ? singular : plural;
}
