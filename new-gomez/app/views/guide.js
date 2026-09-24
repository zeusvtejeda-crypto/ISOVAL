// #/guia — Demo guiada: 5 pasos (≈5 minutos) para presentarla en una barbería, uno a la vez.
// Cada paso trae una frase para decir, qué hacer y un botón que lleva a la pantalla (cambiando de rol con
// switchDemoRole cuando hace falta). Debajo, atajos opcionales a otras funciones. Progreso en localStorage.
// Pública (sin sesión: botón «Empezar») y dentro del shell con sesión.
//
// Mientras se presenta, un «apuntador» flotante (fuera de #app) muestra el paso y «Siguiente» en cualquier pantalla.
//
// Exporta: GUIDE_STEPS [{ id, title }], readGuideProgress() → { done:[ids], open }, BOOKING_DEMO_URL.
import { html, raw, esc, $, on } from '../lib/html.js';
import { icon } from '../lib/icons.js';
import { api, getMode, setMode, LS, SITE_BASE, demoCredentials } from '../lib/api.js';
import { state, role, isSuper, today, nowMin, clearSession, loadMe, selectShop, preferredShopId } from '../lib/state.js';
import { toast, confirmDialog, busy } from '../lib/ui.js';
import { navigate, parseHash } from '../lib/router.js';
import { addDays } from '../lib/fmt.js';

const LS_KEY = 'tb:guide:v2';
const DEMO_DATA_KEY = 'tb:demo:data:v1'; // misma llave que app/lib/api.js (datos de la demo en este navegador)
export const BOOKING_DEMO_URL = SITE_BASE + '?b=demo';

// ── Búsquedas para llevar directo al ejemplo correcto ────────────────────
const upcoming = (a, t, now) => a.date > t || (a.date === t && a.start_min >= now);
const byWhen = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.start_min - b.start_min);
// La reserva que acaban de hacer en la página pública (o una pendiente, o la próxima).
async function freshBooking() {
  const t = today(), now = nowMin();
  const r = await api.get('/appointments', { from: t, to: addDays(t, 21), status: 'pending,confirmed', limit: 500 });
  const items = (r && r.items) || [];
  const recent = items.filter((a) => a.source === 'online' && a.created_at && Date.now() - Date.parse(a.created_at) < 3 * 3600e3)
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0];
  const pick = recent || items.filter((a) => a.status === 'pending' && upcoming(a, t, now)).sort(byWhen)[0] ||
    items.filter((a) => upcoming(a, t, now)).sort(byWhen)[0];
  return pick ? '/agenda?fecha=' + pick.date + '&cita=' + encodeURIComponent(pick.id) : '/agenda';
}
// Una cita de hoy que ya empezó (la más reciente) o, si no, la primera del día.
async function todayToCharge() {
  const t = today(), now = nowMin();
  const r = await api.get('/appointments', { from: t, to: t, status: 'pending,confirmed', limit: 500 });
  const items = ((r && r.items) || []).slice().sort(byWhen);
  const started = items.filter((a) => a.start_min <= now);
  const pick = started.length ? started[started.length - 1] : items[0];
  return pick ? '/agenda?fecha=' + t + '&cita=' + encodeURIComponent(pick.id) : '/agenda';
}
async function topClient() {
  const r = await api.get('/clients', { sort: 'visits', limit: 1 });
  const c = r && r.items && r.items[0];
  return c ? '/clientes/' + encodeURIComponent(c.id) : '/clientes?orden=visits';
}

