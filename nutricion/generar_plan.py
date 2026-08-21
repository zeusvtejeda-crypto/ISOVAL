# -*- coding: utf-8 -*-
"""
Generador del PDF "Sugerencia de plan de alimentación".

Toda la información de la clienta vive en el diccionario PERFIL y en las
listas de menú de abajo. Para hacer otro plan, copia este archivo y edita
solo esos datos: el diseño y los cálculos se rehacen solos.

Uso:  python3 nutricion/generar_plan.py
"""

import os
from datetime import date

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_RIGHT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate, CondPageBreak, Frame, KeepTogether, NextPageTemplate,
    PageBreak, PageTemplate, Paragraph, Spacer, Table, TableStyle,
)

# ───────────────────────────── Identidad visual ─────────────────────────────

VERDE      = colors.HexColor("#1F4D3D")   # primario
VERDE_MED  = colors.HexColor("#3C7A63")
VERDE_SUAVE= colors.HexColor("#E9F2ED")
ORO        = colors.HexColor("#C08A2E")   # acento
ORO_SUAVE  = colors.HexColor("#FBF2E1")
ROJO       = colors.HexColor("#A32219")   # alergias / prohibiciones
ROJO_SUAVE = colors.HexColor("#FBEBE9")
TEXTO      = colors.HexColor("#26302C")
GRIS       = colors.HexColor("#6E7A75")
LINEA      = colors.HexColor("#D9E2DD")
BLANCO     = colors.white

PAGINA = letter
ANCHO, ALTO = PAGINA
MARGEN = 17 * mm
ANCHO_UTIL = ANCHO - 2 * MARGEN

_FUENTES = "/usr/share/fonts/truetype/dejavu"
pdfmetrics.registerFont(TTFont("Sans", os.path.join(_FUENTES, "DejaVuSans.ttf")))
pdfmetrics.registerFont(TTFont("Sans-Bold", os.path.join(_FUENTES, "DejaVuSans-Bold.ttf")))
pdfmetrics.registerFontFamily("Sans", normal="Sans", bold="Sans-Bold",
                              italic="Sans", boldItalic="Sans-Bold")

def _st(nombre, **kw):
    base = dict(fontName="Sans", fontSize=9.5, leading=14, textColor=TEXTO)
    base.update(kw)
    return ParagraphStyle(nombre, **base)

S = {
    "titulo":     _st("titulo", fontName="Sans-Bold", fontSize=30, leading=34,
                      textColor=BLANCO),
    "subtitulo":  _st("subtitulo", fontSize=12.5, leading=18, textColor=BLANCO),
    "h1":         _st("h1", fontName="Sans-Bold", fontSize=16, leading=20,
                      textColor=VERDE, spaceAfter=2),
    "h2":         _st("h2", fontName="Sans-Bold", fontSize=11, leading=15,
                      textColor=VERDE_MED, spaceBefore=6, spaceAfter=3),
    "cuerpo":     _st("cuerpo", alignment=TA_JUSTIFY, spaceAfter=5),
    "vineta":     _st("vineta", leftIndent=9, bulletIndent=1, spaceAfter=3),
    "celda":      _st("celda", fontSize=8.6, leading=12),
    "celda_b":    _st("celda_b", fontName="Sans-Bold", fontSize=8.6, leading=12),
    "celda_blanca": _st("celda_blanca", fontName="Sans-Bold", fontSize=9,
                        leading=12, textColor=BLANCO),
    "num_seccion": _st("num_seccion", fontName="Sans-Bold", fontSize=13,
                       leading=15, textColor=BLANCO, alignment=TA_CENTER),
    "nota":       _st("nota", fontSize=8.2, leading=11.5, textColor=GRIS,
                      alignment=TA_JUSTIFY),
    "kcal":       _st("kcal", fontSize=7.8, leading=10, textColor=GRIS,
                      alignment=TA_RIGHT),
    "dato_num":   _st("dato_num", fontName="Sans-Bold", fontSize=17, leading=20,
                      textColor=VERDE, alignment=TA_CENTER),
    "dato_lbl":   _st("dato_lbl", fontSize=7.4, leading=10, textColor=GRIS,
                      alignment=TA_CENTER),
}

# ───────────────────────────── Bloques reutilizables ────────────────────────

def seccion(numero, texto, aire=48 * mm):
    """Encabezado de sección con número en pastilla verde.

    `aire` es el espacio mínimo que debe quedar en la página; si no cabe,
    la sección arranca en la siguiente para no dejar el título huérfano.
    """
    t = Table(
        [[Paragraph(numero, S["num_seccion"]), Paragraph(texto, S["h1"])]],
        colWidths=[11 * mm, ANCHO_UTIL - 11 * mm], rowHeights=[10 * mm],
    )
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, 0), VERDE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ("LEFTPADDING", (1, 0), (1, 0), 7),
        ("LINEBELOW", (1, 0), (1, 0), 0.8, LINEA),
    ]))
    return [CondPageBreak(aire), Spacer(1, 4 * mm), t, Spacer(1, 3.5 * mm)]

