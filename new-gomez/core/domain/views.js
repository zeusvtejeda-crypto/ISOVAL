// Formas de datos que devuelve la API (docs/API.md → "Vistas"). Compartidas por todos los módulos.
import { shopSettings } from './settings.js';
import { sum } from '../util.js';

// Appointment: fila sin manage_token_hash + staff_name, staff_color, paid, balance.
// rows puede ser una fila o un arreglo. Hace 2 consultas en total (staff + pagos), no una por cita.
export async function apptView(sdb, rows) {
  const single = !Array.isArray(rows);
  const list = single ? [rows] : rows;
  if (!list.length) return single ? null : [];
  const staff = await sdb.find('staff', {});
  const byId = Object.fromEntries(staff.map((s) => [s.id, s]));
  const ids = list.map((a) => a.id);
  const pays = await sdb.find('payments', { appointment_id: { in: ids }, status: 'paid' });
  const paidBy = {};
  for (const p of pays) paidBy[p.appointment_id] = (paidBy[p.appointment_id] || 0) + (p.amount || 0);
  const out = list.map((a) => {
    const v = Object.assign({}, a);
    delete v.manage_token_hash;
    const s = byId[a.staff_id];
    v.staff_name = s ? s.name : 'Sin asignar';
    v.staff_color = s ? (s.color || '') : '';
    v.paid = Math.round((paidBy[a.id] || 0) * 100) / 100;
    v.balance = Math.max(0, Math.round(((a.total || 0) - v.paid) * 100) / 100);
    return v;
  });
  return single ? out[0] : out;
}

export function publicApptView(a, shop, staffName) {
  return {
    id: a.id, folio: a.folio, date: a.date, start_min: a.start_min, end_min: a.end_min, duration_min: a.duration_min,
    services: a.services || [], total: a.total, status: a.status, staff_id: a.staff_id, staff_name: staffName || '',
    client_name: a.client_name || '', client_note: a.client_note || '',
    shop: shop ? { name: shop.name, slug: shop.slug, address: shop.address || '', phone: shop.phone || '', whatsapp: shop.whatsapp || shop.phone || '', timezone: shop.timezone } : null
  };
}

export function staffView(s, user) {
  if (!s) return null;
  const v = Object.assign({}, s);
  delete v.pin_hash;
  v.has_pin = !!s.pin_hash;
  v.email = user ? user.email : '';
  v.has_account = !!s.user_id;
  return v;
}

export function publicShopView(shop) {
  const st = shopSettings(shop);
  const b = st.booking;
  return {
    id: shop.id, slug: shop.slug, name: shop.name, tagline: shop.tagline || '', description: shop.description || '',
    phone: shop.phone || '', whatsapp: shop.whatsapp || shop.phone || '', email: shop.email || '', address: shop.address || '',
    city: shop.city || '', maps_url: shop.maps_url || '', timezone: shop.timezone, currency: shop.currency,
    logo_url: shop.logo_url || '', cover_url: shop.cover_url || '', brand_color: shop.brand_color || '',
    hours: st.hours,
    booking: { step_min: b.step_min, lead_min: b.lead_min, window_days: b.window_days, cancel_hours: b.cancel_hours, auto_confirm: b.auto_confirm, require_phone: b.require_phone, allow_any_staff: b.allow_any_staff, online_enabled: b.online_enabled },
    public: st.public,
    payment_methods: st.payments.methods
  };
}

export const totalOf = (services) => sum(services || [], (s) => Number(s.price) || 0);
export const durationOf = (services) => sum(services || [], (s) => Number(s.duration_min) || 0);