// ── Guion ────────────────────────────────────────────────────────────────
// go: { role, accept, path | resolve(), fallback, reload, external, act, label, icon }
const STEPS = [
  {
    id: 'book', title: 'Tu cliente reserva', ic: 'user',
    say: 'Tus clientes reservan desde un enlace en tu Instagram o tu WhatsApp: eligen servicio, barbero y hora. Sin descargar nada y a cualquier hora.',
    todo: 'Reserva con un nombre y un celular inventados. Luego regresa aquí.',
    go: { external: BOOKING_DEMO_URL, label: 'Abrir página de reservas', icon: 'external' }
  },
  {
    id: 'confirm', title: 'Te llega y la confirmas', ic: 'whatsapp',
    say: 'La cita llega sola a tu agenda y nadie te la puede encimar. Con un toque la confirmas por tu WhatsApp, con el mensaje ya escrito.',
    todo: 'Toca «Confirmar cita» y luego «Enviar confirmación».',
    go: { role: 'owner', reload: true, resolve: freshBooking, fallback: '/agenda', label: 'Ver la cita', icon: 'calendar' }
  },
  {
    id: 'charge', title: 'Cobras al terminar', ic: 'cash',
    say: 'Al terminar el corte cobras desde la misma cita: efectivo, tarjeta o transferencia, con propina. Todo se suma solo a tu caja.',
    todo: 'Toca «Cobrar», elige cómo pagó y confirma.',
    go: { role: 'owner', accept: ['barber', 'owner'], resolve: todayToCharge, fallback: '/agenda', label: 'Cobrar una cita', icon: 'cash' }
  },
  {
    id: 'dashboard', title: 'Ves cómo va tu negocio', ic: 'chart',
    say: 'Aquí ves cuánto vendiste, cuántas citas tuviste y quién es tu barbero más activo. Sin libreta.',
    todo: 'Cambia el periodo: «Hoy», «7 días» o «30 días».',
    go: { role: 'owner', path: '/inicio?r=30d', label: 'Ver el negocio', icon: 'chart' }
  },
  {
    id: 'close', title: '¿Te la dejo lista hoy?', ic: 'store',
    say: 'La dejamos lista hoy con tus servicios, tus precios y tu equipo. Mañana ya compartes tu enlace.',
    todo: 'Si dice que sí, crea su barbería aquí mismo.',
    go: { act: 'signup', label: 'Crear su barbería', icon: 'store' }
  }
];
// Atajos opcionales (no cuentan en el avance).
const EXTRAS = [
  { id: 'x-barber', title: 'Vista del barbero', go: { role: 'barber', path: '/inicio', icon: 'scissors' } },
  { id: 'x-clients', title: 'Ficha de cliente', go: { role: 'owner', resolve: topClient, fallback: '/clientes', icon: 'users' } },
  { id: 'x-remind', title: 'Recordatorios', go: { role: 'owner', path: '/mensajes?tab=recordatorios', icon: 'whatsapp' } },
  { id: 'x-cash', title: 'Caja del día', go: { role: 'owner', path: '/caja', icon: 'wallet' } },
  { id: 'x-comm', title: 'Comisiones', go: { role: 'owner', path: '/comisiones', icon: 'percent' } },
  { id: 'x-qr', title: 'Enlace y QR', go: { role: 'owner', path: '/enlace', icon: 'qr' } },
  { id: 'x-multi', title: 'Varias sucursales', go: { role: 'superadmin', path: '/plataforma', icon: 'shield' } }
].map((x) => ({ ...x, extra: true }));
const FAQ = [
  ['Mis clientes no usan apps.', 'No descargan nada: reservan desde un enlace, como abrir cualquier página. Y si te escriben o te llaman, tú apuntas la cita en 10 segundos.'],
  ['No tengo tiempo para aprender.', 'Si sabes usar WhatsApp, sabes usar esto. Te la dejamos lista; tu primer día solo compartes el enlace.'],
  ['¿Y si no hay internet?', 'Tus clientes reservan desde su propio celular, así que la agenda se sigue llenando. Tú la ves con los datos de tu celular.'],
  ['¿Cuánto cuesta?', 'Crear tu barbería es gratis y sin tarjeta. Con que te ahorre una o dos faltas al mes, ya se pagó sola.']
];
export const GUIDE_STEPS = STEPS.map((s) => ({ id: s.id, title: s.title }));

