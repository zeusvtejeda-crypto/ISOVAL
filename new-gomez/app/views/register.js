// #/registro — Cuenta de CLIENTE (POST /api/auth/register). Con ?b=<slug> la cuenta queda ligada a esa barbería
// (se muestra su nombre con GET /api/public/shops/:slug); sin ?b se usa la barbería del dominio (/api/public/home).
// Validación en vivo, mostrar/ocultar contraseña y, al terminar, entra (loadMe + selectShop) y va a #/mis-citas.
//
// También exporta piezas de formulario que comparten signup.js y profile.js:
//   ensureFormCss(), fieldHtml(o), pwFieldHtml(o), wireFormUx(root), liveForm(form, rules),
//   rules.{name,email,phone,password}, strengthOf(pw), slugify(s), DEMO_SLUGS, useDemoIfNeeded(slug), afterAuth(o)
import { html, raw, esc, $, on, formData } from '../lib/html.js';
import { icon } from '../lib/icons.js';
import { api, getMode, setMode, health, SITE_BASE } from '../lib/api.js';
import { state, loadMe, selectShop, clearSession } from '../lib/state.js';
import { toast, busy, showFieldErrors, clearFieldErrors, avatar } from '../lib/ui.js';
import { navigate } from '../lib/router.js';
import { phone as fmtPhone, firstName } from '../lib/fmt.js';

export const DEMO_SLUGS = ['demo', 'demo-norte'];
const MIN_PW = 8;

// ── Estilos compartidos de formularios de acceso (una sola vez) ─────────────
const FORM_CSS = `
.fx{position:relative}
.fx>.input{padding-right:44px}
.fx-btn{position:absolute;right:2px;top:50%;transform:translateY(-50%);width:44px;height:44px;display:grid;place-items:center;border-radius:10px;color:var(--text-3);transition:color .15s,background .15s}
.fx-btn:hover{color:var(--text);background:var(--muted-soft)}
.fx-btn .ic{width:19px;height:19px}
.fx-ok{position:absolute;right:13px;top:50%;width:18px;height:18px;margin-top:-9px;color:var(--ok);opacity:0;transform:scale(.5);transition:opacity .2s var(--ease),transform .3s var(--ease-out);pointer-events:none}
.fx-ok .ic{width:18px;height:18px;stroke-width:2.4}
.field.valid .fx-ok{opacity:1;transform:none}
.field.valid>.fx>.input,.field.valid>.input{border-color:var(--ok)}
.field.valid>.fx>.input:focus{box-shadow:0 0 0 3.5px var(--ok-soft)}
.field .error a{color:inherit;font-weight:700}
.pw-meter{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px;margin-top:2px}
.pw-meter i{height:4px;border-radius:999px;background:var(--surface-3);transition:background .3s var(--ease)}
.pw-meter[data-l="1"] i:nth-child(-n+1){background:var(--err)}
.pw-meter[data-l="2"] i:nth-child(-n+2){background:var(--warn)}
.pw-meter[data-l="3"] i:nth-child(-n+3){background:var(--brand)}
.pw-meter[data-l="4"] i{background:var(--ok)}
.pw-foot{display:flex;justify-content:space-between;gap:8px;font-size:12.5px;color:var(--text-3)}
.pw-foot b{font-weight:600;color:var(--text-2)}
.auth-top{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:44px}
.auth-top .brand{display:flex;align-items:center;gap:8px}
.auth-top .logo-mark{width:34px;height:34px;border-radius:10px}.auth-top .logo-mark svg{width:19px;height:19px}
.auth-top .brandname{font-size:19px}
.auth-back{min-height:44px;margin-left:-6px;padding:0 6px}
.auth-foot{font-size:13.5px;color:var(--text-2);text-align:center;margin-top:20px;line-height:1.9}
.auth-art .art-card{position:relative;margin-top:30px;max-width:440px;padding:18px;border-radius:20px;background:rgba(242,237,227,.05);border:1px solid rgba(242,237,227,.1);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
.auth-panel form .btn-lg{margin-top:4px}
.auth-legal{font-size:12.5px;color:var(--text-3);text-align:center;margin-top:12px}
`;
export function ensureFormCss() {
  if (!document.getElementById('st-authx')) document.head.insertAdjacentHTML('beforeend', '<style id="st-authx">' + FORM_CSS + '</style>');
}

