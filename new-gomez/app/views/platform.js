// Plataforma (#/plataforma, superadmin): KPIs globales (GET /api/admin/stats), barberías con búsqueda, estado,
// plan, dueño y métricas de 30 días (GET /api/admin/shops?q), acciones (Entrar → window.TB.enterShop, Suspender /
// Reactivar, Cambiar plan, Editar dominio), alta de barbería con su dueño (POST /api/admin/shops) y pestaña de
// usuarios (GET /api/admin/users?q, activar/desactivar con PATCH /api/admin/users/:id).
import { html, raw, esc, $, on, formData } from '../lib/html.js';
import { icon } from '../lib/icons.js';
import { api, SITE_BASE } from '../lib/api.js';
import { state } from '../lib/state.js';
import { setQuery } from '../lib/router.js';
import { toast, modal, confirmDialog, menu, busy, emptyState, errorState, avatar, showFieldErrors, clearFieldErrors, copyText, animateNumber } from '../lib/ui.js';
import { money, compactMoney, number, plural, ago, dateNum, phone as fmtPhone, ROLE } from '../lib/fmt.js';

const PLAN = { demo: 'Demo', basic: 'Básico', pro: 'Pro' };
const PLAN_TXT = { basic: 'Agenda, reservas en línea, clientes, caja y WhatsApp.', pro: 'Todo lo de Básico, soporte prioritario y dominio propio.', demo: 'Para pruebas y presentaciones. Sin cobro.' };
const PAGE = 50;
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;
const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
const bare = (u) => String(u).replace(/^https?:\/\//, '').replace(/\/$/, '');
const normSlug = (v) => String(v || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ñ/g, 'n').replace(/[\s_.]+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-{2,}/g, '-').slice(0, 40);
function genPassword() {
  const A = 'abcdefghjkmnpqrstuvwxyz', N = '23456789', U = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const r = (s) => s[Math.floor((crypto.getRandomValues ? crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296 : Math.random()) * s.length)];
  return r(U) + r(A) + r(A) + r(A) + r(N) + r(N) + r(A) + r(A) + r(U) + r(N);
}

const CSS = `
.pf-iso{margin-bottom:18px}
.pf-kpis .kpi .value{font-size:30px}
.pf-grid{display:grid;gap:16px;margin-top:16px}
@media (min-width:1180px){.pf-grid{grid-template-columns:minmax(0,1fr) 320px;align-items:start}.pf-top{position:sticky;top:calc(var(--topbar-h) + 12px)}}
.pf-tb{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px}
.pf-tb .search{flex:1 1 240px;min-width:0}
.pf-tb .chips{flex:none}
.pf-count{font-size:12.5px;color:var(--text-3);margin:0 0 8px 2px}
.pf-list{overflow:hidden}
.pf-head,.pf-row{display:grid;grid-template-columns:minmax(0,2.3fr) minmax(0,1.6fr) 92px 92px 110px 124px;gap:14px;align-items:center;padding:12px 16px}
.pf-head{font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--text-3);background:var(--surface-2);border-bottom:1px solid var(--border);padding-top:10px;padding-bottom:10px}
.pf-head .r,.pf-row .r{text-align:right}
.pf-row{border-bottom:1px solid var(--border);transition:background .12s;min-height:72px}
.pf-row:last-child{border-bottom:0}
.pf-row:hover{background:var(--surface-2)}
.pf-row.susp{background:repeating-linear-gradient(135deg,transparent 0 10px,var(--muted-soft) 10px 20px)}
.pf-row.susp .avatar{filter:grayscale(1);opacity:.7}
.pf-shop{display:flex;align-items:center;gap:12px;min-width:0}
.pf-shop .avatar{border-radius:12px}
.pf-name{font-weight:600;font-size:14.5px;display:flex;align-items:center;gap:6px;min-width:0}
.pf-name span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.pf-sub{font-size:12.5px;color:var(--text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pf-sub .mono{font-size:12px}
.pf-badges{display:flex;gap:5px;margin-top:4px;flex-wrap:wrap}
.pf-owner{min-width:0;font-size:13px}
.pf-owner b{display:block;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pf-owner span{display:block;color:var(--text-2);font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pf-m{font-variant-numeric:tabular-nums;font-size:14px;font-weight:600}
.pf-m small{display:block;font-size:11.5px;color:var(--text-3);font-weight:500}
.pf-acts{display:flex;gap:4px;justify-content:flex-end}
.pf-ml{display:none}
@media (max-width:1023px){
  .pf-head{display:none}
  .pf-row{grid-template-columns:repeat(3,minmax(0,1fr));gap:10px 12px;padding:14px 16px}
  .pf-shop{grid-column:1/-1}
  .pf-owner{grid-column:1/-1;display:flex;gap:8px;align-items:center;padding:8px 10px;border-radius:10px;background:var(--surface-2);border:1px solid var(--border)}
  .pf-owner .ic{color:var(--text-3);flex:none}
  .pf-owner>div{min-width:0}
  .pf-m{padding:0 2px}
  .pf-m .r,.pf-row .pf-m.r{text-align:left}
  .pf-ml{display:block;font-size:11px;color:var(--text-3);font-weight:600;text-transform:uppercase;letter-spacing:.05em}
  .pf-row .r{text-align:left}
  .pf-acts{grid-column:1/-1;justify-content:stretch}
  .pf-acts .btn-enter{flex:1}
}
.pf-owner>.ic{display:none}
@media (max-width:1023px){.pf-owner>.ic{display:block}}
.pf-top .list-item{padding:10px 16px;min-height:56px}
.pf-rank{width:26px;height:26px;border-radius:8px;display:grid;place-items:center;font-weight:700;font-size:12.5px;background:var(--surface-3);color:var(--text-2);flex:none}
.pf-rank.g{background:var(--brand);color:var(--brand-ink)}
.pf-u{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:12px;align-items:center;padding:12px 16px;border-bottom:1px solid var(--border)}
.pf-u:last-child{border-bottom:0}
.pf-u .nm{font-weight:600;font-size:14.5px;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.pf-u .em{font-size:12.5px;color:var(--text-2);overflow-wrap:anywhere}
.pf-u .shops{display:flex;gap:5px;flex-wrap:wrap;margin-top:6px}
.pf-u .shops .tag{background:var(--muted-soft);color:var(--text-2);font-weight:500;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pf-u .shops .tag b{color:var(--text);font-weight:600;margin-left:4px}
.pf-u .side{display:grid;justify-items:end;gap:4px;text-align:right}
.pf-u .side small{font-size:11.5px;color:var(--text-3);white-space:nowrap}
.pf-u.off{opacity:.65}
.pf-more{display:flex;justify-content:center;padding:14px}
/* formularios */
.pf-fs{display:grid;gap:14px;padding:4px 0 16px}
.pf-fs+.pf-fs{border-top:1px solid var(--border);padding-top:16px}
.pf-fs>h4{font-size:11.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text-3)}
#pfForm .field{align-content:start}
.pf-slug{display:flex;border:1px solid var(--border-strong);border-radius:var(--r-sm);background:var(--surface);overflow:hidden;transition:border-color .15s,box-shadow .15s}
.pf-slug:focus-within{border-color:var(--brand);box-shadow:0 0 0 3.5px var(--brand-soft)}
.field.invalid .pf-slug{border-color:var(--err);box-shadow:0 0 0 3px var(--err-soft)}
.pf-slug span{flex:none;display:flex;align-items:center;padding:0 8px 0 12px;background:var(--surface-2);border-right:1px solid var(--border);font-family:var(--mono);font-size:13px;color:var(--text-3)}
.pf-slug .input{flex:1;border:0;border-radius:0;box-shadow:none!important;font-family:var(--mono);min-width:0}
.pf-pw{position:relative}
.pf-pw .input{padding-right:92px;font-family:var(--mono)}
.pf-pw .btns{position:absolute;right:4px;top:50%;transform:translateY(-50%);display:flex;gap:2px}
.pf-plans{display:grid;gap:8px}
.pf-plans label{display:flex;gap:12px;align-items:flex-start;padding:14px;border:1.5px solid var(--border-strong);border-radius:var(--r);cursor:pointer;transition:border-color .15s,background .15s}
.pf-plans label.on{border-color:var(--brand);background:var(--brand-softer)}
.pf-plans input{margin-top:3px;accent-color:var(--brand);width:18px;height:18px;flex:none}
.pf-plans b{display:block;font-size:15px}
.pf-plans small{display:block;font-size:12.5px;color:var(--text-2)}
.pf-done{display:grid;gap:10px;padding:14px;border-radius:var(--r);background:var(--surface-2);border:1px solid var(--border);font-size:14px}
.pf-done dt{font-size:12px;color:var(--text-3)}
.pf-done dd{font-weight:600;overflow-wrap:anywhere}
.pf-done .mono{font-weight:500}
`;
function injectCss() { if (!document.getElementById('st-platform')) document.head.insertAdjacentHTML('beforeend', '<style id="st-platform">' + CSS + '</style>'); }

const statusBadgeShop = (s) => (s.status === 'suspended' ? html`<span class="badge err">Suspendida</span>` : html`<span class="badge ok">Activa</span>`);
const planBadge = (p) => html`<span class="badge ${p === 'pro' ? 'brand' : p === 'demo' ? 'info' : ''} plain">${PLAN[p] || p}</span>`;

// ── Alta de barbería ─────────────────────────────────────────────────────
function openCreate(onDone) {
  const pw = genPassword();
  const m = modal({
    title: 'Nueva barbería', subtitle: 'Se crea con su dueño, servicios de ejemplo y horario base. Queda aislada de las demás.', size: 'lg',
    body: html`<form id="pfForm" novalidate autocomplete="off">
      <div class="pf-fs"><h4>Barbería</h4>
        <div class="form-grid cols-2">
          <div class="field span-2"><label for="pfName">Nombre de la barbería</label><input class="input" id="pfName" name="name" maxlength="80" placeholder="p. ej. Barbería Gómez" required/><p class="error">Escribe el nombre de la barbería.</p></div>
          <div class="field span-2"><label for="pfSlug">Enlace de reservas <span class="opt">(opcional)</span></label>
            <div class="pf-slug"><span>?b=</span><input class="input" id="pfSlug" name="slug" maxlength="40" placeholder="se genera con el nombre" autocapitalize="none" spellcheck="false"/></div>
            <p class="hint" id="pfSlugHint">Si lo dejas vacío lo armamos con el nombre.</p><p class="error">Solo minúsculas, números y guiones.</p></div>
          <div class="field"><label for="pfPhone">Teléfono <span class="opt">(opcional)</span></label><input class="input" id="pfPhone" name="phone" type="tel" inputmode="tel" placeholder="10 dígitos"/><p class="error">El teléfono debe tener 10 dígitos.</p></div>
          <div class="field"><label for="pfCity">Ciudad <span class="opt">(opcional)</span></label><input class="input" id="pfCity" name="city" maxlength="80" placeholder="p. ej. Monterrey"/><p class="error">Máximo 80 caracteres.</p></div>
          <div class="field span-2"><label for="pfPlan">Plan</label><select class="select" id="pfPlan" name="plan"><option value="basic" selected>Básico</option><option value="pro">Pro</option><option value="demo">Demo (pruebas)</option></select><p class="error">Elige un plan.</p></div>
        </div></div>
      <div class="pf-fs"><h4>Dueño</h4>
        <div class="form-grid cols-2">
          <div class="field"><label for="pfOwner">Nombre del dueño</label><input class="input" id="pfOwner" name="owner_name" maxlength="120" autocomplete="off" placeholder="Nombre y apellido"/><p class="error">Escribe el nombre del dueño.</p></div>
          <div class="field"><label for="pfEmail">Correo del dueño</label><input class="input" id="pfEmail" name="owner_email" type="email" inputmode="email" autocomplete="off" placeholder="dueno@correo.com"/><p class="error">Escribe un correo válido.</p></div>
          <div class="field span-2"><label for="pfPw">Contraseña inicial</label>
            <div class="pf-pw"><input class="input" id="pfPw" name="owner_password" type="text" value="${pw}" autocomplete="new-password" minlength="8"/>
              <span class="btns"><button type="button" class="btn btn-ghost btn-icon btn-sm" data-pw="gen" aria-label="Generar otra contraseña" title="Generar otra">${raw(icon('refresh', 'ic-sm'))}</button>
              <button type="button" class="btn btn-ghost btn-icon btn-sm" data-pw="copy" aria-label="Copiar contraseña" title="Copiar">${raw(icon('copy', 'ic-sm'))}</button></span></div>
            <p class="hint">Mínimo 8 caracteres. Compártela con el dueño; podrá cambiarla en «Mi perfil». Si el correo ya tiene cuenta, se vincula y conserva su contraseña.</p><p class="error">La contraseña debe tener al menos 8 caracteres.</p></div>
        </div></div>
    </form>`,
    actions: [{ label: 'Cancelar', variant: 'secondary', value: null }, { label: 'Crear barbería', variant: 'primary', type: 'submit', form: 'pfForm', icon: 'check' }]
  });
  const form = $('#pfForm', m.body);
  let slugTouched = false;
  m.body.addEventListener('input', (e) => {
    const f = e.target.closest('.field'); if (f) f.classList.remove('invalid');
    if (e.target.name === 'slug') { slugTouched = !!e.target.value; const n = normSlug(e.target.value); if (n !== e.target.value) e.target.value = n; }
    if (e.target.name === 'name' || e.target.name === 'slug') {
      const s = form.elements.slug.value || normSlug(form.elements.name.value).replace(/^-|-$/g, '');
      $('#pfSlugHint', m.body).innerHTML = s ? String(html`Quedará como <b class="mono">${bare(SITE_BASE)}/?b=${s}</b>${slugTouched ? '' : ' (o parecido si ya existe)'}`) : 'Si lo dejas vacío lo armamos con el nombre.';
    }
  });
  m.body.addEventListener('click', (e) => {
    const b = e.target.closest('[data-pw]'); if (!b) return;
    if (b.dataset.pw === 'gen') { form.elements.owner_password.value = genPassword(); form.elements.owner_password.closest('.field').classList.remove('invalid'); }
    else copyText(form.elements.owner_password.value, 'Contraseña copiada');
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearFieldErrors(form);
    const d = formData(form);
    const body = { name: d.name.trim(), slug: d.slug.trim() || undefined, owner_name: d.owner_name.trim(), owner_email: d.owner_email.trim().toLowerCase(),
      owner_password: d.owner_password, phone: d.phone.replace(/\D/g, '') || undefined, city: d.city.trim() || undefined, plan: d.plan };
    const errs = {};
    if (body.name.length < 2) errs.name = 'Escribe el nombre de la barbería.';
    if (body.slug && (!SLUG_RE.test(body.slug) || body.slug.includes('--'))) errs.slug = 'Solo minúsculas, números y guiones (sin empezar ni terminar con guion).';
    if (!isEmail(body.owner_email)) errs.owner_email = 'Escribe un correo válido, por ejemplo dueno@correo.com.';
    if (body.owner_password && body.owner_password.length < 8) errs.owner_password = 'La contraseña debe tener al menos 8 caracteres.';
    if (body.phone && body.phone.length !== 10) errs.phone = 'El teléfono debe tener 10 dígitos.';
    if (Object.keys(errs).length) { showFieldErrors(form, { fields: errs }); return; }
    const btn = m.foot.querySelector('[type=submit]');
    try {
      const r = await busy(btn, api.post('/admin/shops', body));
      m.close(r);
      toast.success('Barbería «' + r.shop.name + '» creada');
      onDone(r);
      openCreated(r, body);
    } catch (err) { showFieldErrors(form, err); }
  });
}
function openCreated(r, body) {
  const url = SITE_BASE + '?b=' + encodeURIComponent(r.shop.slug);
  const access = 'Tu barbería ya está en TuBarbería 💈\n\nPanel: ' + SITE_BASE + 'app/\nCorreo: ' + r.owner.email + (r.linked_existing ? '\n(Entra con tu contraseña de siempre)' : '\nContraseña: ' + body.owner_password) + '\n\nEnlace de reservas para tus clientes: ' + url;
  const m = modal({
    title: 'Barbería creada', size: 'sm',
    body: html`<div class="confirm-icon" style="background:var(--ok-soft);color:var(--ok)">${raw(icon('check-circle'))}</div>
      <p class="muted" style="font-size:14px;margin-bottom:12px">«${r.shop.name}» ya está lista y aislada. Comparte los datos de acceso con ${r.owner.name || 'el dueño'}.</p>
      <dl class="pf-done">
        <div><dt>Enlace de reservas</dt><dd class="mono">${bare(url)}</dd></div>
        <div><dt>Correo del dueño</dt><dd>${r.owner.email}</dd></div>
        <div><dt>Contraseña</dt><dd class="mono">${r.linked_existing ? 'La de su cuenta existente' : body.owner_password}</dd></div>
      </dl>`,
    actions: [
      { label: 'Copiar accesos', variant: 'secondary', icon: 'copy', close: false, onClick: () => { copyText(access, 'Datos de acceso copiados'); return false; } },
      { label: 'Entrar ahora', variant: 'primary', icon: 'door', onClick: async () => { await window.TB.enterShop(r.shop.id); toast.success('Entraste a ' + r.shop.name); } }
    ]
  });
  return m;
}

// ── Cambiar plan / dominio ──
function openPlan(s, onDone) {
  const m = modal({
    title: 'Cambiar plan', subtitle: s.name, size: 'sm',
    body: html`<div class="pf-plans" role="radiogroup" aria-label="Plan">${['basic', 'pro', 'demo'].map((p) => html`<label class="${s.plan === p ? 'on' : ''}"><input type="radio" name="plan" value="${p}" ${s.plan === p ? 'checked' : ''}/><span><b>${PLAN[p]}</b><small>${PLAN_TXT[p]}</small></span></label>`)}</div>`,
    actions: [{ label: 'Cancelar', variant: 'secondary', value: null }, { label: 'Guardar plan', variant: 'primary', icon: 'check', close: false, onClick: async (api2, btn) => {
      const v = (m.body.querySelector('input[name=plan]:checked') || {}).value;
      if (!v || v === s.plan) { m.close(); return false; }
      const r = await api.patch('/admin/shops/' + encodeURIComponent(s.id), { plan: v });
      m.close(r);
      toast.success(s.name + ' ahora tiene el plan ' + PLAN[v]);
      onDone(r.shop);
      return false;
    } }]
  });
  m.body.addEventListener('change', () => m.body.querySelectorAll('label').forEach((l) => l.classList.toggle('on', l.querySelector('input').checked)));
}
function openDomain(s, onDone) {
  const m = modal({
    title: 'Dominio propio', subtitle: s.name, size: 'sm',
    body: html`<form id="pfDom" novalidate><div class="field"><label for="pfDomIn">Dominio</label>
      <input class="input" id="pfDomIn" name="domain" value="${s.domain || ''}" placeholder="mibarberia.com" autocapitalize="none" spellcheck="false" inputmode="url"/>
      <p class="hint">Sin https:// ni rutas. Apunta el dominio (CNAME) a este sitio en Cloudflare; al abrirlo se mostrará la página de reservas de esta barbería.</p>
      <p class="error">Escribe un dominio válido, por ejemplo mibarberia.com.</p></div></form>`,
    actions: [
      s.domain ? { label: 'Quitar', variant: 'danger-ghost', icon: 'trash', close: false, onClick: async () => { const r = await api.patch('/admin/shops/' + encodeURIComponent(s.id), { domain: null }); m.close(r); toast.success('Dominio quitado de ' + s.name); onDone(r.shop); return false; } } : null,
      { spacer: true },
      { label: 'Cancelar', variant: 'secondary', value: null },
      { label: 'Guardar', variant: 'primary', type: 'submit', form: 'pfDom', icon: 'check' }
    ].filter(Boolean)
  });
  const form = $('#pfDom', m.body);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearFieldErrors(form);
    const v = form.elements.domain.value.trim().toLowerCase().replace(/^[a-z]+:\/\//, '').replace(/[/?#].*$/, '');
    if (v && !/^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(v)) { showFieldErrors(form, { fields: { domain: 'Escribe un dominio válido, por ejemplo mibarberia.com.' } }); return; }
    if ((v || null) === (s.domain || null)) { m.close(); return; }
    try {
      const r = await busy(m.foot.querySelector('[type=submit]'), api.patch('/admin/shops/' + encodeURIComponent(s.id), { domain: v || null }));
      m.close(r);
      toast.success(v ? 'Dominio ' + v + ' asignado a ' + s.name : 'Dominio quitado de ' + s.name);
      onDone(r.shop);
    } catch (err) { showFieldErrors(form, err); }
  });
}

