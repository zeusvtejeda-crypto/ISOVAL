#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Genera el PDF de presupuestos de los paquetes de servicios digitales.

    pip install reportlab
    python3 generar_presupuestos.py

Todo lo editable vive en el bloque CONFIGURACIÓN de abajo: nombre del estudio,
datos de contacto, precios, plazos y condiciones. Cambia los números, vuelve a
correr el script y el PDF se regenera.
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

ESTUDIO   = "Estudio Digital"                  # ← tu nombre comercial
CIUDAD    = "Tepic, Nayarit"
CONTACTO  = "311 000 0000  ·  hola@tudominio.com  ·  tudominio.com"

MONEDA    = "MXN"
IVA_TEXTO = "Los precios no incluyen IVA (16%). Se agrega solo si se requiere factura."
VIGENCIA  = 30                                 # días naturales de vigencia
FECHA     = datetime.date.today().strftime("%d/%m/%Y")

SALIDA    = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                         "Presupuestos-Paquetes-Servicios-Digitales.pdf")

# ── Paquetes (combos con descuento) ──────────────────────────────────────────
PAQUETES = [
    {
        "nombre": "Paquete Arranque",
        "lema": "Para el negocio que todavía no existe en internet y necesita "
                "que lo encuentren y le escriban.",
        "precio": 10900,
        "mensualidad": 600,
        "plazo": "10 días hábiles",
        "ideal": "Negocio nuevo, taller o fábrica que hoy solo vende de boca en boca.",
        "incluye": [
            "Sitio web de una sola página (one-page), responsivo",
            "Hasta 6 secciones: inicio, productos o servicios, "
            "por qué nosotros, medidas o catálogo, contacto",
            "Botón de WhatsApp con mensaje precargado",
            "Formulario de contacto que llega a tu correo",
            "Alta y configuración de la ficha de Google Business",
            "Optimización de imágenes y velocidad de carga",
        ],
        "entregables": [
            "Sitio publicado y funcionando en tu dominio",
            "Ficha de Google Business verificada",
            "Manual de una hoja para cambiar textos y fotos",
            "Archivos fuente del sitio",
        ],
        "ahorro": "Suma por separado: $12,000 · ahorras $1,100",
    },
    {
        "nombre": "Paquete Crecimiento",
        "lema": "Sitio web, imagen de marca y un asistente de WhatsApp con IA "
                "que contesta solo, a cualquier hora.",
        "precio": 19900,
        "mensualidad": 1800,
        "plazo": "15 días hábiles",
        "ideal": "Negocio que ya recibe mensajes y pierde clientes por no "
                 "contestar a tiempo.",
        "incluye": [
            "Todo lo del Paquete Arranque",
            "Asistente de WhatsApp con IA: responde precios, horarios, "
            "medidas y ubicación con la información real de tu negocio",
            "Alta en la API oficial de Meta (WhatsApp Cloud API)",
            "Perfil del negocio redactado y afinado con pruebas reales",
            "Pase a persona: el asistente avisa cuando conviene que "
            "conteste alguien del equipo",
            "Identidad de marca básica: logotipo, versión horizontal, "
            "isotipo, paleta de color y tipografías",
        ],
        "entregables": [
            "Asistente en línea sobre tu número de WhatsApp",
            "Perfil del negocio editable (precios, horarios, promociones)",
            "Kit de marca en SVG y PNG, fondo claro y oscuro",
            "Capacitación de 1 hora para el equipo",
        ],
        "ahorro": "Suma por separado: $24,500 · ahorras $4,600",
    },
    {
        "nombre": "Paquete Integral",
        "lema": "Presencia completa: sitio a la medida, asistente con IA, "
                "identidad y contenido publicándose cada semana.",
        "precio": 31500,
        "mensualidad": 5900,
        "plazo": "25 días hábiles",
        "ideal": "Empresa establecida que compite por posicionamiento y quiere "
                 "todo bajo un mismo estilo.",
        "incluye": [
            "Todo lo del Paquete Crecimiento",
            "Sitio web multi-sección (hasta 10 secciones) con galería de "
            "proyectos, preguntas frecuentes y proceso de trabajo",
            "SEO local: metadatos, datos estructurados y mapa del sitio",
            "Primer mes de contenido: 12 publicaciones con diseño y textos",
            "Calendario de contenido en PDF, listo para revisar y aprobar",
            "Sesión de fotografía de producto u obra (hasta 25 fotos editadas)",
        ],
        "entregables": [
            "Sitio corporativo publicado y indexado en Google",
            "Calendario del primer mes con las 12 piezas aprobadas",
            "Banco de fotos editadas, en alta y en web",
            "Reporte de arranque con métricas base para comparar",
        ],
        "ahorro": "Suma por separado: $37,800 · ahorras $6,300",
    },
]

