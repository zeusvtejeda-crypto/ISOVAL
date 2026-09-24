// Configuración por defecto de una barbería (shops.settings). Se mezcla en profundidad con lo guardado.

export const DEFAULT_HOURS = {
  // minutos desde medianoche; índice = día de la semana (0 = domingo)
  0: [], 1: [[600, 1200]], 2: [[600, 1200]], 3: [[600, 1200]], 4: [[600, 1200]], 5: [[600, 1200]], 6: [[600, 960]]
};

export const DEFAULT_TEMPLATES = {
  // Variables: {cliente} {barberia} {fecha} {hora} {servicios} {barbero} {total} {folio} {enlace} {direccion} {resena}
  confirmation: 'Hola {cliente} 👋 Tu cita en {barberia} quedó confirmada.\n📅 {fecha} a las {hora}\n✂️ {servicios} con {barbero}\n💵 Total: {total}\nFolio: {folio}\nGestiona tu cita: {enlace}',
  reminder: 'Hola {cliente}, te recordamos tu cita en {barberia}:\n📅 {fecha} a las {hora}\n✂️ {servicios} con {barbero}\n📍 {direccion}\nSi no puedes asistir, avísanos o reagenda aquí: {enlace}',
  reschedule: 'Hola {cliente}, tu cita en {barberia} fue reagendada.\n📅 Nuevo horario: {fecha} a las {hora}\n✂️ {servicios} con {barbero}\nFolio: {folio}',
  cancellation: 'Hola {cliente}, tu cita en {barberia} del {fecha} a las {hora} fue cancelada. Cuando quieras, reserva de nuevo: {enlace}',
  thanks: '¡Gracias por tu visita, {cliente}! 💈 Esperamos verte pronto en {barberia}. Si te gustó el servicio, déjanos tu reseña: {resena}',
  no_show: 'Hola {cliente}, te esperamos hoy a las {hora} en {barberia} y no pudimos atenderte. ¿Quieres reagendar? {enlace}'
};

export const DEFAULT_SETTINGS = {
  hours: DEFAULT_HOURS,
  booking: {
    step_min: 20,          // cada cuánto se ofrecen horarios
    lead_min: 30,          // anticipación mínima para reservar en línea
    window_days: 21,       // cuántos días hacia adelante se puede reservar
    buffer_min: 0,         // descanso entre citas del mismo barbero
    cancel_hours: 2,       // el cliente puede cancelar/reagendar hasta N horas antes
    auto_confirm: true,    // reservas en línea entran confirmadas (false = pendientes)
    require_phone: true,
    allow_any_staff: true, // opción "Cualquier barbero"
    online_enabled: true
  },
  whatsapp: {
    mode: 'manual',        // manual (abre wa.me) | auto (encola en messages para un proveedor)
    country_code: '52',
    templates: DEFAULT_TEMPLATES,
    reminder_hours: 24
  },
  payments: { methods: ['cash', 'card', 'transfer'], tips: true },
  public: {
    rating: null, reviews_count: null, review_url: '', instagram: '', facebook: '', tiktok: '',
    policies: 'Pago en tienda. Cancela con al menos 2 horas de antelación.',
    gallery: []
  },
  notify_email: ''         // correo para aviso de nuevas reservas (requiere RESEND_API_KEY en el servidor)
};

function isObj(o) { return o && typeof o === 'object' && !Array.isArray(o); }
export function deepMerge(base, over) {
  if (!isObj(base)) return over === undefined ? base : over;
  const out = Object.assign({}, base);
  for (const k of Object.keys(over || {})) {
    out[k] = isObj(base[k]) && isObj(over[k]) ? deepMerge(base[k], over[k]) : over[k];
  }
  return out;
}
export function shopSettings(shop) { return deepMerge(DEFAULT_SETTINGS, (shop && shop.settings) || {}); }
