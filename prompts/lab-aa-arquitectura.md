# LAB A+A (index.html) — Pack de prompts IA

> ⚠️ La página raíz está marcada **LAB A+A — Appraiser & Architect**, no "Isoval". Comparte teléfono (311 161 4155) con el perfil de Isoval del asistente de WhatsApp (`whatsapp-assistant/businesses/isoval.js`, que dice isoval.com.mx / @isoval.arq / correo isovalinc@gmail.com; la web dice arqlabaa@gmail.com). Decide qué marca va antes de generar piezas con logo o nombre. Los prompts abajo usan `{MARCA}`.

Estado de la página: **12 fotos ya (renders 3D de buena calidad)**: 4 hero, 5 portafolio, 1 about, 1 quote. **Falta**: video hero, equipo/retratos, obra real en proceso, valuación (no hay ni una imagen), testimonios, piezas para redes.

## Datos fijos
| Campo | Valor |
|---|---|
| Paleta | Crema `#F3EDE0` · Crema tarjeta `#F9F5EE` · Carbón cálido `#231C10` · Café `#5C4A36` · Rojo logo `#E8192C` |
| Tipografías | Fraunces (serif editorial, itálica pesada en acentos) · JetBrains Mono (etiquetas MAYÚSCULAS espaciadas) |
| Estilo web | Editorial, minimalista cálido, grano de papel, old school arquitectónico |
| Servicios | Diseño arquitectónico · Construcción integral · Valuación inmobiliaria · Supervisión de obra · Interiores |
| Cifras | +12 años · +200 proyectos · 98% satisfacción · +18% plusvalía anual Riviera Nayarit |
| Frases | "No es solo un espacio. Es tu legado." · "Del trazo exacto a la obra terminada." · "Construimos espacios que trascienden lo ordinario." |
| Zonas | Tepic (sede) · Xalisco · Compostela · Bahía de Banderas · Sayulita · Punta Mita · San Blas · Puerto Vallarta |
| Contacto | WhatsApp 311 161 4155 |

---

## A. ChatGPT (imágenes)

### A0. Pega esto PRIMERO
```
You are generating imagery for "{MARCA}", an architecture, construction and real-estate appraisal studio in Tepic, Nayarit, Mexico. Keep this style in every image:
- Photography: warm editorial architectural photography, golden-hour or soft overcast light, natural materials (white stucco, warm wood, volcanic stone, terracotta/celosía brick screens, tropical vegetation), Pacific-Mexico context. Photoreal, no CGI look, no HDR.
- Graphics: cream paper #F3EDE0 background with subtle grain, warm charcoal #231C10 text, one red #E8192C accent (a thin line, a numeral, an italic word). Serif editorial headline (Fraunces-like), tiny spaced monospace uppercase labels.
- On-image text only when I write it, in Spanish, exactly as written.
- No watermarks, no fake logos, no people unless asked.
Confirm and wait.
```

### A1. Valuación inmobiliaria (falta por completo) — 3 imágenes 4:5
```
1 — Editorial still life, 4:5: an appraisal report open on a walnut desk, architectural plans, a laser distance meter, a brass caliper and a fountain pen, cream paper tones, warm side light, shallow depth of field. No legible text.
2 — Exterior, 4:5: an appraiser's hand holding a clipboard in the foreground, out of focus a contemporary white house with a terracotta celosía wall in Tepic, morning light. Hands only, no face.
3 — Graphic, 4:5: cream #F3EDE0 paper with grain, big red #E8192C serif numeral "+18 %", below in charcoal serif "Plusvalía anual en Riviera Nayarit", tiny monospace label top-left "VALUACIÓN · NAYARIT". Lots of white space.
```

### A2. Equipo / retratos (2–3, 4:5)
```
Editorial portrait, 4:5: a Mexican architect in their 30s–40s, {GÉNERO}, neutral linen shirt, standing in a bright unfinished concrete space with a white stucco wall, holding a rolled plan, warm soft window light, muted cream/earth palette, calm confident expression, Fraunces-cover-photo feeling. Photoreal.
```
Repite con `{GÉNERO}` = woman / man. Úsalos solo como placeholder hasta tener fotos reales.

### A3. Obra real en proceso (carrusel "Proceso", 4 slides 1:1)
```
Four-image series, 1:1, same warm documentary style, Nayarit residential construction:
01 "Consulta inicial" — architect and client hands over a site plan on a table under a palapa, coffee cups, no faces.
02 "Propuesta" — printed renders and a Gantt schedule pinned on a cream wall, red marker circling a date.
03 "Ejecución" — workers in hard hats pouring a concrete slab at sunrise, steel rebar grid, dust in the light, no faces.
04 "Entrega" — a set of house keys and a folder of documents on a marble kitchen counter, sunlight from a window.
```

### A4. Quote / fondo de cita (16:9 y 9:16)
```
Atmospheric background, {FORMATO}: a white contemporary house facade in Nayarit at dusk, warm interior lights on, palm silhouettes, pink-orange sky, very dark and calm, 60% of the frame low-contrast so serif text can sit on top.
```

