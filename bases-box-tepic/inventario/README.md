# Inventario Bases Box Tepic

App web (se instala en el celular o la tableta) para que el **dueño del local** y el **dueño de la tienda** lleven el mismo inventario de bases box, cada uno desde su equipo y con su propio PIN.

```
Local (fábrica)  ──envío──▶  En camino  ──confirma recibo──▶  Tienda  ──venta──▶  Cliente
      ▲                                                          │
      └──────────────────────── pedido ◀─────────────────────────┘
```

## Qué hace cada dueño

| | Dueño del local | Dueño de la tienda |
|---|---|---|
| Catálogo (productos, medidas, tonos, precios, costos) | Crea y edita | Solo consulta (no ve costos) |
| Entradas y salidas del local | ✅ | — |
| Enviar a la tienda / cancelar un envío | ✅ | — |
| Recibir mercancía (con faltantes o daños) | — | ✅ |
| Ventas, devoluciones, mermas de la tienda | — | ✅ |
| Pedir al local / surtir pedidos | Surte | Pide |
| Conteo físico, anular movimientos | ✅ (todo) | ✅ (lo suyo) |
| Alertas de stock bajo, tablero, historial, exportar CSV | ✅ | ✅ |

Todo movimiento queda en el historial con fecha, lugar y responsable (Local o Tienda). Las piezas en camino no cuentan como existencias de ninguno de los dos hasta que la tienda confirma que llegaron.

## Probarla en 1 minuto (sin servidor)

Abre `public/index.html` en el navegador (doble clic) y elige **Ver una demostración**: carga un mes de datos de ejemplo. PIN del local `1111`, PIN de la tienda `2222`.
Así funciona también si la subes a un hosting estático: **los datos viven solo en ese equipo**, así que sirve para probar, no para que dos personas compartan el inventario.

## Publicarla para los clientes (una sola vez)

Usa **Cloudflare Pages + D1** (plan gratuito alcanza de sobra). Necesitas una cuenta de Cloudflare y Node 22 o más nuevo.

```bash
cd bases-box-tepic/inventario
npx wrangler@4 login
npx wrangler@4 d1 create bases-box-inventario
#   → copia el "database_id" que imprime y pégalo en wrangler.toml
npx wrangler@4 pages project create bases-box-inventario --production-branch main
npx wrangler@4 pages deploy
```

1. Abre la dirección que te da (`https://bases-box-inventario.pages.dev`; puedes ponerle un dominio propio desde el panel de Cloudflare, p. ej. `inventario.basesboxtepic.com`).
2. **Termina el asistente tú mismo antes de compartir el enlace**: pide nombre del negocio, un PIN para cada dueño y el catálogo inicial. Quien lo termine primero queda como administrador.
3. Guarda el **código de recuperación** que muestra al final (sirve si alguien olvida su PIN; en *Más → Código de recuperación* se genera uno nuevo).
4. Manda el enlace a los dos dueños. En el celular: *Compartir → Agregar a pantalla de inicio* (iPhone/iPad) o *Instalar app* (Android/Chrome).

Las tablas se crean solas la primera vez. Para actualizar la app después de cambiar el código, repite `npx wrangler@4 pages deploy`.

*Otra forma, desde el panel de Cloudflare (conectando el repositorio):* directorio raíz `bases-box-tepic/inventario`, directorio de salida `public`, sin comando de build, y en *Settings → Bindings* agrega una base **D1** con el nombre de variable `DB`.

### Primeros pasos para los dueños

- **Local:** *Más → Medidas y precios* (pon los precios) → *Mover → Conteo físico* (carga lo que ya tienes) → listo. Cada vez que fabriques: *Mover → Registrar entrada*; para surtir a la tienda: *Mover → Enviar a tienda*.
- **Tienda:** cuando el local envíe, aparece “envío por recibir” en *Inicio*; ahí se confirma lo que llegó. Las ventas se registran en *Mover → Registrar venta* (con *Deshacer* a la mano por si te equivocas).
- Si un número no cuadra, se corrige con un **conteo físico** (queda registrado quién y cuándo). Los errores de captura se corrigen con **Anular operación** en el historial.

## Cosas que conviene saber

- **PIN y sesiones.** Cada dueño tiene un PIN de 4 a 8 números (se rechazan los obvios como 1234 o 0000). Se valida en el servidor, no en el teléfono; después de 5 intentos fallidos se bloquea un rato (cada bloqueo dura más). La sesión dura 30 días en ese equipo y se cierra si el PIN cambia. No hay cuentas por persona: quien tenga el PIN de un dueño entra como ese dueño.
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
├── wrangler.toml             enlace a la base D1
└── package.json
```

- Pruebas: `npm test` (Node 22.13+). Desarrollo local con base D1 simulada: `npm run dev` y abre `http://localhost:8788`.
- Los movimientos son un libro contable: el stock de cada producto siempre es la suma de sus movimientos; las anulaciones agregan un movimiento contrario en lugar de borrar nada.
- `core.js` es el único lugar con reglas de negocio. El modo local (`crearRepoLocal`) y el servidor (`functions/_d1.js`) implementan el mismo contrato de almacenamiento.
