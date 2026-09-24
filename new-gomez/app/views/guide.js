// #/guia — Guía para presentar la demo en una barbería: guion de ~10 minutos, paso a paso.
// Cada paso trae qué decir (frases entre comillas), qué tocar y un botón «Probar ahora» que lleva a la pantalla
// (cambiando de rol con window.TB.demoLogin cuando hace falta). Checklist con progreso en localStorage.
// Pública (sin sesión: CTA «Entrar a la demo») y dentro del shell con sesión.
//
// Mientras se presenta, un «apuntador» flotante (fuera de #app) muestra el guion del paso en cualquier pantalla.
//
// Exporta: GUIDE_STEPS [{ id, title, sec }], readGuideProgress() → { done:[ids], open }, BOOKING_DEMO_URL.
import { html, raw, esc, $, $$, on } from '../lib/html.js';
import { icon } from '../lib/icons.js';
import { api, getMode, setMode, LS, SITE_BASE, demoCredentials } from '../lib/api.js';
import { state, role, isSuper, today, nowMin, clearSession, loadMe, selectShop, preferredShopId } from '../lib/state.js';
import { toast, confirmDialog, busy } from '../lib/ui.js';
import { navigate, parseHash } from '../lib/router.js';
import { addDays } from '../lib/fmt.js';

