// Servicios (#/servicios, solo dueño): catálogo agrupado por categoría con precio, duración, "popular" y
// activo (interruptor rápido). Alta/edición en hoja con vista previa de cómo lo ve el cliente, qué barberos
// lo ofrecen, reordenar (modo "Ordenar" con flechas; POST /api/services/reorder) y eliminar con confirmación.
import { html, raw, $, on, formData } from '../lib/html.js';
import { icon } from '../lib/icons.js';
import { api } from '../lib/api.js';
import { bus, getStaff } from '../lib/state.js';
import { toast, modal, confirmDialog, menu, busy, emptyState, errorState, showFieldErrors, clearFieldErrors } from '../lib/ui.js';
import { money, duration, plural, firstName } from '../lib/fmt.js';

const NO_CAT = 'Otros servicios';
// Asa para arrastrar (SVG local para no tocar la librería de íconos compartida).
const GRIP = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="9" cy="6" r="1.4" fill="currentColor" stroke="none"/><circle cx="15" cy="6" r="1.4" fill="currentColor" stroke="none"/><circle cx="9" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="9" cy="18" r="1.4" fill="currentColor" stroke="none"/><circle cx="15" cy="18" r="1.4" fill="currentColor" stroke="none"/></svg>';
const QUICK_DUR = [15, 20, 30, 45, 60, 90];
const STARTER = [
  { name: 'Corte clásico', category: 'Cortes', duration_min: 40, price: 200, popular: true, description: 'Tijera y máquina, lavado y peinado.' },
  { name: 'Fade / degradado', category: 'Cortes', duration_min: 45, price: 230, popular: false, description: 'Degradado a detalle con acabado a navaja.' },
  { name: 'Arreglo de barba', category: 'Barba', duration_min: 30, price: 150, popular: false, description: 'Perfilado, toalla caliente y aceite.' },
  { name: 'Corte + barba', category: 'Paquetes', duration_min: 70, price: 320, popular: true, description: 'El combo completo.' }
];