# ── Tabla comparativa de la portada ──────────────────────────────────────────
COMPARATIVA = [
    # concepto,                          Arranque, Crecimiento, Integral
    ("Sitio web",                        "One-page", "One-page", "Multi-sección"),
    ("Asistente de WhatsApp con IA",     "—", "Sí", "Sí"),
    ("Identidad de marca",               "—", "Básica", "Básica"),
    ("Contenido para redes",             "—", "—", "12 piezas"),
    ("Fotografía de producto",           "—", "—", "25 fotos"),
    ("SEO local y Google Business",      "Ficha", "Ficha", "Ficha + SEO"),
    ("Plazo de entrega",                 "10 días", "15 días", "25 días"),
]

# ── Servicios sueltos (a la carta) ───────────────────────────────────────────
SERVICIOS = [
    ("Sitio web de una página (one-page)",                        9500),
    ("Sitio web multi-sección (hasta 10 secciones)",             18000),
    ("Sección o página adicional",                                1800),
    ("Asistente de WhatsApp con IA — implementación",             8500),
    ("Negocio adicional dentro del mismo asistente",              3200),
    ("Identidad de marca básica (logotipo + kit de archivos)",    6500),
    ("Calendario de contenido: 12 publicaciones",                 4800),
    ("Sesión de fotografía de producto u obra (25 fotos)",        3500),
    ("Alta y configuración de Google Business",                   2500),
    ("Correo corporativo con tu dominio (hasta 5 cuentas)",       1900),
    ("Compra de dominio, DNS y certificado SSL",                  1200),
]

# ── Mensualidades ────────────────────────────────────────────────────────────
MENSUALIDADES = [
    ("Hosting, respaldos y una actualización al mes",              600),
    ("Operación del asistente de WhatsApp (ajustes y monitoreo)", 1200),
    ("Contenido: 12 publicaciones al mes con diseño y textos",    4800),
    ("Soporte prioritario (respuesta en menos de 24 horas)",       900),
    ("Reporte mensual de métricas y recomendaciones",              700),
]

# ── Costos de terceros (no incluidos) ────────────────────────────────────────
TERCEROS = [
    ("Dominio .com o .mx",
     "$250 a $700 al año, se paga al registrador"),
    ("Hosting del sitio",
     "Plan gratuito suficiente para empezar; plan de paga desde $400 al mes"),
    ("WhatsApp Cloud API (Meta)",
     "Meta da un volumen mensual sin costo para conversaciones que inicia el "
     "cliente; las plantillas de marketing se cobran por mensaje"),
    ("Motor de IA del asistente",
     "Con el plan gratuito alcanza para un negocio chico; el modelo de paga "
     "se cobra por uso, aproximadamente $150 a $400 al mes"),
    ("Pauta publicitaria",
     "Se define contigo y se paga directo a la plataforma"),
]

# ── Condiciones comerciales ──────────────────────────────────────────────────
CONDICIONES = [
    "Anticipo del 50% para iniciar y 50% contra entrega. Las mensualidades se "
    "cobran por adelantado cada mes.",
    "Los plazos corren en días hábiles a partir del anticipo y de recibir la "
    "información del negocio: textos, fotos, logotipo y accesos.",
    "Cada entregable incluye dos rondas de ajustes. Las rondas adicionales o "
    "los cambios pedidos después de aprobado el diseño se cotizan aparte.",
    "Al liquidar, el sitio, los archivos fuente y las cuentas quedan a nombre "
    "y en propiedad del cliente.",
    "No incluye: los costos de terceros listados arriba, pauta publicitaria, "
    "producción de video ni licencias de fotografía de banco.",
    "Vigencia de esta cotización: %d días naturales a partir del %s." % (VIGENCIA, FECHA),
]

SIGUIENTE_PASO = [
    "Me dices qué paquete quieres o qué servicios sueltos te sirven.",
    "Te mando el contrato con alcance, plazos y precio cerrado.",
    "Con el anticipo del 50% arranca el reloj de entrega.",
    "Te comparto avances para revisión antes de publicar cualquier cosa.",
]

REFERENCIAS = (
    "Trabajos de referencia: <b>isoval.com.mx</b> — sitio multi-sección para "
    "despacho de arquitectura y construcción · <b>Bases Box Tepic</b> — sitio, "
    "identidad y calendario de contenido para fábrica local · "
    "<b>asistente de WhatsApp multi-negocio</b> — un solo sistema atendiendo "
    "cuatro negocios a la vez."
)