def caja(titulo, cuerpo, fondo, borde, color_titulo):
    """Recuadro de aviso: título en negritas + contenido (str o lista de str)."""
    lineas = [Paragraph(titulo, _st("t", fontName="Sans-Bold", fontSize=10,
                                    leading=14, textColor=color_titulo))]
    for p in ([cuerpo] if isinstance(cuerpo, str) else cuerpo):
        lineas.append(Paragraph(p, _st("c", fontSize=9, leading=13,
                                       alignment=TA_JUSTIFY)))
    inner = Table([[l] for l in lineas], colWidths=[ANCHO_UTIL - 12 * mm])
    inner.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 1.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1.5),
    ]))
    out = Table([[inner]], colWidths=[ANCHO_UTIL])
    out.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), fondo),
        ("LINEBEFORE", (0, 0), (0, -1), 2.5, borde),
        ("BOX", (0, 0), (-1, -1), 0.5, borde),
        ("LEFTPADDING", (0, 0), (-1, -1), 6 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    return out

def caja_roja(titulo, cuerpo):
    return caja(titulo, cuerpo, ROJO_SUAVE, ROJO, ROJO)

def caja_verde(titulo, cuerpo):
    return caja(titulo, cuerpo, VERDE_SUAVE, VERDE_MED, VERDE)

def caja_oro(titulo, cuerpo):
    return caja(titulo, cuerpo, ORO_SUAVE, ORO, colors.HexColor("#8A6220"))

def tabla(datos, anchos, encabezado=True, align_izq=True):
    """Tabla estándar con encabezado verde y filas alternadas."""
    filas = []
    for i, fila in enumerate(datos):
        estilo = S["celda_blanca"] if (encabezado and i == 0) else S["celda"]
        filas.append([c if hasattr(c, "wrap") else Paragraph(str(c), estilo)
                      for c in fila])
    t = Table(filas, colWidths=anchos, repeatRows=1 if encabezado else 0)
    cmds = [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 4.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4.5),
        ("LINEBELOW", (0, 0), (-1, -1), 0.4, LINEA),
    ]
    if encabezado:
        cmds += [("BACKGROUND", (0, 0), (-1, 0), VERDE),
                 ("LINEBELOW", (0, 0), (-1, 0), 0, VERDE)]
        for i in range(2, len(filas), 2):
            cmds.append(("BACKGROUND", (0, i), (-1, i), VERDE_SUAVE))
    t.setStyle(TableStyle(cmds))
    return t

# ══════════════════════════ DATOS DE LA CLIENTA ══════════════════════════
# Tomados de la ficha enviada por WhatsApp el 18/08/2026.

PERFIL = {
    "nombre": "Angélica Rochin",
    "nacimiento": date(1976, 3, 20),
    "sexo": "F",
    "estatura_cm": 164,
    "peso_kg": 73.0,
    "actividad": 1.30,          # ligera: marcha limitada por la hernia lumbar
    "condiciones": [
        "Dos hernias lumbares tipo 2 (protrusión discal)",
        "Fractura de mano",
    ],
    "alergias": ["Manzana", "Ostión", "Camarón"],
    "nunca": ["Huevo", "Leche"],
    "no_le_gustan": ["Queso", "Pescado", "Atún", "Mariscos", "Puerco"],
    "si_come": ["Pechuga de pollo", "Todas las verduras"],
    "suplementos": ["Complejo B (Costco)"],
    "fecha_plan": date(2026, 8, 21),
}

def edad(nac, hoy):
    return hoy.year - nac.year - ((hoy.month, hoy.day) < (nac.month, nac.day))

EDAD   = edad(PERFIL["nacimiento"], PERFIL["fecha_plan"])
TALLA  = PERFIL["estatura_cm"] / 100
IMC    = PERFIL["peso_kg"] / TALLA ** 2
PESO_MIN, PESO_MAX = 18.5 * TALLA ** 2, 24.9 * TALLA ** 2
# Mifflin-St Jeor (mujer)
TMB    = 10 * PERFIL["peso_kg"] + 6.25 * PERFIL["estatura_cm"] - 5 * EDAD - 161
GET    = TMB * PERFIL["actividad"]
KCAL   = 1500                                   # plan propuesto
DEFICIT= GET - KCAL
PROTE, GRASA, HC = 110, 50, 155                 # gramos/día

