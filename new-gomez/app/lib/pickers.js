// Selectores reutilizables para formularios de citas (y cualquier vista que los necesite).
// Cada uno se monta en un contenedor (host) vacío, pinta su propio HTML, maneja su estado y devuelve
// un controlador. Todos llaman opts.onChange(valor) cuando el usuario cambia algo.
//
//  pickClient(host, { value, onChange, allowCreate = true, allowWalkin = true, placeholder })
//    value: { id, name, phone }            cliente existente (de GET /api/clients)
//         | { new: true, name, phone }     cliente nuevo que se creará al guardar
//         | { walkin: true, name }         cliente sin registro (walk-in); name opcional
//    → { get(), set(v), focus(), validate() → mensaje | null, destroy() }
//
//  servicesPicker(host, { services, value: [ids], extra: [snapshot], staffId, onChange })
//    services: catálogo (GET /api/services); extra: servicios guardados en la cita que ya no están activos.
//    → { get() → [ids], set(ids), selected() → [servicios], totals() → { count, duration, price }, setStaff(id) }
//
//  staffSelect(host, { staff, value, onChange, allowAny = false, anyLabel = 'Cualquiera' })
//    → { get() → id | 'any' | '', set(id) }
//
//  dayStrip(host, { value, today, days = 30, onChange, isOff(date) → bool })
//    Tira horizontal de días + botón de calendario para cualquier otra fecha.
//    → { get() → 'YYYY-MM-DD', set(date) }
//
//  slotChips(host, { date, services: [ids], staffId, exclude, value, onChange, allowCustom = true,
//                    original: { date, staff_id, start_min } })
//    Horarios libres desde GET /api/slots, agrupados (mañana / tarde / noche) + "Otra hora" (input time).
//    → { get() → { start_min, custom, free } | null, set(min), load({ date, services, staffId }), isFree(min) }
//
//  Utilidades: hexRgb('#c8a24a') → '200,162,74' (para rgba(var(--c-rgb), .15)).
import { html, raw, esc, $ } from './html.js';
import { icon } from './icons.js';
import { api } from './api.js';
import { today as todayKey, nowMin } from './state.js';
import { avatar } from './ui.js';
import { money, time, duration, addDays, weekday, diffDays, WEEKDAYS_SHORT, MONTHS_SHORT, dayNum, dateLongCap, phone as fmtPhone, plural } from './fmt.js';

let uidN = 0;
const uid = (p) => p + (++uidN) + Math.random().toString(36).slice(2, 5);
// Los selectores con scroll horizontal necesitan un contenedor que pueda encogerse (en grid/flex el mínimo es "auto").
const fit = (host) => { host.style.minWidth = '0'; host.style.maxWidth = '100%'; };

export function hexRgb(hex) {
  let h = String(hex || '').trim().replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(h)) return '196,154,60';
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(',');
}
const digits = (s) => String(s || '').replace(/\D/g, '');
const normPhone = (s) => { let d = digits(s); if (d.length === 12 && d.startsWith('52')) d = d.slice(2); if (d.length === 13 && d.startsWith('521')) d = d.slice(3); return d; };