// ── Piezas de formulario ─────────────────────────────────────────────────
// fieldHtml({ id, name, label, type, value, placeholder, autocomplete, inputmode, hint, optional, error, attrs, check })
export function fieldHtml(o) {
  return html`<div class="field">
    <label for="${o.id}">${o.label}${o.optional ? raw(' <span class="opt">(opcional)</span>') : ''}</label>
    <div class="fx"><input class="input" id="${o.id}" name="${o.name}" type="${o.type || 'text'}" value="${o.value == null ? '' : o.value}"
      ${raw(o.autocomplete ? 'autocomplete="' + esc(o.autocomplete) + '"' : '')} ${raw(o.inputmode ? 'inputmode="' + esc(o.inputmode) + '"' : '')}
      placeholder="${o.placeholder || ''}" ${raw(o.attrs || '')} aria-describedby="${o.id}-e${o.hint ? ' ' + o.id + '-h' : ''}"/>
      ${o.check === false ? '' : raw('<span class="fx-ok" aria-hidden="true">' + icon('check') + '</span>')}</div>
    ${o.hint ? html`<p class="hint" id="${o.id}-h">${o.hint}</p>` : ''}
    <p class="error" id="${o.id}-e" role="alert">${o.error || 'Revisa este dato.'}</p>
  </div>`;
}
// Contraseña con mostrar/ocultar y (opcional) medidor de seguridad.
export function pwFieldHtml(o) {
  return html`<div class="field">
    <label for="${o.id}">${o.label}</label>
    <div class="fx"><input class="input" id="${o.id}" name="${o.name}" type="password" autocomplete="${o.autocomplete || 'new-password'}"
      placeholder="${o.placeholder || ''}" autocapitalize="none" spellcheck="false" aria-describedby="${o.id}-e${o.meter ? ' ' + o.id + '-m' : ''}"/>
      <button type="button" class="fx-btn" data-eye="${o.id}" aria-label="Mostrar contraseña" aria-pressed="false">${raw(icon('eye'))}</button></div>
    ${o.meter ? html`<div class="pw-meter" data-meter="${o.id}" data-l="0" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
      <p class="pw-foot" id="${o.id}-m" aria-live="polite"><span data-pwlabel="${o.id}">Mínimo ${MIN_PW} caracteres</span><span data-pwcount="${o.id}"></span></p>` : ''}
    ${o.hint ? html`<p class="hint">${o.hint}</p>` : ''}
    <p class="error" id="${o.id}-e" role="alert">${o.error || 'Revisa este dato.'}</p>
  </div>`;
}

// Seguridad de la contraseña: 0 (vacía) … 4 (excelente).
export function strengthOf(pw) {
  pw = String(pw || '');
  if (!pw) return { level: 0, label: 'Mínimo ' + MIN_PW + ' caracteres' };
  if (pw.length < MIN_PW) return { level: 1, label: 'Muy corta' };
  let s = 1;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  if (/^(.)\1+$/.test(pw) || /^(12345678|password|contraseña|qwertyui)/i.test(pw)) s = 1;
  const level = Math.max(1, Math.min(4, s));
  return { level, label: ['', 'Débil', 'Aceptable', 'Buena', 'Excelente'][level] };
}

// Mostrar/ocultar contraseña y medidor en vivo (delegado en root). Devuelve función para quitar listeners.
export function wireFormUx(root) {
  const offs = [
    on(root, 'click', '[data-eye]', (e, b) => {
      const input = root.querySelector('#' + b.dataset.eye);
      if (!input) return;
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      b.setAttribute('aria-pressed', String(show));
      b.setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña');
      b.innerHTML = icon(show ? 'eye-off' : 'eye');
      input.focus({ preventScroll: true });
      try { const n = input.value.length; input.setSelectionRange(n, n); } catch (x) { /* */ }
    }),
    on(root, 'input', 'input[type=password],input[data-pw]', (e, input) => {
      const m = root.querySelector('[data-meter="' + input.id + '"]');
      if (!m) return;
      input.setAttribute('data-pw', '1');
      const st = strengthOf(input.value);
      m.dataset.l = String(st.level);
      const l = root.querySelector('[data-pwlabel="' + input.id + '"]');
      if (l) l.innerHTML = input.value ? 'Seguridad: <b>' + esc(st.label) + '</b>' : esc(st.label);
      const c = root.querySelector('[data-pwcount="' + input.id + '"]');
      if (c) c.textContent = input.value && input.value.length < MIN_PW ? 'Faltan ' + (MIN_PW - input.value.length) : '';
    })
  ];
  return () => offs.forEach((f) => f());
}

