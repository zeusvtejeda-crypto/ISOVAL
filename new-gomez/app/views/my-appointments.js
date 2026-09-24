// Portal del cliente (#/mis-citas): próximas citas (tarjeta destacada con fecha grande, hora, barbero,
// servicios, total, estado, dirección con mapa), reagendar en una hoja (tira de días + horarios libres desde
// /api/public/shops/<slug>/days y /slots con los servicios de la cita → POST /api/my/appointments/:id/reschedule),
// cancelar con confirmación y motivo (respeta la política cancel_hours; si no se puede, explica por qué y ofrece
// contacto), agregar al calendario (Google o .ics), historial de visitas y "Reservar otra cita".
// Si la cuenta también es cliente de otras barberías, sus próximas citas allá aparecen en «En tus otras barberías»
// (resumen `elsewhere` de /api/my/appointments) con un botón para cambiar a esa barbería y gestionarlas.
import { html, raw, esc, $, on } from '../lib/html.js';
import { icon } from '../lib/icons.js';
import { api, SITE_BASE, APP_BASE } from '../lib/api.js';
import { state, shop, bus, selectShop, today as todayKey, nowMin } from '../lib/state.js';
import { toast, modal, promptDialog, menu, busy, emptyState, errorState, avatar, statusBadge, saveFile } from '../lib/ui.js';
import { money, time as fmtTime, duration, dateLongCap, dateLong, dateShort, relDay, diffDays, weekday, dayNum, firstName, plural, WEEKDAYS_SHORT, MONTHS_SHORT, phone as fmtPhone, colorFor } from '../lib/fmt.js';
import { dayStrip } from '../lib/pickers.js';

const REASONS = ['Me surgió un imprevisto', 'No me siento bien', 'Prefiero otro día', 'Ya no lo necesito'];

