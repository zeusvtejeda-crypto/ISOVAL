// Acceso: correo + contraseña, o PIN rápido del equipo (tablet compartida en la barbería). CTA a la demo.
import { html, raw, $, on, formData } from '../lib/html.js';
import { icon } from '../lib/icons.js';
import { api, getMode, setMode, health, LS } from '../lib/api.js';
import { state, loadMe, selectShop, preferredShopId, isSuper, clearSession } from '../lib/state.js';
import { toast, busy, showFieldErrors, clearFieldErrors } from '../lib/ui.js';
import { navigate } from '../lib/router.js';

export default {
  title: 'Iniciar sesión',
  async render(el, { query }) {
    const tab = query.modo === 'pin' ? 'pin' : 'email';
    el.innerHTML = String(html`
      <div class="auth">
        <section class="auth-art" aria-hidden="true">
          <div class="row"><span class="logo-mark">${raw(icon('logo'))}</span><span class="brandname" style="color:#F2EDE3">Tu<b style="color:#D9B25A">Barbería</b></span></div>
          <div>
            <h2>Tu barbería,<br/><em>organizada</em> y llena.</h2>
            <p>Agenda en línea, recordatorios por WhatsApp, caja, comisiones y reportes. Desde el celular o la computadora.</p>
            <div class="feats">
              <div class="feat">${raw(icon('calendar-check'))}Reservas 24/7 con tu propio enlace y QR</div>
              <div class="feat">${raw(icon('whatsapp'))}Confirmaciones y recordatorios en un toque</div>
              <div class="feat">${raw(icon('chart'))}Ingresos, clientes y barbero más activo al día</div>
            </div>
          </div>
          <p style="font-size:13px;color:#8E8676">© TuBarbería</p>
        </section>
        <section class="auth-panel">
          <div class="row auth-brand"><span class="logo-mark">${raw(icon('logo'))}</span><span class="brandname">Tu<b>Barbería</b></span></div>
          <h1>Bienvenido de vuelta</h1>
          <p class="lead">Entra para ver tu agenda de hoy.</p>
          <div id="downBanner"></div>
          <div class="seg" role="tablist" style="margin-bottom:18px;width:100%">
            <button type="button" role="tab" data-tab="email" aria-selected="${String(tab === 'email')}" style="flex:1">Correo</button>
            <button type="button" role="tab" data-tab="pin" aria-selected="${String(tab === 'pin')}" style="flex:1">PIN del equipo</button>
          </div>
          <form id="fEmail" class="stack" novalidate ${tab === 'pin' ? 'hidden' : ''}>
            <div class="field"><label for="lgEmail">Correo</label>
              <input class="input" id="lgEmail" name="email" type="email" autocomplete="username" inputmode="email" placeholder="tu@correo.com" required/>
              <p class="error">Escribe tu correo.</p></div>
            <div class="field"><label for="lgPw">Contraseña</label>
              <div style="position:relative"><input class="input" id="lgPw" name="password" type="password" autocomplete="current-password" placeholder="••••••••" required style="padding-right:44px"/>
              <button type="button" class="btn btn-ghost btn-icon btn-sm" id="pwEye" aria-label="Mostrar contraseña" style="position:absolute;right:4px;top:50%;transform:translateY(-50%)">${raw(icon('eye', 'ic-sm'))}</button></div>
              <p class="error">Escribe tu contraseña.</p></div>
            <button class="btn btn-primary btn-lg btn-block" type="submit">Entrar</button>
          </form>
          <div id="fPin" ${tab === 'pin' ? '' : 'hidden'}>
            <div class="field" id="pinShopF" style="margin-bottom:10px"><label for="pinShop">Código de la barbería</label>
              <input class="input" id="pinShop" autocomplete="off" autocapitalize="none" placeholder="p. ej. new-gomez" value="" aria-describedby="pinShopErr"/>
              <p class="error" id="pinShopErr" role="alert"></p>
              <p class="hint">Es el final de tu enlace de reservas. Se recuerda en este dispositivo. En la demo: <b>demo</b> y PIN 1111–4444.</p></div>
            <p class="faint" style="text-align:center;font-size:12.5px;margin-top:6px">Tu PIN de 4 a 6 números</p>
            <div class="pin-dots" id="pinDots" aria-hidden="true"></div>
            <div class="pin-pad" id="pinPad"></div>
            <button type="button" class="btn btn-primary btn-lg btn-block" id="pinGo" style="margin-top:12px" disabled>Entrar</button>
            <p class="err-t" id="pinMsg" role="alert" style="min-height:22px;text-align:center;font-size:13.5px;margin-top:10px"></p>
          </div>
          <div class="divider">o</div>
          <div class="demo-card">
            <div class="row top"><span class="logo-mark" style="width:38px;height:38px;border-radius:12px">${raw(icon('sparkles'))}</span>
              <div class="grow"><b>Prueba la demo completa</b><p class="muted" style="font-size:13.5px">Una barbería ficticia con agenda, clientes, caja y reportes. Sin registrarte.</p></div></div>
            <a class="btn btn-dark btn-block" href="#/demo">${raw(icon('play'))}Entrar a la demo</a>
          </div>
          <p class="muted" style="font-size:13.5px;margin-top:20px;text-align:center">¿Tienes una barbería? <a class="link-btn" href="#/crear-barberia">Créala gratis</a><br/>¿Eres cliente? <a class="link-btn" href="#/registro">Crea tu cuenta</a></p>
        </section>
      </div>`);

    // Si este sitio no tiene backend, se dice claro y se ofrece la demo.
    if (getMode() === 'demo') {
      setMode('server');
      state.mode = 'server';
    }
    health().catch((e) => {
      const offline = e.code === 'network' || navigator.onLine === false;
      $('#downBanner', el).innerHTML = String(offline
        ? html`<div class="banner warn" style="margin-bottom:16px">${raw(icon('alert'))}<div class="grow"><b>Sin conexión.</b> Revisa tu internet para entrar. La demo funciona sin conexión si ya la abriste antes.</div></div>`
        : html`<div class="banner warn" style="margin-bottom:16px">${raw(icon('alert'))}<div class="grow"><b>Servidor no disponible.</b> Este sitio aún no tiene la base de datos conectada. Puedes explorar todo en la demo.</div></div>`);
    });

    const offs = [];
    offs.push(on(el, 'click', '[data-tab]', (e, b) => {
      el.querySelectorAll('[data-tab]').forEach((x) => x.setAttribute('aria-selected', x === b ? 'true' : 'false'));
      $('#fEmail', el).hidden = b.dataset.tab !== 'email';
      $('#fPin', el).hidden = b.dataset.tab !== 'pin';
      if (b.dataset.tab === 'email') $('#lgEmail', el).focus();
    }));
    offs.push(on(el, 'click', '#pwEye', () => { const i = $('#lgPw', el); i.type = i.type === 'password' ? 'text' : 'password'; }));

    const afterLogin = async () => {
      await loadMe();
      // El shell elige la barbería y, si está suspendida, lo explica en su propia pantalla (no es un error de acceso).
      if (window.TB && window.TB.ensureShop) await window.TB.ensureShop();
      else { const id = preferredShopId(); if (id) await selectShop(id); }
      const next = query.next && query.next.startsWith('/') && !query.next.startsWith('/login') ? query.next : null;
      toast.success('¡Hola, ' + ((state.user && state.user.name) || (state.staff && state.staff.name) || '').split(' ')[0] + '!');
      navigate(next || window.TB.homePath(), { replace: true, force: true });
    };

    const form = $('#fEmail', el);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearFieldErrors(form);
      const d = formData(form);
      let bad = false;
      if (!d.email) { form.email.closest('.field').classList.add('invalid'); bad = true; }
      if (!d.password) { form.password.closest('.field').classList.add('invalid'); bad = true; }
      if (bad) return;
      const btn = form.querySelector('[type=submit]');
      try {
        await busy(btn, api.post('/auth/login', { email: d.email.trim(), password: d.password }));
        await afterLogin();
      } catch (err) {
        clearSession();
        showFieldErrors(form, err);
      }
    });

    // ── PIN: de 4 a 6 dígitos (como se crean en Equipo y en Mi perfil). Se envía con «Entrar» o solo al llegar a 6. ──
    const PIN_MIN = 4, PIN_MAX = 6;
    let pin = '', sending = false;
    const shopIn = $('#pinShop', el);
    shopIn.value = LS.get('tb:pinShop') || '';
    if (!shopIn.value) api.get('/public/home', { host: location.host }).then((r) => { if (r && r.shop && !shopIn.value) shopIn.value = r.shop.slug; }).catch(() => {});
    const dots = () => {
      $('#pinDots', el).innerHTML = Array.from({ length: Math.max(PIN_MIN, pin.length) }, (_, i) => '<span class="' + (i < pin.length ? 'f' : '') + '"></span>').join('');
      $('#pinGo', el).disabled = sending || pin.length < PIN_MIN;
    };
    $('#pinPad', el).innerHTML = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((k) => k === '' ? '<span></span>' : '<button type="button" data-k="' + k + '" aria-label="' + (k === '⌫' ? 'Borrar' : k) + '">' + k + '</button>').join('');
    dots();
    // Código que no existe (404): lo más probable es que el dueño haya cambiado el enlace de reservas (y con él el
    // código). Se marca el campo, se olvida el código guardado y se pide el nuevo; el PIN no tuvo la culpa.
    const shopField = $('#pinShopF', el);
    const shopErr = (msg) => {
      shopField.classList.toggle('invalid', !!msg);
      shopIn.setAttribute('aria-invalid', String(!!msg));
      $('#pinShopErr', el).textContent = msg || '';
    };
    shopIn.addEventListener('input', () => shopErr(''));
    const submitPin = async () => {
      if (sending || pin.length < PIN_MIN) return;
      const slug = shopIn.value.trim().toLowerCase();
      shopErr('');
      if (!slug) { $('#pinMsg', el).textContent = 'Escribe el código de tu barbería.'; shopIn.focus(); pin = ''; dots(); return; }
      sending = true;
      const go = $('#pinGo', el);
      try {
        go.setAttribute('aria-busy', 'true');
        $('#pinPad', el).style.opacity = '.5';
        // Los códigos de la demo corren en el navegador (demo: PIN 1111–4444).
        if (slug === 'demo' || slug === 'demo-norte') { setMode('demo'); state.mode = 'demo'; } else if (getMode() === 'demo') { setMode('server'); state.mode = 'server'; }
        await api.post('/auth/pin', { shop_slug: slug, pin });
        LS.set('tb:pinShop', slug);
        await afterLogin();
      } catch (err) {
        if (err.status === 404 && err.code === 'not_found') {
          if (LS.get('tb:pinShop') === slug) LS.del('tb:pinShop');
          shopErr('No encontramos la barbería «' + slug + '». Si el dueño cambió el enlace de reservas, el código también cambió: pídele el nuevo (es el final del enlace) y escríbelo aquí.');
          $('#pinMsg', el).textContent = '';
          shopIn.focus(); shopIn.select();
        } else $('#pinMsg', el).textContent = err.message;
        const d = $('#pinDots', el); d.classList.remove('shake'); void d.offsetWidth; d.classList.add('shake');
        pin = ''; setTimeout(dots, 150);
      } finally {
        sending = false;
        const p = $('#pinPad', el); if (p) p.style.opacity = '';
        if (go.isConnected) { go.removeAttribute('aria-busy'); go.disabled = pin.length < PIN_MIN; }
      }
    };
    const typeDigit = (k) => {
      if (sending || pin.length >= PIN_MAX) return;
      $('#pinMsg', el).textContent = '';
      pin += k; dots();
      if (pin.length === PIN_MAX) submitPin();
    };
    const erase = () => { if (sending) return; pin = pin.slice(0, -1); dots(); };
    offs.push(on(el, 'click', '#pinPad [data-k]', (e, b) => { if (b.dataset.k === '⌫') erase(); else typeDigit(b.dataset.k); }));
    offs.push(on(el, 'click', '#pinGo', () => submitPin()));
    const onKey = (e) => {
      if ($('#fPin', el).hidden || e.target === shopIn) return;
      if (/^\d$/.test(e.key)) typeDigit(e.key);
      else if (e.key === 'Backspace') erase();
      else if (e.key === 'Enter' && !(e.target && e.target.closest && e.target.closest('button,a'))) { e.preventDefault(); submitPin(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { offs.forEach((f) => f()); document.removeEventListener('keydown', onKey); };
  }
};
