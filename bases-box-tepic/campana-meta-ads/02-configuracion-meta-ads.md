# 2. Configuración exacta en Meta Ads + segmentación + paso a paso

Nombres de campos según el Administrador de anuncios en español (oct-2026). Si un campo no aparece con ese nombre exacto, está en la misma sección con un nombre parecido; no inventes opciones.

## 2.0 Prerrequisitos (sin esto no se publica)
| # | Qué | Cómo |
|---|---|---|
| 1 | **Página de Facebook "Bases Tipo Box Tepic"** | Crear página (categoría: Tienda de muebles / Fabricante). Foto de perfil: logo original. Portada: foto real de la fachada. Añadir dirección, horario, teléfono. |
| 2 | **WhatsApp vinculado a la página** | Página → Configuración → WhatsApp → vincular **311 108 3374** (debe ser WhatsApp Business). Sin esto no existe el botón "Enviar mensaje de WhatsApp". |
| 3 | **Dar acceso de la página a la cuenta publicitaria** | Business Manager → Páginas → asignar la cuenta `517078762226136` (o la cuenta que uses). Hoy esa cuenta sólo ve la página Isoval. |
| 4 | **Compartir el Pixel `1374326524873318`** con la cuenta publicitaria | Administrador de eventos → Conjuntos de datos → ese pixel → Configuración → Compartir con cuenta publicitaria. Verificar dominio `basestipobox.com` en Business Manager. |
| 5 | **Eventos del sitio** | El pixel ya dispara `PageView`. Añadir evento `Contact` (o `Lead`) en cada clic a wa.me (botones "Pedir …" / "Cotizar por WhatsApp"). Sirve para audiencias y como señal; no es compra. |
| 6 | Método de pago | ✅ ya existe en la cuenta. |

> Recomendación: usa una **cuenta publicitaria propia** para Bases Tipo Box dentro del mismo Business Manager (separa facturas, aprendizaje y reportes de Isoval). Si prefieres no esperar, la cuenta `517078762226136` funciona.

## 2.1 Ruta de optimización: qué elegir y por qué
| Opción | Estado para este negocio | Decisión |
|---|---|---|
| **A. Compras en sitio web (Pixel + API de conversiones)** | El sitio no tiene carrito ni pago; la "compra" ocurre en WhatsApp/local. Optimizar a `Purchase` web sería optimizar a un evento que nunca dispara. | ❌ No ahora. Sólo si en el futuro agregas pago en línea. |
| **B. Ventas → Mensajes WhatsApp → meta "Maximizar número de conversiones" (compras en mensajería)** | Es la opción ideal (optimiza a personas que compran, no a las que sólo escriben). Está **sujeta a elegibilidad de la cuenta** y requiere reportar las compras a Meta (eventos de compra desde WhatsApp vía API de conversiones para mensajes de empresas o herramienta compatible). Hoy no hay ningún conjunto de datos en la cuenta, así que no se puede usar aún. | ⏳ Objetivo para semana 3+. Primero acumular compras registradas. |
| **C. Ventas → Mensajes WhatsApp → meta "Maximizar número de conversaciones"** | Disponible hoy para cualquier cuenta con WhatsApp vinculado. Optimiza a que la gente inicie conversación. Las ventas se miden fuera de Meta (tablero `05`). | ✅ **Usar esta en semana 1.** |

Por qué objetivo **Ventas** y no **Interacción** si ambos permiten "conversaciones": el objetivo Ventas conserva la opción de cambiar la meta de rendimiento a "conversiones" (compras en mensajería) cuando seas elegible sin rehacer la campaña, y filtra algo mejor a curiosos. Con Interacción no podrías.

## 2.2 Configuración campo por campo

### Campaña
| Campo | Valor |
|---|---|
| Objetivo de compra | Subasta |
| Objetivo | **Ventas** |
| Configuración de campaña | **Campaña de ventas manual** (no Advantage+ de ventas: ese formato exige catálogo/pixel con compras web y no permite destino WhatsApp con control de audiencia local). |
| Nombre | `BTB | Ventas WhatsApp | Tepic | Test 7d` |
| Categoría de anuncio especial | Ninguna |
| Presupuesto de campaña Advantage+ | **Activado** · Diario · **$214.00 MXN** |
| Estrategia de puja | **Costo por resultado más bajo** |
| Límite de gasto de campaña | **$1,500.00 MXN** |

