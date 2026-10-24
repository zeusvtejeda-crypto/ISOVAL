# Inventario Bases Box Tepic

App web (se instala en el celular o la tableta) para que el **almacén** y el **vendedor de la tienda** lleven el mismo inventario de bases box, cada uno desde su equipo y con su propio PIN.

```
Almacén (fábrica)  ──envío──▶  En camino  ──confirma recibo──▶  Tienda  ──venta──▶  Cliente
      ▲                                                          │
      └──────────────────────── pedido ◀─────────────────────────┘
```

## Qué hace cada usuario

| | Almacén | Vendedor tienda |
|---|---|---|
| Catálogo (productos, medidas, tonos, precios, costos) | Crea y edita | Solo consulta (no ve costos) |
| Entradas y salidas del almacén | ✅ | — |
| Enviar a la tienda / cancelar un envío | ✅ | — |
| Recibir mercancía (con faltantes o daños) | — | ✅ |
| Ventas, devoluciones, mermas de la tienda | — | ✅ |
| Pedir al almacén / surtir pedidos | Surte | Pide |
| Conteo físico, anular movimientos | ✅ (todo) | ✅ (lo suyo) |
| Alertas de stock bajo, tablero, historial, exportar CSV | ✅ | ✅ |

Todo movimiento queda en el historial con fecha, lugar y responsable (Almacén o Tienda). Las piezas en camino no cuentan como existencias de ninguno de los dos hasta que la tienda confirma que llegaron.

## Probarla en 1 minuto (sin servidor)

Abre `public/index.html` en el navegador (doble clic) y elige **Ver una demostración**: carga un mes de datos de ejemplo. PIN del almacén `1111`, PIN del vendedor `2222`.
Así funciona también si la subes a un hosting estático: **los datos viven solo en ese equipo**, así que sirve para probar, no para que dos personas compartan el inventario.

## Publicarla para los clientes (una sola vez)

Usa **Cloudflare Pages + D1** (el plan gratuito alcanza de sobra). Necesitas una computadora con Node 20 o más nuevo y una cuenta de Cloudflare (gratis).

```bash
cd bases-box-tepic/inventario
npm run publicar
```

Un solo comando: abre el navegador para que entres a Cloudflare, crea la base de datos y el sitio, genera una **clave de instalación**, sube la app y comprueba que responda. Al final imprime la dirección (`https://bases-box-inventario.pages.dev`; si ese nombre ya lo usa alguien más, Cloudflare le agrega unas letras) y la clave.

1. Abre la dirección (puedes ponerle un dominio propio desde el panel de Cloudflare, p. ej. `inventario.basesboxtepic.com`).
2. **Termina el asistente tú mismo antes de compartir el enlace**: pide la clave de instalación, el nombre del negocio, un PIN para cada usuario y el catálogo inicial. La clave evita que un extraño que adivine la dirección configure la app antes que tú; ya configurada, no se vuelve a usar. Si la pierdes, escribe una nueva con `npx wrangler@4 pages secret put SETUP_KEY --project-name bases-box-inventario`.
3. Guarda el **código de recuperación** que muestra al final (sirve si alguien olvida su PIN; en *Más → Código de recuperación* se genera uno nuevo).
4. Manda el enlace a los dos usuarios. En el celular: *Compartir → Agregar a pantalla de inicio* (iPhone/iPad) o *Instalar app* (Android/Chrome).

El comando se puede repetir: para actualizar la app después de cambiar el código, vuelve a correr `npm run publicar` (no toca los datos ni la clave). Las tablas se crean solas la primera vez. La primera vez guarda el id de la base en `wrangler.toml`; sube ese cambio al repositorio.

*Otra forma, sin terminal (conectando el repositorio desde el panel de Cloudflare):* crea una base D1 llamada `bases-box-inventario`, pega su id en `database_id` de `wrangler.toml` y sube el cambio; en *Workers y Pages* crea un proyecto Pages desde el repositorio con directorio raíz `bases-box-tepic/inventario` y sin comando de build; en *Settings → Variables and Secrets* agrega el secreto `SETUP_KEY` (la clave de instalación que quieras) y vuelve a desplegar. El enlace a la base sale de `wrangler.toml`: en el panel los *Bindings* solo se ven, no se editan.

