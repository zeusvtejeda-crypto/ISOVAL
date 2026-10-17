#!/usr/bin/env python3
"""Construye instalaciones_nayarit.csv a partir de fuentes oficiales.

Fuentes (ver FUENTES.md):
  1. CLUES (DGIS, Secretaría de Salud), versión 202608 — fuentes/clues_nayarit_202608_completo.csv
  2. Directorio de instalaciones IMSS (imss.gob.mx/directorio) — fuentes/imss_directorio_nayarit_2026-10-17.csv

Uso: python3 construir_instalaciones.py
"""
import csv, math, re, unicodedata, collections
from pathlib import Path

BASE = Path(__file__).parent
CLUES_VERSION = "202608"
CLUES_FUENTE = f"CLUES DGIS/SSA ESTABLECIMIENTO_SALUD_{CLUES_VERSION} (dgis.salud.gob.mx)"
IMSS_FUENTE = "Directorio IMSS imss.gob.mx/directorio (consulta 2026-10-17)"
UMBRAL_KM = 1.0

def norm(s):
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode()
    s = re.sub(r"[^A-Z0-9 ]+", " ", s.upper())
    return re.sub(r"\s+", " ", s).strip()

def km(a, b, c, d):
    a, b, c, d = map(math.radians, (a, b, c, d))
    h = math.sin((c - a) / 2) ** 2 + math.cos(a) * math.cos(c) * math.sin((d - b) / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(h))

def direccion(r):
    partes = []
    via = " ".join(x for x in (r["TIPO DE VIALIDAD"], r["VIALIDAD"]) if x and x != "NINGUNO")
    if via: partes.append(via)
    if r["NUMERO EXTERIOR"]: partes.append(r["NUMERO EXTERIOR"])
    if r["NUMERO INTERIOR"]: partes.append("INT. " + r["NUMERO INTERIOR"])
    asent = " ".join(x for x in (r["TIPO DE ASENTAMIENTO"], r["ASENTAMIENTO"]) if x and x != "NINGUNO")
    if asent: partes.append(asent)
    return ", ".join(partes)

clues = list(csv.DictReader(open(BASE / "fuentes" / f"clues_nayarit_{CLUES_VERSION}_completo.csv", encoding="utf-8")))
imss = list(csv.DictReader(open(BASE / "fuentes" / "imss_directorio_nayarit_2026-10-17.csv", encoding="utf-8")))

# Directorio IMSS: puede repetir una unidad (por servicio) con coordenadas distintas
dir_imss = collections.defaultdict(list)
for d in imss:
    if d["lat"] and d["lng"]:
        dir_imss[norm(d["nombre"])].append((float(d["lat"]), float(d["lng"])))

operacion = [r for r in clues if r["ESTATUS DE OPERACION"].startswith("EN OPERACION")]

# Coordenadas "genéricas": la misma coordenada exacta en 3+ unidades (p. ej. domicilio de la OOAD)
coord_count = collections.Counter((r["LATITUD"], r["LONGITUD"]) for r in operacion)
# Caja envolvente por municipio (con todas las unidades menos la evaluada) para detectar ubicaciones fuera del municipio
por_mun = collections.defaultdict(list)
for r in operacion:
    por_mun[r["CLAVE DEL MUNICIPIO"]].append((float(r["LATITUD"]), float(r["LONGITUD"]), r["CLUES"]))

def dentro_municipio(lat, lng, mun, propio):
    pts = [(a, b) for a, b, c in por_mun[mun] if c != propio]
    if len(pts) < 3:
        return True
    lats = [a for a, b in pts]; lngs = [b for a, b in pts]
    pad = 0.05
    return min(lats) - pad <= lat <= max(lats) + pad and min(lngs) - pad <= lng <= max(lngs) + pad

nombres_clues = collections.Counter(norm(r["NOMBRE COMERCIAL"]) for r in operacion if r["CLAVE DE LA INSTITUCION"] in ("IMS", "IMB"))

