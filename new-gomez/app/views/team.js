// Equipo (#/equipo, solo dueño): tarjetas por barbero con color, rol, comisión, reserva en línea, acceso y
// estado. Alta/edición en hoja (perfil, color, comisión, reserva en línea, PIN y acceso con correo),
// desactivar/reactivar con confirmación y enlace a su horario.
import { html, raw, $, on, formData } from '../lib/html.js';
import { icon } from '../lib/icons.js';
import { api } from '../lib/api.js';
import { bus, me } from '../lib/state.js';
import { navigate } from '../lib/router.js';
import { toast, modal, confirmDialog, menu, busy, skeletonCards, emptyState, errorState, avatar, showFieldErrors, clearFieldErrors } from '../lib/ui.js';
import { phone as fmtPhone, firstName, plural, pct, ROLE } from '../lib/fmt.js';

// Paleta de 8 (la misma familia sobria que asigna el servidor).
const SWATCHES = ['#c8a24a', '#4f7cac', '#3e8e7e', '#b5654a', '#8e6c8a', '#6b7a8f', '#5e8c61', '#c27c8e'];

const CSS = `
.tm-grid{display:grid;gap:14px;grid-template-columns:minmax(0,1fr)}
@media (min-width:640px){.tm-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (min-width:1200px){.tm-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
.tm-card{position:relative;overflow:hidden;display:flex;flex-direction:column;transition:border-color .15s,box-shadow .2s,transform .2s var(--ease)}
.tm-card:hover{box-shadow:var(--shadow-2);border-color:var(--border-strong)}
.tm-card::before{content:"";position:absolute;inset:0 0 auto;height:4px;background:var(--c)}
.tm-top{display:flex;gap:12px;align-items:center;padding:18px 12px 12px 18px}
.tm-top .avatar{--s:52px;box-shadow:0 0 0 3px var(--surface),0 0 0 5px var(--border-strong);box-shadow:0 0 0 3px var(--surface),0 0 0 5px color-mix(in srgb,var(--c) 35%,transparent)}
.tm-name{font-weight:700;font-size:16.5px;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tm-badges{display:flex;gap:5px;flex-wrap:wrap;margin-top:5px}
.tm-bio.faint{color:var(--text-3)}
.tm-bio{padding:0 18px 12px;font-size:13px;color:var(--text-2);min-height:calc(2.9em + 12px);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.tm-facts{display:grid;grid-template-columns:1fr 1fr;margin:0 18px;border:1px solid var(--border);border-radius:var(--r);overflow:hidden;background:var(--border);gap:1px}
.tm-facts>div{background:var(--surface-2);padding:10px 12px;min-width:0}
.tm-facts dt{font-size:11.5px;color:var(--text-3);font-weight:500;display:flex;align-items:center;gap:4px}
.tm-facts dt .ic{width:13px;height:13px}
.tm-facts dd{font-weight:600;font-size:14px;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tm-facts dd.big{font-family:var(--disp);font-size:22px;font-weight:800;line-height:1.1}
.tm-facts dd small{display:block;font-weight:500;font-size:12px;color:var(--text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tm-book{margin:10px 18px 0;padding:6px 0;justify-content:space-between;width:calc(100% - 36px);border-top:1px solid var(--border);padding-top:10px}
.tm-book .lbl{display:grid;font-weight:500}
.tm-book .lbl small{color:var(--text-3);font-size:12px;font-weight:400}
.tm-foot{display:flex;gap:8px;padding:12px 18px 16px;margin-top:auto}
.tm-foot .btn{flex:1}
.tm-off{opacity:.78}
.tm-off::before{background:var(--border-strong)}
.tm-off .avatar{filter:grayscale(.85)}
.tm-invite{display:grid;gap:12px;justify-items:start;padding:22px;border:1.5px dashed var(--border-strong);border-radius:var(--r-lg);background:var(--surface-2)}
@media (min-width:640px){.tm-invite{grid-template-columns:auto 1fr auto;align-items:center}}
.tm-invite .art{width:52px;height:52px;border-radius:16px;background:var(--brand-soft);color:var(--brand-strong);display:grid;place-items:center}
.tm-invite .art .ic{width:26px;height:26px}
.tm-inactive summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:8px;min-height:44px;font-weight:600;font-size:15px;color:var(--text-2)}
.tm-inactive summary::-webkit-details-marker{display:none}
.tm-inactive summary .ic{transition:transform .2s var(--ease)}
.tm-inactive[open] summary .ic{transform:rotate(180deg)}
/* formulario */
#sfForm .field{align-content:start}
.sf-sec{display:grid;gap:14px;padding:16px 0;border-top:1px solid var(--border)}
.sf-sec:first-child{border-top:0;padding-top:4px}
.sf-sec>h4{font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text-3)}
.sf-preview{display:flex;align-items:center;gap:12px;padding:12px;border-radius:var(--r);background:var(--surface-2);border:1px solid var(--border)}
.sf-preview .avatar{--s:48px;transition:background .2s}
.sf-sw{display:grid;grid-template-columns:repeat(9,minmax(0,1fr));gap:4px;justify-items:center;max-width:420px}
.sf-sw label{position:relative;width:100%;max-width:44px;height:44px;border-radius:50%;cursor:pointer;display:grid;place-items:center}
.sf-sw label input{position:absolute;opacity:0;width:1px;height:1px}
.sf-sw label span{width:30px;height:30px;border-radius:50%;background:var(--sw);box-shadow:inset 0 0 0 1px rgba(0,0,0,.12);transition:transform .15s var(--ease-out),box-shadow .15s;display:grid;place-items:center;color:#fff}
.sf-sw label span .ic{width:16px;height:16px;stroke-width:3;opacity:0;transition:opacity .15s}
.sf-sw label:hover span{transform:scale(1.08)}
.sf-sw input:checked+span{box-shadow:0 0 0 3px var(--surface),0 0 0 5px var(--sw)}
.sf-sw input:checked+span .ic{opacity:1}
.sf-sw input:focus-visible+span{outline:2.5px solid var(--brand);outline-offset:4px}
.sf-sw .custom span{background:conic-gradient(from 90deg,#c8a24a,#b5654a,#c27c8e,#8e6c8a,#4f7cac,#3e8e7e,#5e8c61,#c8a24a)}
.sf-sw .custom input[type=color]{position:absolute;inset:0;opacity:0;width:100%;height:100%;cursor:pointer}
.sf-comm{display:grid;grid-template-columns:1fr 96px;gap:12px;align-items:center}
.sf-comm input[type=range]{width:100%;accent-color:var(--brand);height:28px}
.sf-comm .input-wrap{position:relative}
.sf-comm .input-wrap .input{padding-right:30px;text-align:right;font-variant-numeric:tabular-nums}
.sf-comm .input-wrap span{position:absolute;right:12px;top:50%;transform:translateY(-50%);color:var(--text-3);pointer-events:none}
.sf-row-switch{display:flex;justify-content:space-between;gap:12px;padding:10px 12px;border:1px solid var(--border);border-radius:var(--r);background:var(--surface-2);font-weight:400!important;font-size:14px!important}
.sf-row-switch .lbl{display:grid;font-weight:600}
.sf-row-switch .lbl small{font-weight:400}
.sf-seg button{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:40px}
.sf-seg button .ic{width:16px;height:16px}
.sf-row-switch small{font-size:12.5px;color:var(--text-3)}
.sf-pin{position:relative}
.sf-pin .input{padding-right:48px;letter-spacing:.3em;font-variant-numeric:tabular-nums}
.sf-pin .input::placeholder{letter-spacing:normal}
.sf-pin button{position:absolute;right:4px;top:50%;transform:translateY(-50%)}
.sf-acc{display:flex;gap:10px;align-items:center;padding:10px 12px;border-radius:var(--r);background:var(--ok-soft);color:var(--ok);font-size:13.5px}
.sf-acc .grow{color:var(--text)}
`;
function injectCss() { if (!document.getElementById('st-team')) document.head.insertAdjacentHTML('beforeend', '<style id="st-team">' + CSS + '</style>'); }

