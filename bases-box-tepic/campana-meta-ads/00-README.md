# Campaña de ventas — Bases Tipo Box Tepic (Meta Ads)

Objetivo único: **vender bases** (pedidos confirmados y rentables), cerrando por WhatsApp.
Presupuesto: **$1,500 MXN / 7 días** ($214/día). Cuenta publicitaria revisada: `517078762226136` (MXN, activa, con método de pago).

## Índice
| Archivo | Contenido |
|---|---|
| `01-diagnostico-y-estructura.md` | Diagnóstico, bloqueos encontrados, estructura de campaña y presupuesto |
| `02-configuracion-meta-ads.md` | Configuración exacta campo por campo + segmentación local + pasos para publicar |
| `03-textos-y-creativos.md` | Títulos Marketplace, 10 anuncios, propuestas visuales, guiones de video, carrusel king |
| `04-whatsapp-cierre.md` | Sistema de atención y cierre por WhatsApp (mensajes listos) |
| `05-tablero-ventas.md` + `tablero-ventas.csv` | Registro de ventas, CPA máximo por producto, reglas de mantener/pausar/escalar |
| `06-plan-7-dias.md` | Calendario de ejecución y plan de escalamiento |

## Estado real del acceso a Meta Ads (verificado 20-oct-2026)
- ✅ Acceso de lectura a la cuenta `517078762226136` (misma cuenta que usa Isoval).
- ✅ 5 imágenes "BasesBox-01…05" ya subidas a la cuenta (17-oct-2026), con precios y dirección correctos.
- ❌ **No existe página de Facebook "Bases Tipo Box Tepic"** vinculada. Páginas disponibles: Isoval, Brite Choice Dental, ZA, Logística y Marketing Villeda, Fuel Fit. Sin página propia, el anuncio saldría a nombre de Isoval y el botón de WhatsApp apuntaría al número de Isoval.
- ❌ **El Pixel del sitio (`1374326524873318`) no está compartido con esta cuenta publicitaria** (la cuenta no tiene ningún conjunto de datos). Hay que compartirlo o crear la campaña desde el Business Manager dueño del pixel.
- ⛔ Intenté dejar la campaña **en borrador** (sin gasto) vía API y el entorno bloqueó la acción por tratarse de una transacción real. Por eso la configuración va lista para reproducirla manualmente en 15–20 min (`02-configuracion-meta-ads.md`, sección "Paso a paso").

## Datos confirmados (sitio basestipobox.com, 20-oct-2026)
| Medida | Ancho × largo | Precio con entrega | Recogiendo en local |
|---|---|---|---|
| Individual | 1.00 × 1.90 m | $1,600 | $1,400 |
| Matrimonial | 1.35 × 1.90 m | $1,800 | $1,600 |
| Queen | 1.50 × 1.90 m | $2,000 | $1,800 |
| King (2 individuales) | 2.00 × 1.90 m | $3,200 | $3,000 |

Incluyen patas (10 cm, cromadas o plástico), tono a elegir (8: cocoa, morado, rosa, chocolate vinipiel, gris, azul, azul marino, negro), **1 año de garantía**, estructura maciza de pino y triplay. Entrega a domicilio en Tepic y zona conurbada. WhatsApp 311 108 3374. Local: Libramiento Tepic–Guadalajara esq. Tucán, junto a Birrias Don Campestre.

> ⚠️ Confirma antes de publicar: precio "recogiendo en local" (−$200), costo real de entrega, tonos en inventario y tiempo de entrega actual. Nada de esto se afirma en los anuncios salvo lo que ya publica tu sitio.

## Inconsistencias detectadas (corregir antes de lanzar)
1. `bases-box-tepic/index.html` (sitio viejo en este repo) muestra dirección Querétaro #285 y teléfono 311 121 6033. El sitio vivo muestra Libramiento y 311 108 3374. Si Meta revisa el dominio o alguien llega a la versión vieja, confunde.
2. `whatsapp-assistant/businesses/camas.js` tiene precios, zonas y pagos vacíos. Llénalo con la tabla de arriba para que el asistente no diga "te cotizo" cuando el precio es público.
3. Las imágenes subidas a Meta usan el fondo real del taller pero la base en primer plano es un render 3D. Para Marketplace y remarketing conviene foto real de base desempacada (ver `03-textos-y-creativos.md`, "Materiales que necesito").
