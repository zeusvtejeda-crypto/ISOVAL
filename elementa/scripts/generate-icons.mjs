#!/usr/bin/env node
/**
 * Genera todos los iconos de Elementa a partir del arte vectorial de `scripts/icon-art.mjs`:
 *
 *   src/app/icon.svg              favicon vectorial (Next.js lo enlaza solo)
 *   src/app/favicon.ico           16/32/48 px (PNG dentro de ICO) para navegadores sin SVG
 *   src/app/apple-icon.png        180 × 180, a sangre y sin transparencia (iOS)
 *   public/icons/icon-{192,512}.png            propósito "any"
 *   public/icons/maskable-{192,512}.png        propósito "maskable" (contenido dentro del 80 %)
 *   public/icons/shortcut-<id>.png             96 × 96, accesos directos del manifiesto
 *
 * Uso: `npm run icons`. Requiere `sharp` (viene instalado como dependencia de Next.js).
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { appIconSvg, BRAND, fullBleedSvg, SHORTCUT_IDS, shortcutSvg } from './icon-art.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const APP_DIR = join(ROOT, 'src', 'app');
const ICONS_DIR = join(ROOT, 'public', 'icons');

/** Tamaño de diseño del arte (viewBox 512 × 512). */
const ART_SIZE = 512;
/** Maskable: el contenido debe caber en un círculo de radio 40 %; dejamos margen extra. */
const MASKABLE_SCALE = 0.74;
/** iOS recorta con esquinas suaves: el contenido puede ser algo mayor. */
const APPLE_SCALE = 0.86;

async function loadSharp() {
  try {
    const { default: sharp } = await import('sharp');
    return sharp;
  } catch {
    console.error('✖ No se encontró "sharp". Instala las dependencias (npm install) y vuelve a intentarlo.');
    process.exit(1);
  }
}

const sharp = await loadSharp();

/**
 * Rasteriza un SVG directamente al tamaño final (sin reescalar un bitmap), para bordes nítidos.
 * @param {string} svg
 * @param {number} size
 * @param {{ opaque?: boolean }} [options]
 */
async function renderPng(svg, size, { opaque = false } = {}) {
  let image = sharp(Buffer.from(svg), { density: (72 * size) / ART_SIZE }).resize(size, size, { fit: 'fill' });
  if (opaque) image = image.flatten({ background: BRAND.via }).removeAlpha();
  return image.png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
}

/**
 * Empaqueta PNG en un .ico (formato con PNG embebidos, compatible con todos los navegadores actuales).
 * @param {{ size: number, data: Buffer }[]} images
 */
function encodeIco(images) {
  const HEADER = 6;
  const ENTRY = 16;
  const header = Buffer.alloc(HEADER);
  header.writeUInt16LE(0, 0); // reservado
  header.writeUInt16LE(1, 2); // tipo: icono
  header.writeUInt16LE(images.length, 4);

  let offset = HEADER + ENTRY * images.length;
  const entries = images.map(({ size, data }) => {
    const entry = Buffer.alloc(ENTRY);
    entry.writeUInt8(size >= 256 ? 0 : size, 0); // ancho (0 = 256)
    entry.writeUInt8(size >= 256 ? 0 : size, 1); // alto
    entry.writeUInt8(0, 2); // colores de paleta
    entry.writeUInt8(0, 3); // reservado
    entry.writeUInt16LE(1, 4); // planos
    entry.writeUInt16LE(32, 6); // bits por píxel
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    return entry;
  });

  return Buffer.concat([header, ...entries, ...images.map(({ data }) => data)]);
}

/** @param {string} file @param {Buffer | string} contents */
async function write(file, contents) {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, contents);
  const bytes = typeof contents === 'string' ? Buffer.byteLength(contents) : contents.length;
  console.log(`✔ ${relative(ROOT, file)} (${(bytes / 1024).toFixed(1)} KB)`);
}

async function main() {
  const icon = appIconSvg();
  const smallIcon = appIconSvg({ showNumber: false });

  await write(join(APP_DIR, 'icon.svg'), icon);

  const favicons = await Promise.all([16, 32, 48].map(async (size) => ({ size, data: await renderPng(smallIcon, size) })));
  await write(join(APP_DIR, 'favicon.ico'), encodeIco(favicons));

  await write(join(APP_DIR, 'apple-icon.png'), await renderPng(fullBleedSvg({ scale: APPLE_SCALE }), 180, { opaque: true }));

  const maskable = fullBleedSvg({ scale: MASKABLE_SCALE });
  for (const size of [192, 512]) {
    await write(join(ICONS_DIR, `icon-${size}.png`), await renderPng(icon, size));
    await write(join(ICONS_DIR, `maskable-${size}.png`), await renderPng(maskable, size, { opaque: true }));
  }

  for (const id of SHORTCUT_IDS) {
    await write(join(ICONS_DIR, `shortcut-${id}.png`), await renderPng(shortcutSvg(id), 96));
  }
}

main().catch((error) => {
  console.error('✖ Error al generar los iconos:', error);
  process.exit(1);
});