const CSS = `
.sv-group{margin-top:18px}
.sv-group:first-child{margin-top:0}
.sv-ghead{display:flex;align-items:center;gap:8px;margin:0 2px 8px;min-height:36px}
.sv-ghead h3{font-size:12px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--text-3)}
.sv-ghead .n{font-size:12px;color:var(--text-3)}
.sv-ghead .mv{margin-left:auto;display:flex;gap:4px}
.sv-card{overflow:hidden}
.sv-row{display:flex;align-items:center;gap:10px;padding:10px 8px 10px 14px;border-top:1px solid var(--border);min-height:72px;transition:background .12s,opacity .2s}
.sv-row:first-child{border-top:0}
.sv-row.off .sv-open{opacity:.55}
.sv-open{flex:1;min-width:0;display:flex;align-items:center;gap:12px;text-align:left;padding:4px 0;border-radius:10px}
.sv-open:hover .sv-name{color:var(--brand-strong)}
.sv-dur{width:52px;height:52px;flex:none;border-radius:14px;background:var(--surface-3);display:grid;place-items:center;align-content:center;line-height:1}
.sv-dur b{font-family:var(--disp);font-size:20px;font-weight:800}
.sv-dur small{font-size:10px;font-weight:600;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em;margin-top:1px}
.sv-main{min-width:0;flex:1;display:grid;gap:2px}
.sv-name{font-weight:600;font-size:15px;display:flex;align-items:center;gap:6px;min-width:0;transition:color .15s}
.sv-name span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sv-name .badge{flex:none}
.sv-meta{font-size:12.5px;color:var(--text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sv-desc{font-size:12.5px;color:var(--text-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sv-price{font-family:var(--disp);font-weight:800;font-size:21px;font-variant-numeric:tabular-nums;flex:none;padding:0 4px}
.sv-row .switch{flex:none;min-height:44px;padding:0 4px}
.sv-mv{display:none;gap:4px;flex:none}
.sv-reorder .sv-mv{display:flex}
.sv-reorder .sv-row .switch,.sv-reorder .sv-row [data-menu]{display:none}
.sv-reorder .sv-ghead .mv{display:flex}
.sv-ghead .mv{display:none}
.sv-reorder .sv-row{background:var(--surface-2)}
.sv-row.moved{animation:svMoved .6s var(--ease)}
.sv-grip{width:36px;height:44px;display:grid;place-items:center;color:var(--text-3);cursor:grab;touch-action:none;border-radius:10px;flex:none}
.sv-grip:hover{color:var(--text);background:var(--muted-soft)}
.sv-grip:active{cursor:grabbing}
.sv-row.dragging{position:relative;z-index:3;background:var(--surface)!important;box-shadow:var(--shadow-3);border-radius:12px;transition:none}
.sv-card.drag-on .sv-row:not(.dragging){transition:transform .15s var(--ease)}
@keyframes svMoved{0%{background:var(--brand-soft)}100%{background:var(--surface-2)}}
.sv-mprice{display:none;font-weight:700;color:var(--text)}
.sv-star{display:none;color:var(--brand-strong)}
.sv-star .ic{width:15px;height:15px;fill:currentColor}
@media (max-width:599px){
  .sv-desc,.sv-price,.sv-name .badge.brand{display:none}
  .sv-mprice,.sv-star{display:inline-flex}
  .sv-row{gap:6px;padding-left:12px}
  .sv-open{gap:10px}
  .sv-dur{width:46px;height:46px;border-radius:13px}
  .sv-dur b{font-size:18px}
  .sv-name{align-items:flex-start}
  .sv-name>span:first-child{white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;line-height:1.25}
  .sv-mv .btn{width:38px}
}
.sv-banner{margin-bottom:14px}
.sv-starter{display:grid;gap:8px;margin-top:10px;text-align:left;width:100%;max-width:420px}
.sv-starter li{list-style:none;display:flex;justify-content:space-between;gap:10px;font-size:13.5px;padding:8px 12px;border-radius:10px;background:var(--surface-2);border:1px solid var(--border)}
/* formulario */
.svf{display:grid;gap:18px}
#svForm .field{align-content:start}
@media (min-width:860px){.svf{grid-template-columns:minmax(0,1fr) 280px;align-items:start}.svf-prev{position:sticky;top:0}}
.svf-dur{display:flex;align-items:center;gap:8px}
.svf-dur .val{flex:1;text-align:center;font-family:var(--disp);font-size:24px;font-weight:800;min-height:44px;display:grid;place-items:center;border:1px solid var(--border-strong);border-radius:var(--r-sm);background:var(--surface);font-variant-numeric:tabular-nums}
.svf-dur .btn{width:48px;flex:none}
.svf-quick{margin-top:8px}
.svf-quick .chip{min-height:34px}
.svf-price{position:relative}
.svf-price span{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--text-3);font-weight:600;pointer-events:none}
.svf-price .input{padding-left:28px;font-variant-numeric:tabular-nums}
.svf-switches{display:grid;gap:8px}
.svf-sw{display:flex;justify-content:space-between;gap:12px;padding:10px 12px;border:1px solid var(--border);border-radius:var(--r);background:var(--surface-2);font-size:14px!important;font-weight:400!important}
.svf-sw .lbl{display:grid;font-weight:600}
.svf-sw small{font-size:12.5px;color:var(--text-3);font-weight:400}
.svf-staff .chip{min-height:38px;padding:0 12px 0 6px}
.svf-staff .chip .dot{width:22px;height:22px;display:grid;place-items:center;color:#fff;font-size:10px;font-weight:700}
.svf-staff .chip[data-all]{padding:0 14px}
.svf-prev .eyebrow{margin-bottom:8px;display:flex;align-items:center;gap:6px}
.svf-prev .eyebrow .ic{width:14px;height:14px}
.svf-phone{border-radius:24px;padding:14px;background:var(--bg);border:1px solid var(--border-strong);box-shadow:var(--shadow-2)}
.svf-pcard{background:var(--surface);border:1.5px solid var(--brand);border-radius:16px;padding:14px;display:grid;gap:6px;box-shadow:0 0 0 4px var(--brand-soft)}
.svf-pcard .top{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}
.svf-pcard b{font-size:15px;line-height:1.25;word-break:break-word}
.svf-pcard .pr{font-family:var(--disp);font-size:20px;font-weight:800;white-space:nowrap}
.svf-pcard p{font-size:12.5px;color:var(--text-2);white-space:pre-line;word-break:break-word}
.svf-pcard .row{font-size:12.5px;color:var(--text-2);gap:8px}
.svf-pcard .row .ic{width:14px;height:14px}
.svf-pcard .pick{margin-top:4px;display:flex;align-items:center;justify-content:center;gap:6px;height:34px;border-radius:10px;background:var(--brand);color:var(--brand-ink);font-weight:700;font-size:13px}
.svf-pghost{margin-top:8px;height:58px;border-radius:14px;background:var(--surface);border:1px solid var(--border);opacity:.6}
.svf-off{font-size:12.5px;color:var(--warn);display:flex;gap:6px;align-items:center;margin-top:8px}
.svf-off .ic{width:15px;height:15px}
`;
function injectCss() { if (!document.getElementById('st-services')) document.head.insertAdjacentHTML('beforeend', '<style id="st-services">' + CSS + '</style>'); }

