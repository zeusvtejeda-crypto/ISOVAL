#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Genera la COTIZACIÓN de LYM Villeda: el documento largo, para mandarle a
cualquier cliente. Explica el problema, qué hacemos, cómo trabajamos y qué
recibe cada mes — y hasta el final, cuando ya entendió el trabajo, el precio.

    pip install reportlab
    python3 generar_cotizacion.py

Los precios, los planes, las promociones y los datos de contacto NO se editan
aquí: viven en generar_presupuestos.py y este documento los toma de ahí, para
que las dos cotizaciones nunca se contradigan. Lo que sí se edita aquí son los
textos de venta: el problema, los servicios, el método y el calendario de
ejemplo.
"""

import os

from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import cm
from reportlab.platypus import (
    CondPageBreak, KeepTogether, PageBreak, SimpleDocTemplate, Spacer, Table,
    TableStyle,
)

from generar_presupuestos import (  # datos y estilo compartidos
    ADICIONALES, CIUDAD, CONDICIONES, CORREO, CREAM, CW, FECHA, GOLD, INK,
    LEMA, LINE, M, MARCA, MARCA_LARGA, MONEDA, MUTED, PLANES, PROMOCIONES,
    REDES, SANS, SERIF, SOFT, TELEFONO, VIGENCIA, WHITE, bloque_promociones,
    bullets, kicker, p, tabla_comparativa, titulo,
)

SALIDA = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                      "Cotizacion-LYM-Villeda.pdf")

# ─────────────────────────────────────────────────────────────────────────────
# TEXTOS DE VENTA — edita de aquí para abajo
# ─────────────────────────────────────────────────────────────────────────────

ETIQUETA_DOC = "Propuesta general de servicios"

TITULO_PORTADA = "Marcas que se ven<br/>bien y que venden"
BAJADA_PORTADA = ("Estrategia, contenido y redes que convierten seguidores en "
                  "clientes — con un plan claro mes a mes.")

CARTA = [
    "Gracias por el interés en trabajar con nosotros. Antes de hablar de "
    "dinero queremos que sepas exactamente qué vas a recibir cada mes, cómo "
    "lo hacemos y por qué lo hacemos así.",
    "Por eso el precio está hasta el final de este documento. Cuando llegues "
    "ahí vas a poder juzgar si vale lo que cuesta — que es justo como debería "
    "tomarse una decisión de este tipo.",
]

INDICE = [
    ("01", "El punto de partida", "Qué está pasando hoy con tu negocio en digital"),
    ("02", "Qué hacemos", "Todo lo que incluye trabajar con nosotros"),
    ("03", "Cómo trabajamos", "El método, paso a paso, mes con mes"),
    ("04", "Lo que recibes cada mes", "Entregables concretos, sin letras chiquitas"),
    ("05", "Con quién trabajamos", "Marcas reales que ya confían en nosotros"),
    ("06", "La inversión", "Los tres planes y lo que incluye cada uno"),
]

PROBLEMA_INTRO = [
    "Casi ningún negocio que llega con nosotros tiene un problema de producto. "
    "Tienen un problema de visibilidad.",
    "Hoy la gente decide dónde comprar, dónde comer o a quién contratar desde "
    "su teléfono. Busca en Google, revisa las reseñas, entra a tu Instagram, "
    "ve si publicaste algo en las últimas semanas y si alguien contesta los "
    "mensajes. Ese recorrido dura menos de un minuto, y en ese minuto se "
    "decide la venta. Si tu negocio no aparece bien en ese momento, la venta "
    "se la lleva otro — y no necesariamente el mejor, sino el que se vio mejor.",
]

PROBLEMA_SINTOMAS = [
    "Publicas cuando hay tiempo, y de repente pasan dos semanas sin subir nada.",
    "No sabes qué publicar, así que terminas subiendo lo mismo de siempre.",
    "Llegan mensajes y comentarios que se contestan tarde, o no se contestan.",
    "Tu perfil de Google está incompleto, con fotos viejas o sin reseñas nuevas.",
    "Has invertido en publicidad sin saber realmente si sirvió.",
    "Tu competencia, que no necesariamente es mejor, se ve más profesional.",
]

PROBLEMA_CIERRE = (
    "Ninguno de esos problemas se arregla echándole más ganas. Se arreglan con "
    "un sistema que se sostiene todos los días, aunque tú estés ocupado "
    "atendiendo tu negocio. Eso es exactamente lo que contratas aquí: no posts "
    "sueltos, sino un equipo de marketing operando tu marca."
)

SERVICIOS = [
    ("Calendario de contenido mensual",
     "Cada mes te enviamos, por adelantado, un calendario con cada publicación "
     "planeada: día, formato, tema y objetivo. Es tu mapa del mes completo y lo "
     "apruebas antes de que se produzca nada."),
    ("Reels y video",
     "El algoritmo premia el video. Producimos reels cortos con música y ritmo "
     "que generan alcance orgánico — hoy es el formato que hace crecer una "
     "cuenta desde cero."),
    ("Carruseles y diseño",
     "Piezas educativas y de producto con identidad visual consistente: misma "
     "paleta, misma tipografía y mismo estilo en cada publicación, para que tu "
     "marca se vea seria y confiable."),
    ("Historias y engagement diario",
     "Encuestas, preguntas y detrás de cámaras que mantienen la cuenta viva y "
     "activan el algoritmo. Es el multiplicador de alcance más subestimado y el "
     "primero que abandonan los negocios que lo hacen solos."),
    ("Mensajes, comentarios y leads",
     "Respondemos los mensajes directos y los comentarios, y damos seguimiento "
     "a cada cliente potencial. Convertimos el interés en conversaciones y las "
     "conversaciones en ventas."),
    ("Reputación online en Google",
     "Creamos y ordenamos tu perfil de Google Business para que aparezcas "
     "cuando alguien busca tu tipo de negocio en la zona, con reseñas, fotos y "
     "datos al día."),
    ("Publicidad en Meta y TikTok Ads",
     "Cuando quieres acelerar, montamos campañas pagadas con segmentación real "
     "para llegar a más clientes de tu ciudad, con un presupuesto controlado y "
     "medido."),
    ("Sitio web y reportes",
     "Diseñamos y publicamos tu sitio web, y cada mes entregamos un reporte con "
     "métricas reales: qué funcionó, qué creció y hacia dónde vamos el mes "
     "siguiente."),
]

METODO = [
    ("01", "Diagnóstico",
     "Revisamos tu cuenta, la de tu competencia directa y tu mercado local. "
     "Definimos dónde estás parado hoy y cuál es la oportunidad más grande que "
     "nadie en tu giro está aprovechando. De aquí sale todo lo demás."),
    ("02", "Estrategia y pilares de contenido",
     "Definimos los temas que va a tocar tu marca — producto, autoridad, "
     "comunidad, promociones — y el tono de voz con el que va a hablar. Esto "
     "asegura que cada publicación tenga un propósito y no sea relleno."),
    ("03", "Calendario mensual, por adelantado",
     "Antes de que arranque el mes recibes un documento con todo planeado: qué "
     "día, qué formato, qué tema y qué objetivo. Lo revisas, lo apruebas y a "
     "partir de ahí trabajamos sin sorpresas ni improvisaciones."),
    ("04", "Producción",
     "Grabamos, diseñamos y editamos. Reels, carruseles, historias y textos con "
     "llamada a la acción — todo listo y agendado con anticipación, no el mismo "
     "día a las carreras."),
    ("05", "Publicación y comunidad",
     "Publicamos en los mejores horarios para tu audiencia, respondemos "
     "mensajes y comentarios, y damos seguimiento a cada cliente potencial que "
     "llega por las redes. Aquí es donde el contenido se vuelve venta."),
    ("06", "Medición y reporte",
     "Al cierre del mes entregamos un reporte con métricas reales y el "
     "aprendizaje para el mes siguiente. Las redes son consistencia — nosotros "
     "la sostenemos y te la comprobamos con números."),
]

ENTREGABLES = [
    "El calendario del mes completo, enviado y aprobado <b>antes</b> de que "
    "empiece el mes.",
    "Las publicaciones producidas y publicadas, con diseño e identidad propia.",
    "Historias durante la semana para mantener la cuenta activa.",
    "Reels grabados y editados, según el plan que elijas.",
    "Mensajes y comentarios atendidos, con seguimiento a los interesados.",
    "El reporte de cierre de mes con métricas reales y el plan del mes que sigue.",
]

CALENDARIO_EJEMPLO = [
    ("Lunes", "Reel", "Producto estrella en acción, con música del momento "
     "» comenta INFO para recibir precios por mensaje", "Alcance"),
    ("Martes", "Carrusel", "\"3 cosas que no sabías de nuestro producto o "
     "servicio\" — educativo", "Autoridad"),
    ("Miércoles", "Historia", "Encuesta: ¿cuál prefieres, A o B? más detrás de "
     "cámaras", "Engagement"),
    ("Jueves", "Reel", "Cliente real, reseña o antes y después "
     "» comenta QUIERO para más información", "Prueba social"),
    ("Viernes", "Carrusel", "Promoción o novedad de la semana con llamada a la "
     "acción clara", "Venta directa"),
    ("Sábado", "Historia", "Recordatorio de horario, ubicación y WhatsApp para "
     "pedir", "Conversión"),
]

CALENDARIO_NOTA = (
    "Fíjate en los <b>comment-gates</b>: cuando alguien comenta una palabra "
    "clave, se le abre automáticamente una conversación por mensaje directo y "
    "se vuelve un cliente potencial con nombre y apellido. Así se convierte el "
    "alcance en ventas. Además del calendario semanal planeamos las fechas "
    "especiales del mes — temporadas, días festivos y promociones — para que "
    "nunca pierdas una ventana de venta."
)

CIFRAS = [
    ("6+", "Marcas activas que gestionamos"),
    ("5+", "Industrias distintas atendidas"),
    ("20+", "Publicaciones al mes por cliente"),
    ("MX · USA", "Clientes en México y Estados Unidos"),
]

CLIENTES = [
    ("LAB A+A", "Arquitectura, construcción y peritajes",
     "Calendario editorial completo con reels de obra, carruseles de autoridad "
     "e historias diarias. Sistema de comment-gates para convertir alcance en "
     "clientes potenciales por mensaje directo."),
    ("Isoval", "Arquitectura y construcción · Tepic",
     "Identidad de marca completa, sitio web propio en isoval.com.mx y "
     "calendario de contenido con presentadora frente a cámara y un sistema de "
     "looks por tipo de publicación."),
    ("D Fit House", "Comida alta en proteína · dentro de Golden Gym",
     "Posicionamiento \"fuel para quien entrena\", sitio web con menú y pedidos "
     "por WhatsApp, y contenido de producto para atraer a la comunidad fitness "
     "de la ciudad."),
    ("Brite Choice Dental", "Clínica dental · California, EE. UU.",
     "Propuesta y gestión bilingüe para un cliente en Estados Unidos: contenido "
     "en Instagram y TikTok, respuestas automáticas, monitoreo de mensajes y "
     "reportes mensuales."),
    ("Yoguyum", "Frozen yogurt · Tepic",
     "Análisis competitivo, estrategia de contenido de siete pilares y plan a "
     "90 días para posicionarlo como la marca número uno de su categoría en "
     "redes."),
]

INVERSION_INTRO = (
    "Ya sabes qué incluye el trabajo, quién lo hace y cómo se entrega. Esto es "
    "lo que cuesta. Los tres planes corren sobre el mismo método — cambia el "
    "volumen de contenido y hasta dónde llegamos contigo."
)

SIGUIENTE_PASO = [
    "Nos dices qué plan te late o qué dudas te quedaron.",
    "Hacemos el diagnóstico de tu cuenta y te decimos, sin compromiso, qué "
    "cambiaríamos primero.",
    "Confirmas el plan y agendamos el arranque.",
    "Recibes tu primer calendario antes de que empiece el mes, y a trabajar.",
]

CIERRE_FRASE = ("Tu negocio ya es bueno. Nosotros hacemos que se note.")


# ─────────────────────────────────────────────────────────────────────────────
# Armado del documento
# ─────────────────────────────────────────────────────────────────────────────

def chrome(canvas, doc):
    canvas.saveState()
    w, h = letter
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.6)
    canvas.line(M, h - 1.55 * cm, w - M, h - 1.55 * cm)
    canvas.setFont("Helvetica-Bold", 8)
    canvas.setFillColor(INK)
    canvas.drawString(M, h - 1.32 * cm, MARCA.upper())
    canvas.setFont(SANS, 7.5)
    canvas.setFillColor(MUTED)
    canvas.drawRightString(w - M, h - 1.32 * cm,
                           "PROPUESTA DE SERVICIOS  ·  %s" % FECHA)
    canvas.line(M, 1.65 * cm, w - M, 1.65 * cm)
    canvas.setFont(SANS, 7)
    canvas.drawString(M, 1.32 * cm,
                      "%s · %s · %s" % (TELEFONO, CORREO, REDES))
    canvas.drawRightString(w - M, 1.32 * cm, str(doc.page))
    canvas.restoreState()


def seccion(numero, titulo_txt, subtitulo=None):
    bloque = [kicker("%s — %s" % (numero, titulo_txt)),
              titulo(titulo_txt, 18)]
    if subtitulo:
        bloque.append(p(subtitulo, 10, leading=15, color=MUTED, space_after=4))
    bloque.append(Spacer(1, 8))
    return bloque


def parrafos(textos, size=9.5, leading=15):
    return [p(t, size, leading=leading, space_after=8) for t in textos]


def portada():
    story = [Spacer(1, 0.4 * cm), kicker("Propuesta de servicios")]
    story.append(p(TITULO_PORTADA, size=30, leading=34, font=SERIF))
    story.append(Spacer(1, 6))
    story.append(p(BAJADA_PORTADA, size=10.5, leading=16, color=MUTED))
    story.append(Spacer(1, 14))

    datos = Table(
        [[p("DOCUMENTO", 7, color=MUTED, font="Helvetica-Bold"),
          p("FECHA", 7, color=MUTED, font="Helvetica-Bold"),
          p("VIGENCIA", 7, color=MUTED, font="Helvetica-Bold"),
          p("MONEDA", 7, color=MUTED, font="Helvetica-Bold")],
         [p(ETIQUETA_DOC, 9.5), p(FECHA, 9.5),
          p("%d días" % VIGENCIA, 9.5), p(MONEDA, 9.5)]],
        colWidths=[CW * 0.40, CW * 0.20, CW * 0.20, CW * 0.20])
    datos.setStyle(TableStyle([
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("BACKGROUND", (0, 0), (-1, -1), SOFT),
        ("LINEBELOW", (0, 0), (-1, 0), 0.5, LINE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story += [datos, Spacer(1, 20)]

    story += parrafos(CARTA, size=10, leading=16)
    story.append(Spacer(1, 12))

    filas = []
    for numero, nombre, detalle in INDICE:
        filas.append([p(numero, 11, font=SERIF, color=GOLD),
                      p("<b>%s</b>" % nombre, 9.5),
                      p(detalle, 9, color=MUTED)])
    indice = Table(filas, colWidths=[CW * 0.07, CW * 0.33, CW * 0.60])
    indice.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("LINEBELOW", (0, 0), (-1, -2), 0.4, LINE),
        ("LINEABOVE", (0, 0), (-1, 0), 1.2, GOLD),
    ]))
    story.append(indice)
    story.append(Spacer(1, 10))
    story.append(p("%s · %s · %s" % (MARCA_LARGA, CIUDAD, REDES), 8.5,
                   color=MUTED))
    return story


def seccion_problema():
    story = seccion("01", "El punto de partida",
                    "Qué está pasando hoy con tu negocio en digital.")
    story += parrafos(PROBLEMA_INTRO)
    story.append(Spacer(1, 4))

    sintomas = [kicker("Si algo de esto te suena conocido, es de esto que hablamos")]
    sintomas += bullets(PROBLEMA_SINTOMAS, size=9)
    caja = Table([[sintomas]], colWidths=[CW])
    caja.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), CREAM),
        ("LEFTPADDING", (0, 0), (-1, -1), 14),
        ("RIGHTPADDING", (0, 0), (-1, -1), 14),
        ("TOPPADDING", (0, 0), (-1, -1), 12),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("LINEBEFORE", (0, 0), (0, -1), 2, GOLD),
    ]))
    story += [caja, Spacer(1, 12)]
    story.append(p(PROBLEMA_CIERRE, 9.5, leading=15))
    return story


def seccion_servicios():
    story = seccion("02", "Qué hacemos",
                    "No solo subimos publicaciones: construimos la presencia "
                    "completa de tu negocio, de principio a fin.")
    filas = []
    for nombre, detalle in SERVICIOS:
        filas.append([p("<b>%s</b>" % nombre, 9.5, leading=13),
                      p(detalle, 9, leading=13, color=MUTED)])
    t = Table(filas, colWidths=[CW * 0.30, CW * 0.70])
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (0, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("LINEBELOW", (0, 0), (-1, -2), 0.4, LINE),
    ]))
    story.append(t)
    return story


def seccion_metodo():
    story = seccion("03", "Cómo trabajamos",
                    "No es magia ni suerte: es un proceso ordenado que "
                    "repetimos mes con mes hasta que las redes se vuelven una "
                    "fuente constante de clientes.")
    filas = []
    for numero, nombre, detalle in METODO:
        filas.append([p(numero, 15, font=SERIF, color=GOLD),
                      p("<b>%s</b><br/><font color='#6E675C'>%s</font>"
                        % (nombre, detalle), 9.5, leading=14)])
    t = Table(filas, colWidths=[CW * 0.08, CW * 0.92])
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
        ("LEFTPADDING", (0, 0), (0, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("LINEBELOW", (0, 0), (-1, -2), 0.4, LINE),
    ]))
    story.append(t)
    return story


def seccion_entregables():
    story = seccion("04", "Lo que recibes cada mes",
                    "Entregables concretos, para que sepas exactamente por qué "
                    "estás pagando.")
    story += bullets(ENTREGABLES, size=9.5)
    story.append(Spacer(1, 14))

    story.append(p("<b>Así se ve un calendario nuestro</b>", 9.5,
                   space_after=6))
    data = [[p("DÍA", 8, color=WHITE, font="Helvetica-Bold"),
             p("FORMATO", 8, color=WHITE, font="Helvetica-Bold"),
             p("PUBLICACIÓN", 8, color=WHITE, font="Helvetica-Bold"),
             p("OBJETIVO", 8, color=WHITE, font="Helvetica-Bold")]]
    for dia, formato, publicacion, objetivo in CALENDARIO_EJEMPLO:
        data.append([p("<b>%s</b>" % dia, 8.5),
                     p(formato, 8.5, color=GOLD),
                     p(publicacion, 8.5, leading=11.5, color=MUTED),
                     p(objetivo, 8.5, align=TA_RIGHT)])
    t = Table(data, colWidths=[CW * 0.12, CW * 0.13, CW * 0.58, CW * 0.17],
              repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), INK),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, CREAM]),
        ("GRID", (0, 1), (-1, -1), 0.4, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ]))
    story += [t, Spacer(1, 10)]
    story.append(p(CALENDARIO_NOTA, 9, leading=13.5, color=MUTED))
    return story


def seccion_clientes():
    story = seccion("05", "Con quién trabajamos",
                    "Distintos giros, un mismo estándar.")

    celdas = []
    for cifra, detalle in CIFRAS:
        celdas.append(p("<font size=15 face='Times-Bold'>%s</font><br/>"
                        "<font size=8 color='#6E675C'>%s</font>"
                        % (cifra, detalle), 8, leading=14, align=TA_CENTER))
    numeros = Table([celdas], colWidths=[CW * 0.25] * 4)
    numeros.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), SOFT),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("LINEBEFORE", (1, 0), (-1, 0), 0.5, LINE),
    ]))
    story += [numeros, Spacer(1, 14)]

    filas = []
    for nombre, giro, detalle in CLIENTES:
        filas.append([p("<b>%s</b><br/><font size=8 color='#6E675C'>%s</font>"
                        % (nombre, giro), 10, leading=13, font=SANS),
                      p(detalle, 9, leading=13, color=MUTED)])
    t = Table(filas, colWidths=[CW * 0.28, CW * 0.72])
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (0, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("LINEBELOW", (0, 0), (-1, -2), 0.4, LINE),
    ]))
    story.append(t)
    return story


def seccion_inversion():
    story = seccion("06", "La inversión",
                    "Tres planes, el mismo método.")
    story.append(p(INVERSION_INTRO, 9.5, leading=15, space_after=12))
    story.append(tabla_comparativa(incluir_ideal=True))
    story.append(Spacer(1, 6))
    story.append(p("Los precios pueden ajustarse según el alcance y los "
                   "objetivos de cada negocio. La cotización personalizada no "
                   "tiene costo.", 8, color=MUTED))
    return story


def seccion_adicionales():
    story = [kicker("Fuera de plan"), titulo("Servicios adicionales", 16)]
    story.append(p("Se pueden sumar a cualquier plan o contratarse por "
                   "separado; cada uno se cotiza según el alcance del proyecto.",
                   9.5, leading=14, color=MUTED, space_after=8))
    filas = []
    for nombre, detalle in ADICIONALES:
        filas.append([p("<b>%s</b>" % nombre, 9, leading=12),
                      p(detalle, 8.5, leading=12, color=MUTED),
                      p("Según alcance", 8, align=TA_RIGHT, color=GOLD)])
    t = Table(filas, colWidths=[CW * 0.30, CW * 0.53, CW * 0.17])
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("LEFTPADDING", (0, 0), (0, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("LINEBELOW", (0, 0), (-1, -2), 0.4, LINE),
    ]))
    story.append(t)
    return [KeepTogether(story)]


def cierre():
    condiciones = [kicker("Letras claras"), titulo("Condiciones", 16),
                   Spacer(1, 6)]
    condiciones += bullets(CONDICIONES, size=9)

    paso = [kicker("Siguiente paso"), titulo("Cómo arrancamos", 16),
            Spacer(1, 6)]
    paso += bullets(SIGUIENTE_PASO, size=9.5)

    story = [KeepTogether(condiciones), Spacer(1, 18), KeepTogether(paso),
             Spacer(1, 22)]

    hueco = p("", 9)
    firma = Table(
        [[p("Plan elegido", 7.5, color=MUTED, font="Helvetica-Bold"), hueco,
          p("Nombre y firma del cliente", 7.5, color=MUTED, font="Helvetica-Bold"),
          hueco, p("Fecha", 7.5, color=MUTED, font="Helvetica-Bold")],
         [hueco, hueco, hueco, hueco, hueco]],
        colWidths=[CW * 0.31, CW * 0.05, CW * 0.38, CW * 0.05, CW * 0.21],
        rowHeights=[16, 34])
    firma.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEBELOW", (0, 1), (0, 1), 0.8, INK),
        ("LINEBELOW", (2, 1), (2, 1), 0.8, INK),
        ("LINEBELOW", (4, 1), (4, 1), 0.8, INK),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))

    contacto = Table(
        [[p("%s<br/><font size=8 color='#6E675C'>%s · %s</font>"
            % (MARCA, MARCA_LARGA, CIUDAD), 12, leading=16, font=SERIF),
          p("%s<br/>%s<br/>%s" % (TELEFONO, CORREO, REDES), 9, leading=13,
            align=TA_RIGHT, color=MUTED)]],
        colWidths=[CW * 0.58, CW * 0.42])
    contacto.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), SOFT),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 12),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
        ("LEFTPADDING", (0, 0), (-1, -1), 14),
        ("RIGHTPADDING", (0, 0), (-1, -1), 14),
        ("LINEABOVE", (0, 0), (-1, 0), 1.2, GOLD),
    ]))

    final = [p(CIERRE_FRASE, 14, leading=19, font=SERIF, align=TA_CENTER),
             Spacer(1, 14), firma, Spacer(1, 18), contacto, Spacer(1, 8),
             p('"%s"' % LEMA, 9, color=GOLD, align=TA_CENTER, font=SERIF)]
    story.append(KeepTogether(final))
    return story


def construir():
    doc = SimpleDocTemplate(
        SALIDA, pagesize=letter,
        leftMargin=M, rightMargin=M, topMargin=2.4 * cm,
        bottomMargin=2.2 * cm,
        title="%s — Propuesta de servicios" % MARCA,
        author=MARCA_LARGA, subject="Cotización")

    respiro = 6.5 * cm

    story = portada()
    story.append(PageBreak())
    story += seccion_problema()

    story += [Spacer(1, 22), CondPageBreak(respiro)]
    story += seccion_servicios()
    story += [Spacer(1, 22), CondPageBreak(respiro)]
    story += seccion_metodo()
    story += [Spacer(1, 22), CondPageBreak(respiro)]
    story += seccion_entregables()
    story += [Spacer(1, 22), CondPageBreak(respiro)]
    story += seccion_clientes()

    story.append(PageBreak())          # el precio siempre estrena hoja
    story += seccion_inversion()
    story += [Spacer(1, 18), CondPageBreak(respiro)]
    story += bloque_promociones()
    story += [Spacer(1, 18), CondPageBreak(respiro)]
    story += seccion_adicionales()
    story += [Spacer(1, 20), CondPageBreak(respiro)]
    story += cierre()

    doc.build(story, onFirstPage=chrome, onLaterPages=chrome)
    print("PDF generado: %s" % SALIDA)


if __name__ == "__main__":
    construir()