salida = []
stats = collections.Counter()
for r in operacion:
    lat, lng = float(r["LATITUD"]), float(r["LONGITUD"])
    mun = r["CLAVE DEL MUNICIPIO"]
    fuente = CLUES_FUENTE
    avisos = []
    generica = coord_count[(r["LATITUD"], r["LONGITUD"])] >= 3
    if generica:
        avisos.append(f"coordenada CLUES compartida por {coord_count[(r['LATITUD'], r['LONGITUD'])]} unidades (genérica)")
    if not dentro_municipio(lat, lng, mun, r["CLUES"]):
        avisos.append("posible ubicación fuera del municipio; revisar")
    if r["CLAVE DE LA INSTITUCION"] in ("IMS", "IMB"):
        cands = dir_imss.get(norm(r["NOMBRE COMERCIAL"])) or dir_imss.get(norm(r["NOMBRE DE LA UNIDAD"])) or []
        if avisos:
            # La coordenada CLUES es dudosa: preferir candidatos distintos a ella y dentro del municipio
            buenos = [c for c in cands if (c[0], c[1]) != (lat, lng) and dentro_municipio(c[0], c[1], mun, r["CLUES"])]
            cands = buenos or cands
        ambiguo = nombres_clues[norm(r["NOMBRE COMERCIAL"])] > 1
        if cands and ambiguo and min(km(lat, lng, c[0], c[1]) for c in cands) > UMBRAL_KM:
            cands = []  # nombre repetido en CLUES; sin coincidencia cercana no se puede asignar
        if cands:
            fuente += "; " + IMSS_FUENTE
            mejor = min(cands, key=lambda c: km(lat, lng, c[0], c[1]))
            dist = km(lat, lng, mejor[0], mejor[1])
            if dist <= UMBRAL_KM and not avisos:
                avisos.append(f"coincide con directorio IMSS ({dist:.2f} km)")
                stats["imss_ok"] += 1
            elif avisos and dentro_municipio(mejor[0], mejor[1], mun, r["CLUES"]):
                avisos.append(f"se usa la coordenada del directorio IMSS (CLUES: {lat},{lng}; {dist:.1f} km)")
                lat, lng = mejor
                stats["imss_corregido"] += 1
            elif dist > UMBRAL_KM:
                avisos.append(f"directorio IMSS difiere {dist:.1f} km; se conserva CLUES; revisar")
                stats["imss_revisar"] += 1
            else:
                avisos.append(f"coincide con directorio IMSS ({dist:.2f} km)")
                stats["imss_ok"] += 1
        else:
            stats["imss_sin_directorio"] += 1
    salida.append({
        "clues": r["CLUES"],
        "nombre": r["NOMBRE DE LA UNIDAD"],
        "nombre_corto": r["NOMBRE COMERCIAL"],
        "clave_institucion": r["CLAVE DE LA INSTITUCION"],
        "institucion": r["NOMBRE DE LA INSTITUCION"].strip(),
        "tipo_establecimiento": r["NOMBRE TIPO ESTABLECIMIENTO"],
        "tipologia": r["NOMBRE DE TIPOLOGIA"].strip(),
        "nivel_atencion": r["NIVEL ATENCION"],
        "cve_municipio": "18" + mun.zfill(3),
        "municipio": r["MUNICIPIO"],
        "localidad": r["LOCALIDAD"],
        "direccion": direccion(r),
        "codigo_postal": r["CODIGO POSTAL"],
        "telefono": r["TELEFONO 1 DEL ESTABLECIMIENTO"],
        "lat": f"{lat:.7f}".rstrip("0").rstrip("."),
        "lng": f"{lng:.7f}".rstrip("0").rstrip("."),
        "estatus": r["ESTATUS DE OPERACION"],
        "fuente": fuente,
        "fuente_fecha": f"CLUES {CLUES_VERSION[:4]}-{CLUES_VERSION[4:]}",
        "validacion": "; ".join(avisos),
    })

salida.sort(key=lambda x: (x["cve_municipio"], x["clave_institucion"], x["nombre"]))
with open(BASE / "instalaciones_nayarit.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=list(salida[0].keys()))
    w.writeheader(); w.writerows(salida)

# Unidades del directorio IMSS sin CLUES (para revisión manual)
usados = {norm(x["nombre_corto"]) for x in salida} | {norm(x["nombre"]) for x in salida}
huerfanas = [d for k, d in dir_imss.items() if k not in usados]
with open(BASE / "imss_directorio_sin_clues.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=list(imss[0].keys()))
    w.writeheader(); w.writerows(huerfanas)

print("filas:", len(salida))
print("por institución:", collections.Counter(x["clave_institucion"] for x in salida).most_common())
print("validación IMSS:", dict(stats))
print("directorio IMSS sin CLUES:", len(huerfanas))
