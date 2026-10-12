# Lari's Bakehouse · sitio web

Sitio estático (HTML, CSS y JS, sin build) de Lari's Bakehouse, casa de
horneados en La Paz 34, Centro, Tepic, Nayarit.

- Vista previa: https://laris-odette.vercel.app/
- Horario: lunes a sábado 9:30–18:30 · domingo cerrado
- WhatsApp: +52 311 343 6860 · Instagram: @laris_bakehouse
- Mientras sea preview, el sitio no se indexa (`noindex`); ver
  [Lanzamiento](#checklist-de-lanzamiento).

## Estructura

```
laris/
├─ index.html        portada (dos fotos + "ver la carta")
├─ carta.html        productos, pedido y encargos
├─ cuaderno.html     notas del obrador
├─ visitanos.html    dirección, horario, mapa
├─ 404.html          página de "no encontrado"
├─ assets/
│  ├─ styles.css     estilo general
│  ├─ bolsa.css      pedido (bolsa) e índice de la carta
│  ├─ app.js         menú, "abierto ahora", encargo
│  ├─ bolsa.js       pedido por WhatsApp
│  ├─ carta.js       índice de categorías de la carta
│  ├─ favicon.svg
│  └─ img/           fotos .webp + og.jpg
├─ tools/fotos.py    prepara fotos nuevas
├─ fotos-nuevas/     aquí se dejan las fotos sin procesar
├─ robots.txt · sitemap.xml · site.webmanifest
├─ vercel.json       cabeceras y caché
├─ .vercelignore     lo que no se publica (README, tools/, fotos-nuevas/)
└─ .gitignore        las fotos de fotos-nuevas/ no entran al repo
```

## Verlo en tu compu

```sh
cd laris
python3 -m http.server 8000
```

Abre http://localhost:8000. (En Windows usa `py` en lugar de `python3`.)
No abras los `.html` con doble clic: la página 404 y algunos enlaces
necesitan servidor.

## Fotos

### Qué foto es cuál

Todas viven en `assets/img/`.

| Archivo | Dónde | Medidas |
|---|---|---|
| `pan-01…04` | carta · hojaldres | 900×900 |
| `gal-01…04` | carta · galletas | 900×900 |
| `past-01…04` | carta · pasteles y tartas | 900×900 |
| `panq-01…03` | carta · panqués | 900×900 |
| `beb-01, 02, 04` | carta · para tomar | 900×900 |
| `llevar-01…03` | carta · para llevar | 900×900 |
| `hero-a, hero-b` | portada (hero-a se ve en b/n) | 1200×1600 |
| `cuaderno-01…04` | cuaderno | 1000×1250 |
| `casa-01, 03` | visítanos | 1400×1000 |
| `og.jpg` | vista previa al compartir el enlace | 1200×630 |

Para ver qué producto usa cada archivo, busca el nombre en `carta.html`
o corre `python3 tools/fotos.py --listar` (dice en qué página se usa
cada imagen, cuánto pesa y cuáles sobran).

### Cambiar la foto de un producto

1. Copia la foto original (jpg, png, webp o heic) a `fotos-nuevas/`.
2. Procésala con el nombre del archivo que reemplaza:
   ```sh
   python3 tools/fotos.py fotos-nuevas/IMG_2041.jpg --nombre pan-02 --forzar
   ```
3. En `carta.html`, en el `<img>` de ese producto:
   - actualiza el `alt` para que describa la foto nueva;
   - agrega o sube `?v=` al `src`: `assets/img/pan-02.webp?v=2`.
     Las imágenes se guardan 30 días en caché (ver `vercel.json`);
     sin esto, quien ya visitó el sitio puede seguir viendo la anterior.
4. Revísalo en local, borra el original de `fotos-nuevas/` y sube el
   cambio.

Para la portada, el cuaderno o visítanos es igual, con `--tipo`:

```sh
python3 tools/fotos.py fotos-nuevas/foto.jpg -t hero -n hero-b --forzar
python3 tools/fotos.py fotos-nuevas/foto.jpg -t cuaderno -n cuaderno-03 --forzar
python3 tools/fotos.py fotos-nuevas/foto.jpg -t casa -n casa-01 --forzar
```

### `tools/fotos.py`

Necesita Python 3 y Pillow: `python3 -m pip install Pillow`.

Qué hace con cada foto:

- la endereza según el EXIF (fotos de celular giradas);
- quita los metadatos, **incluida la ubicación GPS**;
- la pasa a sRGB y pone las transparencias sobre blanco;
- recorta al centro y reduce según `--tipo`;
- guarda `.webp` calidad 80; si pasa de 180 KB baja hasta 70;
- nunca agranda una foto chica (avisa) y no reemplaza
  archivos sin `--forzar`.

| `--tipo` | Proporción | Medidas |
|---|---|---|
| `producto` (default) | 1:1 | 900×900 |
| `hero` | 3:4 | 1200×1600 |
| `cuaderno` | 4:5 | 1000×1250 |
| `casa` | 7:5 | 1400×1000 |

Ejemplos:

```sh
# todo lo que haya en fotos-nuevas/, como producto
python3 tools/fotos.py

# conservar la parte de arriba al recortar
python3 tools/fotos.py --foco arriba
# también: abajo, izquierda, derecha (default: centro)

# probar sin tocar assets/img/
python3 tools/fotos.py --salida /tmp/pruebas

# inventario de assets/img/
python3 tools/fotos.py --listar

# todas las opciones
python3 tools/fotos.py --help
```

Sin `--nombre`, el archivo de salida toma el nombre de la foto en
minúsculas, sin acentos y con guiones: `Croissant Mañana.JPG` →
`croissant-manana.webp`.

**HEIC (iPhone):** Pillow no lo abre por sí solo; el script avisa y sigue
con las demás. Comparte la foto como JPG (por WhatsApp o correo, o en
Ajustes › Cámara › Formatos › Más compatible) o instala
`python3 -m pip install pillow-heif`.

**No subas los originales:** pueden traer la ubicación GPS. `fotos-nuevas/`
está en `.gitignore` (git no los toma) y en `.vercelignore` (Vercel no los
publica, igual que este README y `tools/`). Aun así, bórralos después de
procesar.

## Añadir un producto a la carta

Pega esto dentro del `<div class="grid">` de su categoría en
`carta.html` y cambia los textos:

```html
<article class="item rv" data-id="nombre-del-producto"
         data-name="nombre del producto" data-cat="galletas">
  <figure><img src="assets/img/gal-05.webp" alt="Qué se ve en la foto"
    width="900" height="900" loading="lazy"></figure>
  <div class="item-row"><h3>nombre del producto</h3><a class="ask"
    href="https://wa.me/523113436860?text=Hola%2C%20%C2%BFhay%20nombre%20del%20producto%20hoy%3F"
    target="_blank" rel="noopener">preguntar</a></div>
  <p>Una línea corta que lo describa.</p>
</article>
```

- `data-id`: único en toda la carta; minúsculas, sin acentos, con
  guiones. Es la clave del pedido: no lo cambies después.
- `data-name`: como aparecerá en el pedido y en el mensaje (igual al
  `<h3>`).
- `data-cat`: el `id` de la sección: `hojaldres`, `galletas`,
  `pasteles`, `panques`, `para-tomar` o `para-llevar`.
- `data-ask-only`: agrégalo si no es una pieza que se pueda pedir así
  ("pedido a domicilio", los pasteles enteros que se cotizan o una foto
  que repite otro producto); solo mostrará "preguntar". Lo que ya
  estaba en la bolsa de alguien con ese `data-id` se quita al abrir la
  carta.
- El enlace "preguntar" funciona aunque el navegador no tenga JS.
  Su texto va codificado para URL; para sacarlo:
  ```sh
  python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))" "Hola, ¿hay … hoy?"
  ```
  Equivalencias comunes: espacio `%20` · `,` `%2C` · `¿` `%C2%BF` ·
  `?` `%3F` · `á` `%C3%A1` · `é` `%C3%A9` · `í` `%C3%AD` · `ó` `%C3%B3` ·
  `ú` `%C3%BA` · `ñ` `%C3%B1`.

¿Categoría nueva? Copia un bloque `<h2 class="section-label eyebrow"
id="…">` + `<div class="grid">` y agrega su enlace en el índice
`<nav class="cat-index">` del inicio de la carta.

## Cómo funciona el pedido por WhatsApp

- En la carta, cada producto tiene "añadir" y luego controles de
  cantidad. Lo elegido se guarda en el navegador de quien visita
  (`localStorage`, clave `laris.bolsa.v1`) y se conserva al cambiar
  de página o recargar.
- Mientras haya algo en el pedido, el encabezado de todas las páginas
  muestra "pedido" con el número de piezas; lleva a `carta.html#bolsa`.
- En el panel del pedido la persona revisa cantidades y pone su nombre
  y cómo y cuándo lo quiere (recoger en La Paz 34 o envío).
- Al enviar se abre WhatsApp con el mensaje ya escrito para el
  +52 311 343 6860; la persona solo toca enviar. Llega algo así:
  ```
  Hola, soy (nombre). Quiero hacer este pedido:

  • 2 × croissant de mantequilla
  • 1 × matcha helado

  Entrega: recoger en La Paz 34
  Día: …
  ```
- No hay servidor, cobros ni precios: el pedido se confirma por chat.
- Sin `localStorage` (modo privado estricto) también funciona, pero el
  pedido se pierde al salir de la página. Sin JS quedan los enlaces
  "preguntar".
- El formulario "por encargo" al final de la carta manda su propio
  mensaje (qué, para cuándo, dedicatoria, notas).
- El estado "abierto ahora / cerrado" se calcula con la hora de Tepic
  (America/Mazatlan), no con la del visitante.

¿Cambia el número? Búscalo en todo el sitio: `grep -rn 523113436860 .`

## Deploy en Vercel

- Repo: `zeusvtejeda-crypto/ISOVAL` (comparte repo con otros sitios).
- Project Settings:
  - **Root Directory: `laris`**
  - Framework Preset: Other
  - Build Command y Output Directory: vacíos
- Cada push a `main` publica a producción; otras ramas y PRs generan
  una URL de vista previa.
- Opcional, para no redesplegar cuando cambian otros sitios del repo:
  en Project Settings, "Ignored Build Step" con
  `git diff HEAD^ HEAD --quiet -- .`
- `vercel.json` (dentro de `laris/`) define cabeceras y la caché de
  30 días para `assets/img/`.

## Checklist de lanzamiento

- [ ] Quitar `<meta name="robots" content="noindex, nofollow">` de
  `index.html`, `carta.html`, `cuaderno.html` y `visitanos.html`.
- [ ] En `404.html` dejar solo `noindex` (sin `nofollow`) o quitarlo.
- [ ] `robots.txt`: cambiar `Disallow: /` por `Allow: /` y borrar el
  comentario de preview.
- [ ] Dominio propio: agregarlo en Vercel › Settings › Domains.
- [ ] Reemplazar `https://laris-odette.vercel.app` por el dominio nuevo
  en todo el sitio:
  - `canonical`, `og:url` y `og:image` de cada página (y la 404);
  - `url` e `image` del JSON-LD en `index.html` y `visitanos.html`;
  - `sitemap.xml` (cada `<loc>`) y la línea `Sitemap:` de `robots.txt`.
  ```sh
  grep -rn "laris-odette.vercel.app" --include=*.html --include=*.xml --include=*.txt .
  ```
- [ ] Actualizar `<lastmod>` en `sitemap.xml`.
- [ ] Probar un pedido real desde un celular hasta WhatsApp.
- [ ] Revisar la vista previa al compartir el enlace (og.jpg).
- [ ] `python3 tools/fotos.py --listar`: nada pesado ni sin uso.

---

Sitio por LYM Villeda.