// ── Progreso (este dispositivo) ──────────────────────────────────────────
export function readGuideProgress() {
  try {
    const p = JSON.parse(LS.get(LS_KEY) || 'null') || {};
    const ids = new Set(STEPS.map((s) => s.id));
    return { done: Array.isArray(p.done) ? p.done.filter((id) => ids.has(id)) : [], open: ids.has(p.open) ? p.open : null };
  } catch (e) { return { done: [], open: null }; }
}
const P = readGuideProgress();
const done = new Set(P.done);
let openId = P.open || STEPS[0].id;
const save = () => LS.set(LS_KEY, JSON.stringify({ done: Array.from(done), open: openId }));
const idx = (id) => STEPS.findIndex((s) => s.id === id);
const nextUndone = (after) => { const i = after ? idx(after) : -1; return STEPS.slice(i + 1).find((s) => !done.has(s.id)) || STEPS.find((s) => !done.has(s.id)) || null; };

// ── Sesión y rol ─────────────────────────────────────────────────────────
const authed = () => !!(state.user || state.staff);
const demoSession = () => getMode() === 'demo' && authed();
function currentRole() {
  if (!authed()) return null;
  if (isSuper()) return 'superadmin';
  return role();
}
// Entra a la demo con el rol pedido y muestra `path` directamente (mismo flujo que window.TB.demoLogin, pero sin
// pasar por el inicio: demoLogin navega al inicio y esa vista, al terminar de cargar, pisaría a la que sigue).
async function switchDemoRole(roleKey, path) {
  const c = (await demoCredentials())[roleKey];
  if (!c) throw new Error('Rol de demo desconocido');
  setMode('demo'); state.mode = 'demo';
  try { await api.post('/auth/logout'); } catch (e) { /* */ }
  clearSession();
  await api.post('/auth/login', { email: c.email, password: c.password });
  await loadMe();
  history.replaceState(null, '', '#' + path);
  const id = preferredShopId();
  if (id) await selectShop(id); // emite 'context' → el shell se arma y pinta la ruta actual (path)
  else navigate(path, { replace: true, force: true });
}
const needsSwitch = (g) => !!g.role && !(demoSession() && [].concat(g.accept || g.role).includes(currentRole()));
const askLeaveReal = () => confirmDialog({ title: '¿Abrir la demo?', message: 'Vas a ver una barbería con datos ficticios. Tu sesión real queda guardada: al salir de la demo vuelves a entrar con tu correo.', confirmText: 'Abrir la demo', icon: 'sparkles' });

// Texto del guion: se escapa y los nombres de botones «así» se resaltan.
const fmt = (s) => raw(esc(s).replace(/«([^»]+)»/g, '<b class="gd-k">$1</b>'));

// ── Aviso de reserva nueva desde otra pestaña (página pública de la demo) ──
// La demo vive en memoria en cada pestaña; cuando la página pública guarda una reserva, este evento avisa.
let mounted = null;
let bookedAt = 0;
window.addEventListener('storage', (e) => {
  if (e.key !== DEMO_DATA_KEY || getMode() !== 'demo') return;
  bookedAt = Date.now();
  if (mounted) mounted.onBooking();
  paintCoach();
});

