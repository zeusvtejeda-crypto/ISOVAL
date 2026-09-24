# TuBarbería — NEW GOMEZ

SaaS de reservas y gestión para barberías (multibarbería) sobre Cloudflare Pages + D1.
Una sola base de código sirve la página pública de reservas de cada barbería, el panel (PWA instalable)
y la API. NEW GOMEZ Barbershop es la barbería principal del dominio `gomez.tubarberia.mx`.

## Qué incluye

| Área | Funciones |
|---|---|
| Reserva en línea | Enlace por barbería (`/?b=<slug>` o `/b/<slug>`), QR descargable e imprimible, 4 pasos (servicio → barbero → fecha/hora → datos), horarios reales sin encimarse, enlace para que el cliente cancele o reagende, fallback por WhatsApp si no hay servidor |
| Agenda | Vistas Día (columna por barbero), Semana, Mes y Lista; arrastrar para reagendar; estados pendiente/confirmada/atendida/cancelada/no asistió; notas internas; historial de cada cita |
| Disponibilidad | Horario semanal por barbero con bloques (comida), descansos/vacaciones y feriados de toda la barbería |
| Dashboard | Ingresos, citas, ticket promedio, clientes nuevos, ocupación, barbero más activo, filtros por rango y barbero, gráficas |
| CRM | Fichas con historial, gasto, visitas, etiquetas, notas y cumpleaños |
| Equipo y servicios | Barberos con color, comisión, PIN y acceso; servicios con precio, duración, categoría y quién los ofrece |
| Dinero | Cobros (efectivo, tarjeta, transferencia, propina), reembolsos, caja con apertura/movimientos/corte, comisiones y pagos a barberos, reportes y exportación CSV |
| WhatsApp | Confirmación, recordatorio, reagenda, cancelación, agradecimiento y no-show con plantillas editables; envío manual (wa.me) y cola lista para automatizar (`/api/automation/*`) |
| Notificaciones | Centro de notificaciones por persona (nueva reserva, cancelación, reagenda, corte de caja…) con insignia en el ícono |
| Plataforma | Superadmin: todas las barberías, alta, suspensión, planes, dominios, usuarios; aislamiento total de datos por barbería |
| PWA | Instalable en iPhone/Android/escritorio con ícono y nombre, funciona sin conexión (shell), pantalla «Instalar app» con instrucciones por sistema |
| Demo | Barbería ficticia completa (4 barberos, ~140 clientes, ~1,200 citas, caja, comisiones) que corre dentro del navegador, con cambio de rol y guía para presentarla |

## Roles y permisos

| Rol | Puede |
|---|---|
| Superadmin | Todo, en todas las barberías; gestiona la plataforma |
| Dueño | Todo en su barbería: agenda completa, clientes, equipo, servicios, horarios, caja, comisiones, reportes, ajustes, enlace/QR |
| Barbero | Su agenda, sus clientes, su horario y descansos, cobrar sus citas, enviar WhatsApp de sus citas, ver sus ganancias |
| Cliente | Reservar, ver sus citas, reagendar o cancelar dentro de la política, su perfil |

La matriz exacta está en `core/permissions.js` y el servidor la valida en cada petición.

## Probar la demo

