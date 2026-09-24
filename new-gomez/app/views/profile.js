// #/perfil — Mi perfil: datos del usuario (PATCH /api/auth/profile), contraseña (POST /api/auth/password),
// ficha de staff (PIN y color: PATCH /api/staff/:id), preferencias de cliente (PATCH /api/my/profile),
// tema, instalar app, versión y cerrar sesión. Sesión por PIN (sin usuario): datos del staff y cambio de PIN.
import { html, raw, esc, $, $$, on, formData } from '../lib/html.js';
import { icon } from '../lib/icons.js';
import { api, getMode, health } from '../lib/api.js';
import { state, bus, role, shop, isSuper, clearSession } from '../lib/state.js';
import { toast, modal, confirmDialog, busy, avatar, clearFieldErrors } from '../lib/ui.js';
import { ROLE, monthYear, phone as fmtPhone, initials, colorFor, firstName } from '../lib/fmt.js';
import { ensureFormCss, fieldHtml, pwFieldHtml, wireFormUx, liveForm, applyApiErrors, rules, digits } from './register.js';

// Paleta del equipo (misma que core/api/staff.js → STAFF_COLORS).
const COLORS = ['#c8a24a', '#4f7cac', '#3e8e7e', '#b5654a', '#8e6c8a', '#6b7a8f', '#5e8c61', '#c27c8e', '#d4a373', '#2f6690', '#9c6644', '#7d8cc4'];
const THEMES = [['auto', 'Automático', 'monitor'], ['light', 'Claro', 'sun'], ['dark', 'Oscuro', 'moon']];
const THEME_LABEL = { auto: 'automático', light: 'claro', dark: 'oscuro' };

// Refleja el tema en el botón de la barra lateral sin volver a pintar todo el shell.
export function syncShellTheme(t) {
  const b = document.getElementById('themeBtn');
  if (!b) return;
  b.innerHTML = icon(document.documentElement.getAttribute('data-theme') === 'dark' ? 'sun' : 'moon') + '<span>Tema: ' + esc(THEME_LABEL[t] || THEME_LABEL.auto) + '</span>';
}
function syncShellName(name) {
  $$('.sb-user .name').forEach((n) => { n.textContent = name; });
  $$('.sb-user .avatar').forEach((a) => { a.textContent = initials(name); });
}
// Versión del service worker (caché de la app), si hay uno controlando la página.
function swVersion() {
  return new Promise((resolve) => {
    const c = navigator.serviceWorker && navigator.serviceWorker.controller;
    if (!c || typeof MessageChannel === 'undefined') return resolve(null);
    const ch = new MessageChannel();
    const t = setTimeout(() => resolve(null), 1500);
    ch.port1.onmessage = (e) => { clearTimeout(t); resolve(e.data && e.data.version); };
    try { c.postMessage({ type: 'GET_VERSION' }, [ch.port2]); } catch (e) { clearTimeout(t); resolve(null); }
  });
}