# ─────────────────────────────────────────────────────────────────────────────
# De aquí para abajo es el armado del documento
# ─────────────────────────────────────────────────────────────────────────────

INK    = colors.HexColor("#17171A")
MUTED  = colors.HexColor("#6E6E75")
ACCENT = colors.HexColor("#D64518")
LINE   = colors.HexColor("#DCD8D0")
PAPER  = colors.HexColor("#F6F4EF")
WHITE  = colors.white

M  = 1.9 * cm
CW = letter[0] - 2 * M


def money(n):
    return "$ {:,.0f}".format(n)


def p(text, size=9, leading=None, color=INK, align=TA_LEFT, font="Helvetica",
      space_after=0, space_before=0):
    style = ParagraphStyle(
        "s%d" % id(text), fontName=font, fontSize=size,
        leading=leading or size * 1.45, textColor=color, alignment=align,
        spaceAfter=space_after, spaceBefore=space_before,
    )
    return Paragraph(text, style)


def bullets(items, size=8.5, color=INK):
    """Lista con sangría francesa: la segunda línea alinea con el texto."""
    style = ParagraphStyle(
        "bul%d" % size, fontName="Helvetica", fontSize=size,
        leading=size * 1.45, textColor=color,
        leftIndent=11, bulletIndent=1, spaceAfter=size * 0.5,
    )
    return [Paragraph(i, style, bulletText="\u2022") for i in items]


def titulo(text, size=15, space_before=0):
    return p(text, size=size, leading=size * 1.2, font="Helvetica-Bold",
             space_before=space_before, space_after=4)


def kicker(text):
    return p(text.upper(), size=7.5, leading=11, color=ACCENT,
             font="Helvetica-Bold", space_after=3)


def regla(space_after=10):
    t = Table([[""]], colWidths=[CW], rowHeights=[0.6])
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), LINE)]))
    return KeepTogether([t, Spacer(1, space_after)])


def chrome(canvas, doc):
    """Encabezado y pie de cada página."""
    canvas.saveState()
    w, h = letter
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.6)
    canvas.line(M, h - 1.55 * cm, w - M, h - 1.55 * cm)
    canvas.setFont("Helvetica-Bold", 7.5)
    canvas.setFillColor(INK)
    canvas.drawString(M, h - 1.32 * cm, ESTUDIO.upper())
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(MUTED)
    canvas.drawRightString(w - M, h - 1.32 * cm,
                           "PRESUPUESTO DE PAQUETES  ·  %s" % FECHA)
    canvas.line(M, 1.65 * cm, w - M, 1.65 * cm)
    canvas.setFont("Helvetica", 7)
    canvas.drawString(M, 1.32 * cm,
                      "Precios en %s, más IVA  ·  Vigencia de %d días" % (MONEDA, VIGENCIA))
    canvas.drawRightString(w - M, 1.32 * cm, str(doc.page))
    canvas.restoreState()