export default {
  title: 'Plataforma',
  async render(el, { query }) {
    injectCss();
    const st = { tab: query.tab === 'usuarios' ? 'users' : 'shops', q: '', status: 'all', shops: [], more: false, uq: '', users: [], stats: null, seq: 0, useq: 0 };
    const meId = state.user && state.user.id;

    el.innerHTML = String(html`
      <div class="page-head">
        <div><h2>Plataforma</h2><p>Todas las barberías de TuBarbería en un solo lugar.</p></div>
        <div class="actions"><button type="button" class="btn btn-primary" data-act="create">${raw(icon('plus'))}Nueva barbería</button></div>
      </div>
      <div class="banner brand pf-iso">${raw(icon('shield'))}<div class="grow"><b>Cada barbería vive aislada.</b> Su equipo y sus clientes solo ven sus propios datos: agenda, clientes, caja y reportes nunca se mezclan. Como superadmin puedes entrar a cualquiera para dar soporte (con permisos de dueño).</div></div>
      <div class="kpis pf-kpis" id="pfKpis">${raw('<div class="card kpi skel" style="height:112px;border:0"></div>'.repeat(4))}</div>
      <div class="pf-grid">
        <div style="min-width:0">
          <div class="tabs" role="tablist" aria-label="Secciones">
            <button type="button" role="tab" data-tab="shops" aria-selected="${String(st.tab === 'shops')}">Barberías</button>
            <button type="button" role="tab" data-tab="users" aria-selected="${String(st.tab === 'users')}">Usuarios</button>
          </div>
          <div id="pfTab"></div>
        </div>
        <aside class="card pf-top" id="pfTop" aria-label="Barberías más activas"><div class="card-body"><div class="skel" style="height:220px"></div></div></aside>
      </div>`);
    const kpisEl = $('#pfKpis', el), tabEl = $('#pfTab', el), topEl = $('#pfTop', el);

    // ── KPIs y top ──
    async function loadStats() {
      try {
        const s = st.stats = await api.get('/admin/stats');
        kpisEl.innerHTML = String(html`
          <div class="card kpi"><span class="label">${raw(icon('store'))}Barberías</span><span class="value num" data-n="${s.shops}">0</span><span class="foot">${s.active_shops} activas${s.suspended_shops ? ' · ' + s.suspended_shops + (s.suspended_shops === 1 ? ' suspendida' : ' suspendidas') : ''}${s.new_shops_30d ? ' · +' + s.new_shops_30d + ' este mes' : ''}</span></div>
          <div class="card kpi"><span class="label">${raw(icon('users'))}Usuarios</span><span class="value num" data-n="${s.users}">0</span><span class="foot">${s.new_users_30d ? '+' + number(s.new_users_30d) + ' en 30 días' : 'Cuentas con acceso'}${s.clients != null ? ' · ' + number(s.clients) + ' clientes' : ''}</span></div>
          <div class="card kpi"><span class="label">${raw(icon('calendar'))}Citas · 30 días</span><span class="value num" data-n="${s.appointments_30d}">0</span><span class="foot">Sin contar canceladas</span></div>
          <div class="card kpi"><span class="label">${raw(icon('wallet'))}Ingresos · 30 días</span><span class="value num" data-m="${s.revenue_30d}">$0</span><span class="foot">Pagos registrados en todas</span></div>`);
        kpisEl.querySelectorAll('[data-n]').forEach((x) => animateNumber(x, +x.dataset.n));
        kpisEl.querySelectorAll('[data-m]').forEach((x) => animateNumber(x, +x.dataset.m, compactMoney));
        const top = s.top_shops || [];
        topEl.innerHTML = String(html`<div class="card-head"><div><h3>Más activas</h3><div class="sub">Últimos 30 días</div></div>${raw(icon('chart', 'faint'))}</div>
          ${top.length ? html`<div class="list" style="margin-top:8px">${top.map((t, i) => html`<div class="list-item"><span class="pf-rank ${i === 0 ? 'g' : ''}">${i + 1}</span>
              <span class="grow" style="min-width:0"><span class="title truncate" style="display:block">${t.name}</span><span class="meta">${plural(t.appointments_30d, 'cita')} · ${money(t.revenue_30d)}</span></span>
              <button type="button" class="btn btn-ghost btn-sm" data-enter="${t.id}" aria-label="${'Entrar a ' + t.name}">${raw(icon('door', 'ic-sm'))}Entrar</button></div>`)}</div>`
            : emptyState({ icon: 'chart', title: 'Sin actividad reciente', text: 'Cuando las barberías registren citas y pagos, aquí verás las más activas.', compact: true })}`);
      } catch (e) {
        kpisEl.innerHTML = '';
        topEl.innerHTML = String(html`<div class="card-body">${errorState(e, 'pfStatsRetry')}</div>`);
      }
    }

    // ── Pestaña Barberías ──
    function shopsFrame() {
      tabEl.innerHTML = String(html`
        <div class="pf-tb"><div class="input-group search">${raw(icon('search'))}<input class="input" type="search" id="pfQ" placeholder="Buscar por nombre, enlace, ciudad o correo del dueño" value="${st.q}" aria-label="Buscar barberías" autocomplete="off"/></div>
          <div class="chips" role="group" aria-label="Filtrar por estado">${[['all', 'Todas'], ['active', 'Activas'], ['suspended', 'Suspendidas']].map(([k, l]) => html`<button type="button" class="chip" data-status="${k}" aria-pressed="${String(st.status === k)}">${l}</button>`)}</div></div>
        <p class="pf-count" id="pfCount" aria-live="polite"></p>
        <div class="card pf-list" id="pfList">${raw('<div class="skel-row"><div class="skel" style="width:40px;height:40px;border-radius:12px"></div><div style="flex:1"><div class="skel skel-line" style="width:40%"></div><div class="skel skel-line" style="width:25%;height:10px"></div></div></div>'.repeat(5))}</div>`);
    }
    function shopRow(s) {
      const brand = /^#[0-9a-f]{6}$/i.test(s.brand_color || '') ? s.brand_color : undefined;
      const susp = s.status === 'suspended';
      return html`<div class="pf-row ${susp ? 'susp' : ''}" data-shop="${s.id}">
        <div class="pf-shop">${avatar(s.name, { src: s.logo_url || '', color: brand })}
          <div style="min-width:0"><div class="pf-name"><span>${s.name}</span></div>
            <div class="pf-sub"><span class="mono">?b=${s.slug}</span>${s.city ? ' · ' + s.city : ''}${s.domain ? html` · ${raw(icon('globe', 'ic-sm'))} ${s.domain}` : ''}</div>
            <div class="pf-badges">${statusBadgeShop(s)}${planBadge(s.plan)}<span class="badge plain faint" style="background:none;padding:0 2px">Desde ${dateNum((s.created_at || '').slice(0, 10) || '2026-01-01')}</span></div></div></div>
        <div class="pf-owner">${raw(icon('crown', 'ic-sm'))}<div>${s.owner_name || s.owner_email ? html`<b>${s.owner_name || 'Dueño'}</b><span>${s.owner_email || 'Sin correo'}</span>` : html`<span class="faint">Sin dueño con cuenta</span>`}</div></div>
        <div class="pf-m r"><span class="pf-ml">Equipo</span>${number(s.staff_count)}<small>${number(s.clients_count)} clientes</small></div>
        <div class="pf-m r"><span class="pf-ml">Citas 30 d</span>${number(s.appointments_30d)}<small>&nbsp;</small></div>
        <div class="pf-m r"><span class="pf-ml">Ingresos 30 d</span>${money(s.revenue_30d)}<small>&nbsp;</small></div>
        <div class="pf-acts"><button type="button" class="btn btn-secondary btn-sm btn-enter" data-enter="${s.id}" aria-label="${'Entrar a ' + s.name}">${raw(icon('door', 'ic-sm'))}Entrar</button>
          <button type="button" class="btn btn-ghost btn-icon btn-sm" data-more="${s.id}" aria-label="${'Más acciones para ' + s.name}" aria-haspopup="menu">${raw(icon('more'))}</button></div>
      </div>`;
    }
    function paintShops() {
      const list = $('#pfList', el), count = $('#pfCount', el);
      if (!list) return;
      const rows = st.shops.filter((s) => st.status === 'all' || s.status === st.status);
      count.textContent = st.shops.length ? plural(rows.length, 'barbería', 'barberías') + (st.q ? ' para «' + st.q + '»' : '') + (st.more ? ' (hay más)' : '') : '';
      if (!rows.length) {
        list.innerHTML = String(st.q || st.status !== 'all'
          ? emptyState({ icon: 'search', title: 'Sin resultados', text: st.q ? 'No hay barberías que coincidan con «' + st.q + '». Prueba con el nombre, la ciudad o el correo del dueño.' : 'No hay barberías con ese estado.', compact: true })
          : emptyState({ icon: 'store', title: 'Aún no hay barberías', text: 'Da de alta la primera: se crea con su dueño, servicios y horario base.', action: { label: 'Nueva barbería', id: 'pfEmptyCreate', icon: 'plus' } }));
        return;
      }
      list.innerHTML = String(html`<div class="pf-head" aria-hidden="true"><span>Barbería</span><span>Dueño</span><span class="r">Equipo</span><span class="r">Citas 30 d</span><span class="r">Ingresos 30 d</span><span></span></div>
        <div class="stagger">${rows.map(shopRow)}</div>
        ${st.more ? html`<div class="pf-more"><button type="button" class="btn btn-secondary" data-act="more-shops">${raw(icon('chevron-down'))}Cargar más</button></div>` : ''}`);
    }
    async function loadShops(append) {
      const my = ++st.seq;
      const list = $('#pfList', el);
      try {
        const offset = append ? st.shops.length : 0;
        const r = await api.get('/admin/shops', { q: st.q || undefined, limit: PAGE, offset: offset || undefined });
        if (my !== st.seq) return;
        st.shops = append ? st.shops.concat(r) : r;
        st.more = r.length === PAGE;
        paintShops();
      } catch (e) {
        if (my !== st.seq) return;
        if (list) list.innerHTML = String(errorState(e, 'pfShopsRetry'));
      }
    }
    const shopById = (id) => st.shops.find((s) => s.id === id) || ((st.stats && st.stats.top_shops) || []).find((s) => s.id === id);
    function patchLocal(shop) {
      if (!shop) return;
      st.shops = st.shops.map((s) => (s.id === shop.id ? Object.assign({}, s, shop) : s));
      paintShops();
      const row = el.querySelector('.pf-row[data-shop="' + shop.id + '"]');
      if (row) { row.classList.remove('flash'); void row.offsetWidth; row.classList.add('flash'); }
    }
    async function setStatus(s) {
      const suspend = s.status !== 'suspended';
      const ok = await confirmDialog(suspend
        ? { title: '¿Suspender «' + s.name + '»?', danger: true, icon: 'ban', confirmText: 'Suspender',
          message: 'Su equipo y sus clientes no podrán entrar y su página dejará de recibir reservas hasta que la reactives. No se borra ningún dato.' }
        : { title: '¿Reactivar «' + s.name + '»?', icon: 'check-circle', confirmText: 'Reactivar', message: 'Su equipo podrá entrar de nuevo y su página volverá a recibir reservas.' });
      if (!ok) return;
      try {
        const r = await api.patch('/admin/shops/' + encodeURIComponent(s.id), { status: suspend ? 'suspended' : 'active' });
        toast.success(suspend ? s.name + ' quedó suspendida' : s.name + ' está activa de nuevo');
        patchLocal(r.shop);
        loadStats();
      } catch (err) { toast.error(err); }
    }

    // ── Pestaña Usuarios ──
    function usersFrame() {
      tabEl.innerHTML = String(html`
        <div class="pf-tb"><div class="input-group search">${raw(icon('search'))}<input class="input" type="search" id="pfUQ" placeholder="Buscar por nombre, correo o teléfono" value="${st.uq}" aria-label="Buscar usuarios" autocomplete="off"/></div></div>
        <p class="pf-count" id="pfUCount" aria-live="polite"></p>
        <div class="card" id="pfUsers">${raw('<div class="skel-row"><div class="skel" style="width:36px;height:36px;border-radius:50%"></div><div style="flex:1"><div class="skel skel-line" style="width:35%"></div><div class="skel skel-line" style="width:50%;height:10px"></div></div></div>'.repeat(6))}</div>`);
    }
    function userRow(u) {
      const shops = u.shops || [];
      const off = u.status === 'disabled';
      return html`<div class="pf-u ${off ? 'off' : ''}" data-user="${u.id}">
        ${avatar(u.name || u.email)}
        <div style="min-width:0"><div class="nm">${u.name || 'Sin nombre'}${u.is_superadmin ? html`<span class="badge brand plain">${raw(icon('shield', 'ic-sm'))}Superadmin</span>` : ''}${u.id === meId ? html`<span class="badge plain">Tú</span>` : ''}${off ? html`<span class="badge err">Desactivada</span>` : ''}</div>
          <div class="em">${u.email}${u.phone ? ' · ' + fmtPhone(u.phone) : ''}</div>
          ${shops.length ? html`<div class="shops">${shops.slice(0, 3).map((x) => html`<span class="tag" title="${x.shop_name + ' · ' + (ROLE[x.role] || x.role)}">${x.shop_name}<b>${ROLE[x.role] || x.role}</b></span>`)}${shops.length > 3 ? html`<span class="tag">+${shops.length - 3}</span>` : ''}</div>` : html`<div class="shops"><span class="tag">Sin barbería</span></div>`}</div>
        <div class="side"><small>${u.last_login_at ? 'Entró ' + ago(u.last_login_at) : 'Nunca ha entrado'}</small>
          ${u.id !== meId ? html`<button type="button" class="btn btn-ghost btn-icon btn-sm" data-umore="${u.id}" aria-label="${'Acciones para ' + (u.name || u.email)}" aria-haspopup="menu">${raw(icon('more'))}</button>` : ''}</div>
      </div>`;
    }
    function paintUsers() {
      const box = $('#pfUsers', el), count = $('#pfUCount', el);
      if (!box) return;
      count.textContent = plural(st.users.length, 'usuario') + (st.uq ? ' para «' + st.uq + '»' : '') + (st.users.length >= 100 ? ' (se muestran los primeros 100)' : '');
      box.innerHTML = String(st.users.length ? html`<div class="stagger">${st.users.map(userRow)}</div>`
        : emptyState({ icon: 'users', title: st.uq ? 'Sin resultados' : 'Aún no hay usuarios', text: st.uq ? 'No hay cuentas que coincidan con «' + st.uq + '».' : 'Las cuentas aparecen cuando alguien se registra o creas una barbería.', compact: true }));
    }
    async function loadUsers() {
      const my = ++st.useq;
      try {
        const r = await api.get('/admin/users', { q: st.uq || undefined, limit: 100 });
        if (my !== st.useq) return;
        st.users = r;
        paintUsers();
      } catch (e) {
        if (my !== st.useq) return;
        const box = $('#pfUsers', el); if (box) box.innerHTML = String(errorState(e, 'pfUsersRetry'));
      }
    }
    async function setUserStatus(u) {
      const disable = u.status !== 'disabled';
      const ok = await confirmDialog(disable
        ? { title: '¿Desactivar la cuenta de ' + (u.name || u.email) + '?', danger: true, icon: 'user-x', confirmText: 'Desactivar', message: 'No podrá iniciar sesión y se cerrarán sus sesiones abiertas. Sus datos y citas se conservan.' }
        : { title: '¿Reactivar la cuenta de ' + (u.name || u.email) + '?', icon: 'user-check', confirmText: 'Reactivar', message: 'Podrá volver a iniciar sesión con su correo y contraseña.' });
      if (!ok) return;
      try {
        const r = await api.patch('/admin/users/' + encodeURIComponent(u.id), { status: disable ? 'disabled' : 'active' });
        st.users = st.users.map((x) => (x.id === u.id ? Object.assign({}, x, r.user || { status: disable ? 'disabled' : 'active' }) : x));
        paintUsers();
        toast.success(disable ? 'Cuenta desactivada' : 'Cuenta reactivada');
      } catch (err) { toast.error(err); }
    }

    function showTab(t, push) {
      st.tab = t;
      el.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === t)));
      if (push) setQuery(t === 'users' ? { tab: 'usuarios' } : {});
      if (t === 'users') { usersFrame(); loadUsers(); } else { shopsFrame(); if (st.shops.length) paintShops(); loadShops(); }
    }

    // ── Eventos ──
    const offs = [];
    let timer = null;
    offs.push(on(el, 'input', '#pfQ,#pfUQ', (e, inp) => {
      clearTimeout(timer);
      timer = setTimeout(() => { if (inp.id === 'pfQ') { st.q = inp.value.trim(); loadShops(); } else { st.uq = inp.value.trim(); loadUsers(); } }, 260);
    }));
    offs.push(on(el, 'click', '[data-tab]', (e, b) => { if (b.dataset.tab !== st.tab) showTab(b.dataset.tab, true); }));
    offs.push(on(el, 'click', '[data-status]', (e, b) => { st.status = b.dataset.status; el.querySelectorAll('[data-status]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); paintShops(); }));
    offs.push(on(el, 'click', '[data-act="create"],#pfEmptyCreate', () => openCreate(() => { st.q = ''; st.status = 'all'; if (st.tab !== 'shops') showTab('shops', true); else { shopsFrame(); loadShops(); } loadStats(); })));
    offs.push(on(el, 'click', '[data-act="more-shops"]', (e, b) => busy(b, loadShops(true))));
    offs.push(on(el, 'click', '#pfStatsRetry', () => loadStats()));
    offs.push(on(el, 'click', '#pfShopsRetry', () => loadShops()));
    offs.push(on(el, 'click', '#pfUsersRetry', () => loadUsers()));
    offs.push(on(el, 'click', '[data-enter]', async (e, b) => {
      const s = shopById(b.dataset.enter);
      try {
        await busy(b, window.TB.enterShop(b.dataset.enter));
        toast.success('Entraste a ' + (s ? s.name : 'la barbería') + ' como superadmin');
      } catch (err) { toast.error(err); }
    }));
    offs.push(on(el, 'click', '[data-more]', (e, b) => {
      const s = shopById(b.dataset.more);
      if (!s) return;
      menu(b, [
        { label: 'Entrar a la barbería', icon: 'door', onClick: () => { const x = el.querySelector('[data-enter="' + s.id + '"]'); if (x) x.click(); } },
        { label: 'Ver página de reservas', icon: 'external', href: SITE_BASE + '?b=' + encodeURIComponent(s.slug), external: true },
        { label: 'Copiar enlace de reservas', icon: 'copy', onClick: () => copyText(SITE_BASE + '?b=' + encodeURIComponent(s.slug), 'Enlace copiado') },
        { sep: true },
        { label: 'Cambiar plan', icon: 'crown', onClick: () => openPlan(s, patchLocal) },
        { label: s.domain ? 'Editar dominio' : 'Asignar dominio', icon: 'globe', onClick: () => openDomain(s, patchLocal) },
        { sep: true },
        s.status === 'suspended' ? { label: 'Reactivar barbería', icon: 'check-circle', onClick: () => setStatus(s) } : { label: 'Suspender barbería', icon: 'ban', danger: true, onClick: () => setStatus(s) }
      ]);
    }));
    offs.push(on(el, 'click', '[data-umore]', (e, b) => {
      const u = st.users.find((x) => x.id === b.dataset.umore);
      if (!u) return;
      menu(b, [
        { label: 'Copiar correo', icon: 'mail', onClick: () => copyText(u.email, 'Correo copiado') },
        ...(u.shops || []).filter((x) => x.role !== 'client').slice(0, 3).map((x) => ({ label: 'Entrar a ' + x.shop_name, icon: 'door', onClick: async () => { try { await window.TB.enterShop(x.shop_id); toast.success('Entraste a ' + x.shop_name); } catch (err) { toast.error(err); } } })),
        { sep: true },
        u.status === 'disabled' ? { label: 'Reactivar cuenta', icon: 'user-check', onClick: () => setUserStatus(u) } : { label: 'Desactivar cuenta', icon: 'user-x', danger: true, onClick: () => setUserStatus(u) }
      ]);
    }));

    showTab(st.tab, false);
    loadStats();
    return () => { clearTimeout(timer); offs.forEach((f) => f()); };
  }
};
