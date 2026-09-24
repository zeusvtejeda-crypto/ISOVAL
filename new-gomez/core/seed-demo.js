// Cuenta demo: "La Navaja Barber Club" (Tepic) con ~3 meses de operación FICTICIA relativa a `today`:
// equipo con horarios, servicios, CRM de clientes, citas (75 días de historial + 21 a futuro), pagos,
// cortes de caja, comisiones pagadas, notificaciones, WhatsApp e historial de citas.
// Con withPlatform: superadmin + una segunda barbería ("Barbería Norte") para enseñar el aislamiento.
//
//   const { shop, credentials, pins } = await seedDemo(db, { today: '2026-09-24' });
//
// opts: { today?: 'YYYY-MM-DD' (hoy en la zona de la demo), seed?: número (PRNG mulberry32),
//         withPlatform?: bool (true), nowMin?: minutos del día (por defecto la hora real si today es hoy;
//         si no, 13:00), base?: URL pública para los enlaces de los mensajes }
// Determinista: misma seed + today + nowMin → mismas fechas, horarios, estados, montos, nombres y textos
// (ids, folios y hashes sí son aleatorios). Inserta con db SIN scope y shop_id explícito en cada fila.
// Solo JS estándar + WebCrypto: corre en el navegador (demo) y en Workers.
import { newId, newFolio, addDays, weekday, diffDays, nowInTz, parseDateKey, isDateKey, pad2, fmtMin, money, sum, groupBy, slugify } from './util.js';
import { hashSecret, PIN_ITERATIONS } from './crypto.js';
import { DEFAULT_TEMPLATES } from './domain/settings.js';

export const DEMO_SHOP_SLUG = 'demo';
export const DEMO_NORTE_SLUG = 'demo-norte';
export const DEMO_TZ = 'America/Mazatlan';
const PW = 'demo1234';
export const DEMO_CREDENTIALS = {
  owner: { email: 'dueno@demo.mx', password: PW },
  barber: { email: 'barbero@demo.mx', password: PW },
  client: { email: 'cliente@demo.mx', password: PW },
  superadmin: { email: 'admin@demo.mx', password: PW }
};
export const DEMO_NORTE_CREDENTIALS = { owner: { email: 'norte@demo.mx', password: PW } };
// PIN de acceso rápido del equipo (POST /api/auth/pin con shop_slug 'demo').
export const DEMO_PINS = [
  { name: 'Mauricio Ibarra', role: 'owner', pin: '1111' },
  { name: 'Luis Herrera', role: 'barber', pin: '2222' },
  { name: 'Andrea Solís', role: 'barber', pin: '3333' },
  { name: 'Diego Ramírez', role: 'barber', pin: '4444' }
];
export const DEMO_NORTE_PINS = [
  { name: 'Ramón Villaseñor', role: 'owner', pin: '5555' },
  { name: 'Kevin Márquez', role: 'barber', pin: '6666' },
  { name: 'Brenda Ochoa', role: 'barber', pin: '7777' }
];
const PW_ITERATIONS = 5000; // bajo a propósito: es demo y debe cargar rápido en el navegador
const STEP = 20;
const AVG_SLOT = 55;        // minutos promedio que ocupa una cita en la rejilla (para el planificador)
const DAY_MS = 86400000;
const sec = (t) => Math.floor(t / 1000) * 1000; // marcas de tiempo en segundos exactos

// ── PRNG determinista ──
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function makeRng(seed) {
  const next = mulberry32(seed);
  return {
    next,
    int: (a, b) => a + Math.floor(next() * (b - a + 1)),
    chance: (p) => next() < p,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    weighted(pairs) { // [[valor, peso], …]
      let t = 0;
      for (const p of pairs) t += p[1];
      let x = next() * t;
      for (const p of pairs) { x -= p[1]; if (x < 0) return p[0]; }
      return pairs[pairs.length - 1][0];
    },
    shuffle(arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  };
}

// ── Reloj local de la barbería: (fecha, minuto) → epoch ms, con el desfase real de la zona ──
function makeClock(tz, today, nowMin) {
  const offCache = {};
  const off = (date) => {
    if (offCache[date] != null) return offCache[date];
    const guess = Date.parse(date + 'T12:00:00Z');
    const n = nowInTz(tz, guess);
    return (offCache[date] = Math.round((guess - (Date.parse(n.date + 'T00:00:00Z') + n.minutes * 60000)) / 60000));
  };
  const ms = (date, min, sec) => Date.parse(date + 'T00:00:00Z') + ((min + off(date)) * 60 + (sec || 0)) * 1000;
  return { tz, today, nowMin, ms, nowMs: ms(today, nowMin), iso: (t) => new Date(t).toISOString(), dateOf: (t) => nowInTz(tz, t).date };
}

// ── Formatos (iguales a los de la API, para que los textos sembrados luzcan como los reales) ──
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const fmtDateEs = (k) => { const d = parseDateKey(k); return DIAS[d.getUTCDay()] + ' ' + d.getUTCDate() + ' de ' + MESES[d.getUTCMonth()]; };
const fmtTimeEs = (m) => { const h = Math.floor(m / 60) % 24; return (h % 12 || 12) + ':' + pad2(m % 60) + (h < 12 ? ' a.m.' : ' p.m.'); };
// Mismo formato que core/api/payments.js → fmtMoney: centavos solo si los hay ('$20', '$2,709.50').
function fmtMoney(n) { const v = money(n), d = Number.isInteger(v) ? 0 : 2; try { return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: d, maximumFractionDigits: d }).format(v); } catch (e) { return '$' + v.toFixed(d); } }
const firstName = (s) => String(s || '').trim().split(/\s+/)[0] || '';
const summary = (a, staffName) => (a.client_name || 'Cliente') + ' · ' + a.services.map((s) => s.name).join(', ') + ' · ' + fmtDateEs(a.date) + ', ' + fmtTimeEs(a.start_min) + (staffName ? ' con ' + staffName : '');
// Horario anterior de una cita reagendada, como domain/appointments.js → notifyChange (" · Antes: viernes 25, 11:00 a.m.").
const beforeText = (prev, a) => {
  const d = parseDateKey(prev.date), n = parseDateKey(a.date);
  const day = prev.date === a.date ? '' : (d.getUTCMonth() === n.getUTCMonth() && d.getUTCFullYear() === n.getUTCFullYear() ? DIAS[d.getUTCDay()] + ' ' + d.getUTCDate() : fmtDateEs(prev.date)) + ', ';
  return ' · Antes: ' + day + fmtTimeEs(prev.start_min);
};
const render = (tpl, vars) => tpl.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));

// ── Nombres ficticios (combinaciones comunes; se evitan las de personas conocidas) ──
const MALE = ['Juan', 'José', 'Carlos', 'Jorge', 'Miguel', 'Alejandro', 'Fernando', 'Ricardo', 'Eduardo', 'Francisco', 'Javier', 'Roberto',
  'Daniel', 'Sergio', 'Manuel', 'Raúl', 'Arturo', 'Óscar', 'Héctor', 'Iván', 'Emilio', 'Rodrigo', 'Adrián', 'Gerardo', 'Alberto', 'Rafael',
  'Ernesto', 'Hugo', 'Martín', 'Pablo', 'Samuel', 'Tomás', 'Andrés', 'Mario', 'Gustavo', 'Enrique', 'Ángel', 'Julio', 'César', 'Omar',
  'Saúl', 'Brandon', 'Kevin', 'Santiago', 'Mateo', 'Sebastián', 'Leonardo', 'Emiliano', 'Axel', 'Uriel', 'Alan', 'Erick', 'Isaac',
  'Abraham', 'Bruno', 'Rubén', 'Ramón', 'Joel', 'Alfredo', 'Armando', 'Juan Carlos', 'José Luis', 'Luis Ángel', 'Jesús', 'Cristian',
  'Aarón', 'Víctor', 'Efraín', 'Rogelio', 'Germán', 'Luis', 'Diego', 'Fabián', 'Ulises', 'Noé', 'Israel'];
const FEMALE = ['María Fernanda', 'Daniela', 'Valeria', 'Ana Sofía', 'Guadalupe', 'Karla', 'Paola', 'Mariana', 'Ximena', 'Alejandra',
  'Gabriela', 'Lucía', 'Regina', 'Renata', 'Itzel', 'Montserrat'];
const LAST = ['Hernández', 'García', 'Martínez', 'López', 'González', 'Rodríguez', 'Pérez', 'Sánchez', 'Ramírez', 'Cruz', 'Flores', 'Gómez',
  'Morales', 'Vázquez', 'Reyes', 'Jiménez', 'Torres', 'Díaz', 'Gutiérrez', 'Ruiz', 'Mendoza', 'Aguilar', 'Ortiz', 'Moreno', 'Castillo',
  'Romero', 'Álvarez', 'Méndez', 'Chávez', 'Rivera', 'Juárez', 'Ramos', 'Domínguez', 'Medina', 'Castro', 'Vargas', 'Guzmán', 'Velázquez',
  'Rojas', 'Contreras', 'Salazar', 'Luna', 'Ortega', 'Cervantes', 'Soto', 'Delgado', 'Estrada', 'Figueroa', 'Navarro', 'Carrillo',
  'Robles', 'Valdez', 'Rosales', 'Nava', 'Parra', 'Bautista', 'Guerrero', 'Lara', 'Zamora', 'Espinoza', 'Ochoa', 'Serrano', 'Villalobos',
  'Bernal', 'Arellano', 'Tapia', 'Cortés', 'Pacheco', 'Macías', 'Quintero', 'Beltrán', 'Zúñiga', 'Cárdenas', 'Montes', 'Sandoval',
  'Villanueva', 'Camacho', 'Esparza', 'Lozano', 'Magaña', 'Herrera', 'Solís', 'Ibarra', 'Castañeda', 'Rentería', 'Madrigal', 'Plascencia'];
