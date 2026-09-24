# Contrato de la API (v2)

Fuente de verdad para backend (`core/api/*.js`) y frontend (`app/`, `index.html`).
Todas las respuestas JSON: `{ ok: true, data }` o `{ ok: false, error: { code, message, fields? } }`.
`message` siempre en español, listo para mostrarse al usuario en un toast.

- Fechas: `date` = `'YYYY-MM-DD'` en hora local de la barbería. Horas: `start_min`/`end_min` = minutos desde medianoche.
- Dinero: números (MXN por defecto, `shop.currency`).
- Autenticación: cookie HttpOnly `tb_sid` (navegador) o `Authorization: Bearer <token>` (demo/apps).
  Escrituras con cookie requieren cabecera `x-requested-with: tb` (CSRF).
- Barbería activa: cabecera `x-shop-id: <shop.id>` en rutas `auth: shop`. Si esa barbería está suspendida
  (`shops.status = 'suspended'`), toda ruta `auth: shop` responde 403 `shop_suspended` ("Esta barbería está suspendida.
  Contacta a soporte.") a todos menos al superadmin; el panel usa el código (no el texto) para mostrar su pantalla de
  barbería suspendida en lugar de "Sin acceso". Sus contextos siguen en `/auth/me` con `shop_status: 'suspended'`.
- Errores comunes: 400 `bad_request` (con `fields`), 401 `unauthorized`, 403 `forbidden` / `shop_suspended`, 404 `not_found`,
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

¹ `completed`: solo si la cita ya empezó o empieza en ≤ 60 min (el cliente puede llegar antes; minutos hasta el inicio
≤ 60, contando a través de la medianoche: a las 23:30 una cita de las 00:15 del día siguiente ya cuenta). `no_show`:
solo cuando ya llegó la hora de inicio (minutos hasta el inicio ≤ 0; antes, el cliente todavía puede llegar y el 400
dice desde qué hora se puede marcar). No se marca "atendida"/"no asistió" una cita futura, tampoco al crearla
(`status:'completed'`) ni al moverla: `PATCH` que cambia fecha u hora de una cita `completed` o `no_show` exige que el
nuevo horario cumpla la regla de su estado (400; `force` no la salta).
² restaurar una cancelada / no asistida exige que el horario siga libre (409 `slot_taken` si no), también tras escribir
(ver "Concurrencia"): si otra cita tomó el horario al mismo tiempo, la restauración se revierte a su estado anterior.
Citas `cancelled` y `no_show` no ocupan agenda; `no_show` no cuenta como ingreso.

### Reglas de agenda

- **Rango del día**: una cita empieza entre 00:00 y 23:59 y termina a más tardar a las 24:00 (`end_min ≤ 1440`); si no,
  400 con `fields.start_min`. Aplica siempre (crear, editar, reagendar, con o sin `force`).
- **`force:true`** (panel: POST/PATCH `/api/appointments`, POST `/status`): salta solo el choque de agenda (otras citas,
  horario del barbero, descansos). Nunca salta el rango del día, la regla ¹ ni las validaciones de datos.
  Con `staff_id:'any'` + `force`, si nadie está libre se sobreagenda solo entre quienes trabajan ese día y no tienen
  descanso a esa hora: primero quien solo tiene choque de citas (el de menos minutos agendados), luego quien trabaja ese
  día fuera de su horario. Si nadie trabaja (vacaciones, descanso de toda la barbería) → 409 `slot_taken`.
- **Concurrencia** (verificación tras escribir): `checkFree` se valida antes de escribir; tras escribir (alta, reagenda,
  edición que mueve o alarga, restaurar) se buscan traslapes con otras citas que ocupan agenda del mismo barbero.
  Clave = marca de la escritura (`updated_at` o `created_at`, tomada justo antes de escribir) + `id`. Traslape con clave
  menor → esta escritura cede (se revierte y responde 409 `slot_taken`); con clave mayor → se espera (≈1.2 s máx.) a que
  la otra ceda; si sigue ahí es porque verificó antes y se quedó → esta cede. Resultado: nunca quedan dos citas
  traslapadas y, cuando ambas se ven, gana la que escribió primero. Con `force` no se verifica.
- **Mover** (PATCH con fecha/hora/barbero, o reagenda del cliente): `reschedule_count` suma 1 (cuenta todos los
  movimientos, del equipo y del cliente). Si cambia la fecha u hora, `reminder_sent_at` vuelve a `null` (el recordatorio
  enviado era del horario anterior).
- **Reasignar** (PATCH `staff_id` o `client_id`): los cobros `paid` de la cita pasan al nuevo barbero / cliente
  (`payments.staff_id` / `client_id`), así comisiones, tablero y fichas quedan con la persona correcta. Los cobros ya
  reembolsados no se tocan. Es una corrección: si el periodo del cobro ya se liquidó, su comisión cambia de barbero.

## Vistas (formas de datos)

**Appointment** (lista y detalle): columnas de `appointments` (schema.js) **sin** `manage_token_hash`, más:
`staff_name`, `staff_color`, `paid` (suma de pagos `paid`), `balance` (= total − paid, mínimo 0).

**PublicAppointment**: `{ id, folio, date, start_min, end_min, duration_min, services, total, status, staff_id, staff_name, client_name, client_note, shop: { name, slug, address, phone, whatsapp, timezone } }`

**MyAppointment** (portal del cliente, `/api/my/*`): PublicAppointment + `staff_color` (color del barbero en el panel,
`''` si no tiene; el avatar del barbero en «Mis citas» usa el mismo color que en la agenda).

**Staff** (vista): columnas de `staff` sin `pin_hash`, más `has_pin` (bool), `email` (del usuario vinculado o ''),
`has_account` (bool). Siempre las mismas claves. Para el rol **barbero** (`GET /api/staff` sin `staff.manage`), en
las filas de sus compañeros los datos privados vienen vacíos: `email: ''`, `phone: null`, `commission_pct: null`
(su propia fila viene completa). El frontend debe tolerar `commission_pct`/`phone` en `null`.

**ClientWithStats**: columnas de `clients` + `stats: { visits, completed, cancelled, no_shows, total_spent, last_visit, next_visit, first_visit, avg_ticket }`.

**Context**: `{ shop_id, shop_slug, shop_name, shop_logo, shop_status, role, staff_id, client_id, display_name }`

## Públicas (sin sesión)

| Método | Ruta | Cuerpo / query | Respuesta |
|---|---|---|---|
| GET | /api/health | – | `{ ok, version, backend, mode }` |
| GET | /api/public/home | `?host=` (opcional) | igual que `/shops/:slug` para la barbería del dominio, o la predeterminada (`env.DEFAULT_SHOP_SLUG`, 'new-gomez') |
| GET | /api/public/shops/:slug | – | `{ shop: PublicShop, services: [...activos], staff: [...reservables] }` |
| GET | /api/public/shops/:slug/days | `from, days(≤60), services=a,b, staff=any\|id, token?\|exclude?` | `{ days: [{ date, open, available, reason? }] }` |
| GET | /api/public/shops/:slug/slots | `date, services=a,b, staff=any\|id, token?\|exclude?` | `{ date, duration_min, closed, slots: [{ start_min, staff_ids }] }` |
| POST | /api/public/shops/:slug/appointments | `{ services:[ids], staff_id:'any'\|id, date, start_min, name, phone, email?, note?, first_visit? }` | `{ appointment: PublicAppointment, manage_token }` |
| GET | /api/public/appointments/:token | – | `{ appointment: PublicAppointment, can_cancel, can_reschedule, deadline_text }` |
| POST | /api/public/appointments/:token/cancel | `{ reason? }` | `{ appointment: PublicAppointment, can_cancel, can_reschedule, deadline_text }` |
| POST | /api/public/appointments/:token/reschedule | `{ date, start_min, staff_id? }` | `{ appointment: PublicAppointment, can_cancel, can_reschedule, deadline_text }` |

`PublicShop`: `{ id, slug, name, tagline, description, phone, whatsapp, email, address, city, maps_url, timezone, currency, logo_url, cover_url, brand_color, hours, booking: {step_min, lead_min, window_days, cancel_hours, auto_confirm, require_phone, allow_any_staff, online_enabled}, public: {...settings.public}, payment_methods }`.
Servicios públicos: `{ id, name, description, category, duration_min, price, popular, staff_ids }`. Staff público: `{ id, name, avatar_url, bio, color }`.

Reglas de reserva en línea: respeta `lead_min`, `window_days`, `online_enabled`, horario, descansos
(`time_off`), `buffer_min` y citas existentes. El horario en línea es la **intersección** del horario del barbero
(sus filas de `availability`, o `settings.hours` si no tiene ninguna) con el de la barbería (`settings.hours`): si la
barbería está cerrada ese día u hora, no se ofrece ni se acepta en línea aunque el barbero tenga su propio horario
(la rejilla de `step_min` arranca al inicio de cada bloque de la intersección). El panel (`/api/slots`, crear/mover
citas) usa solo el horario del barbero. `staff_id:'any'` asigna al barbero libre con menos citas ese día.
Límite: 15 reservas por IP por hora (429 `too_many_requests`); no aplica con `env.MODE === 'demo'` (en la demo todas
las peticiones comparten la IP `demo`).

`/days`: `open` = hay servicio ese día y se puede reservar; `available` = quedan horarios. Si `available` es false,
`reason` dice por qué: `closed` (sin servicio: barbería/barbero no trabaja o descanso de día completo; `open:false`),
`full` (abierto pero sin lugar; `open:true`), `out_of_window` (más allá de `window_days`; `open:false`), `past` u
`offline` (reservas en línea apagadas; `open:false`). `/slots` devuelve `reason`/`message` con los mismos valores.
Al **reagendar** (enlace de gestión o «Mis citas»), `/days` y `/slots` no cuentan la cita que se mueve, así se ofrecen
horarios que solo chocan con ella (p. ej. correrla 20 min). Solo con prueba de que es de quien pregunta: `token` = token
del enlace de gestión (el de la reserva o el de un mensaje), o `exclude` = id de una cita de SU ficha en esa barbería
(sesión de cliente). Sin prueba válida el parámetro se ignora (respuesta normal, sin error).

Enlace de gestión (`/api/public/appointments/:token`): ver, cancelar y reagendar responden lo mismo, `{ appointment,
can_cancel, can_reschedule, deadline_text }` (política ya actualizada tras el cambio). Política: cancelar/reagendar
hasta `cancel_hours` antes del inicio; reagendar además exige `online_enabled` y que el **cliente** lleve menos de 5
reagendas de esa cita (eventos `rescheduled` con `by:'client'`, por enlace o portal; los movimientos del equipo no
cuentan). Al pasar el límite: 409 "Esta cita ya se reagendó varias veces…".
Si el cliente tiene sesión (rol cliente o usuario), la cita se vincula a SU ficha (ver "Fichas de cliente"). Notifica a dueños + barbero
(`booking_new`) y envía correo si `RESEND_API_KEY` y `settings.notify_email` (o `env.DEST_EMAIL`) existen.

### Fichas de cliente (`domain/clients.js` → `findOrCreateClient`)

Qué ficha del CRM recibe una cita nueva (reserva en línea y `POST /api/appointments` con `client:{…}`):
- **Con sesión** (reserva en línea de un usuario que no es del equipo): solo la ficha de ESE usuario (`user_id`).
  Nunca se le asigna una ficha encontrada por el teléfono o el correo escritos en el formulario, ni por el correo de
  su cuenta (no está verificado): cualquiera que conozca esos datos se quedaría con el historial, las citas y el
  teléfono de otra persona. Si aún no tiene ficha se le crea una propia; el teléfono/correo escritos se guardan en ella
  solo si ninguna otra ficha los usa.
- **Sin sesión / panel**: se reutiliza la ficha por teléfono y, si no, por correo. Desde la reserva en línea (datos sin
  verificar) no se agregan teléfono ni correo a la ficha existente (un correo agregado así permitiría reclamarla
  después) y nunca se usa una ficha que ya tiene cuenta (su dueño vería en «Mis citas» las reservas de quien escriba
  su teléfono o su correo); desde el panel sí se completan y sí se usa.
- **Registro de cliente** (`POST /api/auth/register` con `shop_slug`, `auth.js` → `linkClientAccount`): el correo de la
  cuenta no se verifica, así que nunca basta para reclamar una ficha existente (tampoco el teléfono). Se vincula una
  ficha sin cuenta solo si `claim` trae los enlaces de gestión de TODAS sus citas (tokens de `/?cita=…`; la página
  pública los guarda en el dispositivo al reservar; `domain/clients.js` → `provenClient`, máx. 20); si no, ficha nueva,
  con teléfono/correo solo si ninguna otra ficha los usa.
- **Cliente sin registro** (panel, `client:{ name }` sin teléfono ni correo): todas esas citas usan UNA ficha genérica
  por barbería — `name:'Cliente de paso'`, `source:'walkin'`, `tags:['Sin registro']`, `marketing_ok:false` — y la
  cita guarda en `client_name` el nombre escrito. Esa ficha acumula a todos los clientes de paso (cuenta como un solo
  cliente en estadísticas). La reserva en línea sin teléfono ni correo sigue creando una ficha con su nombre.

## Autenticación

| Método | Ruta | auth | Cuerpo | Respuesta |
|---|---|---|---|---|
| POST | /api/auth/login | public | `{ email, password }` | `{ user, contexts, token? }` + cookie |
| POST | /api/auth/pin | public | `{ shop_slug, pin }` | `{ user:null, staff, contexts, token? }` + cookie |
| POST | /api/auth/register | public | `{ name, email, password, phone?, shop_slug?, claim?:[tokens] }` | `{ user, contexts, token? }` (cuenta de cliente; `claim`: ver "Fichas de cliente") |
| POST | /api/auth/signup | public | `{ shop_name, owner_name, email, password, phone?, city? }` | `{ user, contexts, shop, token? }` (nueva barbería + dueño) |
| POST | /api/auth/logout | public | – | `null` (borra cookie) |
| GET | /api/auth/me | user | – | `{ user, staff?, contexts, session_kind }` |
| GET | /api/auth/session | public | – | igual que `/auth/me`, pero sin sesión responde 200 con `{ user: null, staff: null, contexts: [] }` (el panel la usa al arrancar) |
| PATCH | /api/auth/profile | user | `{ name?, phone? }` | `{ user }` |
| POST | /api/auth/password | user | `{ current, next }` | `null` |

`token` solo se devuelve con `env.MODE === 'demo'` (la demo usa Bearer). Contraseña ≥ 8 caracteres.
`signup` se desactiva con `env.ALLOW_SIGNUP === '0'`.

Límites de intentos (429 `too_many_requests`, "Intenta de nuevo en N min"; ventana deslizante):
| clave | máximo | cuenta |
|---|---|---|
| `pw:<correo>` (login y `/password`) | 5 / 15 min | fallos (un acceso correcto la reinicia) |
| `ip:<ip>` (login y PIN) | 30 / 15 min | fallos (los correctos no cuentan) |
| `pin:<barbería>:<ip>` | 8 / 15 min | fallos (un PIN correcto la reinicia) |
| `reg:<ip>` / `signup:<ip>` | 10 / h · 5 / h | todos los intentos (también los 409 y los que crean cuenta) |

Cada intento se cuenta ANTES de verificar la contraseña/PIN (una fila por intento en `login_attempts`, sin
leer-sumar-escribir): con peticiones simultáneas nunca se verifican más intentos que el máximo, en memoria y en D1.
Una ráfaga por encima del límite se rechaza entera mientras está en vuelo (falla cerrado).

Registro/alta con un correo que ya tiene cuenta → 409 `duplicate` ("No se puede crear una cuenta nueva con ese
correo. Si ya tienes una, inicia sesión."). Decisión: se acepta que este 409 confirme que el correo existe (sin él un
cliente con cuenta no entendería por qué no puede registrarse); la enumeración queda acotada por `reg:`/`signup:`
(los sondeos cuentan) y el login no revela nada (mismo mensaje y tiempo exista o no el correo).

Sesiones PIN: dejan de servir en cuanto el miembro se desactiva, le quitan o cambian el PIN (se cierran sus otras
sesiones PIN; la actual se conserva si fue él quien cambió su propio PIN), o su cuenta vinculada se desactiva o
cambia de contraseña (`/api/auth/password` y `PATCH /api/admin/users/:id` cierran también las sesiones PIN de sus
fichas de staff). `GET /api/auth/me` con una sesión PIN inválida → 401.

## Contexto de barbería (auth: shop)

| Método | Ruta | Permiso | Cuerpo / query | Respuesta |
|---|---|---|---|---|
| GET | /api/context | – | – | `{ shop (completo, settings mezclados con defaults), role, permissions:[...], staff, client, unread }` |
| PATCH | /api/shop | shop.update | campos de shop + `settings` parcial (merge profundo) | `{ shop }` |
| GET | /api/staff | staff.read | `?all=1` incluye inactivos | `[Staff]` |
| POST | /api/staff | staff.manage | `{ name, role, bookable, color, commission_pct, phone, bio, avatar_url, pin?, email?, password? }` | `Staff` + `account`³ |
| PATCH | /api/staff/:id | staff.manage (o uno mismo: name, phone, bio, avatar_url, pin, color) | igual + `active` | `Staff` (+ `account`³ si se tocó el acceso) |
| DELETE | /api/staff/:id | staff.manage | – | `Staff` (desactivado; no el último dueño ni uno mismo) |
| POST | /api/staff/:id/account | staff.manage | `{ email, password }` \| `{ remove:true }` | `Staff` + `account`³ |
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
| GET | /api/cash/current | cash.read | – | `{ session, summary: CashSummary, movements, payments, last_session }` |
| POST | /api/cash/open | cash.manage | `{ opening_float, notes? }` | `{ session, summary, … }` |
| POST | /api/cash/close | cash.manage | `{ counted_cash, notes? }` | `{ session }` |
| POST | /api/cash/movements | cash.manage | `{ type: income\|expense\|withdrawal, amount, concept }` | `Movement` |
| GET | /api/cash/sessions | cash.read | `from, to` | `[CashSession]` |
| GET | /api/commissions | commissions.read.all \| .own | `from, to, staff_id` | `{ range, items:[{ staff_id, staff_name, color, role, active, commission_pct, services_count, revenue, commission, tips, refunds, payouts, balance }], totals }` (ver "Comisiones") |
| GET | /api/commissions/payouts | commissions.read.all \| .own | `staff_id, from?, to?` (por `period_to`) | `[Payout + staff_name]` |
| POST | /api/commissions/payouts | commissions.payout | `{ staff_id, period_from, period_to, amount, note, from_cash? }` | `Payout + staff_name, cash_movement_id` |
| GET | /api/reports/dashboard | reports.read (barbero: versión propia con appointments.read.own) | `from, to, staff_id` | ver abajo |
| GET | /api/reports/export | reports.export | `type=appointments\|payments\|clients\|commissions, from, to` (con `type=clients` el rango es opcional) | CSV (descarga) |
| GET | /api/notifications | notifications.read | `limit, unread=1` | `{ items, unread }` |
| POST | /api/notifications/read | notifications.read | `{ ids?:[...], all?:true }` | `{ unread }` |
| GET | /api/messages | messages.send | `appointment_id, client_id, status, limit` | `[Message]` (barbero: de sus citas) |
| POST | /api/messages/prepare | messages.send | `{ appointment_id?, client_id?, kind, body?, preview? }` | `{ message, body, to_phone, wa_link }` (`preview:true` → `message:null, preview:true`, no registra ni rota el token; ver "WhatsApp") |
| PATCH | /api/messages/:id | messages.send | `{ status: opened\|sent\|failed }` | `Message` |
| GET | /api/reminders | messages.send | `date` (por defecto mañana) | `{ date, items:[{ appointment, body, wa_link, reminded }] }` |
| POST | /api/import/legacy | import.legacy | `{ citas:[...], staff:[...] }` (formato localStorage anterior) | `{ imported, skipped, staff_created, clients_created, errors }`⁴ |
| GET | /api/my/appointments | my.appointments | – | `{ upcoming:[MyAppointment + can_cancel, can_reschedule, deadline_text], past:[MyAppointment], elsewhere:[{ shop_id, shop_slug, shop_name, shop_logo, count, next: MyAppointment }] }` (`elsewhere`: otras barberías activas donde la misma cuenta es cliente y tiene citas próximas; `next` es la más cercana) |
| POST | /api/my/appointments/:id/cancel | my.appointments | `{ reason? }` | `{ appointment: MyAppointment + can_cancel, can_reschedule, deadline_text }` |
| POST | /api/my/appointments/:id/reschedule | my.appointments | `{ date, start_min, staff_id? }` | `{ appointment: MyAppointment + can_cancel, can_reschedule, deadline_text }` |
| PATCH | /api/my/profile | my.appointments | `{ name?, phone?, marketing_ok? }` | `{ client }` |

³ **Acceso por correo del equipo**: `account` = `'created'` (cuenta nueva con la contraseña escrita), `'linked'`,
`'removed'` o `null`. `'linked'`: el correo ya tenía cuenta en TuBarbería y se vinculó ESA cuenta; su contraseña nunca
se cambia (entra con la suya). La respuesta trae además `password_ignored` (bool: se escribió una contraseña que no se
usó) y `notice` (texto listo para mostrar al dueño explicándolo); el miembro recibe una notificación
(`data.kind:'staff_linked'`). Sin verificación de correo, vincular una cuenta existente confía en que el correo es de
esa persona: si no la reconoce, quitar el acceso y usar otro correo.
**PIN**: 4–6 dígitos, único en la barbería (se guarda con `PIN_ITERATIONS`). Como "ese PIN ya existe" delata un PIN
ajeno, cada intento de fijar PIN cuenta: un barbero que cambia el suyo tiene 5 intentos al día (choque o no; el 409
dice solo "Ese PIN no se puede usar"); un dueño tiene 30 por hora y 5 choques cada 15 min (429 al pasarse).

⁴ **Importador**: barberos por nombre; los que vienen en `staff` respetan `activo`/`barbero`. Los que SOLO aparecen en
citas (no están en `staff`: típicamente exempleados) se crean como historial: `bookable:false` (nunca salen en la
reserva en línea) y `active:false`, salvo que tengan citas próximas (hoy o después, registradas/confirmadas):
entonces `active:true` para atenderlas en la agenda, pero siguen sin reserva en línea hasta activarla en Equipo.

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
- Ingreso (`revenue`, `series`, `by_staff`, `by_weekday`, `by_method`) = cobros (monto sin propina) con fecha en el
  rango, incluidos los que después se reembolsaron, − reembolsos hechos en el rango (ver "Cobros y reembolsos"), + `total` de las
  citas `completed` del rango que no tienen **ningún** cobro (ni reembolsado, de cualquier fecha: un anticipo pagado
  semanas antes o un cobro tardío cuentan como "ya tiene cobro"). Un día con solo reembolsos puede quedar negativo.
- `tips` = propinas de esos cobros − propinas reembolsadas en el rango.
- `avg_ticket` = `revenue` / ventas (citas cobradas + ventas sueltas + citas atendidas sin cobro; un cobro reembolsado
  dentro del mismo rango no cuenta como venta).
- `appointments` = citas no canceladas (pending, confirmed, completed, no_show). `cancel_rate` = canceladas / todas × 100;
  `no_show_rate` = no_show / (completed + no_show) × 100.
- `occupancy_pct` = minutos de citas que ocupan agenda (pending, confirmed, completed; **no** cuentan cancelled ni
  no_show) / minutos disponibles × 100 (tope 100). Disponibles = bloques de trabajo del barbero − descansos, de
  barberos activos y reservables (o el barbero filtrado).
- `new_clients` = clientes cuya primera cita no cancelada cae en el rango; `returning_clients` = ya tenían una antes.
- `revenue_prev`/`appointments_prev` = mismo número de días inmediatamente anterior.

### Cobros y reembolsos

- Cobro de una cita: `staff_id` y `client_id` salen de la cita (se ignora lo que mande el cliente); cita cancelada → 409.
  `complete:true` la marca atendida si la transición es válida y ya empezó (regla ¹). Efectivo con caja abierta → se
  liga a esa caja (`cash_session_id`). `date` = fecha local del cobro.
- `POST /api/payments/:id/refund` `{ reason? }`: marca el cobro `refunded` (`refunded_at`, `refunded_by`,
  `refund_reason`), una sola vez (409 si ya). **Regla de periodo**: el cobro sigue contando en su fecha (`date`) aunque
  se reembolse después, y el reembolso **resta monto y propina en la fecha local de `refunded_at`** (zona de la
  barbería; sin `refunded_at`, en la fecha del cobro). Así un periodo ya liquidado no cambia y lo pagado de más se
  descuenta en el periodo del reembolso (comisiones y tablero; el saldo puede quedar negativo). En caja: si el cobro en
  efectivo es de la caja abierta, el resumen ya no lo cuenta; si es de otra caja (o sin caja), se registra un gasto en la
  caja abierta (`cash_movement_id`).
- `GET /api/payments` lista por fecha del cobro; `totals` suma solo `paid` (`refunded`/`refunded_count` aparte).

### Caja

`CashSummary`: `{ opening_float, cash_sales, cash_tips, card_sales, card_tips, transfer_sales, transfer_tips,
other_sales, other_tips, tips, income, expense, withdrawal, expected_cash, payments_count }`. Solo cobros `paid`: el
efectivo ligado a la caja + las demás formas de pago registradas mientras estuvo abierta. `tips` = todas las propinas
(`cash_tips + card_tips + transfer_tips + other_tips`). `expected_cash = opening_float + cash_sales + cash_tips + income −
expense − withdrawal`.

### Comisiones

Por barbero y periodo `from..to` (fechas locales):
- `services_count` = citas `completed` del barbero con fecha en el periodo.
- `revenue` = cobros del barbero con fecha en el periodo (monto sin propina, incluidos los reembolsados después) −
  `refunds` (monto reembolsado en el periodo, ver "Cobros y reembolsos"). Puede ser negativo.
- `commission` = `revenue × commission_pct / 100` (centavos). `tips` = propinas de esos cobros − propinas
  reembolsadas en el periodo (100 % del barbero).
- `payouts` = pagos de comisión cuyo `period_to` cae en el periodo (el pago se asigna al periodo que liquida).
- `balance` = `commission + tips − payouts` (negativo = se pagó de más; se descuenta en el siguiente pago).
- Se listan los barberos activos y los inactivos con movimientos; los cobros sin barbero no se atribuyen. Barbero
  (`.own`): solo lo suyo. `from_cash:true` en un pago de comisión lo registra como retiro de la caja abierta (409 sin
  caja; 400 si excede el efectivo disponible).

### Exportación CSV

`type=appointments|payments|commissions`: `from` y `to` obligatorios (máx. 400 días). `type=clients`: sin `from` ni
`to` exporta todas las fichas activas con estadísticas de todo el historial (columnas `Citas`, `Atendidas`, `Pagado`,
`Última visita`); con ambas fechas, las columnas son "… en el periodo"; con una sola fecha → 400. Archivo
`<slug>-<type>-<from>_<to>.csv` (o `<slug>-clients-<hoy>.csv` sin rango), UTF-8 con BOM; las celdas que empiezan con
`= + - @` se anteponen con `'` (inyección CSV).

## Plataforma (superadmin)

| Método | Ruta | Cuerpo | Respuesta |
|---|---|---|---|
| GET | /api/admin/stats | – | `{ shops, active_shops, users, appointments_30d, revenue_30d, top_shops:[...] }` |
| GET | /api/admin/shops | `q` | `[{ ...shop, owner_email, staff_count, clients_count, appointments_30d, revenue_30d }]` |
| POST | /api/admin/shops | `{ name, slug?, owner_name, owner_email, owner_password, phone?, city?, plan? }` | `{ shop }` |
| PATCH | /api/admin/shops/:id | `{ status?, plan?, name?, domain? }` | `{ shop }` |
| GET | /api/admin/users | `q` | `[User]` |
| PATCH | /api/admin/users/:id | `{ status?: active\|disabled, password?, name? }` | `{ user }` — desactivar o cambiar la contraseña cierra sus sesiones (también las PIN de sus fichas de staff), salvo la del superadmin que hace el cambio |

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

`{enlace}`: en `confirmation`, `reminder`, `reschedule` y `no_show` de una cita es el enlace de gestión
(`/?cita=<token>`; en la demo `/?b=<slug>&cita=<token>`). Como el token de la reserva solo se guarda hasheado, los
mensajes usan un token **derivado** de ese hash (`<id de la cita sin ap_><firma>`, `linkToken` en
`core/domain/messages.js`): es el mismo en todos los mensajes de la cita y **no invalida** el que el cliente recibió al
reservar (ni el de Google Calendar/.ics); ambos sirven mientras la cita exista. `GET /api/public/appointments/:token`
acepta los dos. Si la cita no tenía hash (la agendó el equipo), se le asigna uno la primera vez. En los demás tipos (o
sin cita) es el link de reservas (`/?b=<slug>`).
Vista previa (`preview:true`): arma el texto sin registrar nada; el enlace de gestión queda como el marcador literal
`{enlace}`. Al enviar (sin `preview`) con `body`, cada `{enlace}` del texto se reemplaza por el enlace real (el de
gestión si el tipo lo lleva y hay cita; si no, el link de reservas). Así el panel puede mostrar la vista previa, dejar
editar el texto y enviarlo tal cual.
