/**
 * Logros ya celebrados con confeti en `/logros` (comodidad por navegador, no es progreso:
 * si se pierde, como mucho se repite el confeti una vez).
 */
const KEY = 'elementa:logros:celebrated';

export function readCelebrated(): Set<string> {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

export function writeCelebrated(ids: Iterable<string>): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(Array.from(new Set(ids))));
  } catch {
    // Almacenamiento no disponible (modo privado, cuota…): no pasa nada.
  }
}