function staffLabel(sv, staff) {
  const ids = sv.staff_ids || [];
  if (!ids.length) return 'Todos los barberos';
  const names = ids.map((id) => staff.find((s) => s.id === id)).filter(Boolean).map((s) => firstName(s.name));
  if (!names.length) return 'Todos los barberos';
  return names.length <= 2 ? 'Solo ' + names.join(' y ') : plural(names.length, 'barbero');
}

// ── Hoja de alta / edición ───────────────────────────────────────────────
function openServiceForm(sv, { categories, staff, dup }) {
  const isNew = !sv || dup;
  const s = Object.assign({ duration_min: 30, price: '', active: true, popular: false, staff_ids: [] }, sv || {});
  if (dup) s.name = s.name + ' (copia)';
  let dur = Number(s.duration_min) || 30;
  let picked = new Set(s.staff_ids || []);
  const bookable = staff.filter((x) => x.active !== false);
  const body = html`
    <form id="svForm" class="svf" novalidate autocomplete="off">
      <div class="form-grid cols-2">
        <div class="field span-2"><label for="svName">Nombre del servicio</label>
          <input class="input" id="svName" name="name" maxlength="80" placeholder="p. ej. Corte clásico" value="${s.name || ''}"/>
          <p class="error">Escribe el nombre del servicio.</p></div>
        <div class="field"><label for="svCat">Categoría</label>
          <input class="input" id="svCat" name="category" list="svCats" maxlength="40" placeholder="p. ej. Cortes" value="${s.category || ''}"/>
          <datalist id="svCats">${categories.map((c) => html`<option value="${c}"></option>`)}</datalist>
          <p class="error">Revisa la categoría.</p></div>
        <div class="field"><label for="svPrice">Precio</label>
          <div class="svf-price"><span>$</span><input class="input" id="svPrice" name="price" type="number" inputmode="decimal" min="0" max="100000" step="1" placeholder="0" value="${s.price === '' ? '' : Number(s.price)}"/></div>
          <p class="error">Indica el precio (puede ser 0).</p></div>
        <div class="field span-2"><span class="label" id="svDurL">Duración</span>
          <div class="svf-dur" role="group" aria-labelledby="svDurL">
            <button type="button" class="btn btn-secondary btn-icon" data-dur="-5" aria-label="Quitar 5 minutos">${raw(icon('minus'))}</button>
            <output class="val" id="svDurV" aria-live="polite">${duration(dur)}</output>
            <button type="button" class="btn btn-secondary btn-icon" data-dur="5" aria-label="Agregar 5 minutos">${raw(icon('plus'))}</button>
          </div>
          <input type="hidden" name="duration_min" value="${dur}"/>
          <div class="chips svf-quick" id="svQuick">${QUICK_DUR.map((d) => html`<button type="button" class="chip" data-quick="${d}" aria-pressed="${String(d === dur)}">${duration(d)}</button>`)}</div>
          <p class="error">La duración debe ser múltiplo de 5 minutos.</p></div>
        <div class="field span-2"><label for="svDesc">Descripción <span class="opt">(opcional)</span></label>
          <textarea class="textarea" id="svDesc" name="description" maxlength="300" style="min-height:72px" placeholder="Qué incluye: lavado, toalla caliente, peinado…">${s.description || ''}</textarea>
          <p class="hint"><span id="svDescN">${(s.description || '').length}</span>/300</p>
          <p class="error">Máximo 300 caracteres.</p></div>
        ${bookable.length > 1 ? html`<div class="field span-2 svf-staff"><span class="label" id="svStL">¿Quién lo ofrece?</span>
          <div class="chips" role="group" aria-labelledby="svStL" id="svStaff"></div>
          <p class="hint">Si no eliges a nadie, lo ofrecen todos los barberos.</p>
          <input type="hidden" name="staff_ids"/><p class="error">Revisa los barberos.</p></div>` : ''}
        <div class="svf-switches span-2">
          <label class="switch svf-sw" for="svPop"><span class="lbl"><span class="row" style="gap:6px">${raw(icon('star', 'ic-sm'))}Popular</span><small>Se destaca con una etiqueta en tu página de reservas.</small></span>
            <input type="checkbox" id="svPop" name="popular" ${s.popular ? 'checked' : ''}/><span class="track"></span></label>
          <label class="switch svf-sw" for="svAct"><span class="lbl">Disponible para reservar<small>Si lo apagas, se oculta en línea pero conserva su historial.</small></span>
            <input type="checkbox" id="svAct" name="active" ${s.active !== false ? 'checked' : ''}/><span class="track"></span></label>
        </div>
      </div>
      <div class="svf-prev" aria-label="Vista previa">
        <div class="eyebrow">${raw(icon('eye'))}Así lo verán tus clientes</div>
        <div class="svf-phone"><div class="svf-pcard" id="svPrev"></div></div>
        <div id="svPrevOff"></div>
      </div>
    </form>`;
  const m = modal({
    title: dup ? 'Duplicar servicio' : isNew ? 'Nuevo servicio' : 'Editar servicio',
    size: 'xl',
    body,
    actions: [
      { label: 'Cancelar', variant: 'secondary', value: null },
      { label: isNew ? 'Crear servicio' : 'Guardar cambios', variant: 'primary', type: 'submit', form: 'svForm', icon: 'check' }
    ]
  });
  const form = $('#svForm', m.body);
  const paintStaff = () => {
    const box = $('#svStaff', m.body);
    if (!box) return;
    box.innerHTML = String(html`<button type="button" class="chip" data-all aria-pressed="${String(!picked.size)}">Todos</button>${bookable.map((x) => html`<button type="button" class="chip" data-st="${x.id}" aria-pressed="${String(picked.has(x.id))}"><span class="dot" style="background:${x.color || 'var(--text-3)'}">${x.name.trim().charAt(0).toUpperCase()}</span>${firstName(x.name)}</button>`)}`);
  };
  const paintPrev = () => {
    const d = formData(form);
    const price = Number(d.price);
    $('#svPrev', m.body).innerHTML = String(html`
      <div class="top"><b>${(d.name || '').trim() || 'Nombre del servicio'}</b><span class="pr">${d.price === null || d.price === '' || !Number.isFinite(price) ? '$—' : money(price)}</span></div>
      ${(d.description || '').trim() ? html`<p>${d.description.trim()}</p>` : ''}
      <div class="row">${raw(icon('clock'))}${duration(dur)}${d.popular ? html`<span class="badge brand plain">${raw(icon('star', 'ic-sm'))}Popular</span>` : ''}</div>
      <div class="pick">${raw(icon('check', 'ic-sm'))}Elegido</div>`);
    $('#svPrevOff', m.body).innerHTML = d.active ? '' : String(html`<p class="svf-off">${raw(icon('ban'))}Oculto: no aparecerá en la reserva en línea.</p>`);
    $('#svDescN', m.body).textContent = (d.description || '').length;
  };
  const setDur = (v) => {
    dur = Math.max(5, Math.min(480, Math.round(v / 5) * 5));
    form.elements.duration_min.value = dur;
    $('#svDurV', m.body).textContent = duration(dur);
    m.body.querySelectorAll('[data-quick]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.quick) === dur)));
    paintPrev();
  };
  paintStaff(); paintPrev();
  m.body.addEventListener('input', (e) => { const f = e.target.closest('.field'); if (f) f.classList.remove('invalid'); paintPrev(); });
  m.body.addEventListener('change', paintPrev);
  m.body.addEventListener('click', (e) => {
    const d = e.target.closest('[data-dur]'); if (d) setDur(dur + Number(d.dataset.dur));
    const q = e.target.closest('[data-quick]'); if (q) setDur(Number(q.dataset.quick));
    if (e.target.closest('[data-all]')) { picked = new Set(); paintStaff(); }
    const stb = e.target.closest('[data-st]');
    if (stb) { const id = stb.dataset.st; if (picked.has(id)) picked.delete(id); else picked.add(id); if (picked.size === bookable.length) picked = new Set(); paintStaff(); }
  });
  // Mantener presionado +/- repite (rápido para servicios largos).
  let rep = null;
  const stopRep = () => { clearInterval(rep); clearTimeout(rep); rep = null; };
  m.body.addEventListener('pointerdown', (e) => {
    const d = e.target.closest('[data-dur]'); if (!d) return;
    stopRep();
    rep = setTimeout(() => { rep = setInterval(() => setDur(dur + Number(d.dataset.dur)), 90); }, 450);
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((t) => m.body.addEventListener(t, stopRep));

  return new Promise((resolve) => {
    let saved = null;
    m.done.then(() => { stopRep(); resolve(saved); });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearFieldErrors(form);
      const d = formData(form);
      const payload = {
        name: (d.name || '').trim(), category: (d.category || '').trim(), duration_min: dur,
        price: d.price === null || d.price === '' ? null : Number(d.price), description: d.description || '',
        popular: !!d.popular, active: !!d.active, staff_ids: Array.from(picked)
      };
      const errs = {};
      if (payload.name.length < 2) errs.name = payload.name ? 'El nombre debe tener al menos 2 letras.' : 'Escribe el nombre del servicio.';
      if (payload.price === null || !Number.isFinite(payload.price) || payload.price < 0) errs.price = 'Indica el precio (puede ser 0).';
      if (Object.keys(errs).length) { showFieldErrors(form, { fields: errs }); return; }
      const btn = m.foot.querySelector('[type=submit]');
      try {
        saved = await busy(btn, isNew ? api.post('/services', payload) : api.patch('/services/' + encodeURIComponent(s.id), payload));
        bus.emit('services:changed');
        toast.success(isNew ? '“' + saved.name + '” ya está en tu catálogo' : 'Cambios de “' + saved.name + '” guardados');
        m.close(saved);
      } catch (err) { showFieldErrors(form, err); }
    });
  });
}

// ── Vista ────────────────────────────────────────────────────────────────
export default {
  title: 'Servicios',
  async render(el) {
    injectCss();
    let list = [];
    let staff = [];
    let reorder = false;
    let saveTimer = null;
    el.innerHTML = String(html`
      <div class="page-head">
        <div><h2>Servicios</h2><p id="svSub">Lo que ofreces, cuánto dura y cuánto cuesta.</p></div>
        <div class="actions">
          <button type="button" class="btn btn-secondary" id="svOrder" aria-pressed="false" hidden>${raw(icon('arrow-down'))}Ordenar</button>
          <button type="button" class="btn btn-primary" id="svNew">${raw(icon('plus'))}Nuevo servicio</button>
        </div>
      </div>
      <div id="svRoot"><div class="card">${raw('<div class="skel-row"><div class="skel" style="width:52px;height:52px;border-radius:14px"></div><div style="flex:1"><div class="skel skel-line" style="width:45%"></div><div class="skel skel-line" style="width:30%;height:10px"></div></div></div>'.repeat(5))}</div></div>`);
    const root = $('#svRoot', el);

    const categories = () => [...new Set(list.map((s) => s.category).filter(Boolean))];
    function groups() {
      const out = [];
      const by = new Map();
      for (const s of list) {
        const k = s.category || NO_CAT;
        if (!by.has(k)) { by.set(k, []); out.push(k); }
        by.get(k).push(s);
      }
      return out.map((k) => ({ name: k, items: by.get(k) }));
    }
    function rowHtml(s, i, n) {
      return html`<div class="sv-row ${s.active ? '' : 'off'}" data-id="${s.id}">
        <div class="sv-mv">
          <span class="sv-grip" data-grip title="Arrastra para mover" aria-hidden="true">${raw(GRIP)}</span>
          <button type="button" class="btn btn-ghost btn-icon" data-mv="-1" data-id="${s.id}" aria-label="Subir ${s.name}" ${i === 0 ? raw('disabled') : ''}>${raw(icon('arrow-up'))}</button>
          <button type="button" class="btn btn-ghost btn-icon" data-mv="1" data-id="${s.id}" aria-label="Bajar ${s.name}" ${i === n - 1 ? raw('disabled') : ''}>${raw(icon('arrow-down'))}</button>
        </div>
        <button type="button" class="sv-open" data-edit="${s.id}" aria-label="Editar ${s.name}">
          <span class="sv-dur" aria-hidden="true"><b>${s.duration_min}</b><small>min</small></span>
          <span class="sv-main">
            <span class="sv-name"><span>${s.name}</span>${s.popular ? html`<span class="sv-star" title="Popular">${raw(icon('star'))}<span class="sr">Popular</span></span><span class="badge brand plain">${raw(icon('star', 'ic-sm'))}Popular</span>` : ''}${s.active ? '' : html`<span class="badge plain">Oculto</span>`}</span>
            <span class="sv-meta"><span class="sv-mprice">${money(s.price)}&nbsp;·&nbsp;</span>${duration(s.duration_min)} · ${staffLabel(s, staff)}</span>
            ${s.description ? html`<span class="sv-desc">${s.description}</span>` : ''}
          </span>
        </button>
        <span class="sv-price">${money(s.price)}</span>
        <label class="switch" title="${s.active ? 'Disponible para reservar' : 'Oculto en la reserva en línea'}"><input type="checkbox" data-active="${s.id}" ${s.active ? 'checked' : ''} aria-label="${s.name}: disponible para reservar"/><span class="track"></span></label>
        <button type="button" class="btn btn-ghost btn-icon" data-menu="${s.id}" aria-label="Más acciones para ${s.name}" aria-haspopup="menu">${raw(icon('more-v'))}</button>
      </div>`;
    }
    function paint(movedId) {
      const active = list.filter((s) => s.active).length;
      $('#svSub', el).textContent = list.length ? plural(active, 'servicio disponible', 'servicios disponibles') + ' para reservar' + (list.length > active ? ' · ' + (list.length - active) + ' oculto' + (list.length - active === 1 ? '' : 's') : '') : 'Lo que ofreces, cuánto dura y cuánto cuesta.';
      $('#svOrder', el).hidden = list.length < 2;
      if (!list.length) {
        root.innerHTML = String(html`<div class="card">${emptyState({ icon: 'scissors', title: 'Crea tu catálogo de servicios', text: 'Tus clientes eligen de aquí al reservar. Empieza con los más comunes y ajusta precios cuando quieras.', action: { label: 'Nuevo servicio', id: 'svEmptyNew', icon: 'plus' } })}
          <div style="display:grid;justify-items:center;padding:0 20px 28px;margin-top:-8px"><button type="button" class="btn btn-secondary" id="svStarter">${raw(icon('sparkles'))}Agregar 4 servicios sugeridos</button>
          <ul class="sv-starter">${STARTER.map((x) => html`<li><span>${x.name} · <span class="faint">${duration(x.duration_min)}</span></span><b>${money(x.price)}</b></li>`)}</ul></div></div>`);
        return;
      }
      const gs = groups();
      root.innerHTML = String(html`
        ${reorder ? html`<div class="banner brand sv-banner">${raw(icon('info'))}<div class="grow">Arrastra o usa las flechas para cambiar el orden en que tus clientes ven los servicios y las categorías. Se guarda solo.</div></div>` : ''}
        <div class="${reorder ? 'sv-reorder' : ''}">
        ${gs.map((g, gi) => html`<section class="sv-group" data-cat="${g.name}">
          <div class="sv-ghead"><h3>${g.name}</h3><span class="n">· ${g.items.length}</span>
            <span class="mv">
              <button type="button" class="btn btn-ghost btn-icon btn-sm" data-gmv="-1" data-cat="${g.name}" aria-label="Subir categoría ${g.name}" ${gi === 0 ? raw('disabled') : ''}>${raw(icon('chevron-up'))}</button>
              <button type="button" class="btn btn-ghost btn-icon btn-sm" data-gmv="1" data-cat="${g.name}" aria-label="Bajar categoría ${g.name}" ${gi === gs.length - 1 ? raw('disabled') : ''}>${raw(icon('chevron-down'))}</button>
            </span></div>
          <div class="card sv-card">${g.items.map((s, i) => rowHtml(s, i, g.items.length))}</div>
        </section>`)}
        </div>`);
      if (movedId) { const r = root.querySelector('.sv-row[data-id="' + movedId + '"]'); if (r) { r.classList.add('moved'); const b = r.querySelector('[data-mv]:not([disabled])'); if (document.activeElement === document.body && b) b.focus({ preventScroll: true }); } }
    }
    async function load() {
      try {
        [list, staff] = await Promise.all([api.get('/services', { all: 1 }), getStaff(false).catch(() => [])]);
        paint();
      } catch (e) { root.innerHTML = String(errorState(e, 'svRetry')); }
    }
    const find = (id) => list.find((s) => s.id === id);
    async function edit(s, dup) {
      const r = await openServiceForm(s || null, { categories: categories(), staff, dup });
      if (r) { await load(); const row = root.querySelector('.sv-row[data-id="' + r.id + '"]'); if (row) { row.classList.add('flash'); row.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } }
    }
    function queueSave() {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(async () => {
        saveTimer = null;
        try { await api.post('/services/reorder', { ids: list.map((s) => s.id) }); bus.emit('services:changed'); toast.success('Orden guardado'); }
        catch (e) { toast.error(e); load(); }
      }, 700);
    }
    function moveItem(id, dir) {
      const g = groups().find((x) => x.items.some((s) => s.id === id));
      const i = g.items.findIndex((s) => s.id === id);
      const j = i + dir;
      if (j < 0 || j >= g.items.length) return;
      const a = list.indexOf(g.items[i]), b = list.indexOf(g.items[j]);
      [list[a], list[b]] = [list[b], list[a]];
      paint(id);
      const btn = root.querySelector('.sv-row[data-id="' + id + '"] [data-mv="' + dir + '"]:not([disabled])') || root.querySelector('.sv-row[data-id="' + id + '"] [data-mv]:not([disabled])');
      if (btn) btn.focus({ preventScroll: false });
      queueSave();
    }
    function moveGroup(cat, dir) {
      const gs = groups();
      const i = gs.findIndex((g) => g.name === cat);
      const j = i + dir;
      if (j < 0 || j >= gs.length) return;
      [gs[i], gs[j]] = [gs[j], gs[i]];
      list = gs.flatMap((g) => g.items);
      paint();
      const btn = root.querySelector('[data-gmv="' + dir + '"][data-cat="' + CSS_ESC(cat) + '"]:not([disabled])');
      if (btn) btn.focus();
      queueSave();
    }
    async function remove(s) {
      const ok = await confirmDialog({
        title: '¿Eliminar “' + s.name + '”?',
        message: 'Ya no podrás elegirlo en citas nuevas. Las citas y cobros anteriores conservan el servicio con su precio. Si solo quieres dejar de ofrecerlo un tiempo, mejor ocúltalo.',
        confirmText: 'Eliminar servicio', danger: true
      });
      if (!ok) return;
      try {
        await api.del('/services/' + encodeURIComponent(s.id));
        list = list.filter((x) => x.id !== s.id);
        bus.emit('services:changed');
        toast.success('“' + s.name + '” se eliminó del catálogo');
        paint();
      } catch (e) { toast.error(e); }
    }

    const offs = [];
    offs.push(on(el, 'click', '#svNew,#svEmptyNew', () => edit(null)));
    offs.push(on(el, 'click', '#svRetry', () => load()));
    offs.push(on(el, 'click', '#svOrder', (e, b) => {
      reorder = !reorder;
      b.setAttribute('aria-pressed', String(reorder));
      b.className = 'btn ' + (reorder ? 'btn-dark' : 'btn-secondary');
      b.innerHTML = reorder ? icon('check') + 'Listo' : icon('arrow-down') + 'Ordenar';
      paint();
    }));
    offs.push(on(el, 'click', '#svStarter', async (e, b) => {
      try {
        await busy(b, async () => { for (const s of STARTER) await api.post('/services', s); });
        bus.emit('services:changed');
        toast.success('Listo: agregamos 4 servicios. Ajusta precios y duraciones a tu gusto.');
        load();
      } catch (err) { toast.error(err); load(); }
    }));
    offs.push(on(el, 'click', '[data-edit]', (e, b) => { if (!reorder) edit(find(b.dataset.edit)); }));
    offs.push(on(el, 'click', '[data-mv]', (e, b) => moveItem(b.dataset.id, Number(b.dataset.mv))));
    offs.push(on(el, 'click', '[data-gmv]', (e, b) => moveGroup(b.dataset.cat, Number(b.dataset.gmv))));
    // Arrastrar para reordenar (dentro de la categoría). Funciona con mouse y con el dedo.
    let drag = null;
    const onDown = (e) => {
      const g = e.target.closest('[data-grip]');
      if (!g || !reorder) return;
      const row = g.closest('.sv-row');
      e.preventDefault();
      try { g.setPointerCapture(e.pointerId); } catch (x) { /* */ }
      drag = { row, card: row.parentElement, y0: e.clientY, moved: false };
      row.classList.add('dragging');
      drag.card.classList.add('drag-on');
    };
    const onMove = (e) => {
      if (!drag) return;
      const { row, card } = drag;
      let dy = e.clientY - drag.y0;
      row.style.transform = 'translateY(' + dy + 'px)';
      const rows = Array.from(card.children);
      const i = rows.indexOf(row);
      const next = rows[i + 1], prev = rows[i - 1];
      if (next && dy > next.offsetHeight / 2) { card.insertBefore(next, row); drag.y0 += next.offsetHeight; drag.moved = true; }
      else if (prev && dy < -prev.offsetHeight / 2) { card.insertBefore(row, prev); drag.y0 -= prev.offsetHeight; drag.moved = true; }
      dy = e.clientY - drag.y0;
      row.style.transform = 'translateY(' + dy + 'px)';
    };
    const onUp = () => {
      if (!drag) return;
      const { row, card, moved } = drag;
      drag = null;
      row.style.transform = '';
      row.classList.remove('dragging');
      card.classList.remove('drag-on');
      if (!moved) return;
      const ids = Array.from(card.children).map((r) => r.dataset.id);
      const cat = card.closest('.sv-group').dataset.cat;
      list = groups().flatMap((g) => (g.name === cat ? ids.map(find) : g.items));
      paint(row.dataset.id);
      queueSave();
    };
    root.addEventListener('pointerdown', onDown);
    root.addEventListener('pointermove', onMove);
    root.addEventListener('pointerup', onUp);
    root.addEventListener('pointercancel', onUp);
    offs.push(() => { root.removeEventListener('pointerdown', onDown); root.removeEventListener('pointermove', onMove); root.removeEventListener('pointerup', onUp); root.removeEventListener('pointercancel', onUp); });
    offs.push(on(el, 'change', '[data-active]', async (e, inp) => {
      const s = find(inp.dataset.active);
      const val = inp.checked;
      const row = inp.closest('.sv-row');
      row.classList.toggle('off', !val);
      inp.disabled = true;
      try {
        const r = await api.patch('/services/' + encodeURIComponent(s.id), { active: val });
        Object.assign(s, r);
        bus.emit('services:changed');
        toast.success(val ? '“' + s.name + '” vuelve a estar disponible para reservar' : '“' + s.name + '” quedó oculto en la reserva en línea');
        paint();
      } catch (err) { inp.checked = !val; row.classList.toggle('off', val); toast.error(err); }
      finally { inp.disabled = false; }
    }));
    offs.push(on(el, 'click', '[data-menu]', (e, b) => {
      const s = find(b.dataset.menu);
      menu(b, [
        { label: 'Editar', icon: 'edit', onClick: () => edit(s) },
        { label: s.popular ? 'Quitar de populares' : 'Marcar como popular', icon: 'star', onClick: async () => {
          try { const r = await api.patch('/services/' + encodeURIComponent(s.id), { popular: !s.popular }); Object.assign(s, r); bus.emit('services:changed'); toast.success(r.popular ? '“' + s.name + '” se destaca como popular' : '“' + s.name + '” ya no se destaca'); paint(); }
          catch (err) { toast.error(err); }
        } },
        { label: 'Duplicar', icon: 'copy', onClick: () => edit(s, true) },
        { sep: true },
        { label: 'Eliminar', icon: 'trash', danger: true, onClick: () => remove(s) }
      ]);
    }));

    await load();
    return () => {
      offs.forEach((f) => f());
      if (saveTimer) { clearTimeout(saveTimer); api.post('/services/reorder', { ids: list.map((s) => s.id) }).then(() => bus.emit('services:changed')).catch((e) => toast.error(e)); }
    };
  }
};

function CSS_ESC(s) { return String(s).replace(/["\\]/g, '\\$&'); }
