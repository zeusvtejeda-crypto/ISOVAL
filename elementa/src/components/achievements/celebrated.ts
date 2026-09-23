import { CELEBRATED_ACHIEVEMENTS_KEY, getLocalStorage } from '@/services/storage';

/**
 * Logros ya celebrados con confeti en `/logros` (comodidad por navegador, no es progreso: si se pierde,
 * como mucho se repite el confeti una vez). El conjunto pertenece a un progreso concreto (`owner` =
 * `profile.createdAt`): tras reiniciar o importar otro progreso deja de valer y los logros que se
 * vuelvan a conseguir se celebran de nuevo.
 */
interface CelebratedRecord {
  owner: string;
  ids: string[];
}

function parseRecord(raw: string | null): CelebratedRecord | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
    const { owner, ids } = parsed as Partial<Record<keyof CelebratedRecord, unknown>>;
    if (typeof owner !== 'string' || !Array.isArray(ids)) return null;
    return { owner, ids: ids.filter((x): x is string => typeof x === 'string') };
  } catch {
    return null;
  }
}

/** Logros celebrados del progreso `owner` (vacío si lo guardado es de otro progreso o de una versión antigua). */
export function readCelebrated(owner: string): Set<string> {
  try {
    const record = parseRecord(getLocalStorage()?.getItem(CELEBRATED_ACHIEVEMENTS_KEY) ?? null);
    return new Set(record && record.owner === owner ? record.ids : []);
  } catch {
    return new Set();
  }
}

export function writeCelebrated(owner: string, ids: Iterable<string>): void {
  try {
    const record: CelebratedRecord = { owner, ids: Array.from(new Set(ids)) };
    getLocalStorage()?.setItem(CELEBRATED_ACHIEVEMENTS_KEY, JSON.stringify(record));
  } catch {
    // Almacenamiento no disponible (modo privado, cuota…): no pasa nada.
  }
}
