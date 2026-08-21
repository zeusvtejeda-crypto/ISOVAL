#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Genera el PDF de presupuestos de los paquetes de LYM Villeda.

    pip install reportlab
    python3 generar_presupuestos.py

Todo lo editable vive en el bloque CONFIGURACIÓN de abajo: datos de contacto,
precios, contenido de cada plan, promociones y condiciones. Cambia lo que
necesites, vuelve a correr el script y el PDF se regenera.
"""

import datetime
import os

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import (
    KeepTogether, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table,
    TableStyle,
)

# ─────────────────────────────────────────────────────────────────────────────
# CONFIGURACIÓN — edita de aquí para abajo
# ─────────────────────────────────────────────────────────────────────────────

MARCA      = "LYM Villeda"
MARCA_LARGA = "Logística y Marketing Villeda"
LEMA       = "Más visibilidad, más clientes, más ventas"
CIUDAD     = "Tepic, Nayarit"
TELEFONO   = "311 495 7286"
CORREO     = "lmvdmex@gmail.com"
REDES      = "@lymvilleda"

MONEDA     = "MXN"
VIGENCIA   = 30                       # días naturales de vigencia
MOSTRAR_IVA = False                   # ponlo en True si facturas con IVA
IVA_TEXTO  = "Los precios no incluyen IVA. Se agrega solo si se requiere factura."
FECHA      = datetime.date.today().strftime("%d/%m/%Y")

SALIDA = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                      "Presupuestos-Paquetes-LYM-Villeda.pdf")

# ── Los tres planes ──────────────────────────────────────────────────────────
PLANES = [
    {
        "nombre": "Esencial",
        "precio": 4900,
        "destacado": False,
        "lema": "Presencia constante y bien hecha, para el negocio que necesita "
                "dejar de improvisar y verse profesional cada semana.",
        "ideal": "Negocios que van empezando en redes o que publican sin un plan.",
        "incluye": [
            "12 publicaciones al mes",
            "Historias 4 días por semana",
            "Diseño con identidad propia",
            "Textos con llamada a la acción",
            "Calendario mensual por adelantado",
            "Reporte mensual básico",
        ],
    },
    {
        "nombre": "Crecimiento",
        "precio": 7900,
        "destacado": True,
        "lema": "El plan que mueve la aguja: video, historias diarias y "
                "seguimiento de cada mensaje que llega.",
        "ideal": "Negocios que ya venden y quieren que las redes les traigan "
                 "clientes nuevos de forma constante.",
        "incluye": [
            "20 publicaciones + reels al mes",
            "Historias diarias",
            "4 reels producidos al mes",
            "Identidad visual completa",
            "Gestión de mensajes y comentarios",
            "Google Business · de regalo",
            "Reputación online en Google · de regalo",
            "Reporte mensual completo",
        ],
    },
    {
        "nombre": "Completo",
        "precio": 14900,
        "destacado": False,
        "lema": "Operación 360°: contenido, publicidad pagada, sitio web y "
                "seguimiento de leads hasta la venta.",
        "ideal": "Negocios que quieren escalar y competir por el primer lugar "
                 "de su giro en la ciudad.",
        "incluye": [
            "Todo el plan Crecimiento",
            "Publicidad en Meta y TikTok Ads",
            "$2,000 en pauta incluidos",
            "Sitio web incluido",
            "Gestión de reputación en Google · de regalo",
            "Seguimiento de leads y ventas",
            "WhatsApp directo prioritario",
        ],
    },
]

# ── Tabla comparativa de la portada ──────────────────────────────────────────
COMPARATIVA = [
    # concepto,                        Esencial,    Crecimiento,  Completo
    ("Publicaciones al mes",           "12",        "20 + reels", "20 + reels"),
    ("Historias",                      "4 días/sem", "Diarias",   "Diarias"),
    ("Reels producidos al mes",        "—",         "4",          "4"),
    ("Identidad visual",               "Propia",    "Completa",   "Completa"),
    ("Calendario mensual por adelantado", "Sí",     "Sí",         "Sí"),
    ("Gestión de mensajes y comentarios", "—",      "Sí",         "Sí"),
    ("Google Business y reputación",   "—",         "De regalo",  "De regalo"),
    ("Publicidad Meta y TikTok Ads",   "—",         "—",          "Sí"),
    ("Pauta incluida",                 "—",         "—",          "$2,000"),
    ("Sitio web",                      "—",         "—",          "Incluido"),
    ("Seguimiento de leads y ventas",  "—",         "—",          "Sí"),
    ("Reporte mensual",                "Básico",    "Completo",   "Completo"),
]

# ── Promociones vigentes ─────────────────────────────────────────────────────
PROMOCIONES = [
    ("Arranque sin costo",
     "Al firmar este mes, el setup y el onboarding — valor $1,500 — van "
     "totalmente gratis."),
    ("Sexto mes a mitad de precio",
     "Contrata 5 meses seguidos y el sexto te sale al 50%. Premiamos la "
     "consistencia, que es lo que hace crecer una cuenta."),
    ("Te recomiendan, ganas",
     "Por cada cliente que nos refieras y firme, recibes un mes con 25% de "
     "descuento."),
    ("3 empresas o más: 20% de descuento",
     "Cada empresa se maneja con su propio paquete — puedes elegir uno distinto "
     "para cada una. Al gestionar 3 o más, se aplica 20% sobre el total."),
]

# ── Servicios adicionales, se cotizan según alcance ──────────────────────────
ADICIONALES = [
    ("Sitio web propio",
     "Diseño, contenido y publicación, como el de isoval.com.mx"),
    ("Identidad de marca completa",
     "Logotipo, paleta, tipografías y aplicación en todas las piezas"),
    ("Campañas de publicidad",
     "Meta Ads, Google Ads y TikTok Ads con segmentación local"),
    ("Producción de video y fotografía",
     "Sesiones de producto, obra o presentador frente a cámara"),
    ("Asistente de WhatsApp con inteligencia artificial",
     "Contesta precios, horarios y ubicación solo, y avisa cuando conviene "
     "que entre una persona"),
    ("Email marketing y automatización",
     "Campañas, secuencias y respuestas automáticas"),
    ("Menú QR o digital y plataforma de satisfacción al cliente",
     "Para restaurantes y negocios con atención en piso"),
    ("Gestión bilingüe",
     "Contenido y atención en español e inglés para clientes en Estados Unidos"),
]

# ── Cómo trabajamos ──────────────────────────────────────────────────────────
PROCESO = [
    "<b>Diagnóstico.</b> Revisamos tu cuenta, la de tu competencia y tu "
    "mercado local para encontrar la oportunidad que nadie está aprovechando.",
    "<b>Estrategia y pilares de contenido.</b> Definimos los temas de tu marca "
    "y el tono de voz, para que cada publicación tenga un propósito.",
    "<b>Calendario mensual por adelantado.</b> Antes de que arranque el mes "
    "recibes el documento con qué día, qué formato, qué tema y qué objetivo. "
    "Lo apruebas y trabajamos sin sorpresas.",
    "<b>Producción y publicación.</b> Grabamos, diseñamos y editamos; "
    "publicamos en los mejores horarios y respondemos mensajes y comentarios.",
    "<b>Medición y reporte.</b> Al cierre del mes entregamos métricas reales "
    "y el aprendizaje para el mes siguiente.",
]

# ── Condiciones comerciales ──────────────────────────────────────────────────
CONDICIONES = [
    "Los planes son mensuales y se pagan por adelantado al inicio de cada mes.",
    "Las redes necesitan consistencia para dar resultados: trabajamos en "
    "ciclos de varios meses. Los primeros resultados se ven a los 30 días.",
    "El calendario de contenido se envía antes de que arranque el mes para tu "
    "aprobación; los cambios se hacen sobre ese documento, no sobre la marcha.",
    "La pauta publicitaria del plan Completo incluye $2,000 al mes. Si quieres "
    "invertir más, ese monto se paga directo a la plataforma.",
    "Los precios pueden ajustarse según el alcance y los objetivos de cada "
    "negocio. La cotización personalizada no tiene costo.",
    "Vigencia de esta cotización: %d días naturales a partir del %s." % (VIGENCIA, FECHA),
]

PORTAFOLIO = (
    "Marcas que ya trabajan con nosotros: <b>LAB A+A</b> — arquitectura y "
    "peritajes · <b>Isoval</b> — arquitectura y construcción, con sitio web "
    "propio · <b>D Fit House</b> — comida alta en proteína · "
    "<b>Brite Choice Dental</b> — clínica dental en California, gestión "
    "bilingüe · <b>Yoguyum</b> — frozen yogurt en Tepic."
)

# ─────────────────────────────────────────────────────────────────────────────
# De aquí para abajo es el armado del documento
# ─────────────────────────────────────────────────────────────────────────────

INK   = colors.HexColor("#1A1613")
MUTED = colors.HexColor("#6E675C")
GOLD  = colors.HexColor("#A8842F")
SOFT  = colors.HexColor("#F6EFDF")
CREAM = colors.HexColor("#FBF8F1")
LINE  = colors.HexColor("#E3DACA")
GREEN = colors.HexColor("#4A7A3F")
WHITE = colors.white

SERIF = "Times-Bold"
SANS  = "Helvetica"

M  = 1.9 * cm
CW = letter[0] - 2 * M


def money(n):
    return "$ {:,.0f}".format(n)


def p(text, size=9, leading=None, color=INK, align=TA_LEFT, font=SANS,
      space_after=0, space_before=0):
    style = ParagraphStyle(
        "s%d" % id(text), fontName=font, fontSize=size,
        leading=leading or size * 1.45, textColor=color, alignment=align,
        spaceAfter=space_after, spaceBefore=space_before,
    )
    return Paragraph(text, style)


def bullets(items, size=8.5, color=INK, bullet_color=GOLD):
    style = ParagraphStyle(
        "bul%s" % size, fontName=SANS, fontSize=size, leading=size * 1.45,
        textColor=color, leftIndent=11, bulletIndent=1,
        bulletColor=bullet_color, spaceAfter=size * 0.32,
    )
    return [Paragraph(i, style, bulletText="•") for i in items]


def titulo(text, size=16, space_before=0, color=INK):
    return p(text, size=size, leading=size * 1.18, font=SERIF, color=color,
             space_before=space_before, space_after=4)


def kicker(text):
    return p(text.upper(), size=7.5, leading=11, color=GOLD, font="Helvetica-Bold",
             space_after=3)


def chrome(canvas, doc):
    """Encabezado y pie de cada página."""
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
                           "PLANES DE CRECIMIENTO DIGITAL  ·  %s" % FECHA)
    canvas.line(M, 1.65 * cm, w - M, 1.65 * cm)
    canvas.setFont(SANS, 7)
    canvas.drawString(M, 1.32 * cm,
                      "%s  ·  Precios en %s  ·  Vigencia de %d días"
                      % (CIUDAD, MONEDA, VIGENCIA))
    canvas.drawRightString(w - M, 1.32 * cm, str(doc.page))
    canvas.restoreState()


def portada():
    story = [Spacer(1, 0.4 * cm), kicker("Propuesta económica")]
    story.append(p("Planes de<br/>crecimiento digital", size=30, leading=33,
                   font=SERIF))
    story.append(Spacer(1, 6))
    story.append(p("Estrategia, contenido y redes que convierten seguidores en "
                   "clientes — con un plan claro mes a mes.", size=10.5,
                   leading=16, color=MUTED))
    story.append(Spacer(1, 14))

    datos = Table(
        [[p("CLIENTE", 7, color=MUTED, font="Helvetica-Bold"),
          p("FECHA", 7, color=MUTED, font="Helvetica-Bold"),
          p("VIGENCIA", 7, color=MUTED, font="Helvetica-Bold"),
          p("MONEDA", 7, color=MUTED, font="Helvetica-Bold")],
         [p("_______________________", 9.5),
          p(FECHA, 9.5), p("%d días" % VIGENCIA, 9.5), p(MONEDA, 9.5)]],
        colWidths=[CW * 0.40, CW * 0.20, CW * 0.20, CW * 0.20])
    datos.setStyle(TableStyle([
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("BACKGROUND", (0, 0), (-1, -1), SOFT),
        ("LINEBELOW", (0, 0), (-1, 0), 0.5, LINE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story += [datos, Spacer(1, 18)]

    story.append(kicker("Comparativa"))
    story.append(titulo("Tres formas de trabajar juntos", 16))
    story.append(Spacer(1, 8))
    story.append(tabla_comparativa())
    story.append(Spacer(1, 6))
    story.append(p("Los precios pueden ajustarse según el alcance y los "
                   "objetivos de cada negocio. La cotización personalizada no "
                   "tiene costo.", 7.5, color=MUTED))
    story.append(Spacer(1, 10))
    story.append(p(PORTAFOLIO, 8, leading=13, color=MUTED))
    return story


def tabla_comparativa(incluir_ideal=False):
    """La rejilla de planes. Con incluir_ideal agrega el renglón de a quién le
    sirve cada uno — útil cuando la tabla va sola, sin las tarjetas."""
    encabezados = [p("", 8)]
    for plan in PLANES:
        etiqueta = plan["nombre"].upper()
        if plan["destacado"]:
            etiqueta += "  ★"
        encabezados.append(p(etiqueta, 8.5, color=WHITE, font="Helvetica-Bold",
                             align=TA_CENTER))
    filas = [encabezados]
    for concepto, a, b, c in COMPARATIVA:
        fila = [p(concepto, 8.5)]
        for valor in (a, b, c):
            color = GREEN if valor == "De regalo" else MUTED
            fila.append(p(valor, 8.5, align=TA_CENTER, color=color))
        filas.append(fila)
    if incluir_ideal:
        filas.append([p("Ideal para", 8.5)] +
                     [p(x["ideal"], 8, align=TA_CENTER, color=MUTED,
                        leading=11) for x in PLANES])
    filas.append([p("Inversión mensual", 9, font="Helvetica-Bold")] +
                 [p(money(x["precio"]), 12, align=TA_CENTER, font=SERIF,
                    color=INK) for x in PLANES])

    tabla = Table(filas, colWidths=[CW * 0.34, CW * 0.22, CW * 0.22, CW * 0.22],
                  repeatRows=1)
    tabla.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), INK),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -2), [WHITE, CREAM]),
        ("BACKGROUND", (0, -1), (-1, -1), SOFT),
        ("LINEABOVE", (0, -1), (-1, -1), 0.9, GOLD),
        ("GRID", (0, 1), (-1, -1), 0.4, LINE),
        ("BOX", (2, 1), (2, -1), 0.9, GOLD),
    ]))
    return tabla


def tarjeta(plan):
    destacado = plan["destacado"]
    etiqueta = "RECOMENDADO" if destacado else ""
    encabezado = Table(
        [[p(plan["nombre"], 15, color=WHITE, font=SERIF),
          p("%s <font size=7 face='Helvetica'>%s / mes</font>"
            % (money(plan["precio"]), MONEDA),
            15, color=WHITE, font=SERIF, align=TA_RIGHT)]],
        colWidths=[CW * 0.55, CW * 0.45])
    encabezado.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), INK),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))

    bloques = []
    if etiqueta:
        banda = Table([[p("★  %s" % etiqueta, 7.5, color=WHITE,
                          font="Helvetica-Bold")]], colWidths=[CW])
        banda.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), GOLD),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ]))
        bloques.append(banda)
    bloques.append(encabezado)

    mitad = (len(plan["incluye"]) + 1) // 2
    cuerpo = Table(
        [[p(plan["lema"], 9.5, leading=14, color=MUTED), ""],
         [bullets(plan["incluye"][:mitad]), bullets(plan["incluye"][mitad:])]],
        colWidths=[CW * 0.50, CW * 0.50])
    cuerpo.setStyle(TableStyle([
        ("SPAN", (0, 0), (1, 0)),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ("TOPPADDING", (0, 0), (-1, 0), 8),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 6),
        ("BOTTOMPADDING", (0, 1), (-1, 1), 6),
        ("BACKGROUND", (0, 0), (-1, -1), WHITE),
        ("LINEBEFORE", (1, 1), (1, 1), 0.5, LINE),
    ]))
    bloques.append(cuerpo)

    pie = Table([[p("<font color='#6E675C' size=7>IDEAL PARA</font><br/>%s"
                    % plan["ideal"], 8.5, leading=12)]], colWidths=[CW])
    pie.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), CREAM),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LINEABOVE", (0, 0), (-1, 0), 0.5, LINE),
    ]))
    bloques += [pie, Spacer(1, 10)]
    return KeepTogether(bloques)


def bloque_promociones():
    story = [kicker("Vigente ahora"), titulo("Promociones", 16)]
    story.append(p("Aplican al contratar cualquiera de los tres planes.", 9.5,
                   leading=14, color=MUTED, space_after=8))
    data = []
    for nombre, detalle in PROMOCIONES:
        data.append([p("<b>%s</b>" % nombre, 9.5, color=GOLD),
                     p(detalle, 8.5, leading=12.5, color=INK)])
    t = Table(data, colWidths=[CW * 0.32, CW * 0.68])
    t.setStyle(TableStyle([
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [SOFT, CREAM]),
        ("GRID", (0, 0), (-1, -1), 0.4, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
    ]))
    story.append(t)
    return [KeepTogether(story)]


def bloque_adicionales():
    story = [kicker("Fuera de plan"), titulo("Servicios adicionales", 16)]
    story.append(p("Se pueden sumar a cualquier plan o contratarse por "
                   "separado. Cada uno se cotiza según el alcance del proyecto.",
                   9.5, leading=14, color=MUTED, space_after=8))
    data = [[p("SERVICIO", 8.5, color=WHITE, font="Helvetica-Bold"),
             p("QUÉ INCLUYE", 8.5, color=WHITE, font="Helvetica-Bold"),
             p("PRECIO", 8.5, color=WHITE, font="Helvetica-Bold",
               align=TA_RIGHT)]]
    for nombre, detalle in ADICIONALES:
        data.append([p("<b>%s</b>" % nombre, 9, leading=12),
                     p(detalle, 8.5, leading=12, color=MUTED),
                     p("Según<br/>alcance", 8, align=TA_RIGHT, color=GOLD,
                       leading=10)])
    t = Table(data, colWidths=[CW * 0.34, CW * 0.51, CW * 0.15], repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), INK),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, CREAM]),
        ("GRID", (0, 1), (-1, -1), 0.4, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 9),
        ("RIGHTPADDING", (0, 0), (-1, -1), 9),
    ]))
    story.append(t)
    return [KeepTogether(story)]


def cierre():
    metodo = [kicker("Cómo trabajamos"), titulo("El método, mes con mes", 16),
              Spacer(1, 6)]
    metodo += bullets(PROCESO, size=9)

    condiciones = [kicker("Letras claras"), titulo("Condiciones", 16),
                   Spacer(1, 6)]
    condiciones += bullets(CONDICIONES, size=9)
    if MOSTRAR_IVA:
        condiciones.append(Spacer(1, 4))
        condiciones.append(p(IVA_TEXTO, 8.5, color=MUTED))

    story = [KeepTogether(metodo), Spacer(1, 18),
             KeepTogether(condiciones), Spacer(1, 24)]

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
    cierre_visual = [firma, Spacer(1, 18)]

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
    cierre_visual.append(contacto)
    cierre_visual.append(Spacer(1, 8))
    cierre_visual.append(p('"%s"' % LEMA, 9, color=GOLD, align=TA_CENTER,
                           font=SERIF))
    story.append(KeepTogether(cierre_visual))
    return story


def construir():
    doc = SimpleDocTemplate(
        SALIDA, pagesize=letter,
        leftMargin=M, rightMargin=M, topMargin=2.4 * cm, bottomMargin=2.2 * cm,
        title="%s — Planes de crecimiento digital" % MARCA,
        author=MARCA_LARGA, subject="Propuesta económica")

    story = portada()
    story.append(PageBreak())

    story.append(kicker("Detalle"))
    story.append(titulo("Qué incluye cada plan", 16))
    story.append(Spacer(1, 12))
    for plan in PLANES:
        story.append(tarjeta(plan))

    story += bloque_promociones()
    story.append(Spacer(1, 20))
    story += bloque_adicionales()
    story.append(Spacer(1, 20))
    story += cierre()

    doc.build(story, onFirstPage=chrome, onLaterPages=chrome)
    print("PDF generado: %s" % SALIDA)


if __name__ == "__main__":
    construir()