MENU = [
    ("Lunes", [
        ("Desayuno", "Avena cocida en bebida de soya fortificada (⅓ taza de "
         "avena + 1 taza de soya) con 1 cda de chía, ½ plátano y canela. "
         "Café o té sin azúcar.", 350),
        ("Colación", "1 taza de papaya picada + 15 g de pepitas tostadas.", 150),
        ("Comida", "Pechuga de pollo asada (150 g) · ensalada de nopales con "
         "jitomate, cebolla y cilantro · 2 tortillas de maíz · ½ aguacate.", 450),
        ("Colación", "1 taza de bebida de soya fortificada + 3 mitades de nuez.", 150),
        ("Cena", "Sopa de lentejas con zanahoria, apio y calabacita (1½ tazas) · "
         "ensalada verde con limón y aceite de oliva.", 400),
    ]),
    ("Martes", [
        ("Desayuno", "Molletes sin lácteos: 2 mitades de bolillo integral con "
         "frijoles refritos (sin manteca), pico de gallo y aguacate. Café o té.", 350),
        ("Colación", "1 mandarina grande + 15 g de cacahuates naturales.", 150),
        ("Comida", "Tinga de pollo (140 g de pechuga deshebrada en salsa de "
         "jitomate con chipotle) · 2 tortillas de maíz · ensalada de repollo y "
         "zanahoria con limón.", 450),
        ("Colación", "Jícama con limón y chile en polvo + 1 taza de bebida de soya.", 150),
        ("Cena", "Caldo de verduras con garbanzo (1 taza de garbanzo cocido) · "
         "calabacitas al vapor con orégano.", 400),
    ]),
    ("Miércoles", [
        ("Desayuno", "Tofu a la mexicana (150 g de tofu firme desmoronado con "
         "jitomate, cebolla y chile) · 2 tortillas de maíz · salsa al gusto.", 350),
        ("Colación", "1 taza de melón + 15 g de pepitas.", 150),
        ("Comida", "Bistec de aguayón asado (120 g) · nopales asados · ensalada "
         "verde · ½ taza de arroz integral.", 450),
        ("Colación", "¼ taza de hummus con bastones de pepino y zanahoria.", 150),
        ("Cena", "Ensalada de garbanzo con jitomate, pepino, cebolla morada, "
         "cilantro, aceite de oliva y limón · sopa de verduras.", 400),
    ]),
    ("Jueves", [
        ("Desayuno", "Avena remojada desde la noche anterior en bebida de soya "
         "con 1 cda de linaza molida, canela y ½ plátano.", 350),
        ("Colación", "1 taza de piña + 15 g de pepitas.", 150),
        ("Comida", "Pechuga de pollo a la plancha (150 g) con calabacita, elote "
         "y pimiento salteados · ½ taza de arroz integral.", 450),
        ("Colación", "1 taza de bebida de soya + 1 cda de crema de cacahuate "
         "natural.", 150),
        ("Cena", "3 tostadas horneadas con frijoles negros, lechuga, jitomate, "
         "aguacate y salsa.", 400),
    ]),
    ("Viernes", [
        ("Desayuno", "Licuado verde: 1 taza de bebida de soya + espinaca + "
         "½ plátano + 1 cda de linaza + 1 cda de crema de cacahuate. "
         "1 tortilla tostada al comal.", 350),
        ("Colación", "2 guayabas + 3 mitades de nuez.", 150),
        ("Comida", "Fajitas de pavo (140 g) con pimiento y cebolla · 2 tortillas "
         "de maíz · guacamole (¼ de aguacate).", 450),
        ("Colación", "1 taza de edamames al vapor con sal y limón.", 150),
        ("Cena", "Crema de calabaza hecha con bebida de soya (sin lácteos) · "
         "ensalada de lentejas con jitomate y cilantro.", 400),
    ]),
    ("Sábado", [
        ("Desayuno", "Chilaquiles verdes horneados, sin queso ni crema, con "
         "pollo deshebrado (80 g), cebolla y aguacate.", 350),
        ("Colación", "1 taza de sandía + 15 g de pepitas.", 150),
        ("Comida", "Caldo de pollo con verduras (150 g de pechuga, zanahoria, "
         "chayote, calabaza) · 2 tortillas de maíz · salsa.", 450),
        ("Colación", "3 tazas de palomitas naturales (sin mantequilla).", 150),
        ("Cena", "Ensalada grande con tofu marinado a la plancha (120 g), hojas "
         "verdes, jitomate, pepino, ½ taza de garbanzo, aceite de oliva y limón.", 400),
    ]),
    ("Domingo", [
        ("Desayuno", "Avena en bebida de soya con 1 cda de chía y ½ taza de "
         "mango picado.", 350),
        ("Colación", "1 taza de bebida de soya + 3 mitades de nuez.", 150),
        ("Comida", "Pollo al horno con verduras (150 g) · ½ taza de puré de "
         "camote · ensalada verde.", 450),
        ("Colación", "Zanahoria y pepino con ¼ taza de hummus.", 150),
        ("Cena", "Tacos de champiñones al ajillo con epazote (3 tortillas de "
         "maíz) · sopa de frijol · ensalada.", 400),
    ]),
]

INTERCAMBIOS = [
    ["Grupo", "Una porción equivale a…", "Al día"],
    ["<b>Proteína</b><br/>≈ 22 g", "150 g de pechuga de pollo o pavo · 120 g de "
     "res magra (aguayón, filete) · 200 g de tofu firme · 1 taza de lenteja, "
     "garbanzo o frijol cocidos · 1 taza de edamame", "4 a 5"],
    ["<b>Cereal</b><br/>≈ 80 kcal", "1 tortilla de maíz · ½ taza de arroz o pasta "
     "integral cocidos · 1 rebanada de pan integral · ⅓ taza de avena cruda · "
     "½ elote · ½ taza de camote o papa", "5 a 6"],
    ["<b>Fruta</b><br/>≈ 60 kcal", "1 taza de papaya, melón, sandía o piña · "
     "½ mango · ½ plátano · 1 naranja o mandarina · 2 guayabas · 1 taza de uvas",
     "2 a 3"],
    ["<b>Grasa</b><br/>≈ 45 kcal", "1 cdita de aceite de oliva · ⅓ de aguacate · "
     "3 mitades de nuez · 15 g de pepitas o cacahuates · 1 cda de ajonjolí "
     "o tahini", "4 a 5"],
    ["<b>Calcio</b><br/>≈ 280 mg", "1 taza de bebida de soya fortificada · "
     "½ taza de tofu cuajado con sulfato de calcio · 2 cdas de chía · "
     "1½ tazas de nopal cocido · 3 tortillas de maíz nixtamalizado", "4"],
    ["<b>Verduras</b><br/>libres", "Todas, sin límite: nopal, calabacita, "
     "chayote, brócoli, espinaca, acelga, jitomate, pepino, lechuga, repollo, "
     "zanahoria, ejote, champiñón, pimiento, jícama", "3 tazas<br/>o más"],
]