const CSS = `
.pf-grid{display:grid;gap:16px;grid-template-columns:minmax(0,1fr)}
.pf-grid>*{min-width:0}
@media (min-width:1024px){.pf-grid{grid-template-columns:minmax(0,1fr) 330px;align-items:start;gap:20px}.pf-side{position:sticky;top:calc(var(--topbar-h) + 12px)}}
.pf-hero{position:relative;overflow:hidden;isolation:isolate;padding:22px 20px;display:flex;align-items:center;gap:18px}
.pf-hero::before{content:"";position:absolute;inset:0;z-index:-1;background:radial-gradient(120% 140% at 0% 0%,var(--brand-soft),transparent 58%);pointer-events:none}
@media (min-width:768px){.pf-hero{padding:26px 26px}}
.pf-hero .avatar{--s:72px;font-size:26px;box-shadow:0 0 0 3px var(--surface),0 0 0 5.5px var(--ring,var(--brand));transition:box-shadow .3s var(--ease)}
.pf-hero h3{font-family:var(--disp);font-size:28px;font-weight:800;line-height:1.05;letter-spacing:.01em;overflow-wrap:anywhere}
.pf-hero .who{font-size:13.5px;color:var(--text-2);margin-top:4px;overflow-wrap:anywhere}
.pf-badges{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
.pf-badges .badge .ic{width:12px;height:12px}
.pf-card .card-head{padding:18px 18px 0;align-items:flex-start}
.pf-card .card-head .ci{width:36px;height:36px;border-radius:11px;background:var(--brand-soft);color:var(--brand-strong);display:grid;place-items:center;flex:none}
.pf-card .card-head .ci .ic{width:18px;height:18px}
.pf-card .card-head .sub{margin-top:2px;line-height:1.4}
.pf-card .card-body{padding:16px 18px 18px}
@media (min-width:768px){.pf-card .card-head{padding:20px 22px 0}.pf-card .card-body{padding:16px 22px 22px}}
.pf-ro{display:flex;align-items:center;gap:10px;min-height:44px;padding:0 12px;border-radius:var(--r-sm);background:var(--surface-2);border:1px dashed var(--border-strong);color:var(--text-2);font-size:15px;min-width:0}
.pf-ro .ic{width:16px;height:16px;color:var(--text-3);flex:none}
.pf-ro span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pf-actions{display:flex;justify-content:flex-end;gap:10px;align-items:center;flex-wrap:wrap}
.pf-actions .saved{font-size:12.5px;color:var(--ok);display:inline-flex;align-items:center;gap:4px;animation:fadeUp .3s var(--ease)}
.pf-actions .saved .ic{width:14px;height:14px;stroke-width:2.6}
@media (max-width:719px){.pf-actions .btn{flex:1}}
.pf-sw{display:grid;grid-template-columns:repeat(auto-fill,minmax(44px,1fr));gap:10px;max-width:440px}
.pf-sw button,.pf-sw label{position:relative;aspect-ratio:1;min-height:44px;border-radius:50%;background:var(--c);display:grid;place-items:center;color:#fff;box-shadow:inset 0 0 0 1px rgba(0,0,0,.1);transition:transform .15s var(--ease),box-shadow .2s var(--ease);cursor:pointer}
.pf-sw button:hover,.pf-sw label:hover{transform:scale(1.07)}
.pf-sw button .ic{width:20px;height:20px;stroke-width:2.8;opacity:0;transform:scale(.4);transition:opacity .2s,transform .25s var(--ease-out)}
.pf-sw button[aria-checked="true"]{box-shadow:0 0 0 3px var(--surface),0 0 0 5px var(--c)}
.pf-sw button[aria-checked="true"] .ic{opacity:1;transform:none}
.pf-sw label{background:conic-gradient(from 0deg,#c8a24a,#b5654a,#c27c8e,#8e6c8a,#4f7cac,#3e8e7e,#5e8c61,#c8a24a)}
.pf-sw label.on{box-shadow:0 0 0 3px var(--surface),0 0 0 5px var(--text-3)}
.pf-sw label .ic{width:18px;height:18px;color:#fff;filter:drop-shadow(0 1px 1px rgba(0,0,0,.4))}
.pf-sw input{position:absolute;inset:0;opacity:0;width:100%;height:100%;cursor:pointer}
.pf-appt{display:flex;align-items:center;gap:12px;margin-top:14px;padding:10px 12px;border-radius:12px;border-left:4px solid var(--c);background:var(--surface-2);background:color-mix(in srgb,var(--c) 11%,var(--surface));max-width:440px;transition:border-color .3s var(--ease),background .3s var(--ease)}
.pf-appt .t{font-family:var(--mono);font-size:12.5px;color:var(--text-2)}
.pf-appt b{display:block;font-size:14px}
.pf-appt small{display:block;color:var(--text-2);font-size:12.5px}
.pf-row{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.pf-row .grow{flex:1 1 200px;min-width:0}
.pf-row .grow b{display:block;font-size:14.5px}
@media (max-width:559px){.pf-row>.row{width:100%;padding-left:56px}.pf-row>.row .btn{flex:1}}
.pf-row .grow small{display:block;color:var(--text-2);font-size:13px;margin-top:1px}
.pf-pinic{width:44px;height:44px;border-radius:13px;display:grid;place-items:center;background:var(--surface-3);color:var(--text-2);flex:none}
.pf-pinic.on{background:var(--ok-soft);color:var(--ok)}
.pf-dots{display:inline-flex;gap:5px;margin-left:6px;vertical-align:middle}
.pf-dots i{width:7px;height:7px;border-radius:50%;background:currentColor}
.pf-note{display:flex;gap:10px;align-items:flex-start;font-size:13.5px;color:var(--text-2);line-height:1.5}
.pf-note .ic{width:18px;height:18px;flex:none;margin-top:1px;color:var(--text-3)}
.pf-theme{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.pf-theme button{display:grid;justify-items:center;gap:8px;padding:12px 6px 10px;border-radius:14px;border:1.5px solid var(--border);background:var(--surface);font-size:13px;font-weight:600;color:var(--text-2);transition:border-color .15s,background .15s,color .15s;min-height:44px}
.pf-theme button:hover{border-color:var(--border-strong);color:var(--text)}
.pf-theme button[aria-pressed="true"]{border-color:var(--brand);background:var(--brand-softer);color:var(--text)}
.pf-theme .pv{width:100%;max-width:74px;height:46px;border-radius:9px;border:1px solid var(--border-strong);overflow:hidden;display:grid;grid-template-columns:1fr 1fr}
.pf-theme .pv i{display:block}
.pf-theme .pv .l{background:#F5F3EE}.pf-theme .pv .d{background:#15130F}
.pf-theme .pv.l1{grid-template-columns:1fr}.pf-theme .pv.l1 .l{background:linear-gradient(#FFFFFF 38%,#F0ECE4 38%)}
.pf-theme .pv.d1{grid-template-columns:1fr}.pf-theme .pv.d1 .d{background:linear-gradient(#26221C 38%,#0F0E0B 38%)}
.pf-theme .lbl{display:flex;align-items:center;gap:5px}.pf-theme .lbl .ic{width:14px;height:14px}
.pf-list .list-item{padding:12px 18px;min-height:56px}
.pf-list .list-item>.ic{color:var(--text-3)}
.pf-list .trail{color:var(--text-3);font-size:13px}
.pf-ver{font-family:var(--mono);font-size:12.5px;color:var(--text-2)}
.pf-logout{color:var(--err)!important}
.pf-logout:hover{background:var(--err-soft)!important;border-color:transparent!important}
`;