def portada():
    story = [Spacer(1, 0.5 * cm), kicker("Propuesta económica")]
    story.append(p("Paquetes de<br/>servicios digitales", size=30, leading=33,
                   font="Helvetica-Bold"))
    story.append(Spacer(1, 6))
    story.append(p("Sitio web, asistente de WhatsApp con inteligencia "
                   "artificial, identidad de marca y contenido — para negocios "
                   "de %s." % CIUDAD, size=10.5, leading=16, color=MUTED))
    story.append(Spacer(1, 14))

    datos = Table(
        [[p("CLIENTE", 7, color=MUTED, font="Helvetica-Bold"),
          p("FECHA", 7, color=MUTED, font="Helvetica-Bold"),
          p("VIGENCIA", 7, color=MUTED, font="Helvetica-Bold"),
          p("MONEDA", 7, color=MUTED, font="Helvetica-Bold")],
         [p("_______________________", 9.5),
          p(FECHA, 9.5), p("%d días" % VIGENCIA, 9.5),
          p("%s + IVA" % MONEDA, 9.5)]],
        colWidths=[CW * 0.40, CW * 0.20, CW * 0.20, CW * 0.20])
    datos.setStyle(TableStyle([
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("BACKGROUND", (0, 0), (-1, -1), PAPER),
        ("LINEBELOW", (0, 0), (-1, 0), 0.5, LINE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story += [datos, Spacer(1, 20)]

    story.append(kicker("Comparativa rápida"))
    story.append(titulo("Tres formas de empezar", 15))
    story.append(Spacer(1, 8))

    filas = [[p("", 8),
              p("ARRANQUE", 8.5, color=WHITE, font="Helvetica-Bold", align=TA_CENTER),
              p("CRECIMIENTO", 8.5, color=WHITE, font="Helvetica-Bold", align=TA_CENTER),
              p("INTEGRAL", 8.5, color=WHITE, font="Helvetica-Bold", align=TA_CENTER)]]
    for concepto, a, b, c in COMPARATIVA:
        filas.append([p(concepto, 8.5),
                      p(a, 8.5, align=TA_CENTER, color=MUTED),
                      p(b, 8.5, align=TA_CENTER, color=MUTED),
                      p(c, 8.5, align=TA_CENTER, color=MUTED)])
    filas.append([p("Inversión inicial", 9, font="Helvetica-Bold")] +
                 [p(money(x["precio"]), 10.5, align=TA_CENTER,
                    font="Helvetica-Bold", color=ACCENT) for x in PAQUETES])
    filas.append([p("Mensualidad sugerida", 8.5)] +
                 [p("%s / mes" % money(x["mensualidad"]), 8.5, align=TA_CENTER)
                  for x in PAQUETES])

    tabla = Table(filas, colWidths=[CW * 0.34, CW * 0.22, CW * 0.22, CW * 0.22],
                  repeatRows=1)
    tabla.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), INK),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -3), [WHITE, PAPER]),
        ("BACKGROUND", (0, -2), (-1, -1), colors.HexColor("#FBF1EC")),
        ("LINEABOVE", (0, -2), (-1, -2), 0.8, ACCENT),
        ("GRID", (0, 1), (-1, -1), 0.4, LINE),
        ("LINEAFTER", (0, 0), (0, 0), 0.4, INK),
    ]))
    story += [tabla, Spacer(1, 14)]
    story.append(p(REFERENCIAS, 8, leading=13, color=MUTED))
    return story


def tarjeta(paq):
    encabezado = Table(
        [[p(paq["nombre"], 13.5, color=WHITE, font="Helvetica-Bold"),
          p("%s <font size=7>%s + IVA</font>" % (money(paq["precio"]), MONEDA),
            13.5, color=WHITE, font="Helvetica-Bold", align=TA_RIGHT)]],
        colWidths=[CW * 0.58, CW * 0.42])
    encabezado.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), INK),
        ("TOPPADDING", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))

    cuerpo = Table(
        [[p(paq["lema"], 9.5, leading=14, color=MUTED), ""],
         [p("QUÉ INCLUYE", 7.5, color=ACCENT, font="Helvetica-Bold"),
          p("QUÉ RECIBES", 7.5, color=ACCENT, font="Helvetica-Bold")],
         [bullets(paq["incluye"]), bullets(paq["entregables"])]],
        colWidths=[CW * 0.58, CW * 0.42])
    cuerpo.setStyle(TableStyle([
        ("SPAN", (0, 0), (1, 0)),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ("TOPPADDING", (0, 0), (-1, 0), 10),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 8),
        ("TOPPADDING", (0, 1), (-1, 1), 2),
        ("BOTTOMPADDING", (0, 2), (-1, 2), 10),
        ("LINEBEFORE", (1, 1), (1, 2), 0.5, LINE),
        ("BACKGROUND", (0, 0), (-1, -1), WHITE),
    ]))

    pie = Table(
        [[p("<font color='#6E6E75' size=7>PLAZO</font><br/><b>%s</b>" % paq["plazo"], 8.5, leading=12),
          p("<font color='#6E6E75' size=7>MENSUALIDAD</font><br/><b>%s / mes</b>" % money(paq["mensualidad"]), 8.5, leading=12),
          p("<font color='#6E6E75' size=7>IDEAL PARA</font><br/>%s" % paq["ideal"], 8.5, leading=12)]],
        colWidths=[CW * 0.20, CW * 0.24, CW * 0.56])
    pie.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), PAPER),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LINEBEFORE", (1, 0), (2, 0), 0.5, LINE),
        ("LINEABOVE", (0, 0), (-1, 0), 0.5, LINE),
    ]))

    return KeepTogether([encabezado, cuerpo, pie, Spacer(1, 5),
                         p(paq["ahorro"], 7.5, color=MUTED, align=TA_RIGHT),
                         Spacer(1, 12)])