// ── Ir a un paso («Probar») ──────────────────────────────────────────────
let running = false;
async function runGo(step, g, btn, opts) {
  opts = opts || {};
  if (running) return;
  if (g.act) return runAct(g.act, btn);
  const track = !step.extra;
  if (g.external) { // se llama dentro del clic para que el navegador no bloquee la pestaña nueva
    // Sin 'noopener' para poder saber si se abrió: algunos navegadores (app instalada en iPhone,
    // visores embebidos) bloquean la pestaña nueva y devuelven null → se abre en esta misma pestaña.
    let w = null;
    try { w = window.open(g.external, '_blank'); } catch (e) { w = null; }
    if (track) markDone(step.id, { advance: true });
    if (!w) { location.href = g.external; return; }
    try { w.opener = null; } catch (e) { /* */ }
    toast.info('Se abrió la página de reservas en otra pestaña. Reserva y regresa aquí.', { duration: 5200 });
    return;
  }
  const sw = needsSwitch(g);
  if (sw && authed() && getMode() !== 'demo' && !(await askLeaveReal())) return;
  const coachOn = () => (track ? showCoach(step) : hideCoach());
  running = true;
  try {
    await busy(btn, async () => {
      // Una reserva hecha en otra pestaña solo se ve al recargar (cada pestaña tiene la demo en memoria).
      if (g.reload && getMode() === 'demo' && authed() && !opts.fresh) {
        markDone(step.id, { advance: true });
        history.replaceState(null, '', '#/guia?ir=' + encodeURIComponent(step.id));
        location.reload();
        await new Promise(() => {}); // la página se recarga
      }
      if (track) markDone(step.id, { advance: true });
      const fromGuide = parseHash().path === '/guia';
      let path = g.path;
      if (sw) {
        if (fromGuide) history.pushState(null, '', location.hash); // «Atrás» regresa a la guía
        if (g.resolve) {
          // El ejemplo se busca con la sesión nueva: mientras, se queda en la guía (ya cargada, se pinta al instante).
          await switchDemoRole(g.role, '/guia');
          try { path = await g.resolve(); } catch (e) { path = g.fallback; }
          coachOn();
          navigate(path, { replace: true, force: true });
        } else {
          coachOn();
          await switchDemoRole(g.role, path);
        }
      } else {
        if (g.resolve) { try { path = await g.resolve(); } catch (e) { path = g.fallback; } }
        coachOn();
        navigate(path, { force: true });
      }
      paintCoach(); // navigate con replace no dispara 'hashchange'
    });
  } catch (err) {
    console.error(err);
    toast.error(err && err.message ? err : 'No pudimos abrir ese paso. Intenta de nuevo.');
  } finally { running = false; }
}
async function runAct(act, btn) {
  if (act === 'reset') {
    done.clear(); openId = STEPS[0].id; save(); hideCoach();
    if (mounted) mounted.paint();
    toast.success('Listo, la guía empieza de nuevo');
    return;
  }
  if (act === 'enter') {
    if (authed() && getMode() !== 'demo' && !(await askLeaveReal())) return;
    running = true;
    try {
      await busy(btn, async () => { await switchDemoRole('owner', '/guia'); });
    } catch (err) { console.error(err); toast.error(err); } finally { running = false; }
    return;
  }
  if (act === 'signup') {
    markDone('close');
    if (demoSession() || getMode() === 'demo') {
      const ok = await confirmDialog({ title: 'Crear su barbería', message: 'Salimos de la demo para crear una barbería real con sus datos. La demo se queda guardada en este dispositivo.', confirmText: 'Continuar', icon: 'store' });
      if (!ok) return;
      hideCoach();
      try { await busy(btn, api.post('/auth/logout').catch(() => null)); } catch (e) { /* */ }
      setMode('server'); state.mode = 'server';
      clearSession();
    }
    navigate('/crear-barberia', { force: true });
  }
}
function markDone(id, o) {
  done.add(id);
  if (o && o.advance) { const n = nextUndone(id); openId = n ? n.id : id; }
  save();
  if (mounted) mounted.paint();
}

