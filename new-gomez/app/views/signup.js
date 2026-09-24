// #/crear-barberia — Alta de barbería + dueño (POST /api/auth/signup) en 2 pasos: tu barbería → tu cuenta.
// Muestra en vivo cómo quedará (enlace, servicios de plantilla, horario) y, al terminar, entra
// (loadMe + selectShop) a #/inicio?bienvenida=1 con un toast de bienvenida.
// Modo: ?demo=1 la crea en la demo (solo en este navegador). Sin servidor disponible, ofrece crearla en la demo.
import { html, raw, esc, $, $$, on, formData } from '../lib/html.js';
import { icon } from '../lib/icons.js';
import { api, getMode, setMode, health, SITE_BASE } from '../lib/api.js';
import { state, loadMe, clearSession } from '../lib/state.js';
import { toast, clearFieldErrors, avatar } from '../lib/ui.js';
import { money, duration, time, phone as fmtPhone, firstName } from '../lib/fmt.js';
import { DEFAULT_HOURS } from '../../core/domain/settings.js';
import { ensureFormCss, fieldHtml, pwFieldHtml, wireFormUx, liveForm, rules, digits, slugify, afterAuth } from './register.js';

// Reflejo de TEMPLATE_SERVICES (core/api/auth.js); se reemplaza por el original en cuanto carga.
let TEMPLATE = [
  { name: 'Corte de cabello', duration_min: 40, price: 200 }, { name: 'Corte y barba', duration_min: 60, price: 320 },
  { name: 'Arreglo de barba', duration_min: 30, price: 150 }, { name: 'Cejas', duration_min: 10, price: 60 },
  { name: 'Diseño / líneas', duration_min: 20, price: 80 }, { name: 'Corte infantil', duration_min: 30, price: 150 }
];
const TZS = [
  ['America/Mexico_City', 'Centro (CDMX, Jalisco, Nuevo León…)'],
  ['America/Cancun', 'Sureste (Quintana Roo)'],
  ['America/Mazatlan', 'Pacífico (Sinaloa, Nayarit, BCS)'],
  ['America/Hermosillo', 'Sonora'],
  ['America/Tijuana', 'Noroeste (Baja California)'],
  ['America/Chihuahua', 'Chihuahua']
];
const CITY_TZ = {
  tijuana: 'America/Tijuana', mexicali: 'America/Tijuana', ensenada: 'America/Tijuana', hermosillo: 'America/Hermosillo',
  'ciudad obregon': 'America/Hermosillo', mazatlan: 'America/Mazatlan', culiacan: 'America/Mazatlan', tepic: 'America/Mazatlan',
  'la paz': 'America/Mazatlan', 'los cabos': 'America/Mazatlan', 'bahia de banderas': 'America/Mazatlan', cancun: 'America/Cancun',
  'playa del carmen': 'America/Cancun', chetumal: 'America/Cancun', tulum: 'America/Cancun', chihuahua: 'America/Chihuahua'
};
const CITIES = ['Ciudad de México', 'Guadalajara', 'Monterrey', 'Puebla', 'Querétaro', 'León', 'Tijuana', 'Mérida', 'Cancún', 'Tepic',
  'Mazatlán', 'Culiacán', 'Hermosillo', 'Chihuahua', 'Toluca', 'Aguascalientes', 'Morelia', 'Saltillo', 'San Luis Potosí', 'Veracruz', 'Oaxaca', 'Puerto Vallarta'];
const STEP1 = ['shop_name', 'city', 'phone', 'timezone'];
const STEP2 = ['owner_name', 'email', 'password'];
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

