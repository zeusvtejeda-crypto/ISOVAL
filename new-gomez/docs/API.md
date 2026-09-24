# Contrato de la API (v2)

Fuente de verdad para backend (`core/api/*.js`) y frontend (`app/`, `index.html`).
Todas las respuestas JSON: `{ ok: true, data }` o `{ ok: false, error: { code, message, fields? } }`.
`message` siempre en español, listo para mostrarse al usuario en un toast.

- Fechas: `date` = `'YYYY-MM-DD'` en hora local de la barbería. Horas: `start_min`/`end_min` = minutos desde medianoche.
- Dinero: números (MXN por defecto, `shop.currency`).
- Autenticación: cookie HttpOnly `tb_sid` (navegador) o `Authorization: Bearer <token>` (demo/apps).
  Escrituras con cookie requieren cabecera `x-requested-with: tb` (CSRF).
- Barbería activa: cabecera `x-shop-id: <shop.id>` en rutas `auth: shop`.
- Errores comunes: 400 `bad_request` (con `fields`), 401 `unauthorized`, 403 `forbidden`, 404 `not_found`,
  409 `slot_taken` / `duplicate` / `conflict`, 429 `too_many_requests`, 503 `backend_not_configured`.

## Estados de cita

`pending` (pendiente) → `confirmed` (confirmada) → `completed` (atendida)
`cancelled` (cancelada) · `no_show` (no asistió)

Transiciones permitidas:
| desde \ hacia | pending | confirmed | completed | cancelled | no_show |
|---|---|---|---|---|---|
| pending   | – | ✔ | ✔¹ | ✔ | ✔¹ |
| confirmed | ✔ | – | ✔¹ | ✔ | ✔¹ |
| completed | – | ✔ (deshacer) | – | – | – |
| cancelled | ✔² | ✔² | – | – | – |
| no_show   | – | ✔ (deshacer) | ✔¹ | – | – |

¹ solo si la cita ya empezó o es de hoy/pasada (no se marca "atendida"/"no asistió" una cita futura).
² restaurar una cancelada exige que el horario siga libre (409 `slot_taken` si no).
Citas `cancelled` y `no_show` no ocupan agenda; `no_show` no cuenta como ingreso.

## Vistas (formas de datos)

**Appointment** (lista y detalle): columnas de `appointments` (schema.js) **sin** `manage_token_hash`, más:
`staff_name`, `staff_color`, `paid` (suma de pagos `paid`), `balance` (= total − paid, mínimo 0).

**PublicAppointment**: `{ id, folio, date, start_min, end_min, duration_min, services, total, status, staff_id, staff_name, client_name, client_note, shop: { name, slug, address, phone, whatsapp, timezone } }`

**Staff** (vista): columnas de `staff` sin `pin_hash`, más `has_pin` (bool), `email` (del usuario vinculado o '').

**ClientWithStats**: columnas de `clients` + `stats: { visits, completed, cancelled, no_shows, total_spent, last_visit, next_visit, first_visit, avg_ticket }`.

**Context**: `{ shop_id, shop_slug, shop_name, shop_logo, shop_status, role, staff_id, client_id, display_name }`

## Públicas (sin sesión)

| Método | Ruta | Cuerpo / query | Respuesta |
|---|---|---|---|
| GET | /api/health | – | `{ ok, version, backend, mode }` |
| GET | /api/public/home | `?host=` (opcional) | igual que `/shops/:slug` para la barbería del dominio, o la predeterminada (`env.DEFAULT_SHOP_SLUG`, 'new-gomez') |
| GET | /api/public/shops/:slug | – | `{ shop: PublicShop, services: [...activos], staff: [...reservables] }` |
| GET | /api/public/shops/:slug/days | `from, days(≤60), services=a,b, staff=any\|id` | `{ days: [{ date, open, available }] }` |
| GET | /api/public/shops/:slug/slots | `date, services=a,b, staff=any\|id` | `{ date, duration_min, closed, slots: [{ start_min, staff_ids }] }` |
| POST | /api/public/shops/:slug/appointments | `{ services:[ids], staff_id:'any'\|id, date, start_min, name, phone, email?, note?, first_visit? }` | `{ appointment: PublicAppointment, manage_token }` |
| GET | /api/public/appointments/:token | – | `{ appointment: PublicAppointment, can_cancel, can_reschedule, deadline_text }` |
| POST | /api/public/appointments/:token/cancel | `{ reason? }` | `{ appointment }` |
| POST | /api/public/appointments/:token/reschedule | `{ date, start_min, staff_id? }` | `{ appointment }` |