// ── Apuntador flotante (paso actual sobre cualquier pantalla) ────────────
let coach = null; // { id, open }
const COACH_ID = 'gdCoach';
function showCoach(step) {
  if (step.id === 'close') return hideCoach();
  coach = { id: step.id, open: false };
  paintCoach();
}
function hideCoach() { coach = null; const c = document.getElementById(COACH_ID); if (c) c.remove(); }
function paintCoach() {
  let box = document.getElementById(COACH_ID);
  const { path } = parseHash();
  if (!coach || path === '/guia' || getMode() !== 'demo' || !authed() || ['/login', '/demo', '/registro', '/crear-barberia'].includes(path)) { if (box) box.remove(); return; }
  const i = idx(coach.id);
  const s = STEPS[i];
  if (!s) return hideCoach();
  const nx = STEPS[i + 1];
  const fresh = s.id === 'book' && bookedAt;
  if (!box) {
    box = document.createElement('aside');
    box.id = COACH_ID;
    box.className = 'gd-coach';
    box.setAttribute('aria-label', 'Paso de la demo guiada');
    document.body.appendChild(box);
    box.addEventListener('click', onCoachClick);
  }
  box.classList.toggle('open', coach.open);
  box.innerHTML = String(html`
    <div class="gd-cbar">
      <button type="button" class="gd-cmain" data-coach="toggle" aria-expanded="${String(coach.open)}" aria-controls="gdCoachBody">
        <span class="gd-cn">${i + 1}<small>/${STEPS.length}</small></span>
        <span class="grow truncate">${s.title}</span>
        ${raw(icon(coach.open ? 'chevron-down' : 'chevron-up', 'ic-sm'))}
      </button>
      ${nx ? html`<button type="button" class="btn btn-primary btn-sm gd-cnx" data-coach="next">Siguiente${raw(icon('arrow-right', 'ic-sm'))}</button>` : ''}
      <button type="button" class="gd-cx" data-coach="close" aria-label="Ocultar">${raw(icon('x', 'ic-sm'))}</button>
    </div>
    <div class="gd-cbody" id="gdCoachBody" ${coach.open ? '' : 'hidden'}>
      ${fresh ? html`<p class="gd-cnew">${raw(icon('bell', 'ic-sm'))}¡Llegó la reserva! Toca «Siguiente».</p>` : ''}
      <p class="gd-csay">“${fmt(s.say)}”</p>
      <p class="gd-ctodo">${fmt(s.todo)}</p>
      <a class="link-btn gd-cguide" href="#/guia">${raw(icon('book', 'ic-sm'))}Ver la guía</a>
    </div>`);
}
function onCoachClick(e) {
  const b = e.target.closest('[data-coach]');
  if (!b || !coach) return;
  const k = b.dataset.coach;
  if (k === 'toggle') { coach.open = !coach.open; paintCoach(); return; }
  if (k === 'close') { hideCoach(); return; }
  if (k === 'next') {
    const nx = STEPS[idx(coach.id) + 1];
    if (!nx) return;
    markDone(coach.id);
    if (nx.go.act) { openId = nx.id; save(); hideCoach(); navigate('/guia'); return; }
    runGo(nx, nx.go, b);
  }
}
window.addEventListener('hashchange', () => { if (coach) paintCoach(); });
// Salir de la demo o cerrar sesión repinta #app (sin 'hashchange'): el apuntador se oculta solo.
const appRoot = document.getElementById('app');
if (appRoot && typeof MutationObserver !== 'undefined') new MutationObserver(() => { if (coach || document.getElementById(COACH_ID)) paintCoach(); }).observe(appRoot, { childList: true });

