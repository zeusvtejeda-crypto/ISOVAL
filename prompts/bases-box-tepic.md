# Bases Box Tepic — Pack de prompts IA (Mes 2)

Estado de la página: **0 fotos reales**. Hero, selector de tonos e infantil son SVG. Todo lo visual de abajo hay que generarlo.

## Datos fijos (no cambiar)
| Campo | Valor |
|---|---|
| Marca | BASES BOX TEPIC (la X en naranja) |
| Paleta | Grafito `#1A1A1A` · Papel `#F4F2ED` · Naranja `#F2591F` · Amarillo `#F2A900` · Acero `#3E4A54` |
| Tipografías | Anton (títulos, MAYÚSCULAS) · Barlow / Barlow Condensed (texto) |
| Tonos (8) | Cocoa `#6F4E37` · Morado `#6B3FA0` · Rosa `#E84E8A` · Gris `#8A8D8F` · Azul `#2E5AAC` · Marino `#1E2A52` · Verde `#39A85B` · Negro `#1A1A1A` |
| Infantil | Rosa · Azul · Amarillo · Verde · Morado |
| Medidas | Individual 1.00×1.90 · Matrimonial 1.35×1.90 · Queen 1.50×2.00 · King 2.00×2.00 · A la medida |
| Producto | Base tipo box tapizada, silueta recta, patas cromadas, estructura reforzada |
| Contacto | WhatsApp 311 121 6033 · Querétaro #285, Col. Centro, Tepic · Lun–Sáb 9:00–19:00 |
| Plan contrato | 20 publicaciones + 4 reels/mes · stories diarias · flyer semanal |

---

## A. ChatGPT (imágenes)