const BLOCK = new Set(['Sergio Pérez', 'Javier Hernández', 'Hugo Sánchez', 'César Chávez', 'Julio Chávez', 'Omar Chávez', 'Saúl Álvarez',
  'Diego Luna', 'Mario Moreno', 'Raúl Jiménez', 'Luis Hernández', 'Luis García', 'Jorge Campos', 'Carlos Rivera', 'Edson Álvarez',
  'Kevin Álvarez', 'Héctor Herrera', 'Miguel Herrera', 'Óscar Pérez', 'Jesús Ochoa', 'Juan Pérez', 'Andrés López', 'Santiago Giménez',
  'Jorge Castañeda', 'Luis Herrera', 'Diego Ramírez', 'Mauricio Ibarra', 'Alejandro Fernández', 'Rodrigo Díaz', 'Carlos Salinas']);

function makePeople(R, n, femaleShare) {
  const out = [];
  const seen = new Set();
  while (out.length < n) {
    const female = R.chance(femaleShare);
    const first = R.pick(female ? FEMALE : MALE);
    const l1 = R.pick(LAST);
    const key = first + ' ' + l1;
    if (BLOCK.has(key) || seen.has(key)) continue;
    seen.add(key);
    let name = key;
    if (R.chance(0.3)) { const l2 = R.pick(LAST); if (l2 !== l1) name += ' ' + l2; }
    out.push({ name, first, l1, female });
  }
  return out;
}
function makePhones(R, prefix, n, reserved) {
  const used = new Set(reserved || []);
  const out = [];
  while (out.length < n) { const p = prefix + String(R.int(1000, 9999)); if (!used.has(p)) { used.add(p); out.push(p); } }
  return out;
}
const emailFor = (R, p) => slugify(p.first).replace(/-/g, '') + '.' + slugify(p.l1) + (R.chance(0.5) ? R.int(1, 99) : '') + '@example.com';

const NOTES = ['Le gusta el fade bajo', 'Alérgico a la loción con alcohol', 'Tijera en los lados, nada de máquina', 'Barba de candado, perfilar con navaja',
  'Llega siempre 10 min antes', 'Piel sensible: toalla tibia, no caliente', 'Raya marcada del lado izquierdo', 'Trae a su hijo cada 15 días',
  'Siempre paga con tarjeta', 'Prefiere citas en la mañana', 'Le gusta platicar de futbol', 'Cabello rizado: no rebajar de más arriba'];
const CLIENT_NOTES = ['Llego 5 min tarde, ¡gracias!', 'Degradado bajo, por favor', 'Vengo con mi hijo', 'Solo arreglar la nuca y los lados',
  'Primera vez, me recomendó un amigo', 'Traigo foto de referencia', 'Barba corta y bien perfilada'];
const INTERNAL_NOTES = ['Ofrecerle mascarilla la próxima', 'Trae foto de referencia', 'Pidió no rebajar tanto arriba', 'Cliente de Instagram',
  'Confirmado por WhatsApp', 'Le gustó la cera mate, ofrecer producto'];
const CANCEL_CLIENT = ['Me surgió un pendiente en el trabajo', 'Me enfermé, reagendo después', 'No alcanzo a llegar', 'Salí de la ciudad', 'Se me juntó con otra cita'];
const CANCEL_STAFF = ['El cliente pidió cambiar de día por WhatsApp', 'Imprevisto del barbero; se avisó al cliente', 'Cita duplicada'];
const MX_HOLIDAYS = { '01-01': 'Año Nuevo', '05-01': 'Día del Trabajo', '09-16': 'Día de la Independencia', '11-20': 'Día de la Revolución', '12-25': 'Navidad' };