// ── Estilos (una sola vez) ───────────────────────────────────────────────
const CSS = `
.gd-wrap{max-width:620px;margin:0 auto;display:grid;gap:14px;animation:pageIn .32s var(--ease-out)}
.gd-bare{padding:calc(14px + var(--safe-t)) 16px calc(40px + var(--safe-b))}
@media (min-width:1024px){.gd-bare{padding:26px 32px 64px}}
.gd-top{min-height:44px}
.gd-top .logo-mark{width:34px;height:34px;border-radius:10px}.gd-top .logo-mark svg{width:19px;height:19px}
.gd-top .brandname{font-size:19px}
.gd-top .link-btn{min-height:44px}
.gd-hero{position:relative;overflow:hidden;isolation:isolate;padding:22px 20px;border-radius:var(--r-xl);background:var(--ink);color:#F2EDE3;border:1px solid rgba(217,178,90,.2);box-shadow:var(--shadow-2)}
.gd-hero::before{content:"";position:absolute;inset:-30%;z-index:-1;background:radial-gradient(circle at 16% 10%,rgba(217,178,90,.25),transparent 42%),radial-gradient(circle at 94% 100%,rgba(217,178,90,.13),transparent 40%);pointer-events:none}
.gd-hero .eyebrow{color:#D9B25A;display:flex;align-items:center;gap:6px}.gd-hero .eyebrow .ic{width:14px;height:14px}
.gd-hero h3{font-family:var(--disp);font-size:34px;font-weight:800;line-height:.98;letter-spacing:.01em;margin:10px 0 8px}
.gd-hero h3 em{font-style:normal;color:#D9B25A}
.gd-hero .lede{color:#BDB5A5;font-size:15px}
.gd-hero .btn{margin-top:18px}
.gd-hero .gd-note{display:block;font-size:12.5px;color:#A39A88;margin-top:10px}
.gd-card{padding:20px;display:grid;gap:14px}
.gd-pos{display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:12.5px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--text-3)}
.gd-dots{display:flex;gap:6px}
.gd-dots button{width:30px;height:30px;display:grid;place-items:center;border-radius:50%}
.gd-dots i{display:block;width:10px;height:10px;border-radius:50%;background:var(--border-strong);transition:background .2s,transform .2s}
.gd-dots .on i{background:var(--ok)}
.gd-dots [aria-current="step"] i{background:var(--brand);transform:scale(1.35)}
.gd-ttl{display:flex;align-items:center;gap:12px}
.gd-ttl .ib{flex:none;width:44px;height:44px;border-radius:14px;background:var(--brand-soft);color:var(--brand-strong);display:grid;place-items:center}
.gd-ttl .ib .ic{width:22px;height:22px}
.gd-ttl h3{font-family:var(--disp);font-size:28px;font-weight:800;line-height:1;letter-spacing:.01em}
.gd-say{padding:12px 14px 12px 16px;border-radius:12px;background:var(--brand-softer);border-left:3px solid var(--brand);font-size:16px;line-height:1.55;color:var(--text)}
.gd-todo{display:flex;gap:10px;align-items:flex-start;font-size:15px;line-height:1.5;color:var(--text-2)}
.gd-todo .ic{width:18px;height:18px;flex:none;margin-top:2px;color:var(--brand-strong)}
.gd-k{font-weight:600;color:var(--text)}
.gd-new{display:flex;gap:10px;align-items:center;padding:10px 12px;border-radius:12px;background:var(--ok-soft);color:var(--ok);font-size:14px;font-weight:600;animation:fadeUp .3s var(--ease-out)}
.gd-new .ic{width:18px;height:18px;flex:none}
.gd-nav{display:flex;justify-content:space-between;gap:8px}
.gd-nav .btn[disabled]{visibility:hidden}
.gd-sub{font-size:12.5px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--text-3);margin:6px 2px 0}
.gd-xs{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px}
.gd-xs .btn{justify-content:flex-start}
.gd-faq{display:grid;gap:8px}
.gd-faq details{border:1px solid var(--border);border-radius:12px;background:var(--surface);transition:border-color .15s}
.gd-faq details[open]{border-color:var(--border-strong);background:var(--surface-2)}
.gd-faq summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:10px;min-height:48px;padding:10px 14px;font-weight:600;font-size:14.5px}
.gd-faq summary::-webkit-details-marker{display:none}
.gd-faq summary .ic{margin-left:auto;color:var(--text-3);transition:transform .2s var(--ease)}
.gd-faq details[open] summary .ic{transform:rotate(180deg)}
.gd-faq summary q{quotes:"“" "”"}
.gd-faq details p{padding:0 14px 14px;font-size:14px;color:var(--text-2);line-height:1.55}
.gd-foot{display:flex;justify-content:center;gap:18px;flex-wrap:wrap;font-size:13.5px}
.gd-foot .link-btn{min-height:44px}
.gd-coach{position:fixed;z-index:35;left:12px;right:12px;bottom:calc(var(--bottomnav-h) + var(--safe-b) + 10px);max-width:440px;margin:0 auto;border-radius:18px;background:#15130F;color:#F2EDE3;border:1px solid rgba(217,178,90,.28);box-shadow:0 18px 40px rgba(0,0,0,.32),0 2px 8px rgba(0,0,0,.2);animation:toastIn .35s var(--ease-out);overflow:hidden}
body:not(.has-shell) .gd-coach{bottom:calc(16px + var(--safe-b))}
@media (min-width:1024px){.gd-coach{left:calc(var(--sidebar-w) + 24px);right:auto;bottom:24px;width:400px;margin:0}}
.gd-cbar{display:flex;align-items:center;gap:4px;padding-right:2px}
.gd-cmain{flex:1;min-width:0;display:flex;align-items:center;gap:10px;min-height:54px;padding:8px 4px 8px 12px;text-align:left;color:#F2EDE3;font-size:14px;font-weight:600}
.gd-cmain>.ic{color:#A39A88;flex:none}
.gd-cn{flex:none;min-width:38px;height:38px;padding:0 6px;border-radius:12px;background:rgba(217,178,90,.16);color:#E6C173;display:grid;place-items:center;font-family:var(--disp);font-weight:800;font-size:19px;line-height:1;grid-auto-flow:column;align-items:baseline;justify-content:center}
.gd-cn small{font-family:var(--sans);font-size:10.5px;font-weight:600;color:#A39A88}
.gd-cnx{flex:none}
.gd-cx{flex:none;width:40px;height:54px;display:grid;place-items:center;color:#A39A88}
.gd-cx:hover,.gd-cmain:hover>.ic{color:#F2EDE3}
.gd-cbody{padding:12px 14px 14px;display:grid;gap:10px;max-height:min(52vh,420px);overflow:auto;border-top:1px solid rgba(242,237,227,.08);animation:fadeUp .25s var(--ease-out)}
.gd-csay{font-size:14.5px;line-height:1.5;color:#F2EDE3;padding-left:10px;border-left:2px solid #D9B25A}
.gd-ctodo{font-size:13.5px;color:#BDB5A5;line-height:1.45}
.gd-csay .gd-k,.gd-ctodo .gd-k{color:#F2EDE3}
.gd-cnew{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;color:#6FBF8A}
.gd-coach .gd-cguide{color:#E6C173;justify-self:start;min-height:36px}
@media (prefers-reduced-motion:reduce){.gd-coach,.gd-cbody,.gd-wrap{animation:none}}
`;