*Como Worker en vez de Pages (probado en producción):* `dist/_worker.js` también corre como Worker. Crea la base D1 `bases-box-inventario` (panel de Cloudflare → *Storage & databases → D1*), pon su id en `database_id` de `wrangler.worker.toml` y publica con `npx wrangler@4 deploy -c wrangler.worker.toml --var SETUP_KEY:XXXX-XXXX-XXXX`. Sin clonar el repositorio: descomprime el zip de `dist/`, crea ahí un `wrangler.toml` con `name`, `main = "_worker.js"`, `compatibility_date` y el bloque `[[d1_databases]]` (`binding = "DB"`) y corre el mismo `npx wrangler@4 deploy --var SETUP_KEY:…` en esa carpeta. Ojo: la opción “Upload your static files” del panel crea un Worker de solo archivos y **no** sirve para este paquete.

### Primeros pasos

- **Almacén:** *Más → Medidas y precios* (pon los precios) → *Mover → Conteo físico* (carga lo que ya tienes) → listo. Cada vez que fabriques: *Mover → Registrar entrada*; para surtir a la tienda: *Mover → Enviar a tienda*.
- **Vendedor tienda:** cuando el almacén envíe, aparece “envío por recibir” en *Inicio*; ahí se confirma lo que llegó. Las ventas se registran en *Mover → Registrar venta* (con *Deshacer* a la mano por si te equivocas).
- Si un número no cuadra, se corrige con un **conteo físico** (queda registrado quién y cuándo). Los errores de captura se corrigen con **Anular operación** en el historial.

## Cosas que conviene saber

- **PIN y sesiones.** Cada usuario tiene un PIN de 4 a 8 números (se rechazan los obvios como 1234 o 0000). Se valida en el servidor, no en el teléfono; después de 5 intentos fallidos se bloquea un rato (cada bloqueo dura más). La sesión dura 30 días en ese equipo y se cierra si el PIN cambia. No hay cuentas por persona: quien tenga el PIN de un usuario entra como ese usuario.
- **Sin internet** la app abre con la última copia y se puede consultar, pero no registrar movimientos (así los dos inventarios nunca se desajustan). En cuanto vuelve la conexión se actualiza sola.
- **Dos personas a la vez.** Las existencias nunca bajan de cero y una operación se guarda completa o no se guarda. Si dos personas gastan la última pieza al mismo tiempo, solo una se registra y a la otra se le avisa.
- **Cantidades enteras.** Para materiales que se miden en metros u hojas, cuenta la unidad que uses (rollo, hoja, caja…).
- **Respaldo.** *Más → Respaldo completo* descarga todo en un archivo; vale la pena hacerlo cada mes. Los datos viven en la base D1 de tu cuenta de Cloudflare.
- **Límites del plan gratuito.** Cada app abierta consulta cambios cada ~9 segundos; para dos negocios con pocos equipos queda muy por debajo del límite de peticiones diarias.

## Para quien mantenga el código

```
inventario/
├── public/                   ← lo que se publica
│   ├── index.html            interfaz (HTML + CSS + JS, sin dependencias)
│   ├── core.js               reglas del negocio: permisos, stock, traspasos, PIN… (lo usan el servidor y el modo local)
│   ├── sw.js, manifest…, iconos   instalable y abre sin internet
│   └── _headers              cabeceras de seguridad
├── functions/
│   ├── api/[[path]].js       API (Cloudflare Pages Function)
│   └── _d1.js                guarda en D1; cada operación es una transacción
├── tests/                    pruebas (node:test): la misma batería corre contra el modo local y contra D1 simulado
├── scripts/publicar.mjs      npm run publicar: crea todo en Cloudflare y sube la app
├── scripts/empaquetar.mjs    npm run empaquetar: arma dist/_worker.js (la app completa en un solo archivo)
├── dist/_worker.js           paquete generado para publicar por API sin wrangler (no se edita a mano)
├── wrangler.toml             enlace a la base D1 (Pages)
├── wrangler.worker.toml      lo mismo para publicar como Worker
└── package.json
```

- Pruebas: `npm test` (Node 22.13+). Desarrollo local con base D1 simulada: `npm run dev` y abre `http://localhost:8788` (para probar la clave de instalación, crea un archivo `.dev.vars` con `SETUP_KEY=ABCD-EFGH-JKLM`).
- Si cambias algo en `public/`, `functions/` o `scripts/`, corre `npm run empaquetar` y sube también `dist/`; `npm test` avisa si el paquete quedó viejo.
- Los movimientos son un libro contable: el stock de cada producto siempre es la suma de sus movimientos; las anulaciones agregan un movimiento contrario en lugar de borrar nada.
- `core.js` es el único lugar con reglas de negocio. El modo local (`crearRepoLocal`) y el servidor (`functions/_d1.js`) implementan el mismo contrato de almacenamiento.