NUTRIENTES = [
    ["Nutriente", "Meta al día", "De dónde lo va a sacar en este plan"],
    ["Calcio", "1,200 mg", "Bebida de soya fortificada, tortilla de maíz "
     "nixtamalizado, nopal, tofu, chía, ajonjolí, brócoli y hojas verdes."],
    ["Vitamina D", "800–1,000 UI", "<b>No se cubre con comida en este plan</b> "
     "(sin lácteos, huevo ni pescado). Requiere sol y, muy probablemente, "
     "suplemento indicado por su médico."],
    ["Proteína", "110 g", "Pollo, pavo, res magra, tofu, edamame, leguminosas. "
     "Repartida en 25–30 g por tiempo de comida, no toda en la cena."],
    ["Omega-3", "1.1 g (ALA)", "Chía, linaza molida y nuez. Al no comer pescado, "
     "conviene valorar aceite de algas con su médico."],
    ["Hierro", "8 mg", "Lenteja, frijol, garbanzo, res magra y hojas verdes, "
     "siempre con algo de vitamina C (limón, guayaba, pimiento) para absorberlo."],
    ["Yodo", "150 µg", "Usar <b>sal yodada</b> en casa: sin pescado ni lácteos, "
     "es prácticamente su única fuente."],
    ["Vitamina B12", "2.4 µg", "Pollo y res, más el complejo B que ya toma. "
     "Este punto ya está cubierto."],
    ["Fibra", "28–30 g", "Leguminosas, avena, verduras, fruta con cáscara y "
     "tortilla de maíz. Clave para no forzar la espalda al ir al baño."],
]

SUPER = [
    ["Proteína", "Pechuga de pollo · pavo en fajitas · aguayón o filete de res · "
     "tofu firme (con sulfato de calcio) · edamame congelado"],
    ["Leguminosas", "Lenteja · garbanzo · frijol negro y bayo · hummus"],
    ["Cereales", "Tortilla de maíz nixtamalizado · avena en hojuelas · arroz "
     "integral · pan integral · bolillo integral · tostadas horneadas · "
     "palomitas naturales · camote"],
    ["Bebida vegetal", "Bebida de soya <b>fortificada con calcio y vitamina D</b>, "
     "sin azúcar añadida (revisar la etiqueta)"],
    ["Verduras", "Nopal · calabacita · chayote · brócoli · espinaca · lechuga · "
     "repollo · zanahoria · jitomate · cebolla · pepino · pimiento · champiñón · "
     "ejote · jícama · elote · apio · cilantro · epazote"],
    ["Frutas", "Papaya · melón · sandía · piña · mango · plátano · guayaba · "
     "mandarina · naranja · uva"],
    ["Grasas y semillas", "Aceite de oliva extra virgen · aguacate · nuez · "
     "pepitas · cacahuate natural · crema de cacahuate sin azúcar · chía · "
     "linaza molida · ajonjolí"],
    ["Despensa", "Sal yodada · canela · orégano · comino · cúrcuma · jengibre · "
     "chile chipotle · ajo · vinagre · limón · caldo de verduras sin sodio"],
]

RECETAS = [
    ["Receta", "Cómo se hace"],
    ["<b>Tofu a la mexicana</b><br/>2 porciones",
     "Escurrir 300 g de tofu firme y prensarlo 10 minutos con un plato encima. "
     "Desmoronarlo con la mano. Sofreír en 1 cda de aceite de oliva media "
     "cebolla, un jitomate y chile serrano al gusto. Agregar el tofu, ¼ de "
     "cucharadita de cúrcuma —le da el color del huevo revuelto—, sal yodada y "
     "pimienta. Ocho minutos y listo."],
    ["<b>Tinga de pollo ligera</b><br/>4 porciones",
     "Cocer 600 g de pechuga con ¼ de cebolla y un diente de ajo; deshebrar. "
     "Licuar 4 jitomates, 1 chile chipotle en adobo, ajo y un poco del caldo. "
     "Sofreír media cebolla rebanada en 1 cda de aceite, verter la salsa, hervir "
     "10 minutos y agregar el pollo. Rinde para dos comidas."],
    ["<b>Crema de calabaza<br/>sin lácteos</b><br/>4 porciones",
     "Cocer 1 kg de calabaza de castilla con media cebolla y un diente de ajo en "
     "caldo de verduras. Licuar con 1 taza de bebida de soya sin azúcar. "
     "Regresar al fuego, sazonar con sal yodada, pimienta y una pizca de nuez "
     "moscada. Queda cremosa sin una gota de leche."],
    ["<b>Ensalada de lentejas</b><br/>4 porciones",
     "Mezclar 2 tazas de lenteja cocida y fría con jitomate, pepino, cebolla "
     "morada y cilantro picados. Aliñar con 2 cdas de aceite de oliva, el jugo "
     "de 2 limones, sal y orégano. Aguanta tres días en refrigeración: es la "
     "que salva los días sin ganas de cocinar."],
]

