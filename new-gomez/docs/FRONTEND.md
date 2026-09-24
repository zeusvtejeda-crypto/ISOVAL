# Frontend — guía para construir vistas del panel (`app/`)

Sin frameworks ni build: ES modules nativos. Todo en español de México, tono cálido y profesional.
Objetivo de calidad: SaaS premium, minimalista, rápido, táctil (iPhone/Android/tablet/escritorio).

## Estructura

```
app/index.html          shell HTML (splash, fuentes, app.css, main.js)
app/app.css             sistema de diseño (tokens, componentes, animaciones) — ÚSALO, no inventes estilos paralelos
app/main.js             arranque, rutas, shell por rol (sidebar ≥1024px, barra inferior en móvil), demo
app/lib/api.js          api.get/post/patch/put/del/raw — transporte 'server' (fetch) o 'demo' (core en el navegador)
app/lib/state.js        state, bus, can/canAny/role/shop/tz/today/nowMin/me, getServices/getStaff (caché)
app/lib/router.js       navigate(path,{query,replace}), setQuery(query), parseHash()
app/lib/html.js         html`` (escapa), raw(), esc(), $, $$, on(root,type,selector,fn), formData(form)
app/lib/ui.js           toast, modal, confirmDialog, promptDialog, menu, busy, spinner, skeletonRows/Cards,
                        emptyState, errorState, avatar, statusBadge, copyText, animateNumber,
                        showFieldErrors, clearFieldErrors, saveFile
app/lib/fmt.js          money, compactMoney, number, pct, time, timeRange, duration, dateLong(Cap), dateShort,
                        dateNum, monthYear, relDay, ago, todayIn, startOfWeek/Month, endOfMonth, addDays,
                        addMonths, weekday, diffDays, phone, initials, firstName, plural, STATUS, METHOD, SOURCE, ROLE
app/lib/icons.js        icon(name, cls) → SVG (ver lista de nombres en el archivo)
app/views/*.js          una vista por ruta (ver main.js → defineRoutes)
```

## Contrato de una vista

```js
import { html, raw, on } from '../lib/html.js';
import { api } from '../lib/api.js';
export default {
  title: 'Agenda',                         // o () => 'Mi día'
  async render(el, { params, query, navigate }) {
    el.innerHTML = String(html`<div class="page-head">…</div><div id="x">${raw(skeleton)}</div>`);
    const off = on(el, 'click', '[data-act]', (e, btn) => { … });
    // …cargar datos con api, pintar, manejar errores con errorState + botón Reintentar…
    return () => { off(); };               // limpieza opcional (intervalos, listeners globales, bus.on)
  }
};
```
- `el` ya es `<div class="page">`. Empieza con `.page-head` (h2 + p + .actions). En móvil el título también
  aparece en la barra superior; en escritorio también. Mantén el h2 corto.
- `html` omite booleanos (para permitir `${cond && html`…`}`): en atributos usa `String(bool)`, p. ej. `aria-selected="${String(x)}"`.
- Estados obligatorios en toda lista: cargando (skeleton), vacío (emptyState con CTA útil), error
  (errorState + Reintentar). Nunca una pantalla en blanco.
- Toda acción: botón con `busy(btn, promesa)` → toast.success con mensaje concreto ("Cita confirmada") o
  toast.error(err) (err.message ya viene en español). Acciones destructivas → `confirmDialog({danger:true})`.
- Formularios: `<form>` con `.field` (label + input + `<p class="error">`), `formData(form)`, y en error de
  API `showFieldErrors(form, err)` (usa err.fields). Inputs de 16px en móvil (ya en CSS) para que iOS no haga zoom.
- Cambios que afectan otras vistas → `bus.emit('appointments:changed' | 'payments:changed' | 'clients:changed'
  | 'services:changed' | 'staff:changed' | 'notifications:changed')`. Escucha con `bus.on` y límpialo al salir.