// "Lun a vie 10:00–20:00 · Sáb 10:00–16:00 · Dom cerrado"
function hoursText(h) {
  const D = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const order = [1, 2, 3, 4, 5, 6, 0];
  const key = (d) => (h[d] || []).map((r) => time(r[0]) + '–' + time(r[1])).join(', ') || 'cerrado';
  const out = [];
  for (let i = 0; i < order.length;) {
    let j = i;
    while (j + 1 < order.length && key(order[j + 1]) === key(order[i])) j++;
    const a = D[order[i]], b = D[order[j]];
    out.push((i === j ? a : a + (j - i === 1 ? ' y ' : ' a ') + b.toLowerCase()) + ' ' + key(order[i]));
    i = j + 1;
  }
  return out.join(' · ');
}

const CSS = `
.su-steps{list-style:none;display:flex;align-items:center;gap:10px;margin:22px 0 4px}
.su-steps li{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;color:var(--text-3);white-space:nowrap;transition:color .2s}
.su-steps .n{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;font-size:12.5px;font-weight:700;border:1.5px solid var(--border-strong);background:var(--surface);transition:background .25s,border-color .25s,color .25s}
.su-steps .n .ic{width:14px;height:14px;stroke-width:2.6}
.su-steps li[aria-current="step"]{color:var(--text)}
.su-steps li[aria-current="step"] .n{border-color:var(--brand);background:var(--brand);color:var(--brand-ink)}
.su-steps li.done{color:var(--text-2)}
.su-steps li.done .n{border-color:var(--ok);background:var(--ok);color:#fff}
.su-steps .bar{flex:1;height:3px;border-radius:999px;background:var(--surface-3);overflow:hidden;min-width:24px}
.su-steps .bar i{display:block;height:100%;width:0;background:var(--brand);border-radius:inherit;transition:width .45s var(--ease-out)}
.su-steps[data-s="2"] .bar i{width:100%}
.su-step h1{margin-top:18px}
.su-step.in-r{animation:suInR .38s var(--ease-out)}.su-step.in-l{animation:suInL .38s var(--ease-out)}
@keyframes suInR{from{opacity:0;transform:translateX(18px)}to{opacity:1;transform:none}}
@keyframes suInL{from{opacity:0;transform:translateX(-18px)}to{opacity:1;transform:none}}
.su-link{display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--text-3);min-width:0}
.su-link .ic{width:14px;height:14px;flex:none}
.su-link span{font-family:var(--mono);color:var(--text-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.su-link b{color:var(--brand-strong);font-weight:500}
.su-sum{border:1px solid var(--border);background:var(--surface-2);border-radius:var(--r-lg);padding:14px 16px;display:grid;gap:10px}
.su-sum h4{font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text-3)}
.su-sum .it{display:grid;grid-template-columns:22px minmax(0,1fr);gap:10px;font-size:13.5px;align-items:start}
.su-sum .it>.ic{width:18px;height:18px;color:var(--ok);margin-top:1px;stroke-width:2.2}
.su-sum .it b{font-weight:600}
.su-sum .it small{display:block;color:var(--text-3);font-size:12.5px;margin-top:1px}
.su-chips{display:flex;flex-wrap:wrap;gap:5px;margin-top:6px}
.su-chips span{font-size:12px;padding:3px 8px;border-radius:999px;background:var(--surface);border:1px solid var(--border);color:var(--text-2);white-space:nowrap}
.su-chips span b{color:var(--text);font-weight:600}
.su-nav{display:grid;grid-template-columns:auto minmax(0,1fr);gap:10px;margin-top:4px}
.su-nav .btn-secondary{padding:0 18px}
.su-done{display:grid;justify-items:center;text-align:center;padding:26px 0 8px;animation:fadeUp .4s var(--ease-out)}
.su-done h1{margin:18px 0 6px}
.su-done .lead{margin-bottom:18px}
.su-check{width:84px;height:84px;border-radius:50%;background:var(--ok-soft);display:grid;place-items:center;animation:pop .5s var(--ease-out)}
.su-check svg{width:46px;height:46px;stroke:var(--ok);fill:none;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round}
.su-check circle{stroke-dasharray:120;stroke-dashoffset:120;animation:draw .7s .05s var(--ease-out) forwards;opacity:.35}
.su-check path{stroke-dasharray:30;stroke-dashoffset:30;animation:draw .45s .45s var(--ease-out) forwards}
.su-done .su-sum{text-align:left;width:100%}
.su-loading{display:flex;align-items:center;gap:10px;justify-content:center;color:var(--text-3);font-size:13px;margin-top:16px}
.su-loading .spinner{width:16px;height:16px;border-width:2px}
.su-pv{position:relative;margin-top:30px;max-width:400px;border-radius:24px;background:rgba(242,237,227,.05);border:1px solid rgba(242,237,227,.12);padding:18px;box-shadow:0 30px 60px rgba(0,0,0,.35);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
.su-pv .eyebrow{color:#8E8676;margin-bottom:12px;display:flex;align-items:center;gap:6px}
.su-pv .eyebrow i{width:7px;height:7px;border-radius:50%;background:#6FBF8A;box-shadow:0 0 0 3px rgba(111,191,138,.2)}
.su-pv-head{display:flex;align-items:center;gap:12px}
.su-pv-head .avatar{--s:48px;border-radius:14px;font-size:17px;box-shadow:0 0 0 1px rgba(217,178,90,.4)}
.su-pv-head b{display:block;color:#F2EDE3;font-size:18px;font-family:var(--disp);letter-spacing:.01em;line-height:1.1}
.su-pv-head small{display:block;color:#A39A88;font-size:12.5px;margin-top:2px}
.su-pv-url{margin:14px 0;padding:8px 10px;border-radius:10px;background:rgba(0,0,0,.25);font-family:var(--mono);font-size:12px;color:#BDB5A5;display:flex;gap:6px;align-items:center;overflow:hidden;white-space:nowrap}
.su-pv-url .ic{width:13px;height:13px;color:#D9B25A;flex:none}
.su-pv-url b{color:#E6C173;font-weight:500}
.su-pv-row{display:flex;justify-content:space-between;gap:10px;padding:9px 0;border-top:1px solid rgba(242,237,227,.08);font-size:13.5px;color:#D9D3C6}
.su-pv-row small{color:#8E8676;font-size:12px;display:block}
.su-pv-row b{color:#F2EDE3;font-weight:600;font-variant-numeric:tabular-nums}
.su-pv-btn{margin-top:12px;height:42px;border-radius:12px;background:#D9B25A;color:#15130F;display:grid;place-items:center;font-weight:700;font-size:14px}
.su-pv-hours{margin-top:10px;font-size:12px;color:#8E8676;display:flex;gap:6px;align-items:flex-start}
.su-pv-hours .ic{width:13px;height:13px;margin-top:2px;flex:none}
`;

