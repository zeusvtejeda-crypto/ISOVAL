# 5. Tablero de ventas y rentabilidad

## 5.1 Cómo atribuir cada venta a su anuncio
Meta no te dirá qué anuncio vendió (la venta ocurre en WhatsApp). Tres mecanismos, usa los tres:
1. **Referencia del anuncio en WhatsApp.** Los chats que llegan desde un anuncio muestran un bloque "Enviado desde un anuncio" con el título/imagen. Anota el nombre del anuncio en la primera fila del tablero al abrir el chat.
2. **Botones de la plantilla** (`02` §2.5): el texto prellenado delata el anuncio ("Quiero la King ($3,200)" sólo existe en el botón del anuncio).
3. **Pregunta de respaldo** si no hay bloque: `¿Nos viste en Facebook/Instagram o en Marketplace?`

Un chat = una fila. Se actualiza la misma fila cuando avanza (cotizado → confirmado → entregado).

## 5.2 Columnas de `tablero-ventas.csv`
| Columna | Qué poner |
|---|---|
| fecha | Día del primer mensaje |
| anuncio | Nombre exacto del anuncio en Meta (Ad1-King, Ad2-Precios…) o `Marketplace-organico` / `Otro` |
| telefono | Últimos 4 dígitos (privacidad) |
| medida | Individual / Matrimonial / Queen / King / Especial |
| tono | |
| etapa | Nuevo → Calificado → Cotizado → Confirmado → Entregado / Perdido |
| motivo_perdida | precio / fuera de zona / no respondió / compró otro / sólo cotizaba |
| entrega | domicilio / local |
| ingreso | Precio cobrado (ej. 1800) |
| costo_fabricacion | Tu costo real por esa base |
| costo_entrega | Costo real (gasolina, ayudante) o 0 si recoge |
| otros_costos | Comisión, empaque, etc. |
| margen | = ingreso − costo_fabricacion − costo_entrega − otros_costos |
| fecha_cierre | |

Hoja 2 (`resumen-diario`, calcula a mano o en Sheets): fecha, gasto Meta (del Administrador), conversaciones (Meta), filas Nuevo, Calificado, Cotizado, Confirmado, ingresos, margen, **costo por venta = gasto / confirmados**, **ROAS = ingresos / gasto**, **margen neto = margen − gasto**.

Métricas por anuncio (desglose semanal): gasto, conversaciones, costo/conversación (Meta) + calificados, confirmados, ingresos, margen (tablero) → **costo por venta por anuncio** y **margen neto por anuncio**. Es el único ranking que importa.

## 5.3 CPA máximo por producto
Fórmula:
```
Margen de contribución (MC) = precio − costo fabricación − costo entrega − otros costos variables
CPA máximo  = MC × 40 %   (nunca más de esto; deja 60 % del margen al negocio)
CPA objetivo = MC × 25 %  (lo que persigues para escalar)
```
**Debes poner tus costos reales.** Ejemplo ilustrativo con supuestos inventados sólo para enseñar el cálculo (NO son tus costos):

| Producto | Precio | Costo fab. (supuesto) | Entrega (supuesto) | MC | CPA máx (40 %) | CPA objetivo (25 %) |
|---|---|---|---|---|---|---|
| Individual | 1,600 | 900 | 100 | 600 | 240 | 150 |
| Matrimonial | 1,800 | 1,000 | 100 | 700 | 280 | 175 |
| Queen | 2,000 | 1,100 | 100 | 800 | 320 | 200 |
| King | 3,200 | 1,800 | 150 | 1,250 | 500 | 312 |

Lectura: si con los costos reales la King deja el doble de margen que la Matrimonial, puedes pagar el doble por vender una King y seguir ganando lo mismo. Si no, no "impulses" King sólo por el ticket.
Para la venta recogida en local, recalcula con −$200 de precio y $0 de entrega.

## 5.4 Reglas de decisión (con evidencia suficiente, no por corazonada)
Umbral mínimo para juzgar un anuncio: **≥ $300 gastados o ≥ 8 conversaciones**, lo que ocurra primero. Antes de eso no se pausa ni se "escala".

| Situación | Acción |
|---|---|
| Anuncio con ≥1 venta confirmada y costo por venta ≤ CPA máx | **Mantener**. Si ≤ CPA objetivo con ≥2 ventas, candidato a escalar. |
| Anuncio con gasto ≥ 2× CPA máx del producto que anuncia y 0 ventas, pero ≥5 calificados | Problema de cierre, no de anuncio: revisar chats, tiempo de respuesta y guion. Mantener 48 h más. |
| Anuncio con gasto ≥ 2× CPA máx, 0 ventas y <3 calificados | **Pausar**. Atrae curiosos. |
| Anuncio con costo/conversación >2× el promedio de la campaña tras $300 | **Pausar** (Meta ya le está dando poco presupuesto; libera el resto). |
| Conversaciones baratas pero muchas "fuera de zona" | **Modificar**: reducir radio a 15 km o añadir "Sólo entregas en Tepic" en texto. |
| CTR < 0.8 % y CPM alto tras $300 | **Modificar creativo** (la imagen no detiene el scroll). Cambiar imagen, no el texto. |
| Frecuencia > 3 en 7 días | Rotar imagen; el público local se agota rápido. |
| Campaña con ≥3 ventas, costo por venta ≤ CPA objetivo, margen neto positivo | **Escalar** +20 % cada 48 h mientras el costo por venta no suba >25 %. |
| Campaña con margen neto negativo al día 7 | **No escalar.** Diagnosticar en este orden: tiempo de respuesta → guion → creativo → audiencia. |

Nunca escalar algo que vende con pérdida "para ver si mejora": con más presupuesto pierde más.

## 5.5 ROAS
ROAS = ingresos atribuidos / gasto. Sólo es útil junto con margen: una Matrimonial ($1,800) vendida con $300 de anuncio es ROAS 6 pero el margen neto depende del costo. Reporta siempre **margen neto por anuncio** al lado del ROAS.