### Conjunto de anuncios
| Campo | Valor |
|---|---|
| Nombre | `Tepic 20km | WA | 20-60 | amplio` |
| Ubicación de conversión | **Aplicaciones de mensajería** |
| Aplicaciones de mensajería | **WhatsApp** (desmarcar Messenger e Instagram en semana 1 para que todo caiga al mismo número y guion) |
| Página de Facebook | Bases Tipo Box Tepic |
| Número de WhatsApp | 311 108 3374 |
| Meta de rendimiento | **Maximizar el número de conversaciones** (cambiar a "Maximizar el número de conversiones" cuando aparezca y haya compras reportadas) |
| Presupuesto | (lo controla la campaña) |
| Programación | Inicio: día 1 a las 00:00 · Fin: día 8 a las 00:00 (7 días completos) |
| Audiencia | **Audiencia Advantage+ activada** con las sugerencias de abajo |
| Ubicaciones | **Personas que viven en esta ubicación** → punto en Tepic, Nayarit (centro aprox. 21.504, −104.894) · radio **20 km**. Cubre Tepic, Xalisco y conurbación. ❌ No "Nayarit" completo: no entregas ahí y encarece. |
| Edad | 20 – 60 (bajo Advantage+ la mínima es dura, la máxima es sugerencia) |
| Género | Todos |
| Segmentación detallada | **Vacía** (amplio). Ver 2.3. |
| Idiomas | Vacío |
| Ubicaciones publicitarias | **Advantage+ (automáticas)**. Incluye Feed de Facebook, **Marketplace**, Instagram Feed, Reels, Stories, Explorar. Ver 2.4 para el caso manual. |
| Dispositivos | Todos (en Tepic >90 % será móvil; no restrinjas) |
| Sistemas operativos | Todos |
| Plantilla de mensaje | Ver 2.5 |

### Anuncios (los 5)
| Campo | Valor |
|---|---|
| Identidad | Página Bases Tipo Box Tepic (+ Instagram si existe; si no, dejar que use la página) |
| Formato | Imagen o video único (Ad 1–3, 5 imagen; Ad 4 video 9:16 con versión 1:1) |
| Multimedia | Subir 1080×1080 y 1080×1920 por anuncio para que Meta use la correcta por ubicación |
| Texto principal / Título / Descripción | De `03-textos-y-creativos.md` |
| Llamada a la acción | **Enviar mensaje de WhatsApp** |
| Mejoras Advantage+ de creativos | **Desactivar** "Mejoras estándar" visuales (recorta/retoca imágenes con precio). Puedes dejar "Texto" (variaciones de texto) apagado también en semana 1 para medir limpio. |
| Seguimiento | Pixel `1374326524873318` (sólo para reportar visitas al sitio si las hay) |

## 2.3 Segmentación local: comparación y decisión
| Público | Veredicto semana 1 | Razón |
|---|---|---|
| **Amplio local (Tepic 20 km, 20–60)** | ✅ Usar | ~250–350 k personas en radio. Suficiente para que el algoritmo encuentre compradores; con $214/día no se agota. El creativo (precio + "base para cama") hace de filtro. |
| Intereses (Muebles, Decoración del hogar, Colchones, Mudanzas) | ❌ No en semana 1 | En una ciudad del tamaño de Tepic recorta el público a 40–80 k, sube CPM y Meta ya detecta esas señales solo. Probar sólo como conjunto B en semana 2 si el amplio no entrega. |
| Interacción con la página/anuncios (últimos 90 días) | 🟡 Crear audiencia ahora, usar después | Hoy está vacía (página nueva). Crear "Interactuaron con la página o anuncios 90 días" y "Enviaron mensaje a la página 90 días" para remarketing en semana 2–3. |
| Visitantes del sitio (pixel) | 🟡 Crear ahora, usar después | "Todos los visitantes 30 días" y "Clic en WhatsApp (evento Contact) 30 días". Útil cuando pase de 300 personas. |
| Remarketing a interesados que no compraron | 🟡 Semana 2+ | Audiencia: "Enviaron mensaje 30 días" **excluyendo** lista de clientes (sube un CSV con los teléfonos de compradores como audiencia personalizada y exclúyela). Creativo: foto real + "aún te la entregamos esta semana". |
| Exclusiones | ✅ Desde día 1 | Excluir audiencia "Clientes" (CSV) en cuanto tengas 20+ compradores. Evita pagar por mostrar a quien ya compró. |