- Permisos: `can('perm')`/`canAny([...])` para mostrar/ocultar botones. El servidor valida igual.
- Navegación global sin importar main.js (evita ciclos): `window.TB.newAppointment(prefill)`,
  `window.TB.enterShop(shopId)`, `window.TB.demoLogin(role)`, `window.TB.pwa` ({prompt, installed}),
  `window.TB.refreshContext()`, `window.TB.renderShell()`, `window.TB.homePath()`.
- Componentes compartidos (contratos en cada archivo): `lib/appointment-sheet.js` (openAppointment,
  openNewAppointment), `lib/payment-sheet.js` (openPaymentSheet), `lib/whatsapp.js` (sendWhatsApp,
  editAndSendWhatsApp), `lib/notif-panel.js`, `lib/charts.js`, `lib/qr.js`.

## Clases de CSS disponibles (app.css)

Layout: `.page-head .actions`, `.section`, `.section-title`, `.grid-2`, `.grid-3`, `.grid-main-side`, `.row`
(`.wrap .between .end .top`), `.stack`, `.stack-sm`, `.stack-lg`, `.grow`, `.hr`, `.toolbar`, `.date-nav`.
Superficies: `.card` (`.card-pad`, `.card-head`, `.card-body`, `.interactive`), `.kpis` + `.kpi` (`.label .value
.delta.up/.down/.flat .foot`), `.list` + `.list-item` (`.title .meta .trail`), `.table.responsive` (td
`data-label`, `.primary`, `.r`), `.banner.info/.warn/.err/.ok/.brand`, `.timeline .ev`, `.copy-field`,
`.progress-bar>span`, `.install-steps`.
Controles: `.btn` + `.btn-primary/.btn-dark/.btn-secondary/.btn-ghost/.btn-danger/.btn-danger-ghost/.btn-ok/
.btn-wa` + `.btn-sm/.btn-lg/.btn-block/.btn-icon`, `.link-btn`, `.field` (+`.invalid`, `.hint`, `.error`),
`.input/.select/.textarea`, `.input-group` (ícono a la izquierda), `.form-grid.cols-2 .span-2`, `.check`,
`.switch` (`input` + `span.track`), `.seg` (botones con aria-pressed), `.chips` + `.chip` (aria-pressed),
`.tabs` (botones con aria-selected).
Datos: `.badge` (+ estado: `.pending .confirmed .completed .cancelled .no_show`, o `.ok .warn .err .info
.brand`, `.plain` sin punto), `.tag`, `.dot`, `.avatar` (`.sm .lg .xl`, `--c` color), `.kbd`, `.mono`, `.num`,
`.disp`, `.muted`, `.faint`, `.ok-t/.err-t/.warn-t/.brand-t`, `.eyebrow`, `.truncate`.
Movimiento: `.fade-up`, `.stagger` (hijos entran escalonados), `.flash`, `.shake`; skeletons `.skel`.
Colores por estado de cita: variables `--st-pending --st-confirmed --st-completed --st-cancelled --st-no_show`.
Puntos de quiebre: móvil < 720px (hojas inferiores), tablet 720–1023, escritorio ≥ 1024 (sidebar fija).

Si necesitas estilos propios de una vista, agrégalos en un `<style>` dentro de la vista (una sola vez, con
id, p. ej. `if(!document.getElementById('st-agenda')) document.head.insertAdjacentHTML('beforeend','<style id="st-agenda">…</style>')`),
usando SIEMPRE las variables de color/radio/sombra de app.css (claro y oscuro deben verse bien).

## Probar

- Demo: abre `/app/#/demo` (o `/app/` → "Probar la demo"). Todo corre en el navegador con datos ficticios.
- Servidor estático local: `npx http-server -p 8080 -c-1 /home/user/ISOVAL/new-gomez` → http://localhost:8080/app/
- Con backend real: `npm run dev` (wrangler) en `new-gomez/`.
- Playwright (Chromium en /opt/pw-browsers): prueba en 390×844 (iPhone), 412×915 (Android), 820×1180 (iPad),
  1440×900 (escritorio), claro y oscuro. Revisa consola sin errores.
