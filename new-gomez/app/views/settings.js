// Ajustes (#/ajustes?s=<sección>, dueño). Escritorio: menú lateral de secciones + panel. Móvil: lista → detalle.
// Secciones con formulario (perfil, horario, reservas, pagos, página pública, avisos) guardan con
// PATCH /api/shop (settings parcial, merge profundo) → toast + window.TB.refreshContext(). Cambios sin guardar:
// barra fija con Guardar/Descartar, confirmación al salir por un enlace del panel, aviso del navegador al
// cerrar la pestaña y borrador en memoria si se sale con el botón Atrás (se recupera al volver).
// Además: Importar datos anteriores (localStorage 'nb:<slug>:citas' / 'nb:<slug>:staff' → POST /api/import/legacy)
// y Plan y cuenta.
import { html, raw, esc, $, on } from '../lib/html.js';
import { icon } from '../lib/icons.js';
import { api, SITE_BASE } from '../lib/api.js';
import { state, shop, bus, can } from '../lib/state.js';
import { navigate, setQuery } from '../lib/router.js';
import { toast, confirmDialog, menu, busy, emptyState, avatar, showFieldErrors, clearFieldErrors, copyText } from '../lib/ui.js';
import { time as fmtTime, money, number, plural, dateNum, WEEKDAYS, MONTHS_SHORT, ROLE } from '../lib/fmt.js';

// ── Catálogos ─────────────────────────────────────────────────────────────
const ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY = (d) => WEEKDAYS[d].charAt(0).toUpperCase() + WEEKDAYS[d].slice(1);
const DAY_S = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MAX_BLOCKS = 6;
const SWATCHES = ['#C49A3C', '#15130F', '#8C4B3A', '#B3261E', '#D0457A', '#7A4B8C', '#3A5A8C', '#2F6F6B', '#4A6B3A'];
const TIMEZONES = [
  ['America/Mexico_City', 'Centro · CDMX, Guadalajara, Puebla'],
  ['America/Monterrey', 'Centro · Monterrey'],
  ['America/Merida', 'Centro · Mérida, Campeche'],
  ['America/Cancun', 'Sureste · Cancún, Chetumal'],
  ['America/Matamoros', 'Frontera noreste · Matamoros, Reynosa, Nuevo Laredo'],
  ['America/Mazatlan', 'Pacífico · Mazatlán, Tepic, La Paz'],
  ['America/Bahia_Banderas', 'Pacífico · Bahía de Banderas'],
  ['America/Chihuahua', 'Chihuahua'],
  ['America/Ciudad_Juarez', 'Ciudad Juárez'],
  ['America/Hermosillo', 'Sonora · Hermosillo (sin cambio de horario)'],
  ['America/Tijuana', 'Noroeste · Tijuana, Mexicali, Ensenada']
];
const OPTS = {
  lead_min: [[0, 'Sin anticipación'], [15, '15 minutos antes'], [30, '30 minutos antes'], [60, '1 hora antes'], [120, '2 horas antes'], [180, '3 horas antes'], [360, '6 horas antes'], [720, '12 horas antes'], [1440, '1 día antes'], [2880, '2 días antes']],
  step_min: [[10, 'Cada 10 minutos'], [15, 'Cada 15 minutos'], [20, 'Cada 20 minutos'], [30, 'Cada 30 minutos'], [45, 'Cada 45 minutos'], [60, 'Cada hora']],
  window_days: [[7, '1 semana'], [14, '2 semanas'], [21, '3 semanas'], [30, '30 días'], [45, '45 días'], [60, '2 meses'], [90, '3 meses'], [120, '4 meses'], [180, '6 meses']],
  buffer_min: [[0, 'Sin descanso'], [5, '5 minutos'], [10, '10 minutos'], [15, '15 minutos'], [20, '20 minutos'], [30, '30 minutos']],
  cancel_hours: [[0, 'Hasta la hora de la cita'], [1, 'Hasta 1 hora antes'], [2, 'Hasta 2 horas antes'], [3, 'Hasta 3 horas antes'], [4, 'Hasta 4 horas antes'], [6, 'Hasta 6 horas antes'], [12, 'Hasta 12 horas antes'], [24, 'Hasta 1 día antes'], [48, 'Hasta 2 días antes']]
};
const UNIT = { lead_min: 'min', step_min: 'min', window_days: 'días', buffer_min: 'min', cancel_hours: 'h' };
const PAY = [['cash', 'Efectivo', 'cash'], ['card', 'Tarjeta', 'card'], ['transfer', 'Transferencia', 'transfer'], ['other', 'Otro', 'more']];
const PAY_L = { cash: 'efectivo', card: 'tarjeta', transfer: 'transferencia', other: 'otro' };
const PLAN = {
  demo: { label: 'Demo', text: 'Barbería de prueba con todas las funciones desbloqueadas.' },
  basic: { label: 'Básico', text: 'Agenda, reservas en línea con tu enlace y QR, clientes, caja, comisiones y WhatsApp.' },
  pro: { label: 'Pro', text: 'Todo lo del plan Básico, con soporte prioritario y dominio propio para tu página.' }
};
const LEGACY_LABEL = { registrada: 'Registrada', confirmada: 'Confirmada', atendida: 'Atendida', cancelada: 'Cancelada' };
const MAX_IMPORT = 5000;

// Borradores que sobreviven a salir de la vista sin guardar (Atrás del navegador): id → valores del formulario.
const drafts = {};

// ── Utilidades ───────────────────────────────────────────────────────────
const toHHMM = (m) => (m >= 1440 ? '23:59' : fmtTime(m));
function toMin(v, isEnd) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(v || ''));
  if (!m) return null;
  const n = Number(m[1]) * 60 + Number(m[2]);
  if (isEnd && n === 1439) return 1440;
  return n >= 0 && n <= 1440 ? n : null;
}
const hoursText = (min) => { const h = Math.floor(min / 60), r = min % 60; return r ? h + ' h ' + r : h + ' h'; };
const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
const isUrl = (s) => /^https?:\/\/[^\s<>"']+\.[^\s<>"']+/i.test(s);
const digits = (s) => String(s || '').replace(/\D/g, '').replace(/^52(1)?(?=\d{10}$)/, '');
const nowIn = (tz) => { try { return new Intl.DateTimeFormat('es-MX', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date()); } catch (e) { return ''; } };
const optLabel = (key, v) => { const o = OPTS[key].find(([x]) => x === Number(v)); return o ? o[1] : v + ' ' + UNIT[key]; };
function selectOpts(key, value) {
  const list = OPTS[key].slice();
  if (value != null && !list.some(([v]) => v === Number(value))) list.push([Number(value), value + ' ' + UNIT[key]]);
  list.sort((a, b) => a[0] - b[0]);
  return list.map(([v, l]) => html`<option value="${v}" ${Number(value) === v ? 'selected' : ''}>${l}</option>`);
}

// Horario ⇄ modelo editable
function toModel(hours) {
  const out = {};
  for (let d = 0; d < 7; d++) {
    const list = (hours && (hours[d] || hours[String(d)])) || [];
    out[d] = { open: list.length > 0, ranges: list.map(([s, e]) => ({ s: toHHMM(s), e: toHHMM(e) })) };
  }
  return out;
}
function checkDay(day) {
  if (!day.open) return { blocks: [], error: null, bad: new Set() };
  const bad = new Set(), blocks = [];
  if (!day.ranges.length) return { blocks: [], error: 'Agrega un horario o marca el día como cerrado.', bad };
  if (day.ranges.length > MAX_BLOCKS) return { blocks: [], error: 'Máximo ' + MAX_BLOCKS + ' horarios por día.', bad };
  let error = null;
  day.ranges.forEach((r, i) => {
    const s = toMin(r.s, false), e = toMin(r.e, true);
    if (s == null || e == null) { bad.add(i); error = error || 'Completa la hora de apertura y de cierre.'; return; }
    if (s >= e) { bad.add(i); error = error || 'El cierre (' + r.e + ') debe ser después de la apertura (' + r.s + ').'; return; }
    blocks.push([s, e, i]);
  });
  const sorted = blocks.slice().sort((a, b) => a[0] - b[0]);
  for (let k = 1; k < sorted.length; k++) {
    if (sorted[k][0] < sorted[k - 1][1]) { bad.add(sorted[k][2]); bad.add(sorted[k - 1][2]); error = error || 'Dos horarios del mismo día se traslapan.'; }
  }
  return { blocks: sorted.map(([s, e]) => [s, e]), error, bad };
}
function hoursLines(hours) {
  const key = (d) => ((hours && (hours[d] || hours[String(d)])) || []).map(([s, e]) => fmtTime(s) + '–' + fmtTime(e)).join(' y ') || 'Cerrado';
  const groups = [];
  for (const d of ORDER) { const k = key(d); const g = groups[groups.length - 1]; if (g && g.text === k) g.list.push(d); else groups.push({ text: k, list: [d] }); }
  return groups.map((g) => ({ days: g.list.length > 2 ? DAY_S[g.list[0]] + '–' + DAY_S[g.list[g.list.length - 1]] : g.list.map((d) => DAY_S[d]).join(' y '), text: g.text }));
}

// Formulario ⇄ objeto plano (checkbox sola → bool; grupo con el mismo name → arreglo).
function readForm(form) {
  const out = {};
  for (const el of form.elements) {
    if (!el.name || el.disabled) continue;
    if (el.type === 'checkbox') {
      const group = form.querySelectorAll('input[type=checkbox][name="' + el.name + '"]');
      if (group.length > 1) { out[el.name] = out[el.name] || []; if (el.checked) out[el.name].push(el.value); } else out[el.name] = el.checked;
    } else if (el.type === 'radio') { if (el.checked) out[el.name] = el.value; } else out[el.name] = el.value;
  }
  return out;
}
function writeForm(form, v) {
  for (const el of form.elements) {
    if (!el.name || !(el.name in v)) continue;
    const val = v[el.name];
    if (el.type === 'checkbox') el.checked = Array.isArray(val) ? val.includes(el.value) : !!val;
    else if (el.type === 'radio') el.checked = el.value === val;
    else el.value = val;
  }
}

// Imagen del dispositivo → data URL pequeña (el servidor admite logos de hasta 100 KB).
function loadImage(src) {
  return new Promise((resolve, reject) => { const im = new Image(); im.onload = () => resolve(im); im.onerror = () => reject(new Error('No pudimos leer esa imagen. Prueba con un PNG o JPG.')); im.src = src; });
}
async function fileToLogo(file) {
  if (!file || !/^image\//.test(file.type)) throw new Error('Elige una imagen (PNG, JPG o WEBP).');
  if (file.size > 10 * 1024 * 1024) throw new Error('La imagen pesa más de 10 MB. Elige una más ligera.');
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const tries = [[256, 'image/png'], [256, 'image/webp', 0.9], [220, 'image/webp', 0.85], [220, 'image/jpeg', 0.86], [180, 'image/jpeg', 0.8], [140, 'image/jpeg', 0.75]];
    for (const [size, type, q] of tries) {
      const c = document.createElement('canvas');
      c.width = size; c.height = size;
      const ctx = c.getContext('2d');
      if (type === 'image/jpeg') { ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, size, size); }
      const k = Math.min(size / img.width, size / img.height);
      const w = img.width * k, h = img.height * k;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      const data = c.toDataURL(type, q);
      if (!data.startsWith('data:' + type)) continue; // formato no soportado por el navegador (webp en Safari viejo)
      if (data.length * 0.75 <= 96 * 1024) return data;
    }
    throw new Error('No pudimos reducir la imagen lo suficiente. Prueba con otra más sencilla.');
  } finally { URL.revokeObjectURL(url); }
}