// ── Configuración de las barberías demo ──
const WEEK = (days, blocks) => Object.fromEntries(days.map((d) => [d, blocks]));
// Feriados (cierre de toda la barbería) que caen en [from, to], salvo domingos.
function holidaysIn(from, to) {
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) { const r = MX_HOLIDAYS[d.slice(5)]; if (r && weekday(d) !== 0) out.push({ date: d, reason: r }); }
  return out;
}
const closures = (hol) => hol.map((h) => ({ staff: null, date_from: h.date, date_to: h.date, reason: h.reason }));
function demoConfig(clock) {
  const { today } = clock;
  const wd = weekday(today);
  const nextMon = addDays(today, ((8 - wd) % 7) || 7);
  // Feriados reales en el rango; si ninguno cae en los próximos 21 días, un cierre por capacitación a +20.
  const hol = holidaysIn(addDays(today, -75), addDays(today, 21));
  if (!hol.some((h) => h.date > today)) {
    let d = addDays(today, 20);
    if (weekday(d) === 0) d = addDays(d, 1);
    hol.push({ date: d, reason: 'Capacitación del equipo (barbería cerrada)' });
  }
  let pastThu = addDays(today, -3);
  while (weekday(pastThu) !== 4) pastThu = addDays(pastThu, -1);
  let nextFri = addDays(today, 3);
  while (weekday(nextFri) !== 5) nextFri = addDays(nextFri, 1);
  return {
    slug: DEMO_SHOP_SLUG, ageDays: 120, histDays: 75, futureDays: 21, clients: 144, femaleShare: 0.14, newShare: 0.35, phonePrefix: '311555',
    reservedPhones: ['3115550100', '3115550101', '3115550102', '3115550103', '3115550104'], minPerDay: 12, todayPending: 2,
    features: { cash: true, payouts: true, events: 7, messages: true, notifications: 'full', products: true, engineer: true },
    shop: {
      name: 'La Navaja Barber Club', tagline: 'Cortes de precisión, barba y buen ambiente en el centro de Tepic.',
      description: 'Barbería de barrio con alma clásica. Cortes a tijera y máquina, fades a navaja, barbas perfiladas y afeitado con toalla caliente. Reserva en línea en segundos y llega directo a tu silla.',
      phone: '3115550100', whatsapp: '3115550100', email: 'hola@demo.mx', address: 'Av. México 245 Nte., Centro, 63000 Tepic, Nay.', city: 'Tepic',
      maps_url: 'https://maps.google.com/?q=Tepic%2C+Nayarit', timezone: DEMO_TZ, currency: 'MXN', logo_url: '', cover_url: '', brand_color: '#C49A3C',
      domain: null, status: 'active', plan: 'demo',
      settings: {
        hours: { 0: [], 1: [[600, 1200]], 2: [[600, 1200]], 3: [[600, 1200]], 4: [[600, 1200]], 5: [[600, 1200]], 6: [[540, 1020]] },
        booking: { step_min: 20, lead_min: 30, window_days: 30, buffer_min: 0, cancel_hours: 2, auto_confirm: true, require_phone: true, allow_any_staff: true, online_enabled: true },
        whatsapp: { mode: 'manual', country_code: '52', reminder_hours: 24 },
        payments: { methods: ['cash', 'card', 'transfer'], tips: true },
        public: {
          rating: 4.9, reviews_count: 212, review_url: 'https://g.page/r/demo', instagram: 'https://instagram.com/lanavaja.demo', facebook: '', tiktok: '',
          policies: 'Pago en tienda: efectivo, tarjeta o transferencia. Cancela o reagenda con al menos 2 horas de anticipación. Tolerancia de 10 minutos.',
          gallery: []
        },
        notify_email: ''
      }
    },
    staff: [
      { key: 'mauricio', name: 'Mauricio Ibarra', role: 'owner', commission_pct: 0, pin: '1111', email: DEMO_CREDENTIALS.owner.email, color: '#C49A3C', phone: '3115550101', weight: 0.65,
        bio: 'Fundador de La Navaja. Quince años con la navaja en la mano; cortes clásicos y afeitado tradicional.',
        week: Object.assign(WEEK([1, 2, 3, 4, 5], [[600, 840], [900, 1140]]), { 6: [[540, 900]] }) },
      { key: 'luis', name: 'Luis Herrera', role: 'barber', commission_pct: 50, pin: '2222', email: DEMO_CREDENTIALS.barber.email, color: '#2F6FED', phone: '3115550102', weight: 1.3, unread: 3,
        bio: 'El rey del fade y los diseños. Si traes foto de referencia, te la deja igualita.',
        week: Object.assign(WEEK([1, 2, 3, 4, 5], [[600, 840], [900, 1200]]), { 6: [[540, 1020]] }) },
      { key: 'andrea', name: 'Andrea Solís', role: 'barber', commission_pct: 45, pin: '3333', color: '#D0457A', phone: '3115550103', weight: 1.0, unread: 2,
        bio: 'Tijera, color y matiz. Detallista y paciente con los más pequeños.',
        week: Object.assign({ 1: [[660, 1200]], 2: [[600, 1080]] }, WEEK([3, 4, 5], [[600, 900], [960, 1200]]), { 6: [[540, 1020]] }) },
      { key: 'diego', name: 'Diego Ramírez', role: 'barber', commission_pct: 40, pin: '4444', color: '#1F9D74', phone: '3115550104', weight: 0.85, unread: 1, joinedDaysAgo: 30,
        bio: 'El más nuevo del equipo. Barbas perfiladas y afeitado con toalla caliente.',
        week: Object.assign(WEEK([2, 3, 4, 5], [[720, 1200]]), { 6: [[540, 1020]] }) }
    ],
    services: [
      { key: 'clasico', name: 'Corte clásico', category: 'Cortes', duration_min: 40, price: 180, popular: true, w: 22, addons: ['barba', 'cejas', 'diseno', 'mascarilla'], desc: 'Corte a tijera y máquina, lavado y peinado con cera o pomada.' },
      { key: 'fade', name: 'Fade / degradado', category: 'Cortes', duration_min: 45, price: 220, popular: true, w: 22, addons: ['barba', 'cejas', 'diseno', 'mascarilla'], desc: 'Degradado bajo, medio o alto a navaja, con perfilado de contornos.' },
      { key: 'combo', name: 'Corte + barba', category: 'Cortes', duration_min: 60, price: 320, popular: true, w: 18, addons: ['cejas', 'mascarilla', 'diseno'], desc: 'El combo completo: corte a tu estilo y arreglo de barba con toalla caliente.' },
      { key: 'barba', name: 'Arreglo de barba', category: 'Barba', duration_min: 30, price: 150, w: 9, addons: ['mascarilla', 'cejas'], desc: 'Perfilado, rebaje y definición con navaja; aceite hidratante al final.' },
      { key: 'afeitado', name: 'Afeitado con toalla caliente', category: 'Barba', duration_min: 40, price: 200, w: 5, addons: ['mascarilla', 'cejas'], desc: 'Afeitado clásico a navaja con toallas calientes y bálsamo.' },
      { key: 'infantil', name: 'Corte infantil', category: 'Cortes', duration_min: 30, price: 140, w: 6, addons: ['diseno'], desc: 'Para niños de hasta 12 años. Paciencia y buen ambiente garantizados.' },
      { key: 'diseno', name: 'Diseño / líneas', category: 'Extras', duration_min: 20, price: 80, w: 0.4, staff: ['luis', 'diego'], desc: 'Líneas o figuras a navaja. Trae tu idea o elige una del catálogo.' },
      { key: 'cejas', name: 'Cejas', category: 'Extras', duration_min: 10, price: 60, w: 0.6, desc: 'Limpieza y perfilado de cejas con navaja.' },
      { key: 'mascarilla', name: 'Mascarilla negra', category: 'Faciales', duration_min: 20, price: 120, w: 0.6, desc: 'Limpieza facial con mascarilla de carbón activado para puntos negros.' },
      { key: 'tinte', name: 'Tinte / matiz', category: 'Extras', duration_min: 60, price: 380, w: 2, staff: ['andrea', 'luis'], desc: 'Color, matiz para canas o decoloración ligera. Incluye lavado.' }
    ],
    timeOff: [
      { staff: 'andrea', date_from: addDays(nextMon, 1), date_to: addDays(nextMon, 2), reason: 'Vacaciones' },
      { staff: 'luis', date_from: pastThu, date_to: pastThu, start_min: 960, end_min: 1080, reason: 'Cita médica' },
      { staff: 'diego', date_from: nextFri, date_to: nextFri, start_min: 720, end_min: 840, reason: 'Trámite personal' }
    ].concat(closures(hol)),
    // Citas por día hábil (más viernes y sábado); a futuro la agenda se va llenando menos.
    target(R, wd, off) {
      const b = { 1: [12, 15], 2: [13, 16], 3: [13, 17], 4: [15, 19], 5: [19, 24], 6: [20, 25] }[wd] || [12, 14];
      const n = R.int(b[0], b[1]);
      if (off <= 0) return n;
      const f = off <= 2 ? 0.9 : off <= 5 ? 0.65 : off <= 10 ? 0.4 : off <= 15 ? 0.22 : 0.12;
      return Math.max(1, Math.round(n * f));
    },
    fixedClient: {
      name: 'Jorge Castañeda', email: DEMO_CREDENTIALS.client.email, pref: 'luis', past: [-68, -55, -42, -30, -17, -5], next: [2, 6],
      notes: 'Prefiere a Luis. Fade bajo con raya marcada.', note: 'Fade bajo y perfilar la barba, por favor.', tags: ['Fade']
    }
  };
}
function norteConfig(clock) {
  const { today } = clock;
  return {
    slug: DEMO_NORTE_SLUG, ageDays: 60, histDays: 14, futureDays: 7, clients: 28, femaleShare: 0.2, newShare: 0.3, phonePrefix: '311556',
    reservedPhones: ['3115560100', '3115560101', '3115560102', '3115560103'], minPerDay: 0, todayPending: 1,
    features: { cash: true, payouts: true, events: 7, messages: false, notifications: 'basic', products: false, engineer: false },
    shop: {
      name: 'Barbería Norte', tagline: 'Tu corte de siempre, sin esperas.', description: 'Barbería familiar al norte de la ciudad. Cortes rápidos y bien hechos.',
      phone: '3115560100', whatsapp: '3115560100', email: 'norte@demo.mx', address: 'Av. Insurgentes 1520 Pte., Lagos del Country, Tepic, Nay.', city: 'Tepic',
      maps_url: '', timezone: DEMO_TZ, currency: 'MXN', logo_url: '', cover_url: '', brand_color: '#2F6FED', domain: null, status: 'active', plan: 'basic',
      settings: {
        hours: { 0: [], 1: [[600, 1200]], 2: [[600, 1200]], 3: [[600, 1200]], 4: [[600, 1200]], 5: [[600, 1200]], 6: [[600, 1080]] },
        booking: { step_min: 20, lead_min: 30, window_days: 21, auto_confirm: true },
        public: { rating: 4.7, reviews_count: 58 }
      }
    },
    staff: [
      { key: 'ramon', name: 'Ramón Villaseñor', role: 'owner', commission_pct: 0, pin: '5555', email: DEMO_NORTE_CREDENTIALS.owner.email, color: '#2F6FED', phone: '3115560101', weight: 0.8,
        bio: 'Dueño y barbero de la casa.', week: WEEK([1, 2, 3, 4, 5, 6], [[600, 1080]]) },
      { key: 'kevin', name: 'Kevin Márquez', role: 'barber', commission_pct: 45, pin: '6666', color: '#E07A2E', phone: '3115560102', weight: 1,
        bio: 'Fades y diseños.', week: Object.assign(WEEK([1, 2, 3, 4, 5], [[660, 1200]]), { 6: [[600, 1080]] }) },
      { key: 'brenda', name: 'Brenda Ochoa', role: 'barber', commission_pct: 45, pin: '7777', color: '#8A5CF6', phone: '3115560103', weight: 1,
        bio: 'Cortes con tijera y barba.', week: WEEK([2, 3, 4, 5, 6], [[600, 1020]]) }
    ],
    services: [
      { key: 'corte', name: 'Corte', category: 'Cortes', duration_min: 30, price: 150, popular: true, w: 10, addons: ['cejas'], desc: 'Corte a máquina y tijera.' },
      { key: 'combo', name: 'Corte y barba', category: 'Cortes', duration_min: 50, price: 250, popular: true, w: 6, addons: ['cejas'], desc: 'Corte más arreglo de barba.' },
      { key: 'barba', name: 'Barba', category: 'Barba', duration_min: 30, price: 120, w: 3, desc: 'Arreglo y perfilado de barba.' },
      { key: 'cejas', name: 'Cejas', category: 'Extras', duration_min: 10, price: 50, w: 0.3, desc: 'Perfilado de cejas.' }
    ],
    timeOff: closures(holidaysIn(addDays(today, -14), addDays(today, 7))),
    target(R, wd, off) { const n = R.int(2, 4); return off <= 0 ? n : (off <= 3 ? Math.max(1, n - 1) : R.int(0, 1)); },
    fixedClient: null
  };
}

