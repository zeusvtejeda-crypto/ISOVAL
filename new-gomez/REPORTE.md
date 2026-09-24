# Reporte de entrega — TuBarbería (NEW GOMEZ)

Rama: `claude/eloquent-edison-vg0gvz` · Proyecto: `new-gomez/`

## 1. Resumen

La app de NEW GOMEZ pasó de ser una página de reservas que guardaba las citas **en el celular del cliente**
(el dueño nunca las veía en otro dispositivo) y un panel con PIN en el navegador, a un **SaaS multibarbería**
con base de datos real (Cloudflare D1), cuentas y roles, agenda tipo Google Calendar, dashboard, CRM,
caja, comisiones, WhatsApp, notificaciones, PWA instalable y una demo completa para vender.

Se conservó lo que ya funcionaba bien: el diseño y SEO de la página pública de NEW GOMEZ, su flujo de
4 pasos, sus datos (servicios, horario, Angel y Alexis) y el despliegue en Cloudflare Pages.

## 2. Qué se corrigió del código anterior

| Problema encontrado | Solución |
|---|---|
| Las citas se guardaban en `localStorage` del cliente: el dueño no las veía | API + base D1; la cita llega al panel al instante con notificación |
| Horarios "ocupados" calculados solo con las citas de ese dispositivo | Motor de disponibilidad en el servidor (horario por barbero, descansos, citas reales) y verificación contra reservas simultáneas |
| PIN de 4 dígitos validado en el navegador (hashes descargables) | Sesiones en servidor con cookie HttpOnly, PBKDF2, límites de intentos atómicos y revocación de sesiones |
| Panel mezclado en la página pública | Panel separado en `/app/` (PWA); `/panel` y `#/panel` redirigen |
| Función de correo aislada (`/api/notificar-cita`) | Integrada al flujo de reserva (Resend), nunca rompe la reserva |
| Sin roles reales ni multibarbería | 4 roles con permisos centralizados y aislamiento total por barbería |

## 3. Lo completado (según lo pedido)

- [x] **SaaS profesional, moderno, minimalista, premium**: sistema de diseño propio (tinta + hueso + latón, claro/oscuro), tipografía Big Shoulders + IBM Plex.
- [x] **Móvil y escritorio** (iPhone, Android, tablet, computadora): barra inferior con botón central en celular, menú lateral en escritorio, hojas inferiores deslizables en móvil.
- [x] **Animaciones y microinteracciones**, **mensajes de éxito/error** (toasts), **loaders/skeletons**, **confirmación antes de borrar/cancelar**, **estados vacíos** con acción útil y errores con «Reintentar».
- [x] **Roles**: Superadmin, Dueño, Barbero, Cliente con permisos claros (tabla en `README.md`).
- [x] **Dashboard del dueño**: citas, ingresos, clientes nuevos/recurrentes, ticket promedio, ocupación, **barbero más activo**, **filtros por rango de fechas** y por barbero, **gráficas**.
- [x] **Sistema de citas sólido** tipo Calendly/Google Calendar: crear, editar, cancelar (con motivo), reagendar (incluso arrastrando), **no-shows**, **notas** (del cliente e internas), estados y su historial.
- [x] **Disponibilidad por barbero**: horario semanal con bloques, descansos y feriados.
- [x] **Gestión de barberos**, **servicios configurables**, **CRM de clientes**.
- [x] **WhatsApp manual preparado para automatizar**: plantillas editables, envío con un toque, registro de mensajes, cola `queued` + `/api/automation/*` para conectar la API oficial.
- [x] **Recordatorios**: lista de mañana/hoy con envío uno por uno y endpoint para cron automático.
- [x] **Link de reserva por barbería y QR descargable** (PNG, SVG y cartel para imprimir).
- [x] **Pagos, caja, comisiones y reportes** (con exportación CSV).
- [x] **Multibarbería real con aislamiento total de datos** (verificado con pruebas y desde la interfaz).
- [x] **Centro de notificaciones**.
- [x] **Cuenta demo completamente cargada** con datos ficticios.
- [x] **PWA instalable** con ícono y nombre, funciona sin conexión, e **instrucciones dentro de la app** (`Instalar app`).

## 4. Verificación

| Prueba | Resultado |
|---|---|
| Pruebas automáticas del backend (`npm test`) | **280/280** en verde (permisos por rol, aislamiento entre barberías, agenda, dinero, seguridad) |
| Prueba real con Wrangler + D1 local (`npm run test:d1`) | **30/30** pasos: setup, cookies HttpOnly, PIN, reserva pública, choque de horario → 409, aislamiento, CSRF, logout |
| Revisión adversarial del backend | 25 hallazgos verificados con prueba reproducible → 28 correcciones con prueba de regresión (1 crítico: suplantación de ficha de cliente; carreras de doble reserva; fuerza bruta de PIN; limitadores no atómicos) |
| QA final (4 revisores: visual del dueño, visual de otros roles, flujo de negocio en demo, flujo en servidor D1 real) | 64 hallazgos (9 altos, 29 medios, 26 bajos) → corregidos por área y re-verificados en navegador |
| Recorrido E2E en navegador (`scripts/e2e-smoke.mjs`) | **256 capturas** en iPhone, Android, iPad y escritorio, claro y oscuro, 5 roles: **0 errores de consola, 0 pantallas vacías, 0 scroll horizontal** |
| QR | Decodificado con 2 lectores (jsQR y zxing-cpp) en 16 variantes, con y sin logo |
| PWA | Manifest válido e instalable según Chrome (sin errores de instalabilidad), service worker activo, el panel abre sin conexión |