// ── Estilos (una sola vez) ─────────────────────────────────────────────
function ensureStyles() {
  if (document.getElementById('st-pickers')) return;
  document.head.insertAdjacentHTML('beforeend', `<style id="st-pickers">
.pk-card{border:1px solid var(--border);border-radius:var(--r);background:var(--surface);overflow:hidden}
/* cliente */
.pc{display:grid;gap:8px}
.pc-q{position:relative}
.pc-q .input{padding-right:40px}
.pc-q .pc-clear{position:absolute;right:4px;top:50%;transform:translateY(-50%)}
.pc-list{display:grid;border:1px solid var(--border);border-radius:var(--r);background:var(--surface);overflow:hidden;animation:fadeUp .22s var(--ease-out)}
.pc-sec{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text-3);padding:10px 12px 6px;background:var(--surface-2);border-bottom:1px solid var(--border)}
.pc-opt{display:flex;align-items:center;gap:10px;width:100%;min-height:54px;padding:8px 12px;text-align:left;border-bottom:1px solid var(--border);transition:background .12s}
.pc-opt:last-child{border-bottom:0}
.pc-opt:hover,.pc-opt.on{background:var(--surface-2)}
.pc-opt .t{display:block;font-weight:600;font-size:14.5px}
.pc-opt .m{display:block;font-size:12.5px;color:var(--text-2)}
.pc-opt mark{background:var(--brand-soft);color:inherit;border-radius:3px;padding:0 1px}
.pc-opt.act .t{color:var(--brand-strong)}
.pc-ico{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;background:var(--brand-soft);color:var(--brand-strong);flex:none}
.pc-ico.muted{background:var(--muted-soft);color:var(--text-2)}
.pc-ico .ic{width:18px;height:18px}
.pc-empty{padding:14px 12px;font-size:13.5px;color:var(--text-2)}
.pc-sel{display:flex;align-items:center;gap:12px;padding:10px 10px 10px 12px;border:1px solid var(--border-strong);border-radius:var(--r);background:var(--surface-2);animation:fadeUp .25s var(--ease-out)}
.pc-sel .t{font-weight:600;font-size:15px}
.pc-sel .m{font-size:12.5px;color:var(--text-2)}
.pc-new{display:grid;gap:12px;padding:14px;border:1px dashed var(--brand);border-radius:var(--r);background:var(--brand-softer);animation:fadeUp .25s var(--ease-out)}
.pc-new-h{display:flex;align-items:center;justify-content:space-between;gap:8px;font-weight:600;font-size:14px}
/* servicios */
.sp{display:grid;gap:10px}
.sp-cat{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text-3);margin:4px 0 -2px}
.sp-grid{display:grid;gap:8px;grid-template-columns:minmax(0,1fr)}
@media (min-width:600px){.sp-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
.sp-item{display:flex;align-items:center;gap:10px;min-height:58px;padding:10px 12px;border:1px solid var(--border-strong);border-radius:var(--r);background:var(--surface);text-align:left;transition:border-color .15s,background .15s,box-shadow .15s,transform .12s var(--ease)}
.sp-item:hover{border-color:var(--text-3)}
.sp-item:active{transform:scale(.985)}
.sp-item[aria-pressed="true"]{border-color:var(--brand);background:var(--brand-softer);box-shadow:0 0 0 1px var(--brand) inset}
.sp-item.na .sp-name{color:var(--text-2)}
.sp-check{width:22px;height:22px;border-radius:7px;border:1.5px solid var(--border-strong);display:grid;place-items:center;flex:none;transition:background .15s,border-color .15s}
.sp-check .ic{width:14px;height:14px;stroke-width:3;opacity:0;transform:scale(.4);transition:opacity .15s,transform .2s var(--ease-out)}
.sp-item[aria-pressed="true"] .sp-check{background:var(--brand);border-color:var(--brand);color:var(--brand-ink)}
.sp-item[aria-pressed="true"] .sp-check .ic{opacity:1;transform:none}
.sp-name{display:block;font-weight:600;font-size:14px;line-height:1.3}
.sp-meta{display:block;font-size:12.5px;color:var(--text-2);margin-top:1px}
.sp-price{font-weight:700;font-size:14px;font-variant-numeric:tabular-nums;flex:none}
.sp-filter{margin-bottom:2px}
/* barbero */
.ss{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;padding:2px;margin:-2px;min-width:0;max-width:calc(100% + 4px)}
.ss::-webkit-scrollbar{display:none}
.ss-opt{display:inline-flex;align-items:center;gap:8px;min-height:48px;padding:6px 16px 6px 6px;border-radius:999px;border:1px solid var(--border-strong);background:var(--surface);font-weight:600;font-size:14px;white-space:nowrap;flex:none;transition:border-color .15s,background .15s,box-shadow .15s,transform .12s var(--ease)}
.ss-opt:hover{border-color:var(--text-3)}
.ss-opt:active{transform:scale(.97)}
.ss-opt[aria-checked="true"]{border-color:var(--c,var(--brand));box-shadow:0 0 0 1.5px var(--c,var(--brand)) inset;background:rgba(var(--c-rgb,196,154,60),.12)}
.ss-opt .avatar{--s:36px}
.ss-any{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;background:var(--muted-soft);color:var(--text-2)}
/* días */
.ds{display:flex;gap:8px;align-items:stretch;min-width:0;max-width:100%}
.ds-track{display:flex;gap:6px;overflow-x:auto;scroll-snap-type:x proximity;scrollbar-width:none;flex:1;min-width:0;padding:3px 2px;scroll-behavior:smooth}
.ds-track::-webkit-scrollbar{display:none}
.ds-track{padding-right:18px;-webkit-mask-image:linear-gradient(90deg,#000 calc(100% - 26px),transparent);mask-image:linear-gradient(90deg,#000 calc(100% - 26px),transparent)}
.ds-day{flex:none;width:58px;min-height:70px;display:grid;justify-items:center;align-content:center;gap:0;border-radius:14px;border:1px solid var(--border);background:var(--surface);scroll-snap-align:center;transition:background .15s,border-color .15s,color .15s,transform .12s var(--ease)}
.ds-day:hover{border-color:var(--border-strong)}
.ds-day:active{transform:scale(.95)}
.ds-dow{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-3)}
.ds-num{font-family:var(--disp);font-size:23px;font-weight:800;line-height:1.1;font-variant-numeric:tabular-nums}
.ds-mon{font-size:10.5px;color:var(--text-3);font-weight:500}
.ds-day.today .ds-dow{color:var(--brand-strong)}
.ds-day.off{background:var(--surface-2)}
.ds-day.off .ds-num{color:var(--text-3)}
.ds-day[aria-selected="true"]{background:var(--ink);border-color:var(--ink);color:var(--on-ink);box-shadow:var(--shadow-2)}
.ds-day[aria-selected="true"] .ds-dow,.ds-day[aria-selected="true"] .ds-mon,.ds-day[aria-selected="true"] .ds-num{color:inherit}
:root[data-theme="dark"] .ds-day[aria-selected="true"]{background:var(--brand);border-color:var(--brand);color:var(--brand-ink)}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .ds-day[aria-selected="true"]{background:var(--brand);border-color:var(--brand);color:var(--brand-ink)}}
.ds-cal{position:relative;flex:none;width:48px;border-radius:14px;border:1px solid var(--border-strong);background:var(--surface);display:grid;place-items:center;color:var(--text-2);overflow:hidden}
.ds-cal:hover{border-color:var(--text-3);color:var(--text)}
.ds-cal input{position:absolute;inset:0;opacity:0;width:100%;height:100%;cursor:pointer;font-size:16px}
.ds-cal:focus-within{outline:2.5px solid var(--brand);outline-offset:2px}
/* horarios */
.sc{display:grid;gap:10px}
.sc-h{font-size:12px;font-weight:600;color:var(--text-3);display:flex;align-items:center;gap:6px;margin-bottom:6px}
.sc-h .ic{width:14px;height:14px}
.sc-chips{display:grid;grid-template-columns:repeat(auto-fill,minmax(74px,1fr));gap:6px}
.sc-chip{min-height:44px;border-radius:11px;border:1px solid var(--border-strong);background:var(--surface);font-weight:600;font-size:14.5px;font-variant-numeric:tabular-nums;transition:background .15s,border-color .15s,color .15s,box-shadow .2s,transform .12s var(--ease)}
.sc-chip:hover{border-color:var(--brand)}
.sc-chip:active{transform:scale(.95)}
.sc-chip[aria-pressed="true"]{background:var(--brand);border-color:var(--brand);color:var(--brand-ink);box-shadow:0 4px 14px rgba(196,154,60,.32)}
.sc-skel{height:44px;border-radius:11px}
.sc-msg{display:flex;gap:10px;align-items:flex-start;padding:12px 14px;border-radius:var(--r);background:var(--surface-2);border:1px solid var(--border);font-size:13.5px;color:var(--text-2)}
.sc-msg .ic{flex:none;margin-top:1px;color:var(--text-3)}
.sc-custom{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.sc-custom .input{width:auto;min-width:130px;max-width:170px;font-variant-numeric:tabular-nums}
.sc-other[aria-pressed="true"]{background:var(--ink);border-color:var(--ink);color:var(--on-ink)}
.sc-note{font-size:12.5px;display:flex;align-items:center;gap:6px;width:100%}
.sc-note .ic{width:15px;height:15px}
.sc-past{justify-self:start}
</style>`);
}

