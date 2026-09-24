// Aviso por correo al dueño cuando llega una reserva en línea (API de Resend, https://resend.com).
// Portado de la antigua functions/api/notificar-cita.js: escapa HTML y recorta cada campo.
//
//   sendBookingEmail(env, shop, appointment) → { ok:true, id } | { ok:false, error, status? }
//
// Destino: settings.notify_email de la barbería o, si no hay, env.DEST_EMAIL.
// Remitente: env.FROM_EMAIL o '<nombre de la barbería> <onboarding@resend.dev>'.
// En la demo (env.MODE === 'demo') o sin RESEND_API_KEY / destino → { ok:false, error:'not_configured' } SIN red.
// NUNCA lanza: el correo es un extra y jamás debe romper una reserva.
import { isEmail, fmtMin } from '../util.js';
import { shopSettings } from './settings.js';
import { fmtDateEs } from './appointments.js';

const RESEND_URL = 'https://api.resend.com/emails';
const TIMEOUT_MS = 8000;

export function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const cut = (v, max) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);
function moneyText(n, currency) {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  const s = (Number.isInteger(v) ? String(v) : v.toFixed(2)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return '$' + s + ' ' + (currency || 'MXN');
}
// Nombre visible del remitente sin caracteres que rompan la cabecera From.
function fromName(shop) { return cut(shop && shop.name, 60).replace(/[<>"\\,;:\r\n]/g, '').trim() || 'TuBarbería'; }

// Destino y remitente efectivos (o null si no se puede enviar).
export function emailConfig(env, shop) {
  env = env || {};
  if (env.MODE === 'demo' || !env.RESEND_API_KEY) return null;
  let to = '';
  try { to = String(shopSettings(shop).notify_email || '').trim(); } catch (e) { to = ''; }
  if (!isEmail(to)) to = String(env.DEST_EMAIL || '').trim();
  if (!isEmail(to)) return null;
  return { to, from: env.FROM_EMAIL || fromName(shop) + ' <onboarding@resend.dev>', key: env.RESEND_API_KEY };
}

// Asunto, HTML y texto plano del aviso. appointment = fila de la cita (+ staff_name opcional).
export function bookingEmailContent(shop, a, env) {
  a = a || {};
  const folio = cut(a.folio, 40);
  const name = cut(a.client_name, 120) || 'Cliente';
  const phone = cut(a.client_phone, 30);
  let fecha = '';
  try { fecha = a.date ? fmtDateEs(a.date) : ''; } catch (e) { fecha = ''; }
  const hora = Number.isInteger(a.start_min) && a.start_min >= 0 && a.start_min < 1440 ? fmtMin(a.start_min) : '';
  const barbero = cut(a.staff_name, 60);
  const servicios = (Array.isArray(a.services) ? a.services : []).slice(0, 10).map((s) => cut(s && typeof s === 'object' ? s.name : s, 80)).filter(Boolean);
  const total = moneyText(a.total, shop && shop.currency);
  const nota = cut(a.client_note, 500);
  const pending = a.status === 'pending';
  const base = env && typeof env.PUBLIC_URL === 'string' ? env.PUBLIC_URL.replace(/\/+$/, '') : '';
  const link = base && /^https?:\/\//i.test(base) && a.id ? base + '/app/#/agenda?cita=' + encodeURIComponent(a.id) : '';

  const subject = cut('Nueva cita: ' + name + (fecha ? ' — ' + fecha : '') + (hora ? ' ' + hora : ''), 200);
  const html =
    '<div style="font-family:-apple-system,Helvetica,Arial,sans-serif;max-width:480px;color:#15130F">' +
    '<h2 style="margin:0 0 10px">Nueva cita' + (folio ? ' · ' + escapeHtml(folio) : '') + '</h2>' +
    (pending ? '<p style="margin:0 0 10px;color:#9a6700"><b>Pendiente de confirmar</b></p>' : '') +
    '<p style="margin:0 0 6px"><b>' + escapeHtml(name) + '</b>' + (phone ? ' · ' + escapeHtml(phone) : '') + '</p>' +
    '<p style="margin:0 0 6px">' + escapeHtml(fecha) + (hora ? ' a las ' + escapeHtml(hora) : '') + (barbero ? ' con ' + escapeHtml(barbero) : '') + '</p>' +
    '<p style="margin:0 0 6px">' + escapeHtml(servicios.join(' + ')) + ' — ' + escapeHtml(total) + '</p>' +
    (nota ? '<p style="margin:8px 0 0;color:#7A7366"><i>Nota: ' + escapeHtml(nota) + '</i></p>' : '') +
    (link ? '<p style="margin:14px 0 0"><a href="' + escapeHtml(link) + '" style="color:#15130F">Ver en la agenda</a></p>' : '') +
    '</div>';
  const text = [
    'Nueva cita' + (folio ? ' · ' + folio : '') + (pending ? ' (pendiente de confirmar)' : ''),
    name + (phone ? ' · ' + phone : ''),
    fecha + (hora ? ' a las ' + hora : '') + (barbero ? ' con ' + barbero : ''),
    servicios.join(' + ') + ' — ' + total,
    nota ? 'Nota: ' + nota : '',
    link
  ].filter(Boolean).join('\n');
  return { subject, html, text };
}

export async function sendBookingEmail(env, shop, appointment) {
  try {
    const cfg = emailConfig(env, shop);
    if (!cfg) return { ok: false, error: 'not_configured' };
    if (typeof fetch !== 'function') return { ok: false, error: 'not_configured' };
    const { subject, html, text } = bookingEmailContent(shop, appointment, env);
    const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), TIMEOUT_MS) : null;
    let r;
    try {
      r = await fetch(RESEND_URL, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + cfg.key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: cfg.from, to: [cfg.to], subject, html, text }),
        signal: ctrl ? ctrl.signal : undefined
      });
    } finally { if (timer) clearTimeout(timer); }
    if (!r || !r.ok) return { ok: false, error: 'send_failed', status: r ? r.status : 0 };
    let id = null;
    try { const j = await r.json(); id = j && j.id ? String(j.id) : null; } catch (e) { /* respuesta sin JSON */ }
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: 'exception' };
  }
}