`PublicShop`: `{ id, slug, name, tagline, description, phone, whatsapp, email, address, city, maps_url, timezone, currency, logo_url, cover_url, brand_color, hours, booking: {step_min, lead_min, window_days, cancel_hours, auto_confirm, require_phone, allow_any_staff, online_enabled}, public: {...settings.public}, payment_methods }`.
Servicios públicos: `{ id, name, description, category, duration_min, price, popular, staff_ids }`. Staff público: `{ id, name, avatar_url, bio, color }`.

Reglas de reserva en línea: respeta `lead_min`, `window_days`, `online_enabled`, horario del barbero, descansos
(`time_off`), `buffer_min` y citas existentes. `staff_id:'any'` asigna al barbero libre con menos citas ese día.
Si el cliente tiene sesión (rol cliente o usuario), la cita se vincula a su ficha. Notifica a dueños + barbero
(`booking_new`) y envía correo si `RESEND_API_KEY` y `settings.notify_email` (o `env.DEST_EMAIL`) existen.

## Autenticación

| Método | Ruta | auth | Cuerpo | Respuesta |
|---|---|---|---|---|
| POST | /api/auth/login | public | `{ email, password }` | `{ user, contexts, token? }` + cookie |
| POST | /api/auth/pin | public | `{ shop_slug, pin }` | `{ user:null, staff, contexts, token? }` + cookie |
| POST | /api/auth/register | public | `{ name, email, password, phone?, shop_slug? }` | `{ user, contexts, token? }` (cuenta de cliente) |
| POST | /api/auth/signup | public | `{ shop_name, owner_name, email, password, phone?, city? }` | `{ user, contexts, shop, token? }` (nueva barbería + dueño) |
| POST | /api/auth/logout | public | – | `null` (borra cookie) |
| GET | /api/auth/me | user | – | `{ user, staff?, contexts, session_kind }` |
| PATCH | /api/auth/profile | user | `{ name?, phone? }` | `{ user }` |
| POST | /api/auth/password | user | `{ current, next }` | `null` |

`token` solo se devuelve con `env.MODE === 'demo'` (la demo usa Bearer). Límites: 5 intentos de contraseña por
correo cada 15 min (bloqueo 15 min); PIN: 8 intentos por barbería+IP cada 15 min. Contraseña ≥ 8 caracteres.
`signup` se desactiva con `env.ALLOW_SIGNUP === '0'`.

## Contexto de barbería (auth: shop)