## 5. Cómo usar la demo para enseñar en una barbería (paso a paso)

**Demo en línea: https://demo.tubarberia.mx** (abre directo en la guía, datos ficticios en el propio celular).
La misma guía está dentro de la app en **`/app/#/guia`**: **5 pasos, uno a la vez (≈5 minutos)**. Cada paso trae
una frase para decir y un solo botón que te lleva a la pantalla (cambia de rol solo). Un apuntador abajo te deja
pasar al **Siguiente** desde cualquier pantalla.

**Antes de llegar**: abre `https://demo.tubarberia.mx` en tu celular y toca **Empezar**. (Opcional: **Más → Instalar app**.)

| # | Paso | Qué dices |
|---|---|---|
| 1 | **Tu cliente reserva** → «Abrir página de reservas»: reserva con datos inventados | «Reservan desde tu enlace, sin descargar nada y a cualquier hora.» |
| 2 | **Te llega y la confirmas** → «Ver la cita»: Confirmar → Enviar confirmación | «Llega sola a tu agenda y la confirmas por tu WhatsApp con un toque.» |
| 3 | **Cobras al terminar** → «Cobrar una cita» | «Efectivo, tarjeta o transferencia, con propina; se suma solo a tu caja.» |
| 4 | **Ves cómo va tu negocio** → cambia Hoy / 7 días / 30 días | «Cuánto vendiste y tu barbero más activo, sin libreta.» |
| 5 | **¿Te la dejo lista hoy?** → «Crear su barbería» | «La dejamos lista hoy; mañana ya compartes tu enlace.» |

**Si te pide ver más** (botones debajo del paso): vista del barbero, ficha de cliente, recordatorios, caja,
comisiones, enlace y QR, varias sucursales.

**Respuestas a objeciones comunes** (también en la guía): «mis clientes no usan apps» → no descargan nada,
es un enlace; «no tengo tiempo» → se llena sola y te ahorra contestar mensajes; «¿y si no hay internet?» →
los clientes reservan desde su propio celular, así que la agenda se sigue llenando aunque falle el internet del
local; el panel abre sin conexión y avisa, y con los datos del celular gasta muy poco. WhatsApp sigue siendo el suyo.

**Accesos de la demo**: dueño `dueno@demo.mx`, barbero `barbero@demo.mx`, cliente `cliente@demo.mx`,
superadmin `admin@demo.mx` (contraseña `demo1234`); PIN con código `demo`: 1111 (Mauricio), 2222 (Luis),
3333 (Andrea), 4444 (Diego).

## 6. Para publicarlo (Cloudflare Pages)

Pasos detallados en `README.md` → «Despliegue». En corto:
1. Crear la base D1 `tubarberia` y enlazarla al proyecto de Pages como **`DB`** (Production y Preview).
2. Variable `SETUP_KEY` (y opcionales: `RESEND_API_KEY`, `DEST_EMAIL`, `AUTOMATION_KEY`).
3. Publicar la rama; las tablas se crean solas.
4. `POST /api/setup` una vez: crea tu superadmin, NEW GOMEZ (10 servicios, horario, Angel dueño, Alexis barbero con sus PIN) y opcionalmente la demo.
5. Entrar en `/app/`. Los clientes siguen reservando en `gomez.tubarberia.mx`.
6. Opcional: en **Ajustes → Importar datos anteriores**, desde el navegador donde se usaba el panel viejo, importar las citas guardadas.

## 7. Pendientes y límites conocidos (honestos)

- **Recuperar contraseña por correo** y **verificación de correo** no existen aún: el superadmin restablece contraseñas desde **Plataforma → Usuarios**, y el equipo puede entrar con PIN. Sin verificación de correo, alguien podría registrar primero el correo de otra persona (no obtiene sus datos: las citas solo se reclaman con su enlace de gestión).
- **WhatsApp automático** queda preparado (cola + endpoints + plantillas), pero enviar sin tocar requiere conectar un proveedor (API oficial de WhatsApp Business; ver `whatsapp-assistant/`) y un cron externo que llame `/api/automation/reminders/run`.
- **Plan gratuito de Cloudflare**: PBKDF2 con 10,000 iteraciones para caber en el límite de CPU (se puede subir en plan de pago sin invalidar contraseñas). Cargar la demo **en el servidor** hace miles de escrituras: en plan gratuito puede exceder el límite por petición; la demo del navegador no tiene ese límite.
- El enlace «gestionar mi cita» se renueva cada vez que se envía un mensaje con enlace: el último mensaje siempre trae un enlace válido y los anteriores dejan de servir.
- Pagos en línea (tarjeta desde la reserva) no están incluidos: la estructura de cobros ya existe para integrarlos.
