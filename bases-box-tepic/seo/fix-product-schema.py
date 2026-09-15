#!/usr/bin/env python3
"""Corrige el error critico de Search Console en basestipobox.com:

    "Debe especificarse hasVariant.offers, review o aggregateRating"

El bloque JSON-LD #3 del index.html publica un ProductGroup con 32 variantes
(4 medidas x 8 tonos) y ninguna trae `offers`, que es lo que Google exige para
los fragmentos de producto.

Uso (sobre el index.html del sitio en vivo, el que se sube a Vercel):

    python3 fix-product-schema.py ruta/al/index.html            # opcion A
    python3 fix-product-schema.py ruta/al/index.html --precios \
        individual=2500 matrimonial=3200 queen=3600 king=4800   # opcion B

Opcion A (por defecto): sustituye el ProductGroup por un ItemList informativo.
  El sitio no publica precios a proposito, y sin `price` Google nunca entrega
  el rich result de producto: el markup solo generaba el error.

Opcion B (--precios): conserva el ProductGroup y anade `offers` reales a cada
  variante. Solo valida si los precios son los que de verdad cobras.

Es idempotente y no toca ningun otro bloque (FurnitureStore, FAQPage).
"""
import argparse
import json
import re
import sys
import unicodedata

SCRIPT_RE = re.compile(
    r'<script type="application/ld\+json">\s*(\{.*?\})\s*</script>', re.S)

MEDIDAS = {
    "1.00 × 1.90 m": ("individual", "Individual"),
    "1.35 × 1.90 m": ("matrimonial", "Matrimonial"),
    "1.50 × 1.90 m": ("queen", "Queen"),
    "2.00 × 1.90 m": ("king", "King"),
}


def slug(texto):
    plano = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", plano.lower()).strip("-")


def item_list(grupo):
    """Opcion A: catalogo informativo, sin tipos Product."""
    vistas, items = set(), []
    for v in grupo.get("hasVariant", []):
        medida = v.get("size")
        if medida in vistas:
            continue
        vistas.add(medida)
        clave, etiqueta = MEDIDAS.get(medida, (slug(medida or ""), medida))
        items.append({
            "@type": "ListItem",
            "position": len(items) + 1,
            "name": f"{etiqueta} · {medida}",
            "url": grupo.get("url", "https://basestipobox.com/#medidas"),
        })
    return {
        "@context": "https://schema.org",
        "@type": "ItemList",
        "@id": grupo.get("@id", "https://basestipobox.com/#catalogo"),
        "name": "Bases tipo box tapizadas — medidas y tonos",
        "description": grupo.get("description", ""),
        "url": grupo.get("url", "https://basestipobox.com/#medidas"),
        "numberOfItems": len(items),
        "itemListElement": items,
    }


def con_offers(grupo, precios):
    """Opcion B: ProductGroup con `offers` en cada variante."""
    for v in grupo.get("hasVariant", []):
        clave = MEDIDAS.get(v.get("size"), (None, None))[0]
        precio = precios.get(clave)
        if precio is None:
            sys.exit(f"Falta el precio de la medida {v.get('size')!r} ({clave})")
        v["sku"] = "base-box-" + slug(v.get("name", "").replace("Base tipo box ", ""))
        v["brand"] = grupo.get("brand", {"@type": "Brand", "name": "Bases Tipo Box"})
        v["offers"] = {
            "@type": "Offer",
            "url": v.get("url", grupo.get("url")),
            "priceCurrency": "MXN",
            "price": precio,
            "availability": "https://schema.org/InStock",
            "itemCondition": "https://schema.org/NewCondition",
            "seller": {"@id": "https://basestipobox.com/#negocio"},
        }
    return grupo


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("html", help="index.html del sitio")
    ap.add_argument("--precios", nargs="*", default=None,
                    metavar="medida=precio",
                    help="individual=2500 matrimonial=3200 queen=3600 king=4800")
    args = ap.parse_args()

    with open(args.html, encoding="utf-8") as f:
        html = f.read()

    for m in SCRIPT_RE.finditer(html):
        try:
            datos = json.loads(m.group(1))
        except json.JSONDecodeError:
            continue
        if datos.get("@type") != "ProductGroup":
            continue

        if args.precios is None:
            nuevo = item_list(datos)
            modo = "ItemList (sin markup de producto)"
        else:
            precios = dict(p.split("=", 1) for p in args.precios)
            nuevo = con_offers(datos, precios)
            modo = "ProductGroup con offers"

        bloque = ('<script type="application/ld+json">\n'
                  + json.dumps(nuevo, ensure_ascii=False, indent=2)
                  + "\n</script>")
        html = html[:m.start()] + bloque + html[m.end():]
        with open(args.html, "w", encoding="utf-8") as f:
            f.write(html)
        print(f"Listo: bloque reemplazado por {modo} en {args.html}")
        return

    print("No se encontro ningun bloque ProductGroup: nada que corregir.")


if __name__ == "__main__":
    main()