// ── Planificador: huecos por barbero sin traslapes, dentro de sus bloques y en la rejilla de 20 min ──
function subtract(segs, a, b) {
  const out = [];
  for (const [s, e] of segs) {
    if (b <= s || a >= e) { out.push([s, e]); continue; }
    if (a > s) out.push([s, a]);
    if (b < e) out.push([b, e]);
  }
  return out;
}
function pickServices(R, catalog, st, max) {
  const offered = catalog.filter((s) => !s.staff || s.staff.includes(st.key));
  const mains = offered.filter((s) => s.w > 0 && s.duration_min <= max);
  if (!mains.length || (max < 30 && R.chance(0.7))) return null; // al final del turno casi nunca hay citas exprés
  const main = R.weighted(mains.map((s) => [s, s.w]));
  const out = [main];
  if (main.addons && R.chance(0.25)) {
    const adds = offered.filter((s) => main.addons.includes(s.key) && main.duration_min + s.duration_min <= max);
    if (adds.length) out.push(R.pick(adds));
  }
  return out;
}
function planBarber(R, segs, k, pick) {
  const out = [];
  const lens = segs.map(([s, e]) => e - s);
  for (let i = 0; i < segs.length && out.length < k; i++) {
    const e = segs[i][1];
    const later = sum(lens.slice(i + 1));
    let t = Math.ceil(segs[i][0] / STEP) * STEP;
    while (t + 10 <= e && out.length < k) {
      const p = Math.min(1, ((k - out.length) * AVG_SLOT / (e - t + later)) * 1.1);
      if (R.next() < p) {
        const svcs = pick(e - t);
        if (svcs) {
          const dur = sum(svcs, (s) => s.duration_min);
          out.push({ start: t, end: t + dur, services: svcs });
          t += Math.ceil(dur / STEP) * STEP;
          continue;
        }
      }
      t += STEP;
    }
  }
  return out;
}
function planDay(R, date, workers, n, catalog) {
  const wsum = sum(workers, (w) => w.st.weight * w.cap);
  const raw = workers.map((w) => (n * w.st.weight * w.cap) / wsum);
  const k = raw.map(Math.floor);
  const rest = n - sum(k);
  raw.map((x, i) => [x - k[i], i]).sort((a, b) => b[0] - a[0]).slice(0, rest).forEach(([, i]) => { k[i]++; });
  const out = [];
  workers.forEach((w, i) => {
    for (const s of planBarber(R, w.segs, k[i], (max) => pickServices(R, catalog, w.st, max))) out.push(Object.assign({ staff: w.st, date }, s));
  });
  return out;
}