const CSS = `
.ma-sec{margin-top:26px}
.ma-sec:first-of-type{margin-top:0}
.ma-sec>h3{font-size:12px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--text-3);margin:0 0 10px;display:flex;align-items:center;gap:8px}
.ma-sec>h3 .n{min-width:20px;height:20px;padding:0 6px;border-radius:999px;background:var(--muted-soft);color:var(--text-2);display:inline-grid;place-items:center;font-size:11px;letter-spacing:0}
.ma-next{position:relative;overflow:hidden;border-radius:var(--r-xl);background:var(--ink);color:var(--on-ink);box-shadow:var(--shadow-3);border:1px solid rgba(242,237,227,.08)}
.ma-next::before{content:"";position:absolute;right:-80px;top:-90px;width:260px;height:260px;border-radius:50%;background:radial-gradient(circle,rgba(217,178,90,.28),transparent 68%);pointer-events:none}
.ma-top{display:grid;grid-template-columns:auto minmax(0,1fr);gap:18px;padding:20px 20px 16px;position:relative}
.ma-date{display:grid;justify-items:center;align-content:center;min-width:86px;padding:10px 8px;border-radius:18px;background:rgba(242,237,227,.06);border:1px solid rgba(242,237,227,.1)}
.ma-date .dw{font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#E6C173}
.ma-date .dn{font-family:var(--disp);font-size:58px;font-weight:800;line-height:.95;font-variant-numeric:tabular-nums}
.ma-date .mo{font-size:12.5px;color:#BDB5A5;font-weight:600;text-transform:uppercase;letter-spacing:.08em}
.ma-when .eyebrow{color:#BDB5A5}
.ma-when .rel{font-family:var(--disp);font-size:30px;font-weight:800;line-height:1.02;margin:4px 0 2px;letter-spacing:.01em}
.ma-when .tm{font-size:17px;font-weight:600;color:#F2EDE3;font-variant-numeric:tabular-nums}
.ma-when .tm small{font-size:13px;color:#BDB5A5;font-weight:500}
.ma-when .badge{margin-top:8px}
.ma-next .badge.confirmed{background:rgba(138,180,222,.16);color:#A9C8E8}
.ma-next .badge.pending{background:rgba(229,168,75,.16);color:#F0BE6E}
.ma-det{display:grid;gap:0;margin:0 20px;border-top:1px solid rgba(242,237,227,.1);position:relative}
.ma-row{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid rgba(242,237,227,.08);font-size:14px;min-width:0}
.ma-row:last-child{border-bottom:0}
.ma-row>.ic{color:#8E8676;flex:none}
.ma-row .grow{min-width:0}
.ma-row .k{display:block;font-size:12px;color:#8E8676}
.ma-row .v{display:block;font-weight:500;color:#F2EDE3;overflow-wrap:anywhere}
.ma-row a.lk{color:#E6C173;font-weight:600;font-size:13px;text-decoration:none;white-space:nowrap;display:inline-flex;align-items:center;gap:4px;min-height:36px}
.ma-row .avatar{--s:32px;font-size:12px}
.ma-svc{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px}
.ma-svc span{font-size:12.5px;padding:3px 9px;border-radius:999px;background:rgba(242,237,227,.08);color:#D9D3C6}
.ma-total{font-family:var(--disp);font-size:26px;font-weight:800;color:#E6C173;line-height:1}
.ma-pol{margin:4px 20px 0;font-size:12.5px;color:#BDB5A5;display:flex;gap:8px;align-items:flex-start;position:relative}
.ma-pol .ic{width:15px;height:15px;flex:none;margin-top:1px;color:#8E8676}
.ma-acts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;padding:16px 20px 20px;position:relative}
.ma-acts .btn{min-height:48px;padding:0 8px}
.ma-next .btn-secondary{background:rgba(242,237,227,.08);border-color:rgba(242,237,227,.14);color:#F2EDE3;box-shadow:none}
.ma-next .btn-secondary:hover:not(:disabled){background:rgba(242,237,227,.14);border-color:rgba(242,237,227,.24)}
.ma-next .btn-secondary[aria-busy="true"]{--spin-c:#F2EDE3}
.ma-next .btn-cancel{color:#F6A39C;border:1px solid rgba(242,139,130,.25)}
.ma-next .btn-cancel:hover{background:rgba(242,139,130,.12)}
.ma-locked{margin:14px 20px 20px;padding:12px 14px;border-radius:var(--r);background:rgba(242,237,227,.06);border:1px solid rgba(242,237,227,.1);font-size:13px;color:#D9D3C6;display:grid;gap:10px;position:relative}
.ma-locked .row .btn{flex:1}
@media (max-width:519px){.ma-acts{padding:14px 16px 16px;gap:6px}.ma-acts .btn{flex-direction:column;gap:4px;min-height:62px;font-size:12.5px;border-radius:14px}.ma-acts .btn .ic{width:20px;height:20px}
  .ma-top{padding:18px 16px 14px;gap:14px}.ma-det{margin:0 16px}.ma-pol{margin:4px 16px 0}.ma-locked{margin:14px 16px 16px}}
@media (max-width:400px){.ma-date{min-width:74px}.ma-date .dn{font-size:50px}.ma-when .rel{font-size:26px}}
@media (min-width:900px){.ma-grid{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:20px;align-items:start}.ma-grid>.ma-sec{margin-top:0}}
.ma-card{display:grid;grid-template-columns:auto minmax(0,1fr);gap:14px;padding:14px 16px;align-items:center}
.ma-card+.ma-card{margin-top:10px}
.ma-mini{width:56px;display:grid;justify-items:center;padding:6px 0;border-radius:14px;background:var(--surface-2);border:1px solid var(--border);line-height:1.05}
.ma-mini b{font-family:var(--disp);font-size:24px;font-weight:800}
.ma-mini small{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3)}
.ma-card .ttl{font-weight:600;font-size:15px}
.ma-card .meta{font-size:13px;color:var(--text-2)}
.ma-card .acts{grid-column:1/-1;display:flex;gap:6px;flex-wrap:wrap;border-top:1px solid var(--border);padding-top:10px}
.ma-card .acts .btn{flex:1;min-width:0}
.ma-away .shop{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;letter-spacing:.02em;color:var(--brand-strong);margin-bottom:2px;min-width:0}
.ma-away .shop .ic{width:14px;height:14px;flex:none}
.ma-away .shop span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ma-here{margin-bottom:12px}
.ma-hist .list{grid-template-columns:minmax(0,1fr)}
.ma-hist .list-item{gap:12px;align-items:center;min-width:0}
.ma-hist .ma-mini{width:48px}
.ma-hist .ma-mini b{font-size:20px}
.ma-hist .title{display:block}
.ma-hist .meta{display:block}
.ma-hist .trail{display:grid;justify-items:end;gap:4px}
.ma-hist .again{font-size:12.5px;min-height:32px}
.ma-hist .cancelled .title{color:var(--text-3)}
.ma-cta{display:grid;gap:10px;justify-items:start;padding:20px;border-radius:var(--r-lg);border:1px dashed var(--brand);background:var(--brand-softer)}
.ma-cta b{font-size:16px}
.ma-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:12px}
.ma-stats div{min-width:0;padding:12px 14px;border-radius:var(--r);background:var(--surface);border:1px solid var(--border)}
.ma-stats b{display:block;font-family:var(--disp);font-size:26px;font-weight:800;line-height:1.1}
.ma-stats span{font-size:12px;color:var(--text-3)}
@media (max-width:519px){.ma-stats b{font-size:20px}.ma-stats div{padding:10px 12px}}
/* hoja reagendar */
.rs-cur{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:var(--r);background:var(--surface-2);border:1px solid var(--border);font-size:13.5px;color:var(--text-2)}
.rs-cur .ic{color:var(--text-3)}
.rs-cur b{color:var(--text)}
.rs-h{font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text-3);margin:16px 0 8px}
.rs-slots{display:grid;gap:12px;min-height:120px}
.rs-grp .sc-h{font-size:12px;font-weight:600;color:var(--text-3);display:flex;align-items:center;gap:6px;margin-bottom:6px}
.rs-grp .sc-h .ic{width:14px;height:14px}
.rs-chips{display:grid;grid-template-columns:repeat(auto-fill,minmax(76px,1fr));gap:6px}
.rs-chip{min-height:46px;border-radius:12px;border:1px solid var(--border-strong);background:var(--surface);font-weight:600;font-size:15px;font-variant-numeric:tabular-nums;transition:background .15s,border-color .15s,color .15s,box-shadow .2s,transform .12s var(--ease)}
.rs-chip:hover{border-color:var(--brand)}
.rs-chip:active{transform:scale(.95)}
.rs-chip[aria-pressed="true"]{background:var(--brand);border-color:var(--brand);color:var(--brand-ink);box-shadow:0 4px 14px rgba(196,154,60,.32)}
.rs-msg{display:flex;gap:10px;align-items:flex-start;padding:14px;border-radius:var(--r);background:var(--surface-2);border:1px solid var(--border);font-size:13.5px;color:var(--text-2)}
.rs-msg .ic{flex:none;margin-top:1px;color:var(--text-3)}
.rs-sum{display:flex;align-items:center;gap:8px;font-size:13.5px;color:var(--text-2);flex:1 1 100%;min-height:22px}
.rs-sum b{color:var(--text)}
@media (min-width:720px){.rs-sum{flex:1 1 auto}}
`;
function injectCss() { if (!document.getElementById('st-my-appointments')) document.head.insertAdjacentHTML('beforeend', '<style id="st-my-appointments">' + CSS + '</style>'); }