Lookalike: no. Con <100 compradores no hay semilla útil.

## 2.4 Ubicaciones: automáticas vs. manuales
- **Semana 1: Advantage+ (automáticas).** Con presupuesto bajo Meta compra el inventario más barato del momento; Marketplace suele estar incluido y es el placement más relevante para muebles.
- **Si en día 4 el desglose por ubicación muestra >50 % del gasto en Audience Network o Stories con cero conversaciones**, cambia a manual: Facebook (Feed, Marketplace, Reels, Stories), Instagram (Feed, Reels, Stories). Desmarcar Audience Network, Messenger, artículos instantáneos, In-stream.
- El anuncio de Marketplace usa la misma imagen 1:1; cuida que el precio sea legible en miniatura.

## 2.5 Plantilla de mensaje del anuncio (se configura en el conjunto)
- Saludo (automático al abrir WhatsApp): `Hola 👋 Soy de Bases Tipo Box Tepic. ¿Qué medida necesitas? Individual $1,600 · Matrimonial $1,800 · Queen $2,000 · King $3,200. Entrega en Tepic.`
- Preguntas frecuentes (botones, máx. 4):
  1. `Quiero la King ($3,200)`
  2. `Quiero Matrimonial o Queen`
  3. `¿Dónde están y qué horario tienen?`
  4. `¿Qué colores tienen disponibles?`
- Cada botón manda un texto prellenado que el cliente envía con un toque; la respuesta la das tú con los guiones de `04-whatsapp-cierre.md`.

## 2.6 Paso a paso para publicar (15–20 min)
1. Completa 2.0 (página, WhatsApp vinculado, acceso a la cuenta, pixel compartido).
2. Administrador de anuncios → **+ Crear** → Objetivo **Ventas** → **Campaña de ventas manual** → Continuar.
3. Campaña: nombre, categoría especial "Ninguna", **Presupuesto de campaña Advantage+** ON, Diario $214, puja "Costo por resultado más bajo", límite de gasto $1,500. Siguiente.
4. Conjunto: Ubicación de conversión "Aplicaciones de mensajería" → sólo WhatsApp → selecciona página y número. Meta de rendimiento "Maximizar el número de conversaciones". Programación 7 días. Ubicación: busca "Tepic, Nayarit", pin + radio 20 km. Edad 20–60. Ubicaciones Advantage+. Siguiente.
5. Anuncio 1: identidad = página BTB. Formato imagen única. Sube 1080×1080 y 1080×1920. Pega texto principal, título, descripción de `03`. CTA "Enviar mensaje de WhatsApp". Configura la plantilla de mensaje (2.5). Desactiva mejoras estándar. **Publicar** (queda "En revisión").
6. En la vista de anuncios: duplica el Anuncio 1 cuatro veces (⋯ → Duplicar → mismo conjunto) y cambia imagen/video + textos para Ad 2–5. Publicar.
7. Verifica: Campaña ACTIVA, conjunto ACTIVO, 5 anuncios "Activo" o "En revisión". Columnas: Importe gastado, Conversaciones con mensajes iniciadas, Costo por conversación iniciada, Impresiones, CPM, CTR (todos), Frecuencia.
8. Crea las audiencias de 2.3 (Audiencias → Crear → Personalizada): visitantes web 30 d, interacción página 90 d, mensajes 90 d, Clientes (CSV, vacío hoy).
9. Activa en WhatsApp Business el **mensaje de bienvenida** y **respuestas rápidas** de `04` (atajos `/precio`, `/king`, `/ubi`, `/fotos`, `/cierre`).
10. Abre `tablero-ventas.csv` y registra desde la primera conversación.

Si algo de 2.0 no se puede hoy, el orden mínimo para no perder la semana: página + WhatsApp vinculado (30 min). Pixel y audiencias pueden entrar en día 2–3 sin afectar la entrega.