// ── Construcción de una barbería completa (filas en memoria; se insertan al final) ──
function buildShop(cfg, R, clock, hashes, base) {
  const { today, nowMin, nowMs, ms: T, iso } = clock;
  const histStart = addDays(today, -cfg.histDays);
  const lastDay = addDays(today, cfg.futureDays);
  const F = cfg.features;
  const shopId = newId('sh');
  const shopCreated = T(addDays(today, -cfg.ageDays), 660, 12);
  const out = { shop: null, users: [], staff: [], services: [], availability: [], time_off: [], clients: [], appointments: [], appointment_events: [], payments: [], cash_sessions: [], cash_movements: [], commission_payouts: [], notifications: [], messages: [] };
  const withShop = (row) => Object.assign({ shop_id: shopId }, row);
  out.shop = Object.assign({ id: shopId, slug: cfg.slug }, cfg.shop, { created_at: iso(shopCreated), updated_at: iso(shopCreated + 3 * DAY_MS) });
  const hours = cfg.shop.settings.hours;
  const clamp = (t) => Math.min(t, nowMs - 60000); // nada queda con fecha futura

  // Equipo, cuentas y horarios
  const staff = cfg.staff.map((s, i) => {
    const joined = addDays(today, -(s.joinedDaysAgo || cfg.ageDays));
    const created = T(joined, 660 + i * 7, 30);
    let user_id = null;
    if (s.email) {
      const u = { id: newId('us'), email: s.email, name: s.name, phone: s.phone, password_hash: hashes.pw[s.email], is_superadmin: false, status: 'active', created_at: iso(created), last_login_at: null };
      out.users.push(u);
      user_id = u.id;
    }
    const row = withShop({ id: newId('st'), user_id, name: s.name, role: s.role, bookable: s.bookable !== false, active: true, color: s.color, avatar_url: '', bio: s.bio, phone: s.phone, commission_pct: s.commission_pct, pin_hash: s.pin ? hashes.pin[cfg.slug + ':' + s.pin] : null, sort: i, created_at: iso(created), updated_at: null });
    out.staff.push(row);
    for (const [wd, blocks] of Object.entries(s.week)) for (const [a, b] of blocks) out.availability.push(withShop({ id: newId('av'), staff_id: row.id, weekday: +wd, start_min: a, end_min: b }));
    return Object.assign({}, s, { id: row.id, row, joined, idx: i });
  });
  const byKey = Object.fromEntries(staff.map((s) => [s.key, s]));
  const owner = staff.find((s) => s.role === 'owner');
  const mainBarber = staff.find((s) => s.email === DEMO_CREDENTIALS.barber.email) || null; // el de barbero@demo.mx

  for (const t of cfg.timeOff) {
    const created = clamp(T(addDays(t.date_from, -R.int(4, 14)), R.int(600, 1140)));
    out.time_off.push(withShop({ id: newId('to'), staff_id: t.staff ? byKey[t.staff].id : null, date_from: t.date_from, date_to: t.date_to, start_min: t.start_min == null ? null : t.start_min, end_min: t.end_min == null ? null : t.end_min, reason: t.reason, created_at: iso(created) }));
  }
  const offs = out.time_off;
  const applies = (t, sid, date) => (t.staff_id == null || t.staff_id === sid) && t.date_from <= date && t.date_to >= date;
  const shopClosed = (date) => !(hours[weekday(date)] || []).length || offs.some((t) => t.staff_id == null && t.start_min == null && applies(t, null, date));
  function segsFor(s, date) {
    if (date < s.joined || offs.some((t) => t.start_min == null && applies(t, s.id, date))) return [];
    let segs = (s.week[weekday(date)] || []).map((b) => b.slice());
    for (const t of offs) if (t.start_min != null && applies(t, s.id, date)) segs = subtract(segs, t.start_min, t.end_min);
    return segs;
  }

  const services = cfg.services.map((s, i) => {
    const row = withShop({ id: newId('sv'), name: s.name, description: s.desc, category: s.category, duration_min: s.duration_min, price: s.price, active: true, popular: !!s.popular, staff_ids: s.staff ? s.staff.map((k) => byKey[k].id) : [], sort: i, created_at: iso(shopCreated + 3600000 + i * 60000), updated_at: null });
    out.services.push(row);
    return Object.assign({}, s, { id: row.id });
  });

  // 1) Agenda: huecos por día y barbero
  const slots = [];
  for (let date = histStart; date <= lastDay; date = addDays(date, 1)) {
    if (shopClosed(date)) continue;
    const workers = staff.filter((s) => s.bookable !== false).map((s) => ({ st: s, segs: segsFor(s, date) })).filter((w) => w.segs.length);
    if (!workers.length) continue;
    workers.forEach((w) => { w.cap = sum(w.segs, (x) => x[1] - x[0]); });
    const off = diffDays(today, date);
    const n = cfg.target(R, weekday(date), off);
    if (n <= 0) continue;
    let best = null;
    for (let tries = 0; tries < 5; tries++) {
      const day = planDay(R, date, workers, n, services);
      if (!best || day.length > best.length) best = day;
      if (best.length >= Math.min(n, cfg.minPerDay)) break;
    }
    best.sort((a, b) => a.start - b.start || a.staff.idx - b.staff.idx);
    for (const s of best) { s.off = off; slots.push(s); }
  }

  // 2) Estados y origen
  for (const s of slots) {
    if (s.off < 0) s.status = R.weighted([['completed', 86], ['cancelled', 9], ['no_show', 5]]);
    else if (s.off === 0) s.status = s.end <= nowMin ? 'completed' : 'confirmed';
    else s.status = R.chance(0.15) ? 'pending' : 'confirmed';
  }
  R.shuffle(slots.filter((s) => s.off === 0 && s.start > nowMin)).slice(0, cfg.todayPending).forEach((s) => { s.status = 'pending'; });
  for (const s of slots) {
    const started = s.off < 0 || (s.off === 0 && s.start <= nowMin);
    if (s.status === 'pending') s.source = 'manual';
    else if (s.status === 'cancelled' || s.status === 'no_show') s.source = R.chance(0.62) ? 'online' : 'manual';
    else if (started) s.source = R.weighted([['online', 54], ['manual', 34], ['walkin', 12]]);
    else s.source = R.weighted([['online', 64], ['manual', 36]]);
  }

  // 3) Clientes (CRM): segmento, cadencia de visitas, barbero preferido, fecha de alta
  const fx = cfg.fixedClient;
  const people = makePeople(R, cfg.clients - (fx ? 1 : 0), cfg.femaleShare);
  const phones = makePhones(R, cfg.phonePrefix, cfg.clients, cfg.reservedPhones);
  const bookable = staff.filter((s) => s.bookable !== false);
  const clients = people.map((p, i) => {
    const seg = R.weighted([['freq', 30], ['reg', 40], ['occ', 30]]);
    const cadence = seg === 'freq' ? R.int(8, 12) : seg === 'reg' ? R.int(14, 24) : R.int(28, 50);
    const isNew = R.chance(cfg.newShare);
    const joinIdx = isNew ? R.int(-cfg.histDays + 1, 5) : -cfg.histDays - R.int(20, 400);
    const pool = bookable.filter((s) => diffDays(today, s.joined) <= Math.max(joinIdx, -cfg.histDays));
    const pref = pool.length && R.chance(seg === 'freq' ? 0.75 : seg === 'reg' ? 0.5 : 0.2) ? R.weighted(pool.map((s) => [s.key, s.weight])) : null;
    return { id: newId('cl'), p, phone: phones[i], seg, cadence, isNew, joinIdx, pref, last: isNew ? null : -cfg.histDays - R.int(0, cadence), slots: [] };
  });
  let jorge = null;
  if (fx) {
    const parts = fx.name.split(' ');
    jorge = { id: newId('cl'), fixed: true, p: { name: fx.name, first: parts[0], l1: parts[1], female: false }, phone: phones[cfg.clients - 1], seg: 'freq', cadence: 12, isNew: true, joinIdx: -cfg.histDays, pref: fx.pref, last: null, slots: [] };
    clients.push(jorge);
    const find = (from, to, ok, prefOnly) => {
      for (let d = from; d <= to; d++) {
        const date = addDays(today, d);
        const c = slots.filter((s) => s.date === date && !s.client && ok(s) && (!prefOnly || s.staff.key === fx.pref));
        if (c.length) return c;
      }
      return null;
    };
    for (const target of fx.past) {
      const ok = (s) => s.status === 'completed' && (s.off < 0);
      const c = find(target, Math.min(target + 6, -1), ok, true) || find(target, Math.min(target + 6, -1), ok, false);
      if (c) { const s = c[c.length - 1]; s.client = jorge; s.source = 'online'; }
    }
    const okNext = (s) => s.status === 'confirmed' || s.status === 'pending';
    const c = find(fx.next[0], fx.next[1], okNext, true) || find(1, cfg.futureDays, okNext, false);
    if (c) { const s = c[Math.floor(c.length / 2)]; s.client = jorge; s.status = 'confirmed'; s.source = 'online'; s.client_note = fx.note; }
  }

  // 4) Asignación de clientes en orden cronológico: el más "atrasado" respecto a su cadencia, con preferencia de barbero
  const takenByDate = {};
  for (const s of slots) {
    const taken = takenByDate[s.date] || (takenByDate[s.date] = new Set());
    if (s.client) { taken.add(s.client); s.client.slots.push(s); continue; }
    let best = null, bestScore = -1;
    for (const c of clients) {
      if (c.fixed || taken.has(c) || s.off < c.joinIdx) continue;
      let score;
      if (c.last == null) score = 2.2;
      else { const gap = s.off - c.last; if (gap < Math.max(4, Math.round(c.cadence * 0.45))) continue; score = gap / c.cadence; }
      if (c.pref) score *= c.pref === s.staff.key ? 1.6 : 0.45;
      score *= 0.75 + R.next() * 0.5;
      if (score > bestScore) { bestScore = score; best = c; }
    }
    if (!best) { const free = clients.filter((c) => !c.fixed && !taken.has(c)); best = R.pick(free); }
    s.client = best;
    taken.add(best);
    best.slots.push(s);
    if (s.status !== 'cancelled' && s.status !== 'no_show') best.last = s.off;
  }

  // 5) Tiempos: creación, cancelación, reagenda
  const startMs = (s) => T(s.date, s.start);
  for (const s of slots) {
    const st = startMs(s);
    let t;
    if (s.source === 'walkin') t = st - R.int(2, 12) * 60000;
    else {
      const lead = s.source === 'online' ? R.weighted([[0, 18], [1, 30], [2, 20], [3, 12], [5, 10], [8, 10]]) : R.weighted([[0, 25], [1, 25], [2, 20], [4, 15], [7, 15]]);
      t = T(addDays(s.date, -lead), s.source === 'online' ? R.int(420, 1380) : R.int(600, 1170), R.int(0, 59));
      const latest = st - (s.source === 'online' ? 40 : 10) * 60000;
      if (t > latest) t = latest - R.int(0, 180) * 60000;
      if (t > nowMs - 60000) t = nowMs - R.int(3, 4 * 1440) * 60000;
    }
    s.createdMs = Math.max(t, shopCreated + DAY_MS);
    if (s.status === 'cancelled') {
      s.cancelled_by = R.chance(0.65) ? 'client' : 'staff';
      s.cancel_reason = R.pick(s.cancelled_by === 'client' ? CANCEL_CLIENT : CANCEL_STAFF);
      const until = Math.min(st - 30 * 60000, nowMs - 60000);
      s.cancelMs = until > s.createdMs ? sec(s.createdMs + R.next() * (until - s.createdMs)) : s.createdMs + 60000;
    }
  }
  if (F.engineer) {
    // Actividad reciente para el centro de notificaciones: 2 cancelaciones y 2 reagendas hechas por clientes.
    const pool = R.shuffle(slots.filter((s) => s.off >= 1 && s.off <= 7 && s.status === 'confirmed' && s.source === 'online' && !s.client.fixed && s.createdMs < nowMs - DAY_MS));
    // Una de cada tipo le toca al barbero principal para que también la vea en su centro de notificaciones.
    const take = (mine) => { const i = pool.findIndex((s) => (s.staff === mainBarber) === mine); return i < 0 ? pool.shift() : pool.splice(i, 1)[0]; };
    const cand = mainBarber ? [take(true), take(false), take(true), take(false)].filter(Boolean) : pool;
    cand.slice(0, 2).forEach((s) => {
      s.status = 'cancelled'; s.cancelled_by = 'client'; s.cancel_reason = R.pick(CANCEL_CLIENT);
      const from = Math.max(s.createdMs + 30 * 60000, nowMs - 2 * DAY_MS);
      s.cancelMs = sec(from + R.next() * Math.max(60000, nowMs - 10 * 60000 - from));
      s.recent = true;
    });
    cand.slice(2, 4).forEach((s) => {
      const from = Math.max(s.createdMs + 3600000, nowMs - 2 * DAY_MS);
      s.resMs = sec(from + R.next() * Math.max(60000, nowMs - 10 * 60000 - from));
      s.resBy = 'client';
      s.recent = true;
    });
  }
  for (const s of slots) {
    if (s.resMs || s.status === 'cancelled' || s.client.fixed || !R.chance(0.04)) continue;
    const until = Math.min(startMs(s) - 3600000, nowMs - 60000);
    if (until - s.createdMs < 3600000) continue;
    s.resMs = sec(s.createdMs + R.next() * (until - s.createdMs));
    s.resBy = R.chance(0.5) ? 'client' : 'staff';
  }
  // Horario original (antes de reagendar): un día hábil cercano que aún no había pasado al reagendar.
  for (const s of slots) {
    if (!s.resMs) continue;
    const resDate = clock.dateOf(s.resMs);
    const opts = [-2, -1, 1, 2].map((k) => addDays(s.date, k)).filter((d) => d >= resDate && (hours[weekday(d)] || []).length);
    s.resFrom = { date: opts.length ? R.pick(opts) : s.date, start_min: R.int(30, 50) * STEP, staff_id: s.staff.id };
    if (s.resFrom.date === s.date && s.resFrom.start_min === s.start) s.resFrom.start_min = s.start >= 800 ? s.start - 60 : s.start + 60;
  }

  // 6) Filas de citas y pagos
  const folios = new Set();
  const folio = () => { let f = newFolio('TB'); while (folios.has(f)) f = newFolio('TB'); folios.add(f); return f; };
  const actorOf = (s) => (s.source === 'online'
    ? (s.client === jorge && jorge ? { id: jorge.userId || null, name: jorge.p.name } : { id: null, name: 'Cliente (en línea)' })
    : (R.chance(0.5) ? { id: owner.id, name: owner.name } : { id: s.staff.id, name: s.staff.name }));
  if (jorge && fx) jorge.userId = newId('us');
  for (const c of clients) c.slots.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.start - b.start));
  for (const c of clients) c.slots.forEach((s, i) => { s.first_visit = c.isNew && i === 0; });
  const noteChance = { online: 0.14, manual: 0.04, walkin: 0 };
  for (const s of slots) {
    const snap = s.services.map((x) => ({ id: x.id, name: x.name, price: money(x.price), duration_min: x.duration_min }));
    const total = money(sum(snap, (x) => x.price));
    s.actor = actorOf(s);
    s.total = total;
    const a = withShop({
      id: newId('ap'), folio: folio(), client_id: s.client.id, staff_id: s.staff.id, date: s.date, start_min: s.start, end_min: s.end,
      duration_min: s.end - s.start, services: snap, total, status: s.status, source: s.source, client_name: s.client.p.name, client_phone: s.client.phone,
      client_note: s.client_note || (R.chance(noteChance[s.source]) ? R.pick(CLIENT_NOTES) : null),
      internal_note: R.chance(0.07) ? R.pick(INTERNAL_NOTES) : null,
      cancel_reason: s.cancel_reason || null, cancelled_by: s.cancelled_by || null, manage_token_hash: null, first_visit: !!s.first_visit,
      reminder_sent_at: null, confirmed_at: s.status === 'pending' ? null : iso(s.createdMs), completed_at: null,
      reschedule_count: s.resMs ? 1 : 0, created_by: s.source === 'online' ? (s.actor.id || null) : s.actor.id,
      created_at: iso(s.createdMs), updated_at: null
    });
    s.row = a;
    let upd = s.resMs || null;
    if (s.status === 'completed') {
      const tipPct = R.chance(0.4) ? R.int(10, 20) : 0;
      const tip = tipPct ? Math.max(5, Math.round((total * tipPct) / 100 / 5) * 5) : 0;
      const method = R.weighted([['cash', 55], ['card', 35], ['transfer', 10]]);
      const payMs = Math.min(T(s.date, s.end + R.int(0, 4), R.int(0, 59)), nowMs);
      const p = withShop({ id: newId('pay'), appointment_id: a.id, client_id: a.client_id, staff_id: a.staff_id, amount: total, tip, method, concept: snap.map((x) => x.name).join(' + '), status: 'paid', cash_session_id: null, created_by: s.staff.id, created_at: iso(payMs), date: s.date });
      out.payments.push(p);
      s.pay = p; s.payMs = payMs;
      a.completed_at = iso(payMs);
      upd = payMs;
    } else if (s.status === 'cancelled') upd = s.cancelMs;
    else if (s.status === 'no_show') { s.noShowMs = Math.min(startMs(s) + R.int(15, 30) * 60000, nowMs); upd = s.noShowMs; }
    a.updated_at = upd ? iso(Math.max(upd, s.createdMs)) : null;
    out.appointments.push(a);
  }

  // Ventas de producto sin cita (cera, shampoo)
  if (F.products) {
    const items = [['Cera para peinar', 180, 'cash'], ['Shampoo para barba', 220, 'card'], ['Cera para peinar', 180, 'cash'], ['Shampoo para barba', 220, 'transfer']];
    // Días recientes con cobros (el más reciente puede ser hoy), espaciados.
    const days = [...new Set(slots.filter((s) => s.pay && s.off >= -14).map((s) => s.date))].sort().reverse();
    [days[0], days[2], days[5], days[8]].forEach((date, i) => {
      if (!date) return;
      const s = R.pick(slots.filter((x) => x.date === date && x.pay));
      const t = Math.min(s.payMs + R.int(1, 3) * 60000, nowMs);
      out.payments.push(withShop({ id: newId('pay'), appointment_id: null, client_id: s.client.id, staff_id: owner.id, amount: items[i][1], tip: 0, method: items[i][2], concept: items[i][0] + ' (producto)', status: 'paid', cash_session_id: null, created_by: owner.id, created_at: iso(t), date }));
    });
  }

  // 7) Caja: un corte por día hábil pasado + la caja de hoy abierta
  if (F.cash) {
    const payByDate = groupBy(out.payments, (p) => p.date);
    let lastClosed = null;
    for (let date = histStart; date <= today; date = addDays(date, 1)) {
      const isToday = date === today;
      if (shopClosed(date) && !isToday) continue;
      const h = hours[weekday(date)] || [];
      const openMin = h.length ? h[0][0] : 600, closeMin = h.length ? h[h.length - 1][1] : 1200;
      const openedMs = isToday ? T(date, Math.max(0, Math.min(openMin - 15, nowMin - 1))) : T(date, openMin - R.int(10, 20), R.int(0, 59));
      const sid = newId('cs');
      const pays = (payByDate[date] || []).slice().sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
      for (const p of pays) if (p.method === 'cash') p.cash_session_id = sid;
      const mv = [];
      const cashUntil = (min) => { const lim = T(date, min); return sum(pays.filter((p) => p.method === 'cash' && Date.parse(p.created_at) <= lim), (p) => p.amount + p.tip); };
      if (!isToday || nowMin > openMin + 150) {
        const hi = isToday ? nowMin - 10 : closeMin - 120;
        const at = R.int(openMin + 60, Math.max(openMin + 61, hi));
        if (R.chance(0.14)) mv.push({ type: 'expense', amount: R.pick([180, 240, 320, 450]), concept: 'Toallas y navajas', min: at });
        else if (R.chance(0.1)) mv.push({ type: 'expense', amount: R.pick([90, 135, 150]), concept: R.pick(['Garrafones de agua', 'Artículos de limpieza', 'Café para clientes']), min: at });
      }
      if (!isToday) {
        const at = R.int(closeMin - 150, closeMin - 30);
        const avail = 500 + cashUntil(at) - sum(mv, (m) => m.amount);
        const amount = Math.floor((avail * 0.7) / 500) * 500;
        if (avail > 1800 && amount >= 500 && R.chance(0.55)) mv.push({ type: 'withdrawal', amount, concept: 'Depósito a banco', min: at });
      }
      for (const m of mv) out.cash_movements.push(withShop({ id: newId('cm'), cash_session_id: sid, type: m.type, amount: m.amount, concept: m.concept, created_by: owner.id, created_by_name: owner.name, created_at: iso(T(date, m.min, R.int(0, 59))) }));
      const row = withShop({ id: sid, status: 'open', opened_by: owner.id, opened_by_name: owner.name, opened_at: iso(openedMs), opening_float: 500, closed_by: null, closed_by_name: null, closed_at: null, expected_cash: null, counted_cash: null, difference: null, notes: null, date });
      if (!isToday) {
        const cash = sum(pays.filter((p) => p.method === 'cash'), (p) => p.amount + p.tip);
        const expected = money(500 + cash + sum(mv, (m) => (m.type === 'income' ? m.amount : -m.amount)));
        const lastPay = pays.length ? Date.parse(pays[pays.length - 1].created_at) : 0;
        const closedMs = Math.max(T(date, closeMin + R.int(8, 30), R.int(0, 59)), lastPay + 60000);
        const diff = R.chance(0.07) ? R.pick([-20, 10]) : 0;
        Object.assign(row, { status: 'closed', closed_by: owner.id, closed_by_name: owner.name, closed_at: iso(closedMs), expected_cash: expected, counted_cash: money(expected + diff), difference: diff });
        lastClosed = row;
      }
      out.cash_sessions.push(row);
    }
    // El último corte con faltante de $20 (historia para enseñar el aviso de caja)
    if (lastClosed && F.engineer) { lastClosed.difference = -20; lastClosed.counted_cash = money(lastClosed.expected_cash - 20); }
    for (const c of out.cash_sessions) if (c.difference) c.notes = 'Cierre: ' + (c.difference < 0 ? 'Faltaron $' + -c.difference + '; se revisará con el equipo.' : 'Sobraron $' + c.difference + ' de cambio.');
    out.lastClosed = lastClosed;
  }

  // 8) Comisiones: pagos quincenales de periodos ya cerrados (comisión + propinas → saldo del periodo en 0).
  //    Al dueño (comisión 0 %) solo se le liquidan sus propinas, para que su saldo también quede en 0.
  if (F.payouts) {
    const periods = [];
    for (let m = histStart.slice(0, 8) + '01'; m <= today; m = addDays(m, 32).slice(0, 8) + '01') {
      const end = addDays(addDays(m, 32).slice(0, 8) + '01', -1);
      periods.push([m, m.slice(0, 8) + '15'], [m.slice(0, 8) + '16', end]);
    }
    for (const [from, to] of periods) {
      if (to >= today || to < histStart) continue;
      let payDate = addDays(to, 1);
      if (weekday(payDate) === 0) payDate = addDays(payDate, 1);
      const payMs = T(payDate, R.int(780, 840), R.int(0, 59));
      if (payMs > nowMs) continue;
      for (const s of staff) {
        const ps = out.payments.filter((p) => p.staff_id === s.id && p.status === 'paid' && p.date >= from && p.date <= to);
        const revenue = money(sum(ps, (p) => p.amount)), tips = money(sum(ps, (p) => p.tip));
        const commission = money((revenue * s.commission_pct) / 100);
        const amount = money(commission + tips);
        if (amount <= 0) continue;
        const d1 = parseDateKey(from), d2 = parseDateKey(to);
        const what = commission > 0 ? 'comisión ' + fmtMoney(commission) + ' + propinas ' + fmtMoney(tips) : 'propinas ' + fmtMoney(tips);
        out.commission_payouts.push(withShop({ id: newId('po'), staff_id: s.id, period_from: from, period_to: to, amount, note: 'Quincena del ' + d1.getUTCDate() + ' al ' + d2.getUTCDate() + ' de ' + MESES[d2.getUTCMonth()] + ' (' + what + ')', created_by: owner.id, created_at: iso(payMs) }));
      }
    }
  }

  // 9) Clientes: fichas finales (alta, origen, etiquetas, notas, cumpleaños)
  const spent = (c) => sum(c.slots.filter((s) => s.status === 'completed'), (s) => s.total);
  const vip = new Set(clients.filter((c) => c.slots.filter((s) => s.status === 'completed').length >= 4).sort((a, b) => spent(b) - spent(a)).slice(0, 8));
  const thisMonth = today.slice(5, 7);
  const bdayPicks = new Set(R.shuffle(clients.filter((c) => !c.fixed)).slice(0, 9));
  for (const c of clients) {
    const first = c.slots[0];
    let created;
    if (!c.isNew) created = T(addDays(histStart, -R.int(20, 400)), R.int(600, 1200), R.int(0, 59));
    else if (first) created = Math.min(Math.min(...c.slots.map((x) => x.createdMs)) - 60000, T(addDays(today, Math.min(c.joinIdx, 0)), R.int(600, 1200)));
    else created = T(addDays(today, Math.min(c.joinIdx, 0)), R.int(600, 1200), R.int(0, 59));
    created = Math.max(shopCreated, clamp(created));
    if (c.fixed) created = Math.min(created, T(addDays(histStart, -2), 1260));
    c.createdMs = created;
    const done = c.slots.filter((s) => s.status === 'completed');
    const has = (keys) => done.filter((s) => s.services.some((x) => keys.includes(x.key))).length;
    const tags = [];
    if (vip.has(c)) tags.push('VIP');
    if (c.seg === 'freq' && done.length >= 5) tags.push('Frecuente');
    if (done.length >= 3 && has(['fade']) / done.length >= 0.4) tags.push('Fade');
    if (done.length >= 3 && has(['barba', 'combo', 'afeitado']) / done.length >= 0.4) tags.push('Barba');
    if (created >= nowMs - 21 * DAY_MS) tags.push('Nuevo');
    const pref = c.pref && byKey[c.pref];
    let notes = null;
    if (c.fixed) notes = fx.notes;
    else if (pref && pref.role === 'barber' && R.chance(0.25)) notes = 'Prefiere a ' + firstName(pref.name);
    else if (R.chance(0.18)) notes = R.pick(NOTES);
    let birthday = null;
    if (c.fixed) birthday = '1991-' + thisMonth + '-' + pad2(Math.min(28, +today.slice(8) + 3));
    else if (bdayPicks.has(c)) birthday = R.int(1970, 2006) + '-' + thisMonth + '-' + pad2(R.int(1, 28));
    else if (R.chance(0.7)) birthday = R.int(1968, 2008) + '-' + pad2(R.int(1, 12)) + '-' + pad2(R.int(1, 28));
    const source = c.isNew ? (first ? first.source : 'online') : R.weighted([['manual', 40], ['online', 45], ['walkin', 15]]);
    out.clients.push(withShop({
      id: c.id, user_id: c.fixed ? c.userId : null, name: c.p.name, phone: c.phone,
      email: c.fixed ? fx.email : (R.chance(0.35) ? emailFor(R, c.p) : null), birthday, notes,
      tags: c.fixed ? Array.from(new Set(fx.tags.concat(tags.filter((t) => t !== 'Nuevo')))) : tags.slice(0, 3),
      source, marketing_ok: c.fixed ? true : R.chance(0.9), deleted_at: null, created_at: iso(created), updated_at: null
    }));
  }
  if (jorge) out.users.push({ id: jorge.userId, email: fx.email, name: fx.name, phone: jorge.phone, password_hash: hashes.pw[fx.email], is_superadmin: false, status: 'active', created_at: iso(jorge.createdMs), last_login_at: null });

  // 10) Mensajes de WhatsApp (modo manual): confirmaciones, recordatorios, gracias
  const staffName = (s) => s.staff.name;
  const booking = base + '/?b=' + encodeURIComponent(cfg.slug);
  const review = (cfg.shop.settings.public && cfg.shop.settings.public.review_url) || booking;
  const vars = (s) => ({ cliente: firstName(s.row.client_name), barberia: cfg.shop.name, fecha: fmtDateEs(s.date), hora: fmtMin(s.start), servicios: s.row.services.map((x) => x.name).join(' + '), barbero: staffName(s), total: fmtMoney(s.total), folio: s.row.folio, enlace: booking, direccion: cfg.shop.address || '', resena: review });
  const msg = (s, kind, atMs, status, by) => {
    out.messages.push(withShop({ id: newId('msg'), appointment_id: s.row.id, client_id: s.client.id, channel: 'whatsapp', kind, to_phone: s.client.phone, body: render(DEFAULT_TEMPLATES[kind], vars(s)), status, provider_id: null, error: null, created_by: by, created_at: iso(atMs), sent_at: status === 'sent' ? iso(Math.min(atMs + 60000, nowMs)) : null }));
  };
  if (F.messages) {
    for (const s of slots) {
      const by = R.chance(0.6) ? owner.id : s.staff.id;
      if (s.source !== 'walkin' && s.createdMs >= nowMs - 4 * DAY_MS && R.chance(s.source === 'manual' ? 0.8 : 0.4)) {
        msg(s, 'confirmation', clamp(s.createdMs + R.int(2, 15) * 60000), R.chance(0.75) ? 'sent' : 'opened', by);
      }
      if (s.off >= -3 && s.off <= 1 && s.status !== 'cancelled' && s.source !== 'walkin' && R.chance(s.off === 1 ? 0.5 : 0.55)) {
        let at = T(addDays(s.date, -1), R.int(1080, 1230), R.int(0, 59));
        if (s.off === 1 && at > nowMs - 5 * 60000) at = nowMin >= 600 ? T(today, R.int(540, Math.max(541, nowMin - 5))) : 0;
        if (at && at > s.createdMs && at < nowMs) { msg(s, 'reminder', at, 'sent', by); s.row.reminder_sent_at = iso(Math.min(at + 60000, nowMs)); }
      }
      if (s.status === 'completed' && s.off >= -3 && R.chance(0.35)) {
        const at = clamp(s.payMs + R.int(10, 90) * 60000);
        if (at > s.payMs) msg(s, 'thanks', at, 'sent', by);
      }
      if (s.status === 'no_show' && s.off >= -3 && R.chance(0.5)) msg(s, 'no_show', clamp(s.noShowMs + R.int(5, 40) * 60000), 'sent', by);
      if (s.status === 'cancelled' && s.cancelled_by === 'staff' && s.cancelMs >= nowMs - 4 * DAY_MS) msg(s, 'cancellation', clamp(s.cancelMs + R.int(1, 10) * 60000), 'sent', by);
    }
  }

  // 11) Historial de citas (solo últimos días y futuras, para no inflar el tamaño)
  if (F.events) {
    const ev = (s, type, data, atMs, actor) => out.appointment_events.push(withShop({ id: newId('ev'), appointment_id: s.row.id, type, data, actor_id: actor.id || null, actor_name: actor.name || null, created_at: iso(atMs) }));
    const staffActor = (s) => ({ id: s.staff.id, name: s.staff.name });
    const clientActor = (s) => (s.client === jorge ? { id: jorge.userId, name: jorge.p.name } : { id: null, name: 'Cliente (en línea)' });
    for (const s of slots) {
      if (s.off < -F.events) continue;
      const initial = s.status === 'pending' ? 'pending' : 'confirmed';
      ev(s, 'created', { source: s.source, status: initial, staff_id: s.staff.id, date: s.date, start_min: s.start, total: s.total }, s.createdMs, s.actor);
      if (s.resMs) ev(s, 'rescheduled', { from: s.resFrom, to: { date: s.date, start_min: s.start, staff_id: s.staff.id }, by: s.resBy }, s.resMs, s.resBy === 'client' ? clientActor(s) : { id: owner.id, name: owner.name });
      if (s.status === 'completed') {
        ev(s, 'status', { from: 'confirmed', to: 'completed', reason: null, by: 'staff' }, s.payMs, staffActor(s));
        ev(s, 'payment', { action: 'charge', payment_id: s.pay.id, amount: s.pay.amount, tip: s.pay.tip, method: s.pay.method }, s.payMs, staffActor(s));
      } else if (s.status === 'cancelled') {
        ev(s, 'status', { from: 'confirmed', to: 'cancelled', reason: s.cancel_reason, by: s.cancelled_by }, s.cancelMs, s.cancelled_by === 'client' ? clientActor(s) : { id: owner.id, name: owner.name });
      } else if (s.status === 'no_show') ev(s, 'status', { from: 'confirmed', to: 'no_show', reason: null, by: 'staff' }, s.noShowMs, staffActor(s));
    }
  }

  // 12) Centro de notificaciones
  const notes = [];
  const nt = (staffId, type, title, body, link, data, atMs) => notes.push({ staffId, type, title, body, link, data, atMs });
  const apptNote = (s, type, title, atMs, extra) => {
    const body = summary(s.row, s.staff.name) + (extra || '');
    const data = { appointment_id: s.row.id, folio: s.row.folio };
    nt(owner.id, type, title, body, '#/agenda?cita=' + s.row.id, data, atMs);
    if (s.staff.id !== owner.id) nt(s.staff.id, type, title, body, '#/agenda?cita=' + s.row.id, data, atMs);
  };
  const welcomeAt = nowMs - 2 * 60000;
  const unreadOwner = new Set();
  if (F.notifications === 'full') {
    for (const s of staff) nt(s.id, 'system', '¡Bienvenido a la demo de TuBarbería!', 'Todo lo que ves en ' + cfg.shop.name + ' son datos ficticios. Explora la agenda, los clientes, la caja y los reportes con total libertad; puedes reiniciar la demo cuando quieras.', '#/guia', { kind: 'welcome', slug: cfg.slug }, welcomeAt);
    unreadOwner.add(notes[0]);
    const online = slots.filter((s) => s.source === 'online' && s.off >= 0 && s.status !== 'cancelled' && !s.recent && s.createdMs >= nowMs - 3 * DAY_MS).sort((a, b) => b.createdMs - a.createdMs);
    const mine = online.filter((s) => s.staff === mainBarber).slice(0, 2);
    const newOnes = mine.concat(online.filter((s) => !mine.includes(s)).slice(0, 5 - mine.length)).sort((a, b) => b.createdMs - a.createdMs);
    newOnes.forEach((s, i) => { const n0 = notes.length; apptNote(s, 'booking_new', 'Nueva reserva en línea', s.createdMs); if (i < 3) unreadOwner.add(notes[n0]); });
    const canc = slots.filter((s) => s.recent && s.status === 'cancelled').sort((a, b) => b.cancelMs - a.cancelMs);
    canc.forEach((s, i) => { const n0 = notes.length; apptNote(s, 'booking_cancelled', 'Cita cancelada por el cliente', s.cancelMs, ' · Motivo: ' + s.cancel_reason); if (i === 0) unreadOwner.add(notes[n0]); });
    const res = slots.filter((s) => s.recent && s.resMs).sort((a, b) => b.resMs - a.resMs);
    res.forEach((s, i) => { const n0 = notes.length; apptNote(s, 'booking_rescheduled', 'Cita reagendada por el cliente', s.resMs, beforeText(s.resFrom, s.row)); if (i === 0) unreadOwner.add(notes[n0]); });
    const lc = out.lastClosed;
    if (lc) {
      const d = lc.difference, kind = d < 0 ? 'faltante' : 'sobrante';
      nt(owner.id, 'cash_closed', 'Corte de caja con ' + kind + ' de ' + fmtMoney(Math.abs(d)), 'Esperado ' + fmtMoney(lc.expected_cash) + ' · Contado ' + fmtMoney(lc.counted_cash) + ' · Diferencia ' + (d > 0 ? '+' : '−') + fmtMoney(Math.abs(d)) + ' · Cerró ' + owner.name, '#/caja', { cash_session_id: lc.id, expected_cash: lc.expected_cash, counted_cash: lc.counted_cash, difference: d }, Date.parse(lc.closed_at));
      unreadOwner.add(notes[notes.length - 1]);
    }
    const fresh = clients.filter((c) => c.isNew && !c.fixed && c.slots.length && c.slots[0].source === 'online').sort((a, b) => b.createdMs - a.createdMs).slice(0, 3);
    fresh.forEach((c, i) => { nt(owner.id, 'client_new', 'Nuevo cliente', c.p.name + ' reservó por primera vez en línea.', '#/clientes/' + c.id, { client_id: c.id }, c.createdMs); if (i === 0) unreadOwner.add(notes[notes.length - 1]); });
  } else if (F.notifications === 'basic') {
    nt(owner.id, 'system', '¡Bienvenido a TuBarbería!', cfg.shop.name + ' ya está lista. Revisa tus servicios y horarios, invita a tu equipo y comparte tu enlace de reservas.', '#/ajustes', { kind: 'welcome', slug: cfg.slug }, shopCreated + 60000);
    slots.filter((s) => s.source === 'online' && s.off >= 0 && s.status !== 'cancelled').sort((a, b) => b.createdMs - a.createdMs).slice(0, 2)
      .forEach((s) => nt(owner.id, 'booking_new', 'Nueva reserva en línea', summary(s.row, s.staff.name), '#/agenda?cita=' + s.row.id, { appointment_id: s.row.id, folio: s.row.folio }, s.createdMs));
  }
  // Leídas / sin leer: dueño según lo elegido arriba; cada barbero, N sin leer por prioridad
  // (bienvenida, la cancelación más reciente, la reserva nueva más reciente, la reagenda más reciente).
  const byStaff = groupBy(notes, (n) => n.staffId);
  for (const s of staff) {
    const list = (byStaff[s.id] || []).sort((a, b) => b.atMs - a.atMs);
    const prio = ['system', 'booking_cancelled', 'booking_new', 'booking_rescheduled'].map((t) => list.find((n) => n.type === t)).filter(Boolean);
    const unreadBarber = new Set(prio.slice(0, s.unread || 0));
    list.forEach((n, i) => {
      const unread = F.notifications === 'full' ? (s.id === owner.id ? unreadOwner.has(n) : unreadBarber.has(n)) : i === 0;
      const at = clamp(n.atMs);
      out.notifications.push(withShop({ id: newId('nt'), staff_id: s.id, client_id: null, type: n.type, title: n.title, body: n.body, link: n.link, data: n.data, read_at: unread ? null : iso(Math.min(at + R.int(5, 240) * 60000, nowMs - 30000)), created_at: iso(at) }));
    });
  }

  const shopStaff = staff.map((s) => ({ staff_id: s.id, name: s.name, role: s.role, pin: s.pin || null }));
  return { out, pins: shopStaff.filter((p) => p.pin), jorge };
}

