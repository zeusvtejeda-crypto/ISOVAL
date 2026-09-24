// CRM de clientes (#/clientes): KPIs, búsqueda con debounce, etiquetas, orden, lista responsive con
// "Cargar más", alta/edición en hoja y acciones rápidas por fila (ficha, cita, WhatsApp, llamar, editar, borrar).
// El barbero ve "Mis clientes": lo que devuelve la API para su rol (clientes que ha atendido o tiene agendados).
//
// Exporta (lo usa también la ficha del cliente):
//   openClientForm(client|null, { tags }) → Promise<ClientWithStats|null>   alta o edición (POST/PATCH /api/clients)
//   sinceText(dateKey, today)              → 'hace 3 semanas'
//   clientActions(client, { onChanged })   → acciones compartidas: newAppointment, whatsapp, remove
import { html, raw, $, on, formData } from '../lib/html.js';
import { icon } from '../lib/icons.js';
import { api } from '../lib/api.js';
import { bus, can, canAny, role, today } from '../lib/state.js';
import { setQuery } from '../lib/router.js';
import { toast, modal, confirmDialog, menu, busy, skeletonRows, emptyState, errorState, avatar, animateNumber, showFieldErrors, clearFieldErrors, saveFile } from '../lib/ui.js';
import { MONTHS_SHORT, money, number, relDay, diffDays, phone as fmtPhone, plural, startOfMonth, firstName } from '../lib/fmt.js';