// ── Reglas de validación (mismos mensajes que el servidor) ──
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const digits = (v) => {
  let d = String(v || '').replace(/\D/g, '');
  if (d.length === 13 && d.startsWith('521')) d = d.slice(3);
  if (d.length === 12 && d.startsWith('52')) d = d.slice(2);
  return d;
};
export const rules = {
  name: (empty, max) => (v) => { v = String(v || '').trim(); return v.length < 2 ? (empty || 'Escribe tu nombre.') : v.length > (max || 120) ? 'Es demasiado largo (máximo ' + (max || 120) + ' caracteres).' : ''; },
  email: (v) => { v = String(v || '').trim(); return !v ? 'Escribe tu correo.' : !EMAIL_RE.test(v) || v.length > 160 ? 'Escribe un correo válido, por ejemplo nombre@correo.com.' : ''; },
  phone: (required) => (v) => { const d = digits(v); if (!d) return required ? 'Escribe un teléfono de 10 dígitos.' : ''; return d.length === 10 ? '' : 'El teléfono debe tener 10 dígitos.'; },
  password: (v) => { v = String(v || ''); return !v ? 'Escribe una contraseña.' : v.length < MIN_PW ? 'La contraseña debe tener al menos ' + MIN_PW + ' caracteres.' : v.length > 128 ? 'La contraseña es demasiado larga (máximo 128 caracteres).' : ''; }
};

// Validación en vivo: un campo se valida al salir de él y, desde entonces, mientras se escribe.
// rules: { name: (value, data) => '' | 'mensaje' }. deps: { campo: ['otro'] } revalida dependientes.
export function liveForm(form, ruleMap, deps) {
  const touched = new Set();
  const inputOf = (n) => form.querySelector('[name="' + n + '"]');
  const check = (n, show) => {
    const input = inputOf(n);
    if (!input || !ruleMap[n]) return true;
    const f = input.closest('.field');
    const msg = ruleMap[n](input.type === 'checkbox' ? input.checked : input.value, formData(form));
    if (f) {
      const err = f.querySelector('.error');
      if (msg && err) err.textContent = msg;
      if (show) {
        f.classList.toggle('invalid', !!msg);
        f.classList.toggle('valid', !msg && input.value !== '' && input.type !== 'password' && input.type !== 'checkbox');
        input.setAttribute('aria-invalid', String(!!msg));
      }
    }
    return !msg;
  };
  const onOut = (e) => { const n = e.target.name; if (!ruleMap[n] || (e.target.value === '' && !touched.has(n))) return; touched.add(n); check(n, true); };
  const onIn = (e) => {
    const n = e.target.name;
    if (ruleMap[n] && touched.has(n)) check(n, true);
    (deps && deps[n] || []).forEach((d) => { if (touched.has(d)) check(d, true); });
  };
  form.addEventListener('focusout', onOut);
  form.addEventListener('input', onIn);
  return {
    // Valida (y marca) los campos dados o todos; enfoca el primero con error. → true si todo bien.
    validate(names) {
      let first = null;
      for (const n of names || Object.keys(ruleMap)) { touched.add(n); if (!check(n, true) && !first) first = n; }
      if (first) {
        const i = inputOf(first); if (i) i.focus();
        const box = form; box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake');
      }
      return !first;
    },
    // Marca un error que vino del servidor en un campo (sin tocar los demás).
    setError(n, msg, htmlMsg) {
      const input = inputOf(n); const f = input && input.closest('.field');
      if (!f) return false;
      touched.add(n);
      f.classList.remove('valid'); f.classList.add('invalid');
      const err = f.querySelector('.error'); if (err) { if (htmlMsg) err.innerHTML = htmlMsg; else err.textContent = msg; }
      input.setAttribute('aria-invalid', 'true');
      input.focus();
      return true;
    },
    reset() { touched.clear(); form.querySelectorAll('.field').forEach((f) => f.classList.remove('invalid', 'valid')); },
    destroy() { form.removeEventListener('focusout', onOut); form.removeEventListener('input', onIn); }
  };
}

