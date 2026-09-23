/**
 * Fechas por día en hora LOCAL con claves `YYYY-MM-DD`.
 * Las operaciones con claves usan UTC internamente para ser inmunes al horario de verano.
 */

const KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

export const WEEKDAY_LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'] as const;

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function parts(key: string): [number, number, number] {
  const m = KEY_RE.exec(key);
  if (!m) throw new Error(`Clave de fecha inválida: ${key}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** `true` si la cadena tiene forma `YYYY-MM-DD`. */
export function isDateKey(key: string): boolean {
  return KEY_RE.test(key);
}

/** Clave `YYYY-MM-DD` del día local de `d`. */
export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Clave del día local actual (o de `now`). */
export function todayKey(now: Date = new Date()): string {
  return dateKey(now);
}

/** Convierte una clave en un `Date` a medianoche local. */
export function keyToDate(key: string): Date {
  const [y, m, d] = parts(key);
  return new Date(y, m - 1, d);
}

function keyToUtcMs(key: string): number {
  const [y, m, d] = parts(key);
  return Date.UTC(y, m - 1, d);
}

function utcMsToKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Suma `n` días (puede ser negativo) a una clave. */
export function addDays(key: string, n: number): string {
  return utcMsToKey(keyToUtcMs(key) + n * DAY_MS);
}

/** Días de `a` a `b` (positivo si `b` es posterior). */
export function daysBetween(a: string, b: string): number {
  return Math.round((keyToUtcMs(b) - keyToUtcMs(a)) / DAY_MS);
}

/** Últimos `n` días terminando en `endKey` (incluido), del más antiguo al más reciente. */
export function lastNDays(n: number, endKey: string = todayKey()): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(addDays(endKey, -i));
  return out;
}

/** 0 = lunes … 6 = domingo. */
export function weekdayIndex(key: string): number {
  const day = new Date(keyToUtcMs(key)).getUTCDay(); // 0 = domingo
  return (day + 6) % 7;
}

/** Las 7 claves (lunes → domingo) de la semana que contiene `key`. */
export function weekKeys(key: string): string[] {
  const monday = addDays(key, -weekdayIndex(key));
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/** Inicial del día de la semana (lunes = 'L'). */
export function weekdayLetter(key: string): string {
  return WEEKDAY_LETTERS[weekdayIndex(key)];
}