### A0. Pega esto PRIMERO (estilo maestro)
```
You are generating product and social imagery for "Bases Box Tepic", a bed-base (box spring / divan base) factory in Tepic, Nayarit, Mexico. Keep this style for every image I request in this chat:
- Product: upholstered box bed base, clean rectangular silhouette, tight uniform fabric (linen-like texture), 4 chromed cylindrical legs, no headboard unless asked, no mattress unless asked.
- Look: industrial-minimal catalog photography. Graphite `#1A1A1A` or warm paper `#F4F2ED` backgrounds, soft studio light from upper-left, subtle floor shadow, slight 3/4 front angle at eye level.
- Brand accent: orange `#F2591F` used sparingly (a line, a tag, a chip). Never orange fabric unless asked.
- Typography when text is requested: bold condensed uppercase sans (Anton-like) for headlines, medium sans for body. All on-image text in Spanish, exactly as I write it, no extra words.
- No people unless asked, no watermark, no stock-photo look, no fake logos.
Confirm and wait for the first prompt.
```

### A1. Hero web (16:9, 1920×1080) → `bases-box-tepic/img/hero.webp`
```
Hero image: a Morado (#6B3FA0) upholstered box bed base, 3/4 front view, on a polished dark concrete floor against a graphite #1A1A1A wall with a faint 42px grid texture. Chromed legs catch a soft highlight. Leave the left 55% of the frame empty and dark for text overlay. Cinematic, 16:9, photoreal, 8k.
```

### A2. Los 8 tonos (1:1, 1200×1200 c/u) → `bases-box-tepic/img/tonos/{tono}.webp`
Genera 8 veces cambiando `{TONO}` y `{HEX}`:
```
Product shot, square 1:1: the SAME box bed base as before, identical angle, lighting and camera, fabric color {TONO} {HEX}. Warm paper #F4F2ED background, soft floor shadow, chromed legs. Small orange #F2591F chip in the lower-left corner with the text "{TONO}" in bold condensed uppercase. Consistent series look.
```
Ejemplo: `Cocoa #6F4E37`, `Marino #1E2A52`…

### A3. Grid de tonos (4:5 feed, 1080×1350)
```
Catalog grid, 4:5 portrait: 8 small identical box bed bases arranged 2 columns × 4 rows on paper #F4F2ED, each in one fabric color: Cocoa #6F4E37, Morado #6B3FA0, Rosa #E84E8A, Gris #8A8D8F, Azul #2E5AAC, Marino #1E2A52, Verde #39A85B, Negro #1A1A1A. Under each, its name in small condensed uppercase. Top headline in Anton-style black uppercase: "+8 TONOS" with the "8" in orange #F2591F. Bottom bar graphite with white text "Fábrica propia · Tepic".
```

### A4. Medidas (1:1)
```
Infographic-style product image, 1:1, graphite #1A1A1A background: four box bed bases in Gris #8A8D8F fabric, seen from a slight top-front angle, side by side, increasing in size, with thin orange #F2591F dimension lines and labels: "INDIVIDUAL 1.00 × 1.90 m", "MATRIMONIAL 1.35 × 1.90 m", "QUEEN 1.50 × 2.00 m", "KING 2.00 × 2.00 m". Headline top-left in white condensed uppercase: "TODAS LAS MEDIDAS". Small footer: "¿Otra medida? La hacemos.".
```

### A5. Línea infantil (4:5)
```
Lifestyle shot, 4:5: a child's bright bedroom with an Individual box bed base in Rosa #E84E8A, mattress with plain white sheets, a second base in Azul #2E5AAC visible behind. Playful but tidy: wooden toys, a small rug, soft daylight from a window. No children faces. Colors clean, not cartoonish. Space at the top for a headline.
```
Variante 2: cambia Rosa por Amarillo `#F2A900` y Azul por Verde `#39A85B`.

### A6. Fábrica propia (4:5, 3 imágenes para carrusel)
```
1/3 — Documentary workshop photo, 4:5: a Mexican upholsterer's hands stapling grey fabric tight over a wooden box-base frame, workbench, natural light, sawdust, staple gun, close crop on hands and fabric. Warm realistic tones.
2/3 — Same workshop: rows of finished box bed bases in different colors stacked neatly, chromed legs in a crate in the foreground, "hecho en Tepic" feel, no signage.
3/3 — Detail macro: chromed cylindrical leg screwed into the reinforced corner of the frame, fabric edge perfectly folded, shallow depth of field.
```

### A7. Flyer semanal (plantilla, 4:5 y 9:16)
```
Promotional flyer, {FORMATO}: Morado box bed base 3/4 view centered on graphite #1A1A1A, big orange #F2591F diagonal band behind it. Text, all uppercase condensed bold: top "BASES BOX TEPIC", middle huge "COTIZA HOY", below in white "+8 tonos · Todas las medidas · Directo de fábrica", bottom pill button in orange "WhatsApp 311 121 6033". Clean, high contrast, legible on phone.
```
Sustituye `{FORMATO}` por `4:5 portrait` (feed) o `9:16 vertical` (story).

### A8. Story diaria (9:16, plantillas)
```
Instagram story background, 9:16: {ESCENA}. Keep the top 20% and bottom 20% free of detail for text and stickers. Brand colors graphite/paper/orange.
```
Escenas: `a Negro base in a moody hotel-like bedroom` · `close-up of Cocoa fabric texture with chromed leg` · `paper background with a single orange chip that says "¿DE QUÉ COLOR ES TU CUARTO?"`.

### A9. Carrusel "Por qué Bases Box" (6 slides 1:1)
```
Six-slide carousel, 1:1, same layout each slide: paper #F4F2ED background, big orange number top-left (01…06), Anton-style headline, one simple line icon in graphite, and a box base cropped at the bottom. Slides: 01 "ESTRUCTURA DURABLE" · 02 "+8 TONOS" · 03 "DISEÑO MINIMALISTA" · 04 "FABRICACIÓN LOCAL" · 05 "A LA MEDIDA" · 06 "COTIZACIÓN EL MISMO DÍA". Deliver as 6 separate images.
```

---

## B. Gemini / Veo (videos) — 4 reels + 1 loop web

### B0. Pega esto PRIMERO
```
Voy a pedirte prompts de video para Veo. Marca: "Bases Box Tepic", fábrica de bases de cama tipo box en Tepic, Nayarit. Producto: base tapizada rectangular, patas cromadas, 8 tonos (cocoa, morado, rosa, gris, azul, marino, verde, negro). Colores de marca: grafito #1A1A1A, papel #F4F2ED, naranja #F2591F. Estilo: catálogo industrial-minimal, luz de estudio suave, cámara lenta y estable. Sin personas salvo que lo pida, sin texto quemado (yo pongo el texto en edición), sin logos. Cada video 8 s, vertical 9:16, salvo indicación. Confirma y espera.
```

### B1. Reel 1 — Cambio de tono (9:16, 8s)
```
Cinematic product video, 9:16, 8 seconds: a single upholstered box bed base on a polished concrete floor against a graphite wall. Camera slowly orbits 30° around it at eye level. Every 1 second the fabric color morphs smoothly to the next: cocoa → purple → pink → grey → blue → navy → green → black. Chromed legs stay constant, soft studio light, subtle dust particles. No text.
```
Copy: **"Toca un color y la base se transforma. ¿Cuál va con tu cuarto?"** · CTA WhatsApp.

### B2. Reel 2 — Fábrica propia (9:16, 8s)
```
Documentary-style workshop video, 9:16, 8 seconds, natural warm light: 0–3 s close-up of hands stretching grey fabric over a wooden frame and firing a pneumatic stapler; 3–5 s a chromed leg being screwed into a reinforced corner; 5–8 s slow dolly back revealing a row of finished bases in different colors. Real textures, slight handheld feel, no faces, no text.
```
Copy: **"Hechas en Tepic. Directo de fábrica, sin intermediarios."**

### B3. Reel 3 — Medidas (9:16, 8s)
```
Clean 3D-style product animation, 9:16, 8 seconds, graphite background: a grey box bed base seen from a top-front angle grows step by step — Individual, Matrimonial, Queen, King — each step accompanied by thin orange measurement lines that draw themselves around it. Smooth easing, minimal, satisfying. No text (I will add labels).
```
Copy: **"Individual · Matrimonial · Queen · King. Y si no, a tu medida."**

### B4. Reel 4 — Infantil (9:16, 8s)
```
Bright lifestyle video, 9:16, 8 seconds: morning sunlight in a kid's bedroom, slow push-in on an individual box bed base in pink with white sheets; a soft toy lands on the bed; cut to a second room with the same base in yellow. Cheerful, clean, real-looking, no children faces, no text.
```
Copy: **"La habitación que tus pequeños merecen. Colores alegres, estructura que aguanta."**

### B5. Loop hero web (16:9, 8s, para reemplazar el cubo SVG)
```
Seamless loop, 16:9, 8 seconds: a purple #6B3FA0 box bed base on dark concrete, graphite wall, a slow light sweep travels left to right across the fabric and chromed legs, camera almost static with a 2% slow push-in. Left half of frame kept dark and empty for headline text. Ends on the same frame it starts.
```

---

## Qué subir al repo cuando tengas los archivos
```
bases-box-tepic/img/hero.webp              1920×1080  (A1)
bases-box-tepic/img/hero.mp4               1920×1080  (B5, ≤3 MB, sin audio)
bases-box-tepic/img/tonos/cocoa.webp …     1200×1200  (A2, 8 archivos, nombres en minúscula)
bases-box-tepic/img/medidas.webp           1200×1200  (A4)
bases-box-tepic/img/infantil.webp          1080×1350  (A5)
bases-box-tepic/img/fabrica-1..3.webp      1080×1350  (A6)
```
Pásamelos y conecto la página: hero con video, selector de tonos con foto real por color, sección infantil y galería "fábrica".