Abre `/app/#/demo` (o «Entrar a la demo» en el acceso) y elige un rol. Todo corre en tu navegador con datos
ficticios. Credenciales: `dueno@demo.mx`, `barbero@demo.mx`, `cliente@demo.mx`, `admin@demo.mx` — contraseña
`demo1234`; PIN del equipo con código de barbería `demo`: 1111–4444. Página pública de la demo: `/?b=demo`.
Demo guiada de 5 pasos para presentarla en una barbería: `/app/#/guia` (en línea: https://demo.tubarberia.mx; ver `REPORTE.md`).

## Documentación técnica

- `docs/ARCHITECTURE.md` — estructura, aislamiento multibarbería, contexto de la API.
- `docs/API.md` — contrato de todos los endpoints, estados de cita y reglas de negocio.
- `docs/FRONTEND.md` — cómo se construyen las vistas del panel y el sistema de diseño.

## Despliegue en Cloudflare Pages

Todo corre en Cloudflare: los archivos estáticos (página pública `index.html` y panel `app/`) y la API
(`functions/api/[[path]].js` → `core/router.js`) sobre una base de datos D1. **No hay migraciones manuales**:
en la primera petición la API crea las tablas que falten y, en versiones futuras, agrega columnas e índices
nuevos sin borrar nada (`core/d1-migrate.js`).

### 1. Crear la base de datos D1

- **Desde el dashboard:** Workers & Pages → D1 SQL Database → *Create* → nombre `tubarberia`.
- **O desde la terminal:**

  ```bash
  npx wrangler login
  npx wrangler d1 create tubarberia
  ```

(Opcional) `migrations/0001_init.sql` tiene el esquema completo para revisarlo o aplicarlo a mano con
`npx wrangler d1 execute tubarberia --remote --file migrations/0001_init.sql`. Se regenera con `npm run migration`.

### 2. Crear el proyecto de Pages

Workers & Pages → *Create* → *Pages* → *Connect to Git* → elige el repositorio y configura:

| Campo | Valor |
|---|---|
| Framework preset | None |
| Build command | *(vacío)* |
| Build output directory | *(vacío)* o `/` |
| Root directory (avanzado) | `new-gomez` |

No hay paso de compilación: se publica la carpeta tal cual y Pages detecta la carpeta `functions/`.
Publica siempre desde Git: **no uses `wrangler pages deploy .`** desde tu computadora si tienes un
`.dev.vars` o una carpeta `.wrangler/` (se subirían como archivos públicos).

### 3. Enlazar la base (binding `DB`)

Proyecto de Pages → **Settings → Bindings** (en algunas cuentas: *Settings → Functions → D1 database bindings*)
→ *Add* → **D1 database**:

- Variable name: **`DB`** (exactamente así)
- D1 database: `tubarberia`

Hazlo en **Production** y también en **Preview**. Sin este enlace la API responde
`503 backend_not_configured` ("El servidor aún no tiene base de datos configurada.").

### 4. Variables de entorno

Proyecto → **Settings → Variables and Secrets** (Production y Preview). Usa *Encrypt/Secret* para las llaves.
Plantilla con explicación de cada una: `.dev.vars.example`.

| Variable | Para qué | ¿Obligatoria? |
|---|---|---|
| `SETUP_KEY` | Llave del primer arranque (`POST /api/setup`). Cadena larga y aleatoria. | Sí, para configurar |
| `RESEND_API_KEY` | Correo de aviso de nuevas reservas ([Resend](https://resend.com)). | No |
| `DEST_EMAIL` | Correo que recibe los avisos si la barbería no tiene uno en Ajustes. | No |
| `FROM_EMAIL` | Remitente, p. ej. `NEW GOMEZ <reservas@tubarberia.mx>` (dominio verificado en Resend). | No |
| `AUTOMATION_KEY` | Llave para integraciones (proveedor de WhatsApp, cron): `Authorization: Bearer …`. | No |
| `ALLOW_SIGNUP` | `0` desactiva el alta de barberías nuevas desde la app. | No |
| `PUBLIC_URL` | URL pública para enlaces de WhatsApp/correo (por defecto, el dominio de cada petición). | No |
| `DEFAULT_SHOP_SLUG` | Barbería que muestra la página pública si el dominio no es de ninguna (por defecto `new-gomez`). | No |

Después de cambiar variables o bindings, vuelve a desplegar (Deployments → *Retry deployment*) para que apliquen.

### 5. Primer arranque

Con el sitio publicado, crea tu cuenta de **superadmin** y la barbería real **NEW GOMEZ** (datos, 10 servicios,
horario, Angel como dueño y Alexis como barbero). `pins` (4 a 6 dígitos, distintos) es el PIN con el que cada
uno entra al panel; `demo: true` además carga la barbería demo con datos ficticios para enseñar la app.

```bash
curl -X POST https://gomez.tubarberia.mx/api/setup \
  -H 'content-type: application/json' \
  -d '{
    "key": "TU_SETUP_KEY",
    "email": "tu-correo@ejemplo.com",
    "password": "una-contraseña-larga",
    "name": "Tu nombre",
    "pins": { "angel": "1234", "alexis": "5678" },
    "demo": true
  }'
```

- Solo funciona una vez (con la base sin usuarios); después responde `409 already_setup`.
- Si más adelante quieres la demo: el mismo `curl` con solo `{ "key": "TU_SETUP_KEY", "demo": true }`.
- Estado: `curl https://gomez.tubarberia.mx/api/setup/status` → `{ needs_setup, has_setup_key, has_demo }`.
- Entra al panel en `/app/` con tu correo (superadmin: ves todas las barberías). Angel y Alexis entran con su PIN.
- Demo: dueño `dueno@demo.mx`, barbero `barbero@demo.mx`, cliente `cliente@demo.mx` (contraseña `demo1234`).
  En el servidor la demo **no** incluye superadmin (sus credenciales son públicas).
- Por seguridad puedes borrar `SETUP_KEY` cuando termines (sin ella, `/api/setup` responde 403).

### 6. Dominio

Proyecto → **Custom domains** → *Set up a custom domain* → `gomez.tubarberia.mx` (si el dominio está en
Cloudflare, el DNS se crea solo; si no, agrega el `CNAME` que te indica). La barbería NEW GOMEZ ya trae ese
dominio asignado, así que la página pública la muestra directamente. Para otras barberías: enlace
`/b/<slug>` (o `/?b=<slug>`), o asígnales su dominio desde el panel de superadmin.

`_headers` define cabeceras de seguridad y caché de los archivos estáticos, y `_redirects` los atajos
(`/b/:slug`, `/demo`, `/panel`). La API pone sus propias cabeceras (Pages no aplica `_headers` a Functions).

### Desarrollo local

Requiere Node 22 o superior.

```bash
cd new-gomez
npm install                 # instala wrangler (solo desarrollo)
cp .dev.vars.example .dev.vars   # y descomenta SETUP_KEY, etc.
npm run dev                 # http://localhost:8788 con D1 local (se crea sola)
npm test                    # pruebas del core (base en memoria + D1 simulada con node:sqlite)
npm run test:d1             # prueba de humo real: wrangler + D1 local + recorrido HTTP con cookies
```

- `npm run dev` guarda la base local en `.wrangler/` (ignorada por git). Para empezar de cero, bórrala.
- Primer arranque en local: el mismo `curl` de arriba contra `http://localhost:8788/api/setup`.
- Para probar desde tu celular en la misma red (`http://<IP-de-tu-compu>:8788`) agrega `INSECURE_COOKIES=1`
  a `.dev.vars` (sin HTTPS el navegador no guarda cookies `Secure`).
- `npm run test:d1` levanta su propio servidor en el puerto 8790 con una base temporal y muestra PASS/FAIL por paso.