// ── Utilidades ──
// El texto de la política puede traer "a.m.." (hora con punto + punto final): se deja un solo punto.
const tidy = (t) => String(t || '').replace(/\.{2,}/g, '.');
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const bookUrl = (slug, serviceId) => SITE_BASE + '?b=' + encodeURIComponent(slug) + (serviceId ? '&servicio=' + encodeURIComponent(serviceId) : '');
const svcNames = (a) => (a.services || []).map((s) => s.name).filter(Boolean);
const waDigits = (p) => { const d = String(p || '').replace(/\D/g, ''); return d.length === 10 ? '52' + d : d; };
function relText(date, t0) {
  const d = diffDays(t0, date);
  if (d === 0) return 'Hoy';
  if (d === 1) return 'Mañana';
  if (d > 1 && d < 7) return 'Este ' + dateLong(date).split(' ')[0];
  if (d >= 7 && d < 14) return 'En ' + d + ' días';
  return cap(dateLong(date));
}
// Hora local de la barbería (fecha + minutos) → instante UTC, usando Intl (sin librerías).
function tzOffsetMs(utcMs, tz) {
  try {
    const p = {};
    new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(new Date(utcMs)).forEach((x) => { p[x.type] = x.value; });
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - utcMs;
  } catch (e) { return 0; }
}
function toUtc(date, min, tz) {
  const [y, m, d] = date.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d, Math.floor(min / 60), min % 60);
  let t = guess - tzOffsetMs(guess, tz);
  t = guess - tzOffsetMs(t, tz);
  return new Date(t);
}
const icsStamp = (dt) => dt.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
function calInfo(a, sh) {
  const tz = (a.shop && a.shop.timezone) || (sh && sh.timezone) || 'America/Mexico_City';
  const name = (a.shop && a.shop.name) || (sh && sh.name) || 'la barbería';
  return {
    start: toUtc(a.date, a.start_min, tz), end: toUtc(a.date, a.end_min, tz),
    title: 'Cita en ' + name + (a.staff_name ? ' con ' + firstName(a.staff_name) : ''),
    place: (a.shop && a.shop.address) || (sh && sh.address) || name,
    details: svcNames(a).join(', ') + (a.folio ? '\nFolio: ' + a.folio : '') + '\nGestiona tu cita: ' + APP_BASE + '#/mis-citas'
  };
}
function googleCalUrl(a, sh) {
  const c = calInfo(a, sh);
  return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(c.title) +
    '&dates=' + icsStamp(c.start) + '/' + icsStamp(c.end) + '&details=' + encodeURIComponent(c.details) + '&location=' + encodeURIComponent(c.place);
}
function icsFile(a, sh) {
  const c = calInfo(a, sh);
  const e = (s) => String(s).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//TuBarberia//Mis citas//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
    'UID:' + a.id + '@tubarberia', 'DTSTAMP:' + icsStamp(new Date()), 'DTSTART:' + icsStamp(c.start), 'DTEND:' + icsStamp(c.end),
    'SUMMARY:' + e(c.title), 'LOCATION:' + e(c.place), 'DESCRIPTION:' + e(c.details),
    'BEGIN:VALARM', 'TRIGGER:-PT2H', 'ACTION:DISPLAY', 'DESCRIPTION:' + e(c.title), 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
}
function mapsUrl(a, sh) {
  if (sh && sh.maps_url) return sh.maps_url;
  const q = (a.shop && a.shop.address) || (sh && [sh.address, sh.city].filter(Boolean).join(', ')) || '';
  return q ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q) : '';
}
function contactOf(a, sh) {
  const wa = (a.shop && a.shop.whatsapp) || (sh && (sh.whatsapp || sh.phone)) || '';
  const ph = (a.shop && a.shop.phone) || (sh && sh.phone) || '';
  const msg = 'Hola, tengo una cita el ' + dateLong(a.date) + ' a las ' + fmtTime(a.start_min) + (a.folio ? ' (folio ' + a.folio + ')' : '') + ' y necesito hacer un cambio.';
  return { wa: wa ? 'https://wa.me/' + waDigits(wa) + '?text=' + encodeURIComponent(msg) : '', tel: ph ? 'tel:+52' + String(ph).replace(/\D/g, '').slice(-10) : '', phone: ph };
}