const PAGE = 30;
const SORTS = [['recent', 'Visita más reciente'], ['name', 'Nombre (A–Z)'], ['visits', 'Más visitas'], ['spent', 'Más gastado']];
const SUGGESTED_TAGS = ['VIP', 'Frecuente', 'Barba', 'Niño', 'Nuevo'];
const FREQUENT = 3; // visitas para considerarlo cliente frecuente
const fold = (s) => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// ── Estilos de la vista (una sola vez) ────────────────────────────────────
const CSS = `
.cl-kpis{margin-bottom:16px}
.cl-kpis .kpi{text-align:left;width:100%;font:inherit;color:inherit}
.cl-kpis button.kpi{cursor:pointer}
.cl-kpis button.kpi[aria-pressed="true"]{border-color:var(--brand);box-shadow:0 0 0 3px var(--brand-soft)}
.cl-kpis .kpi .value{font-size:30px}
@media (max-width:719px){.cl-kpis{gap:10px}.cl-kpis .kpi{padding:12px 14px}.cl-kpis .kpi .value{font-size:28px}.cl-kpis .kpi .foot{font-size:11.5px;line-height:1.3}}
@media (min-width:720px){.cl-kpis{grid-template-columns:repeat(4,minmax(0,1fr))}}
@media (min-width:768px){.cl-kpis .kpi .value{font-size:34px}}
.cl-card{overflow:hidden}
.cl-tools{display:flex;gap:8px;padding:14px 14px 10px;flex-wrap:wrap;align-items:center}
.cl-tools .search{flex:1 1 240px;min-width:0;position:relative}
.cl-tools .search .input{padding-right:40px}
.cl-tools .search .input::-webkit-search-cancel-button,.cl-tools .search .input::-webkit-search-decoration{-webkit-appearance:none;appearance:none;display:none}
.cl-tools .search [data-clear]{position:absolute;right:4px;top:50%;transform:translateY(-50%)}
.cl-tools .select{width:auto;flex:0 0 auto;min-width:170px}
@media (max-width:519px){.cl-tools .select{flex:1 1 100%}}
.cl-tags{padding:0 14px 12px;flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;mask-image:linear-gradient(90deg,#000 92%,transparent);-webkit-mask-image:linear-gradient(90deg,#000 92%,transparent)}
.cl-tags::-webkit-scrollbar{display:none}
.cl-tags .chip{flex:none;min-height:36px}
.cl-tags .chip .n{font-size:11.5px;opacity:.7}
.cl-head{display:none}
.cl-row{position:relative;display:grid;grid-template-columns:40px minmax(0,1fr) auto 40px;gap:4px 12px;align-items:center;padding:12px 8px 12px 14px;border-top:1px solid var(--border);transition:background .12s}
.cl-row:hover{background:var(--surface-2)}
.cl-row .avatar{--s:40px}
.cl-main{min-width:0;display:grid;gap:3px}
.cl-name{font-weight:600;font-size:15px;text-decoration:none;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cl-name::after{content:"";position:absolute;inset:0}
.cl-name:focus-visible{outline:none}
.cl-name:focus-visible::after{outline:2.5px solid var(--brand);outline-offset:-3px;border-radius:10px}
.cl-sub{font-size:12.5px;color:var(--text-2);display:flex;gap:6px;align-items:center;flex-wrap:wrap;min-width:0}
.cl-sub .sep{color:var(--text-3)}
.cl-sub{flex-wrap:nowrap;white-space:nowrap;overflow:hidden}
.cl-sub .d-only{display:none}
.cl-tagline{display:flex;gap:4px;flex-wrap:wrap}
.cl-tagline .tag{height:20px;font-size:11px}
.cl-trail{display:grid;justify-items:end;gap:3px;text-align:right}
.cl-trail .spent{font-weight:700;font-size:14.5px;font-variant-numeric:tabular-nums}
.cl-more{position:relative;z-index:1}
.cl-cell{display:none}
.cl-next{display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:600;color:var(--info);white-space:nowrap}
.cl-next .ic{width:13px;height:13px}
.cl-row.gone{animation:clOut .32s var(--ease) forwards}
@keyframes clOut{to{opacity:0;transform:translateX(24px)}}
@media (min-width:720px){
  .cl-head,.cl-row{grid-template-columns:40px minmax(0,1fr) 72px 124px 104px 128px 40px;gap:4px 14px}
  .cl-head{display:grid;align-items:center;padding:10px 8px 10px 14px;border-top:1px solid var(--border);background:var(--surface-2);font-size:11.5px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--text-3)}
  .cl-head .r,.cl-cell.r{text-align:right}
  .cl-cell{display:block;font-size:13.5px;color:var(--text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .cl-cell.num{font-variant-numeric:tabular-nums;color:var(--text)}
  .cl-cell.strong{font-weight:600;color:var(--text)}
  .cl-trail,.cl-sub .m-only{display:none}
  .cl-sub .d-only{display:inline}
  .cl-main{display:flex;flex-wrap:wrap;align-items:center;column-gap:8px;row-gap:3px}
  .cl-name{flex:1 1 100%}
  .cl-sub{flex:none}
}
.cl-foot{display:flex;flex-direction:column;align-items:center;gap:8px;padding:16px;border-top:1px solid var(--border)}
.cl-foot .faint{font-size:12.5px}
.cl-list.loading{opacity:.55;transition:opacity .15s;pointer-events:none}
/* formulario de cliente */
#cfForm .field{align-content:start}
.tag-box{display:flex;flex-wrap:wrap;gap:6px;align-items:center;min-height:44px;padding:6px 8px;background:var(--surface);border:1px solid var(--border-strong);border-radius:var(--r-sm);transition:border-color .15s,box-shadow .15s;cursor:text}
.tag-box:focus-within{border-color:var(--brand);box-shadow:0 0 0 3.5px var(--brand-soft)}
.field.invalid .tag-box{border-color:var(--err);box-shadow:0 0 0 3px var(--err-soft)}
.tag-box input{flex:1;min-width:120px;border:0;outline:0;background:transparent;font-size:16px;min-height:30px;padding:0 4px}
@media (min-width:768px){.tag-box input{font-size:15px}}
.tag-pill{display:inline-flex;align-items:center;gap:2px;height:30px;padding:0 4px 0 10px;border-radius:999px;background:var(--brand-soft);color:var(--brand-strong);font-size:13px;font-weight:600;animation:pop .25s var(--ease-out)}
.tag-pill button{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;color:inherit}
.tag-pill button:hover{background:rgba(0,0,0,.06)}
.tag-pill .ic{width:13px;height:13px;stroke-width:2.4}
.tag-sugg{margin-top:8px}
.tag-sugg .chip{min-height:34px}
.tag-sugg .chip .ic{width:13px;height:13px}
.cf-switch{padding:10px 12px;border:1px solid var(--border);border-radius:var(--r);background:var(--surface-2);align-items:flex-start;font-size:14px!important}
.cf-switch .track{margin-top:1px}
.cf-switch small{display:block;color:var(--text-3);font-size:12.5px;margin-top:1px;font-weight:400}
`;
function injectCss() {
  if (!document.getElementById('st-clients')) document.head.insertAdjacentHTML('beforeend', '<style id="st-clients">' + CSS + '</style>');
}