export default {
  title: 'Mi perfil',
  async render(el) {
    ensureFormCss();
    if (!document.getElementById('st-profile')) document.head.insertAdjacentHTML('beforeend', '<style id="st-profile">' + CSS + '</style>');
    const user = state.user;
    const ctx = state.ctx;
    const pinSession = !user && !!state.staff;
    const sh = shop();
    const r = role();
    const staff = ctx && ctx.staff ? Object.assign({}, ctx.staff) : null;
    const client = ctx && ctx.client ? Object.assign({}, ctx.client) : null;
    const isClient = r === 'client' && !!client;
    const demo = getMode() === 'demo';
    const pwa = (window.TB && window.TB.pwa) || {};
    let gone = false;

    const displayName = () => (user && user.name) || (staff && staff.name) || (state.staff && state.staff.name) || '';
    const color = () => (staff && staff.color) || colorFor(displayName());
    const roleLabel = isSuper() && r !== 'superadmin' ? 'Superadmin' : (ROLE[r] || (isSuper() ? 'Superadmin' : ''));

    const hero = () => html`
      <section class="card pf-hero fade-up" style="--ring:${color()}" id="pfHero">
        ${avatar(displayName(), { color: color() })}
        <div class="grow">
          <h3 id="pfHeroName">${displayName()}</h3>
          <p class="who">${user ? user.email : (sh ? 'Entraste con tu PIN en ' + sh.name : 'Entraste con tu PIN')}</p>
          <div class="pf-badges">
            ${roleLabel ? html`<span class="badge brand plain">${raw(icon(r === 'client' ? 'user' : r === 'barber' ? 'scissors' : isSuper() ? 'shield' : 'crown'))}${roleLabel}</span>` : ''}
            ${sh ? html`<span class="badge plain">${raw(icon('store'))}${sh.name}</span>` : html`<span class="badge plain">${raw(icon('store'))}Sin barbería activa</span>`}
            ${demo ? html`<span class="badge warn plain">${raw(icon('sparkles'))}Demo</span>` : ''}
            ${user && user.created_at ? html`<span class="badge plain">Desde ${monthYear(user.created_at.slice(0, 10)).toLowerCase()}</span>` : ''}
          </div>
        </div>
      </section>`;

    const cardHead = (ic, title, sub) => html`<div class="card-head"><div class="row top" style="gap:12px"><span class="ci">${raw(icon(ic))}</span><div><h3>${title}</h3>${sub ? html`<p class="sub">${sub}</p>` : ''}</div></div></div>`;

    // ── Tus datos ──
    const nameMax = isClient ? 80 : (staff ? 60 : 120);
    const dataVals = () => ({
      name: displayName(),
      phone: fmtPhone((user && user.phone) || (pinSession && staff && staff.phone) || '')
    });
    const dataCard = () => html`
      <section class="card pf-card">
        ${cardHead('user', 'Tus datos', isClient ? 'Así te identifica ' + (sh ? sh.name : 'la barbería') + ' cuando reservas.' : pinSession ? 'Tu nombre y teléfono en el equipo de ' + (sh ? sh.name : 'la barbería') + '.' : 'Tu nombre y cómo contactarte.')}
        <div class="card-body">
          <form id="pfData" class="stack" novalidate>
            <div class="form-grid cols-2">
              ${fieldHtml({ id: 'pfName', name: 'name', label: 'Nombre', value: dataVals().name, autocomplete: 'name', attrs: 'autocapitalize="words" maxlength="' + nameMax + '" required' })}
              ${fieldHtml({ id: 'pfPhone', name: 'phone', label: isClient ? 'Celular (WhatsApp)' : 'Teléfono', type: 'tel', value: dataVals().phone, optional: !isClient, inputmode: 'tel', autocomplete: 'tel-national', placeholder: '10 dígitos', attrs: 'maxlength="16"' })}
            </div>
            ${user ? html`<div class="field"><span class="label">Correo</span><div class="pf-ro">${raw(icon('lock'))}<span>${user.email}</span></div><p class="hint">Es tu usuario para entrar. No se puede cambiar desde aquí.</p></div>` : ''}
            <div class="pf-actions"><span id="pfDataMsg"></span><button type="submit" class="btn btn-primary" disabled>Guardar cambios</button></div>
          </form>
        </div>
      </section>`;

    // ── Preferencias de cliente ──
    const prefsCard = () => !isClient ? '' : html`
      <section class="card pf-card">
        ${cardHead('bell', 'Tus preferencias', 'En ' + (sh ? sh.name : 'tu barbería') + '.')}
        <div class="card-body stack">
          <label class="switch" style="justify-content:space-between;width:100%">
            <span><b style="display:block;font-size:14.5px">Promociones y novedades</b><span class="muted" style="font-size:13px">Recibe por WhatsApp promociones de la barbería. Los recordatorios de tus citas llegan siempre.</span></span>
            <input type="checkbox" id="pfMkt" ${raw(client.marketing_ok ? 'checked' : '')}/><span class="track"></span>
          </label>
          <div class="hr" style="margin:4px 0"></div>
          <form id="pfBday" class="stack" novalidate>
            <div class="field"><label for="pfBd">Tu cumpleaños <span class="opt">(opcional)</span></label>
              <input class="input" type="date" id="pfBd" name="birthday" value="${client.birthday || ''}" max="${new Date().toISOString().slice(0, 10)}" style="max-width:260px"/>
              <p class="hint">Algunas barberías tienen un detalle para ti ese día.</p><p class="error">Fecha de nacimiento no válida.</p></div>
            <div class="pf-actions"><span id="pfBdMsg"></span><button type="submit" class="btn btn-secondary" disabled>Guardar cumpleaños</button></div>
          </form>
        </div>
      </section>`;

    // ── Ficha de staff (color + PIN) ──
    const pinRow = () => html`
      <div class="pf-row">
        <span class="pf-pinic ${staff.has_pin ? 'on' : ''}">${raw(icon('key'))}</span>
        <div class="grow"><b>PIN de acceso rápido ${staff.has_pin ? html`<span class="pf-dots ok-t" aria-hidden="true"><i></i><i></i><i></i><i></i></span>` : ''}</b>
          <small>${staff.has_pin ? 'Configurado. Úsalo para entrar en la tablet o computadora de la barbería.' : 'Aún no tienes PIN. Créalo para entrar en segundos en la tablet de la barbería.'}</small></div>
        <div class="row" style="gap:6px">
          ${staff.has_pin && !pinSession ? html`<button type="button" class="btn btn-danger-ghost btn-sm" data-act="pin-off">Quitar</button>` : ''}
          <button type="button" class="btn btn-secondary btn-sm" data-act="pin">${raw(icon(staff.has_pin ? 'edit' : 'plus', 'ic-sm'))}${staff.has_pin ? 'Cambiar PIN' : 'Crear PIN'}</button>
        </div>
      </div>`;
    const staffCard = () => !staff ? '' : html`
      <section class="card pf-card">
        ${cardHead('scissors', 'Tu ficha en ' + (sh ? sh.name : 'la barbería'), 'Tu color en la agenda y tu PIN para entrar rápido.')}
        <div class="card-body">
          <span class="label" id="pfColorL">Tu color en la agenda</span>
          <div class="pf-sw" role="radiogroup" aria-labelledby="pfColorL" style="margin-top:10px" id="pfSw">
            ${COLORS.map((c) => html`<button type="button" role="radio" style="--c:${c}" data-color="${c}" aria-checked="${String((staff.color || '').toLowerCase() === c)}" aria-label="Color ${c}">${raw(icon('check'))}</button>`)}
            <label style="--c:${staff.color || '#8C8577'}" class="${COLORS.includes((staff.color || '').toLowerCase()) ? '' : 'on'}" title="Otro color">${raw(icon('plus'))}<input type="color" id="pfColorX" value="${/^#[0-9a-f]{6}$/i.test(staff.color || '') ? staff.color : '#8c8577'}" aria-label="Elegir otro color"/></label>
          </div>
          <div class="pf-appt" id="pfAppt" style="--c:${staff.color || '#8C8577'}" aria-hidden="true">
            <span class="t">10:00</span><div class="grow"><b>Corte y barba</b><small>con ${firstName(staff.name)} · así se ven tus citas</small></div>
          </div>
          <div class="hr" style="margin:18px 0 16px"></div>
          <div id="pfPin">${pinRow()}</div>
        </div>
      </section>`;

    // ── Contraseña ──
    const secCard = () => html`
      <section class="card pf-card">
        ${cardHead('lock', 'Contraseña', user ? 'Al cambiarla cerramos tu sesión en tus otros dispositivos.' : '')}
        <div class="card-body">
          ${user ? html`<form id="pfPw" class="stack" novalidate>
              <input type="text" name="username" value="${user.email}" autocomplete="username" hidden aria-hidden="true" tabindex="-1"/>
              ${pwFieldHtml({ id: 'pfCur', name: 'current', label: 'Contraseña actual', autocomplete: 'current-password' })}
              <div class="form-grid cols-2">
                ${pwFieldHtml({ id: 'pfNew', name: 'next', label: 'Nueva contraseña', meter: true })}
                ${pwFieldHtml({ id: 'pfNew2', name: 'next2', label: 'Repite la nueva contraseña' })}
              </div>
              <div class="pf-actions"><button type="submit" class="btn btn-dark">${raw(icon('key'))}Cambiar contraseña</button></div>
            </form>`
          : html`<p class="pf-note">${raw(icon('info'))}<span>Entraste con tu PIN. Para cambiar tu contraseña, <a class="link-btn" href="#/login" data-act="to-login">entra con tu correo</a>.</span></p>`}
        </div>
      </section>`;

    // ── Lateral: tema, app, sesión ──
    const themeCard = () => html`
      <section class="card pf-card">
        ${cardHead('moon', 'Apariencia', 'Automático sigue el modo de tu celular.')}
        <div class="card-body">
          <div class="pf-theme" role="group" aria-label="Tema">
            ${THEMES.map(([k, l, ic]) => html`<button type="button" data-theme-k="${k}" aria-pressed="${String(window.TB.getTheme() === k)}">
              <span class="pv ${k === 'light' ? 'l1' : k === 'dark' ? 'd1' : ''}">${k === 'auto' ? raw('<i class="l"></i><i class="d"></i>') : raw(k === 'light' ? '<i class="l"></i>' : '<i class="d"></i>')}</span>
              <span class="lbl">${raw(icon(ic))}${l}</span></button>`)}
          </div>
        </div>
      </section>`;
    const appCard = () => html`
      <section class="card pf-card">
        ${cardHead('smartphone', 'La app')}
        <div class="list pf-list" style="margin-top:8px">
          ${pwa.installed ? html`<div class="list-item">${raw(icon('check-circle', 'ok-t'))}<span class="grow"><span class="title">App instalada</span><span class="meta" style="display:block">Ábrela desde tu pantalla de inicio.</span></span></div>`
            : html`<a class="list-item" href="#/instalar">${raw(icon('download'))}<span class="grow"><span class="title">Instalar la app</span><span class="meta" style="display:block">En tu celular o computadora, sin tienda de apps.</span></span>${raw(icon('chevron-right', 'ic-sm'))}</a>`}
          ${demo ? html`<a class="list-item" href="#/guia">${raw(icon('book'))}<span class="grow"><span class="title">Guía de la demo</span><span class="meta" style="display:block">Guion para presentarla en una barbería.</span></span>${raw(icon('chevron-right', 'ic-sm'))}</a>` : ''}
          <div class="list-item">${raw(icon('info'))}<span class="grow"><span class="title">Versión</span><span class="meta" style="display:block">${demo ? 'Demo con datos ficticios' : 'Conectada al servidor'}</span></span><span class="trail pf-ver" id="pfVer">…</span></div>
        </div>
      </section>`;
    const sessionCard = () => html`
      <section class="card pf-card">
        ${cardHead('door', 'Sesión', pinSession ? 'Entraste con PIN. La sesión se cierra sola en 12 horas.' : 'Entraste con tu correo en este dispositivo.')}
        <div class="card-body"><button type="button" class="btn btn-secondary btn-block pf-logout" data-act="logout">${raw(icon('logout'))}Cerrar sesión</button></div>
      </section>`;

    el.innerHTML = String(html`
      <div class="page-head"><div><h2>Mi perfil</h2><p>Tus datos, tu seguridad y cómo se ve la app.</p></div></div>
      <div class="pf-grid">
        <div class="pf-main stack-lg">${hero()}${dataCard()}${prefsCard()}${staffCard()}${secCard()}</div>
        <aside class="pf-side stack-lg">${themeCard()}${appCard()}${sessionCard()}</aside>
      </div>`);

    const offs = [wireFormUx(el)];
    const lives = [];
    const savedMsg = (id, text) => { const m = $('#' + id, el); if (!m) return; m.innerHTML = '<span class="saved">' + icon('check') + esc(text || 'Guardado') + '</span>'; setTimeout(() => { if (m.isConnected) m.innerHTML = ''; }, 2600); };

    // ── Tus datos: guardar ──
    const dForm = $('#pfData', el);
    const dLive = liveForm(dForm, { name: rules.name('Escribe tu nombre.', nameMax), phone: rules.phone(false) });
    lives.push(dLive);
    let base = { name: dataVals().name.trim(), phone: digits(dataVals().phone) };
    const dBtn = dForm.querySelector('[type=submit]');
    const dirty = () => { const d = formData(dForm); return d.name.trim() !== base.name || digits(d.phone) !== base.phone; };
    const onDataInput = () => { dBtn.disabled = !dirty(); };
    dForm.addEventListener('input', onDataInput);
    const phoneIn = $('#pfPhone', el);
    const onPhoneBlur = () => { const d = digits(phoneIn.value); if (d.length === 10) phoneIn.value = fmtPhone(d); };
    phoneIn.addEventListener('blur', onPhoneBlur);
    dForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearFieldErrors(dForm);
      if (!dirty() || !dLive.validate()) return;
      const d = formData(dForm);
      const name = d.name.trim();
      const ph = digits(d.phone);
      try {
        await busy(dBtn, async () => {
          if (pinSession) {
            const st = await api.patch('/staff/' + staff.id, { name, phone: ph || null });
            Object.assign(staff, st);
            if (ctx && ctx.staff) Object.assign(ctx.staff, st);
            if (state.staff) state.staff.name = st.name;
            bus.emit('staff:changed');
            return;
          }
          if (isClient) {
            const cp = { name };
            if (ph) cp.phone = ph;
            const cr = await api.patch('/my/profile', cp);
            if (cr && cr.client && ctx.client) Object.assign(ctx.client, cr.client);
          }
          const prev = { name: user.name, phone: user.phone || '' };
          const ur = await api.patch('/auth/profile', { name, phone: ph });
          Object.assign(user, ur.user);
          // La ficha del equipo sigue al perfil cuando era igual (no se pisa un nombre de agenda distinto).
          if (staff && ctx && ctx.staff && (staff.name === prev.name || (staff.phone || '') === prev.phone)) {
            const sp = {};
            if (staff.name === prev.name && name !== staff.name) sp.name = name;
            if ((staff.phone || '') === prev.phone && ph !== (staff.phone || '')) sp.phone = ph || null;
            if (Object.keys(sp).length) {
              try { const st = await api.patch('/staff/' + staff.id, sp); Object.assign(staff, st); Object.assign(ctx.staff, st); bus.emit('staff:changed'); } catch (x) { /* el perfil ya se guardó */ }
            }
          }
        });
        base = { name, phone: ph };
        dBtn.disabled = true;
        $('#pfHeroName', el).textContent = displayName();
        const av = $('#pfHero .avatar', el); if (av) av.textContent = initials(displayName());
        syncShellName(displayName());
        dLive.reset();
        savedMsg('pfDataMsg');
        toast.success('Tus datos se guardaron');
      } catch (err) {
        if (err.code === 'duplicate' && isClient) dLive.setError('phone', err.message);
        else applyApiErrors(dForm, dLive, err);
      }
    });

    // ── Preferencias de cliente ──
    if (isClient) {
      const mk = $('#pfMkt', el);
      mk.addEventListener('change', async () => {
        const v = mk.checked;
        mk.disabled = true;
        try {
          const cr = await api.patch('/my/profile', { marketing_ok: v });
          if (cr && cr.client) Object.assign(ctx.client, cr.client);
          toast.success(v ? 'Listo: te avisaremos de promociones' : 'Ya no te enviaremos promociones');
        } catch (err) { mk.checked = !v; toast.error(err); }
        finally { mk.disabled = false; }
      });
      const bForm = $('#pfBday', el);
      const bBtn = bForm.querySelector('[type=submit]');
      let bBase = client.birthday || '';
      const bIn = $('#pfBd', el);
      const onB = () => { bBtn.disabled = bIn.value === bBase; bIn.closest('.field').classList.remove('invalid'); };
      bIn.addEventListener('input', onB); bIn.addEventListener('change', onB);
      bForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const v = bIn.value || null;
        try {
          const cr = await busy(bBtn, api.patch('/my/profile', { birthday: v }));
          if (cr && cr.client) Object.assign(ctx.client, cr.client);
          bBase = bIn.value; bBtn.disabled = true;
          savedMsg('pfBdMsg');
          toast.success(v ? 'Guardamos tu cumpleaños' : 'Quitamos tu cumpleaños');
        } catch (err) {
          if (err.fields && err.fields.birthday) { const f = bIn.closest('.field'); f.classList.add('invalid'); f.querySelector('.error').textContent = err.fields.birthday; }
          else toast.error(err);
        }
      });
    }

    // ── Staff: color ──
    const paintColor = (c) => {
      $$('#pfSw [data-color]', el).forEach((b) => b.setAttribute('aria-checked', String(b.dataset.color === c)));
      const lab = $('#pfSw label', el);
      if (lab) { lab.classList.toggle('on', !COLORS.includes(c)); if (!COLORS.includes(c)) lab.style.setProperty('--c', c); }
      const ap = $('#pfAppt', el); if (ap) ap.style.setProperty('--c', c);
      const hero = $('#pfHero', el); if (hero) hero.style.setProperty('--ring', c);
      const av = $('#pfHero .avatar', el); if (av) av.style.setProperty('--c', c);
    };
    let colorSeq = 0;
    const saveColor = async (c) => {
      if (!staff) return;
      c = String(c).toLowerCase();
      if (c === String(staff.color || '').toLowerCase()) return;
      const prev = staff.color;
      paintColor(c);
      const my = ++colorSeq;
      try {
        const st = await api.patch('/staff/' + staff.id, { color: c });
        if (my !== colorSeq) return;
        Object.assign(staff, st);
        if (ctx && ctx.staff) ctx.staff.color = st.color;
        bus.emit('staff:changed');
        toast.success('Tu color en la agenda cambió');
      } catch (err) {
        if (my !== colorSeq) return;
        paintColor(String(prev || '').toLowerCase());
        toast.error(err);
      }
    };
    offs.push(on(el, 'click', '#pfSw [data-color]', (e, b) => saveColor(b.dataset.color)));
    const cx = $('#pfColorX', el);
    if (cx) {
      cx.addEventListener('input', () => paintColor(cx.value.toLowerCase()));
      cx.addEventListener('change', () => saveColor(cx.value));
    }
    offs.push(on(el, 'keydown', '#pfSw [data-color]', (e, b) => {
      const all = $$('#pfSw [data-color]', el);
      const i = all.indexOf(b);
      const k = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!k) return;
      e.preventDefault();
      const n = all[(i + k + all.length) % all.length];
      n.focus(); saveColor(n.dataset.color);
    }));

    // ── Staff: PIN ──
    const openPin = () => {
      const m = modal({
        title: staff.has_pin ? 'Cambia tu PIN' : 'Crea tu PIN', size: 'sm',
        subtitle: 'Para entrar rápido en la tablet o computadora de la barbería.',
        body: String(html`<form id="pinF" class="stack" novalidate>
          ${pwFieldHtml({ id: 'pfPin1', name: 'pin', label: 'Nuevo PIN', autocomplete: 'off', placeholder: '4 a 6 números' })}
          ${pwFieldHtml({ id: 'pfPin2', name: 'pin2', label: 'Repite el PIN', autocomplete: 'off', placeholder: 'Otra vez, para confirmar' })}
          <p class="pf-note" style="font-size:13px">${raw(icon('info'))}<span>Evita PINs obvios como 1234 o tu año de nacimiento. Cada persona del equipo necesita uno distinto.</span></p>
        </form>`),
        actions: [
          { label: 'Cancelar', variant: 'secondary', value: false },
          { label: 'Guardar PIN', variant: 'primary', close: false, onClick: () => save() }
        ]
      });
      const f = $('#pinF', m.body);
      $$('input', f).forEach((i) => { i.setAttribute('inputmode', 'numeric'); i.setAttribute('pattern', '[0-9]*'); i.setAttribute('maxlength', '6'); i.classList.add('mono'); });
      const offU = wireFormUx(m.body);
      const pl = liveForm(f, {
        pin: (v) => (!/^\d{4,6}$/.test(v) ? 'El PIN debe tener de 4 a 6 dígitos.' : ''),
        pin2: (v, d) => (!v ? 'Repite tu PIN.' : v !== d.pin ? 'Los PIN no coinciden.' : '')
      }, { pin: ['pin2'] });
      f.addEventListener('input', (e) => { const t = e.target; const c = t.value.replace(/\D/g, '').slice(0, 6); if (c !== t.value) t.value = c; });
      f.addEventListener('submit', (e) => { e.preventDefault(); const b = m.foot.querySelector('.btn-primary'); if (b) b.click(); });
      setTimeout(() => { const i = $('#pfPin1', m.body); if (i) i.focus(); }, 80);
      const save = async () => {
        if (!pl.validate()) return false;
        const pin = formData(f).pin;
        try {
          const st = await api.patch('/staff/' + staff.id, { pin });
          Object.assign(staff, st);
          if (ctx && ctx.staff) ctx.staff.has_pin = st.has_pin;
          $('#pfPin', el).innerHTML = String(pinRow());
          m.close(true);
          toast.success('PIN guardado. Úsalo en «PIN del equipo» para entrar.');
        } catch (err) {
          if (err.fields && err.fields.pin) pl.setError('pin', err.fields.pin);
          else toast.error(err);
        }
        return false;
      };
      m.done.then(() => { offU(); pl.destroy(); });
    };

    // ── Contraseña ──
    const pwForm = $('#pfPw', el);
    if (pwForm) {
      const pLive = liveForm(pwForm, {
        current: (v) => (!v ? 'Escribe tu contraseña actual.' : ''),
        next: (v, d) => rules.password(v) || (v === d.current ? 'La nueva contraseña debe ser distinta a la actual.' : ''),
        next2: (v, d) => (!v ? 'Repite la nueva contraseña.' : v !== d.next ? 'Las contraseñas no coinciden.' : '')
      }, { next: ['next2'], current: ['next'] });
      lives.push(pLive);
      pwForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearFieldErrors(pwForm);
        if (!pLive.validate(['current', 'next', 'next2'])) return;
        const d = formData(pwForm);
        const btn = pwForm.querySelector('[type=submit]');
        try {
          await busy(btn, api.post('/auth/password', { current: d.current, next: d.next }));
          pwForm.reset();
          pLive.reset();
          $$('[data-meter]', pwForm).forEach((mt) => { mt.dataset.l = '0'; });
          $$('[data-pwlabel]', pwForm).forEach((l) => { l.textContent = 'Mínimo 8 caracteres'; });
          $$('[data-eye]', pwForm).forEach((b) => { const i = $('#' + b.dataset.eye, pwForm); if (i && i.type === 'text') b.click(); });
          toast.success('Contraseña actualizada. Cerramos tu sesión en tus otros dispositivos.');
        } catch (err) { applyApiErrors(pwForm, pLive, err); }
      });
    }

    // ── Acciones ──
    offs.push(on(el, 'click', '[data-act]', async (e, b) => {
      const act = b.dataset.act;
      if (act === 'pin') return openPin();
      if (act === 'pin-off') {
        const ok = await confirmDialog({ title: '¿Quitar tu PIN?', message: 'Ya no podrás entrar con PIN en la tablet de la barbería; solo con tu correo y contraseña.', confirmText: 'Quitar PIN', danger: true, icon: 'key' });
        if (!ok) return;
        try {
          const st = await busy(b, api.patch('/staff/' + staff.id, { pin: null }));
          Object.assign(staff, st);
          if (ctx && ctx.staff) ctx.staff.has_pin = st.has_pin;
          $('#pfPin', el).innerHTML = String(pinRow());
          toast.success('Quitamos tu PIN');
        } catch (err) { toast.error(err); }
        return;
      }
      if (act === 'logout') {
        const ok = await confirmDialog({ title: '¿Cerrar sesión?', message: pinSession ? 'Para volver a entrar necesitarás tu PIN.' : 'Para volver a entrar necesitarás tu correo y contraseña.', confirmText: 'Cerrar sesión', icon: 'logout' });
        if (!ok) return;
        await busy(b, api.post('/auth/logout').catch(() => null));
        clearSession();
        toast.success('Sesión cerrada');
        location.hash = '#/login';
        return;
      }
      if (act === 'to-login') {
        e.preventDefault();
        const ok = await confirmDialog({ title: '¿Entrar con tu correo?', message: 'Cerraremos tu sesión con PIN para que entres con tu correo y contraseña.', confirmText: 'Continuar', icon: 'mail' });
        if (!ok) return;
        try { await api.post('/auth/logout'); } catch (x) { /* */ }
        clearSession();
        location.hash = '#/login';
      }
    }));
    offs.push(on(el, 'click', '[data-theme-k]', (e, b) => {
      const t = b.dataset.themeK;
      window.TB.setTheme(t);
      $$('[data-theme-k]', el).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      syncShellTheme(t);
      toast.success('Tema ' + THEME_LABEL[t]);
    }));

    // ── Versión ──
    Promise.all([health().catch(() => null), swVersion()]).then(([h, sw]) => {
      if (gone) return;
      const v = $('#pfVer', el);
      if (!v) return;
      const parts = [];
      if (h && h.version) parts.push('v' + h.version);
      if (sw) parts.push('app ' + sw);
      v.textContent = parts.join(' · ') || 'v2';
    });

    return () => {
      gone = true;
      offs.forEach((f) => f());
      lives.forEach((l) => l.destroy());
      dForm.removeEventListener('input', onDataInput);
      phoneIn.removeEventListener('blur', onPhoneBlur);
    };
  }
};