// ── Vista ────────────────────────────────────────────────────────────────
export default {
  title: 'Demo guiada',
  async render(el, { query, bare }) {
    if (!document.getElementById('st-guide')) document.head.insertAdjacentHTML('beforeend', '<style id="st-guide">' + CSS + '</style>');
    if (!running) hideCoach(); // al volver a la guía se guarda el apuntador (no durante un cambio de rol)
    let gone = false;

    const top = bare ? html`<div class="row between gd-top">
        <a href="#/demo" class="link-btn">${raw(icon('arrow-left', 'ic-sm'))}Volver</a>
        <span class="row" style="gap:8px"><span class="logo-mark">${raw(icon('logo'))}</span><span class="brandname">Tu<b>Barbería</b></span></span>
      </div>` : '';
    el.innerHTML = '<div class="gd-wrap' + (bare ? ' gd-bare' : '') + '">' + String(top) + '<div id="gdMain" class="gd-wrap" style="gap:14px"></div></div>';

    const stepCard = (s) => {
      const i = idx(s.id), prev = STEPS[i - 1], next = STEPS[i + 1];
      const newBooking = s.id === 'confirm' && bookedAt;
      return html`<section class="card gd-card" aria-labelledby="gdT">
        <div class="gd-pos"><span>Paso ${i + 1} de ${STEPS.length}</span>
          <span class="gd-dots">${STEPS.map((x, j) => html`<button type="button" data-open="${x.id}" class="${done.has(x.id) ? 'on' : ''}" ${x.id === s.id ? raw('aria-current="step"') : ''} aria-label="Paso ${j + 1}: ${x.title}"><i></i></button>`)}</span></div>
        <div class="gd-ttl"><span class="ib">${raw(icon(s.ic))}</span><h3 id="gdT">${s.title}</h3></div>
        ${newBooking ? html`<div class="gd-new" role="status">${raw(icon('bell'))}¡Llegó la reserva! Toca «${s.go.label}».</div>` : ''}
        <p class="gd-say">“${fmt(s.say)}”</p>
        <p class="gd-todo">${raw(icon('smartphone'))}<span>${fmt(s.todo)}</span></p>
        <button type="button" class="btn btn-primary btn-lg btn-block" data-go="${s.id}">${raw(icon(s.go.icon))}${s.go.label}</button>
        <div class="gd-nav">
          <button type="button" class="btn btn-ghost" data-open="${prev ? prev.id : ''}" ${prev ? '' : 'disabled'}>${raw(icon('arrow-left', 'ic-sm'))}Anterior</button>
          <button type="button" class="btn btn-ghost" data-open="${next ? next.id : ''}" ${next ? '' : 'disabled'}>Siguiente${raw(icon('arrow-right', 'ic-sm'))}</button>
        </div>
      </section>`;
    };
    const paint = () => {
      if (gone || !el.isConnected) return;
      const main = $('#gdMain', el);
      const a = document.activeElement;
      const refocus = a && main.contains(a) && a.dataset && a.dataset.open ? a.dataset.open : null;
      const s = STEPS[idx(openId)] || STEPS[0];
      const inDemo = demoSession();
      // Ya dentro de la demo, el paso va arriba (sin portada) para que su botón quede a la vista en el celular.
      main.innerHTML = String(html`
        ${inDemo ? '' : html`<section class="gd-hero" aria-labelledby="gdTitle">
          <span class="eyebrow">${raw(icon('book'))}Demo guiada · 5 minutos</span>
          <h3 id="gdTitle">Enséñala en <em>5 pasos.</em></h3>
          <p class="lede">Di la frase con tus palabras y toca el botón. La app hace el resto.</p>
          <button type="button" class="btn btn-primary btn-lg btn-block" data-act="enter">${raw(icon('play'))}Empezar</button>
          <span class="gd-note">Sin registrarte: entras como dueño a una barbería con datos de ejemplo.</span>
        </section>`}
        ${inDemo ? html`
          ${stepCard(s)}
          <h4 class="gd-sub">Si te pide ver más</h4>
          <div class="gd-xs">${EXTRAS.map((x) => html`<button type="button" class="btn btn-secondary" data-x="${x.id}">${raw(icon(x.go.icon))}${x.title}</button>`)}</div>` : ''}
        ${s.id === 'close' || !inDemo ? html`
          <h4 class="gd-sub">Si te pregunta</h4>
          <div class="gd-faq">${FAQ.map(([q, ans]) => html`<details><summary><q>${q}</q>${raw(icon('chevron-down', 'ic-sm'))}</summary><p>${ans}</p></details>`)}</div>` : ''}
        ${inDemo && done.size ? html`<div class="gd-foot"><button type="button" class="link-btn" data-act="reset">${raw(icon('refresh', 'ic-sm'))}Volver a empezar</button></div>` : ''}`);
      if (refocus) { const f = $('[data-open="' + refocus + '"]', main) || $('[data-go]', main); if (f) f.focus({ preventScroll: true }); }
    };
    paint();

    mounted = {
      el,
      paint,
      onBooking() {
        if (gone || !el.isConnected) { if (mounted && mounted.el === el) mounted = null; return; }
        done.add('book');
        if (!done.has('confirm')) openId = 'confirm';
        save(); paint();
        const s = STEPS[idx('confirm')];
        toast.success('¡Llegó la reserva desde la página pública!', { duration: 6000, action: { label: 'Ver la cita', onClick: () => runGo(s, s.go, null) } });
      }
    };

    // ── Eventos ──
    const offs = [
      on(el, 'click', '[data-open]', (e, b) => { if (!b.dataset.open) return; openId = b.dataset.open; save(); paint(); }),
      on(el, 'click', '[data-go]', (e, b) => { const s = STEPS[idx(b.dataset.go)]; if (s) runGo(s, s.go, b); }),
      on(el, 'click', '[data-x]', (e, b) => { const x = EXTRAS.find((y) => y.id === b.dataset.x); if (x) runGo(x, x.go, b); }),
      on(el, 'click', '[data-act]', (e, b) => runAct(b.dataset.act, b))
    ];

    // Vuelta de la recarga (paso con reserva de otra pestaña): se continúa solo.
    const pending = query.ir && STEPS[idx(query.ir)];
    if (pending) {
      history.replaceState(null, '', '#/guia');
      if (getMode() === 'demo') setTimeout(() => { if (!gone) runGo(pending, pending.go, null, { fresh: true }); }, 60);
    }

    return () => {
      gone = true;
      mounted = null;
      offs.forEach((f) => f());
    };
  }
};