// ── Punto de entrada ──
export async function seedDemo(db, opts) {
  opts = opts || {};
  const tzNow = nowInTz(DEMO_TZ);
  const today = isDateKey(opts.today) ? opts.today : tzNow.date;
  const nowMin = Number.isInteger(opts.nowMin) && opts.nowMin >= 0 && opts.nowMin < 1440 ? opts.nowMin : (today === tzNow.date ? tzNow.minutes : 780);
  const seed = Number.isFinite(Number(opts.seed)) && opts.seed !== null && opts.seed !== '' ? Number(opts.seed) >>> 0 : 20260924;
  const withPlatform = opts.withPlatform !== false;
  const base = typeof opts.base === 'string' && /^https?:\/\//.test(opts.base) ? opts.base.replace(/\/+$/, '') : 'https://tubarberia.mx';
  if (await db.findOne('shops', { slug: DEMO_SHOP_SLUG })) throw new Error('La demo ya está cargada en esta base (slug "' + DEMO_SHOP_SLUG + '").');
  const clock = makeClock(DEMO_TZ, today, nowMin);

  // Hashes en paralelo (lo único costoso de la siembra).
  const emails = [DEMO_CREDENTIALS.owner.email, DEMO_CREDENTIALS.barber.email, DEMO_CREDENTIALS.client.email].concat(withPlatform ? [DEMO_CREDENTIALS.superadmin.email, DEMO_NORTE_CREDENTIALS.owner.email] : []);
  const pinKeys = DEMO_PINS.map((p) => DEMO_SHOP_SLUG + ':' + p.pin).concat(withPlatform ? DEMO_NORTE_PINS.map((p) => DEMO_NORTE_SLUG + ':' + p.pin) : []);
  const [pwList, pinList] = await Promise.all([
    Promise.all(emails.map(() => hashSecret(PW, PW_ITERATIONS))),
    Promise.all(pinKeys.map((k) => hashSecret(k.split(':')[1], PIN_ITERATIONS)))
  ]);
  const hashes = { pw: Object.fromEntries(emails.map((e, i) => [e, pwList[i]])), pin: Object.fromEntries(pinKeys.map((k, i) => [k, pinList[i]])) };

  const demo = buildShop(demoConfig(clock), makeRng(seed), clock, hashes, base);
  const shops = [demo];
  let norte = null;
  const users = demo.out.users.slice();
  if (withPlatform) {
    norte = buildShop(norteConfig(clock), makeRng((seed ^ 0x9E3779B9) >>> 0), clock, hashes, base);
    shops.push(norte);
    users.push(...norte.out.users);
    users.push({ id: newId('us'), email: DEMO_CREDENTIALS.superadmin.email, name: 'Equipo TuBarbería', phone: null, password_hash: hashes.pw[DEMO_CREDENTIALS.superadmin.email], is_superadmin: true, status: 'active', created_at: clock.iso(clock.ms(addDays(today, -180), 600)), last_login_at: null });
  }

  // Nada se inserta si algún correo ya existe (evita una demo a medias en una base con datos).
  for (const u of users) if (await db.findOne('users', { email: u.email })) throw new Error('Ya existe un usuario con el correo ' + u.email + '.');
  const shopRows = [];
  for (const s of shops) shopRows.push(await db.insert('shops', s.out.shop));
  for (const u of users) await db.insert('users', u);
  const TABLES = ['staff', 'services', 'availability', 'time_off', 'clients', 'appointments', 'payments', 'cash_sessions', 'cash_movements', 'commission_payouts', 'appointment_events', 'notifications', 'messages'];
  const counts = {};
  for (const t of TABLES) {
    const rows = [].concat(...shops.map((s) => s.out[t]));
    if (rows.length) await db.insertMany(t, rows);
    counts[t] = shops.map((s) => s.out[t].length);
  }
  const credentials = Object.assign({}, DEMO_CREDENTIALS, withPlatform ? { norte: DEMO_NORTE_CREDENTIALS.owner } : {});
  if (!withPlatform) delete credentials.superadmin;
  return {
    shop: shopRows[0],
    norte: shopRows[1] || null,
    credentials,
    pins: demo.pins,
    norte_pins: norte ? norte.pins : [],
    today, now_min: nowMin, seed,
    counts
  };
}