const LS_KEY = 'tb:guide:v1';
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
// who: prep | client | owner | barber | superadmin | close. sec: duración sugerida.
// go: { role, accept, path | resolve(), fallback, reload, external, act, label, icon }
const WHO = {
  prep: ['check-circle', 'Antes de empezar'], client: ['user', 'Como cliente'], owner: ['crown', 'Como dueño'],
  barber: ['scissors', 'Como barbero'], either: ['scissors', 'Barbero o dueño'], superadmin: ['shield', 'Como superadmin'], close: ['message', 'Plática final']
};
const STEPS = [
  {
    id: 'prep', title: 'Prepara la demo', who: 'prep', sec: 120,
    say: ['Te voy a enseñar en 10 minutos cómo se vería tu barbería con TuBarbería. Todo lo que vas a ver son datos de ejemplo, así que podemos picarle a todo sin miedo.'],
    tap: ['Entra a la demo como «Dueño» (el botón «Probar ahora» lo hace por ti).',
      'Instálala en tu celular desde «Instalar app»: se abre a pantalla completa, como cualquier app.',
      'Opcional: activa el «Modo oscuro». Luce muy bien con la luz de la barbería.',
      'Ten a la mano este mismo dispositivo en otra pestaña para hacer de cliente.'],
    tip: 'Si algo se desacomoda, en «Cambiar rol» → «Reiniciar datos de la demo» vuelves a empezar con todo limpio.',
    go: { role: 'owner', path: '/instalar', label: 'Instalar en el celular', icon: 'download' },
    alts: [{ act: 'theme' }]
  },
  {
    id: 'book', title: 'El cliente reserva desde tu enlace', who: 'client', sec: 90,
    say: ['Así reservan tus clientes: desde el enlace en tu Instagram, tu WhatsApp o el QR del mostrador. Eligen servicio, barbero y hora, sin descargar nada y sin llamarte.',
      'Funciona las 24 horas: aunque estés cortando o dormido, tu agenda se sigue llenando.'],
    tap: ['Toca «Abrir página de reservas»: se abre en otra pestaña, tal como la ve el cliente.',
      'Elige un servicio, «Cualquier barbero» y una hora libre.',
      'Escribe un nombre y un celular de 10 dígitos inventados, y confirma.',
      'Enséñale el folio y el botón para cambiar o cancelar la cita.'],
    tip: 'Hazlo en este mismo dispositivo: la demo vive solo en este navegador, y así la reserva le llega al dueño.',
    go: { external: BOOKING_DEMO_URL, label: 'Abrir página de reservas', icon: 'external' }
  },
  {
    id: 'notify', title: 'Te llega el aviso y la ves en tu agenda', who: 'owner', sec: 45,
    say: ['En cuanto el cliente reserva, te llega el aviso aquí, en la campanita. Ya no tienes que andar revisando mensajes para saber quién viene.',
      'La cita aparece sola en tu agenda, con el color del barbero, y nadie te la puede encimar.'],
    tap: ['Regresa a esta pestaña y toca «Ver el aviso».',
      'Toca la notificación «Nueva reserva» para abrir la cita.',
      'En «Agenda», enséñale la vista por día (una columna por barbero) y la de semana.'],
    go: { role: 'owner', reload: true, path: '/notificaciones', label: 'Ver el aviso', icon: 'bell' },
    alts: [{ go: { role: 'owner', reload: true, path: '/agenda', label: 'Ver la agenda', icon: 'calendar' } }]
  },
  {
    id: 'confirm', title: 'Confirma por WhatsApp en un toque', who: 'owner', sec: 45,
    say: ['Con un toque se abre WhatsApp con el mensaje ya escrito: fecha, hora, servicio y un enlace para que el cliente cambie su cita si lo necesita.',
      'Usas tu mismo WhatsApp de siempre. No necesitas otra app ni pagar nada extra.'],
    tap: ['Abre la cita: el botón te lleva a la reserva más reciente.',
      'Si está pendiente, toca «Confirmar cita» y luego «Enviar confirmación».',
      'Si ya estaba confirmada, toca el botón verde de WhatsApp → «Enviar confirmación».'],
    tip: 'En la demo no se manda nada a nadie: WhatsApp se abre con el mensaje como borrador.',
    go: { role: 'owner', resolve: freshBooking, fallback: '/agenda', label: 'Abrir la cita', icon: 'whatsapp' }
  },
  {
    id: 'barber', title: 'El barbero ve su día', who: 'barber', sec: 45,
    say: ['Cada barbero entra con su propio acceso, o con un PIN de 4 números en la tablet de la barbería. Solo ve sus citas, sus clientes y lo que lleva ganado; la caja y lo de los demás, no.'],
    tap: ['El botón cambia la demo al rol «Barbero» (Luis).',
      'Enséñale «Mi día»: sus citas en orden y lo que lleva ganado hoy.',
      'Cuéntale que en la tablet de la barbería cada barbero entra con su PIN (lo crea en «Mi perfil»).'],
    go: { role: 'barber', path: '/inicio', label: 'Ver como barbero', icon: 'scissors' }
  },
  {
    id: 'charge', title: 'Cobra y marca la cita como atendida', who: 'either', sec: 60,
    say: ['Al terminar el corte se cobra desde la misma cita: efectivo, tarjeta o transferencia, y hasta la propina. Queda como atendida y se suma sola a la caja y a las comisiones.'],
    tap: ['Abre una cita de hoy: el botón te lleva a una.',
      'Toca «Cobrar», elige el método y agrega propina si quieres.',
      'Confirma: la cita pasa a «Atendida».'],
    go: { role: 'owner', accept: ['barber', 'owner'], resolve: todayToCharge, fallback: '/agenda', label: 'Cobrar una cita', icon: 'cash' }
  },
  {
    id: 'cash', title: 'La caja del día, cuadrada', who: 'owner', sec: 45,
    say: ['Al final del día sabes exactamente cuánto entró en efectivo, tarjeta y transferencia. Abres caja con tu fondo, anotas gastos y al cerrar te dice si sobra o falta.'],
    tap: ['Abre «Caja y pagos».', 'Enséñale el resumen por método de pago y los movimientos.', 'Toca «Cerrar caja» para ver el corte (no hace falta confirmarlo).'],
    go: { role: 'owner', path: '/caja', label: 'Abrir la caja', icon: 'wallet' }
  },
  {
    id: 'dashboard', title: 'Cómo va tu negocio, de un vistazo', who: 'owner', sec: 60,
    say: ['Aquí ves cuánto vendiste, cuántas citas tuviste, tu ticket promedio y quién es tu barbero más activo.',
      'Lo comparas contra el periodo anterior y filtras por fechas o por barbero.'],
    tap: ['Abre «Inicio» como dueño.', 'Cambia el periodo: «Hoy», «7 días», «30 días», «Este mes» o «Personalizado».', 'Señala «Barbero más activo» y la gráfica de ingresos.'],
    go: { role: 'owner', path: '/inicio?r=30d', label: 'Ver el dashboard', icon: 'chart' }
  },
  {
    id: 'clients', title: 'Tus clientes, con historial y notas', who: 'owner', sec: 45,
    say: ['Cada cliente se guarda solo: cuántas veces ha venido, cuánto ha gastado, cuándo fue su último corte y notas como «fade bajo, del 2».',
      'Así cualquier barbero lo atiende como si lo conociera de años.'],
    tap: ['Abre la ficha de un cliente frecuente: el botón te lleva.', 'Enséñale su historial, lo que ha gastado y sus notas.', 'Agrega una nota o la etiqueta «VIP».'],
    go: { role: 'owner', resolve: topClient, fallback: '/clientes', label: 'Ver un cliente frecuente', icon: 'users' }
  },
  {
    id: 'reminders', title: 'Recordatorios de mañana por WhatsApp', who: 'owner', sec: 45,
    say: ['Un día antes les recuerdas a todos tus clientes de mañana en unos cuantos toques. Menos olvidos, menos sillas vacías.'],
    tap: ['Abre «WhatsApp» → «Recordatorios».', 'Aparecen las citas de mañana con el mensaje ya escrito.', 'Toca «Enviar» en una: se abre WhatsApp con el texto listo.'],
    go: { role: 'owner', path: '/mensajes?tab=recordatorios', label: 'Ver recordatorios', icon: 'whatsapp' }
  },
  {
    id: 'commissions', title: 'Comisiones claras, sin pleitos', who: 'owner', sec: 30,
    say: ['Cada barbero tiene su porcentaje y el sistema calcula solo cuánto le toca por quincena, con propinas y lo que ya se le pagó.'],
    tap: ['Abre «Comisiones».', 'Cambia a «Quincena pasada».', 'Toca «Registrar pago» en un barbero.'],
    go: { role: 'owner', path: '/comisiones', label: 'Ver comisiones', icon: 'percent' }
  },
  {
    id: 'link', title: 'Tu enlace y tu QR para imprimir', who: 'owner', sec: 30,
    say: ['Este es tu enlace de reservas: lo pones en Instagram, Facebook, Google Maps y en tu estado de WhatsApp. Y el QR lo imprimes y lo pegas en el espejo o en el mostrador.'],
    tap: ['Abre «Enlace y QR».', 'Enséñale el QR y el botón para imprimirlo.', 'Copia el enlace para compartirlo.'],
    go: { role: 'owner', path: '/enlace', label: 'Ver enlace y QR', icon: 'qr' }
  },
  {
    id: 'multi', title: 'Varias sucursales, una sola cuenta', who: 'superadmin', sec: 30,
    say: ['Si tienes más de una sucursal, cada una lleva su agenda, su equipo y su caja por separado, y tú las ves todas desde un solo lugar.'],
    tap: ['El botón cambia la demo a «Superadmin».', 'Enséñale la lista de barberías con sus citas e ingresos.', 'Entra a una para verla como su dueño.'],
    go: { role: 'superadmin', path: '/plataforma', label: 'Ver todas las barberías', icon: 'shield' }
  },
  {
    id: 'close', title: 'Cierre y preguntas frecuentes', who: 'close', sec: 90,
    say: ['¿Qué te pareció? La podemos dejar lista hoy mismo con tus servicios, tus precios y tu equipo, y mañana ya compartes tu enlace.'],
    tip: 'Ten a la mano el precio vigente de los planes y termina con una pregunta concreta: «¿Te la dejo lista hoy?»',
    go: { act: 'signup', label: 'Crear su barbería', icon: 'store' },
    alts: [{ act: 'reset' }]
  }
];
const BENEFITS = [
  ['calendar-check', 'Agenda llena 24/7', 'Reservas a cualquier hora, sin contestar mensajes.'],
  ['whatsapp', 'Menos faltas', 'Confirmaciones y recordatorios por WhatsApp.'],
  ['wallet', 'Cuentas claras', 'Caja, comisiones y reportes sin libreta.'],
  ['users', 'Clientes que regresan', 'Historial y notas de cada cliente.'],
  ['smartphone', 'Desde tu celular', 'Sin comprar equipo ni instalar nada raro.']
];
const FAQ = [
  ['Mis clientes no usan apps.', 'No tienen que descargar nada: reservan desde un enlace, como abrir cualquier página. Y si prefieren escribirte o llamarte, tú apuntas la cita en 10 segundos.'],
  ['No tengo tiempo para aprender.', 'Si sabes usar WhatsApp, sabes usar esto. Te la dejamos lista con tus servicios y horarios; tu primer día solo compartes el enlace.'],
  ['¿Y si no hay internet?', 'Tus clientes reservan desde su propio celular, así que aunque se caiga el internet del local, la agenda se sigue llenando. Tú la consultas con los datos de tu celular: gasta muy poco.'],
  ['¿Cuánto cuesta?', 'Crear tu barbería es gratis y sin tarjeta, para que la pruebes con tus propios clientes. Con que te ahorre una o dos faltas al mes, ya se pagó sola.'],
  ['¿Y si un barbero se va?', 'Los clientes y el historial son de la barbería. Lo desactivas en un toque y todo se queda contigo.'],
  ['¿Mis datos están seguros?', 'Cada barbería tiene su información aparte y cada barbero solo ve lo suyo. La caja y los reportes son solo para el dueño.']
];
const TIPS = [
  ['users', 'Que él toque la pantalla', 'Dale el celular al barbero: se convence más rápido cuando lo hace él.'],
  ['wallet', 'Habla de dinero', 'Citas perdidas por no contestar a tiempo y clientes que no llegan: eso es lo que resuelve.'],
  ['message', 'Pregunta y escucha', '«¿Cómo apuntas hoy tus citas?» y enséñale el paso que le resuelve eso.']
];
export const GUIDE_STEPS = STEPS.map((s) => ({ id: s.id, title: s.title, sec: s.sec }));

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
let openId = P.open;
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
function setThemeQuiet(t) {
  window.TB.setTheme(t);
  const b = document.getElementById('themeBtn'); // refleja el tema en la barra lateral sin repintar el shell
  if (b) b.innerHTML = icon(document.documentElement.getAttribute('data-theme') === 'dark' ? 'sun' : 'moon') + '<span>Tema: ' + esc({ auto: 'automático', light: 'claro', dark: 'oscuro' }[t] || 'automático') + '</span>';
}
const isDark = () => document.documentElement.getAttribute('data-theme') === 'dark' ||
  (window.TB.getTheme() === 'auto' && !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches));

