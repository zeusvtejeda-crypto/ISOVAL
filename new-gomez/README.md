# TuBarbería — NEW GOMEZ

SaaS de reservas y gestión para barberías (multibarbería) sobre Cloudflare Pages + D1.

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
