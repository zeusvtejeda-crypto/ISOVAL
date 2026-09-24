// Formatos en español de México. Fechas de cita = 'YYYY-MM-DD' (hora local de la barbería).
import { addDays, weekday, parseDateKey, nowInTz, pad2, diffDays } from '../../core/util.js';

export { addDays, weekday, diffDays };

const nf0 = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function money(n, opts) {
  n = Number(n) || 0;
  const cents = Math.round(n * 100) % 100 !== 0;
  const s = (cents || (opts && opts.cents) ? nf2 : nf0).format(Math.abs(n));
  return (n < 0 ? '−$' : '$') + s;
}
// Cifras que se leen juntas (una lista, las tarjetas de un periodo): si alguna lleva centavos, todas los llevan,
// para que no queden '$4,170' junto a '$2,709.50'. const m = moneyIn([a, b, c]); m(a) → '$4,170.00'.
export function moneyIn(values) {
  const cents = (values || []).some((n) => Math.round((Number(n) || 0) * 100) % 100 !== 0);
  return (n) => money(n, cents ? { cents: true } : undefined);
}
// Importe corto para KPIs y ejes: '$89.8k', '$1.2M' (la unidad va pegada, como en '$84,670').
export function compactMoney(n) {
  n = Number(n) || 0;
  const sign = n < 0 ? '−$' : '$';
  const a = Math.abs(n);
  if (a >= 1e6) return sign + (a / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (a >= 1e4) return sign + (a / 1e3).toFixed(1).replace(/\.0$/, '') + 'k';
  return money(n);
}
export const number = (n) => nf0.format(Number(n) || 0);
export const pct = (n) => (Number.isFinite(n) ? (Math.round(n * 10) / 10).toString() : '0') + '%';

export function time(min) { if (min == null) return ''; return pad2(Math.floor(min / 60)) + ':' + pad2(min % 60); }
export function timeRange(a, b) { return time(a) + '–' + time(b); }
// Hora de un ISO en la zona de la barbería (o la del dispositivo), en 24 h como time(): '14:05'.
export function clock(iso, tz) {
  if (!iso) return '';
  try { return new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: tz || undefined }).format(new Date(iso)); } catch (e) { return ''; }
}
export function duration(m) { m = Number(m) || 0; const h = Math.floor(m / 60), r = m % 60; return h ? (r ? h + ' h ' + r + ' min' : h + ' h') : r + ' min'; }

const DOW = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const DOW_S = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MON = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MON_S = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const WEEKDAYS = DOW, WEEKDAYS_SHORT = DOW_S, MONTHS = MON, MONTHS_SHORT = MON_S;

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
export function dateLong(k) { const d = parseDateKey(k); return DOW[d.getUTCDay()] + ' ' + d.getUTCDate() + ' de ' + MON[d.getUTCMonth()]; }
export function dateLongCap(k) { return cap(dateLong(k)); }
export function dateShort(k) { const d = parseDateKey(k); return DOW_S[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + MON_S[d.getUTCMonth()]; }
export function dateNum(k) { const d = parseDateKey(k); return d.getUTCDate() + ' ' + MON_S[d.getUTCMonth()] + ' ' + d.getUTCFullYear(); }
export function monthYear(k) { const d = parseDateKey(k); return cap(MON[d.getUTCMonth()]) + ' ' + d.getUTCFullYear(); }
export function dayNum(k) { return parseDateKey(k).getUTCDate(); }

// "Hoy", "Mañana", "Ayer" o fecha corta, relativo a `today`.
export function relDay(k, today) {
  const d = diffDays(today, k);
  if (d === 0) return 'Hoy';
  if (d === 1) return 'Mañana';
  if (d === -1) return 'Ayer';
  return cap(dateShort(k));
}
// "hace 5 min" a partir de un ISO.
export function ago(iso) {
  const s = Math.round((Date.now() - Date.parse(iso)) / 1000);
  if (!isFinite(s)) return '';
  if (s < 45) return 'hace un momento';
  if (s < 3600) return 'hace ' + Math.round(s / 60) + ' min';
  if (s < 86400) return 'hace ' + Math.round(s / 3600) + ' h';
  if (s < 86400 * 7) { const d = Math.round(s / 86400); return 'hace ' + d + (d === 1 ? ' día' : ' días'); }
  return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}
// '24 sep, 14:05' (24 h, como el resto de las horas del panel).
export function dateTimeIso(iso, tz) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: tz || undefined }); } catch (e) { return ''; }
}

export function todayIn(tz) { return nowInTz(tz).date; }
export function nowMinIn(tz) { return nowInTz(tz).minutes; }
export function startOfWeek(k) { const wd = weekday(k); return addDays(k, -((wd + 6) % 7)); } // lunes
export function startOfMonth(k) { return k.slice(0, 8) + '01'; }
export function endOfMonth(k) { const d = parseDateKey(startOfMonth(k)); d.setUTCMonth(d.getUTCMonth() + 1); d.setUTCDate(0); return d.toISOString().slice(0, 10); }
export function addMonths(k, n) { const d = parseDateKey(startOfMonth(k)); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 10); }

export function phone(p) { const d = String(p || '').replace(/\D/g, ''); return d.length === 10 ? d.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3') : d; }
// Monograma de la barbería: dos palabras significativas, sin artículos ("La Navaja Barber Club" → NB,
// "Barbería del Norte" → BN). Es el mismo que muestra la página pública (index.html → shopMark).
export function shopMark(name) {
  const all = String(name || '?').trim().split(/\s+/);
  const kept = all.filter((x) => !/^(la|el|los|las|de|del|y|the|&)$/i.test(x));
  const w = kept.length ? kept : all;
  return ((w[0] || '?')[0] + (w[1] ? w[1][0] : '')).toUpperCase();
}
export function initials(name) { const w = String(name || '?').trim().split(/\s+/); return ((w[0] || '?')[0] + (w.length > 1 ? w[w.length - 1][0] : '')).toUpperCase(); }
export function firstName(name) { return String(name || '').trim().split(/\s+/)[0] || ''; }
export function plural(n, one, many) { return number(n) + ' ' + (n === 1 ? one : (many || one + 's')); }

export const STATUS = {
  pending: { label: 'Pendiente', short: 'Pendiente' },
  confirmed: { label: 'Confirmada', short: 'Confirmada' },
  completed: { label: 'Atendida', short: 'Atendida' },
  cancelled: { label: 'Cancelada', short: 'Cancelada' },
  no_show: { label: 'No asistió', short: 'No asistió' }
};
export const statusLabel = (s) => (STATUS[s] || { label: s }).label;
export const METHOD = { cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia', other: 'Otro' };
export const SOURCE = { online: 'En línea', manual: 'Manual', walkin: 'Sin cita', import: 'Importada' };
export const ROLE = { superadmin: 'Superadmin', owner: 'Dueño', barber: 'Barbero', client: 'Cliente' };

// Color estable para avatar a partir del nombre (si no hay color asignado).
const PALETTE = ['#9E7826', '#2F6F6B', '#7A4B8C', '#4A6B3A', '#8C4B3A', '#3A5A8C', '#8C3A5E', '#5E6B2F'];
export function colorFor(key) { let h = 0; for (const c of String(key || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0; return PALETTE[h % PALETTE.length]; }
