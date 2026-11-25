# BeautySkin · Real Clínica Estética (Tepic)

Kit digital para la página de Facebook /LinaresSkin.

| Pieza | Ruta | Qué hace |
|---|---|---|
| Página web | `index.html` | Landing con servicios y precios, paquetes, promo vigente, antes/después, FAQ, datos de la Dra. y COFEPRIS, y **agenda en línea** que confirma por WhatsApp (33 1225 6402). |
| CRM + ventas | `crm/` | App para iPad/celular (se instala en la pantalla de inicio). PIN, agenda semanal, fichas de clientas (piel, alergias, consentimiento), punto de venta con paquetes por sesiones, ticket por WhatsApp, seguimientos automáticos (retoque de toxina a 15 días, próximas sesiones, cumpleaños, paquetes sin usar, clientas inactivas), reportes y exportar CSV/respaldo. |
| Imágenes | `posts/*.png` | 6 posts 1080×1350, 1 historia 1080×1920, portada de Facebook 1640×624. Se regeneran con `node posts/src/render.js`. |
| Asistente WhatsApp | `../whatsapp-assistant/businesses/beautyskin.js` | Perfil del bot con servicios, precios y reglas (escala a humano en dudas médicas). |

## Editar
- Datos, precios, promo y horario: **`data.js`** (un solo archivo).
- Servicios con `precio: null` aparecen como "Cotiza" en la web; en el CRM se captura el precio al cobrar.
- Fotos reales: guarda `assets/hero.jpg` (vertical) y `assets/ba1.jpg`, `ba2.jpg`, `ba3.jpg` (collage antes|después). Aparecen solas.

## Pendientes por confirmar con la clínica
- Horario: L–V 9:00–19:00, solo con cita (confirmado).
- Precios "desde": estimados de mercado Tepic (nov 2026). Confirmar con la Dra.
- Reseñas reales (las de la web son de ejemplo y lo dicen).
- PIN del CRM: inicial `1234` → cambiarlo en CRM → Ajustes el primer día.

## Notas técnicas
- Sitio estático: se publica en GitHub Pages / Cloudflare Pages / Netlify tal cual.
- El CRM guarda en el navegador del dispositivo (localStorage). Usar **un solo dispositivo principal** (iPad de recepción) y descargar respaldo semanal en Ajustes. Las reservas web hechas desde otros teléfonos llegan por WhatsApp y se registran con "+ Nueva cita".