// ── Datos del sistema anterior (localStorage de la app v1) ──
function readJson(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
function scanLegacy() {
  const map = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) || '';
      const m = /^nb:(.+):(citas|staff)$/.exec(k);
      if (!m) continue;
      const v = readJson(k);
      if (!Array.isArray(v)) continue;
      const src = map[m[1]] = map[m[1]] || { slug: m[1], citas: [], staff: [] };
      src[m[2]] = v.filter((x) => x && typeof x === 'object');
    }
  } catch (e) { /* almacenamiento bloqueado */ }
  return Object.values(map).filter((s) => s.citas.length || s.staff.length)
    .sort((a, b) => (b.slug === 'new-gomez') - (a.slug === 'new-gomez') || b.citas.length - a.citas.length);
}
function legacyStats(src) {
  const dates = src.citas.map((c) => c.fecha).filter((d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  const by = {};
  let revenue = 0;
  for (const c of src.citas) {
    const e = String(c.estado || 'registrada').toLowerCase();
    by[e] = (by[e] || 0) + 1;
    if (e === 'atendida') revenue += Number(c.total) || 0;
  }
  const clients = new Set(src.citas.map((c) => String(c.telefono || c.nombre || '').replace(/\D/g, '') || c.nombre)).size;
  return { from: dates[0], to: dates[dates.length - 1], by, revenue, clients };
}

// ── Estilos ──────────────────────────────────────────────────────────────
const CSS = `
.st-wrap{display:grid;gap:20px;grid-template-columns:minmax(0,1fr)}
@media (min-width:900px){.st-wrap{grid-template-columns:232px minmax(0,1fr);align-items:start}.st-navw{position:sticky;top:calc(var(--topbar-h) + 12px)}}
.st-navg{font-size:10.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--text-3);padding:14px 10px 6px}
.st-navg:first-child{padding-top:4px}
.st-nav{display:grid;gap:2px}
.st-nav button{display:flex;align-items:center;gap:11px;width:100%;min-height:44px;padding:6px 10px;border-radius:11px;text-align:left;color:var(--text-2);font-size:14px;font-weight:500;transition:background .12s,color .12s}
.st-nav button:hover{background:var(--muted-soft);color:var(--text)}
.st-nav button[aria-current="true"]{background:var(--surface);color:var(--text);font-weight:600;box-shadow:var(--shadow-1);outline:1px solid var(--border)}
.st-nav .ico{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;background:var(--surface-3);color:var(--text-2);flex:none;transition:background .15s,color .15s}
.st-nav .ico .ic{width:17px;height:17px}
.st-nav button[aria-current="true"] .ico{background:var(--ink);color:var(--brand)}
.st-nav .txt{display:grid;min-width:0;flex:1}
.st-nav .sum,.st-nav .chev{display:none}
.st-nav .drf{width:8px;height:8px;border-radius:50%;background:var(--warn);flex:none;margin-left:auto}
@media (max-width:899px){
  .st-root[data-view="detail"] .st-navw,.st-root[data-view="detail"]>.page-head{display:none}
  .st-root[data-view="list"] .st-panel{display:none}
  .st-navg{padding:18px 4px 8px}
  .st-nav{background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);box-shadow:var(--shadow-1);overflow:hidden;gap:0}
  .st-nav button{min-height:68px;padding:12px 14px;border-radius:0;border-bottom:1px solid var(--border);color:var(--text);gap:13px}
  .st-nav button:last-child{border-bottom:0}
  .st-nav button[aria-current="true"]{box-shadow:none;outline:0;background:none;font-weight:500}
  .st-nav button:active{background:var(--surface-2)}
  .st-nav .ico,.st-nav button[aria-current="true"] .ico{width:40px;height:40px;border-radius:12px;background:var(--brand-soft);color:var(--brand-strong)}
  .st-nav .ico .ic{width:20px;height:20px}
  .st-nav .ttl{font-weight:600;font-size:15px}
  .st-nav .sum{display:block;font-size:12.5px;color:var(--text-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .st-nav .chev{display:block;color:var(--text-3);flex:none}
  .st-nav .drf{margin-left:0}
}
.st-panel{min-width:0}
.st-back{display:none;margin:0 0 6px -6px;min-height:44px}
@media (max-width:899px){.st-back{display:inline-flex}}
.st-ph{margin:2px 0 16px}
.st-ph h3{font-family:var(--disp);font-size:28px;font-weight:800;letter-spacing:.01em;line-height:1.05}
.st-ph p{color:var(--text-2);font-size:14px;margin-top:4px;max-width:640px}
.st-card{overflow:hidden}
.st-card .field{align-content:start}
.st-card .row>label{font-size:13px;font-weight:600;color:var(--text)}
.st-card .row>label .opt{color:var(--text-3);font-weight:400}
.st-sec{display:grid;gap:14px;padding:18px;border-top:1px solid var(--border)}
.st-sec:first-child{border-top:0}
@media (min-width:768px){.st-sec{padding:20px 22px}}
.st-sec>h4{font-size:11.5px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--text-3);display:flex;align-items:center;gap:8px}
.st-sec>h4 .ic{width:15px;height:15px}
.st-sw{display:flex!important;justify-content:space-between;align-items:center;gap:16px;width:100%;min-height:56px;padding:6px 0;cursor:pointer}
.st-sw .lbl{display:grid;gap:2px;min-width:0}
.st-sw .lbl b{font-weight:600;font-size:14.5px}
.st-sw .lbl small{font-size:12.5px;color:var(--text-3);line-height:1.4}
.st-sw+.st-sw{border-top:1px solid var(--border)}
.st-hero-sw{padding:14px 16px;border-radius:var(--r-lg);border:1px solid var(--border);background:var(--surface-2);transition:background .2s,border-color .2s}
.st-hero-sw.on{background:var(--ok-soft);border-color:color-mix(in srgb,var(--ok) 30%,transparent)}
.st-hero-sw .lbl b{font-size:15.5px}
.st-count{font-size:12px;color:var(--text-3);text-align:right;font-variant-numeric:tabular-nums}
.st-count.over{color:var(--err);font-weight:600}
.st-logo{display:flex;align-items:center;gap:16px;flex-wrap:wrap}
.st-logo .avatar{--s:76px;border-radius:22px;font-size:26px;box-shadow:0 0 0 1px var(--border),var(--shadow-2);transition:background .2s}
.st-logo .avatar img{object-fit:contain;background:#fff}
.st-logo .acts{display:flex;gap:8px;flex-wrap:wrap}
.st-sw9{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.st-sw9 button,.st-sw9 label{width:40px;height:40px;border-radius:50%;background:var(--c);display:grid;place-items:center;color:#fff;box-shadow:inset 0 0 0 1px var(--border-strong);transition:transform .15s var(--ease),box-shadow .15s;position:relative;cursor:pointer}
.st-sw9 button:hover,.st-sw9 label:hover{transform:scale(1.08)}
.st-sw9 [aria-pressed="true"]{box-shadow:inset 0 0 0 1px var(--border-strong),0 0 0 3px var(--surface),0 0 0 5px var(--c)}
.st-sw9 [data-color="#15130f"][aria-pressed="true"]{box-shadow:inset 0 0 0 1px var(--border-strong),0 0 0 3px var(--surface),0 0 0 5px var(--text-2)}
.st-sw9 button .ic{width:18px;height:18px;stroke-width:2.6;opacity:0}
.st-sw9 [aria-pressed="true"] .ic{opacity:1}
.st-sw9 label{background:conic-gradient(from 90deg,#e74c3c,#f1c40f,#2ecc71,#3498db,#9b59b6,#e74c3c)}
.st-sw9 label input{position:absolute;inset:0;opacity:0;width:100%;height:100%;cursor:pointer}
.st-brandprev{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:var(--r);border:1px solid var(--border);background:var(--surface-2);font-size:13px;color:var(--text-2)}
.st-brandprev .pill{flex:none;white-space:nowrap;height:30px;padding:0 14px;border-radius:999px;background:var(--c);color:var(--fg);display:inline-flex;align-items:center;font-weight:600;font-size:13px}
/* horario */
.st-day{display:grid;gap:8px;padding:12px 16px;border-top:1px solid var(--border);transition:background .2s}
.st-day:first-child{border-top:0}
.st-day.closed{background:var(--surface-2)}
.st-day.bad{background:var(--err-soft)}
.st-dh{display:flex;align-items:center;gap:10px;min-height:44px}
.st-dh .switch{min-height:44px;gap:12px}
.st-dname{font-weight:600;font-size:15px;min-width:92px}
.st-dsum{font-size:12.5px;color:var(--text-3);margin-left:auto;white-space:nowrap}
.st-ranges{display:grid;gap:8px;padding-left:54px}
.st-range{display:flex;align-items:center;gap:8px;animation:fadeUp .25s var(--ease-out)}
.st-range .input{width:0;flex:1;min-width:0;max-width:150px;font-variant-numeric:tabular-nums;text-align:center;padding:8px 10px}
.st-range .input.err{border-color:var(--err);box-shadow:0 0 0 3px var(--err-soft)}
.st-range .to{color:var(--text-3);font-size:13px}
.st-add{justify-self:start;min-height:36px}
.st-closed{padding-left:54px;font-size:13px;color:var(--text-3)}
.st-derr{padding-left:54px;font-size:12.5px;color:var(--err);font-weight:500;display:flex;gap:6px;align-items:center}
.st-derr .ic{width:15px;height:15px}
@media (max-width:519px){.st-ranges,.st-closed,.st-derr{padding-left:0}.st-dname{min-width:0}.st-range .input{max-width:none}}
@media (min-width:720px){.st-day{grid-template-columns:240px minmax(0,1fr);column-gap:16px;align-items:start}.st-dh{grid-column:1;grid-row:1 / span 2}.st-ranges,.st-closed,.st-derr{grid-column:2;padding-left:0}.st-closed{min-height:44px;display:flex;align-items:center}}
/* pagos */
.st-pay{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
@media (min-width:640px){.st-pay{grid-template-columns:repeat(4,minmax(0,1fr))}}
.st-pay label{position:relative;display:grid;justify-items:center;gap:6px;padding:16px 10px 14px;border-radius:var(--r-lg);border:1.5px solid var(--border-strong);background:var(--surface);cursor:pointer;font-weight:600;font-size:14px;transition:border-color .15s,background .15s,box-shadow .15s,transform .12s var(--ease)}
.st-pay label:active{transform:scale(.97)}
.st-pay label .ic{width:26px;height:26px;color:var(--text-3);transition:color .15s}
.st-pay input{position:absolute;opacity:0;width:1px;height:1px}
.st-pay label .ck{position:absolute;top:8px;right:8px;width:20px;height:20px;border-radius:50%;border:1.5px solid var(--border-strong);display:grid;place-items:center;transition:.15s}
.st-pay label .ck .ic{width:13px;height:13px;stroke-width:3;color:var(--brand-ink);opacity:0}
.st-pay label.on{border-color:var(--brand);background:var(--brand-softer);box-shadow:0 0 0 3px var(--brand-soft)}
.st-pay label.on>.ic{color:var(--brand-strong)}
.st-pay label.on .ck{background:var(--brand);border-color:var(--brand)}
.st-pay label.on .ck .ic{opacity:1}
.st-pay label:focus-within{outline:2.5px solid var(--brand);outline-offset:2px}
/* página pública */
.st-rating{display:flex;align-items:center;gap:12px;padding:14px 16px;border-radius:var(--r-lg);background:var(--ink);color:var(--on-ink)}
.st-rating .big{font-family:var(--disp);font-size:40px;font-weight:800;line-height:1;color:#E6C173}
.st-rating .stars{display:flex;gap:2px;color:#E6C173}
.st-rating .stars .ic{width:16px;height:16px;fill:currentColor;stroke-width:1}
.st-rating .stars .ic.off{fill:none;opacity:.5}
.st-rating small{font-size:12.5px;color:#BDB5A5}
.st-social .input-group .ic{width:18px;height:18px}
/* guardar */
.st-savebar{position:sticky;bottom:calc(var(--bottomnav-h) + var(--safe-b) + 10px);z-index:5;display:flex;align-items:center;gap:10px;margin:14px 0 0;padding:10px 10px 10px 16px;border-radius:var(--r-lg);background:var(--ink);color:var(--on-ink);box-shadow:var(--shadow-3);animation:toastIn .3s var(--ease-out)}
@media (min-width:1024px){.st-savebar{bottom:16px}}
.st-savebar .grow{font-size:13.5px;font-weight:500;min-width:0;display:flex;align-items:center;gap:8px}
.st-savebar .grow::before{content:"";width:8px;height:8px;border-radius:50%;background:var(--warn);flex:none;box-shadow:0 0 0 4px rgba(229,168,75,.18)}
.st-savebar .btn-ghost{color:var(--on-ink)}
.st-savebar .btn-ghost:hover{background:rgba(255,255,255,.1);color:#fff}
.st-savebar .lg{display:none}
@media (min-width:480px){.st-savebar .lg{display:inline}}
/* importar */
.st-imp{display:grid;gap:14px}
.st-impk{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
@media (min-width:720px){.st-impk{grid-template-columns:repeat(4,minmax(0,1fr))}}
.st-impk div{padding:12px 14px;border-radius:var(--r);background:var(--surface-2);border:1px solid var(--border)}
.st-impk b{display:block;font-family:var(--disp);font-size:26px;font-weight:800;line-height:1.1}
.st-impk span{font-size:12px;color:var(--text-3)}
.st-drop{display:flex;align-items:center;gap:14px;padding:16px;border:1.5px dashed var(--border-strong);border-radius:var(--r-lg);background:var(--surface-2);flex-wrap:wrap}
.st-drop .art{width:44px;height:44px;border-radius:13px;background:var(--brand-soft);color:var(--brand-strong);display:grid;place-items:center;flex:none}
.st-prev{grid-template-columns:minmax(0,1fr)}
.st-prev .list-item{min-width:0;padding:10px 12px;min-height:0;gap:12px}
.st-prev .dt{width:44px;flex:none;text-align:center;line-height:1.05;border-radius:10px;background:var(--surface-2);border:1px solid var(--border);padding:5px 0}
.st-prev .dt b{display:block;font-family:var(--disp);font-size:19px;font-weight:800}
.st-prev .dt small{font-size:10.5px;text-transform:uppercase;color:var(--text-3);font-weight:600}
.st-prev .trail{display:grid;justify-items:end;gap:3px}
.st-res{display:grid;gap:10px;padding:16px;border-radius:var(--r-lg);background:var(--ok-soft);border:1px solid color-mix(in srgb,var(--ok) 25%,transparent)}
.st-res h4{display:flex;align-items:center;gap:8px;font-size:15px;color:var(--ok)}
.st-plan{position:relative;overflow:hidden;padding:22px;border-radius:var(--r-lg);background:var(--ink);color:var(--on-ink)}
.st-plan::after{content:"";position:absolute;right:-60px;top:-60px;width:200px;height:200px;border-radius:50%;background:radial-gradient(circle,rgba(217,178,90,.35),transparent 70%)}
.st-plan .eyebrow{color:#BDB5A5}
.st-plan b{display:block;font-family:var(--disp);font-size:40px;font-weight:800;line-height:1.05;color:#E6C173;margin:4px 0}
.st-plan p{color:#D9D3C6;font-size:14px;max-width:520px;position:relative;z-index:1}
.st-kv{display:grid;gap:0}
.st-kv>div{display:flex;align-items:center;gap:12px;padding:12px 0;border-top:1px solid var(--border);min-height:52px}
.st-kv>div:first-child{border-top:0}
.st-kv dt{font-size:13px;color:var(--text-2);min-width:130px}
.st-kv dd{flex:1;min-width:0;font-weight:500;font-size:14px;overflow-wrap:anywhere}
`;
function injectCss() { if (!document.getElementById('st-settings')) document.head.insertAdjacentHTML('beforeend', '<style id="st-settings">' + CSS + '</style>'); }

// ── Definición de secciones ─────────────────────────────────────────────
const sw = (name, checked, title, hint, extra) => html`<label class="switch st-sw ${extra || ''}"><span class="lbl"><b>${title}</b>${hint ? html`<small>${hint}</small>` : ''}</span><input type="checkbox" name="${name}" ${checked ? 'checked' : ''}/><span class="track"></span></label>`;
const counter = (name, max) => html`<span class="st-count" data-count="${name}" data-max="${max}"></span>`;

const SECTIONS = [
  { id: 'perfil', group: 'Tu barbería', icon: 'store', title: 'Perfil de la barbería', desc: 'Nombre, contacto, ubicación, logo y color de tu marca. Así te ven tus clientes.',
    sum: (s) => [s.name, s.city].filter(Boolean).join(' · ') },
  { id: 'horario', group: 'Tu barbería', icon: 'clock', title: 'Horario de apertura', desc: 'Los días y horas en que abre tu barbería. Aparece en tu página y lo usan los barberos que no tienen horario propio.',
    sum: (s) => { const l = hoursLines(s.settings.hours)[0]; return l ? l.days + ' ' + l.text : ''; } },
  { id: 'publica', group: 'Tu barbería', icon: 'globe', title: 'Página pública', desc: 'Calificación, reseñas, redes sociales y políticas que se muestran en tu página de reservas.',
    sum: (s) => { const p = s.settings.public || {}; return [p.rating ? '★ ' + String(p.rating).replace('.', ',') : '', p.instagram ? 'Instagram' : '', p.facebook ? 'Facebook' : '', p.tiktok ? 'TikTok' : ''].filter(Boolean).join(' · ') || 'Reseñas y redes sociales'; } },
  { id: 'reservas', group: 'Reservas y cobros', icon: 'calendar-check', title: 'Reservas en línea', desc: 'Cómo y cuándo pueden reservar tus clientes desde tu enlace o QR.',
    sum: (s) => { const b = s.settings.booking; return b.online_enabled === false ? 'Apagadas' : 'Activas · ' + optLabel('step_min', b.step_min).toLowerCase(); } },
  { id: 'pagos', group: 'Reservas y cobros', icon: 'wallet', title: 'Pagos', desc: 'Los métodos que aceptas en caja y si recibes propinas.',
    sum: (s) => { const m = (s.settings.payments.methods || []).map((x) => PAY_L[x]); return (m.length ? m.join(', ') : 'Sin métodos').replace(/^./, (c) => c.toUpperCase()) + (s.settings.payments.tips ? ' · propinas' : ''); } },
  { id: 'avisos', group: 'Reservas y cobros', icon: 'bell', title: 'Notificaciones', desc: 'A dónde te avisamos cuando entra una reserva nueva.',
    sum: (s) => s.settings.notify_email || 'Solo avisos en la app' },
  { id: 'importar', group: 'Cuenta', icon: 'upload', title: 'Importar datos anteriores', desc: 'Trae las citas y el equipo que tenías en el sistema anterior de reservas.',
    sum: () => { const n = scanLegacy().reduce((a, s) => a + s.citas.length, 0); return n ? plural(n, 'cita encontrada', 'citas encontradas') : 'Citas del sistema anterior'; } },
  { id: 'plan', group: 'Cuenta', icon: 'crown', title: 'Plan y cuenta', desc: 'Tu plan actual y los datos de identificación de tu barbería.',
    sum: (s) => 'Plan ' + ((PLAN[s.plan] || {}).label || s.plan) }
];
const FORM_SECTIONS = ['perfil', 'horario', 'publica', 'reservas', 'pagos', 'avisos'];

function sectionBody(id, sh) {
  const st = sh.settings;
  if (id === 'perfil') {
    const color = (sh.brand_color || '').toLowerCase();
    const tzList = TIMEZONES.some(([t]) => t === sh.timezone) ? TIMEZONES : TIMEZONES.concat([[sh.timezone, sh.timezone]]);
    return html`
      <div class="st-sec"><h4>${raw(icon('image'))}Logo e identidad</h4>
        <div class="st-logo"><span id="stLogoPrev"></span>
          <div class="stack-sm"><div class="acts">
            <label class="btn btn-secondary btn-sm" style="cursor:pointer">${raw(icon('upload', 'ic-sm'))}Subir imagen<input type="file" accept="image/*" id="stLogoFile" hidden/></label>
            <button type="button" class="btn btn-ghost btn-sm" data-act="logo-clear" id="stLogoClear">${raw(icon('trash', 'ic-sm'))}Quitar</button></div>
            <p class="faint" style="font-size:12.5px">Cuadrado, de preferencia con fondo. Lo reducimos automáticamente.</p></div></div>
        <div class="field"><label for="stLogoUrl">O pega el enlace de tu logo <span class="opt">(opcional)</span></label>
          <input type="hidden" name="logo_url" value="${sh.logo_url || ''}"/>
          <input class="input" id="stLogoUrl" type="url" inputmode="url" placeholder="https://…/logo.png" autocomplete="off"/>
          <p class="hint" id="stLogoHint">Si ya tienes tu logo en internet (por ejemplo en Facebook o tu sitio).</p><p class="error">Revisa el enlace del logo.</p></div>
        <div class="field"><span class="label" id="stColorL">Color de tu marca</span>
          <input type="hidden" name="brand_color" value="${color}"/>
          <div class="st-sw9" role="group" aria-labelledby="stColorL">
            ${SWATCHES.map((c) => html`<button type="button" data-color="${c.toLowerCase()}" style="--c:${c}" aria-label="${'Color ' + c}" aria-pressed="false">${raw(icon('check'))}</button>`)}
            <label style="--c:#888" title="Otro color" aria-label="Elegir otro color" aria-pressed="false" id="stColorCustom"><input type="color" id="stColorIn" value="${color || '#c49a3c'}" aria-label="Elegir otro color"/></label>
          </div>
          <div class="st-brandprev" id="stBrandPrev"></div><p class="error">Elige un color válido.</p></div>
      </div>
      <div class="st-sec"><h4>${raw(icon('store'))}Datos generales</h4>
        <div class="field"><label for="stName">Nombre de la barbería</label>
          <input class="input" id="stName" name="name" maxlength="80" value="${sh.name}" required autocomplete="organization"/><p class="error">Escribe el nombre de tu barbería.</p></div>
        <div class="field"><div class="row between"><label for="stTag">Lema <span class="opt">(opcional)</span></label>${counter('tagline', 120)}</div>
          <input class="input" id="stTag" name="tagline" maxlength="120" value="${sh.tagline || ''}" placeholder="p. ej. Cortes clásicos y fades de precisión"/><p class="error">Máximo 120 caracteres.</p></div>
        <div class="field"><div class="row between"><label for="stDesc">Descripción <span class="opt">(opcional)</span></label>${counter('description', 1000)}</div>
          <textarea class="textarea" id="stDesc" name="description" maxlength="1000" rows="4" placeholder="Cuenta qué hace especial a tu barbería.">${sh.description || ''}</textarea><p class="error">Máximo 1000 caracteres.</p></div>
      </div>
      <div class="st-sec"><h4>${raw(icon('phone'))}Contacto</h4>
        <div class="form-grid cols-2">
          <div class="field"><label for="stPhone">Teléfono</label><input class="input" id="stPhone" name="phone" type="tel" inputmode="tel" autocomplete="tel" value="${sh.phone || ''}" placeholder="10 dígitos"/><p class="error">Escribe un teléfono de 10 dígitos.</p></div>
          <div class="field"><label for="stWa">WhatsApp</label><input class="input" id="stWa" name="whatsapp" type="tel" inputmode="tel" value="${sh.whatsapp || ''}" placeholder="Si es el mismo, déjalo vacío"/><p class="hint">Si lo dejas vacío usamos el teléfono.</p><p class="error">Escribe un WhatsApp de 10 dígitos.</p></div>
          <div class="field span-2"><label for="stEmail">Correo de la barbería <span class="opt">(opcional)</span></label><input class="input" id="stEmail" name="email" type="email" inputmode="email" autocomplete="email" value="${sh.email || ''}" placeholder="hola@tubarberia.com"/><p class="error">Escribe un correo válido.</p></div>
        </div>
      </div>
      <div class="st-sec"><h4>${raw(icon('map'))}Ubicación</h4>
        <div class="form-grid cols-2">
          <div class="field span-2"><label for="stAddr">Dirección</label><input class="input" id="stAddr" name="address" maxlength="200" autocomplete="street-address" value="${sh.address || ''}" placeholder="Calle, número, colonia, C.P."/><p class="error">Máximo 200 caracteres.</p></div>
          <div class="field"><label for="stCity">Ciudad</label><input class="input" id="stCity" name="city" maxlength="80" value="${sh.city || ''}" placeholder="p. ej. Guadalajara"/><p class="error">Máximo 80 caracteres.</p></div>
          <div class="field"><label for="stTz">Zona horaria</label><select class="select" id="stTz" name="timezone">${tzList.map(([t, l]) => html`<option value="${t}" ${t === sh.timezone ? 'selected' : ''}>${l}</option>`)}</select><p class="hint" id="stTzNow"></p><p class="error">Elige una zona horaria.</p></div>
          <div class="field span-2"><label for="stMaps">Enlace de Google Maps <span class="opt">(opcional)</span></label><input class="input" id="stMaps" name="maps_url" type="url" inputmode="url" value="${sh.maps_url || ''}" placeholder="https://maps.app.goo.gl/…"/>
            <p class="hint">Abre tu negocio en Google Maps, toca «Compartir» y pega aquí el enlace. <a class="link-btn" id="stMapsFind" href="#" target="_blank" rel="noopener">Buscar mi dirección ${raw(icon('external', 'ic-sm'))}</a></p><p class="error">Pega un enlace completo (https://…).</p></div>
        </div>
      </div>`;
  }
  if (id === 'horario') {
    return html`<input type="hidden" name="__hours" value=""/>
      <div class="banner info" style="margin:16px 16px 4px">${raw(icon('info'))}<div class="grow">Cada barbero puede tener su propio horario en <a class="link-btn" href="#/horarios">Horarios</a>. Aquí defines cuándo abre la barbería.</div></div>
      <div id="stDays"></div>`;
  }
  if (id === 'reservas') {
    const b = st.booking;
    const N = (k) => 'settings.booking.' + k;
    return html`
      <div class="st-sec">${sw(N('online_enabled'), b.online_enabled !== false, 'Recibir reservas en línea', 'Tus clientes reservan solos desde tu enlace o QR, las 24 horas.', 'st-hero-sw')}</div>
      <div class="st-sec"><h4>${raw(icon('clock'))}Horarios que se ofrecen</h4>
        <div class="form-grid cols-2">
          <div class="field"><label for="stStep">Intervalo entre horarios</label><select class="select" id="stStep" name="${N('step_min')}">${selectOpts('step_min', b.step_min)}</select><p class="hint">p. ej. 10:00, 10:20, 10:40…</p><p class="error">Elige un intervalo.</p></div>
          <div class="field"><label for="stLead">Anticipación mínima</label><select class="select" id="stLead" name="${N('lead_min')}">${selectOpts('lead_min', b.lead_min)}</select><p class="hint">Evita que te caigan citas de último minuto.</p><p class="error">Elige una opción.</p></div>
          <div class="field"><label for="stWin">Se puede reservar con</label><select class="select" id="stWin" name="${N('window_days')}">${selectOpts('window_days', b.window_days)}</select><p class="hint">Cuántos días hacia adelante.</p><p class="error">Elige una opción.</p></div>
          <div class="field"><label for="stBuf">Descanso entre citas</label><select class="select" id="stBuf" name="${N('buffer_min')}">${selectOpts('buffer_min', b.buffer_min)}</select><p class="hint">Tiempo para limpiar y preparar la silla.</p><p class="error">Elige una opción.</p></div>
        </div>
        <p class="st-preview banner brand" id="stBookPrev" style="margin-top:2px"></p>
      </div>
      <div class="st-sec"><h4>${raw(icon('sliders'))}Reglas</h4>
        <div class="field"><label for="stCancel">Tus clientes pueden cancelar o reagendar</label><select class="select" id="stCancel" name="${N('cancel_hours')}">${selectOpts('cancel_hours', b.cancel_hours)}</select><p class="hint">Después de ese límite tendrán que llamarte o escribirte.</p><p class="error">Elige una opción.</p></div>
        <div>
          ${sw(N('auto_confirm'), b.auto_confirm !== false, 'Confirmación automática', 'Las citas en línea entran confirmadas. Apágalo para revisarlas antes.')}
          ${sw(N('require_phone'), b.require_phone !== false, 'Pedir teléfono', 'Necesario para mandarles confirmaciones y recordatorios por WhatsApp.')}
          ${sw(N('allow_any_staff'), b.allow_any_staff !== false, 'Opción «Cualquier barbero»', 'El cliente puede reservar con quien esté libre; asignamos al que tenga menos citas.')}
        </div>
      </div>`;
  }
  if (id === 'pagos') {
    const p = st.payments;
    return html`
      <div class="st-sec"><h4>${raw(icon('wallet'))}Métodos que aceptas</h4>
        <div class="field"><div class="st-pay" role="group" aria-label="Métodos de pago">
          ${PAY.map(([k, l, ic]) => html`<label class="${(p.methods || []).includes(k) ? 'on' : ''}"><input type="checkbox" name="settings.payments.methods" value="${k}" ${(p.methods || []).includes(k) ? 'checked' : ''}/><span class="ck">${raw(icon('check'))}</span>${raw(icon(ic))}<span>${l}</span></label>`)}
        </div><p class="error">Activa al menos un método de pago.</p>
        <p class="hint">Aparecen al cobrar en caja y en tu página pública.</p></div>
      </div>
      <div class="st-sec"><h4>${raw(icon('gift'))}Propinas y moneda</h4>
        ${sw('settings.payments.tips', p.tips !== false, 'Registrar propinas', 'Al cobrar puedes anotar la propina; se reparte al barbero en sus ganancias.')}
        <div class="field" style="max-width:320px"><label for="stCur">Moneda</label><select class="select" id="stCur" name="currency">
          <option value="MXN" ${sh.currency !== 'USD' ? 'selected' : ''}>Peso mexicano (MXN)</option><option value="USD" ${sh.currency === 'USD' ? 'selected' : ''}>Dólar (USD)</option></select><p class="error">Elige una moneda.</p></div>
      </div>`;
  }
  if (id === 'publica') {
    const p = st.public || {};
    const P = (k) => 'settings.public.' + k;
    const handle = (u) => {
      const v = String(u || '');
      const m = /^https?:\/\/(?:www\.|m\.)?(?:instagram\.com|facebook\.com|tiktok\.com\/@)\/?([A-Za-z0-9._-]{1,60})\/?$/i.exec(v);
      return m ? '@' + m[1] : v;
    };
    return html`
      <div class="st-sec"><h4>${raw(icon('star'))}Reseñas</h4>
        <div id="stRatingPrev"></div>
        <div class="form-grid cols-2">
          <div class="field"><label for="stRate">Calificación <span class="opt">(0 a 5)</span></label><input class="input" id="stRate" name="${P('rating')}" type="number" inputmode="decimal" min="0" max="5" step="0.1" value="${p.rating == null ? '' : p.rating}" placeholder="4.9"/><p class="error">Escribe un número del 0 al 5.</p></div>
          <div class="field"><label for="stRevN">Número de reseñas</label><input class="input" id="stRevN" name="${P('reviews_count')}" type="number" inputmode="numeric" min="0" step="1" value="${p.reviews_count == null ? '' : p.reviews_count}" placeholder="120"/><p class="error">Escribe un número entero.</p></div>
          <div class="field span-2"><label for="stRevU">Enlace de reseñas de Google</label><input class="input" id="stRevU" name="${P('review_url')}" type="url" inputmode="url" value="${p.review_url || ''}" placeholder="https://g.page/r/…"/><p class="hint">Lo usamos en el mensaje de agradecimiento por WhatsApp para pedir reseñas.</p><p class="error">Pega un enlace completo (https://…).</p></div>
        </div>
      </div>
      <div class="st-sec st-social"><h4>${raw(icon('instagram'))}Redes sociales</h4>
        <div class="form-grid cols-2">
          <div class="field"><label for="stIg">Instagram</label><div class="input-group">${raw(icon('instagram'))}<input class="input" id="stIg" name="${P('instagram')}" value="${handle(p.instagram)}" placeholder="@tubarberia" autocapitalize="none"/></div><p class="error">Escribe tu usuario o el enlace completo.</p></div>
          <div class="field"><label for="stFb">Facebook</label><div class="input-group">${raw(icon('facebook'))}<input class="input" id="stFb" name="${P('facebook')}" value="${handle(p.facebook)}" placeholder="@tubarberia" autocapitalize="none"/></div><p class="error">Escribe tu usuario o el enlace completo.</p></div>
          <div class="field"><label for="stTt">TikTok</label><div class="input-group">${raw(icon('tiktok'))}<input class="input" id="stTt" name="${P('tiktok')}" value="${handle(p.tiktok)}" placeholder="@tubarberia" autocapitalize="none"/></div><p class="error">Escribe tu usuario o el enlace completo.</p></div>
        </div>
        <p class="faint" style="font-size:12.5px">Puedes escribir solo tu usuario (@tubarberia); nosotros armamos el enlace.</p>
      </div>
      <div class="st-sec"><h4>${raw(icon('note'))}Políticas</h4>
        <div class="field"><div class="row between"><label for="stPol">Políticas de tu barbería</label>${counter(P('policies'), 500)}</div>
          <textarea class="textarea" id="stPol" name="${P('policies')}" maxlength="500" rows="3" placeholder="p. ej. Tolerancia de 10 minutos. Cancela con 2 horas de anticipación.">${p.policies || ''}</textarea><p class="hint">Se muestran antes de confirmar la reserva.</p><p class="error">Máximo 500 caracteres.</p></div>
        <a class="link-btn" href="${SITE_BASE + '?b=' + encodeURIComponent(sh.slug)}" target="_blank" rel="noopener">${raw(icon('external', 'ic-sm'))}Ver mi página de reservas</a>
      </div>`;
  }
  if (id === 'avisos') {
    return html`
      <div class="st-sec"><h4>${raw(icon('mail'))}Correo para avisos</h4>
        <div class="field"><label for="stNotify">Te avisamos de cada reserva nueva a este correo</label>
          <input class="input" id="stNotify" name="settings.notify_email" type="email" inputmode="email" autocomplete="email" value="${st.notify_email || ''}" placeholder="tu@correo.com"/>
          <p class="hint">Déjalo vacío si solo quieres los avisos dentro de la app.</p><p class="error">Escribe un correo válido.</p></div>
      </div>
      <div class="st-sec"><h4>${raw(icon('bell'))}Dentro de la app</h4>
        <div class="list" style="margin:-4px -4px 0">
          <div class="list-item" style="padding:10px 4px;min-height:0">${raw(icon('bell', 'brand-t'))}<span class="grow"><span class="title" style="display:block">Reservas, cambios y cancelaciones</span><span class="meta">Siempre llegan a la campana de la app para ti y para el barbero de la cita.</span></span><span class="badge ok">Activo</span></div>
          <a class="list-item" href="#/mensajes" style="padding:10px 4px;min-height:0">${raw(icon('whatsapp', 'brand-t'))}<span class="grow"><span class="title" style="display:block">Mensajes de WhatsApp a clientes</span><span class="meta">Confirmaciones, recordatorios y agradecimientos.</span></span>${raw(icon('chevron-right', 'ic-sm'))}</a>
        </div>
      </div>`;
  }
  return '';
}

// ── Vista ────────────────────────────────────────────────────────────────
export default {
  title: 'Ajustes',
  async render(el, { query }) {
    injectCss();
    const sh0 = shop();
    if (!sh0) return;
    const desk = () => window.matchMedia('(min-width:900px)').matches;
    const valid = (s) => SECTIONS.some((x) => x.id === s);
    let sid = valid(query.s) ? query.s : (desk() ? 'perfil' : null);
    const cur = { form: null, orig: '', discarding: false, hours: null, imp: null };
    const offs = [];

    el.innerHTML = String(html`<div class="st-root" data-view="${sid ? 'detail' : 'list'}">
      <div class="page-head"><div><h2>Ajustes</h2><p>Configura tu barbería, tus reservas en línea y tu página pública.</p></div></div>
      <div class="st-wrap"><div class="st-navw" id="stNav"></div><div class="st-panel" id="stPanel" aria-live="polite"></div></div></div>`);
    const root = el.firstElementChild, navEl = $('#stNav', el), panel = $('#stPanel', el);
    if (sid && !desk()) window.scrollTo(0, 0);

    const values = () => (cur.form ? readForm(cur.form) : null);
    const isDirty = () => !!cur.form && JSON.stringify(values()) !== cur.orig;
    const secOf = (id) => SECTIONS.find((x) => x.id === id);

    function paintNav() {
      const sh = shop();
      let g = null, out = '';
      for (const s of SECTIONS) {
        if (s.group !== g) { if (g !== null) out += '</div>'; g = s.group; out += '<div class="st-navg">' + esc(g) + '</div><div class="st-nav" role="list">'; }
        out += String(html`<button type="button" role="listitem" data-sec="${s.id}" aria-current="${String(s.id === sid && desk())}">
          <span class="ico">${raw(icon(s.icon))}</span><span class="txt"><span class="ttl">${s.title}</span><span class="sum">${s.sum(sh)}</span></span>
          ${drafts[s.id] && s.id !== sid ? html`<span class="drf" title="Cambios sin guardar" aria-label="Cambios sin guardar"></span>` : ''}${raw(icon('chevron-right', 'chev'))}</button>`);
      }
      navEl.innerHTML = out + '</div>';
    }

    // ── Barra de guardar ──
    function paintBar() {
      const bar = $('#stBar', panel);
      if (!bar) return;
      const dirty = isDirty();
      if (!dirty) { bar.innerHTML = ''; return; }
      if (bar.firstChild) return;
      bar.innerHTML = String(html`<div class="st-savebar" role="region" aria-label="Cambios sin guardar">
        <span class="grow">Cambios sin guardar</span>
        <button type="button" class="btn btn-ghost btn-sm" data-act="discard">Descartar</button>
        <button type="submit" form="stForm" class="btn btn-primary btn-sm">${raw(icon('check'))}<span>Guardar<span class="lg"> cambios</span></span></button></div>`);
    }

    // ── Pintar sección ──
    function paintSection(restoreDraft) {
      cur.form = null; cur.hours = null;
      if (cur.imp) { cur.imp(); cur.imp = null; }
      if (!sid) { panel.innerHTML = ''; return; }
      const sh = shop();
      const s = secOf(sid);
      const head = html`<button type="button" class="btn btn-ghost btn-sm st-back" data-act="back">${raw(icon('chevron-left'))}Ajustes</button>
        <div class="st-ph"><h3>${s.title}</h3><p>${s.desc}</p></div>`;
      if (FORM_SECTIONS.includes(sid)) {
        panel.innerHTML = String(html`${head}
          <form id="stForm" class="card st-card fade-up" novalidate autocomplete="off" data-form="${sid}">${sectionBody(sid, sh)}</form>
          <div id="stDraft"></div><div id="stBar"></div>`);
        cur.form = $('#stForm', panel);
        mountSection(sid, sh);
        cur.orig = JSON.stringify(values());
        if (restoreDraft !== false && drafts[sid] && JSON.stringify(drafts[sid]) !== cur.orig) {
          writeForm(cur.form, drafts[sid]);
          syncSection(sid);
          $('#stDraft', panel).innerHTML = String(html`<div class="banner warn fade-up" style="margin-top:12px">${raw(icon('info'))}<div class="grow">Recuperamos los cambios que no guardaste. Guárdalos o descártalos.</div></div>`);
        } else delete drafts[sid];
        paintBar();
      } else if (sid === 'importar') {
        panel.innerHTML = String(html`${head}<div id="stImp" class="fade-up"></div>`);
        cur.imp = mountImport($('#stImp', panel));
      } else if (sid === 'plan') {
        panel.innerHTML = String(html`${head}${planBody(sh)}`);
      }
    }

    // ── Comportamiento por sección ──
    function mountSection(id, sh) {
      const f = cur.form;
      if (id === 'perfil') {
        const urlIn = $('#stLogoUrl', f), hid = f.elements.logo_url;
        if (!/^data:/.test(hid.value)) urlIn.value = hid.value;
        urlIn.addEventListener('input', () => { hid.value = urlIn.value.trim(); syncSection('perfil'); onChange(); });
        $('#stLogoFile', f).addEventListener('change', async (e) => {
          const file = e.target.files && e.target.files[0];
          e.target.value = '';
          if (!file) return;
          try {
            const data = await fileToLogo(file);
            hid.value = data; urlIn.value = '';
            syncSection('perfil'); onChange();
            toast.success('Logo listo (' + Math.round(data.length * 0.75 / 1024) + ' KB). Guarda para aplicarlo.');
          } catch (err) { toast.error(err); }
        });
        $('#stColorIn', f).addEventListener('input', (e) => { f.elements.brand_color.value = e.target.value.toLowerCase(); syncSection('perfil'); onChange(); });
        const find = $('#stMapsFind', f);
        const upd = () => { const q = [f.elements.address.value, f.elements.city.value].filter(Boolean).join(', '); find.href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q || sh.name); };
        f.addEventListener('input', (e) => { if (e.target.name === 'address' || e.target.name === 'city') upd(); });
        upd();
      }
      if (id === 'horario') cur.hours = toModel(sh.settings.hours);
      syncSection(id, true);
    }
    // Repinta lo derivado del formulario (vistas previas, contadores) — también tras restaurar un borrador.
    function syncSection(id, first) {
      const f = cur.form;
      if (!f) return;
      f.querySelectorAll('[data-count]').forEach((c) => {
        const inp = f.elements[c.dataset.count]; const n = inp ? Array.from(inp.value).length : 0; const max = +c.dataset.max;
        c.textContent = n + '/' + max; c.classList.toggle('over', n > max);
      });
      if (id === 'perfil') {
        const logo = f.elements.logo_url.value.trim();
        const color = f.elements.brand_color.value || '';
        const name = f.elements.name.value.trim() || shop().name;
        $('#stLogoPrev', f).innerHTML = String(avatar(name, { src: logo && (/^data:image\//.test(logo) || isUrl(logo) || logo.startsWith('/')) ? logo : '', color: color || '#15130F', size: 'xl' }));
        $('#stLogoClear', f).hidden = !logo;
        const urlIn = $('#stLogoUrl', f), hint = $('#stLogoHint', f);
        if (/^data:/.test(logo)) { urlIn.value = ''; urlIn.placeholder = 'Imagen subida desde tu dispositivo'; hint.textContent = 'Usando la imagen que subiste (' + Math.round(logo.length * 0.75 / 1024) + ' KB).'; }
        else { urlIn.placeholder = 'https://…/logo.png'; hint.textContent = 'Si ya tienes tu logo en internet (por ejemplo en Facebook o tu sitio).'; if (document.activeElement !== urlIn) urlIn.value = logo; }
        let customOn = !!color && !SWATCHES.some((c) => c.toLowerCase() === color);
        f.querySelectorAll('[data-color]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.color === color)));
        const cc = $('#stColorCustom', f);
        cc.setAttribute('aria-pressed', String(customOn));
        cc.style.setProperty('--c', customOn ? color : '#888');
        if (customOn) cc.style.background = color; else cc.style.background = '';
        const c = color || '#15130F';
        const light = (() => { const m = /^#([0-9a-f]{6})$/i.exec(c); if (!m) return false; const n = parseInt(m[1], 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) > 150; })();
        $('#stBrandPrev', f).innerHTML = String(html`<span class="pill" style="--c:${c};--fg:${light ? '#15130F' : '#FFFFFF'}">Reservar cita</span><span>${color ? 'Así se verán los botones de tu página.' : 'Sin color: usamos el dorado de TuBarbería.'}</span>`);
        const tz = f.elements.timezone.value;
        $('#stTzNow', f).textContent = 'Hora actual ahí: ' + nowIn(tz);
      }
      if (id === 'horario') {
        if (!first) { try { cur.hours = JSON.parse(f.elements.__hours.value); } catch (e) { /* */ } }
        paintDays();
      }
      if (id === 'reservas') {
        const g = (k) => f.elements['settings.booking.' + k];
        const on2 = g('online_enabled').checked;
        g('online_enabled').closest('.st-sw').classList.toggle('on', on2);
        f.querySelectorAll('.st-sec').forEach((sec, i) => { if (i > 0) sec.style.opacity = on2 ? '' : '.55'; });
        const lead = +g('lead_min').value, win = +g('window_days').value, step = +g('step_min').value;
        $('#stBookPrev', f).innerHTML = on2
          ? String(html`${raw(icon('calendar-check'))}<div class="grow">Tus clientes verán horarios <b>${optLabel('step_min', step).toLowerCase()}</b> y podrán reservar ${lead ? html`con al menos <b>${optLabel('lead_min', lead).replace(' antes', '')}</b> de anticipación` : 'hasta el último momento'}, hasta <b>${optLabel('window_days', win)}</b> adelante.</div>`)
          : String(html`${raw(icon('alert'))}<div class="grow">Con las reservas apagadas tu página se sigue viendo, pero invita a llamarte o escribirte por WhatsApp.</div>`);
      }
      if (id === 'pagos') f.querySelectorAll('.st-pay label').forEach((l) => l.classList.toggle('on', l.querySelector('input').checked));
      if (id === 'publica') {
        const r = f.elements['settings.public.rating'].value, n = f.elements['settings.public.reviews_count'].value;
        const rv = Number(r);
        $('#stRatingPrev', f).innerHTML = r !== '' && rv >= 0 && rv <= 5
          ? String(html`<div class="st-rating"><span class="big">${rv.toFixed(1).replace('.', ',')}</span><span class="grow"><span class="stars">${[1, 2, 3, 4, 5].map((i) => raw(icon('star', i <= Math.round(rv) ? '' : 'off')))}</span><small>${n ? number(n) + ' reseñas en Google' : 'Así se verá en tu página'}</small></span></div>`)
          : '';
      }
    }

    // ── Editor del horario de apertura ──
    function paintDays() {
      const box = $('#stDays', cur.form);
      if (!box || !cur.hours) return;
      box.innerHTML = ORDER.map((d) => String(dayHtml(d))).join('');
      cur.form.elements.__hours.value = JSON.stringify(cur.hours);
    }
    function dayHtml(d) {
      const day = cur.hours[d];
      const chk = checkDay(day);
      const mins = chk.blocks.reduce((a, [s, e]) => a + e - s, 0);
      return html`<div class="st-day ${day.open ? '' : 'closed'} ${chk.error ? 'bad' : ''}" data-day="${d}">
        <div class="st-dh"><label class="switch"><input type="checkbox" data-open="${d}" ${day.open ? 'checked' : ''} aria-label="${DAY(d) + ' abierto'}"/><span class="track"></span><span class="st-dname">${DAY(d)}</span></label>
          <span class="st-dsum" data-dsum="${d}">${day.open ? (mins && !chk.error ? hoursText(mins) : '') : 'Cerrado'}</span>
          ${day.open ? html`<button type="button" class="btn btn-ghost btn-icon btn-sm" data-copy="${d}" aria-label="${'Copiar el horario del ' + WEEKDAYS[d] + ' a otros días'}" title="Copiar a otros días">${raw(icon('copy', 'ic-sm'))}</button>` : html`<span style="width:34px"></span>`}</div>
        ${day.open ? html`<div class="st-ranges">${day.ranges.map((r, i) => html`<div class="st-range">
            <input class="input ${chk.bad.has(i) ? 'err' : ''}" type="time" step="900" value="${r.s}" data-t="s" data-d="${d}" data-i="${i}" aria-label="${DAY(d) + ': abre, horario ' + (i + 1)}"/><span class="to">a</span>
            <input class="input ${chk.bad.has(i) ? 'err' : ''}" type="time" step="900" value="${r.e}" data-t="e" data-d="${d}" data-i="${i}" aria-label="${DAY(d) + ': cierra, horario ' + (i + 1)}"/>
            <button type="button" class="btn btn-ghost btn-icon" data-del="${d + ':' + i}" aria-label="${'Quitar el horario ' + r.s + ' a ' + r.e + ' del ' + WEEKDAYS[d]}" title="Quitar">${raw(icon('x'))}</button></div>`)}
          ${day.ranges.length < MAX_BLOCKS ? html`<button type="button" class="btn btn-ghost btn-sm st-add" data-add="${d}">${raw(icon('plus'))}${day.ranges.length ? 'Agregar otro horario' : 'Agregar horario'}</button>` : ''}</div>
          ${chk.error ? html`<p class="st-derr" role="alert">${raw(icon('alert'))}${chk.error}</p>` : ''}` : html`<p class="st-closed">Cerrado todo el día.</p>`}
      </div>`;
    }
    function repaintDay(d) {
      const old = cur.form.querySelector('.st-day[data-day="' + d + '"]');
      if (!old) return;
      const t = document.createElement('div'); t.innerHTML = String(dayHtml(d)); old.replaceWith(t.firstElementChild);
      cur.form.elements.__hours.value = JSON.stringify(cur.hours);
    }
    function refreshDay(d) {
      const row = cur.form.querySelector('.st-day[data-day="' + d + '"]');
      const chk = checkDay(cur.hours[d]);
      row.classList.toggle('bad', !!chk.error);
      row.querySelectorAll('.st-range').forEach((r, i) => r.querySelectorAll('.input').forEach((x) => x.classList.toggle('err', chk.bad.has(i))));
      let err = row.querySelector('.st-derr');
      if (chk.error) { if (!err) { err = document.createElement('p'); err.className = 'st-derr'; err.setAttribute('role', 'alert'); row.appendChild(err); } err.innerHTML = icon('alert') + '<span></span>'; err.lastChild.textContent = chk.error; } else if (err) err.remove();
      const mins = chk.error ? 0 : chk.blocks.reduce((a, [s, e]) => a + e - s, 0);
      const sum = row.querySelector('[data-dsum]'); if (sum) sum.textContent = mins ? hoursText(mins) : '';
      cur.form.elements.__hours.value = JSON.stringify(cur.hours);
    }

    // ── Validación y envío ──
    function clientErrors(id, v) {
      const e = {};
      if (id === 'perfil') {
        if ((v.name || '').trim().length < 2) e.name = 'Escribe el nombre de tu barbería (mínimo 2 letras).';
        if (v.phone && digits(v.phone).length !== 10) e.phone = 'Escribe un teléfono de 10 dígitos.';
        if (v.whatsapp && digits(v.whatsapp).length !== 10) e.whatsapp = 'Escribe un WhatsApp de 10 dígitos.';
        if (v.email && !isEmail(v.email.trim())) e.email = 'Escribe un correo válido, por ejemplo hola@tubarberia.com.';
        if (v.maps_url && !isUrl(v.maps_url.trim())) e.maps_url = 'Pega el enlace completo de Google Maps (empieza con https://).';
        if (v.logo_url && !/^data:/.test(v.logo_url) && !isUrl(v.logo_url) && !v.logo_url.startsWith('/')) { e.logo_url = 'Pega un enlace completo (https://…) o sube una imagen.'; }
      }
      if (id === 'horario') {
        const bad = ORDER.filter((d) => checkDay(cur.hours[d]).error);
        if (bad.length) e.__hours = 'Revisa el horario del ' + bad.map((d) => WEEKDAYS[d]).join(', ') + '.';
      }
      if (id === 'pagos' && !(v['settings.payments.methods'] || []).length) e['settings.payments.methods'] = 'Activa al menos un método de pago.';
      if (id === 'publica') {
        const r = v['settings.public.rating'];
        if (r !== '' && !(Number(r) >= 0 && Number(r) <= 5)) e['settings.public.rating'] = 'Escribe una calificación del 0 al 5 (por ejemplo 4.8).';
        const n = v['settings.public.reviews_count'];
        if (n !== '' && !(Number.isInteger(Number(n)) && Number(n) >= 0)) e['settings.public.reviews_count'] = 'Escribe un número entero de reseñas.';
        if (v['settings.public.review_url'] && !isUrl(v['settings.public.review_url'].trim())) e['settings.public.review_url'] = 'Pega el enlace completo (https://…).';
        if (Array.from(v['settings.public.policies'] || '').length > 500) e['settings.public.policies'] = 'Máximo 500 caracteres.';
      }
      if (id === 'avisos' && v['settings.notify_email'] && !isEmail(v['settings.notify_email'].trim())) e['settings.notify_email'] = 'Escribe un correo válido.';
      return e;
    }
    function payload(id, v) {
      const t = (k) => String(v[k] == null ? '' : v[k]).trim();
      if (id === 'perfil') {
        return { name: t('name'), tagline: t('tagline'), description: String(v.description || '').trim(), phone: t('phone') ? digits(v.phone) : '', whatsapp: t('whatsapp') ? digits(v.whatsapp) : '',
          email: t('email'), address: t('address'), city: t('city'), maps_url: t('maps_url'), logo_url: t('logo_url'), brand_color: t('brand_color'), timezone: t('timezone') };
      }
      if (id === 'horario') { const h = {}; for (let d = 0; d < 7; d++) h[d] = checkDay(cur.hours[d]).blocks; return { settings: { hours: h } }; }
      if (id === 'reservas') {
        const b = {};
        for (const k of ['online_enabled', 'auto_confirm', 'require_phone', 'allow_any_staff']) b[k] = !!v['settings.booking.' + k];
        for (const k of ['step_min', 'lead_min', 'window_days', 'buffer_min', 'cancel_hours']) b[k] = Number(v['settings.booking.' + k]);
        return { settings: { booking: b } };
      }
      if (id === 'pagos') return { currency: v.currency, settings: { payments: { methods: v['settings.payments.methods'] || [], tips: !!v['settings.payments.tips'] } } };
      if (id === 'publica') {
        const P = (k) => 'settings.public.' + k;
        return { settings: { public: {
          rating: v[P('rating')] === '' ? null : Number(v[P('rating')]), reviews_count: v[P('reviews_count')] === '' ? null : Number(v[P('reviews_count')]),
          review_url: t(P('review_url')), instagram: t(P('instagram')), facebook: t(P('facebook')), tiktok: t(P('tiktok')), policies: String(v[P('policies')] || '').trim()
        } } };
      }
      if (id === 'avisos') return { settings: { notify_email: t('settings.notify_email') } };
      return {};
    }
    async function save(btn) {
      const f = cur.form;
      if (!f) return;
      if (!isDirty()) { toast.info('No hay cambios que guardar'); return; }
      clearFieldErrors(f);
      const v = values();
      const errs = clientErrors(sid, v);
      if (Object.keys(errs).length) {
        if (errs.__hours) { toast.error(errs.__hours); const bad = f.querySelector('.st-day.bad'); if (bad) bad.scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
        showFieldErrors(f, { fields: errs, message: 'Revisa los datos marcados.' });
        return;
      }
      try {
        await busy(btn, api.patch('/shop', payload(sid, v)));
        cur.orig = JSON.stringify(values());
        delete drafts[sid];
        paintBar();
        toast.success('Cambios guardados');
        bus.emit('shop:changed');
        await window.TB.refreshContext();
      } catch (err) {
        if (err.fields && Object.keys(err.fields).some((k) => /^settings\.hours/.test(k))) { toast.error(err); return; }
        showFieldErrors(f, err);
      }
    }
    function discard() {
      delete drafts[sid];
      paintSection(false);
      toast.info('Cambios descartados');
    }
    const confirmLeave = () => confirmDialog({ title: '¿Salir sin guardar?', message: 'Tienes cambios sin guardar en «' + secOf(sid).title + '». Si sales, se pierden.', confirmText: 'Salir sin guardar', cancelText: 'Seguir editando', danger: true, icon: 'alert' });

    function onChange() { paintBar(); }
    async function goSection(id) {
      if (id === sid && desk()) return;
      if (isDirty()) {
        if (!(await confirmLeave())) return;
        delete drafts[sid];
        cur.form = null;
      }
      if (desk()) {
        sid = id;
        setQuery({ s: id });
        paintNav(); paintSection();
        panel.scrollIntoView({ block: 'nearest' });
        const h = $('.st-ph h3', panel); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
      } else {
        navigate('/ajustes', { query: { s: id } });
      }
    }

    // ── Eventos ──
    offs.push(on(el, 'click', '[data-sec]', (e, b) => { if (b.tagName === 'BUTTON') goSection(b.dataset.sec); }));
    offs.push(on(el, 'click', '[data-act]', async (e, b) => {
      const act = b.dataset.act;
      if (act === 'back') {
        if (isDirty() && !(await confirmLeave())) return;
        if (cur.form) { delete drafts[sid]; cur.orig = JSON.stringify(values()); }
        if (history.length > 1 && backToList) history.back(); else navigate('/ajustes', { replace: true });
      }
      if (act === 'discard') {
        const ok = await confirmDialog({ title: '¿Descartar los cambios?', message: 'Volverás a lo que tenías guardado.', confirmText: 'Descartar', danger: true, icon: 'undo' });
        if (ok) discard();
      }
      if (act === 'logo-clear') { cur.form.elements.logo_url.value = ''; $('#stLogoUrl', cur.form).value = ''; syncSection('perfil'); onChange(); }
    }));
    offs.push(on(el, 'click', '[data-color]', (e, b) => { cur.form.elements.brand_color.value = b.dataset.color; syncSection('perfil'); onChange(); }));
    offs.push(on(el, 'submit', '#stForm', (e) => { e.preventDefault(); save(document.querySelector('.st-savebar [type=submit]') || null); }));
    offs.push(on(el, 'input', '#stForm', (e) => {
      const f = e.target.closest('.field'); if (f) f.classList.remove('invalid');
      if (sid === 'horario' && e.target.dataset.t) { const d = +e.target.dataset.d, i = +e.target.dataset.i; cur.hours[d].ranges[i][e.target.dataset.t] = e.target.value; refreshDay(d); }
      else if (sid !== 'horario') syncSection(sid);
      onChange();
    }));
    offs.push(on(el, 'change', '#stForm', (e) => {
      if (sid === 'horario' && e.target.dataset.open != null) {
        const d = +e.target.dataset.open, day = cur.hours[d];
        day.open = e.target.checked;
        if (day.open && !day.ranges.length) {
          const tpl = ORDER.map((x) => cur.hours[x]).find((x) => x.open && x.ranges.length && x !== day);
          day.ranges = tpl ? tpl.ranges.map((r) => ({ s: r.s, e: r.e })) : [{ s: '10:00', e: '20:00' }];
        }
        repaintDay(d);
      } else if (sid !== 'horario') syncSection(sid);
      onChange();
    }));
    offs.push(on(el, 'click', '[data-add],[data-del],[data-copy]', (e, b) => {
      if (sid !== 'horario') return;
      if (b.dataset.add != null) {
        const d = +b.dataset.add, day = cur.hours[d];
        const last = day.ranges[day.ranges.length - 1];
        const lastEnd = last ? toMin(last.e, true) : null;
        const s = lastEnd != null && lastEnd <= 1380 ? lastEnd + 60 : 600;
        day.ranges.push({ s: toHHMM(Math.min(s, 1380)), e: toHHMM(Math.min(s + 240, 1440)) });
        repaintDay(d);
        const ins = cur.form.querySelectorAll('.st-day[data-day="' + d + '"] .st-range input'); if (ins.length) ins[ins.length - 2].focus();
        onChange();
      } else if (b.dataset.del != null) {
        const [d, i] = b.dataset.del.split(':').map(Number);
        cur.hours[d].ranges.splice(i, 1);
        if (!cur.hours[d].ranges.length) cur.hours[d].open = false;
        repaintDay(d); onChange();
      } else if (b.dataset.copy != null) {
        const d = +b.dataset.copy;
        const src = cur.hours[d].ranges.map((r) => ({ s: r.s, e: r.e }));
        const apply = (days) => { days.forEach((x) => { if (x !== d) cur.hours[x] = { open: true, ranges: src.map((r) => ({ s: r.s, e: r.e })) }; }); paintDays(); onChange(); toast.success('Horario copiado a ' + plural(days.filter((x) => x !== d).length, 'día')); };
        menu(b, [
          { label: 'Copiar a lunes–viernes', icon: 'copy', onClick: () => apply([1, 2, 3, 4, 5]) },
          { label: 'Copiar a lunes–sábado', icon: 'copy', onClick: () => apply([1, 2, 3, 4, 5, 6]) },
          { label: 'Copiar a los días abiertos', icon: 'copy', onClick: () => apply(ORDER.filter((x) => cur.hours[x].open)) },
          { label: 'Copiar a toda la semana', icon: 'copy', onClick: () => apply(ORDER) }
        ]);
      }
    }));

    // Salir del panel con cambios: enlaces internos (menú, barra inferior) piden confirmación.
    let backToList = false;
    try { backToList = !!query.s && sessionStorage.getItem('tb:st:fromList') === '1'; sessionStorage.removeItem('tb:st:fromList'); } catch (e) { /* almacenamiento bloqueado */ }
    const onDocClick = async (e) => {
      if (e.defaultPrevented || !isDirty()) return;
      const a = e.target.closest && e.target.closest('a[href]');
      if (!a || a.target === '_blank') return;
      const href = a.getAttribute('href') || '';
      if (!href.startsWith('#') || href === location.hash) return;
      e.preventDefault(); e.stopPropagation();
      if (!(await confirmLeave())) return;
      delete drafts[sid];
      cur.orig = JSON.stringify(values()); // ya no está "sucio": el clic siguiente pasa normal
      a.click();
    };
    document.addEventListener('click', onDocClick, true);
    const onUnload = (e) => { if (isDirty()) { e.preventDefault(); e.returnValue = ''; return ''; } return undefined; };
    window.addEventListener('beforeunload', onUnload);
    // Recordar que el detalle se abrió desde la lista (móvil) para que "Ajustes" regrese con history.back().
    offs.push(on(el, 'click', '.st-nav [data-sec]', () => { if (!desk()) { try { sessionStorage.setItem('tb:st:fromList', '1'); } catch (e) { /* */ } } }));

    paintNav();
    paintSection();

    return () => {
      offs.forEach((f) => f());
      document.removeEventListener('click', onDocClick, true);
      window.removeEventListener('beforeunload', onUnload);
      if (cur.imp) cur.imp();
      if (isDirty()) {
        drafts[sid] = values();
        const stay = location.hash.startsWith('#/ajustes');
        if (!stay) {
          const id = sid, title = secOf(sid).title;
          toast.info('No guardaste los cambios de «' + title + '».', { duration: 7000, action: { label: 'Volver', onClick: () => navigate('/ajustes', { query: { s: id } }) } });
        }
      }
    };
  }
};

// ── Plan y cuenta ────────────────────────────────────────────────────────
function planBody(sh) {
  const p = PLAN[sh.plan] || { label: sh.plan, text: '' };
  const u = state.user;
  const created = sh.created_at ? dateNum(sh.created_at.slice(0, 10)) : '—';
  return html`<div class="stack-lg fade-up">
    <div class="st-plan"><div class="eyebrow">Tu plan actual</div><b>${p.label}</b><p>${p.text}</p>
      <div class="row wrap" style="margin-top:14px;position:relative;z-index:1">${sh.status === 'suspended' ? html`<span class="badge err">Suspendida</span>` : html`<span class="badge ok" style="background:rgba(111,191,138,.18);color:#8BD9A5">Activa</span>`}
        <span style="font-size:12.5px;color:#BDB5A5">Desde el ${created}</span></div></div>
    <div class="card"><div class="card-head"><h3>Datos de la cuenta</h3></div>
      <dl class="card-body st-kv">
        <div><dt>ID de la barbería</dt><dd class="mono" style="font-size:13px">${sh.id}</dd><button type="button" class="btn btn-ghost btn-sm" data-copy-id="${sh.id}" aria-label="Copiar ID de la barbería">${raw(icon('copy', 'ic-sm'))}Copiar</button></div>
        <div><dt>Enlace de reservas</dt><dd class="mono" style="font-size:13px">?b=${sh.slug}</dd><a class="btn btn-ghost btn-sm" href="#/enlace">${raw(icon('qr', 'ic-sm'))}Enlace y QR</a></div>
        <div><dt>Dominio propio</dt><dd>${sh.domain || html`<span class="faint">Sin dominio propio</span>`}</dd></div>
        <div><dt>Moneda</dt><dd>${sh.currency === 'USD' ? 'Dólar (USD)' : 'Peso mexicano (MXN)'}</dd></div>
        <div><dt>Zona horaria</dt><dd>${(TIMEZONES.find(([t]) => t === sh.timezone) || [0, sh.timezone])[1]}</dd></div>
        ${u ? html`<div><dt>Tu acceso</dt><dd>${u.email}<span class="faint" style="display:block;font-size:12.5px">${ROLE[state.ctx.role] || state.ctx.role}</span></dd><a class="btn btn-ghost btn-sm" href="#/perfil">${raw(icon('user', 'ic-sm'))}Mi perfil</a></div>` : ''}
      </dl></div>
    <div class="banner info">${raw(icon('help'))}<div class="grow">Tu plan y tu dominio propio los administra el equipo de TuBarbería. Si necesitas un cambio, compártenos el ID de tu barbería.</div></div>
  </div>`;
}
document.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('[data-copy-id]'); if (b) copyText(b.dataset.copyId, 'ID copiado'); });

// ── Importar datos anteriores ────────────────────────────────────────────
function mountImport(box) {
  let sources = scanLegacy();
  let busyNow = false;
  let result = null;
  const canImport = can('import.legacy');

  function srcCard(src, i) {
    const s = legacyStats(src);
    const recent = src.citas.slice().filter((c) => c && c.fecha).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)) || (Number(b.inicio) || 0) - (Number(a.inicio) || 0)).slice(0, 5);
    const team = src.staff.filter((x) => x.rol !== 'superadmin').length;
    const done = (s.by.atendida || 0), canc = (s.by.cancelada || 0), active = (s.by.registrada || 0) + (s.by.confirmada || 0);
    return html`<section class="card" data-src="${i}">
      <div class="card-head"><div><h3>${src.file ? 'Archivo de respaldo' : 'Encontramos datos en este navegador'}</h3><div class="sub">${src.file ? src.file : 'Sistema anterior · «' + src.slug + '»'}${s.from ? ' · del ' + dateNum(s.from) + ' al ' + dateNum(s.to) : ''}</div></div><span class="badge brand plain">${plural(src.citas.length, 'cita')}</span></div>
      <div class="card-body st-imp">
        <div class="st-impk">
          <div><b>${number(src.citas.length)}</b><span>${src.citas.length === 1 ? 'cita' : 'citas'}</span></div>
          <div><b>${number(s.clients)}</b><span>${s.clients === 1 ? 'cliente' : 'clientes'}</span></div>
          <div><b>${number(team)}</b><span>${team === 1 ? 'persona del equipo' : 'personas del equipo'}</span></div>
          <div><b>${money(s.revenue)}</b><span>en citas atendidas</span></div>
        </div>
        <p class="muted" style="font-size:13px">${plural(done, 'atendida')} · ${plural(active, 'confirmada')} · ${plural(canc, 'cancelada')}</p>
        ${recent.length ? html`<div class="list st-prev" style="border:1px solid var(--border);border-radius:var(--r);overflow:hidden">
          ${recent.map((c) => { const ok = /^\d{4}-\d{2}-\d{2}$/.test(c.fecha); const est = String(c.estado || '').toLowerCase(); return html`<div class="list-item">
            <span class="dt">${ok ? html`<b>${+c.fecha.slice(8, 10)}</b><small>${MONTHS_SHORT[+c.fecha.slice(5, 7) - 1]}</small>` : html`<small>${c.fecha || '—'}</small>`}</span>
            <span class="grow" style="min-width:0"><span class="title truncate" style="display:block">${c.nombre || 'Cliente'}</span>
              <span class="meta truncate" style="display:block">${Number.isFinite(Number(c.inicio)) ? fmtTime(Number(c.inicio)) + ' · ' : ''}${(Array.isArray(c.servicios) ? c.servicios.map((x) => (x && typeof x === 'object' ? x.nombre || x.name : x)).join(', ') : '') || 'Servicio'}${c.barberoNombre ? ' · ' + c.barberoNombre : ''}</span></span>
            <span class="trail"><span class="badge ${est === 'atendida' ? 'completed' : est === 'cancelada' ? 'cancelled' : 'confirmed'}">${LEGACY_LABEL[est] || 'Registrada'}</span><span class="num" style="font-size:13px;font-weight:600">${money(c.total)}</span></span></div>`; })}
        </div><p class="faint" style="font-size:12px">Vista previa de las 5 citas más recientes.</p>` : ''}
        ${canImport ? html`<div class="row wrap between"><p class="faint" style="font-size:12.5px;max-width:420px">Se agregan como historial. Si ya importaste antes, las repetidas se omiten solas: puedes volver a correrlo sin duplicar.</p>
          <button type="button" class="btn btn-primary" data-import="${i}">${raw(icon('upload'))}Importar ${plural(src.citas.length, 'cita')}</button></div>` : html`<div class="banner warn">${raw(icon('lock'))}<div class="grow">Solo el dueño puede importar datos.</div></div>`}
        <div data-progress hidden><div class="row between" style="font-size:13px;margin-bottom:6px"><span>Importando…</span><span class="num" data-pct>0%</span></div><div class="progress-bar"><span style="width:0%"></span></div></div>
      </div></section>`;
  }
  function paint() {
    const found = sources.length;
    box.innerHTML = String(html`<div class="stack-lg">
      ${result ? html`<div class="st-res fade-up" role="status"><h4>${raw(icon('check-circle'))}Importación terminada</h4>
        <div class="st-impk"><div><b>${number(result.imported)}</b><span>${result.imported === 1 ? 'cita importada' : 'citas importadas'}</span></div><div><b>${number(result.skipped)}</b><span>${result.skipped === 1 ? 'omitida' : 'omitidas'}</span></div><div><b>${number(result.clients_created || 0)}</b><span>${result.clients_created === 1 ? 'cliente nuevo' : 'clientes nuevos'}</span></div><div><b>${number(result.staff_created || 0)}</b><span>${result.staff_created === 1 ? 'barbero creado' : 'barberos creados'}</span></div></div>
        ${result.errors && result.errors.length ? html`<details><summary class="link-btn" style="cursor:pointer">Ver por qué se omitieron ${plural(result.errors.length, 'cita')}</summary><ul style="margin:8px 0 0 18px;font-size:13px;color:var(--text-2)">${result.errors.map((x) => html`<li>${x.folio ? x.folio + ': ' : ''}${x.message}</li>`)}</ul></details>` : ''}
        <div class="row wrap"><a class="btn btn-secondary btn-sm" href="#/agenda">${raw(icon('calendar'))}Ver agenda</a><a class="btn btn-secondary btn-sm" href="#/clientes">${raw(icon('users'))}Ver clientes</a>${result.staff_created ? html`<a class="btn btn-secondary btn-sm" href="#/equipo">${raw(icon('scissors'))}Revisar equipo</a>` : ''}</div></div>` : ''}
      ${found ? sources.map((s, i) => srcCard(s, i)) : html`<div class="card">${emptyState({ icon: 'inbox', title: 'No encontramos datos anteriores aquí', text: 'Abre esta pantalla en el mismo celular o computadora (y el mismo navegador) donde usabas el sistema anterior, o sube un archivo de respaldo.' })}</div>`}
      ${canImport ? html`<div class="st-drop"><span class="art">${raw(icon('upload'))}</span><div class="grow" style="min-width:200px"><b style="font-size:14.5px">¿Tienes un respaldo en archivo?</b><p class="muted" style="font-size:13px">Sube el .json exportado del sistema anterior (con «citas» y «staff»).</p></div>
        <label class="btn btn-secondary" style="cursor:pointer">${raw(icon('note'))}Elegir archivo<input type="file" accept="application/json,.json,.txt" id="stImpFile" hidden/></label></div>` : ''}
      <button type="button" class="btn btn-ghost btn-sm" data-rescan style="justify-self:start">${raw(icon('refresh', 'ic-sm'))}Buscar de nuevo en este navegador</button>
    </div>`);
  }
  async function runImport(i, btn) {
    if (busyNow) return;
    const src = sources[i];
    const ok = await confirmDialog({ title: '¿Importar ' + plural(src.citas.length, 'cita') + '?', icon: 'upload', confirmText: 'Importar',
      message: 'Se agregan a tu agenda como historial, con sus clientes y barberos. Las que ya estén importadas se omiten.' });
    if (!ok) return;
    busyNow = true;
    const card = btn.closest('[data-src]');
    const prog = card.querySelector('[data-progress]');
    prog.hidden = false;
    const setPct = (p) => { prog.querySelector('[data-pct]').textContent = Math.round(p) + '%'; prog.querySelector('.progress-bar span').style.width = p + '%'; };
    const total = { imported: 0, skipped: 0, staff_created: 0, clients_created: 0, errors: [] };
    try {
      await busy(btn, (async () => {
        const chunks = [];
        for (let k = 0; k < src.citas.length; k += MAX_IMPORT) chunks.push(src.citas.slice(k, k + MAX_IMPORT));
        if (!chunks.length) chunks.push([]);
        setPct(8);
        for (let k = 0; k < chunks.length; k++) {
          const r = await api.post('/import/legacy', { citas: chunks[k], staff: k === 0 ? src.staff : [] });
          total.imported += r.imported || 0; total.skipped += r.skipped || 0; total.staff_created += r.staff_created || 0; total.clients_created += r.clients_created || 0;
          total.errors = total.errors.concat(r.errors || []).slice(0, 20);
          setPct(8 + ((k + 1) / chunks.length) * 92);
        }
      })());
      result = total;
      ['appointments:changed', 'clients:changed', 'staff:changed', 'payments:changed'].forEach((ev) => bus.emit(ev));
      toast.success(total.imported ? 'Importamos ' + plural(total.imported, 'cita') + ' del sistema anterior' : 'No había citas nuevas: todo ya estaba importado');
      paint();
      box.scrollIntoView({ block: 'start', behavior: 'smooth' });
    } catch (err) {
      prog.hidden = true;
      toast.error(err);
    } finally { busyNow = false; }
  }
  async function readFile(file) {
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('El archivo es demasiado grande (máx. 20 MB).');
      const txt = await file.text();
      let j;
      try { j = JSON.parse(txt); } catch (e) { throw new Error('El archivo no es un respaldo válido (.json).'); }
      let citas = [], staff = [];
      if (Array.isArray(j)) citas = j;
      else if (j && typeof j === 'object') {
        citas = Array.isArray(j.citas) ? j.citas : [];
        staff = Array.isArray(j.staff) ? j.staff : [];
        for (const [k, v] of Object.entries(j)) {
          if (/:citas$/.test(k)) { const x = typeof v === 'string' ? JSON.parse(v) : v; if (Array.isArray(x)) citas = citas.concat(x); }
          if (/:staff$/.test(k)) { const x = typeof v === 'string' ? JSON.parse(v) : v; if (Array.isArray(x)) staff = staff.concat(x); }
        }
      }
      citas = citas.filter((c) => c && typeof c === 'object');
      if (!citas.length && !staff.length) throw new Error('No encontramos citas en ese archivo.');
      sources = [{ slug: 'archivo', file: file.name, citas, staff: staff.filter((s) => s && typeof s === 'object') }].concat(sources.filter((s) => !s.file));
      result = null;
      paint();
      toast.success('Leímos ' + plural(citas.length, 'cita') + ' del archivo. Revisa y confirma.');
    } catch (err) { toast.error(err); }
  }
  const onClick = (e) => {
    const b = e.target.closest('[data-import],[data-rescan]');
    if (!b || !box.contains(b)) return;
    if (b.hasAttribute('data-rescan')) { sources = scanLegacy(); result = null; paint(); toast.info(sources.length ? 'Datos encontrados: ' + plural(sources.reduce((a, s) => a + s.citas.length, 0), 'cita') : 'No encontramos datos del sistema anterior en este navegador.'); return; }
    runImport(+b.dataset.import, b);
  };
  const onChange = (e) => { if (e.target.id === 'stImpFile' && e.target.files && e.target.files[0]) { readFile(e.target.files[0]); e.target.value = ''; } };
  box.addEventListener('click', onClick);
  box.addEventListener('change', onChange);
  paint();
  return () => { box.removeEventListener('click', onClick); box.removeEventListener('change', onChange); };
}