// ── Hoja: reagendar ──
function openReschedule(a, sh, onDone) {
  const slug = (a.shop && a.shop.slug) || sh.slug;
  const bk = (sh.settings && sh.settings.booking) || {};
  const ids = (a.services || []).map((s) => s.id).filter(Boolean);
  const t0 = todayKey();
  const win = Math.min(60, Math.max(7, Number(bk.window_days) || 30));
  const st = { staff: a.staff_id, date: null, start: null, res: null, loading: false, err: null, off: new Set(), seq: 0, slotStaff: null };
  const canAny = bk.allow_any_staff !== false;
  const m = modal({
    title: 'Reagendar cita', subtitle: svcNames(a).join(' + ') + (a.staff_name ? ' · con ' + a.staff_name : ''),
    body: html`<div class="rs-cur">${raw(icon('calendar-clock'))}<span>Ahora: <b>${dateLongCap(a.date)}, ${fmtTime(a.start_min)}</b></span></div>
      ${canAny ? html`<div class="rs-h">¿Con quién?</div><div class="seg" role="group" aria-label="Barbero" style="width:100%">
        <button type="button" data-staff="${a.staff_id}" aria-pressed="true" style="flex:1">Con ${firstName(a.staff_name) || 'mi barbero'}</button>
        <button type="button" data-staff="any" aria-pressed="false" style="flex:1">Cualquier barbero</button></div>` : ''}
      <div class="rs-h">Elige el día</div><div id="rsDays"></div>
      <div class="rs-h" id="rsSlotsH">Horarios libres</div><div class="rs-slots" id="rsSlots" aria-live="polite"></div>`,
    footerHtml: '<span class="rs-sum" id="rsSum"></span><button type="button" class="btn btn-secondary" data-close>Cancelar</button><button type="button" class="btn btn-primary" id="rsOk" disabled>' + icon('check') + 'Confirmar cambio</button>',
    size: 'lg'
  });
  m.foot.querySelector('[data-close]').onclick = () => m.close();
  const slotsEl = $('#rsSlots', m.body), okBtn = $('#rsOk', m.foot), sumEl = $('#rsSum', m.foot);
  // exclude: la cita que se mueve no ocupa su propio horario (el servidor lo acepta solo si es de mi ficha).
  const q = () => ({ services: ids.join(','), staff: st.staff, exclude: a.id });

  const strip = dayStrip($('#rsDays', m.body), { today: t0, value: t0, days: win, isOff: (d) => st.off.has(d), onChange: (d) => { st.date = d; st.start = null; loadSlots(); } });
  function paintSum() {
    okBtn.disabled = st.start == null;
    sumEl.innerHTML = st.start == null ? String(html`<span class="faint">Elige un día y un horario libre.</span>`)
      : String(html`${raw(icon('arrow-right', 'ic-sm'))}<span>Nuevo: <b>${cap(relDay(st.date, t0))}, ${fmtTime(st.start)}</b></span>`);
  }
  function paintSlots() {
    let body = '';
    if (!ids.length) body = String(html`<div class="rs-msg">${raw(icon('info'))}<div>No pudimos identificar los servicios de esta cita. Escríbenos para cambiarla.</div></div>`);
    else if (st.loading) body = '<div class="rs-chips" aria-busy="true" aria-label="Cargando horarios">' + '<div class="skel" style="height:46px;border-radius:12px"></div>'.repeat(8) + '</div>';
    else if (st.err) body = String(html`<div class="rs-msg">${raw(icon('alert'))}<div class="grow">${st.err}</div><button type="button" class="btn btn-secondary btn-sm" data-retry>${raw(icon('refresh', 'ic-sm'))}Reintentar</button></div>`);
    else if (st.res) {
      const cut = st.date === t0 ? nowMin() : -1;
      const list = (st.res.slots || []).filter((s) => s.start_min > cut && !(st.date === a.date && s.start_min === a.start_min && st.staff === a.staff_id));
      if (st.res.closed || !list.length) {
        body = String(html`<div class="rs-msg">${raw(icon(st.res.closed ? 'calendar-x' : 'clock'))}<div>${st.res.closed ? 'Ese día no hay servicio' + (st.staff === 'any' ? '' : ' con ' + firstName(a.staff_name)) + '.' : 'Ya no quedan horarios libres ese día.'} Prueba con otro día${canAny && st.staff !== 'any' ? ' o con «Cualquier barbero»' : ''}.</div></div>`);
      } else {
        const g = [['Mañana', 'sun', (x) => x < 720], ['Tarde', 'clock', (x) => x >= 720 && x < 1140], ['Noche', 'moon', (x) => x >= 1140]];
        body = g.map(([label, ic, fn]) => {
          const xs = list.filter((s) => fn(s.start_min));
          if (!xs.length) return '';
          return String(html`<div class="rs-grp"><div class="sc-h">${raw(icon(ic))}${label} <span class="faint" style="font-weight:500">· ${xs.length}</span></div>
            <div class="rs-chips">${xs.map((s) => html`<button type="button" class="rs-chip" data-slot="${s.start_min}" aria-pressed="${String(st.start === s.start_min)}">${fmtTime(s.start_min)}</button>`)}</div></div>`);
        }).join('');
      }
    }
    slotsEl.innerHTML = body;
    paintSum();
  }
  async function loadDays() {
    if (!ids.length) { paintSlots(); return; }
    try {
      const r = await api.get('/public/shops/' + encodeURIComponent(slug) + '/days', Object.assign({ from: t0, days: win }, q()));
      st.off = new Set((r.days || []).filter((d) => !d.open || !d.available).map((d) => d.date));
      const avail = (r.days || []).filter((d) => d.open && d.available).map((d) => d.date);
      strip.refresh();
      // Primero el mismo día de la cita (lo más común es mover la hora); si no, el primer día con lugar.
      const pick = avail.includes(a.date) ? a.date : avail[0];
      if (pick && !st.date) { strip.set(pick); st.date = pick; }
    } catch (e) { /* los días sin marcar siguen siendo elegibles */ }
    if (!st.date) st.date = strip.get();
    loadSlots();
  }
  async function loadSlots() {
    if (!ids.length) return paintSlots();
    const my = ++st.seq;
    st.loading = true; st.err = null; st.res = null; st.start = null; paintSlots();
    try {
      const r = await api.get('/public/shops/' + encodeURIComponent(slug) + '/slots', Object.assign({ date: st.date || strip.get() }, q()));
      if (my !== st.seq) return;
      st.res = r;
    } catch (e) { if (my !== st.seq) return; st.err = e.message || 'No se pudieron cargar los horarios.'; }
    st.loading = false;
    paintSlots();
  }
  m.body.addEventListener('click', (e) => {
    const b = e.target.closest('[data-slot],[data-staff],[data-retry]');
    if (!b) return;
    if (b.hasAttribute('data-retry')) return loadSlots();
    if (b.dataset.staff) {
      if (st.staff === b.dataset.staff) return;
      st.staff = b.dataset.staff;
      m.body.querySelectorAll('[data-staff]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      st.date = null; st.start = null;
      loadDays();
      return;
    }
    st.start = +b.dataset.slot;
    const slot = (st.res.slots || []).find((s) => s.start_min === st.start);
    st.slotStaff = slot && slot.staff_ids ? slot.staff_ids : null;
    slotsEl.querySelectorAll('[data-slot]').forEach((x) => x.setAttribute('aria-pressed', String(+x.dataset.slot === st.start)));
    paintSum();
    if (window.matchMedia('(max-width:719px)').matches) okBtn.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
  okBtn.onclick = async () => {
    if (st.start == null) return;
    const body = { date: st.date, start_min: st.start };
    if (st.staff === 'any') body.staff_id = 'any';
    try {
      const r = await busy(okBtn, api.post('/my/appointments/' + encodeURIComponent(a.id) + '/reschedule', body));
      const na = (r && r.appointment) || Object.assign({}, a, body);
      m.close(true);
      toast.success('¡Listo! Tu cita quedó el ' + dateLong(na.date) + ' a las ' + fmtTime(na.start_min) + (na.staff_name && na.staff_id !== a.staff_id ? ' con ' + firstName(na.staff_name) : ''));
      bus.emit('appointments:changed');
      onDone(na);
    } catch (err) {
      toast.error(err);
      if (err.status === 409) loadSlots();
    }
  };
  paintSlots();
  loadDays();
  return m;
}

// ── Explicación cuando ya no se puede cambiar en línea ──
function openLocked(a, sh, why) {
  const c = contactOf(a, sh);
  const m = modal({
    title: 'Ya no se puede cambiar en línea', size: 'sm',
    body: html`<div class="confirm-icon">${raw(icon('lock'))}</div><p class="muted" style="font-size:14px">${tidy(why || a.deadline_text)}</p>
      ${c.wa || c.tel ? html`<p style="font-size:14px;margin-top:10px">Escríbele o llama a la barbería${c.phone ? ' (' + fmtPhone(c.phone) + ')' : ''} y con gusto te ayudan.</p>` : ''}`,
    footerHtml: (c.tel ? '<a class="btn btn-secondary" href="' + esc(c.tel) + '">' + icon('phone') + 'Llamar</a>' : '') +
      (c.wa ? '<a class="btn btn-wa" href="' + esc(c.wa) + '" target="_blank" rel="noopener">' + icon('whatsapp') + 'WhatsApp</a>' : '') +
      (!c.tel && !c.wa ? '<button type="button" class="btn btn-primary" data-ok>Entendido</button>' : '')
  });
  if (m.foot) m.foot.addEventListener('click', (e) => { if (e.target.closest('[data-ok],a')) m.close(); });
  return m;
}

export default {
  title: 'Mis citas',
  async render(el) {
    injectCss();
    const sh = shop();
    if (!sh) return;
    const t0 = todayKey();
    const name = firstName((state.user && state.user.name) || (state.ctx && state.ctx.client && state.ctx.client.name) || '');
    let data = null;

    el.innerHTML = String(html`
      <div class="page-head">
        <div><h2>Mis citas</h2><p>${name ? 'Hola, ' + name + '. ' : ''}Tus citas en ${sh.name}.${(state.contexts || []).length > 1 ? html` <button type="button" class="link-btn" data-switch-shop>Cambiar de barbería</button>` : ''}</p></div>
        <div class="actions"><a class="btn btn-primary" href="${bookUrl(sh.slug)}" target="_blank" rel="noopener">${raw(icon('calendar-plus'))}Reservar otra cita</a></div>
      </div>
      <div id="maBody"><div class="ma-grid"><div class="stack"><div class="skel" style="height:340px;border-radius:var(--r-xl)"></div></div><div class="stack">${raw('<div class="card skel" style="height:72px;border:0"></div>'.repeat(4))}</div></div></div>`);
    const body = $('#maBody', el);

    function nextCard(a) {
      const wd = weekday(a.date);
      const mapU = mapsUrl(a, sh);
      const addr = (a.shop && a.shop.address) || sh.address || '';
      const c = contactOf(a, sh);
      return html`<article class="ma-next fade-up" data-appt="${a.id}" aria-label="${'Tu próxima cita: ' + dateLongCap(a.date) + ' a las ' + fmtTime(a.start_min)}">
        <div class="ma-top">
          <div class="ma-date" aria-hidden="true"><span class="dw">${WEEKDAYS_SHORT[wd]}</span><span class="dn">${dayNum(a.date)}</span><span class="mo">${MONTHS_SHORT[+a.date.slice(5, 7) - 1]}</span></div>
          <div class="ma-when"><div class="eyebrow">Tu próxima cita</div><div class="rel">${relText(a.date, t0)}</div>
            <div class="tm">${fmtTime(a.start_min)} <small>a ${fmtTime(a.end_min)} · ${duration(a.duration_min || (a.end_min - a.start_min))}</small></div>
            ${statusBadge(a.status)}</div>
        </div>
        <div class="ma-det">
          <div class="ma-row">${avatar(a.staff_name || 'Barbero', { color: colorFor(a.staff_name), size: 'sm' })}<span class="grow"><span class="k">Te atiende</span><span class="v">${a.staff_name || 'Por asignar'}</span></span></div>
          <div class="ma-row">${raw(icon('scissors'))}<span class="grow"><span class="k">Servicios</span><span class="ma-svc">${svcNames(a).map((n) => html`<span>${n}</span>`)}</span></span><span class="ma-total num" aria-label="${'Total ' + money(a.total)}">${money(a.total)}</span></div>
          ${addr ? html`<div class="ma-row">${raw(icon('map'))}<span class="grow"><span class="k">${a.shop ? a.shop.name : sh.name}</span><span class="v">${addr}</span></span>${mapU ? html`<a class="lk" href="${mapU}" target="_blank" rel="noopener">Cómo llegar${raw(icon('external', 'ic-sm'))}</a>` : ''}</div>` : ''}
        </div>
        ${a.deadline_text && (a.can_cancel || a.can_reschedule) ? html`<p class="ma-pol">${raw(icon('info'))}<span>${tidy(a.deadline_text)}${a.folio ? html` <span style="white-space:nowrap">Folio ${a.folio}</span>` : ''}</span></p>` : ''}
        ${a.can_cancel || a.can_reschedule ? html`<div class="ma-acts">
            <button type="button" class="btn btn-secondary" data-act="move">${raw(icon('calendar-clock'))}<span>Reagendar</span></button>
            <button type="button" class="btn btn-secondary" data-act="cal" aria-haspopup="menu">${raw(icon('calendar-plus'))}<span>Calendario</span></button>
            <button type="button" class="btn btn-ghost btn-cancel" data-act="cancel">${raw(icon('x-circle'))}<span>Cancelar</span></button></div>`
          : html`<div class="ma-locked"><div class="row top">${raw(icon('lock'))}<span>${tidy(a.deadline_text) || 'Ya no es posible cambiarla en línea. Si necesitas algo, contacta a la barbería.'}${a.folio ? html` <span style="white-space:nowrap;color:#8E8676">Folio ${a.folio}</span>` : ''}</span></div>
            <div class="row">${c.wa ? html`<a class="btn btn-wa btn-sm" href="${c.wa}" target="_blank" rel="noopener">${raw(icon('whatsapp', 'ic-sm'))}WhatsApp</a>` : ''}${c.tel ? html`<a class="btn btn-secondary btn-sm" href="${c.tel}">${raw(icon('phone', 'ic-sm'))}Llamar</a>` : ''}
              <button type="button" class="btn btn-secondary btn-sm" data-act="cal" aria-haspopup="menu">${raw(icon('calendar-plus', 'ic-sm'))}Calendario</button></div></div>`}
      </article>`;
    }
    function otherCard(a) {
      return html`<article class="card ma-card fade-up" data-appt="${a.id}">
        <span class="ma-mini" aria-hidden="true"><small>${WEEKDAYS_SHORT[weekday(a.date)]}</small><b>${dayNum(a.date)}</b><small>${MONTHS_SHORT[+a.date.slice(5, 7) - 1]}</small></span>
        <div style="min-width:0"><div class="row between" style="gap:8px"><span class="ttl">${cap(relDay(a.date, t0))} · ${fmtTime(a.start_min)}</span>${statusBadge(a.status)}</div>
          <div class="meta truncate">${svcNames(a).join(', ')}</div><div class="meta">con ${a.staff_name || 'por asignar'} · <b class="num" style="color:var(--text)">${money(a.total)}</b></div></div>
        <div class="acts">
          <button type="button" class="btn btn-secondary btn-sm" data-act="move">${raw(icon('calendar-clock', 'ic-sm'))}Reagendar</button>
          <button type="button" class="btn btn-ghost btn-sm" data-act="cal" aria-haspopup="menu" aria-label="Agregar al calendario">${raw(icon('calendar-plus', 'ic-sm'))}Calendario</button>
          <button type="button" class="btn btn-danger-ghost btn-sm" data-act="cancel">${raw(icon('x-circle', 'ic-sm'))}Cancelar</button></div>
      </article>`;
    }
    // Próxima cita en otra barbería de la misma cuenta: se gestiona allá (cambiando de barbería).
    function awayCard(e) {
      const a = e.next;
      return html`<article class="card ma-card ma-away fade-up">
        <span class="ma-mini" aria-hidden="true"><small>${WEEKDAYS_SHORT[weekday(a.date)]}</small><b>${dayNum(a.date)}</b><small>${MONTHS_SHORT[+a.date.slice(5, 7) - 1]}</small></span>
        <div style="min-width:0"><div class="shop">${raw(icon('store'))}<span>${e.shop_name}</span></div>
          <div class="row between" style="gap:8px"><span class="ttl">${cap(relDay(a.date, t0))} · ${fmtTime(a.start_min)}</span>${statusBadge(a.status)}</div>
          <div class="meta truncate">${svcNames(a).join(', ')}</div><div class="meta">con ${a.staff_name || 'por asignar'}${e.count > 1 ? ' · y ' + plural(e.count - 1, 'cita más', 'citas más') + ' ahí' : ''}</div></div>
        <div class="acts"><button type="button" class="btn btn-secondary btn-sm" data-go-shop="${e.shop_id}" aria-label="${'Ver y gestionar tus citas en ' + e.shop_name}">${raw(icon('arrow-right', 'ic-sm'))}Ver y gestionar</button></div>
      </article>`;
    }
    function histItem(a) {
      const again = (a.services || []).find((s) => s.id);
      return html`<div class="list-item ${a.status}">
        <span class="ma-mini" aria-hidden="true"><b>${dayNum(a.date)}</b><small>${MONTHS_SHORT[+a.date.slice(5, 7) - 1]}</small></span>
        <span class="grow" style="min-width:0"><span class="title truncate">${svcNames(a).join(', ') || 'Servicio'}</span>
          <span class="meta truncate">${cap(dateShort(a.date))} · ${fmtTime(a.start_min)}${a.staff_name ? ' · ' + firstName(a.staff_name) : ''}</span></span>
        <span class="trail"><span class="num" style="font-weight:600;font-size:14px">${money(a.total)}</span>${a.status === 'completed' && again
          ? html`<a class="link-btn again" href="${bookUrl(sh.slug, again.id)}" target="_blank" rel="noopener">${raw(icon('repeat', 'ic-sm'))}Repetir</a>` : statusBadge(a.status)}</span>
      </div>`;
    }
    function paint() {
      const up = data.upcoming || [], past = data.past || [], away = data.elsewhere || [];
      const visits = past.filter((a) => a.status === 'completed');
      const first = visits.length ? visits[visits.length - 1].date : null;
      const spent = visits.reduce((s, a) => s + (Number(a.total) || 0), 0);
      const awayN = away.reduce((n, e) => n + (e.count || 1), 0);
      const awaySec = (gap) => html`<div class="ma-sec" style="${'margin-top:' + gap + 'px'}"><h3>En tus otras barberías <span class="n">${awayN}</span></h3>${away.map(awayCard)}</div>`;
      const nextHtml = up.length ? html`${nextCard(up[0])}${up.length > 1 ? html`<div class="ma-sec" style="margin-top:18px"><h3>También tienes <span class="n">${up.length - 1}</span></h3>${up.slice(1).map(otherCard)}</div>` : ''}${away.length ? awaySec(18) : ''}`
        // Sin citas aquí pero sí en otra barbería: se dice claro y se muestran esas (no un «no tienes citas» a secas).
        : away.length ? html`<div class="banner info ma-here">${raw(icon('info'))}<div class="grow">No tienes citas próximas en <b>${sh.name}</b>, pero sí ${awayN === 1 ? 'una' : awayN} en ${away.length === 1 ? away[0].shop_name : 'tus otras barberías'}.</div></div>${awaySec(0)}`
        : html`<div class="card">${emptyState({ icon: 'calendar-plus', title: past.length ? 'No tienes citas próximas' : '¡Bienvenido!', text: past.length ? '¿Ya toca el siguiente corte? Reserva en segundos y elige a tu barbero favorito.' : 'Aquí verás tus citas en ' + sh.name + '. Reserva la primera en segundos.', action: { label: 'Reservar cita', href: bookUrl(sh.slug), icon: 'calendar-plus' } })}</div>`;
      body.innerHTML = String(html`<div class="ma-grid">
        <section class="ma-sec" aria-labelledby="maUp"><h3 id="maUp">Próximas${up.length ? html` <span class="n">${up.length}</span>` : ''}</h3>${nextHtml}</section>
        <section class="ma-sec ma-side" aria-labelledby="maHist"><h3 id="maHist">Historial</h3>
          ${visits.length ? html`<div class="ma-stats"><div><b>${visits.length}</b><span>${visits.length === 1 ? 'visita' : 'visitas'}</span></div><div><b>${money(spent)}</b><span>en servicios</span></div>${first ? html`<div><b>${cap(MONTHS_SHORT[+first.slice(5, 7) - 1])} ${first.slice(0, 4)}</b><span>primera visita</span></div>` : ''}</div>` : ''}
          ${past.length ? html`<div class="card ma-hist"><div class="list">${past.slice(0, 30).map(histItem)}</div></div>`
            : html`<div class="card">${emptyState({ icon: 'clock', title: 'Sin visitas todavía', text: 'Cuando te atiendan, aquí verás tu historial para repetir tu servicio favorito.', compact: true })}</div>`}
          ${up.length || past.length ? html`<div class="ma-cta" style="margin-top:14px"><b>¿Listo para tu siguiente corte?</b><span class="muted" style="font-size:13.5px">Elige día, hora y barbero en segundos.</span><a class="btn btn-dark" href="${bookUrl(sh.slug)}" target="_blank" rel="noopener">${raw(icon('calendar-plus'))}Reservar otra cita</a></div>` : ''}
        </section></div>`);
    }
    async function load() {
      try {
        data = await api.get('/my/appointments');
        paint();
      } catch (e) {
        body.innerHTML = String(html`<div class="card">${errorState(e, 'maRetry')}</div>`);
      }
    }
    const find = (id) => data && (data.upcoming || []).find((x) => x.id === id);

    async function cancel(a, btn) {
      if (!a.can_cancel) return openLocked(a, sh);
      const reason = await promptDialog({
        title: '¿Cancelar tu cita?', danger: true, optional: true, multiline: true, max: 300, chips: REASONS,
        message: dateLongCap(a.date) + ' a las ' + fmtTime(a.start_min) + (a.staff_name ? ' con ' + a.staff_name : '') + '. Si cambias de opinión, puedes volver a reservar cuando quieras.',
        label: '¿Nos cuentas por qué?', placeholder: 'Nos ayuda a mejorar', confirmText: 'Sí, cancelar cita', cancelText: 'Mantener mi cita'
      });
      if (reason === null) return;
      try {
        await busy(btn, api.post('/my/appointments/' + encodeURIComponent(a.id) + '/cancel', { reason: reason || undefined }));
        toast.success('Cancelamos tu cita del ' + dateLong(a.date) + '. ¡Te esperamos pronto!');
        bus.emit('appointments:changed');
        await load();
      } catch (err) {
        toast.error(err);
        if (err.status === 409) load();
      }
    }

    const offs = [];
    offs.push(on(el, 'click', '#maRetry', () => { body.innerHTML = String(html`<div class="skel" style="height:340px;border-radius:var(--r-xl)"></div>`); load(); }));
    offs.push(on(el, 'click', '[data-switch-shop]', () => window.TB.openShopSwitcher()));
    // Cambiar a la otra barbería: selectShop emite 'context' y el shell vuelve a pintar «Mis citas» con esa barbería.
    offs.push(on(el, 'click', '[data-go-shop]', async (e, b) => {
      const prev = sh.id;
      try {
        if (!(await busy(b, () => selectShop(b.dataset.goShop)))) return; // doble toque: ya se está cambiando
        window.scrollTo(0, 0);
        toast.success('Ahora ves tus citas en ' + shop().name);
      } catch (err) {
        toast.error(err);
        try { await selectShop(prev); } catch (er) { /* se queda como estaba */ }
      }
    }));
    offs.push(on(el, 'click', '[data-act]', (e, b) => {
      const card = b.closest('[data-appt]');
      const a = card && find(card.dataset.appt);
      if (!a) return;
      const act = b.dataset.act;
      if (act === 'cancel') cancel(a, b);
      if (act === 'move') {
        if (!a.can_reschedule) return openLocked(a, sh, a.can_cancel ? 'Esta cita ya no se puede reagendar en línea (se movió varias veces o la barbería no recibe cambios en línea por ahora). Puedes cancelarla y reservar de nuevo, o contactar a la barbería.' : a.deadline_text);
        openReschedule(a, sh, () => load());
      }
      if (act === 'cal') {
        menu(b, [
          { label: 'Google Calendar', icon: 'calendar', href: googleCalUrl(a, sh), external: true },
          { label: 'Apple / Outlook (.ics)', icon: 'download', onClick: () => { saveFile('cita-' + (a.folio || a.id) + '.ics', icsFile(a, sh), 'text/calendar;charset=utf-8'); toast.success('Abre el archivo para agregar la cita a tu calendario'); } }
        ]);
      }
    }));
    await load();
    return () => offs.forEach((f) => f());
  }
};