// Texto del guion: se escapa y los nombres de botones «así» se resaltan.
const fmt = (s) => raw(esc(s).replace(/«([^»]+)»/g, '<b class="gd-k">$1</b>'));
function dur(sec) {
  if (sec < 60) return sec + ' s';
  const m = Math.floor(sec / 60), r = sec % 60;
  return (r >= 30 ? m + '½' : String(m)) + ' min';
}
const leftText = () => { const s = STEPS.filter((x) => !done.has(x.id) && x.id !== 'prep').reduce((a, x) => a + x.sec, 0); return s ? '≈ ' + Math.max(1, Math.round(s / 60)) + ' min restantes' : '¡Presentación completa!'; };

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

// ── Ir a un paso («Probar ahora») ────────────────────────────────────────
let running = false;
async function runGo(step, g, btn, opts) {
  opts = opts || {};
  if (running) return;
  if (g.act) return runAct(g.act, btn);
  if (g.external) { // se llama dentro del clic para que el navegador no bloquee la pestaña nueva
    window.open(g.external, '_blank', 'noopener');
    markDone(step.id, { advance: true });
    if (mounted && openId) mounted.scrollTo(openId);
    toast.info('Se abrió la página de reservas en otra pestaña. Reserva y regresa aquí.', { duration: 5200 });
    return;
  }
  const sw = needsSwitch(g);
  if (sw && authed() && getMode() !== 'demo') {
    const ok = await confirmDialog({ title: '¿Abrir la demo?', message: 'Vas a ver una barbería con datos ficticios. Tu sesión real queda guardada: al salir de la demo vuelves a entrar con tu correo.', confirmText: 'Abrir la demo', icon: 'sparkles' });
    if (!ok) return;
  }
  running = true;
  try {
    await busy(btn, async () => {
      // Una reserva hecha en otra pestaña solo se ve al recargar (cada pestaña tiene la demo en memoria).
      if (g.reload && getMode() === 'demo' && authed() && !opts.fresh) {
        markDone(step.id, { advance: true });
        history.replaceState(null, '', '#/guia?ir=' + encodeURIComponent(step.id) + (g === step.go ? '' : '&alt=1'));
        location.reload();
        await new Promise(() => {}); // la página se recarga
      }
      markDone(step.id, { advance: true });
      const fromGuide = parseHash().path === '/guia';
      let path = g.path;
      if (sw) {
        if (fromGuide) history.pushState(null, '', location.hash); // «Atrás» regresa a la guía
        if (g.resolve) {
          // El ejemplo se busca con la sesión nueva: mientras, se queda en la guía (ya cargada, se pinta al instante).
          await switchDemoRole(g.role, '/guia');
          try { path = await g.resolve(); } catch (e) { path = g.fallback; }
          showCoach(step);
          navigate(path, { replace: true, force: true });
        } else {
          showCoach(step);
          await switchDemoRole(g.role, path);
        }
      } else {
        if (g.resolve) { try { path = await g.resolve(); } catch (e) { path = g.fallback; } }
        showCoach(step);
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
  if (act === 'theme') {
    const t = isDark() ? 'auto' : 'dark';
    setThemeQuiet(t);
    toast.success(t === 'dark' ? 'Modo oscuro activado' : 'Tema automático: sigue el modo de tu dispositivo');
    if (mounted) mounted.paint();
    return;
  }
  if (act === 'reset') {
    const ok = await confirmDialog({ title: '¿Volver a empezar la guía?', message: 'Se desmarcan todos los pasos. Los datos de la demo no cambian.', confirmText: 'Volver a empezar', icon: 'refresh' });
    if (!ok) return;
    done.clear(); openId = STEPS[0].id; save(); hideCoach();
    if (mounted) { mounted.paint(); mounted.scrollTo(openId); }
    toast.success('Listo, la guía empieza de nuevo');
    return;
  }
  if (act === 'enter') {
    if (authed() && getMode() !== 'demo') {
      const ok = await confirmDialog({ title: '¿Abrir la demo?', message: 'Vas a ver una barbería con datos ficticios. Tu sesión real queda guardada: al salir de la demo vuelves a entrar con tu correo.', confirmText: 'Abrir la demo', icon: 'sparkles' });
      if (!ok) return;
    }
    running = true;
    try {
      await busy(btn, async () => {
        await switchDemoRole('owner', '/guia');
      });
      toast.success('Entraste a la demo como dueño. ¡Empecemos!');
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
  if (o && o.advance) { const n = nextUndone(id); openId = n ? n.id : null; }
  save();
  if (mounted) mounted.paint();
}

// ── Apuntador flotante (guion del paso sobre cualquier pantalla) ─────────
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
    box.setAttribute('aria-label', 'Guion de la presentación');
    document.body.appendChild(box);
    box.addEventListener('click', onCoachClick);
  }
  box.classList.toggle('open', coach.open);
  box.innerHTML = String(html`
    <div class="gd-cbar">
      <button type="button" class="gd-cmain" data-coach="toggle" aria-expanded="${String(coach.open)}" aria-controls="gdCoachBody">
        <span class="gd-cn">${i}<small>/${STEPS.length - 1}</small></span>
        <span class="grow truncate"><small>Guion · ${WHO[s.who][1]}</small>${s.title}</span>
        ${raw(icon(coach.open ? 'chevron-down' : 'chevron-up', 'ic-sm'))}
      </button>
      <button type="button" class="gd-cx" data-coach="close" aria-label="Ocultar el guion">${raw(icon('x', 'ic-sm'))}</button>
    </div>
    <div class="gd-cbody" id="gdCoachBody" ${coach.open ? '' : 'hidden'}>
      ${fresh ? html`<p class="gd-cnew">${raw(icon('bell', 'ic-sm'))}¡Llegó una reserva nueva! Sigue con el paso ${idx('notify')}.</p>` : ''}
      ${s.say.map((q) => html`<p class="gd-csay">“${fmt(q)}”</p>`)}
      ${s.tap ? html`<ol class="gd-ctap">${s.tap.map((t) => html`<li>${fmt(t)}</li>`)}</ol>` : ''}
      <div class="gd-cacts">
        <a class="btn btn-sm gd-cghost" href="#/guia">${raw(icon('book', 'ic-sm'))}Ver guía</a>
        ${nx ? html`<button type="button" class="btn btn-primary btn-sm" data-coach="next">Siguiente paso${raw(icon('arrow-right', 'ic-sm'))}</button>` : ''}
      </div>
      ${nx ? html`<p class="gd-cnext">Sigue: ${nx.title}</p>` : ''}
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
    if (nx.go.external) { coach = { id: nx.id, open: false }; paintCoach(); }
  }
}
window.addEventListener('hashchange', () => { if (coach) paintCoach(); });
// Salir de la demo o cerrar sesión repinta #app (sin 'hashchange'): el apuntador se oculta solo.
const appRoot = document.getElementById('app');
if (appRoot && typeof MutationObserver !== 'undefined') new MutationObserver(() => { if (coach || document.getElementById(COACH_ID)) paintCoach(); }).observe(appRoot, { childList: true });

// ── Estilos (una sola vez) ───────────────────────────────────────────────
const CSS = `
.gd-bare{max-width:1180px;margin:0 auto;padding:calc(14px + var(--safe-t)) 16px calc(40px + var(--safe-b));animation:pageIn .32s var(--ease-out)}
@media (min-width:1024px){.gd-bare{padding:26px 32px 64px}}
.gd-top{margin-bottom:6px;min-height:44px}
.gd-top .logo-mark{width:34px;height:34px;border-radius:10px}.gd-top .logo-mark svg{width:19px;height:19px}
.gd-top .brandname{font-size:19px}
.gd-top .link-btn{min-height:44px}
.gd-layout{display:grid;gap:16px;grid-template-columns:minmax(0,1fr)}
.gd-layout>*{min-width:0}
@media (min-width:1024px){.gd-layout{grid-template-columns:minmax(0,1fr) 316px;align-items:start;gap:22px}.gd-hero{grid-column:1/-1}.gd-side{position:sticky;top:calc(var(--topbar-h) + 14px)}}
.gd-hero{position:relative;overflow:hidden;isolation:isolate;display:grid;gap:22px;padding:22px 20px;border-radius:var(--r-xl);background:var(--ink);color:#F2EDE3;border:1px solid rgba(217,178,90,.2);box-shadow:var(--shadow-2)}
.gd-hero::before{content:"";position:absolute;inset:-30%;z-index:-1;background:radial-gradient(circle at 16% 10%,rgba(217,178,90,.25),transparent 42%),radial-gradient(circle at 94% 100%,rgba(217,178,90,.13),transparent 40%);pointer-events:none}
@media (min-width:860px){.gd-hero{grid-template-columns:minmax(0,1fr) 300px;align-items:center;padding:32px 34px;gap:40px}}
.gd-hero .eyebrow{color:#D9B25A;display:flex;align-items:center;gap:6px}.gd-hero .eyebrow .ic{width:14px;height:14px}
.gd-hero h3{font-family:var(--disp);font-size:34px;font-weight:800;line-height:.98;letter-spacing:.01em;margin:10px 0 10px}
@media (min-width:760px){.gd-hero h3{font-size:44px}}
.gd-hero h3 em{font-style:normal;color:#D9B25A}
.gd-hero .lede{color:#BDB5A5;max-width:520px;font-size:15px}
.gd-prog{margin-top:20px;max-width:520px}
.gd-prog .row{align-items:baseline}
.gd-count{font-family:var(--disp);font-size:30px;font-weight:800;line-height:1;font-variant-numeric:tabular-nums}
.gd-count small{font-family:var(--sans);font-size:13px;font-weight:500;color:#A39A88;margin-left:6px;letter-spacing:0}
.gd-left{font-size:12.5px;color:#A39A88;display:inline-flex;align-items:center;gap:4px}
.gd-reset{color:#E6C173;font-weight:600;font-size:12.5px;padding:13px 4px;margin:-13px -4px;text-decoration:underline;text-underline-offset:2px}
.gd-bar{height:8px;margin-top:10px;background:rgba(242,237,227,.1)}
.gd-bar>span{background:linear-gradient(90deg,#B98B2E,#E6C173);min-width:8px}
.gd-cta{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-top:20px}
.gd-cta .btn-lg{min-width:220px}
@media (max-width:559px){.gd-cta .btn{width:100%}}
.gd-hero .btn-secondary{background:rgba(242,237,227,.08);border-color:rgba(242,237,227,.18);color:#F2EDE3;box-shadow:none}
.gd-hero .btn-secondary:hover{background:rgba(242,237,227,.14);border-color:rgba(242,237,227,.3)}
.gd-hero .gd-note{font-size:12.5px;color:#A39A88;width:100%}
.gd-how{display:none}
@media (min-width:860px){.gd-how{display:grid;gap:12px;padding:18px;border-radius:18px;background:rgba(242,237,227,.05);border:1px solid rgba(242,237,227,.1)}}
.gd-how h4{font-size:11.5px;letter-spacing:.09em;text-transform:uppercase;color:#8E8676;font-weight:600}
.gd-how div{display:grid;grid-template-columns:32px 1fr;gap:10px;align-items:start;font-size:13.5px;color:#D9D3C6;line-height:1.45}
.gd-how div .ic{width:32px;height:32px;padding:7px;border-radius:10px;background:rgba(217,178,90,.14);color:#E6C173}
.gd-how b{color:#F2EDE3;font-weight:600;display:block}
.gd-steps{display:grid;gap:10px;counter-reset:gd}
.gd-step{overflow:hidden;transition:border-color .2s var(--ease),box-shadow .25s var(--ease);scroll-margin-top:calc(var(--topbar-h) + var(--safe-t) + 12px)}
.gd-step.open{border-color:var(--border-strong);box-shadow:var(--shadow-2)}
.gd-step.current:not(.open){border-color:rgba(196,154,60,.45)}
.gd-sh{display:flex;align-items:stretch}
.gd-chk{flex:none;width:60px;display:grid;place-items:center;padding:0 0 0 6px}
.gd-chk .c{width:32px;height:32px;border-radius:50%;display:grid;place-items:center;border:1.8px solid var(--border-strong);font-size:13px;font-weight:700;color:var(--text-2);background:var(--surface);font-variant-numeric:tabular-nums;transition:background .2s var(--ease),border-color .2s var(--ease),color .2s,transform .15s}
.gd-chk:hover .c{border-color:var(--ok);color:var(--ok)}
.gd-chk:active .c{transform:scale(.9)}
.gd-chk .c .ic{width:17px;height:17px;stroke-width:2.8}
.gd-chk[aria-checked="true"] .c{background:var(--ok);border-color:var(--ok);color:#fff;animation:pop .35s var(--ease-out)}
:root[data-theme="dark"] .gd-chk[aria-checked="true"] .c{color:#101A12}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .gd-chk[aria-checked="true"] .c{color:#101A12}}
.gd-step.current .gd-chk[aria-checked="false"] .c{border-color:var(--brand);color:var(--brand-strong);box-shadow:0 0 0 4px var(--brand-soft)}
.gd-tg{flex:1;min-width:0;display:flex;align-items:center;gap:10px;padding:14px 16px 14px 4px;text-align:left;min-height:64px}
.gd-tg .grow{min-width:0}
.gd-tg .t{display:block;font-size:15.5px;font-weight:600;line-height:1.3;color:var(--text)}
.gd-step.done:not(.open) .gd-tg .t{color:var(--text-2)}
.gd-meta{display:flex;flex-wrap:wrap;align-items:center;gap:4px 10px;margin-top:4px;font-size:12.5px;color:var(--text-3)}
.gd-meta span{display:inline-flex;align-items:center;gap:4px}
.gd-meta .ic{width:13px;height:13px}
.gd-tg>.ic{color:var(--text-3);transition:transform .25s var(--ease)}
.gd-step.open .gd-tg>.ic{transform:rotate(180deg)}
.gd-body{padding:2px 18px 18px 60px;display:grid;gap:16px;animation:fadeUp .3s var(--ease-out)}
@media (max-width:559px){.gd-body{padding:2px 16px 16px 16px}}
.gd-sec h4{display:flex;align-items:center;gap:7px;font-size:11.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text-3);margin-bottom:8px}
.gd-sec h4 .ic{width:15px;height:15px;color:var(--brand-strong)}
.gd-say{position:relative;margin:0 0 8px;padding:12px 14px 12px 16px;border-radius:12px;background:var(--brand-softer);border-left:3px solid var(--brand);font-size:15.5px;line-height:1.55;color:var(--text)}
.gd-say:last-child{margin-bottom:0}
.gd-k{font-weight:600;color:var(--text)}
.gd-tap{list-style:none;display:grid;gap:8px;counter-reset:tp}
.gd-tap li{display:grid;grid-template-columns:24px 1fr;gap:10px;font-size:14.5px;line-height:1.5;color:var(--text-2);counter-increment:tp}
.gd-tap li::before{content:counter(tp);width:24px;height:24px;border-radius:8px;background:var(--surface-3);color:var(--text);font-size:12px;font-weight:700;display:grid;place-items:center;margin-top:-1px}
.gd-tip{display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border-radius:12px;background:var(--surface-2);border:1px dashed var(--border-strong);font-size:13.5px;color:var(--text-2);line-height:1.5}
.gd-tip .ic{width:17px;height:17px;flex:none;margin-top:1px;color:var(--brand-strong)}
.gd-acts{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.gd-acts .gd-mark{margin-left:auto}
@media (max-width:559px){.gd-acts .btn{width:100%}.gd-acts .gd-mark{margin-left:0}}
.gd-dest{display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--text-3);margin-top:-6px}
.gd-dest .ic{width:14px;height:14px}
.gd-cnext{font-size:12px;color:#8E8676;margin-top:-2px}
.gd-new{display:flex;gap:10px;align-items:center;padding:10px 12px;border-radius:12px;background:var(--ok-soft);color:var(--ok);font-size:13.5px;font-weight:600;animation:fadeUp .3s var(--ease-out)}
.gd-new .ic{width:18px;height:18px;flex:none}
.gd-new span{color:var(--text)}
.gd-wait{display:flex;gap:10px;align-items:center;font-size:13px;color:var(--text-3)}
.gd-wait .spinner{width:14px;height:14px;border-width:2px}
.gd-bens{display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(210px,1fr))}
.gd-ben{display:grid;grid-template-columns:34px 1fr;gap:10px;align-items:start;padding:10px;border-radius:12px;background:var(--surface-2)}
.gd-ben .ib{width:34px;height:34px;border-radius:10px;background:var(--brand-soft);color:var(--brand-strong);display:grid;place-items:center}
.gd-ben .ib .ic{width:18px;height:18px}
.gd-ben b{display:block;font-size:14px}.gd-ben p{font-size:12.5px;color:var(--text-2);margin-top:1px}
.gd-faq{display:grid;gap:8px}
.gd-faq details{border:1px solid var(--border);border-radius:12px;background:var(--surface);transition:border-color .15s}
.gd-faq details[open]{border-color:var(--border-strong);background:var(--surface-2)}
.gd-faq summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:10px;min-height:48px;padding:10px 14px;font-weight:600;font-size:14.5px}
.gd-faq summary::-webkit-details-marker{display:none}
.gd-faq summary .ic{margin-left:auto;color:var(--text-3);transition:transform .2s var(--ease)}
.gd-faq details[open] summary .ic{transform:rotate(180deg)}
.gd-faq summary q{quotes:"“" "”"}
.gd-faq details p{padding:0 14px 14px;font-size:14px;color:var(--text-2);line-height:1.55;animation:fadeUp .25s var(--ease-out)}
.gd-side{display:grid;gap:16px}
.gd-toc{display:none}
@media (min-width:1024px){.gd-toc{display:block}}
.gd-toc ol{list-style:none;padding:6px}
.gd-toc button{display:flex;align-items:center;gap:10px;width:100%;min-height:40px;padding:6px 10px;border-radius:10px;text-align:left;font-size:13.5px;color:var(--text-2);transition:background .12s,color .12s}
.gd-toc button:hover{background:var(--surface-2);color:var(--text)}
.gd-toc button[aria-current="step"]{background:var(--brand-softer);color:var(--text);font-weight:600}
.gd-toc .d{width:20px;height:20px;border-radius:50%;flex:none;display:grid;place-items:center;border:1.5px solid var(--border-strong);font-size:10.5px;font-weight:700;color:var(--text-3)}
.gd-toc .d .ic{width:12px;height:12px;stroke-width:3}
.gd-toc .on .d{background:var(--ok);border-color:var(--ok);color:#fff}
.gd-toc .truncate{flex:1}
.gd-tips{display:grid;gap:14px}
.gd-tips div{display:grid;grid-template-columns:34px 1fr;gap:10px;align-items:start}
.gd-tips .ib{width:34px;height:34px;border-radius:10px;background:var(--brand-soft);color:var(--brand-strong);display:grid;place-items:center}
.gd-tips .ib .ic{width:17px;height:17px}
.gd-tips b{display:block;font-size:14px}.gd-tips p{font-size:13px;color:var(--text-2);margin-top:1px}
.gd-coach{position:fixed;z-index:35;left:12px;right:12px;bottom:calc(var(--bottomnav-h) + var(--safe-b) + 10px);max-width:440px;margin:0 auto;border-radius:18px;background:#15130F;color:#F2EDE3;border:1px solid rgba(217,178,90,.28);box-shadow:0 18px 40px rgba(0,0,0,.32),0 2px 8px rgba(0,0,0,.2);animation:toastIn .35s var(--ease-out);overflow:hidden}
body:not(.has-shell) .gd-coach{bottom:calc(16px + var(--safe-b))}
@media (min-width:1024px){.gd-coach{left:calc(var(--sidebar-w) + 24px);right:auto;bottom:24px;width:400px;margin:0}}
.gd-cbar{display:flex;align-items:center}
.gd-cmain{flex:1;min-width:0;display:flex;align-items:center;gap:10px;min-height:54px;padding:8px 6px 8px 12px;text-align:left;color:#F2EDE3}
.gd-cmain .grow{font-size:14px;font-weight:600;line-height:1.25}
.gd-cmain .grow small{display:block;font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#D9B25A}
.gd-cmain>.ic{color:#A39A88}
.gd-cn{flex:none;min-width:38px;height:38px;padding:0 6px;border-radius:12px;background:rgba(217,178,90,.16);color:#E6C173;display:grid;place-items:center;font-family:var(--disp);font-weight:800;font-size:19px;line-height:1;grid-auto-flow:column;align-items:baseline;justify-content:center}
.gd-cn small{font-family:var(--sans);font-size:10.5px;font-weight:600;color:#A39A88}
.gd-cx{flex:none;width:44px;height:54px;display:grid;place-items:center;color:#A39A88}
.gd-cx:hover,.gd-cmain:hover>.ic{color:#F2EDE3}
.gd-cbody{padding:2px 14px 14px;display:grid;gap:10px;max-height:min(52vh,420px);overflow:auto;border-top:1px solid rgba(242,237,227,.08);padding-top:12px;animation:fadeUp .25s var(--ease-out)}
.gd-csay{font-size:14.5px;line-height:1.5;color:#F2EDE3;padding-left:10px;border-left:2px solid #D9B25A}
.gd-csay .gd-k,.gd-ctap .gd-k{color:#F2EDE3}
.gd-ctap{margin:0;padding-left:20px;display:grid;gap:4px;font-size:13px;color:#BDB5A5;line-height:1.45}
.gd-cnew{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;color:#6FBF8A}
.gd-cacts{display:flex;gap:8px;flex-wrap:wrap}
.gd-cacts .btn{flex:1 1 auto}
.gd-cacts .btn-primary{flex:10 1 auto}
.gd-cghost{background:rgba(242,237,227,.08);color:#F2EDE3;border-color:rgba(242,237,227,.16)}
.gd-cghost:hover{background:rgba(242,237,227,.14)}
@media (prefers-reduced-motion:reduce){.gd-coach,.gd-body,.gd-cbody{animation:none}}
`;

// ── Vista ────────────────────────────────────────────────────────────────
export default {
  title: 'Guía de la demo',
  async render(el, { query, bare }) {
    if (!document.getElementById('st-guide')) document.head.insertAdjacentHTML('beforeend', '<style id="st-guide">' + CSS + '</style>');
    if (!running) hideCoach(); // al volver a la guía se guarda el apuntador (no durante un cambio de rol)
    let gone = false;
    // Si no hay nada abierto, se abre el siguiente paso pendiente.
    if (!openId && done.size < STEPS.length) { const n = nextUndone(); openId = n ? n.id : null; }

    const head = bare ? '' : html`<div class="page-head"><div><h2>Guía de la demo</h2><p>Un guion de 10 minutos para presentarla en una barbería.</p></div></div>`;
    const top = bare ? html`<div class="row between gd-top">
        <a href="#/demo" class="link-btn">${raw(icon('arrow-left', 'ic-sm'))}Volver</a>
        <span class="row" style="gap:8px"><span class="logo-mark">${raw(icon('logo'))}</span><span class="brandname">Tu<b>Barbería</b></span></span>
      </div>` : '';
    const body = html`
      <div class="gd-layout">
        <section class="gd-hero fade-up" aria-labelledby="gdTitle">
          <div>
            <span class="eyebrow">${raw(icon('book'))}Guion de presentación · 10 minutos</span>
            <h3 id="gdTitle">Enséñala en una barbería,<br/><em>paso a paso.</em></h3>
            <p class="lede">Qué decir, qué tocar y un botón para ir directo a cada pantalla. Tu avance se guarda en este dispositivo.</p>
            <div class="gd-prog" id="gdProg" aria-live="polite"></div>
            <div class="gd-cta" id="gdCta"></div>
          </div>
          <div class="gd-how" aria-hidden="true">
            <h4>Cómo usarla</h4>
            <div>${raw(icon('message'))}<span><b>Lee lo que va entre comillas</b>Son frases sugeridas; dilas con tus palabras.</span></div>
            <div>${raw(icon('play'))}<span><b>Toca «Probar ahora»</b>Te lleva a la pantalla y cambia de rol si hace falta.</span></div>
            <div>${raw(icon('check-circle'))}<span><b>Palomea cada paso</b>Un apuntador flotante te acompaña en cada pantalla.</span></div>
          </div>
        </section>
        <div class="gd-steps" id="gdSteps"></div>
        <aside class="gd-side">
          <nav class="card gd-toc" aria-label="Pasos de la guía">
            <div class="card-head"><h3>Pasos</h3><span class="sub" id="gdTocCount"></span></div>
            <ol id="gdToc"></ol>
          </nav>
          <section class="card card-pad" aria-labelledby="gdTipsT">
            <h3 class="section-title" id="gdTipsT" style="margin-bottom:14px">Consejos para presentar</h3>
            <div class="gd-tips">${TIPS.map(([ic, t, d]) => html`<div><span class="ib">${raw(icon(ic))}</span><span><b>${t}</b><p>${d}</p></span></div>`)}</div>
          </section>
        </aside>
      </div>`;
    el.innerHTML = bare ? '<div class="gd-bare">' + String(top) + String(body) + '</div>' : String(head) + String(body);

    // ── Pintado ──
    const whoOf = (s) => WHO[s.who] || WHO.owner;
    const stepHtml = (s, i) => {
      const isDone = done.has(s.id), isOpen = openId === s.id, cur = !isDone && nextUndone() && nextUndone().id === s.id;
      const [wic, wl] = whoOf(s);
      const alts = (s.alts || []).map((a) => {
        if (a.act === 'theme') return html`<button type="button" class="btn btn-secondary" data-act="theme">${raw(icon(isDark() ? 'sun' : 'moon'))}${isDark() ? 'Volver al tema automático' : 'Activar modo oscuro'}</button>`;
        if (a.act === 'reset') return html`<button type="button" class="btn btn-secondary" data-act="reset">${raw(icon('refresh'))}Volver a empezar</button>`;
        return html`<button type="button" class="btn btn-secondary" data-alt="${s.id}">${raw(icon(a.go.icon))}${a.go.label}</button>`;
      });
      return html`<article class="card gd-step ${isOpen ? 'open' : ''} ${isDone ? 'done' : ''} ${cur ? 'current' : ''}" id="gd-${s.id}" data-id="${s.id}">
        <div class="gd-sh">
          <button type="button" class="gd-chk" role="checkbox" aria-checked="${String(isDone)}" data-check="${s.id}" aria-label="${(isDone ? 'Desmarcar' : 'Marcar como hecho') + ': ' + s.title}">
            <span class="c">${isDone ? raw(icon('check')) : String(i)}</span></button>
          <button type="button" class="gd-tg" data-toggle="${s.id}" aria-expanded="${String(isOpen)}" aria-controls="gd-b-${s.id}">
            <span class="grow"><span class="t">${s.title}</span>
              <span class="gd-meta"><span>${raw(icon(wic))}${wl}</span><span>${raw(icon('clock'))}${s.id === 'prep' ? dur(s.sec) + ' antes' : dur(s.sec)}</span>${isDone ? html`<span class="ok-t">${raw(icon('check'))}Hecho</span>` : ''}</span></span>
            ${raw(icon('chevron-down'))}
          </button>
        </div>
        ${isOpen ? html`<div class="gd-body" id="gd-b-${s.id}">
          ${s.id === 'notify' && bookedAt ? html`<div class="gd-new" role="status">${raw(icon('bell'))}<span>¡Llegó una reserva nueva desde la página pública! Toca «Ver el aviso».</span></div>` : ''}
          ${s.id === 'notify' && !bookedAt && done.has('book') && getMode() === 'demo' ? html`<div class="gd-wait"><span class="spinner"></span>Cuando reserves en la otra pestaña, te avisamos aquí.</div>` : ''}
          <div class="gd-sec"><h4>${raw(icon('message'))}Qué decir</h4>${s.say.map((q) => html`<p class="gd-say">“${fmt(q)}”</p>`)}</div>
          ${s.tap ? html`<div class="gd-sec"><h4>${raw(icon('smartphone'))}Qué tocar</h4><ol class="gd-tap">${s.tap.map((t) => html`<li><span>${fmt(t)}</span></li>`)}</ol></div>` : ''}
          ${s.id === 'close' ? html`
            <div class="gd-sec"><h4>${raw(icon('star'))}Lo que gana</h4><div class="gd-bens">${BENEFITS.map(([ic, t, d]) => html`<div class="gd-ben"><span class="ib">${raw(icon(ic))}</span><span><b>${t}</b><p>${d}</p></span></div>`)}</div></div>
            <div class="gd-sec"><h4>${raw(icon('help'))}Preguntas frecuentes</h4><div class="gd-faq">${FAQ.map(([q, a]) => html`<details><summary><q>${q}</q>${raw(icon('chevron-down', 'ic-sm'))}</summary><p>${a}</p></details>`)}</div></div>` : ''}
          ${s.tip ? html`<p class="gd-tip">${raw(icon('info'))}<span>${fmt(s.tip)}</span></p>` : ''}
          <div class="gd-acts">
            <button type="button" class="btn btn-primary" data-go="${s.id}">${raw(icon(s.go.act ? s.go.icon : 'play'))}${s.go.act ? s.go.label : 'Probar ahora'}${s.go.act ? '' : html`<span class="sr">: ${s.go.label}</span>`}</button>
            ${alts}
            <button type="button" class="btn btn-ghost gd-mark" data-check="${s.id}">${raw(icon(isDone ? 'undo' : 'check'))}${isDone ? 'Desmarcar' : 'Marcar como hecho'}</button>
          </div>
          ${!s.go.act && !s.go.external ? html`<p class="gd-dest">${raw(icon('arrow-right'))}<span>Te lleva a: ${s.go.label}${needsSwitch(s.go) ? ' · entras como ' + ({ owner: 'dueño', barber: 'barbero', superadmin: 'superadmin' }[s.go.role]) : ''}</span></p>` : ''}
        </div>` : ''}
      </article>`;
    };
    const paintProg = () => {
      const n = done.size, total = STEPS.length, pct = Math.round((n / total) * 100);
      const nx = nextUndone();
      $('#gdProg', el).innerHTML = String(html`<div class="row between"><span class="gd-count">${n}<small>de ${total} pasos</small></span><span class="gd-left">${leftText()}${n && nx ? html` · <button type="button" class="gd-reset" data-act="reset">Reiniciar</button>` : ''}</span></div>
        <div class="progress-bar gd-bar" role="progressbar" aria-label="Avance de la guía" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${n}"><span style="width:${pct}%"></span></div>`);
      let cta;
      if (!demoSession()) {
        cta = html`<button type="button" class="btn btn-primary btn-lg" data-act="enter">${raw(icon('play'))}Entrar a la demo</button>
          ${bare ? html`<a class="btn btn-secondary btn-lg" href="#/demo">${raw(icon('users'))}Elegir otro rol</a>` : ''}
          <span class="gd-note">${authed() ? 'Se abre una barbería de ejemplo como dueño. Tu sesión real queda guardada.' : 'Sin registrarte: entras como dueño a una barbería con datos ficticios.'}</span>`;
      } else if (!nx) {
        cta = html`<button type="button" class="btn btn-primary btn-lg" data-act="reset">${raw(icon('refresh'))}Volver a empezar</button><span class="gd-note">¡Presentación completa! Puedes repetirla cuando quieras.</span>`;
      } else {
        cta = html`<button type="button" class="btn btn-primary btn-lg" data-cont="${nx.id}">${raw(icon(n ? 'arrow-right' : 'play'))}${n ? 'Continuar: paso ' + idx(nx.id) : 'Empezar la presentación'}</button>
          ${n ? html`<span class="gd-note">Sigue: ${nx.title}</span>` : ''}`;
      }
      $('#gdCta', el).innerHTML = String(cta);
      $('#gdTocCount', el).textContent = n + '/' + total;
      $('#gdToc', el).innerHTML = STEPS.map((s, i) => '<li><button type="button" data-toc="' + s.id + '" class="' + (done.has(s.id) ? 'on' : '') + '"' + (openId === s.id ? ' aria-current="step"' : '') + '>' +
        '<span class="d">' + (done.has(s.id) ? icon('check') : String(i)) + '</span><span class="truncate">' + esc(s.title) + '</span></button></li>').join('');
    };
    const live = () => !gone && el.isConnected;
    // Repinta la lista; restaura el foco en el control equivalente (el HTML se reemplaza).
    const paint = (focusSel) => {
      if (!live()) return;
      const a = document.activeElement;
      const sel = focusSel || (a && el.contains(a) && a.dataset ? (a.dataset.check ? (a.classList.contains('gd-chk') ? '.gd-chk' : '.gd-mark') + '[data-check="' + a.dataset.check + '"]' : a.dataset.toggle ? '[data-toggle="' + a.dataset.toggle + '"]' : null) : null);
      $('#gdSteps', el).innerHTML = String(html`${STEPS.map((s, i) => stepHtml(s, i))}`);
      paintProg();
      const f = sel && $(sel, el);
      if (f) f.focus({ preventScroll: true });
    };
    const reduce = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const scrollTo = (id) => {
      const card = $('#gd-' + id, el);
      if (!card) return;
      requestAnimationFrame(() => card.scrollIntoView({ behavior: reduce() ? 'auto' : 'smooth', block: 'start' }));
    };
    const openStep = (id, o) => {
      o = o || {};
      openId = openId === id && !o.keep ? null : id;
      save(); paint(o.focus ? '#gd-' + id + ' .gd-tg' : null);
      if (!openId) return;
      if (o.scroll !== false) return scrollTo(openId);
      // Al cerrarse otro paso de arriba, el que se abrió puede quedar fuera de vista.
      const card = $('#gd-' + openId, el);
      const top = card ? card.getBoundingClientRect().top : 0;
      if (top < 70 || top > window.innerHeight - 140) scrollTo(openId);
    };
    paint();

    mounted = {
      el,
      paint: () => paint(),
      scrollTo,
      onBooking() {
        if (!live()) { if (mounted && mounted.el === el) mounted = null; return; }
        done.add('book');
        if (!done.has('notify')) openId = 'notify';
        save(); paint();
        toast.success('¡Llegó una reserva nueva desde la página pública!', { duration: 6000, action: { label: 'Ver el aviso', onClick: () => { const s = STEPS[idx('notify')]; runGo(s, s.go, null); } } });
        if (!document.hidden) scrollTo('notify');
      }
    };

    // ── Eventos ──
    const offs = [
      on(el, 'click', '[data-toggle]', (e, b) => openStep(b.dataset.toggle, { scroll: false })),
      on(el, 'click', '[data-toc]', (e, b) => openStep(b.dataset.toc, { keep: true, focus: true })),
      on(el, 'click', '[data-cont]', (e, b) => openStep(b.dataset.cont, { keep: true, focus: true })),
      on(el, 'click', '[data-check]', (e, b) => {
        const id = b.dataset.check;
        if (done.has(id)) { done.delete(id); save(); paint(); toast.info('Paso desmarcado'); return; }
        done.add(id);
        if (openId === id) { const n = nextUndone(id); openId = n ? n.id : null; save(); paint(); if (openId) scrollTo(openId); }
        else { save(); paint(); }
        if (done.size === STEPS.length) toast.success('¡Presentación completa!');
      }),
      on(el, 'click', '[data-go]', (e, b) => { const s = STEPS[idx(b.dataset.go)]; if (s) runGo(s, s.go, b); }),
      on(el, 'click', '[data-alt]', (e, b) => { const s = STEPS[idx(b.dataset.alt)]; const a = s && (s.alts || []).find((x) => x.go); if (a) runGo(s, a.go, b); }),
      on(el, 'click', '[data-act]', (e, b) => runAct(b.dataset.act, b))
    ];
    const onVis = () => { if (!document.hidden && bookedAt && openId === 'notify') scrollTo('notify'); };
    document.addEventListener('visibilitychange', onVis);

    // Vuelta de la recarga (paso con reserva de otra pestaña): se continúa solo.
    const pending = query.ir && STEPS[idx(query.ir)];
    if (pending) {
      history.replaceState(null, '', '#/guia');
      const g = query.alt === '1' ? ((pending.alts || []).find((a) => a.go) || {}).go || pending.go : pending.go;
      if (getMode() === 'demo') setTimeout(() => { if (!gone) runGo(pending, g, null, { fresh: true }); }, 60);
    } else if (openId && openId !== STEPS[0].id && !bare) {
      const card = $('#gd-' + openId, el);
      if (card && card.getBoundingClientRect().top > window.innerHeight * 0.8) setTimeout(() => { if (!gone) scrollTo(openId); }, 350);
    }

    return () => {
      gone = true;
      mounted = null;
      offs.forEach((f) => f());
      document.removeEventListener('visibilitychange', onVis);
    };
  }
};