// Aplica los errores por campo de la API; los que no tienen campo en el formulario van a un toast.
export function applyApiErrors(form, live, err) {
  const fields = err && err.fields;
  let any = false;
  if (fields) for (const [k, msg] of Object.entries(fields)) { if (form.querySelector('[name="' + k + '"]')) { live.setError(k, typeof msg === 'string' ? msg : err.message); any = true; } }
  if (!any) toast.error(err);
  return any;
}

// Igual que el servidor (core/util.js → slugify), para la vista previa del enlace.
export function slugify(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40) || 'barberia';
}

// Las barberías de la demo solo existen dentro del navegador (su registro va al motor de la demo); las demás,
// en el servidor. Igual que la página pública de reservas.
export function useDemoIfNeeded(slug) {
  if (!slug) return;
  const want = DEMO_SLUGS.includes(String(slug).toLowerCase()) ? 'demo' : 'server';
  if (getMode() !== want) { setMode(want); state.mode = want; }
}

// Tras registro/alta (ya con loadMe hecho): elige la barbería y muestra la ruta de destino SIN pasar por el
// inicio (se fija el hash antes de que el shell reaccione al evento 'context').
export async function afterAuth({ shopId, path, query }) {
  const q = query ? '?' + new URLSearchParams(query).toString() : '';
  if (shopId) {
    history.replaceState(null, '', '#' + path + q);
    try { await selectShop(shopId); return true; }
    catch (e) { toast.error(e); navigate(window.TB.homePath(), { replace: true, force: true }); return false; }
  }
  navigate(window.TB.homePath(), { replace: true, force: true });
  return true;
}

const ART_CSS = `
.rg-shop{display:flex;align-items:center;gap:12px;padding:12px 14px;margin:18px 0 2px;border:1px solid var(--border);border-radius:var(--r-lg);background:var(--surface);box-shadow:var(--shadow-1);min-height:66px}
.rg-shop .avatar{--s:42px;border-radius:12px}
.rg-shop b{display:block;font-size:15px;line-height:1.25}
.rg-shop small{display:block;font-size:12.5px;color:var(--text-3)}
.rg-shop .skel-line{margin:4px 0}
.rg-art-shop{display:flex;align-items:center;gap:12px;margin-bottom:14px}
.rg-art-shop .avatar{--s:46px;border-radius:13px;box-shadow:0 0 0 1px rgba(217,178,90,.35)}
.rg-art-shop b{display:block;color:#F2EDE3;font-size:16px}.rg-art-shop small{color:#A39A88;font-size:12.5px}
.rg-tick{display:flex;gap:10px;align-items:center;color:#D9D3C6;font-size:14px;padding:7px 0;border-top:1px solid rgba(242,237,227,.08)}
.rg-art-shop:empty{display:none}
.rg-art-shop:empty+.rg-tick{border-top:0}
.rg-tick .ic{color:#D9B25A;width:18px;height:18px}
`;