| Método | Ruta | Permiso | Cuerpo / query | Respuesta |
|---|---|---|---|---|
| GET | /api/context | – | – | `{ shop (completo, settings mezclados con defaults), role, permissions:[...], staff, client, unread }` |
| PATCH | /api/shop | shop.update | campos de shop + `settings` parcial (merge profundo) | `{ shop }` |
| GET | /api/staff | staff.read | `?all=1` incluye inactivos | `[Staff]` |
| POST | /api/staff | staff.manage | `{ name, role, bookable, color, commission_pct, phone, bio, avatar_url, pin?, email?, password? }` | `Staff` |
| PATCH | /api/staff/:id | staff.manage (o uno mismo: name, phone, bio, avatar_url, pin, color) | igual + `active` | `Staff` |
| DELETE | /api/staff/:id | staff.manage | – | `Staff` (desactivado; no el último dueño ni uno mismo) |
| POST | /api/staff/:id/account | staff.manage | `{ email, password }` | `Staff` |
| GET | /api/services | services.read | `?all=1` incluye inactivos | `[Service]` |
| POST | /api/services | services.manage | `{ name, description, category, duration_min, price, active, popular, staff_ids }` | `Service` |
| PATCH | /api/services/:id | services.manage | igual | `Service` |
| DELETE | /api/services/:id | services.manage | – | `null` |
| POST | /api/services/reorder | services.manage | `{ ids:[...] }` | `null` |
| GET | /api/availability | availability.read | `?staff_id=` | `{ [staff_id]: { 0:[[s,e]], …, 6:[…] } }` (barbero: solo el suyo) |
| PUT | /api/availability/:staff_id | availability.manage.all \| .own | `{ week: { 0:[[s,e]], … } }` | `{ [staff_id]: week }` |
| GET | /api/time-off | availability.read | `from, to, staff_id` | `[TimeOff]` |
| POST | /api/time-off | timeoff.manage.all \| .own | `{ staff_id\|null, date_from, date_to, start_min?, end_min?, reason }` | `TimeOff` |
| DELETE | /api/time-off/:id | timeoff.manage.all \| .own | – | `null` |
| GET | /api/slots | appointments.write.all \| .own | `date, services=a,b, staff_id=any\|id, exclude=<appointment_id>` | como público (sin `lead_min` ni ventana) |
| GET | /api/appointments | appointments.read.all \| .own | `from, to, staff_id, status=a,b, client_id, q, limit(≤2000)` | `{ items:[Appointment], total }` |
| GET | /api/appointments/:id | appointments.read.all \| .own | – | `{ appointment, client, events, payments, messages }` |
| POST | /api/appointments | appointments.write.all \| .own | `{ client_id? \| client:{name,phone,email}, staff_id, date, start_min, services:[ids], internal_note?, client_note?, status?, source?, force? }` | `Appointment` |
| PATCH | /api/appointments/:id | appointments.write.all \| .own | `{ services?, staff_id?, date?, start_min?, client_id?, internal_note?, client_note?, force? }` | `Appointment` |
| POST | /api/appointments/:id/status | appointments.write.all \| .own | `{ status, reason? }` | `Appointment` |
| GET | /api/clients | clients.read.all \| .own | `q, tag, sort=recent\|name\|visits\|spent, limit, offset` | `{ items:[ClientWithStats], total, tags:[...] }` |
| GET | /api/clients/:id | clients.read.all \| .own | – | `{ client: ClientWithStats, appointments, payments, messages }` |
| POST | /api/clients | clients.write | `{ name, phone, email, birthday, notes, tags, marketing_ok }` | `ClientWithStats` (409 `duplicate` si el teléfono ya existe) |
| PATCH | /api/clients/:id | clients.write | igual | `ClientWithStats` |
| DELETE | /api/clients/:id | clients.delete | – | `null` (borrado lógico) |
| GET | /api/payments | payments.read.all \| .own | `from, to, staff_id, method` | `{ items, totals: { amount, tip, count, by_method } }` |
| POST | /api/payments | payments.write | `{ appointment_id?, client_id?, staff_id?, amount, tip?, method, concept?, complete? }` | `Payment` |
| POST | /api/payments/:id/refund | payments.refund | – | `Payment` |
| GET | /api/cash/current | cash.read | – | `{ session, summary, movements, payments }` |
| POST | /api/cash/open | cash.manage | `{ opening_float, notes? }` | `{ session, summary, … }` |
| POST | /api/cash/close | cash.manage | `{ counted_cash, notes? }` | `{ session }` |
| POST | /api/cash/movements | cash.manage | `{ type: income\|expense\|withdrawal, amount, concept }` | `Movement` |
| GET | /api/cash/sessions | cash.read | `from, to` | `[CashSession]` |
| GET | /api/commissions | commissions.read.all \| .own | `from, to, staff_id` | `{ items:[{ staff_id, staff_name, commission_pct, services_count, revenue, commission, tips, payouts, balance }], totals }` |
| GET | /api/commissions/payouts | commissions.read.all \| .own | `staff_id` | `[Payout]` |
| POST | /api/commissions/payouts | commissions.payout | `{ staff_id, period_from, period_to, amount, note }` | `Payout` |
| GET | /api/reports/dashboard | reports.read (barbero: versión propia con appointments.read.own) | `from, to, staff_id` | ver abajo |
| GET | /api/reports/export | reports.export | `type=appointments\|payments\|clients\|commissions, from, to` | CSV (descarga) |
| GET | /api/notifications | notifications.read | `limit, unread=1` | `{ items, unread }` |
| POST | /api/notifications/read | notifications.read | `{ ids?:[...], all?:true }` | `{ unread }` |
| GET | /api/messages | messages.send | `appointment_id, client_id, status, limit` | `[Message]` (barbero: de sus citas) |
| POST | /api/messages/prepare | messages.send | `{ appointment_id?, client_id?, kind, body? }` | `{ message, body, to_phone, wa_link }` |
| PATCH | /api/messages/:id | messages.send | `{ status: opened\|sent\|failed }` | `Message` |
| GET | /api/reminders | messages.send | `date` (por defecto mañana) | `{ date, items:[{ appointment, body, wa_link, reminded }] }` |
| POST | /api/import/legacy | import.legacy | `{ citas:[...], staff:[...] }` (formato localStorage anterior) | `{ imported, skipped }` |
| GET | /api/my/appointments | my.appointments | – | `{ upcoming:[PublicAppointment], past:[...] }` |
| POST | /api/my/appointments/:id/cancel | my.appointments | `{ reason? }` | `{ appointment }` |
| POST | /api/my/appointments/:id/reschedule | my.appointments | `{ date, start_min }` | `{ appointment }` |
| PATCH | /api/my/profile | my.appointments | `{ name?, phone?, marketing_ok? }` | `{ client }` |

