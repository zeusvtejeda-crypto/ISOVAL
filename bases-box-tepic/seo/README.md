# Fix: Datos estructurados de Fragmentos de productos (basestipobox.com)

Search Console reporta 1 problema critico en https://basestipobox.com/:

> Debe especificarse "hasVariant.offers", "review" o "aggregateRating"

## Causa

El tercer bloque `application/ld+json` del `index.html` publicado declara un
`ProductGroup` con 32 variantes (4 medidas x 8 tonos) y ninguna de ellas trae
`offers`. Google exige `offers` (o `review` / `aggregateRating`) en cada
variante para los fragmentos de producto. Los otros dos bloques
(`FurnitureStore` y `FAQPage`) estan correctos y no se tocan.

El sitio en vivo se sirve desde Vercel como HTML estatico; su fuente no vive en
este repositorio, por eso el arreglo se entrega como parche aplicable.

## Como aplicarlo

Sobre el `index.html` que se sube a Vercel:

```sh
# Opcion A (recomendada): quitar el markup de producto
python3 seo/fix-product-schema.py ruta/al/index.html

# Opcion B: conservar ProductGroup y publicar precios reales en MXN
python3 seo/fix-product-schema.py ruta/al/index.html --precios \
    individual=2500 matrimonial=3200 queen=3600 king=4800
```

El script es idempotente: si el bloque ya fue corregido, no hace nada.
Despues, `vercel --prod` y en Search Console usar "Validar correccion".

## Por que la opcion A es la recomendada

El sitio no publica precios a proposito (se cotiza por WhatsApp). Sin `price`
Google no entrega el rich result de producto, asi que el `ProductGroup` solo
generaba el error sin beneficio posible. La opcion A lo sustituye por un
`ItemList` informativo con las cuatro medidas.

`review` / `aggregateRating` no es una salida valida aqui: exige resenas reales
y visibles en la pagina.

## Archivos

- `fix-product-schema.py` — parche automatico, ambas opciones.
- `opcion-A-itemlist-sin-product.json` — bloque final de la opcion A.
- `opcion-B-productgroup-con-offers.json` — bloque final de la opcion B, con
  `PRECIO_INDIVIDUAL`, `PRECIO_MATRIMONIAL`, `PRECIO_QUEEN` y `PRECIO_KING`
  como marcadores por sustituir.