// ── Utilidades compartidas ───────────────────────────────────────────────
export function sinceText(k, t) {
  if (!k) return 'Sin visitas';
  const d = diffDays(k, t || today());
  if (d <= 0) return 'hoy';
  if (d === 1) return 'ayer';
  if (d < 7) return 'hace ' + d + ' días';
  if (d < 30) { const w = Math.round(d / 7); return 'hace ' + w + (w === 1 ? ' semana' : ' semanas'); }
  if (d < 365) { const m = Math.max(1, Math.round(d / 30)); return 'hace ' + m + (m === 1 ? ' mes' : ' meses'); }
  const y = Math.round(d / 365);
  return 'hace ' + y + (y === 1 ? ' año' : ' años');
}
const canNewAppt = () => canAny(['appointments.write.all', 'appointments.write.own']);

// Acciones que comparten la lista y la ficha.
export const clientActions = {
  newAppointment(c) {
    if (window.TB && window.TB.newAppointment) window.TB.newAppointment({ client: { id: c.id, name: c.name, phone: c.phone || '', email: c.email || '' } });
  },
  async whatsapp(c) {
    if (!c.phone) { toast.error('Este cliente no tiene teléfono. Agrégalo en su ficha para escribirle.'); return null; }
    try {
      const m = await import('../lib/whatsapp.js');
      const r = await m.editAndSendWhatsApp({ client_id: c.id, kind: 'custom', name: c.name, phone: c.phone || '' });
      return r;
    } catch (e) { toast.error(e); return null; }
  },
  async remove(c) {
    const ok = await confirmDialog({
      title: '¿Eliminar a ' + c.name + '?',
      message: 'Ya no aparecerá en tu lista de clientes ni en el buscador. Su historial de citas y pagos se conserva en la agenda, la caja y los reportes.',
      confirmText: 'Eliminar cliente', danger: true
    });
    if (!ok) return false;
    try {
      await api.del('/clients/' + encodeURIComponent(c.id));
      toast.success(firstName(c.name) + ' se eliminó de tus clientes');
      bus.emit('clients:changed', { id: c.id, deleted: true });
      return true;
    } catch (e) { toast.error(e); return false; }
  }
};