# ══════════════════════════ PÁGINAS ══════════════════════════

MESES = ("enero febrero marzo abril mayo junio julio agosto septiembre "
         "octubre noviembre diciembre").split()

def fecha_larga(f):
    return "%d de %s de %d" % (f.day, MESES[f.month - 1], f.year)

def portada(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(VERDE)
    canvas.rect(0, 0, ANCHO, ALTO, stroke=0, fill=1)

    # Franja de acento superior
    canvas.setFillColor(ORO)
    canvas.rect(0, ALTO - 8 * mm, ANCHO, 8 * mm, stroke=0, fill=1)

    # Marca de agua discreta
    canvas.setFillColor(colors.Color(1, 1, 1, alpha=0.06))
    canvas.setFont("Sans-Bold", 148)
    canvas.drawRightString(ANCHO - 12 * mm, 58 * mm, "1500")

    x = MARGEN + 6 * mm
    canvas.setFillColor(ORO)
    canvas.setFont("Sans-Bold", 10)
    canvas.drawString(x, ALTO - 62 * mm, "S U G E R E N C I A   N U T R I C I O N A L")

    canvas.setFillColor(BLANCO)
    canvas.setFont("Sans-Bold", 33)
    canvas.drawString(x, ALTO - 82 * mm, "Plan de")
    canvas.drawString(x, ALTO - 96 * mm, "alimentación")

    canvas.setStrokeColor(ORO)
    canvas.setLineWidth(2.5)
    canvas.line(x, ALTO - 106 * mm, x + 42 * mm, ALTO - 106 * mm)

    canvas.setFont("Sans", 15)
    canvas.drawString(x, ALTO - 120 * mm, PERFIL["nombre"])

    canvas.setFillColor(colors.Color(1, 1, 1, alpha=0.75))
    canvas.setFont("Sans", 10)
    canvas.drawString(x, ALTO - 131 * mm,
                      "%d años · %d cm · %.0f kg · 1,500 kcal al día"
                      % (EDAD, PERFIL["estatura_cm"], PERFIL["peso_kg"]))
    canvas.drawString(x, ALTO - 141 * mm,
                      "Sin huevo · sin lácteos · sin pescado ni mariscos · "
                      "sin puerco · sin manzana")

    # Pie de portada
    canvas.setStrokeColor(colors.Color(1, 1, 1, alpha=0.25))
    canvas.setLineWidth(0.6)
    canvas.line(x, 34 * mm, ANCHO - MARGEN - 6 * mm, 34 * mm)
    canvas.setFillColor(colors.Color(1, 1, 1, alpha=0.7))
    canvas.setFont("Sans", 8.5)
    canvas.drawString(x, 27 * mm, "Elaborado el " + fecha_larga(PERFIL["fecha_plan"]))
    canvas.drawString(x, 21 * mm, "Documento orientativo. No sustituye la consulta "
                                  "con nutriólogo o médico tratante.")
    canvas.restoreState()

def contenido(canvas, doc):
    canvas.saveState()
    # Encabezado
    canvas.setFillColor(GRIS)
    canvas.setFont("Sans", 7.5)
    canvas.drawString(MARGEN, ALTO - 12 * mm, "Plan de alimentación · " + PERFIL["nombre"])
    canvas.drawRightString(ANCHO - MARGEN, ALTO - 12 * mm,
                           fecha_larga(PERFIL["fecha_plan"]))
    canvas.setStrokeColor(LINEA)
    canvas.setLineWidth(0.5)
    canvas.line(MARGEN, ALTO - 14 * mm, ANCHO - MARGEN, ALTO - 14 * mm)
    # Pie
    canvas.line(MARGEN, 14 * mm, ANCHO - MARGEN, 14 * mm)
    canvas.setFont("Sans", 7.5)
    canvas.setFillColor(GRIS)
    canvas.drawString(MARGEN, 9.5 * mm,
                      "Orientativo · valídalo con tu nutriólogo antes de iniciarlo")
    canvas.setFillColor(VERDE)
    canvas.setFont("Sans-Bold", 8.5)
    canvas.drawRightString(ANCHO - MARGEN, 9.5 * mm, str(doc.page - 1))
    canvas.restoreState()

def dia_card(nombre, comidas):
    total = sum(c[2] for c in comidas)
    barra = Table([[Paragraph(nombre, S["celda_blanca"]),
                    Paragraph("{:,} kcal aprox.".format(total),
                              _st("k", fontSize=8, leading=11, textColor=BLANCO,
                                  alignment=TA_RIGHT))]],
                  colWidths=[ANCHO_UTIL * 0.6, ANCHO_UTIL * 0.4])
    barra.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), VERDE_MED),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (0, 0), 6),
        ("RIGHTPADDING", (1, 0), (1, 0), 6),
    ]))
    filas = [[Paragraph(t, S["celda_b"]), Paragraph(d, S["celda"]),
              Paragraph("%d" % k, S["kcal"])] for t, d, k in comidas]
    cuerpo = Table(filas, colWidths=[22 * mm, ANCHO_UTIL - 36 * mm, 14 * mm])
    cmds = [("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LINEBELOW", (0, 0), (-1, -2), 0.4, LINEA),
            ("BOX", (0, 0), (-1, -1), 0.5, LINEA)]
    for i in range(0, len(filas), 2):
        cmds.append(("BACKGROUND", (0, i), (-1, i), colors.HexColor("#F7FAF8")))
    cuerpo.setStyle(TableStyle(cmds))
    return KeepTogether([barra, cuerpo, Spacer(1, 3.5 * mm)])

