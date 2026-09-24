# Arquitectura — TuBarbería (SaaS para barberías)

```
new-gomez/                  ← raíz del proyecto de Cloudflare Pages (salida = ".")
  index.html                ← página pública de reservas (barbería por dominio, predeterminada o ?b=<slug>)
  app/                      ← panel SaaS (PWA): dueño, barbero, cliente, superadmin
  core/                     ← lógica de negocio ISOMÓRFICA (servidor + demo en el navegador)
    schema.js               ← tablas/columnas (única fuente) → migración D1 y adaptadores
    db.js / db-d1.js        ← misma interfaz: memoria (demo/tests) y D1 (producción); scopedDb = aislamiento
    router.js               ← rutas /api/* (auth, permisos, barbería activa)
    session.js crypto.js permissions.js util.js
    api/*.js                ← handlers por dominio (exportan `routes`)
    domain/*.js             ← reglas puras (slots, estados, vistas, plantillas, notificaciones)
    seed-demo.js            ← datos ficticios de la demo
  functions/api/[[path]].js ← Pages Function: request → core/router con D1 (env.DB)
  migrations/*.sql          ← generadas con `npm run migration`
  tests/*.test.mjs          ← `npm test` (node:test, base en memoria)
```

## Principios

1. **Un solo motor.** El mismo `core/router.js` atiende al servidor (D1) y a la demo del navegador
   (memoria + localStorage). La demo no es una maqueta: ejecuta exactamente las mismas reglas y permisos.
2. **Aislamiento total entre barberías.** Toda tabla con `shop_id` se consulta solo vía `ctx.sdb`
   (`scopedDb(db, ctx.shop.id)`), que inyecta `shop_id` desde la sesión. Ningún handler filtra por un
   `shop_id` recibido del cliente. `ctx.db` (sin scope) solo para tablas globales (`shops`, `users`,
   `sessions`, `login_attempts`) y para el superadmin.
3. **Permisos centralizados** en `core/permissions.js`. Permisos `.own` → el handler filtra por
   `ctx.staff.id` cuando el rol no tiene el `.all`.
4. **Sin dependencias ni build** en el frontend: ES modules nativos (iOS Safari 14+, Chrome, Firefox).
5. **Errores con mensaje humano** en español (`HttpError` → `{ ok:false, error:{ code, message, fields } }`).

## Contexto de un handler (`ctx`)

| campo | qué es |
|---|---|
| `ctx.req` | `{ method, path, query, body, headers, ip }` |
| `ctx.params` | parámetros de la ruta (`/api/x/:id` → `ctx.params.id`) |
| `ctx.env` | variables (`MODE`='demo'\|'server', `DEFAULT_SHOP_SLUG`, `RESEND_API_KEY`, `AUTOMATION_KEY`, `ALLOW_SIGNUP`, `SETUP_KEY`…) |
| `ctx.db` | base sin scope (tablas globales) |
| `ctx.sdb` | base con scope de la barbería activa (rutas `auth:'shop'`) |
| `ctx.user` / `ctx.session` / `ctx.token` | sesión actual |
| `ctx.contexts` | barberías/roles del usuario |
| `ctx.shop` / `ctx.role` / `ctx.staff` / `ctx.client` | barbería activa y rol en ella |
| `ctx.can(p)` / `ctx.require(p)` | permisos |
| `ctx.actor` | `{ id, name, kind }` para auditoría |
| `ctx.now()` | `{ date, minutes, iso }` en la zona horaria de la barbería |
| `ctx.setCookie()` / `ctx.header()` | respuesta |

Helpers compartidos: `domain/views.js` (`apptView`, `publicApptView`, `staffView`, `publicShopView`),
`domain/events.js` (`logEvent`), `domain/notify.js` (`notify`), `domain/clients.js` (`findOrCreateClient`),
`domain/settings.js` (`shopSettings`, `DEFAULT_SETTINGS`), `util.js` (errores, fechas, validación).
