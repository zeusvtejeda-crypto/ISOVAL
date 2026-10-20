# 1. Diagnóstico y estructura de campaña

## 1.1 Diagnóstico comercial
**Fortalezas reales (verificables, se pueden anunciar):**
- Fábrica propia en Tepic → precio de fábrica, sin intermediarios, tiempos cortos.
- Precio claro y público (desde $1,600). Elimina fricción: el cliente llega sabiendo cuánto cuesta.
- 1 año de garantía directo con el fabricante.
- Base maciza (pino + triplay), no hueca → argumento contra bases baratas de Marketplace.
- 8 tonos; local físico con estacionamiento donde se pueden tocar los acabados.
- King = 2 individuales → entra por puertas/escaleras, se mueve fácil (buen argumento de venta).
- $200 menos si recogen en local → palanca de cierre sin inventar descuentos.

**Debilidades / riesgos:**
- Producto de compra puntual y comparada: el cliente compara 2–3 opciones en Marketplace el mismo día. Si WhatsApp tarda >10 min en contestar, la venta se pierde.
- Sin página de Facebook propia ni pixel compartido con la cuenta de anuncios (bloqueo técnico, ver README).
- Ticket bajo ($1,600–$3,200): el margen soporta un CPA bajo. Cada peso mal dirigido pesa.
- King es el ticket más alto pero el de menor volumen natural; impulsarlo sí, pero medirlo por margen, no por deseo.

**Oportunidades de venta inmediata:**
1. Gente que ya busca "base para cama Tepic" en Marketplace → anuncio con precio y ubicación gana por claridad.
2. Quien cambia colchón (compra el colchón, no tiene base nueva): mensaje "no pongas colchón nuevo sobre base hundida".
3. Renovación de recámara: color a elegir + precio cerrado.
4. Pick-up en local: para quien quiere ahorrar $200 y llevársela hoy.

## 1.2 Qué significa "vender" en esta campaña
- **Venta confirmada** = cliente confirma medida + tono + forma de entrega **y** paga (anticipo o total). Nada antes de eso cuenta.
- Conversación ≠ venta. Cotización ≠ venta. Se miden las tres por separado (ver `05-tablero-ventas.md`).

## 1.3 Estructura de campaña (decisión)
Con $214/día no hay presupuesto para que varios conjuntos de anuncios salgan de aprendizaje. Meta necesita ~50 eventos de optimización por conjunto en 7 días; con conversaciones de WhatsApp a $15–40 c/u (rango típico local, no garantía) sólo **un conjunto** puede acercarse a eso.

```
Campaña: BTB | Ventas WhatsApp | Tepic | Test 7d
  Objetivo: Ventas · Presupuesto de campaña (CBO) $214/día · Límite de gasto $1,500
  └─ Conjunto 1: Tepic amplio 20 km · WhatsApp · 20–60 · todos
       ├─ Ad 1  KING — "2 bases individuales, $3,200" (imagen)
       ├─ Ad 2  PRECIOS — tabla 4 medidas (imagen BasesBox-05)
       ├─ Ad 3  QUEEN/MATRIMONIAL — "cambia tu base, no tu colchón" (imagen)
       ├─ Ad 4  VIDEO vertical 15 s — taller real + precio + WhatsApp
       └─ Ad 5  LOCAL — fachada real "ya puedes venir a verlas" (imagen)
```
- **1 campaña, 1 conjunto, 5 anuncios.** Meta reparte el presupuesto entre anuncios según resultados; tú decides con el tablero cuál genera ventas reales.
- Distribución entre productos: no se fuerza por conjunto. King recibe 2 de 5 creativos (Ad 1 + carrusel en día 4 si hay señal). Queen/matrimonial comparten Ad 3 y la tabla de precios. Si en día 4 un tamaño vende con mejor margen, se le da el creativo adicional a ese tamaño.
- **No se crea conjunto de remarketing en la semana 1**: no hay volumen de visitantes/conversaciones que justifique partir el presupuesto. Se arma la audiencia desde el día 1 (ver 02) y se activa en semana 2 si hay ≥300 personas.
- **Marketplace orgánico en paralelo (gratis):** publica las 4 medidas como artículos en Marketplace desde la página con los 10 títulos de `03`. No compite con la campaña; captura búsqueda activa.

## 1.4 Presupuesto y experimentación
| Concepto | Valor |
|---|---|
| Diario | $214 MXN (CBO) |
| Límite de gasto de campaña | $1,500 MXN (seguro contra sobre-gasto) |
| Mínimo diario de Meta en MXN | $18.59 → sin problema |
| Puja | Costo por resultado más bajo (sin tope). Con 7 días y volumen bajo, un tope de costo mataría la entrega. |
| Qué se prueba | 5 ángulos creativos dentro de 1 conjunto (king vs precio vs cambio de base vs video vs local). No se prueba audiencia ni ubicaciones en semana 1. |
| Regla de no tocar | Días 1–3 no se pausa nada salvo error (texto, precio, link). Cambios editan el aprendizaje. |

**Cuándo subir inversión:** sólo si al día 7 el costo por venta confirmada (CPV) ≤ CPA máximo de ese producto (`05`), con ≥3 ventas atribuidas. Subidas de máximo +20 % cada 48 h (si subes >20 % de golpe, Meta reinicia el aprendizaje).
**Cuándo bajar/pausar:** si al día 5 hay gasto ≥$1,000 sin ninguna venta confirmada ni ≥10 conversaciones calificadas → pausar, revisar WhatsApp (tiempo de respuesta, guion) antes que el anuncio. Lo más común es que falle el cierre, no el anuncio.

## 1.5 Estimaciones (ilustrativas, no garantías)
No prometo ventas. Para que sepas qué mirar: con $1,500 y un costo por conversación de $20–40, llegarían 35–75 conversaciones. Si el guion de WhatsApp cierra 1 de cada 8–10, hablamos de 4–9 ventas. Si cierra 1 de 20, 2–4. **La variable que más mueve el resultado es la velocidad y calidad de la respuesta en WhatsApp**, no la segmentación.