def fila_datos():
    datos = [("%.1f" % IMC, "IMC actual"),
             ("%.0f kg" % PERFIL["peso_kg"], "Peso hoy"),
             ("%.0f–%.0f" % (PESO_MIN, PESO_MAX), "Peso saludable (kg)"),
             ("%.0f" % GET, "Gasto estimado (kcal)")]
    celdas = [[Paragraph(n, S["dato_num"])] for n, _ in datos]
    t = Table([[Paragraph(n, S["dato_num"]) for n, _ in datos],
               [Paragraph(l, S["dato_lbl"]) for _, l in datos]],
              colWidths=[ANCHO_UTIL / 4] * 4)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), VERDE_SUAVE),
        ("TOPPADDING", (0, 0), (-1, 0), 8),
        ("BOTTOMPADDING", (0, 1), (-1, 1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 0),
        ("TOPPADDING", (0, 1), (-1, 1), 0),
        ("LINEAFTER", (0, 0), (-2, -1), 0.5, BLANCO),
        ("BOX", (0, 0), (-1, -1), 0.5, LINEA),
    ]))
    return t

# ══════════════════════════ CONTENIDO ══════════════════════════

def construir_historia():
    h = [NextPageTemplate("contenido"), PageBreak()]

    # ── 1. Punto de partida ────────────────────────────────────────────────
    h += seccion("1", "Punto de partida")
    h.append(Paragraph(
        "Con %d años, %d cm y %.0f kg, el índice de masa corporal es de "
        "<b>%.1f</b>, que cae en sobrepeso. El rango saludable para su "
        "estatura va de %.0f a %.0f kg, así que la meta de esta primera etapa "
        "no es llegar al extremo bajo: es bajar entre <b>5 y 6 kg</b> de forma "
        "sostenida. Ese solo cambio ya descarga de manera medible la columna "
        "lumbar."
        % (EDAD, PERFIL["estatura_cm"], PERFIL["peso_kg"], IMC,
           PESO_MIN, PESO_MAX), S["cuerpo"]))
    h.append(Spacer(1, 2 * mm))
    h.append(fila_datos())
    h.append(Spacer(1, 4 * mm))
    h.append(Paragraph(
        "El gasto energético se estimó con la fórmula de Mifflin-St Jeor "
        "(metabolismo basal de %.0f kcal) multiplicada por un factor de "
        "actividad ligera, porque la hernia lumbar limita cuánto se puede "
        "caminar y cargar. De ahí sale el plan de <b>1,500 kcal al día</b>: "
        "un déficit de unas %.0f kcal diarias, suficiente para bajar entre "
        "1 y 1.5 kg al mes sin perder músculo ni pasar hambre."
        % (TMB, DEFICIT), S["cuerpo"]))

    # ── 2. Restricciones ───────────────────────────────────────────────────
    h += seccion("2", "Lo que este plan respeta")
    h.append(caja_roja(
        "Alergias — evitar siempre, en cualquier cantidad",
        ["<b>" + " · ".join(PERFIL["alergias"]) + "</b>",
         "El ostión y el camarón obligan a evitar <b>todos</b> los mariscos y "
         "crustáceos, porque la reacción cruzada entre ellos es la regla, no la "
         "excepción. En la manzana conviene además preguntarle al alergólogo por "
         "pera, durazno, ciruela, cereza, fresa y almendra: pertenecen a la misma "
         "familia y con frecuencia dan reacción cruzada. Por precaución, este "
         "menú no las incluye hasta que un especialista las autorice.",
         "<b>Nota:</b> en la ficha estos tres alimentos venían en una línea "
         "aparte, sin etiqueta. Se interpretaron como alergias. Si en realidad "
         "eran otra cosa, avísame y ajusto el plan."]))
    h.append(Spacer(1, 3 * mm))
    h.append(tabla([
        ["Regla", "Alimentos", "Cómo se resolvió"],
        ["<b>Nunca</b>", " · ".join(PERFIL["nunca"]),
         "El desayuno se arma con avena, tofu o frijol en lugar de huevo, y con "
         "bebida de soya fortificada en lugar de leche."],
        ["<b>No le gustan</b>", " · ".join(PERFIL["no_le_gustan"]),
         "No aparece ninguno. La proteína animal viene de pollo, pavo y res "
         "magra; el resto, de leguminosas y soya."],
        ["<b>Sí come</b>", " · ".join(PERFIL["si_come"]),
         "El pollo es la base de las comidas fuertes y las verduras son libres: "
         "puede repetirlas sin contar."],
        ["<b>Ya toma</b>", " · ".join(PERFIL["suplementos"]),
         "Se mantiene. Cubre la vitamina B12, pero no aporta calcio, vitamina D "
         "ni omega-3, que son justo los puntos débiles de esta dieta."],
    ], [26 * mm, 40 * mm, ANCHO_UTIL - 66 * mm]))

    # ── 3. Cómo se reparte el día ──────────────────────────────────────────
    h += seccion("3", "Cómo se reparte el día")
    h.append(tabla([
        ["", "Al día", "Equivale a", "Por qué así"],
        ["<b>Energía</b>", "1,500 kcal", "5 tiempos de comida",
         "Tres comidas y dos colaciones evitan llegar con hambre a la cena."],
        ["<b>Proteína</b>", "110 g", "1.5 g por kilo de peso",
         "Alta a propósito: protege el músculo mientras baja de peso y ayuda a "
         "consolidar la fractura."],
        ["<b>Grasa</b>", "50 g", "30 % de la energía",
         "Casi toda de aceite de oliva, aguacate, nuez y semillas."],
        ["<b>Hidratos</b>", "155 g", "41 % de la energía",
         "De tortilla de maíz, avena, leguminosas, fruta y verdura. Sin refresco "
         "ni pan dulce."],
        ["<b>Fibra</b>", "28–30 g", "leguminosas + verdura + fruta",
         "Mantiene el intestino regular. Pujar en el baño sube la presión dentro "
         "del disco lumbar."],
        ["<b>Agua</b>", "2 a 2.5 L", "8 a 10 vasos",
         "El disco intervertebral es agua en su mayor parte; deshidratarse le "
         "juega en contra."],
    ], [22 * mm, 20 * mm, 34 * mm, ANCHO_UTIL - 76 * mm]))
    h.append(Spacer(1, 4 * mm))
    h.append(caja_verde("Cuatro reglas que valen más que el menú exacto", [
        "<b>1.</b> Que en cada comida haya proteína — pollo, tofu, frijol, "
        "lenteja o garbanzo. Sin excepción.",
        "<b>2.</b> Que medio plato sea verdura. Le gustan todas, así que aquí "
        "no hay pretexto.",
        "<b>3.</b> Tortilla de maíz antes que pan blanco: además de saciar, el "
        "maíz nixtamalizado aporta calcio, y sin lácteos ese calcio hace falta.",
        "<b>4.</b> Nada de refresco, jugo industrial ni pan dulce. Son las "
        "calorías que más pesan y las que menos alimentan.",
    ]))

    # ── 4. Menú ────────────────────────────────────────────────────────────
    h += seccion("4", "Menú sugerido de 7 días")
    h.append(Paragraph(
        "No es obligatorio seguirlo en este orden. Si un día no le late lo que "
        "toca, cámbielo por el de otro día o use la tabla de intercambios de la "
        "sección 5. Las cantidades son en crudo salvo que diga lo contrario.",
        S["cuerpo"]))
    h.append(Spacer(1, 2 * mm))
    for nombre, comidas in MENU:
        h.append(dia_card(nombre, comidas))

    # ── 5. Intercambios ────────────────────────────────────────────────────
    h += seccion("5", "Tabla de intercambios")
    h.append(Paragraph(
        "Esta tabla es la que hace que el plan dure. Cada alimento se puede "
        "cambiar por otro de su mismo grupo sin recalcular nada: si un día no "
        "hay pollo, esa porción de proteína se cubre con una taza de lenteja.",
        S["cuerpo"]))
    h.append(Spacer(1, 2 * mm))
    h.append(tabla(INTERCAMBIOS, [30 * mm, ANCHO_UTIL - 48 * mm, 18 * mm]))
    h.append(Spacer(1, 4 * mm))
    h.append(caja_oro("Medidas sin báscula", [
        "<b>Proteína:</b> la palma de su mano, sin dedos. &nbsp;&nbsp; "
        "<b>Cereal:</b> su puño cerrado.",
        "<b>Grasa:</b> la punta de su pulgar. &nbsp;&nbsp; "
        "<b>Verdura:</b> las dos manos ahuecadas juntas.",
    ]))

    # ── 6. Nutrientes ──────────────────────────────────────────────────────
    h += seccion("6", "Los nutrientes que hay que vigilar")
    h.append(Paragraph(
        "Quitar huevo, leche, queso, pescado y mariscos deja fuera de golpe las "
        "principales fuentes de calcio, vitamina D y omega-3. El menú ya está "
        "armado para compensarlo con comida, pero conviene tenerlo a la vista.",
        S["cuerpo"]))
    h.append(Spacer(1, 2 * mm))
    h.append(tabla(NUTRIENTES, [26 * mm, 24 * mm, ANCHO_UTIL - 50 * mm]))

    # ── 7. Súper ───────────────────────────────────────────────────────────
    h += seccion("7", "Lista del súper")
    h.append(tabla([["Sección", "Qué comprar"]] + SUPER,
                   [30 * mm, ANCHO_UTIL - 30 * mm]))

    # ── 8. Recetas ─────────────────────────────────────────────────────────
    h += seccion("8", "Las cuatro recetas que se repiten")
    h.append(Paragraph(
        "Son las que aparecen varias veces en el menú. Ninguna pide destreza ni "
        "fuerza en las manos, y todas rinden para más de un día: cocinar el "
        "domingo resuelve buena parte de la semana.", S["cuerpo"]))
    h.append(Spacer(1, 2 * mm))
    h.append(tabla(RECETAS, [34 * mm, ANCHO_UTIL - 34 * mm]))

    # ── 9. Condición ───────────────────────────────────────────────────────
    h += seccion("9", "Pensado para su espalda, su mano y sus 50 años")
    h.append(Paragraph("Dos hernias lumbares tipo 2", S["h2"]))
    for t in [
        "Bajar peso es, de todo lo que se puede hacer desde la cocina, lo que "
        "más alivia la columna: cada kilo de menos es carga que dejan de "
        "aguantar los discos al caminar, agacharse y levantarse.",
        "El plan sigue un patrón antiinflamatorio: aceite de oliva, verdura de "
        "colores, cúrcuma y jengibre; y fuera embutidos, frituras y azúcar.",
        "Magnesio para el espasmo muscular — hojas verdes, leguminosas, pepitas "
        "y cacao amargo aparecen a lo largo de toda la semana.",
        "Fibra y agua todos los días, para no acabar pujando en el baño: esa "
        "maniobra sube la presión dentro del disco.",
    ]:
        h.append(Paragraph(t, S["vineta"], bulletText="•"))

    h.append(Paragraph("Fractura de mano", S["h2"]))
    for t in [
        "El hueso se repara con proteína, calcio, vitamina D, vitamina C y zinc. "
        "La proteína ya va alta; la vitamina C entra con guayaba, pimiento, "
        "limón y papaya, y el zinc con pepitas, leguminosas y res.",
        "El alcohol y el tabaco retrasan la consolidación del hueso. Mientras "
        "haya fractura en recuperación, lo ideal es cero.",
        "Si la mano todavía limita para cocinar: verdura ya picada de bolsa, "
        "leguminosa de lata bien enjuagada y cocinar el domingo para tres días "
        "resuelven la semana sin depender de la fuerza de agarre.",
    ]:
        h.append(Paragraph(t, S["vineta"], bulletText="•"))

    h.append(Paragraph("50 años", S["h2"]))
    for t in [
        "A partir de la menopausia la pérdida de hueso se acelera y la necesidad "
        "de calcio sube a 1,200 mg al día. Sin lácteos, hay que buscarlo a "
        "propósito: por eso la bebida de soya fortificada y la tortilla de maíz "
        "nixtamalizado aparecen todos los días.",
        "La proteína se reparte entre las cinco comidas y no se concentra en la "
        "cena. Repartida se aprovecha más para conservar músculo.",
        "El complejo B que ya toma cubre la B12. No cubre calcio, vitamina D ni "
        "omega-3: eso hay que platicarlo con su médico.",
    ]:
        h.append(Paragraph(t, S["vineta"], bulletText="•"))

    # ── 10. Seguimiento ────────────────────────────────────────────────────
    h += seccion("10", "Cómo saber si está funcionando")
    h.append(tabla([
        ["Qué medir", "Cada cuándo", "Qué esperar"],
        ["Peso", "1 vez por semana, mismo día, en ayunas y después del baño",
         "Entre 0.25 y 0.4 kg menos por semana. Que un día suba no significa "
         "nada; lo que cuenta es la tendencia del mes."],
        ["Cintura", "1 vez al mes, a la altura del ombligo",
         "Suele bajar antes que el peso. Es la mejor señal temprana."],
        ["Energía y dolor", "Todos los días, sin instrumentos",
         "Menos inflamación y menos peso casi siempre se sienten en la espalda "
         "antes de que la báscula lo confirme."],
        ["Revisión", "A las 4 semanas, con nutriólogo",
         "Si en 3 semanas no se movió nada, se ajusta el plan. No se recortan "
         "más calorías por cuenta propia."],
    ], [26 * mm, 44 * mm, ANCHO_UTIL - 70 * mm]))
    h.append(Spacer(1, 5 * mm))
    h.append(caja_roja("Antes de empezar", [
        "Esta es una <b>sugerencia orientativa</b> hecha con los datos de la "
        "ficha del 18 de agosto. No es una prescripción médica ni sustituye la "
        "valoración de un nutriólogo o del médico que lleva las hernias.",
        "Conviene revisarla con un profesional si hay medicamentos de por medio, "
        "presión alta, diabetes, problemas de tiroides o de riñón, o si se está "
        "en tratamiento por las hernias: cualquiera de esas cosas cambia las "
        "cantidades.",
        "Y si aparece dolor que baja por la pierna, hormigueo, pérdida de fuerza "
        "o problemas para controlar esfínteres, eso no es tema de dieta: es "
        "consulta médica el mismo día.",
    ]))
    return h

def main():
    salida = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                          "entregables",
                          "Sugerencia-Dieta-Angelica-Rochin.pdf")
    os.makedirs(os.path.dirname(salida), exist_ok=True)
    doc = BaseDocTemplate(
        salida, pagesize=PAGINA,
        leftMargin=MARGEN, rightMargin=MARGEN,
        topMargin=20 * mm, bottomMargin=19 * mm,
        title="Sugerencia de plan de alimentación — " + PERFIL["nombre"],
        author="Plan elaborado para " + PERFIL["nombre"],
        subject="Sugerencia nutricional orientativa, 1,500 kcal, sin huevo, "
                "lácteos, pescado, mariscos, puerco ni manzana",
    )
    marco = Frame(MARGEN, 19 * mm, ANCHO_UTIL,
                  ALTO - 20 * mm - 19 * mm, id="cuerpo",
                  leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
    doc.addPageTemplates([
        PageTemplate(id="portada", frames=[marco], onPage=portada),
        PageTemplate(id="contenido", frames=[marco], onPage=contenido),
    ])
    doc.build(construir_historia())
    print("PDF generado: " + salida)

if __name__ == "__main__":
    main()