// ── Hoja de alta / edición ───────────────────────────────────────────────
export function openClientForm(client, opts) {
  injectCss();
  opts = opts || {};
  const isNew = !client;
  const c = client || {};
  let tags = Array.isArray(c.tags) ? c.tags.slice() : [];
  const known = [];
  const seen = new Set();
  for (const t of SUGGESTED_TAGS.concat(opts.tags || [])) { const k = fold(t); if (k && !seen.has(k)) { seen.add(k); known.push(t); } }
  const t0 = today();
  const body = html`
    <form id="cfForm" class="form-grid cols-2" novalidate autocomplete="off">
      <div class="field span-2"><label for="cfName">Nombre completo</label>
        <input class="input" id="cfName" name="name" maxlength="80" autocapitalize="words" enterkeyhint="next" placeholder="p. ej. Juan Pérez" value="${c.name || ''}"/>
        <p class="error">Escribe el nombre del cliente.</p></div>
      <div class="field"><label for="cfPhone">Teléfono <span class="opt">(10 dígitos)</span></label>
        <input class="input" id="cfPhone" name="phone" type="tel" inputmode="tel" maxlength="20" placeholder="669 123 4567" value="${c.phone ? fmtPhone(c.phone) : ''}"/>
        <p class="error">Escribe un teléfono de 10 dígitos.</p></div>
      <div class="field"><label for="cfEmail">Correo <span class="opt">(opcional)</span></label>
        <input class="input" id="cfEmail" name="email" type="email" inputmode="email" autocapitalize="none" maxlength="160" placeholder="nombre@correo.com" value="${c.email || ''}"/>
        <p class="error">Escribe un correo válido.</p></div>
      <div class="field"><label for="cfBday">Cumpleaños <span class="opt">(opcional)</span></label>
        <input class="input" id="cfBday" name="birthday" type="date" min="1900-01-01" max="${t0}" value="${c.birthday || ''}"/>
        <p class="error">Revisa la fecha.</p></div>
      <div class="field span-2"><label for="cfTagIn">Etiquetas</label>
        <div class="tag-box" id="cfTagBox"><span id="cfTagPills" class="row wrap" style="gap:6px"></span>
          <input id="cfTagIn" maxlength="20" enterkeyhint="done" placeholder="Escribe y presiona Enter" aria-describedby="cfTagHint"/></div>
        <input type="hidden" name="tags"/>
        <div class="chips tag-sugg" id="cfTagSugg" role="group" aria-label="Etiquetas sugeridas"></div>
        <p class="hint" id="cfTagHint">Úsalas para agrupar: VIP, frecuentes, quién viene por barba… Máximo 10.</p>
        <p class="error">Revisa las etiquetas.</p></div>
      <div class="field span-2"><label for="cfNotes">Notas internas <span class="opt">(solo las ve tu equipo)</span></label>
        <textarea class="textarea" id="cfNotes" name="notes" maxlength="1000" placeholder="Cómo le gusta su corte, alergias, preferencias…">${c.notes || ''}</textarea>
        <p class="error">Revisa las notas.</p></div>
      <div class="field span-2">
        <label class="switch cf-switch" for="cfMkt"><input type="checkbox" id="cfMkt" name="marketing_ok" ${c.marketing_ok === false ? '' : 'checked'}/><span class="track"></span>
          <span>Acepta recibir mensajes por WhatsApp<small>Recordatorios de cita, agradecimientos y promociones.</small></span></label>
      </div>
    </form>`;
  const m = modal({
    title: isNew ? 'Nuevo cliente' : 'Editar cliente',
    subtitle: isNew ? 'Solo el nombre es obligatorio. Con su teléfono podrás escribirle por WhatsApp.' : c.name,
    body,
    actions: [
      { label: 'Cancelar', variant: 'secondary', value: null },
      { label: isNew ? 'Guardar cliente' : 'Guardar cambios', variant: 'primary', type: 'submit', form: 'cfForm', icon: 'check' }
    ]
  });
  const form = $('#cfForm', m.body);
  const tagIn = $('#cfTagIn', m.body);
  const paintTags = () => {
    $('#cfTagPills', m.body).innerHTML = String(html`${tags.map((t, i) => html`<span class="tag-pill">${t}<button type="button" data-untag="${i}" aria-label="Quitar etiqueta ${t}">${raw(icon('x'))}</button></span>`)}`);
    const active = new Set(tags.map(fold));
    $('#cfTagSugg', m.body).innerHTML = String(html`${known.map((t) => html`<button type="button" class="chip" data-sugg="${t}" aria-pressed="${String(active.has(fold(t)))}">${raw(icon(active.has(fold(t)) ? 'check' : 'plus'))}${t}</button>`)}`);
    form.elements.tags.value = tags.join(',');
    tagIn.placeholder = tags.length ? 'Agregar otra…' : 'Escribe y presiona Enter';
  };
  const addTag = (raw0) => {
    const t = String(raw0 || '').replace(/,/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 20);
    if (!t) return;
    if (tags.some((x) => fold(x) === fold(t))) return;
    if (tags.length >= 10) { toast.info('Máximo 10 etiquetas por cliente.'); return; }
    tags.push(t);
    if (!known.some((x) => fold(x) === fold(t))) known.push(t);
    paintTags();
  };
  paintTags();
  m.body.addEventListener('click', (e) => {
    const un = e.target.closest('[data-untag]');
    if (un) { tags.splice(+un.dataset.untag, 1); paintTags(); tagIn.focus(); return; }
    const sg = e.target.closest('[data-sugg]');
    if (sg) {
      const t = sg.dataset.sugg;
      const i = tags.findIndex((x) => fold(x) === fold(t));
      if (i > -1) tags.splice(i, 1); else addTag(t);
      paintTags();
      return;
    }
    if (e.target.id === 'cfTagBox' || e.target.id === 'cfTagPills') tagIn.focus();
  });
  tagIn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(tagIn.value); tagIn.value = ''; }
    else if (e.key === 'Backspace' && !tagIn.value && tags.length) { tags.pop(); paintTags(); }
  });
  tagIn.addEventListener('blur', () => { if (tagIn.value.trim()) { addTag(tagIn.value); tagIn.value = ''; } });
  form.addEventListener('input', (e) => { const f = e.target.closest('.field'); if (f) f.classList.remove('invalid'); });

  return new Promise((resolve) => {
    let saved = null;
    m.done.then(() => resolve(saved));
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearFieldErrors(form);
      if (tagIn.value.trim()) { addTag(tagIn.value); tagIn.value = ''; }
      const d = formData(form);
      const payload = {
        name: (d.name || '').trim(), phone: (d.phone || '').trim(), email: (d.email || '').trim(), birthday: d.birthday || '',
        notes: d.notes || '', tags: tags.slice(), marketing_ok: !!d.marketing_ok
      };
      if (payload.name.length < 2) { showFieldErrors(form, { fields: { name: payload.name ? 'El nombre debe tener al menos 2 letras.' : 'Escribe el nombre del cliente.' } }); return; }
      const digits = payload.phone.replace(/\D/g, '');
      if (payload.phone && !(digits.length === 10 || (digits.length === 12 && digits.startsWith('52')) || (digits.length === 13 && digits.startsWith('521')))) {
        showFieldErrors(form, { fields: { phone: 'Escribe un teléfono de 10 dígitos.' } }); return;
      }
      const btn = m.foot.querySelector('[type=submit]');
      try {
        const r = await busy(btn, isNew ? api.post('/clients', payload) : api.patch('/clients/' + encodeURIComponent(c.id), payload));
        saved = r;
        bus.emit('clients:changed', { id: r.id });
        if (isNew) {
          const own = !can('clients.read.all');
          toast.success(firstName(r.name) + ' quedó registrado' + (own ? '. Agéndale una cita para verlo en tus clientes.' : ''), canNewAppt() ? { duration: own ? 8000 : 6000, action: { label: 'Agendar cita', onClick: () => clientActions.newAppointment(r) } } : undefined);
        } else toast.success('Cambios guardados');
        m.close(r);
      } catch (err) {
        showFieldErrors(form, err);
      }
    });
  });
}