function accessText(s) {
  if (s.email && s.has_pin) return { t: 'Correo y PIN', s: s.email, ic: 'key' };
  if (s.email) return { t: 'Con correo', s: s.email, ic: 'mail' };
  if (s.has_pin) return { t: 'Con PIN', s: 'Entra en la tablet del local', ic: 'lock' };
  return { t: 'Sin acceso', s: 'Aún no puede entrar', ic: 'lock' };
}

// ── Hoja de alta / edición ───────────────────────────────────────────────
function openStaffForm(staff, used) {
  const isNew = !staff;
  const taken = new Set((used || []).map((c) => String(c || '').toLowerCase()));
  const s = staff || { role: 'barber', bookable: true, commission_pct: 50, color: SWATCHES.find((c) => !taken.has(c)) || SWATCHES[0] };
  const isMe = !!(me() && staff && me().id === staff.id);
  const color = (s.color || SWATCHES[0]).toLowerCase();
  const custom = !SWATCHES.includes(color);
  const body = html`
    <form id="sfForm" novalidate autocomplete="off">
      <div class="sf-sec">
        <div class="sf-preview"><span id="sfAv">${avatar(s.name || '?', { color, size: 'lg' })}</span>
          <div class="grow"><b id="sfPrevName">${s.name || 'Nuevo integrante'}</b><div class="muted" id="sfPrevRole" style="font-size:13px">${ROLE[s.role] || 'Barbero'}</div></div></div>
        <div class="field"><label for="sfName">Nombre</label>
          <input class="input" id="sfName" name="name" maxlength="60" autocapitalize="words" placeholder="p. ej. Luis Hernández" value="${s.name || ''}"/>
          <p class="error">Escribe el nombre.</p></div>
        <div class="field"><span class="label" id="sfRoleL">Rol</span>
          <div class="seg sf-seg" role="radiogroup" aria-labelledby="sfRoleL" style="width:100%">
            <button type="button" role="radio" data-role="barber" aria-pressed="${String(s.role !== 'owner')}" aria-checked="${String(s.role !== 'owner')}" style="flex:1" ${isMe ? raw('disabled') : ''}>${raw(icon('scissors', 'ic-sm'))} Barbero</button>
            <button type="button" role="radio" data-role="owner" aria-pressed="${String(s.role === 'owner')}" aria-checked="${String(s.role === 'owner')}" style="flex:1" ${isMe ? raw('disabled') : ''}>${raw(icon('crown', 'ic-sm'))} Dueño</button>
          </div>
          <input type="hidden" name="role" value="${s.role === 'owner' ? 'owner' : 'barber'}"/>
          <p class="hint" id="sfRoleHint">${s.role === 'owner' ? 'Ve todo el negocio: ingresos, caja, reportes, equipo y ajustes.' : 'Ve su agenda, sus clientes, su horario y lo que lleva ganado.'}</p>
          <p class="error">Elige un rol.</p></div>
        <div class="field"><span class="label" id="sfColL">Color en la agenda</span>
          <div class="sf-sw" role="radiogroup" aria-labelledby="sfColL">
            ${SWATCHES.map((c, i) => html`<label style="--sw:${c}" title="Color ${i + 1}"><input type="radio" name="color" value="${c}" ${c === color ? 'checked' : ''} aria-label="Color ${i + 1}"/><span>${raw(icon('check'))}</span></label>`)}
            <label class="custom" style="--sw:${custom ? color : '#8C8577'}" title="Elegir otro color"><input type="radio" name="color" value="${custom ? color : ''}" id="sfCustomR" ${custom ? 'checked' : ''} aria-label="Color personalizado"/><span>${raw(icon('plus'))}</span><input type="color" id="sfCustom" value="${custom ? color : '#8c8577'}" aria-label="Elegir color personalizado" tabindex="-1"/></label>
          </div>
          <p class="error">Elige un color.</p></div>
      </div>
      <div class="sf-sec">
        <h4>Agenda y comisión</h4>
        <div class="field"><label for="sfCommN">Comisión por servicio</label>
          <div class="sf-comm"><input type="range" id="sfCommR" min="0" max="100" step="1" value="${Number(s.commission_pct) || 0}" aria-label="Comisión en porcentaje"/>
            <div class="input-wrap"><input class="input" id="sfCommN" name="commission_pct" type="number" inputmode="decimal" min="0" max="100" step="0.5" value="${Number(s.commission_pct) || 0}"/><span>%</span></div></div>
          <p class="hint" id="sfCommHint"></p>
          <p class="error">La comisión debe ser de 0 a 100%.</p></div>
        <div class="field"><label class="switch sf-row-switch" for="sfBook"><span class="lbl">Recibe reservas en línea<small>Aparece para que los clientes lo elijan en tu página de reservas.</small></span>
          <input type="checkbox" id="sfBook" name="bookable" ${s.bookable !== false ? 'checked' : ''}/><span class="track"></span></label></div>
        <div class="field"><label for="sfPhone">Teléfono <span class="opt">(opcional)</span></label>
          <input class="input" id="sfPhone" name="phone" type="tel" inputmode="tel" maxlength="20" placeholder="669 123 4567" value="${s.phone ? fmtPhone(s.phone) : ''}"/>
          <p class="error">Escribe un teléfono de 10 dígitos.</p></div>
        <div class="field"><label for="sfBio">Presentación <span class="opt">(la ven tus clientes)</span></label>
          <textarea class="textarea" id="sfBio" name="bio" maxlength="300" style="min-height:72px" placeholder="p. ej. Especialista en fades y diseños. 8 años de experiencia.">${s.bio || ''}</textarea>
          <p class="error">Máximo 300 caracteres.</p></div>
      </div>
      <div class="sf-sec">
        <h4>Acceso a la app</h4>
        <div class="field"><label for="sfPin">PIN rápido <span class="opt">(4 a 6 dígitos)</span>${s.has_pin ? html` <span class="badge ok" style="margin-left:4px">Configurado</span>` : ''}</label>
          <div class="sf-pin"><input class="input" id="sfPin" name="pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="new-password" placeholder="${s.has_pin ? 'Nuevo PIN' : 'p. ej. 4821'}"/>
            <button type="button" class="btn btn-ghost btn-icon btn-sm" data-eye="sfPin" aria-label="Mostrar PIN">${raw(icon('eye', 'ic-sm'))}</button></div>
          <p class="hint">${s.has_pin ? 'Ya tiene PIN. Escribe uno nuevo solo si quieres cambiarlo.' : 'Para entrar rápido desde la tablet o el celular de la barbería. Déjalo vacío si no lo necesita.'}</p>
          ${s.has_pin ? html`<label class="check" style="min-height:32px"><input type="checkbox" name="pin_remove"/>Quitar su PIN</label>` : ''}
          <p class="error">El PIN debe tener de 4 a 6 dígitos.</p></div>
        ${s.email ? html`<div class="sf-acc">${raw(icon('check-circle'))}<div class="grow">Entra con <b>${s.email}</b></div>${isMe ? '' : html`<button type="button" class="btn btn-ghost btn-sm" data-acc="change">Cambiar</button>`}</div>` : ''}
        <div id="sfAccFields" class="stack" ${s.email ? 'hidden' : ''}>
          <div class="field"><label for="sfEmail">Correo para entrar <span class="opt">(opcional)</span></label>
            <input class="input" id="sfEmail" name="email" type="email" inputmode="email" autocapitalize="none" maxlength="160" placeholder="nombre@correo.com" value="${s.email || ''}"/>
            <p class="error">Escribe un correo válido.</p></div>
          <div class="field"><label for="sfPw">Contraseña</label>
            <div class="sf-pin"><input class="input" id="sfPw" name="password" type="password" autocomplete="new-password" maxlength="100" placeholder="Mínimo 8 caracteres" style="letter-spacing:normal"/>
              <button type="button" class="btn btn-ghost btn-icon btn-sm" data-eye="sfPw" aria-label="Mostrar contraseña">${raw(icon('eye', 'ic-sm'))}</button></div>
            <p class="hint">Si ese correo ya tiene cuenta en TuBarbería, se vincula y conserva su contraseña.</p>
            <p class="error">Revisa la contraseña.</p></div>
          ${s.email && !isMe ? html`<button type="button" class="btn btn-danger-ghost btn-sm" data-acc="remove" style="justify-self:start">${raw(icon('x'))}Quitar acceso con correo</button>` : ''}
        </div>
      </div>
    </form>`;
  const m = modal({
    title: isNew ? 'Agregar al equipo' : 'Editar a ' + firstName(s.name),
    subtitle: isNew ? 'Se le asigna el horario de la barbería; luego puedes ajustarlo.' : '',
    size: 'lg',
    body,
    actions: [
      { label: 'Cancelar', variant: 'secondary', value: null },
      { label: isNew ? 'Agregar' : 'Guardar cambios', variant: 'primary', type: 'submit', form: 'sfForm', icon: 'check' }
    ]
  });
  const form = $('#sfForm', m.body);
  let removeAccount = false;
  const curColor = () => { const r = form.querySelector('input[name=color]:checked'); return (r && r.value) || '#8c8577'; };
  const paintPreview = () => {
    const name = form.elements.name.value.trim();
    $('#sfAv', m.body).innerHTML = String(avatar(name || '?', { color: curColor(), size: 'lg' }));
    $('#sfPrevName', m.body).textContent = name || 'Nuevo integrante';
    $('#sfPrevRole', m.body).textContent = (ROLE[form.elements.role.value] || '') + ' · ' + pct(Number(form.elements.commission_pct.value) || 0) + ' de comisión';
  };
  const paintComm = () => {
    const v = Number(form.elements.commission_pct.value) || 0;
    $('#sfCommHint', m.body).textContent = v ? 'De un corte de $200, le tocan $' + Math.round(200 * v / 100) + '.' : 'Sin comisión (por ejemplo, si es el dueño o tiene sueldo fijo).';
  };
  paintPreview(); paintComm();
  m.body.addEventListener('input', (e) => {
    const f = e.target.closest('.field'); if (f) f.classList.remove('invalid');
    if (e.target.id === 'sfCommR') form.elements.commission_pct.value = e.target.value;
    if (e.target.id === 'sfCommN') $('#sfCommR', m.body).value = e.target.value;
    if (e.target.id === 'sfCustom') { const r = $('#sfCustomR', m.body); r.value = e.target.value; r.checked = true; r.closest('label').style.setProperty('--sw', e.target.value); }
    if (e.target.id === 'sfPin') e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
    paintPreview(); paintComm();
  });
  m.body.addEventListener('change', () => paintPreview());
  m.body.addEventListener('click', (e) => {
    const rb = e.target.closest('[data-role]');
    if (rb && !rb.disabled) {
      const r = rb.dataset.role;
      form.elements.role.value = r;
      m.body.querySelectorAll('[data-role]').forEach((x) => { x.setAttribute('aria-pressed', String(x === rb)); x.setAttribute('aria-checked', String(x === rb)); });
      $('#sfRoleHint', m.body).textContent = r === 'owner' ? 'Ve todo el negocio: ingresos, caja, reportes, equipo y ajustes.' : 'Ve su agenda, sus clientes, su horario y lo que lleva ganado.';
      if (isNew && r === 'owner' && Number(form.elements.commission_pct.value) === 50) { form.elements.commission_pct.value = 0; $('#sfCommR', m.body).value = 0; }
      paintPreview(); paintComm();
    }
    const eye = e.target.closest('[data-eye]');
    if (eye) { const i = $('#' + eye.dataset.eye, m.body); i.type = i.type === 'password' ? 'text' : 'password'; eye.setAttribute('aria-label', i.type === 'password' ? 'Mostrar' : 'Ocultar'); }
    const ac = e.target.closest('[data-acc]');
    if (ac && ac.dataset.acc === 'change') { $('#sfAccFields', m.body).hidden = false; ac.closest('.sf-acc').hidden = true; $('#sfEmail', m.body).focus(); }
    if (ac && ac.dataset.acc === 'remove') {
      removeAccount = !removeAccount;
      ac.innerHTML = removeAccount ? icon('refresh') + 'Conservar su acceso' : icon('x') + 'Quitar acceso con correo';
      $('#sfEmail', m.body).disabled = removeAccount; $('#sfPw', m.body).disabled = removeAccount;
      if (removeAccount) toast.info('Al guardar, ya no podrá entrar con ' + s.email + '.');
    }
  });

  return new Promise((resolve) => {
    let saved = null;
    m.done.then(() => resolve(saved));
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearFieldErrors(form);
      const d = formData(form);
      const name = (d.name || '').trim();
      if (name.length < 2) { showFieldErrors(form, { fields: { name: name ? 'El nombre debe tener al menos 2 letras.' : 'Escribe el nombre.' } }); return; }
      const pin = (d.pin || '').trim();
      if (pin && !/^\d{4,6}$/.test(pin)) { showFieldErrors(form, { fields: { pin: 'El PIN debe tener de 4 a 6 dígitos.' } }); return; }
      const comm = Number(d.commission_pct);
      if (!Number.isFinite(comm) || comm < 0 || comm > 100) { showFieldErrors(form, { fields: { commission_pct: 'La comisión debe ser de 0 a 100%.' } }); return; }
      const email = (d.email || '').trim().toLowerCase();
      const password = d.password || '';
      if (email && password && password.length < 8) { showFieldErrors(form, { fields: { password: 'La contraseña debe tener al menos 8 caracteres.' } }); return; }
      const payload = { name, role: d.role, color: curColor(), commission_pct: comm, bookable: !!d.bookable, phone: (d.phone || '').trim(), bio: d.bio || '' };
      if (isMe) delete payload.role;
      if (pin) payload.pin = pin; else if (d.pin_remove) payload.pin = null;
      const btn = m.foot.querySelector('[type=submit]');
      try {
        let done = false;
        await busy(btn, async () => {
          if (isNew) {
            if (email) { payload.email = email; if (password) payload.password = password; }
            saved = await api.post('/staff', payload);
          } else {
            // Primero el perfil; si luego falla el acceso, el perfil ya quedó guardado (la lista se refresca al cerrar).
            saved = await api.patch('/staff/' + encodeURIComponent(s.id), payload);
            const accOpen = !$('#sfAccFields', m.body).hidden;
            if (removeAccount) saved = await api.post('/staff/' + encodeURIComponent(s.id) + '/account', { remove: true });
            else if (accOpen && email && (email !== (s.email || '') || password)) {
              saved = await api.post('/staff/' + encodeURIComponent(s.id) + '/account', password ? { email, password } : { email });
            }
          }
          done = true;
        });
        if (!done) return;
        bus.emit('staff:changed');
        const fn = firstName(saved.name);
        const acc = saved.account === 'created' ? ' Ya puede entrar con ' + saved.email + '.' : saved.account === 'linked' ? ' Se vinculó su cuenta ' + saved.email + '.' : saved.account === 'removed' ? ' Ya no entra con correo.' : '';
        toast.success((isNew ? fn + ' se unió al equipo.' : 'Cambios de ' + fn + ' guardados.') + acc);
        m.close(saved);
      } catch (err) {
        if (saved && !isNew) { s.name = saved.name; }
        showFieldErrors(form, err);
      }
    });
  });
}