export default {
  title: 'Crear cuenta',
  async render(el, { query, bare }) {
    ensureFormCss();
    if (!document.getElementById('st-register')) document.head.insertAdjacentHTML('beforeend', '<style id="st-register">' + ART_CSS + '</style>');
    let slug = String(query.b || '').trim().toLowerCase().slice(0, 60);
    useDemoIfNeeded(slug);
    const demo = getMode() === 'demo';
    let shopInfo = null; // { shop, services, staff }
    let gone = false;

    const backHref = slug ? SITE_BASE + '?b=' + encodeURIComponent(slug) : '#/login';
    el.innerHTML = String(html`
      <div class="auth">
        <section class="auth-art" aria-hidden="true">
          <div class="row"><span class="logo-mark">${raw(icon('logo'))}</span><span class="brandname" style="color:#F2EDE3">Tu<b style="color:#D9B25A">Barbería</b></span></div>
          <div>
            <h2 id="rgArtH">Tus citas,<br/><em>siempre a la mano.</em></h2>
            <p>Crea tu cuenta una vez y reserva, cambia o cancela sin tener que llamar ni esperar respuesta.</p>
            <div class="art-card">
              <div class="rg-art-shop" id="rgArtShop"></div>
              <div class="rg-tick">${raw(icon('calendar-check'))}Tus próximas citas con su folio</div>
              <div class="rg-tick">${raw(icon('repeat'))}Cambia la hora o cancela en un toque</div>
              <div class="rg-tick">${raw(icon('whatsapp'))}Confirmaciones y recordatorios por WhatsApp</div>
              <div class="rg-tick">${raw(icon('star'))}Tu historial de cortes, siempre guardado</div>
            </div>
          </div>
          <p style="font-size:13px;color:#8E8676">© TuBarbería</p>
        </section>
        <section class="auth-panel">
          <div class="auth-top">
            <a class="link-btn auth-back" href="${backHref}">${raw(icon('arrow-left', 'ic-sm'))}${slug ? 'Volver a reservar' : 'Volver'}</a>
            <span class="brand"><span class="logo-mark">${raw(icon('logo'))}</span><span class="brandname">Tu<b>Barbería</b></span></span>
          </div>
          <div id="rgShop" class="rg-shop" aria-live="polite">
            <div class="skel" style="width:42px;height:42px;border-radius:12px;flex:none"></div>
            <div class="grow"><div class="skel skel-line" style="width:60%"></div><div class="skel skel-line" style="width:40%;height:10px"></div></div>
          </div>
          <h1>Crea tu cuenta</h1>
          <p class="lead" id="rgLead">Para ver, cambiar o repetir tus citas desde cualquier celular.</p>
          <div id="rgBanner"></div>
          <form id="rgForm" class="stack" novalidate>
            ${fieldHtml({ id: 'rgName', name: 'name', label: 'Tu nombre', autocomplete: 'name', placeholder: 'Nombre y apellido', attrs: 'autocapitalize="words" maxlength="120" required' })}
            ${fieldHtml({ id: 'rgPhone', name: 'phone', label: 'Celular (WhatsApp)', type: 'tel', autocomplete: 'tel-national', inputmode: 'tel', placeholder: '10 dígitos', optional: true, hint: 'Para confirmarte y recordarte tus citas por WhatsApp.', attrs: 'maxlength="16"' })}
            ${fieldHtml({ id: 'rgEmail', name: 'email', label: 'Correo', type: 'email', autocomplete: 'email', inputmode: 'email', placeholder: 'tu@correo.com', attrs: 'autocapitalize="none" spellcheck="false" maxlength="160" required' })}
            ${pwFieldHtml({ id: 'rgPw', name: 'password', label: 'Contraseña', meter: true, placeholder: 'Crea una contraseña' })}
            <button class="btn btn-primary btn-lg btn-block" type="submit">Crear mi cuenta</button>
            <p class="auth-legal" id="rgLegal">Solo usaremos tus datos para tus citas.</p>
          </form>
          <p class="auth-foot">¿Ya tienes cuenta? <a class="link-btn" href="#/login">Inicia sesión</a><br/>¿Tienes una barbería? <a class="link-btn" href="#/crear-barberia">Créala gratis</a></p>
        </section>
      </div>`);

    const form = $('#rgForm', el);
    const live = liveForm(form, { name: rules.name('Escribe tu nombre.'), phone: rules.phone(false), email: rules.email, password: rules.password });
    const offUx = wireFormUx(el);
    const phoneIn = $('#rgPhone', el);
    const onPhoneBlur = () => { const d = digits(phoneIn.value); if (d.length === 10) phoneIn.value = fmtPhone(d); };
    phoneIn.addEventListener('blur', onPhoneBlur);

    // ── Barbería (del enlace o del dominio) ──
    const paintShop = () => {
      const box = $('#rgShop', el);
      if (!box) return;
      if (!shopInfo) { box.hidden = true; return; }
      const s = shopInfo.shop;
      const av = avatar(s.name, { src: s.logo_url || '', color: s.brand_color || '#15130F' });
      box.hidden = false;
      box.innerHTML = String(html`${av}<div class="grow"><small>Tu cuenta en</small><b class="truncate" style="display:block">${s.name}</b>${s.city || s.address ? html`<small class="truncate">${s.city || s.address}</small>` : ''}</div>
        ${demo ? html`<span class="badge brand plain">DEMO</span>` : raw(icon('check-circle', 'ok-t'))}`);
      $('#rgArtShop', el).innerHTML = String(html`${av}<div><small>Reservas en</small><b>${s.name}</b></div>`);
      $('#rgLead', el).textContent = 'Para ver, cambiar o repetir tus citas en ' + s.name + ' desde cualquier celular.';
      $('#rgLegal', el).textContent = 'Solo ' + s.name + ' verá tus datos, y solo para tus citas.';
    };
    const banner = (kind, ic, body, extra) => { const b = $('#rgBanner', el); if (b) b.innerHTML = String(html`<div class="banner ${kind}" style="margin-bottom:16px">${raw(icon(ic))}<div class="grow">${body}${extra || ''}</div></div>`); };

    const loadShop = async () => {
      try {
        const r = slug ? await api.get('/public/shops/' + encodeURIComponent(slug)) : await api.get('/public/home', { host: location.host });
        if (gone) return;
        shopInfo = r && r.shop ? r : null;
        if (shopInfo) slug = shopInfo.shop.slug;
        $('#rgBanner', el).innerHTML = '';
        paintShop();
        if (demo) banner('brand', 'sparkles', raw('<b>Estás en la demo.</b> Tu cuenta se crea solo en este navegador para que pruebes cómo lo ve un cliente.'));
      } catch (e) {
        if (gone) return;
        shopInfo = null;
        paintShop();
        if (e.code === 'backend_unavailable' || e.code === 'backend_not_configured' || e.code === 'network') {
          banner('warn', 'alert', e.code === 'network' ? html`<b>Sin conexión.</b> Revisa tu internet para crear tu cuenta.` : html`<b>El servidor no está disponible.</b> Este sitio aún no tiene la base de datos conectada.`,
            e.code === 'network' ? html` <button type="button" class="link-btn" data-retry>Reintentar</button>` : html` <a class="link-btn" href="#/demo">Prueba la demo</a>`);
        } else if (e.status === 404 && slug) {
          banner('warn', 'alert', html`<b>No encontramos esa barbería.</b> Revisa el enlace que te compartieron o pide uno nuevo.`);
          slug = '';
        } else {
          banner('err', 'alert', html`<b>No pudimos cargar la barbería.</b> ${e.message}`, html` <button type="button" class="link-btn" data-retry>Reintentar</button>`);
        }
      }
    };
    loadShop();
    const offRetry = on(el, 'click', '[data-retry]', () => { $('#rgBanner', el).innerHTML = ''; loadShop(); });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearFieldErrors(form);
      if (!live.validate()) return;
      const d = formData(form);
      const body = { name: d.name.trim(), email: d.email.trim(), password: d.password };
      if (digits(d.phone)) body.phone = digits(d.phone);
      if (slug) body.shop_slug = slug;
      const btn = form.querySelector('[type=submit]');
      try {
        await busy(btn, async () => {
          await api.post('/auth/register', body);
          const me = await loadMe();
          const ctx = (me.contexts || []).find((c) => c.role === 'client' && (!slug || c.shop_slug === slug)) || (me.contexts || [])[0];
          toast.success('¡Bienvenido, ' + firstName(body.name) + '! Tu cuenta está lista.');
          await afterAuth({ shopId: ctx ? ctx.shop_id : null, path: ctx && ctx.role === 'client' ? '/mis-citas' : '/inicio' });
        });
      } catch (err) {
        if (state.user) return; // la cuenta sí se creó; solo falló cargar el panel (ya se avisó)
        clearSession();
        if (err.code === 'duplicate') {
          live.setError('email', err.message, esc('Ya existe una cuenta con ese correo. ') + '<a href="#/login">Inicia sesión</a>.');
        } else applyApiErrors(form, live, err);
      }
    });

    return () => { gone = true; live.destroy(); offUx(); offRetry(); phoneIn.removeEventListener('blur', onPhoneBlur); };
  }
};
