# papa-40 — Feliz cumpleaños, Papá ❤️

Página regalo para los 40 años (11 · 09 · 1986 → 11 · 09 · 2026).
Next.js + Tailwind CSS v4 + Framer Motion. Con `noindex` (no aparece en Google).

> **OJO:** las imágenes de `/public/fotos/` y los posters de `/public/videos/`
> en este repo son **placeholders**. Las fotos y videos reales están en tu Mac,
> en `/Users/zv/aPP/papa-40/public/`. Abajo dice cómo pasarlos.

## Correr en local

```bash
cd papa-40
npm install
npm run dev        # abre http://localhost:3000
```

Fecha para desbloquear: **11 / 09 / 1986**.

## Pasar tus fotos y videos reales (desde tu Mac)

```bash
# clona el repo (o haz pull si ya lo tienes)
git clone https://github.com/zeusvtejeda-crypto/isoval.git
cd isoval && git checkout claude/adoring-mccarthy-mrjp85

# copia tus archivos reales encima de los placeholders
cp /Users/zv/aPP/papa-40/public/fotos/foto-*.jpg   papa-40/public/fotos/
cp /Users/zv/aPP/papa-40/public/videos/video-*     papa-40/public/videos/

git add papa-40/public && git commit -m "Fotos y videos reales" && git push
```

## La canción (Volver al Futuro 🎬)

1. Consigue el MP3: un cover instrumental del tema de *Back to the Future*
   o de *The Power of Love* (Huey Lewis), o algo synthwave ochentero.
   Búscalo como "Back to the Future theme instrumental" en tu tienda de
   música, o usa una versión libre de regalías si la vas a dejar pública.
2. Guárdalo como `papa-40/public/audio/cancion.mp3` y haz push.
3. Listo: al desbloquear la página aparece "¿Quieres vivir esta historia
   con música?" con el guiño a viajar en el tiempo. Si el archivo no existe,
   el botón de música se oculta solo (no truena nada).

Mensaje de voz opcional ("Papá, escucha esto"): sube `public/audio/mensaje.mp3`
y en `data/config.ts` cambia `voiceNote: "/audio/mensaje.mp3"`.

## Editar contenido (sin tocar componentes)

| Archivo | Qué controla |
|---|---|
| `data/config.ts` | foto principal, canción, frases de música, voz |
| `data/memories.ts` | línea del tiempo + sección "Nosotros" (incluye el bloque del hermano) |
| `data/reasons.ts` | las 40 razones |
| `data/letter.ts` | la carta final |

Layouts para recuerdos: `text`, `large`, `duo`, `polaroid`, `side`, `video`.

## Publicar en Vercel

1. Entra a [vercel.com](https://vercel.com) → **Add New… → Project**.
2. Importa el repo `zeusvtejeda-crypto/isoval` (conecta GitHub si te lo pide).
3. En **Root Directory** elige `papa-40` (Edit → selecciona la carpeta).
4. Framework: Next.js (lo detecta solo). Deploy.
5. Te da una URL tipo `papa-40.vercel.app`; puedes cambiar el nombre en
   Settings → Domains.

Cada `git push` a la rama conectada vuelve a desplegar solo.

## Detalles escondidos

- Mantén presionada una foto en pantalla completa → mensaje sorpresa.
- Toca 3 veces el panel de "circuitos de tiempo" del contador → ⚡ 88 MPH.
- La primera vez que llega al final → "Gracias por ser mi papá."