### A5. Plantilla de post editorial (1:1, 5 variantes)
```
Instagram post, 1:1: cream #F3EDE0 paper with subtle grain. Top-left tiny monospace uppercase "{MARCA} · TEPIC, NAYARIT" with a 32px red rule to its left. Center, large serif headline in charcoal: "{TITULAR}" with the last two words in heavy italic red. Bottom: thin charcoal rule and monospace "311 161 4155 · Consulta inicial sin costo". Minimal, editorial, generous margins.
```
Titulares: `No es solo un espacio. Es tu legado.` · `Diseño con propósito. Construcción sin excusas.` · `Presupuesto fijo. Plazo comprometido.` · `Del trazo exacto a la obra terminada.` · `Nayarit vive un boom. El momento es ahora.`

### A6. Antes / después (1:1 díptico)
```
Split image 1:1, thin cream divider in the middle. Left: an old 1980s Mexican house facade in Tepic, faded paint, iron bars, harsh noon light. Right: the same lot rebuilt as a contemporary white house with a wood pergola and celosía wall at golden hour. Same camera position and framing on both halves.
```

### A7. Stories (9:16) — fondos con espacio libre
```
Story background, 9:16: {ESCENA}, top and bottom 20% quiet. Warm editorial palette.
```
Escenas: `close-up of a hand sketching a floor plan with a red pencil on cream trace paper` · `terracotta celosía wall with sunlight pattern on a white floor` · `architectural model of a house on a wood desk`.

---

## B. Gemini / Veo (videos)

### B0. Pega esto PRIMERO
```
Voy a pedirte prompts de video para Veo. Marca: "{MARCA}", despacho de arquitectura, construcción y valuación inmobiliaria en Tepic, Nayarit. Estilo: editorial cálido, luz dorada, materiales naturales (aplanado blanco, madera, piedra volcánica, celosía de barro, palmeras), cámara lenta y elegante. Colores de marca: crema #F3EDE0, carbón #231C10, rojo #E8192C. Sin personas salvo que lo pida, sin texto quemado, sin logos. 8 s por clip. Confirma y espera.
```

### B1. Hero web (16:9, 8s, image-to-video) — usa las fotos existentes
Sube `imgs/hero1.jpg`, `hero2.jpg`, `hero3.jpg`, `hero4.jpg` una por una:
```
Animate this architectural render into an 8-second 16:9 cinematic shot: very slow dolly forward (3%), gentle parallax between foreground vegetation and building, soft wind in the plants, warm dusk light slowly intensifying, subtle moving shadows. Photoreal, no distortion of straight lines, no added objects. Seamless start and end frames.
```
Resultado: 4 clips → reemplazan el slideshow Ken Burns del hero.

### B2. Reel — "Del trazo a la obra" (9:16, 8s)
```
9:16, 8 seconds, warm editorial: 0–2 s macro of a red pencil drawing a straight line on cream trace paper; 2–4 s the line becomes a red laser level line on a fresh concrete wall; 4–6 s time-lapse of white stucco walls rising at sunrise; 6–8 s slow reveal of the finished contemporary house with a celosía wall at golden hour. Smooth match-cuts, no text, no faces.
```
Copy: **"Del trazo exacto a la obra terminada. Consulta inicial sin costo."**

### B3. Reel — Portafolio (9:16, image-to-video con `port1..port5.jpg`)
```
Animate this interior render, 9:16 crop, 8 seconds: slow lateral slide of the camera, light rays moving across the floor, curtains breathing gently, very subtle. Keep architecture perfectly rigid. Photoreal.
```
Copy: **"Proyectos que hablan por sí solos. Residencial · Nayarit."**

### B4. Reel — Valuación (9:16, 8s)
```
9:16, 8 seconds: top-down view of an appraisal report, plans and a laser meter on a walnut desk; a hand places a brass stamp; camera tilts up through a window to a contemporary house in Nayarit under morning light. Calm, precise, warm tones, no faces, no text.
```
Copy: **"Valuación certificada. Decide con datos, no con corazonadas."**

### B5. Reel — Nayarit plusvalía (9:16, 8s)
```
9:16, 8 seconds: aerial drone glide at sunset over the Riviera Nayarit coast — palm groves, white villas with pools, then the camera descends toward a single contemporary house terrace with a lounge. Golden warm light, cinematic, no text.
```
Copy: **"+18 % de plusvalía anual. El momento de construir en Nayarit es ahora."**

### B6. Reel — Garantías (9:16, 8s, motion graphics)
```
9:16, 8 seconds, minimal motion graphics on cream #F3EDE0 paper with grain: a thin red #E8192C line draws four checkmarks one after another, each followed by a blank serif text block area (I will add text). Warm charcoal shapes, elegant easing, paper texture visible.
```
Texto en edición: `Presupuesto fijo` · `Plazo comprometido` · `Equipo directo` · `Documentación completa`.

---

## Qué subir al repo cuando tengas los archivos
```
imgs/hero1.mp4 … hero4.mp4     1920×1080, ≤3 MB c/u, sin audio  (B1)
imgs/valuacion-1..3.webp       1080×1350                          (A1)
imgs/equipo-1..2.webp          1080×1350                          (A2)
imgs/proceso-1..4.webp         1200×1200                          (A3)
```
Pásamelos y conecto el hero en video, agrego imagen a la tarjeta de Valuación y una sección de proceso con fotos.
