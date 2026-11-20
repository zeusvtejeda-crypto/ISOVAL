# Taquería · pedidos por WhatsApp + caja

Sitio estático (`index.html` + `config.js`). Sin servidor ni dependencias.

## Cliente (`/`)
- Menú por categorías y "Lo más pedido".
- Opciones por producto: tortilla, sin cebolla/cilantro, salsa, extras con precio, nota y cantidad.
- Carrito editable que se guarda en el teléfono del cliente.
- A domicilio o para recoger, con envío, envío gratis desde cierto monto y pedido mínimo.
- Pago en efectivo (calcula el cambio) o por transferencia (muestra la cuenta).
- Abierto/cerrado según el horario (soporta horarios que cruzan la medianoche).
- El pedido se manda por WhatsApp con folio, desglose y total. Se puede repetir el último pedido.

## Caja (`/#/caja`, PIN en `config.js`)
- **Capturar:** un toque agrega 1 pieza; mantener presionado (o clic derecho) abre las opciones. Tipo de pedido (aquí, llevar, domicilio, WhatsApp) y forma de pago.
- **Cocina:** pedidos pendientes con minutos de espera (en rojo a partir de 15), y los pasos Listo → Entregado. Si la cocina tiene otra pestaña abierta en el mismo equipo, se actualiza sola.
- **Corte:** ventas, número de pedidos, ticket promedio, cancelados, venta por producto, por forma de pago y por tipo. Exporta CSV. El día cuenta de 6 am a 6 am.

## Configurar
En `config.js` se cambian el nombre, el WhatsApp, el PIN, el horario, el envío, la cuenta para transferencias y el menú. Con `agotado: true` un producto se oculta.

**Límite:** los pedidos de la caja se guardan solo en el dispositivo de la caja. El PIN solo evita accesos casuales; no es una seguridad real.