export default {
  title: 'Crea tu barbería',
  async render(el, { query }) {
    ensureFormCss();
    if (!document.getElementById('st-signup')) document.head.insertAdjacentHTML('beforeend', '<style id="st-signup">' + CSS + '</style>');
    if (query.demo === '1' && getMode() !== 'demo') { setMode('demo'); state.mode = 'demo'; }
    let step = 1;
    let gone = false;
    let tzTouched = false;
    const detected = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { return ''; } })();
    const tzList = TZS.some(([k]) => k === detected) || !/^America\//.test(detected) ? TZS : TZS.concat([[detected, 'Mi zona actual (' + detected.replace('America/', '').replace(/_/g, ' ') + ')']]);
    const tz0 = tzList.some(([k]) => k === detected) ? detected : 'America/Mexico_City';
    const host = SITE_BASE.replace(/^https?:\/\//, '');
    const hours = hoursText(DEFAULT_HOURS);

    el.innerHTML = String(html`
      <div class="auth">
        <section class="auth-art" aria-hidden="true">
          <div class="row"><span class="logo-mark">${raw(icon('logo'))}</span><span class="brandname" style="color:#F2EDE3">Tu<b style="color:#D9B25A">Barbería</b></span></div>
          <div>
            <h2>Tu barbería en línea,<br/><em>hoy mismo.</em></h2>
            <p>Agenda, reservas 24/7, recordatorios por WhatsApp y caja. Empieza con servicios y horario listos; los ajustas cuando quieras.</p>
            <div class="su-pv">
              <div class="eyebrow"><i></i>Así la verán tus clientes</div>
              <div class="su-pv-head" id="pvHead"></div>
              <div class="su-pv-url">${raw(icon('lock'))}<span class="truncate">${host}?b=<b id="pvSlug">tu-barberia</b></span></div>
              <div id="pvServices"></div>
              <div class="su-pv-btn">Reservar cita</div>
              <div class="su-pv-hours">${raw(icon('clock'))}<span>${hours}</span></div>
            </div>
          </div>
          <p style="font-size:13px;color:#8E8676">Sin tarjeta · Lista en 2 minutos</p>
        </section>
        <section class="auth-panel">
          <div class="auth-top">
            <a class="link-btn auth-back" href="#/login">${raw(icon('arrow-left', 'ic-sm'))}Volver</a>
            <span class="brand"><span class="logo-mark">${raw(icon('logo'))}</span><span class="brandname">Tu<b>Barbería</b></span></span>
          </div>
          <div id="suMain">
            <ol class="su-steps" id="suSteps" data-s="1" aria-label="Pasos para crear tu barbería">
              <li data-s="1" aria-current="step"><span class="n">1</span><span>Tu barbería</span></li>
              <li class="bar" aria-hidden="true"><i></i></li>
              <li data-s="2"><span class="n">2</span><span>Tu cuenta</span></li>
            </ol>
            <form id="suForm" novalidate>
              <div class="su-step" data-step="1">
                <h1 tabindex="-1">Crea tu barbería</h1>
                <p class="lead">Empecemos por lo básico. Todo se puede cambiar después.</p>
                <div id="suBanner"></div>
                <div class="stack">
                  ${fieldHtml({ id: 'suShop', name: 'shop_name', label: 'Nombre de tu barbería', placeholder: 'p. ej. Barbería Gómez', autocomplete: 'organization', attrs: 'autocapitalize="words" maxlength="80" required' })}
                  <p class="su-link" id="suLink" style="margin-top:-4px">${raw(icon('link'))}<span>${host}?b=<b>tu-barberia</b></span></p>
                  ${fieldHtml({ id: 'suCity', name: 'city', label: 'Ciudad', optional: true, placeholder: 'p. ej. Tepic', autocomplete: 'address-level2', attrs: 'list="suCities" autocapitalize="words" maxlength="80"' })}
                  <datalist id="suCities">${CITIES.map((c) => html`<option value="${c}"></option>`)}</datalist>
                  ${fieldHtml({ id: 'suPhone', name: 'phone', label: 'WhatsApp de la barbería', type: 'tel', optional: true, inputmode: 'tel', autocomplete: 'tel-national', placeholder: '10 dígitos', hint: 'Para que tus clientes te escriban desde tu página de reservas.', attrs: 'maxlength="16"' })}
                  <div class="field">
                    <label for="suTz">Zona horaria</label>
                    <select class="select" id="suTz" name="timezone">${tzList.map(([k, l]) => html`<option value="${k}" ${raw(k === tz0 ? 'selected' : '')}>${l}</option>`)}</select>
                    <p class="hint">La usamos para tu agenda y tus recordatorios.</p>
                    <p class="error">Elige una zona horaria.</p>
                  </div>
                  <button class="btn btn-primary btn-lg btn-block" type="submit" data-next>Continuar${raw(icon('arrow-right'))}</button>
                </div>
              </div>
              <div class="su-step" data-step="2" hidden>
                <h1 tabindex="-1">Tu cuenta de dueño</h1>
                <p class="lead">Con ella entras al panel desde tu celular o la computadora.</p>
                <div class="stack">
                  ${fieldHtml({ id: 'suOwner', name: 'owner_name', label: 'Tu nombre', autocomplete: 'name', placeholder: 'Nombre y apellido', attrs: 'autocapitalize="words" maxlength="120" required' })}
                  ${fieldHtml({ id: 'suEmail', name: 'email', label: 'Correo', type: 'email', inputmode: 'email', autocomplete: 'email', placeholder: 'tu@correo.com', attrs: 'autocapitalize="none" spellcheck="false" maxlength="160" required' })}
                  ${pwFieldHtml({ id: 'suPw', name: 'password', label: 'Contraseña', meter: true, placeholder: 'Crea una contraseña' })}
                  <div class="su-sum" id="suSum" aria-label="Lo que vamos a crear"></div>
                  <div class="su-nav">
                    <button type="button" class="btn btn-secondary btn-lg" data-back aria-label="Volver al paso 1">${raw(icon('arrow-left'))}Atrás</button>
                    <button class="btn btn-primary btn-lg" type="submit">Crear mi barbería</button>
                  </div>
                </div>
              </div>
            </form>
          </div>
          <div id="suDone" hidden></div>
          <p class="auth-foot" id="suFoot">¿Ya tienes cuenta? <a class="link-btn" href="#/login">Inicia sesión</a><br/>¿Eres cliente? <a class="link-btn" href="#/registro">Crea tu cuenta de cliente</a></p>
        </section>
      </div>`);

    const form = $('#suForm', el);
    const live = liveForm(form, {
      shop_name: rules.name('Escribe el nombre de tu barbería.', 80),
      city: (v) => (String(v || '').trim().length > 80 ? 'La ciudad es demasiado larga (máximo 80 caracteres).' : ''),
      phone: rules.phone(false),
      owner_name: rules.name('Escribe tu nombre.', 120),
      email: rules.email,
      password: rules.password
    });
    const offUx = wireFormUx(el);
    const val = (n) => { const i = form.querySelector('[name="' + n + '"]'); return i ? i.value.trim() : ''; };

    // ── Vista previa y resumen ──
    const paintPreview = () => {
      const name = val('shop_name') || 'Tu barbería';
      const slug = slugify(val('shop_name') || 'tu-barberia');
      const city = val('city');
      $('#pvHead', el).innerHTML = String(html`${avatar(name, { color: '#9E7826' })}<div class="grow"><b class="truncate" style="display:block">${name}</b><small>${city || 'Tu ciudad'} · Abierto hoy</small></div>`);
      $('#pvSlug', el).textContent = slug;
      $('#suLink', el).innerHTML = icon('link') + '<span>' + esc(host) + '?b=<b>' + esc(slug) + '</b></span>';
      $('#pvServices', el).innerHTML = TEMPLATE.slice(0, 3).map((s) => '<div class="su-pv-row"><span>' + esc(s.name) + '<small>' + esc(duration(s.duration_min)) + '</small></span><b>' + esc(money(s.price)) + '</b></div>').join('');
    };
    const paintSummary = () => {
      const name = val('shop_name') || 'Tu barbería';
      $('#suSum', el).innerHTML = String(html`<h4>Lo que vamos a crear</h4>
        <div class="it">${raw(icon('check-circle'))}<div><b>${name}</b> con tu enlace de reservas y QR<small>${host}?b=${slugify(name)}</small></div></div>
        <div class="it">${raw(icon('check-circle'))}<div><b>${TEMPLATE.length} servicios de plantilla</b>, listos para editar
          <div class="su-chips">${TEMPLATE.map((s) => html`<span>${s.name} <b>${money(s.price)}</b></span>`)}</div></div></div>
        <div class="it">${raw(icon('check-circle'))}<div><b>Horario de atención</b><small>${hours}</small></div></div>
        <div class="it">${raw(icon('check-circle'))}<div><b>Tú como dueño</b> y primer barbero de la agenda<small>Después invitas a tu equipo con su propio acceso o PIN.</small></div></div>`);
    };
    paintPreview();
    import('../../core/api/auth.js').then((m) => { if (!gone && Array.isArray(m.TEMPLATE_SERVICES)) { TEMPLATE = m.TEMPLATE_SERVICES; paintPreview(); if (step === 2) paintSummary(); } }).catch(() => {});

    // ── Pasos ──
    const goStep = (n, opts) => {
      const dir = n > step ? 'in-r' : 'in-l';
      step = n;
      $$('.su-step', el).forEach((s) => { const on = +s.dataset.step === n; s.hidden = !on; s.classList.remove('in-r', 'in-l'); if (on) { void s.offsetWidth; s.classList.add(dir); } });
      const st = $('#suSteps', el);
      st.dataset.s = String(n);
      $$('li[data-s]', st).forEach((li) => {
        const k = +li.dataset.s;
        if (k === n) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
        li.classList.toggle('done', k < n);
        li.querySelector('.n').innerHTML = k < n ? icon('check') : String(k);
      });
      if (n === 2) paintSummary();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (!(opts && opts.noFocus)) {
        const target = n === 2 ? $('#suOwner', el) : $('#suShop', el);
        setTimeout(() => { if (!gone && target && window.matchMedia('(min-width:720px)').matches) target.focus({ preventScroll: true }); else { const h = $('.su-step:not([hidden]) h1', el); if (h) h.focus({ preventScroll: true }); } }, 60);
      }
    };

    const onInput = (e) => {
      const n = e.target.name;
      if (n === 'shop_name' || n === 'city') paintPreview();
      if (n === 'timezone') tzTouched = true;
      if (n === 'city' && !tzTouched) {
        const tz = CITY_TZ[norm(e.target.value)];
        const sel = $('#suTz', el);
        if (tz && sel && Array.from(sel.options).some((o) => o.value === tz)) sel.value = tz;
      }
    };
    form.addEventListener('input', onInput);
    form.addEventListener('change', onInput);
    const phoneIn = $('#suPhone', el);
    const onPhoneBlur = () => { const d = digits(phoneIn.value); if (d.length === 10) phoneIn.value = fmtPhone(d); };
    phoneIn.addEventListener('blur', onPhoneBlur);

    // ── Modo (servidor / demo) ──
    const banner = () => {
      const b = $('#suBanner', el);
      if (!b) return;
      if (getMode() === 'demo') {
        b.innerHTML = String(html`<div class="banner brand" style="margin-bottom:16px">${raw(icon('sparkles'))}<div class="grow"><b>Modo demo.</b> La barbería se crea solo en este navegador para que veas cómo queda. Nada se publica.</div></div>`);
        return;
      }
      b.innerHTML = '';
      health().catch((e) => {
        if (gone || getMode() === 'demo') return;
        const offline = e.code === 'network' || navigator.onLine === false;
        b.innerHTML = String(html`<div class="banner warn" style="margin-bottom:16px">${raw(icon('alert'))}<div class="grow">
          ${offline ? html`<b>Sin conexión.</b> Necesitas internet para crear tu barbería.` : html`<b>El servidor no está disponible.</b> Este sitio aún no tiene la base de datos conectada. Puedes ver cómo funciona creando una barbería de prueba en la demo.`}
          ${offline ? '' : html`<div style="margin-top:8px"><button type="button" class="btn btn-secondary btn-sm" data-usedemo>${raw(icon('sparkles', 'ic-sm'))}Crear en la demo</button></div>`}</div></div>`);
      });
    };
    banner();
    const offDemo = on(el, 'click', '[data-usedemo]', () => { setMode('demo'); state.mode = 'demo'; banner(); toast.info('Listo: la crearás en la demo, solo en este navegador.'); });
    const offBack = on(el, 'click', '[data-back]', () => goStep(1));

    // ── Enviar ──
    const done = (r, d) => {
      $('#suMain', el).hidden = true;
      $('#suFoot', el).hidden = true;
      const box = $('#suDone', el);
      box.hidden = false;
      const s = r.shop || {};
      box.innerHTML = String(html`<div class="su-done" role="status" aria-live="polite">
        <div class="su-check" aria-hidden="true"><svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="19"/><path d="M16.5 27 23 33.5 36 19.5"/></svg></div>
        <h1>¡${s.name || d.shop_name} está lista!</h1>
        <p class="lead">Bienvenido, ${firstName(d.owner_name)}. Estamos abriendo tu panel…</p>
        <div class="su-sum">
          <div class="it">${raw(icon('check-circle'))}<div><b>Enlace de reservas</b><small class="mono">${host}?b=${s.slug || slugify(d.shop_name)}</small></div></div>
          <div class="it">${raw(icon('check-circle'))}<div><b>${TEMPLATE.length} servicios</b> y horario de atención listos</div></div>
          <div class="it">${raw(icon('check-circle'))}<div><b>Tu cuenta de dueño</b><small>${d.email}</small></div></div>
        </div>
        <div class="su-loading"><span class="spinner"></span>Preparando tu agenda</div>
      </div>`);
      window.scrollTo(0, 0);
    };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearFieldErrors(form);
      if (step === 1) { if (live.validate(STEP1)) goStep(2); return; }
      if (!live.validate(STEP2)) return; // el paso 1 ya se validó al pulsar «Continuar»
      const d = formData(form);
      const body = { shop_name: d.shop_name.trim(), owner_name: d.owner_name.trim(), email: d.email.trim(), password: d.password, timezone: d.timezone };
      if (d.city && d.city.trim()) body.city = d.city.trim();
      if (digits(d.phone)) body.phone = digits(d.phone);
      const btn = form.querySelector('.su-step[data-step="2"] [type=submit]');
      const backBtn = form.querySelector('[data-back]');
      btn.setAttribute('aria-busy', 'true'); btn.disabled = true; backBtn.disabled = true;
      let r;
      try {
        r = await api.post('/auth/signup', body);
      } catch (err) {
        btn.removeAttribute('aria-busy'); btn.disabled = false; backBtn.disabled = false;
        clearSession();
        if (err.code === 'duplicate') { live.setError('email', err.message, esc('Ya existe una cuenta con ese correo. ') + '<a href="#/login">Inicia sesión</a> o usa otro correo.'); return; }
        if (err.status === 403) { toast.error(err); return; }
        const f = err.fields || {};
        const k1 = Object.keys(f).find((k) => STEP1.includes(k));
        if (k1) goStep(1, { noFocus: true });
        let any = false;
        for (const [k, msg] of Object.entries(f)) if (form.querySelector('[name="' + k + '"]')) { live.setError(k, msg); any = true; }
        if (!any) toast.error(err);
        return;
      }
      done(r, body);
      const t0 = Date.now();
      try {
        await loadMe();
        await new Promise((res) => setTimeout(res, Math.max(0, 1200 - (Date.now() - t0))));
        if (gone) return;
        toast.success('¡Bienvenido a TuBarbería, ' + firstName(body.owner_name) + '! ' + (r.shop ? r.shop.name : 'Tu barbería') + ' ya está lista.', { duration: 5000 });
        await afterAuth({ shopId: r.shop && r.shop.id, path: '/inicio', query: { bienvenida: '1' } });
      } catch (err) {
        toast.error('Tu barbería se creó, pero no pudimos abrir el panel. Entra con tu correo y contraseña.');
        window.TB.navigate('/login', { replace: true });
      }
    });

    return () => { gone = true; live.destroy(); offUx(); offDemo(); offBack(); form.removeEventListener('input', onInput); form.removeEventListener('change', onInput); phoneIn.removeEventListener('blur', onPhoneBlur); };
  }
};
