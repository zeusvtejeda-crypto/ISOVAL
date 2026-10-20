# 6. Plan de ejecución (7 días) y escalamiento

Horas en punto son sugeridas; lo importante es el orden. Responsable: quien atiende el WhatsApp (W) y quien opera Meta (M). Si es la misma persona, el WhatsApp tiene prioridad.

## Día 0 (antes de lanzar) — bloqueos
- [ ] M: Crear página "Bases Tipo Box Tepic", vincular WhatsApp 311 108 3374, dar acceso a la cuenta publicitaria, compartir pixel. (`02` §2.0)
- [ ] M/W: Confirmar por escrito: precios, −$200 pick-up, costo de entrega, tonos en stock, tiempo de entrega, forma de pago/anticipo.
- [ ] W: Tomar las fotos de `03` §3.3 (mínimo: King armada, Queen, Matrimonial desempacadas; 1 video vertical). 1 hora en el taller.
- [ ] M: Armar 5 creativos en 1:1 y 9:16 con las fotos reales (o arrancar con las 5 imágenes ya subidas y reemplazar en día 3).
- [ ] W: Cargar respuestas rápidas y bienvenida de `04` en WhatsApp Business. Etiquetas creadas.
- [ ] M: Corregir `bases-box-tepic/index.html` del repo (dirección/teléfono viejos) y `camas.js`.

## Día 1 — preparación, medición y lanzamiento
- 09:00 M: Crear campaña siguiendo `02` §2.6. Publicar los 5 anuncios. Crear audiencias personalizadas (vacías hoy).
- 10:00 M: Publicar 4 artículos en Marketplace (uno por medida) desde la página con títulos de `03` §3.1. Gratis.
- 12:00 M: Verificar aprobación. Si un anuncio se rechaza: suele ser texto en imagen o precio tachado; corregir y reenviar.
- Todo el día W: responder <5 min. Registrar cada chat en el tablero con el nombre del anuncio.
- 19:00 M: Anotar gasto, conversaciones, costo/conversación del día. No tocar nada.

## Días 2–3 — revisión inicial y diagnóstico
- Mañana M: revisar que los 5 anuncios reciban entrega (si uno tiene 0 impresiones a las 24 h, revisar rechazo). Revisar desglose por **ubicación** (placement) y por **edad**.
- W: mirar los chats: ¿preguntan precio aunque ya está en el anuncio? (texto no se lee → precio más grande en imagen). ¿Muchos fuera de zona? (radio). ¿Preguntan por producto que no vendes? (ajustar texto).
- Día 3 tarde M: sustituir las imágenes con render por fotos reales en los anuncios que tengan **<$150 gastados** (editar creativo reinicia aprendizaje de ese anuncio; en los que ya gastaron más, duplicar como anuncio nuevo y dejar el viejo activo).
- Regla: aún no se pausa nada por rendimiento (umbral de `05` §5.4 no alcanzado).

## Días 4–5 — optimización con datos
- Día 4 09:00 M: ranking por anuncio con `05` §5.2. Aplicar reglas §5.4: pausar lo que cumpla criterio de pausa; mantener el resto.
- Día 4 M: Añadir el **carrusel King** (`03` §3.6) si King tiene ≥1 venta o ≥3 calificados; si no, añadir el anuncio del tamaño que más vende (A6 Queen o A9 Matrimonial).
- Día 4 M: Si >50 % del gasto cayó en Audience Network/Stories sin conversaciones → ubicaciones manuales (`02` §2.4).
- Día 5 W: Primer seguimiento (+24 h) y segundo (+72 h) a cotizados según `04` §4.8. Recuperación de abandonados §4.9.
- Día 5 19:00 M: calcular costo por venta y margen neto acumulados por producto.

## Días 6–7 — revisión comercial y continuidad
- Día 6 M: no hacer cambios estructurales (deja que el fin de semana entregue; sábado suele ser buen día para muebles).
- Día 7 19:00 M+W reunión 30 min con el tablero:
  1. Ventas confirmadas, ingresos, margen, gasto, costo por venta, margen neto.
  2. Mejor anuncio (margen neto), peor anuncio.
  3. Tamaño más rentable por venta y por peso invertido.
  4. Tasa de cierre (confirmados / calificados). Si <10 %, el problema está en WhatsApp.
  5. Motivos de pérdida más repetidos → ajuste de texto o de proceso.
  6. Decisión: escalar / mantener / pausar y arreglar.

## Plan posterior (sólo si al día 7 el margen neto es positivo)
| Semana | Acción | Condición |
|---|---|---|
| 2 | Presupuesto $257/día (+20 %). Mismo conjunto. Apagar anuncios con 0 ventas y ≥2× CPA máx. Nuevos creativos con fotos reales + anuncio del tamaño ganador. | Costo por venta ≤ CPA objetivo en ≥3 ventas |
| 2 | Activar **remarketing** (conjunto 2, $50/día): "mensajes 30 d + visitantes web 30 d" excluyendo clientes. Creativo: foto real + "¿seguimos con tu base [tono]?" | Audiencia ≥300 personas |
| 3 | Subir a $308/día (+20 %) si el costo por venta no subió >25 %. Probar conjunto B con intereses sólo si el amplio se satura (frecuencia >3). | Semana 2 rentable |
| 3–4 | Reportar compras a Meta y cambiar la meta de rendimiento a **"Maximizar número de conversiones"** (compras en mensajería) cuando Ads Manager la muestre disponible. Subir CSV de clientes como audiencia y excluirla. | ≥20 ventas registradas |
| 4+ | Separar campaña propia para King si King tiene ≥5 ventas con margen neto positivo; si no, King sigue como anuncio dentro de la campaña general. | Evidencia, no deseo |

Si al día 7 el margen neto es negativo: **no se escala**. Se pausa 2 días, se arreglan tiempo de respuesta/guion/fotos según el diagnóstico, y se relanza con $150/día otros 7 días. Un segundo ciclo negativo con cierre <10 % indica un problema de oferta o atención, no de anuncios.