// ── Vista ────────────────────────────────────────────────────────────────
export default {
  title: () => (role() === 'barber' ? 'Mis clientes' : 'Clientes'),
  async render(el, { query }) {
    injectCss();
    const barber = role() === 'barber';
    const st = {
      q: query.q || '', tag: query.etiqueta || '', sort: SORTS.some((s) => s[0] === query.orden) ? query.orden : 'recent',
      items: [], total: 0, tags: [], allTags: [], req: 0, kpi: null
    };
    const t0 = today();
    el.innerHTML = String(html`
      <div class="page-head">
        <div><h2>${barber ? 'Mis clientes' : 'Clientes'}</h2>
          <p>${barber ? 'Las personas que has atendido o tienes agendadas.' : 'Tu cartera de clientes: búscalos, etiquétalos y agenda en un toque.'}</p></div>
        <div class="actions">
          ${can('reports.export') ? html`<button type="button" class="btn btn-secondary" id="clExport">${raw(icon('download'))}Exportar</button>` : ''}
          ${can('clients.write') ? html`<button type="button" class="btn btn-primary" id="clNew">${raw(icon('user-plus'))}Nuevo cliente</button>` : ''}
        </div>
      </div>
      <div class="kpis cl-kpis stagger" id="clKpis">${raw(kpiSkeleton())}</div>
      <section class="card cl-card" aria-label="Lista de clientes">
        <div class="cl-tools">
          <div class="input-group search">${raw(icon('search'))}
            <input class="input" id="clQ" type="search" enterkeyhint="search" autocomplete="off" placeholder="Buscar por nombre, teléfono o correo" aria-label="Buscar clientes" value="${st.q}"/>
            <button type="button" class="btn btn-ghost btn-icon btn-sm" data-clear aria-label="Limpiar búsqueda" ${st.q ? '' : 'hidden'}>${raw(icon('x', 'ic-sm'))}</button>
          </div>
          <select class="select" id="clSort" aria-label="Ordenar clientes">
            ${SORTS.map(([k, l]) => html`<option value="${k}" ${k === st.sort ? 'selected' : ''}>${l}</option>`)}
          </select>
        </div>
        <div class="chips cl-tags" id="clTags" role="group" aria-label="Filtrar por etiqueta"></div>
        <div class="cl-head" aria-hidden="true"><span></span><span>Cliente</span><span class="r">Visitas</span><span>Última visita</span><span class="r">Gastado</span><span>Próxima cita</span><span></span></div>
        <div class="cl-list" id="clList" role="list" aria-live="polite" aria-busy="true">${skeletonRows(8)}</div>
        <div id="clFoot"></div>
      </section>`);

    const listEl = $('#clList', el);
    const footEl = $('#clFoot', el);
    const qIn = $('#clQ', el);

    // ── KPIs ──
    async function loadKpis() {
      try {
        const all = await api.get('/clients', { limit: 200, sort: 'visits' });
        const vip = (all.tags || []).find((t) => fold(t) === 'vip');
        const vipCount = vip ? (await api.get('/clients', { tag: vip, limit: 1 })).total : 0;
        const month = startOfMonth(t0);
        const exact = all.total <= all.items.length;
        const items = all.items;
        st.allTags = all.tags || [];
        st.kpi = {
          total: all.total,
          fresh: items.filter((c) => String(c.created_at || '').slice(0, 10) >= month).length,
          frequent: items.filter((c) => (c.stats && c.stats.visits) >= FREQUENT).length,
          upcoming: items.filter((c) => c.stats && c.stats.next_visit).length,
          vip: vipCount, vipTag: vip || 'VIP', exact
        };
        paintKpis();
        paintTags();
      } catch (e) {
        $('#clKpis', el).innerHTML = '';
      }
    }
    function kpiSkeleton() { return '<div class="card kpi"><div class="skel" style="height:14px;width:60%"></div><div class="skel" style="height:30px;width:40%;margin-top:6px"></div></div>'.repeat(4); }
    function paintKpis() {
      const k = st.kpi;
      if (!k) return;
      const approx = !k.exact;
      const month = startOfMonth(t0);
      const vipOn = fold(st.tag) === fold(k.vipTag);
      const freqOn = st.sort === 'visits' && !st.tag;
      $('#clKpis', el).innerHTML = String(html`
        <div class="card kpi"><span class="label">${raw(icon('users'))}${barber ? 'Mis clientes' : 'Clientes'}</span><span class="value" data-n="${k.total}">0</span><span class="foot">${k.upcoming ? plural(k.upcoming, 'con cita próxima', 'con cita próxima') : 'En tu cartera'}</span></div>
        <div class="card kpi"><span class="label">${raw(icon('sparkles'))}Nuevos este mes</span><span class="value" data-n="${k.fresh}">0</span><span class="foot">Altas desde el 1 de ${MONTHS_SHORT[Number(month.slice(5, 7)) - 1]}${approx ? ' (aprox.)' : ''}</span></div>
        <button type="button" class="card kpi interactive" data-kpi="frequent" aria-pressed="${String(freqOn)}"><span class="label">${raw(icon('repeat'))}Frecuentes</span><span class="value" data-n="${k.frequent}">0</span><span class="foot">${FREQUENT} visitas o más · ver</span></button>
        <button type="button" class="card kpi interactive" data-kpi="vip" aria-pressed="${String(vipOn)}"><span class="label">${raw(icon('crown'))}VIP</span><span class="value" data-n="${k.vip}">0</span><span class="foot">${k.vip ? 'Con etiqueta ' + k.vipTag + ' · ver' : 'Etiqueta a tus mejores clientes'}</span></button>`);
      $('#clKpis', el).querySelectorAll('[data-n]').forEach((v) => animateNumber(v, Number(v.dataset.n), number));
    }

    // ── Etiquetas ──
    function paintTags() {
      const tags = st.allTags.length ? st.allTags : st.tags;
      const box = $('#clTags', el);
      if (!tags.length) { box.hidden = true; return; }
      box.hidden = false;
      const cur = fold(st.tag);
      box.innerHTML = String(html`<button type="button" class="chip" data-tag="" aria-pressed="${String(!cur)}">Todos</button>${tags.map((t) => html`<button type="button" class="chip" data-tag="${t}" aria-pressed="${String(fold(t) === cur)}">${raw(icon('tag', 'ic-sm'))}${t}</button>`)}`);
    }

    // ── Lista ──
    function rowHtml(c) {
      const s = c.stats || {};
      const next = s.next_visit ? html`<span class="cl-next">${raw(icon('calendar', 'ic-sm'))}${relDay(s.next_visit, t0)}</span>` : '';
      const tags = (c.tags || []).slice(0, 3);
      const more = (c.tags || []).length - tags.length;
      return html`
        <div class="cl-row" role="listitem" data-id="${c.id}">
          ${avatar(c.name)}
          <div class="cl-main">
            <a class="cl-name" href="#/clientes/${encodeURIComponent(c.id)}">${c.name}</a>
            <div class="cl-sub">
              ${c.phone ? html`<span class="num d-only">${fmtPhone(c.phone)}</span>` : html`<span class="faint d-only">Sin teléfono</span>`}
              <span class="m-only">${s.visits ? plural(s.visits, 'visita') : 'Sin visitas'}${s.last_visit ? ' · ' + sinceText(s.last_visit, t0) : ''}</span>
            </div>
            ${tags.length ? html`<div class="cl-tagline">${tags.map((t) => html`<span class="tag">${t}</span>`)}${more > 0 ? html`<span class="tag" style="background:var(--muted-soft);color:var(--text-2)">+${more}</span>` : ''}</div>` : ''}
          </div>
          <div class="cl-trail"><span class="spent">${money(s.total_spent)}</span>${next}</div>
          <span class="cl-cell r num strong">${number(s.visits || 0)}</span>
          <span class="cl-cell">${s.last_visit ? sinceText(s.last_visit, t0) : html`<span class="faint">Sin visitas</span>`}</span>
          <span class="cl-cell r num">${money(s.total_spent)}</span>
          <span class="cl-cell">${next || html`<span class="faint">—</span>`}</span>
          <button type="button" class="btn btn-ghost btn-icon cl-more" data-menu="${c.id}" aria-label="Acciones para ${c.name}" aria-haspopup="menu">${raw(icon('more-v'))}</button>
        </div>`;
    }
    function paintList(append) {
      listEl.setAttribute('aria-busy', 'false');
      listEl.classList.remove('loading');
      // Cartera vacía (sin filtros): solo el estado vacío, sin KPIs ni buscador.
      const bare = !st.items.length && !st.q && !st.tag;
      ['.cl-tools', '.cl-head', '#clKpis', '#clExport'].forEach((sel) => { const x = $(sel, el); if (x) x.hidden = bare; });
      if (bare) $('#clTags', el).hidden = true; else paintTags();
      if (!st.items.length) {
        const filtered = st.q || st.tag;
        listEl.innerHTML = String(filtered
          ? emptyState({ icon: 'search', title: st.q ? 'Sin resultados para “' + st.q + '”' : 'Nadie con la etiqueta “' + st.tag + '”', text: 'Revisa cómo lo escribiste o busca por teléfono. También puedes quitar los filtros.', action: { label: 'Quitar filtros', id: 'clReset', icon: 'x' }, compact: true })
          : barber
            ? emptyState({ icon: 'users', title: 'Aún no tienes clientes', text: 'Aquí aparecerán las personas que atiendas o que tengan cita contigo.', action: canNewAppt() ? { label: 'Agendar una cita', id: 'clEmptyAppt', icon: 'calendar-plus' } : null })
            : emptyState({ icon: 'users', title: 'Tu cartera de clientes empieza aquí', text: 'Cada reserva en línea crea al cliente automáticamente. También puedes agregarlos a mano con su teléfono para escribirles por WhatsApp.', action: can('clients.write') ? { label: 'Agregar mi primer cliente', id: 'clEmptyNew', icon: 'user-plus' } : null }));
        footEl.innerHTML = '';
        return;
      }
      const rows = st.items.map(rowHtml);
      if (append) {
        const start = listEl.children.length;
        listEl.insertAdjacentHTML('beforeend', String(html`${rows.slice(start)}`));
        Array.from(listEl.children).slice(start).forEach((r, i) => { r.style.animation = 'fadeUp .35s var(--ease-out) both'; r.style.animationDelay = Math.min(i, 10) * 25 + 'ms'; });
      } else {
        listEl.innerHTML = String(html`${rows}`);
        listEl.classList.remove('stagger'); void listEl.offsetWidth; listEl.classList.add('stagger');
      }
      const left = st.total - st.items.length;
      footEl.innerHTML = String(html`<div class="cl-foot">
        ${left > 0 ? html`<button type="button" class="btn btn-secondary" id="clMoreBtn">${raw(icon('chevron-down'))}Cargar ${Math.min(PAGE, left)} más</button>` : ''}
        <span class="faint">Mostrando ${number(st.items.length)} de ${plural(st.total, 'cliente')}</span></div>`);
    }
    async function load(append) {
      const id = ++st.req;
      const q = { q: st.q, tag: st.tag, sort: st.sort, limit: PAGE, offset: append ? st.items.length : 0 };
      if (!append && st.items.length) listEl.classList.add('loading');
      try {
        const r = await api.get('/clients', q);
        if (id !== st.req) return;
        st.total = r.total;
        st.tags = r.tags || [];
        st.items = append ? st.items.concat(r.items) : r.items;
        if (!st.allTags.length) paintTags();
        paintList(append);
      } catch (e) {
        if (id !== st.req) return;
        listEl.classList.remove('loading');
        if (append) { toast.error(e); return; }
        listEl.innerHTML = String(errorState(e, 'clRetry'));
        footEl.innerHTML = '';
      }
    }
    const syncUrl = () => setQuery({ q: st.q, etiqueta: st.tag, orden: st.sort === 'recent' ? '' : st.sort });

    // ── Eventos ──
    let deb = null;
    const offs = [];
    qIn.addEventListener('input', () => {
      clearTimeout(deb);
      $('[data-clear]', el).hidden = !qIn.value;
      deb = setTimeout(() => { st.q = qIn.value.trim(); syncUrl(); load(false); }, 280);
    });
    qIn.addEventListener('keydown', (e) => { if (e.key === 'Escape' && qIn.value) { e.preventDefault(); qIn.value = ''; qIn.dispatchEvent(new Event('input')); } });
    offs.push(on(el, 'click', '[data-clear]', () => { qIn.value = ''; $('[data-clear]', el).hidden = true; st.q = ''; syncUrl(); load(false); qIn.focus(); }));
    $('#clSort', el).addEventListener('change', (e) => { st.sort = e.target.value; syncUrl(); paintKpis(); load(false); });
    offs.push(on(el, 'click', '[data-tag]', (e, b) => {
      st.tag = b.dataset.tag;
      $$chips();
      syncUrl(); paintKpis(); load(false);
    }));
    function $$chips() { el.querySelectorAll('#clTags [data-tag]').forEach((x) => x.setAttribute('aria-pressed', String(fold(x.dataset.tag) === fold(st.tag)))); }
    offs.push(on(el, 'click', '[data-kpi]', (e, b) => {
      if (b.dataset.kpi === 'vip') {
        if (!st.kpi || !st.kpi.vip) { toast.info('Agrega la etiqueta “VIP” a tus mejores clientes desde su ficha.'); return; }
        st.tag = fold(st.tag) === fold(st.kpi.vipTag) ? '' : st.kpi.vipTag;
      } else {
        const on2 = st.sort === 'visits' && !st.tag;
        st.sort = on2 ? 'recent' : 'visits'; st.tag = '';
        $('#clSort', el).value = st.sort;
      }
      $$chips(); syncUrl(); paintKpis(); load(false);
    }));
    offs.push(on(el, 'click', '#clReset', () => { st.q = ''; st.tag = ''; qIn.value = ''; $('[data-clear]', el).hidden = true; $$chips(); syncUrl(); paintKpis(); load(false); }));
    offs.push(on(el, 'click', '#clRetry', () => { listEl.innerHTML = String(skeletonRows(6)); load(false); if (!st.kpi) loadKpis(); }));
    offs.push(on(el, 'click', '#clMoreBtn', (e, b) => busy(b, load(true))));
    offs.push(on(el, 'click', '#clNew,#clEmptyNew', () => openClientForm(null, { tags: st.allTags })));
    offs.push(on(el, 'click', '#clEmptyAppt', () => window.TB && window.TB.newAppointment({})));
    offs.push(on(el, 'click', '#clExport', async (e, b) => {
      try {
        const r = await busy(b, api.raw('/reports/export', { type: 'clients' }));
        saveFile(r.filename || 'clientes.csv', r.body, r.contentType || 'text/csv;charset=utf-8');
        toast.success('Descargamos tu lista de clientes (CSV)');
      } catch (err) { toast.error(err); }
    }));
    offs.push(on(el, 'click', '[data-menu]', (e, b) => {
      const c = st.items.find((x) => x.id === b.dataset.menu);
      if (!c) return;
      menu(b, [
        { label: 'Ver ficha', icon: 'user', href: '#/clientes/' + encodeURIComponent(c.id) },
        canNewAppt() && { label: 'Nueva cita', icon: 'calendar-plus', onClick: () => clientActions.newAppointment(c) },
        can('messages.send') && c.phone && { label: 'Enviar WhatsApp', icon: 'whatsapp', onClick: () => clientActions.whatsapp(c) },
        c.phone && { label: 'Llamar', icon: 'phone', href: 'tel:' + c.phone },
        can('clients.write') && { label: 'Editar', icon: 'edit', onClick: () => openClientForm(c, { tags: st.allTags }) },
        can('clients.delete') && { sep: true },
        can('clients.delete') && { label: 'Eliminar', icon: 'trash', danger: true, onClick: async () => {
          const row = b.closest('.cl-row');
          if (await clientActions.remove(c)) {
            if (row) row.classList.add('gone');
          }
        } }
      ]);
    }));

    const reload = () => { load(false); loadKpis(); };
    offs.push(bus.on('clients:changed', () => setTimeout(reload, 250)));
    offs.push(bus.on('appointments:changed', reload));
    offs.push(bus.on('payments:changed', reload));

    loadKpis();
    await load(false);
    return () => { clearTimeout(deb); offs.forEach((f) => f()); };
  }
};