def tabla_precios(filas, titulo_col, sufijo=""):
    data = [[p(titulo_col, 8.5, color=WHITE, font="Helvetica-Bold"),
             p("PRECIO", 8.5, color=WHITE, font="Helvetica-Bold", align=TA_RIGHT)]]
    for concepto, precio in filas:
        data.append([p(concepto, 9),
                     p(money(precio) + sufijo, 9.5, align=TA_RIGHT,
                       font="Helvetica-Bold")])
    t = Table(data, colWidths=[CW * 0.72, CW * 0.28], repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), INK),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, PAPER]),
        ("GRID", (0, 1), (-1, -1), 0.4, LINE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 9),
        ("RIGHTPADDING", (0, 0), (-1, -1), 9),
    ]))
    return t


def pagina_carta():
    story = [kicker("A la carta"), titulo("Servicios por separado", 15)]
    story.append(p("Si no quieres un paquete completo, cada pieza se puede "
                   "contratar sola. Estos son precios de una sola vez.",
                   9.5, leading=14, color=MUTED, space_after=10))
    story.append(tabla_precios(SERVICIOS, "CONCEPTO"))
    story.append(Spacer(1, 20))

    story.append(kicker("Cada mes"))
    story.append(titulo("Mensualidades", 15))
    story.append(p("Se contratan sueltas o combinadas. Sin plazo forzoso: se "
                   "avisa con 30 días para dar de baja.", 9.5, leading=14,
                   color=MUTED, space_after=10))
    story.append(tabla_precios(MENSUALIDADES, "SERVICIO MENSUAL", " / mes"))
    story.append(Spacer(1, 18))
    story += bloque_terceros()
    return story


def bloque_terceros():
    story = [kicker("Transparencia"), titulo("Costos que no cobro yo", 15)]
    story.append(p("Estos servicios se pagan directo al proveedor y no van "
                   "incluidos en los precios de arriba. Los dejo por escrito "
                   "para que no haya sorpresas.", 9.5, leading=14, color=MUTED,
                   space_after=8))

    data = [[p("CONCEPTO", 8.5, color=WHITE, font="Helvetica-Bold"),
             p("COSTO APROXIMADO", 8.5, color=WHITE, font="Helvetica-Bold")]]
    for concepto, detalle in TERCEROS:
        data.append([p("<b>%s</b>" % concepto, 9),
                     p(detalle, 8.5, leading=12.5, color=MUTED)])
    t = Table(data, colWidths=[CW * 0.34, CW * 0.66], repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), INK),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, PAPER]),
        ("GRID", (0, 1), (-1, -1), 0.4, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("LEFTPADDING", (0, 0), (-1, -1), 9),
        ("RIGHTPADDING", (0, 0), (-1, -1), 9),
    ]))
    story.append(t)
    return story


def pagina_condiciones():
    story = [kicker("Letras claras"), titulo("Condiciones comerciales", 15)]
    story.append(Spacer(1, 8))
    story += bullets(CONDICIONES, size=9)
    story.append(Spacer(1, 4))
    story.append(p(IVA_TEXTO, 8.5, color=MUTED))
    story.append(Spacer(1, 22))

    story.append(kicker("Siguiente paso"))
    story.append(titulo("Cómo arrancamos", 15))
    story.append(Spacer(1, 6))
    story += bullets(SIGUIENTE_PASO, size=9)
    story.append(Spacer(1, 26))

    hueco = p("", 9)
    firma = Table(
        [[p("Paquete elegido", 7.5, color=MUTED, font="Helvetica-Bold"), hueco,
          p("Nombre y firma del cliente", 7.5, color=MUTED, font="Helvetica-Bold"),
          hueco,
          p("Fecha", 7.5, color=MUTED, font="Helvetica-Bold")],
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
    story += [firma, Spacer(1, 16)]
    story.append(p("%s  ·  %s<br/>%s" % (ESTUDIO, CIUDAD, CONTACTO), 8.5,
                   leading=13, color=MUTED))
    return story


def construir():
    doc = SimpleDocTemplate(
        SALIDA, pagesize=letter,
        leftMargin=M, rightMargin=M, topMargin=2.4 * cm, bottomMargin=2.2 * cm,
        title="Presupuestos — Paquetes de servicios digitales",
        author=ESTUDIO, subject="Propuesta económica")

    story = portada()
    story.append(PageBreak())

    story.append(kicker("Detalle"))
    story.append(titulo("Qué incluye cada paquete", 15))
    story.append(Spacer(1, 12))
    for paq in PAQUETES:
        story.append(tarjeta(paq))

    story += pagina_carta()
    story.append(PageBreak())
    story += pagina_condiciones()

    doc.build(story, onFirstPage=chrome, onLaterPages=chrome)
    print("PDF generado: %s" % SALIDA)


if __name__ == "__main__":
    construir()