// ═══════════════════════════════════════════════════════════════════════
// Cliente: buscador con debounce, crear al vuelo o cliente sin registro.
// ═══════════════════════════════════════════════════════════════════════
export function pickClient(host, opts) {
  opts = Object.assign({ allowCreate: true, allowWalkin: true, placeholder: 'Busca por nombre o teléfono' }, opts || {});
  ensureStyles();
  const id = uid('pc');
  let value = opts.value || null;
  let mode = value ? (value.new ? 'new' : 'selected') : 'search';
  let q = '', items = [], active = -1, seq = 0, timer = null, recent = null, loading = false, error = null;
  host.classList.add('pc');
  fit(host);

  const emit = () => { if (opts.onChange) opts.onChange(get()); };
  const get = () => {
    if (mode === 'new') {
      const n = $('#' + id + 'n', host), p = $('#' + id + 'p', host);
      return { new: true, name: n ? n.value.trim().replace(/\s+/g, ' ') : (value && value.name) || '', phone: p ? normPhone(p.value) : (value && value.phone) || '' };
    }
    if (mode === 'selected' && value && value.walkin) {
      const n = $('#' + id + 'w', host);
      return { walkin: true, name: n ? n.value.trim().replace(/\s+/g, ' ') : value.name || '' };
    }
    return mode === 'selected' ? value : null;
  };

  function hl(text) {
    const s = String(text || '');
    const w = q.trim();
    if (!w || /^\d/.test(w)) return esc(s);
    const i = s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').indexOf(w.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''));
    if (i < 0) return esc(s);
    return esc(s.slice(0, i)) + '<mark>' + esc(s.slice(i, i + w.length)) + '</mark>' + esc(s.slice(i + w.length));
  }
  const metaOf = (c) => {
    const bits = [];
    if (c.phone) bits.push(fmtPhone(c.phone));
    const v = c.stats ? c.stats.visits : 0;
    bits.push(v ? plural(v, 'visita') : 'Sin visitas aún');
    return bits.join(' · ');
  };

  function listHtml() {
    const rows = [];
    const list = q.trim() ? items : (recent || []);
    if (!q.trim() && recent && recent.length) rows.push('<div class="pc-sec">Recientes</div>');
    if (loading && !list.length) rows.push('<div class="pc-empty"><div class="skel skel-line" style="width:55%"></div><div class="skel skel-line" style="width:35%;height:10px"></div></div>');
    else if (error) rows.push('<div class="pc-empty err-t">' + esc(error) + '</div>');
    else if (q.trim() && !list.length) rows.push('<div class="pc-empty">No encontramos a «' + esc(q.trim()) + '». ' + (opts.allowCreate ? 'Puedes crearlo abajo.' : '') + '</div>');
    list.forEach((c, i) => rows.push('<button type="button" role="option" class="pc-opt' + (i === active ? ' on' : '') + '" data-pc-i="' + i + '" aria-selected="' + String(i === active) + '">' +
      avatar(c.name, { size: 'sm' }) + '<span class="grow"><span class="t truncate">' + hl(c.name) + '</span><span class="m truncate">' + esc(metaOf(c)) + '</span></span></button>'));
    const n = list.length;
    if (opts.allowCreate) {
      const label = q.trim() ? 'Crear «' + q.trim() + '» como cliente nuevo' : 'Cliente nuevo';
      rows.push('<button type="button" role="option" class="pc-opt act' + (active === n ? ' on' : '') + '" data-pc="new" aria-selected="' + String(active === n) + '"><span class="pc-ico">' + icon('user-plus') + '</span><span class="grow"><span class="t truncate">' + esc(label) + '</span><span class="m">Con nombre y teléfono para WhatsApp</span></span></button>');
    }
    if (opts.allowWalkin) {
      const k = n + (opts.allowCreate ? 1 : 0);
      rows.push('<button type="button" role="option" class="pc-opt act' + (active === k ? ' on' : '') + '" data-pc="walkin" aria-selected="' + String(active === k) + '"><span class="pc-ico muted">' + icon('door') + '</span><span class="grow"><span class="t" style="color:var(--text)">Cliente sin registro</span><span class="m">Llegó sin cita y no quiere dar sus datos</span></span></button>');
    }
    return rows.join('');
  }
  const optionCount = () => (q.trim() ? items : (recent || [])).length + (opts.allowCreate ? 1 : 0) + (opts.allowWalkin ? 1 : 0);

  function render() {
    if (mode === 'selected' && value && value.walkin) {
      host.innerHTML = String(html`<div class="pc-sel">
        <span class="pc-ico muted">${raw(icon('door'))}</span>
        <div class="grow"><div class="t">Cliente sin registro</div><div class="m">Se guardará como «Cliente de paso» si no escribes nombre.</div></div>
        <button type="button" class="btn btn-ghost btn-sm" data-pc="change">Cambiar</button></div>
        <div class="field" style="margin-top:2px"><label for="${id}w">Nombre <span class="opt">(opcional)</span></label>
        <input class="input" id="${id}w" maxlength="80" autocomplete="off" placeholder="Ej. Carlos" value="${value.name || ''}"/></div>`);
      return;
    }
    if (mode === 'selected' && value) {
      host.innerHTML = String(html`<div class="pc-sel">
        ${avatar(value.name)}
        <div class="grow"><div class="t truncate">${value.name}</div><div class="m truncate">${value.phone ? fmtPhone(value.phone) : 'Sin teléfono'}${value.stats ? ' · ' + (value.stats.visits ? plural(value.stats.visits, 'visita') : 'Primera visita') : ''}</div></div>
        <button type="button" class="btn btn-ghost btn-sm" data-pc="change">Cambiar</button></div>`);
      return;
    }
    if (mode === 'new') {
      const v = value && value.new ? value : { name: '', phone: '' };
      host.innerHTML = String(html`<div class="pc-new">
        <div class="pc-new-h"><span class="row" style="gap:8px">${raw(icon('user-plus', 'ic-sm'))}Cliente nuevo</span>
          <button type="button" class="btn btn-ghost btn-sm" data-pc="back">${raw(icon('search', 'ic-sm'))}Buscar</button></div>
        <div class="form-grid cols-2">
          <div class="field"><label for="${id}n">Nombre</label>
            <input class="input" id="${id}n" maxlength="80" autocomplete="off" autocapitalize="words" placeholder="Nombre y apellido" value="${v.name}"/>
            <p class="error">Escribe el nombre (mínimo 2 letras).</p></div>
          <div class="field"><label for="${id}p">Teléfono <span class="opt">(recomendado)</span></label>
            <input class="input" id="${id}p" type="tel" inputmode="tel" autocomplete="off" maxlength="16" placeholder="10 dígitos" value="${v.phone ? fmtPhone(v.phone) : ''}"/>
            <p class="hint">Para enviarle su confirmación por WhatsApp.</p>
            <p class="error">Escribe un teléfono de 10 dígitos.</p></div>
        </div></div>`);
      return;
    }
    host.innerHTML = String(html`<div class="pc-q input-group">${raw(icon('search'))}
        <input class="input" id="${id}q" type="text" enterkeyhint="search" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="${opts.placeholder}"
          role="combobox" aria-expanded="true" aria-controls="${id}l" aria-autocomplete="list" aria-label="Buscar cliente" value="${q}"/>
        <button type="button" class="btn btn-ghost btn-icon btn-sm pc-clear" data-pc="clear" aria-label="Borrar búsqueda" ${q ? '' : 'hidden'}>${raw(icon('x', 'ic-sm'))}</button>
      </div>
      <div class="pc-list" id="${id}l" role="listbox" aria-label="Clientes">${raw(listHtml())}</div>`);
  }
  function paintList() { const l = $('#' + id + 'l', host); if (l) l.innerHTML = listHtml(); const c = $('[data-pc="clear"]', host); if (c) c.hidden = !q; }

  async function search() {
    const text = q.trim();
    const my = ++seq;
    if (!text) { if (recent) { paintList(); return; } }
    loading = true; error = null; paintList();
    try {
      const r = await api.get('/clients', text ? { q: text, limit: 8, sort: 'recent' } : { limit: 5, sort: 'recent' });
      if (my !== seq) return;
      if (text) items = r.items || []; else recent = r.items || [];
    } catch (e) { if (my !== seq) return; error = e.message || 'No se pudo buscar.'; items = []; }
    loading = false; active = -1; paintList();
  }
  function choose(i) {
    const list = q.trim() ? items : (recent || []);
    const c = list[i];
    if (!c) return;
    value = { id: c.id, name: c.name, phone: c.phone || '', stats: c.stats || null };
    mode = 'selected'; render(); emit();
    const b = $('[data-pc="change"]', host); if (b) b.focus({ preventScroll: true });
  }
  function toNew() {
    const t = q.trim();
    const isNum = /^[\d\s()+.-]{3,}$/.test(t);
    value = { new: true, name: isNum ? '' : t, phone: isNum ? normPhone(t) : '' };
    mode = 'new'; render(); emit();
    const f = $('#' + id + (isNum || !t ? 'n' : 'p'), host); if (f) f.focus();
  }
  function toWalkin() { value = { walkin: true, name: '' }; mode = 'selected'; render(); emit(); }

  const onClick = (e) => {
    const b = e.target.closest('[data-pc],[data-pc-i]');
    if (!b || !host.contains(b)) return;
    if (b.dataset.pcI != null) return choose(+b.dataset.pcI);
    const a = b.dataset.pc;
    if (a === 'new') toNew();
    else if (a === 'walkin') toWalkin();
    else if (a === 'change' || a === 'back') { mode = 'search'; value = null; render(); emit(); focus(); if (!recent) search(); }
    else if (a === 'clear') { q = ''; items = []; render(); focus(); search(); }
  };
  const onInput = (e) => {
    if (e.target.id === id + 'q') {
      q = e.target.value; active = -1;
      clearTimeout(timer); timer = setTimeout(search, 260);
      const c = $('[data-pc="clear"]', host); if (c) c.hidden = !q;
    } else if (e.target.id === id + 'p') {
      const f = e.target.closest('.field'); if (f) f.classList.remove('invalid'); emit();
    } else if (e.target.id === id + 'n' || e.target.id === id + 'w') {
      const f = e.target.closest('.field'); if (f) f.classList.remove('invalid'); emit();
    }
  };
  const onKey = (e) => {
    if (e.target.id !== id + 'q') return;
    const n = optionCount();
    if (e.key === 'ArrowDown') { e.preventDefault(); active = (active + 1) % n; paintList(); scrollActive(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = active <= 0 ? n - 1 : active - 1; paintList(); scrollActive(); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      const list = q.trim() ? items : (recent || []);
      if (active < 0 && list.length === 1) return choose(0);
      if (active < 0) return;
      const el = $('.pc-list .pc-opt.on', host); if (el) el.click();
    } else if (e.key === 'Escape' && q) { e.preventDefault(); e.stopPropagation(); q = ''; render(); focus(); search(); }
  };
  const onBlurPhone = (e) => { if (e.target.id === id + 'p' && digits(e.target.value).length === 10) e.target.value = fmtPhone(normPhone(e.target.value)); };
  function scrollActive() { const el = $('.pc-list .pc-opt.on', host); if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' }); }
  host.addEventListener('click', onClick);
  host.addEventListener('input', onInput);
  host.addEventListener('keydown', onKey);
  host.addEventListener('focusout', onBlurPhone);
  render();
  if (mode === 'search') search();

  function focus() { const i = $('#' + id + 'q', host) || $('#' + id + 'n', host); if (i) i.focus({ preventScroll: true }); }
  function validate() {
    const v = get();
    if (!v) return 'Elige un cliente, crea uno nuevo o marca «Cliente sin registro».';
    if (v.new) {
      let bad = null;
      const nf = $('#' + id + 'n', host).closest('.field'), pf = $('#' + id + 'p', host).closest('.field');
      if (v.name.length < 2) { nf.classList.add('invalid'); bad = 'Escribe el nombre del cliente.'; }
      if (v.phone && v.phone.length !== 10) { pf.classList.add('invalid'); bad = bad || 'Revisa el teléfono: deben ser 10 dígitos.'; }
      return bad;
    }
    return null;
  }
  // Marca error de un campo del cliente nuevo (errores del servidor: client.name / client.phone).
  function fieldError(which, msg) {
    const el = $('#' + id + (which === 'phone' ? 'p' : 'n'), host);
    const f = el && el.closest('.field');
    if (!f) return false;
    f.classList.add('invalid');
    if (msg) { const p = f.querySelector('.error'); if (p) p.textContent = msg; }
    return true;
  }
  return {
    get, validate, focus, fieldError,
    set(v) { value = v || null; mode = value ? (value.new ? 'new' : 'selected') : 'search'; render(); if (mode === 'search') search(); },
    destroy() { clearTimeout(timer); host.removeEventListener('click', onClick); host.removeEventListener('input', onInput); host.removeEventListener('keydown', onKey); host.removeEventListener('focusout', onBlurPhone); }
  };
}

// ═══════════════════════════════════════════════════════════════════════
// Servicios: multi-selección con precio y duración.
// ═══════════════════════════════════════════════════════════════════════
export function servicesPicker(host, opts) {
  opts = opts || {};
  ensureStyles();
  let staffId = opts.staffId || '';
  const byId = new Map();
  for (const s of opts.services || []) if (s.active !== false || (opts.value || []).includes(s.id)) byId.set(s.id, s);
  for (const s of opts.extra || []) if (!byId.has(s.id)) byId.set(s.id, Object.assign({ legacy: true, active: false }, s));
  let value = (opts.value || []).filter((id) => byId.has(id));
  let filter = '';
  const list = () => Array.from(byId.values());
  const offers = (s) => !staffId || staffId === 'any' || !Array.isArray(s.staff_ids) || !s.staff_ids.length || s.staff_ids.includes(staffId);

  function itemHtml(s) {
    const on = value.includes(s.id);
    const na = !offers(s);
    const meta = [duration(s.duration_min)];
    if (s.popular) meta.push('Popular');
    if (s.legacy) meta.push('Ya no está en el catálogo');
    if (na) meta.push('No lo hace este barbero');
    return '<button type="button" class="sp-item' + (na ? ' na' : '') + '" data-sp="' + esc(s.id) + '" aria-pressed="' + String(on) + '">' +
      '<span class="sp-check">' + icon('check') + '</span>' +
      '<span class="grow"><span class="sp-name">' + esc(s.name) + '</span><span class="sp-meta">' + esc(meta.join(' · ')) + '</span></span>' +
      '<span class="sp-price">' + esc(money(s.price)) + '</span></button>';
  }
  function render() {
    const all = list();
    if (!all.length) {
      host.innerHTML = '<div class="sc-msg">' + icon('tag') + '<div>Aún no hay servicios en el catálogo. <a class="link-btn" href="#/servicios">Agregar servicios</a></div></div>';
      return;
    }
    const f = filter.trim().toLowerCase();
    const shown = f ? all.filter((s) => s.name.toLowerCase().includes(f) || String(s.category || '').toLowerCase().includes(f)) : all;
    const cats = [];
    const groups = {};
    for (const s of shown) { const c = s.category || ''; if (!groups[c]) { groups[c] = []; cats.push(c); } groups[c].push(s); }
    const multi = cats.length > 1;
    host.innerHTML = '<div class="sp">' +
      (all.length > 8 ? '<div class="input-group sp-filter">' + icon('search') + '<input class="input" data-sp-filter placeholder="Filtrar servicios" aria-label="Filtrar servicios" value="' + esc(filter) + '"/></div>' : '') +
      (shown.length ? cats.map((c) => (multi ? '<div class="sp-cat">' + esc(c || 'Otros') + '</div>' : '') + '<div class="sp-grid">' + groups[c].map(itemHtml).join('') + '</div>').join('')
        : '<div class="sc-msg">' + icon('search') + '<div>Ningún servicio coincide con «' + esc(filter) + '».</div></div>') +
      '</div>';
  }
  const onClick = (e) => {
    const b = e.target.closest('[data-sp]');
    if (!b || !host.contains(b)) return;
    const id = b.dataset.sp;
    value = value.includes(id) ? value.filter((x) => x !== id) : value.concat(id);
    b.setAttribute('aria-pressed', String(value.includes(id)));
    if (opts.onChange) opts.onChange(value.slice());
  };
  const onInput = (e) => {
    if (!e.target.matches('[data-sp-filter]')) return;
    filter = e.target.value;
    const pos = e.target.selectionStart;
    render();
    const i = $('[data-sp-filter]', host); if (i) { i.focus(); try { i.setSelectionRange(pos, pos); } catch (x) { /* */ } }
  };
  host.addEventListener('click', onClick);
  host.addEventListener('input', onInput);
  render();
  const selected = () => value.map((id) => byId.get(id)).filter(Boolean);
  return {
    get: () => value.slice(),
    set(ids) { value = (ids || []).filter((id) => byId.has(id)); render(); },
    selected,
    totals() { const s = selected(); return { count: s.length, duration: s.reduce((m, x) => m + (Number(x.duration_min) || 0), 0), price: s.reduce((m, x) => m + (Number(x.price) || 0), 0) }; },
    setStaff(id) { staffId = id || ''; render(); },
    destroy() { host.removeEventListener('click', onClick); host.removeEventListener('input', onInput); }
  };
}

// ═══════════════════════════════════════════════════════════════════════
// Barbero: opciones con avatar y color.
// ═══════════════════════════════════════════════════════════════════════
export function staffSelect(host, opts) {
  opts = opts || {};
  ensureStyles();
  let value = opts.value || '';
  const staff = opts.staff || [];
  fit(host);
  function render() {
    host.innerHTML = '<div class="ss" role="radiogroup" aria-label="' + esc(opts.label || 'Barbero') + '">' +
      (opts.allowAny ? '<button type="button" class="ss-opt" role="radio" data-ss="any" aria-checked="' + String(value === 'any') + '"><span class="ss-any">' + icon('users', 'ic-sm') + '</span>' + esc(opts.anyLabel || 'Cualquiera') + '</button>' : '') +
      staff.map((s) => '<button type="button" class="ss-opt" role="radio" data-ss="' + esc(s.id) + '" aria-checked="' + String(value === s.id) + '" style="--c:' + esc(s.color || '#8C8577') + ';--c-rgb:' + hexRgb(s.color) + '">' +
        avatar(s.name, { color: s.color || undefined, src: s.avatar_url || '' }) + '<span>' + esc(s.name) + '</span></button>').join('') + '</div>';
  }
  const onClick = (e) => {
    const b = e.target.closest('[data-ss]');
    if (!b || !host.contains(b)) return;
    value = b.dataset.ss;
    host.querySelectorAll('[data-ss]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
    if (opts.onChange) opts.onChange(value);
  };
  const onKey = (e) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(e.key) || !e.target.closest('[data-ss]')) return;
    const all = Array.from(host.querySelectorAll('[data-ss]'));
    const i = all.indexOf(e.target.closest('[data-ss]'));
    const n = all[(i + (e.key === 'ArrowRight' ? 1 : all.length - 1)) % all.length];
    if (n) { e.preventDefault(); n.focus(); n.click(); }
  };
  host.addEventListener('click', onClick);
  host.addEventListener('keydown', onKey);
  render();
  const sel = () => host.querySelector('[aria-checked="true"]');
  requestAnimationFrame(() => { const s = sel(); if (s && s.scrollIntoView && s.parentElement.scrollWidth > s.parentElement.clientWidth) s.parentElement.scrollLeft = s.offsetLeft - s.parentElement.offsetLeft - 8; });
  return {
    get: () => value,
    set(id) { value = id || ''; render(); },
    destroy() { host.removeEventListener('click', onClick); host.removeEventListener('keydown', onKey); }
  };
}

// ═══════════════════════════════════════════════════════════════════════
// Tira de días.
// ═══════════════════════════════════════════════════════════════════════
export function dayStrip(host, opts) {
  opts = opts || {};
  ensureStyles();
  const t0 = opts.today || todayKey();
  let value = opts.value || t0;
  let start;
  const days = Math.max(7, opts.days || 30);
  const id = uid('ds');
  fit(host);
  function frame() {
    const base = value < t0 ? value : t0;
    start = base;
    if (diffDays(start, value) > days - 7) start = addDays(value, -3);
  }
  function render() {
    frame();
    let s = '';
    let prevMonth = null;
    for (let i = 0; i < days; i++) {
      const d = addDays(start, i);
      const mon = +d.slice(5, 7) - 1;
      const isT = d === t0;
      const off = opts.isOff ? !!opts.isOff(d) : false;
      const showMon = prevMonth !== mon || i === 0;
      prevMonth = mon;
      s += '<button type="button" role="option" class="ds-day' + (isT ? ' today' : '') + (off ? ' off' : '') + '" data-ds="' + d + '" aria-selected="' + String(d === value) + '" aria-label="' + esc(dateLongCap(d) + (isT ? ', hoy' : '') + (off ? ', no laborable' : '')) + '">' +
        '<span class="ds-dow">' + (isT ? 'Hoy' : esc(WEEKDAYS_SHORT[weekday(d)])) + '</span><span class="ds-num">' + dayNum(d) + '</span><span class="ds-mon">' + (showMon || isT ? esc(MONTHS_SHORT[mon]) : '&nbsp;') + '</span></button>';
    }
    host.innerHTML = '<div class="ds"><div class="ds-track" role="listbox" aria-label="Fecha">' + s + '</div>' +
      '<label class="ds-cal" title="Elegir otra fecha">' + icon('calendar') + '<input type="date" id="' + id + '" aria-label="Elegir otra fecha" value="' + esc(value) + '"/></label></div>';
    center(false);
  }
  function center(smooth) {
    requestAnimationFrame(() => {
      const tr = host.querySelector('.ds-track');
      const el = host.querySelector('.ds-day[aria-selected="true"]');
      if (!tr || !el) return;
      const left = el.offsetLeft - tr.offsetLeft - tr.clientWidth / 2 + el.offsetWidth / 2;
      if (smooth === false) { const b = tr.style.scrollBehavior; tr.style.scrollBehavior = 'auto'; tr.scrollLeft = left; tr.style.scrollBehavior = b; }
      else tr.scrollTo({ left, behavior: 'smooth' });
    });
  }
  function pick(d, fromInput) {
    if (!d) return;
    const inRange = host.querySelector('[data-ds="' + d + '"]');
    value = d;
    if (!inRange) render();
    else {
      host.querySelectorAll('[data-ds]').forEach((x) => x.setAttribute('aria-selected', String(x.dataset.ds === d)));
      const inp = host.querySelector('#' + id); if (inp && !fromInput) inp.value = d;
      center(true);
    }
    if (opts.onChange) opts.onChange(value);
  }
  const onClick = (e) => {
    const b = e.target.closest('[data-ds]');
    if (b && host.contains(b)) pick(b.dataset.ds);
    const cal = e.target.closest('.ds-cal input');
    if (cal && cal.showPicker) { try { cal.showPicker(); } catch (x) { /* iOS abre el selector nativo solo */ } }
  };
  const onChange = (e) => { if (e.target.id === id && e.target.value) pick(e.target.value, true); };
  const onKey = (e) => {
    const b = e.target.closest && e.target.closest('[data-ds]');
    if (!b || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    e.preventDefault();
    const d = addDays(value, e.key === 'ArrowRight' ? 1 : -1);
    pick(d);
    const n = host.querySelector('[data-ds="' + d + '"]'); if (n) n.focus();
  };
  host.addEventListener('click', onClick);
  host.addEventListener('change', onChange);
  host.addEventListener('keydown', onKey);
  render();
  return {
    get: () => value,
    set(d) { if (d && d !== value) { value = d; render(); } },
    refresh() { render(); },
    destroy() { host.removeEventListener('click', onClick); host.removeEventListener('change', onChange); host.removeEventListener('keydown', onKey); }
  };
}

// ═══════════════════════════════════════════════════════════════════════
// Horarios libres (GET /api/slots) + "Otra hora".
// ═══════════════════════════════════════════════════════════════════════
export function slotChips(host, opts) {
  opts = Object.assign({ allowCustom: true }, opts || {});
  ensureStyles();
  const id = uid('sc');
  let p = { date: opts.date, services: opts.services || [], staffId: opts.staffId || '' };
  let value = opts.value != null ? opts.value : null;
  let custom = false, showPast = false;
  let res = null, loading = false, err = null, seq = 0;
  const original = opts.original || null;
  fit(host);

  const freeSet = () => new Set(((res && res.slots) || []).map((s) => s.start_min));
  const isFree = (m) => freeSet().has(m);
  const isOriginal = (m) => !!original && original.date === p.date && original.staff_id === p.staffId && original.start_min === m;
  const emit = () => { if (opts.onChange) opts.onChange(get()); };
  function get() { return value == null ? null : { start_min: value, custom, free: isFree(value) || isOriginal(value) }; }

  function note() {
    if (value == null || !custom) return '';
    if (isOriginal(value)) return '<span class="sc-note faint">' + icon('info') + 'Es el horario actual de la cita.</span>';
    if (loading || !res) return '';
    if (isFree(value)) return '<span class="sc-note ok-t">' + icon('check-circle') + 'Horario libre.</span>';
    return '<span class="sc-note warn-t">' + icon('alert') + 'Este horario no aparece como libre. Al guardar te pediremos confirmar.</span>';
  }
  function chipsHtml(list) {
    const g = [['Mañana', 'sun', (m) => m < 720], ['Tarde', 'clock', (m) => m >= 720 && m < 1140], ['Noche', 'moon', (m) => m >= 1140]];
    return g.map(([label, ic, fn]) => {
      const xs = list.filter((s) => fn(s.start_min));
      if (!xs.length) return '';
      return '<div><div class="sc-h">' + icon(ic) + label + ' <span class="faint" style="font-weight:500">· ' + xs.length + '</span></div><div class="sc-chips">' +
        xs.map((s) => '<button type="button" class="sc-chip" data-sc="' + s.start_min + '" aria-pressed="' + String(!custom && value === s.start_min) + '">' + time(s.start_min) + '</button>').join('') + '</div></div>';
    }).join('');
  }
  function render() {
    let body = '';
    if (!p.services || !p.services.length) body = '<div class="sc-msg">' + icon('scissors') + '<div>' + (value != null ? 'Elegiste las <b>' + time(value) + '</b>. Elige al menos un servicio para confirmar que esa hora está libre.' : 'Elige al menos un servicio para ver los horarios libres.') + '</div></div>';
    else if (!p.staffId) body = '<div class="sc-msg">' + icon('user') + '<div>Elige un barbero para ver sus horarios libres.</div></div>';
    else if (loading && !res) body = '<div class="sc-chips" aria-busy="true" aria-label="Cargando horarios">' + '<div class="skel sc-skel"></div>'.repeat(8) + '</div>';
    else if (err) body = '<div class="sc-msg">' + icon('alert') + '<div class="grow">' + esc(err) + '</div><button type="button" class="btn btn-secondary btn-sm" data-sc-retry>' + icon('refresh', 'ic-sm') + 'Reintentar</button></div>';
    else if (res) {
      const t = todayKey();
      const all = res.slots || [];
      const cut = p.date === t && !showPast ? nowMin() - 10 : -1;
      const list = all.filter((s) => s.start_min >= cut);
      const hidden = all.length - list.length;
      if (res.closed) body = '<div class="sc-msg">' + icon('calendar') + '<div>' + esc(res.message || 'Ese día no trabaja este barbero.') + (opts.allowCustom ? ' Puedes elegir «Otra hora» si de todas formas lo vas a atender.' : '') + '</div></div>';
      else if (!list.length) body = '<div class="sc-msg">' + icon('clock') + '<div>' + (all.length ? 'Ya pasaron todos los horarios libres de hoy.' : 'Ya no hay horarios libres este día.') + (opts.allowCustom ? ' Prueba otro día o elige «Otra hora».' : '') + '</div></div>';
      else body = chipsHtml(list);
      if (hidden > 0) body += '<button type="button" class="link-btn sc-past" data-sc-past>' + icon('clock', 'ic-sm') + 'Ver ' + plural(hidden, 'horario') + ' que ya pasaron</button>';
      if (res.duration_min) body += '<p class="faint" style="font-size:12.5px">Duración: ' + esc(duration(res.duration_min)) + '</p>';
    }
    const cust = opts.allowCustom && p.services && p.services.length && p.staffId ? '<div class="sc-custom">' +
      '<button type="button" class="chip sc-other" data-sc-other aria-pressed="' + String(custom) + '">' + icon('edit', 'ic-sm') + 'Otra hora</button>' +
      '<input class="input" type="time" step="300" id="' + id + 't" aria-label="Hora de la cita" ' + (custom ? '' : 'hidden') + ' value="' + (custom && value != null ? time(value) : '') + '"/>' +
      note() + '</div>' : '';
    host.innerHTML = '<div class="sc">' + body + cust + '</div>';
  }
  async function load(next) {
    if (next) p = Object.assign({}, p, next);
    const my = ++seq;
    err = null;
    if (!p.services || !p.services.length || !p.staffId || !p.date) { res = null; loading = false; render(); return; }
    loading = true; res = null; render();
    try {
      const r = await api.get('/slots', { date: p.date, services: p.services.join(','), staff_id: p.staffId, exclude: opts.exclude || undefined });
      if (my !== seq) return;
      res = r;
    } catch (e) { if (my !== seq) return; err = e.message || 'No se pudieron cargar los horarios.'; }
    loading = false;
    // Hora libre → se marca su chip. Un chip que dejó de estar libre (cambió el día o el barbero) se quita;
    // una hora escrita a mano ("Otra hora") se conserva.
    if (value != null) { if (isFree(value)) custom = false; else if (!custom) value = null; }
    render();
    emit();
  }
  const onClick = (e) => {
    const b = e.target.closest('[data-sc],[data-sc-other],[data-sc-retry],[data-sc-past]');
    if (!b || !host.contains(b)) return;
    if (b.hasAttribute('data-sc-retry')) return load();
    if (b.hasAttribute('data-sc-past')) { showPast = true; render(); return; }
    if (b.hasAttribute('data-sc-other')) {
      custom = !custom;
      if (!custom && value != null && !isFree(value)) value = null;
      render();
      if (custom) { const i = $('#' + id + 't', host); if (i) { i.focus(); if (i.showPicker) { try { i.showPicker(); } catch (x) { /* */ } } } }
      emit();
      return;
    }
    const m = +b.dataset.sc;
    value = m; custom = false;
    host.querySelectorAll('[data-sc]').forEach((x) => x.setAttribute('aria-pressed', String(+x.dataset.sc === m)));
    const oth = host.querySelector('[data-sc-other]'); if (oth) oth.setAttribute('aria-pressed', 'false');
    const inp = host.querySelector('#' + id + 't'); if (inp) inp.hidden = true;
    const n = host.querySelector('.sc-note'); if (n) n.remove();
    emit();
  };
  const onInput = (e) => {
    if (e.target.id !== id + 't') return;
    const v = e.target.value;
    const mm = /^(\d{1,2}):(\d{2})/.exec(v || '');
    value = mm ? (+mm[1]) * 60 + (+mm[2]) : null;
    const wrap = host.querySelector('.sc-custom');
    const old = wrap && wrap.querySelector('.sc-note'); if (old) old.remove();
    if (wrap) wrap.insertAdjacentHTML('beforeend', note());
    emit();
  };
  host.addEventListener('click', onClick);
  host.addEventListener('input', onInput);
  host.addEventListener('change', onInput);
  if (value != null) custom = true; // se ajusta al cargar: si es libre se marca su chip
  load();
  return {
    get, isFree, load,
    set(m) { value = m; custom = m != null && !isFree(m); render(); emit(); },
    destroy() { host.removeEventListener('click', onClick); host.removeEventListener('input', onInput); host.removeEventListener('change', onInput); }
  };
}
