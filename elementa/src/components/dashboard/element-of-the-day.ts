import { TOTAL_ELEMENTS } from '@/data/elements';
import { daysBetween, isDateKey } from '@/utils/dates';

/** Día de referencia para numerar los días (cualquier fecha fija sirve). */
const EPOCH_KEY = '2024-01-01';
/** Paso coprimo con 118: recorre los 118 elementos sin repetir y con saltos variados. */
const STRIDE = 47;

/**
 * Elemento del día (número atómico 1–118), determinista para una clave `YYYY-MM-DD`:
 * todos los usuarios ven el mismo ese día y no se repite hasta pasados 118 días.
 */
export function elementOfTheDay(dayKey: string): number {
  if (!isDateKey(dayKey)) return 1;
  const day = daysBetween(EPOCH_KEY, dayKey);
  const idx = (((day * STRIDE) % TOTAL_ELEMENTS) + TOTAL_ELEMENTS) % TOTAL_ELEMENTS;
  return idx + 1;
}