### /api/reports/dashboard

```
{ range: { from, to, days },
  kpis: { revenue, revenue_prev, appointments, appointments_prev, completed, cancelled, no_show,
          avg_ticket, tips, new_clients, returning_clients, occupancy_pct, cancel_rate, no_show_rate },
  series: [{ date, revenue, appointments, completed }],             // un punto por día del rango
  by_staff: [{ staff_id, name, color, appointments, completed, revenue, occupancy_pct }],  // ordenado por citas
  top_staff: { staff_id, name, appointments, revenue } | null,       // "barbero más activo"
  by_service: [{ name, count, revenue }],
  by_status: { pending, confirmed, completed, cancelled, no_show },
  by_hour: [{ hour, count }], by_weekday: [{ weekday, count, revenue }],
  by_method: { cash, card, transfer, other },
  today: { date, appointments: [Appointment], expected_revenue, count } }
```
Ingreso = pagos `paid` (monto sin propina) del rango; si una cita `completed` no tiene pagos, cuenta su `total`.
`revenue_prev`/`appointments_prev` = mismo número de días inmediatamente anterior.

## Plataforma (superadmin)

| Método | Ruta | Cuerpo | Respuesta |
|---|---|---|---|
| GET | /api/admin/stats | – | `{ shops, active_shops, users, appointments_30d, revenue_30d, top_shops:[...] }` |
| GET | /api/admin/shops | `q` | `[{ ...shop, owner_email, staff_count, clients_count, appointments_30d, revenue_30d }]` |
| POST | /api/admin/shops | `{ name, slug?, owner_name, owner_email, owner_password, phone?, city?, plan? }` | `{ shop }` |
| PATCH | /api/admin/shops/:id | `{ status?, plan?, name?, domain? }` | `{ shop }` |
| GET | /api/admin/users | `q` | `[User]` |

## Automatización (Authorization: Bearer `env.AUTOMATION_KEY`)

| Método | Ruta | Cuerpo | Respuesta |
|---|---|---|---|
| GET | /api/automation/outbox | `limit` | `[{ id, shop_id, to_phone, body, kind, appointment_id }]` mensajes `queued` |
| POST | /api/automation/outbox/:id | `{ status: sent\|failed, provider_id?, error? }` | `Message` |
| POST | /api/automation/reminders/run | – | `{ queued }` encola recordatorios de barberías en modo `auto` |

## WhatsApp

Modo `manual` (por defecto): `prepare` arma el texto desde la plantilla, lo registra en `messages` como `prepared`
y devuelve `wa_link` (`https://wa.me/<52+tel>?text=…`). El frontend abre el link y marca `opened`/`sent`.
Modo `auto`: `prepare` encola (`queued`) y un proveedor externo (WhatsApp Cloud API, ver `whatsapp-assistant/`)
consume `/api/automation/outbox`. Variables de plantilla: `{cliente} {barberia} {fecha} {hora} {servicios}
{barbero} {total} {folio} {enlace} {direccion} {resena}`.