// ── Vista ────────────────────────────────────────────────────────────────
export default {
  title: 'Equipo',
  async render(el) {
    injectCss();
    let team = [];
    el.innerHTML = String(html`
      <div class="page-head">
        <div><h2>Equipo</h2><p id="tmSub">Quién atiende, cuánto gana y cómo entra a la app.</p></div>
        <div class="actions"><button type="button" class="btn btn-primary" id="tmNew">${raw(icon('user-plus'))}Agregar barbero</button></div>
      </div>
      <div id="tmRoot"><div class="tm-grid">${skeletonCards(3, 250)}</div></div>`);
    const root = $('#tmRoot', el);

    function card(s) {
      const a = accessText(s);
      const isMe = !!(me() && me().id === s.id);
      return html`<article class="card tm-card ${s.active ? '' : 'tm-off'}" style="--c:${s.color || '#8C8577'}" data-id="${s.id}">
        <div class="tm-top">
          ${avatar(s.name, { color: s.color || undefined, src: s.avatar_url || '' })}
          <div class="grow" style="min-width:0">
            <div class="tm-name">${s.name}</div>
            <div class="tm-badges">
              <span class="badge plain ${s.role === 'owner' ? 'brand' : ''}">${s.role === 'owner' ? raw(icon('crown', 'ic-sm')) : ''}${ROLE[s.role] || s.role}</span>
              ${isMe ? html`<span class="badge info plain">Tú</span>` : ''}
              ${s.active ? '' : html`<span class="badge plain">Desactivado</span>`}
            </div>
          </div>
          <button type="button" class="btn btn-ghost btn-icon" data-menu="${s.id}" aria-label="Más acciones para ${s.name}" aria-haspopup="menu">${raw(icon('more-v'))}</button>
        </div>
        <p class="tm-bio ${s.bio ? '' : 'faint'}">${s.bio || (s.active ? 'Sin presentación. Agrégala para que tus clientes lo conozcan al reservar.' : 'Sin presentación.')}</p>
        <dl class="tm-facts">
          <div><dt>${raw(icon('percent'))}Comisión</dt><dd class="big">${pct(Number(s.commission_pct) || 0)}</dd></div>
          <div><dt>${raw(icon(a.ic))}Acceso</dt><dd>${a.t}<small title="${a.s}">${a.s}</small></dd></div>
        </dl>
        ${s.active ? html`<label class="switch tm-book"><span class="lbl">Recibe reservas en línea<small>${s.bookable ? 'Visible en tu página de reservas' : 'Oculto en tu página de reservas'}</small></span>
          <input type="checkbox" data-book="${s.id}" ${s.bookable ? 'checked' : ''} aria-label="${s.name} recibe reservas en línea"/><span class="track"></span></label>` : ''}
        <div class="tm-foot">
          ${s.active
            ? html`<button type="button" class="btn btn-secondary btn-sm" data-edit="${s.id}">${raw(icon('edit'))}Editar</button>
                   <a class="btn btn-ghost btn-sm" href="#/horarios?barbero=${encodeURIComponent(s.id)}">${raw(icon('clock'))}Horario</a>`
            : html`<button type="button" class="btn btn-secondary btn-sm" data-reactivate="${s.id}">${raw(icon('refresh'))}Reactivar</button>`}
        </div>
      </article>`;
    }

    function paint() {
      const active = team.filter((s) => s.active);
      const inactive = team.filter((s) => !s.active);
      const barbers = active.filter((s) => s.role === 'barber');
      const online = active.filter((s) => s.bookable).length;
      $('#tmSub', el).textContent = plural(active.length, 'persona activa', 'personas activas') + ' · ' + plural(online, 'recibe', 'reciben') + ' reservas en línea';
      root.innerHTML = String(html`
        ${!barbers.length ? html`<div class="tm-invite fade-up" style="margin-bottom:16px">
            <span class="art">${raw(icon('scissors'))}</span>
            <div><b style="font-size:16px">Agrega a tu primer barbero</b><p class="muted" style="font-size:14px;margin-top:2px">Tendrá su propia agenda, su horario y su comisión. Tus clientes podrán elegirlo al reservar.</p></div>
            <button type="button" class="btn btn-primary" data-new>${raw(icon('user-plus'))}Agregar barbero</button>
          </div>` : ''}
        <div class="tm-grid stagger">${active.map(card)}</div>
        ${inactive.length ? html`<details class="section tm-inactive">
            <summary>${raw(icon('chevron-down', 'ic-sm'))}Desactivados · ${inactive.length}</summary>
            <p class="faint" style="font-size:13px;margin:0 0 12px">Sus citas, pagos y comisiones se conservan. Reactívalos cuando regresen.</p>
            <div class="tm-grid">${inactive.map(card)}</div>
          </details>` : ''}`);
    }

    async function load() {
      try {
        team = await api.get('/staff', { all: 1 });
        paint();
      } catch (e) {
        root.innerHTML = String(errorState(e, 'tmRetry'));
      }
    }
    const find = (id) => team.find((s) => s.id === id);
    async function edit(s) {
      const r = await openStaffForm(s || null, team.filter((x) => x.active).map((x) => x.color));
      if (r) { await load(); const c = root.querySelector('[data-id="' + r.id + '"]'); if (c) { c.classList.add('flash'); c.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } }
    }
    async function deactivate(s) {
      const ok = await confirmDialog({
        title: '¿Desactivar a ' + s.name + '?',
        message: 'Ya no aparecerá en la agenda ni en la reserva en línea, y no podrá entrar a la app. Sus citas, pagos y comisiones se conservan; puedes reactivarlo cuando quieras.',
        confirmText: 'Desactivar', danger: true, icon: 'ban'
      });
      if (!ok) return;
      try {
        const r = await api.del('/staff/' + encodeURIComponent(s.id));
        bus.emit('staff:changed');
        if (r && r.upcoming_appointments) {
          toast.info(firstName(s.name) + ' tiene ' + plural(r.upcoming_appointments, 'cita próxima', 'citas próximas') + ' a su nombre. Reasígnalas desde la agenda.', { duration: 9000, action: { label: 'Ir a la agenda', onClick: () => navigate('/agenda') } });
        } else toast.success(firstName(s.name) + ' quedó desactivado');
        load();
      } catch (e) { toast.error(e); }
    }
    async function reactivate(s, btn) {
      const ok = await confirmDialog({ title: '¿Reactivar a ' + s.name + '?', message: 'Volverá a aparecer en la agenda y en la reserva en línea con su horario anterior.', confirmText: 'Reactivar', icon: 'refresh' });
      if (!ok) return;
      try {
        await busy(btn, api.patch('/staff/' + encodeURIComponent(s.id), { active: true }));
        bus.emit('staff:changed');
        toast.success(firstName(s.name) + ' está activo de nuevo');
        load();
      } catch (e) { toast.error(e); }
    }

    const offs = [];
    offs.push(on(el, 'click', '#tmNew,[data-new]', () => edit(null)));
    offs.push(on(el, 'click', '#tmRetry', () => { root.innerHTML = String(html`<div class="tm-grid">${skeletonCards(3, 250)}</div>`); load(); }));
    offs.push(on(el, 'click', '[data-edit]', (e, b) => edit(find(b.dataset.edit))));
    offs.push(on(el, 'click', '[data-reactivate]', (e, b) => reactivate(find(b.dataset.reactivate), b)));
    offs.push(on(el, 'change', '[data-book]', async (e, inp) => {
      const s = find(inp.dataset.book);
      const val = inp.checked;
      inp.disabled = true;
      try {
        await api.patch('/staff/' + encodeURIComponent(s.id), { bookable: val });
        s.bookable = val;
        bus.emit('staff:changed');
        const small = inp.closest('label').querySelector('small');
        if (small) small.textContent = val ? 'Visible en tu página de reservas' : 'Oculto en tu página de reservas';
        toast.success(val ? firstName(s.name) + ' ya aparece en tu página de reservas' : firstName(s.name) + ' ya no aparece en la reserva en línea');
      } catch (err) { inp.checked = !val; toast.error(err); }
      finally { inp.disabled = false; }
    }));
    offs.push(on(el, 'click', '[data-menu]', (e, b) => {
      const s = find(b.dataset.menu);
      const isMe = !!(me() && me().id === s.id);
      menu(b, s.active ? [
        { label: 'Editar perfil y acceso', icon: 'edit', onClick: () => edit(s) },
        { label: 'Ver su horario', icon: 'clock', href: '#/horarios?barbero=' + encodeURIComponent(s.id) },
        { label: 'Ver su agenda', icon: 'calendar', href: '#/agenda?barbero=' + encodeURIComponent(s.id) },
        s.phone && { label: 'Llamar', icon: 'phone', href: 'tel:' + s.phone },
        !isMe && { sep: true },
        !isMe && { label: 'Desactivar', icon: 'ban', danger: true, onClick: () => deactivate(s) }
      ] : [
        { label: 'Reactivar', icon: 'refresh', onClick: () => reactivate(s, null) }
      ]);
    }));

    await load();
    return () => offs.forEach((f) => f());
  }
};
