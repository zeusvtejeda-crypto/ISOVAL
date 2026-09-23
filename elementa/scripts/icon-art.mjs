/**
 * Elementa · arte vectorial de los iconos (fuente única de verdad).
 *
 * Todo se dibuja con trazos y rectángulos (sin <text>) para que el resultado sea idéntico
 * en navegadores y en librsvg (sharp), sin depender de fuentes instaladas.
 * Sistema de coordenadas: lienzo de 512 × 512.
 */

const SIZE = 512;
const CENTER = SIZE / 2;

/** Degradado de marca: violeta vivo → índigo. */
export const BRAND = {
  from: '#8a5cff',
  via: '#6841f0',
  to: '#3f30c6',
  depth: '#2c1d93',
};

/** Casilla de la tabla periódica: cara + canto inferior (efecto "presionable" de la app). */
const TILE = { x: 32, y: 32, width: 448, height: 432, radius: 104, depth: 16 };

/** Centro óptico de las letras "El" (se usa para escalar en los iconos a sangre). */
const GLYPH_CENTER = { x: 256, y: 250 };

/** "El": trazos redondeados y gruesos, al estilo de Nunito Black. */
const LETTERS_PATH = 'M275 180H165V356H275M165 268H255M349 144V356';
const LETTERS_STROKE = 54;

/** Número atómico diminuto (118: todos los elementos) en la esquina superior izquierda. */
const NUMBER_MARKUP =
  '<path d="M92 88L104 78V128M122 88L134 78V128"/>' + // 1 1
  '<circle cx="164" cy="90" r="10.5"/><circle cx="164" cy="114.5" r="13"/>'; // 8
const NUMBER_STROKE = 12;

function gradientDefs(id, { from, via, to }) {
  return [
    `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">`,
    `<stop offset="0" stop-color="${from}"/>`,
    `<stop offset=".55" stop-color="${via}"/>`,
    `<stop offset="1" stop-color="${to}"/>`,
    '</linearGradient>',
  ].join('');
}

const GLOSS_DEFS =
  '<linearGradient id="el-gloss" x1="0" y1="0" x2="0" y2="1">' +
  '<stop offset="0" stop-color="#fff" stop-opacity=".22"/>' +
  '<stop offset=".48" stop-color="#fff" stop-opacity="0"/>' +
  '</linearGradient>';

function tile(fillId, depthColor) {
  const { x, y, width, height, radius, depth } = TILE;
  return [
    `<rect x="${x}" y="${y + depth}" width="${width}" height="${height}" rx="${radius}" fill="${depthColor}"/>`,
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="url(#${fillId})"/>`,
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="url(#el-gloss)"/>`,
  ].join('');
}

function glyphs({ showNumber }) {
  const number = showNumber
    ? `<g class="el-z" stroke-width="${NUMBER_STROKE}" stroke-opacity=".8">${NUMBER_MARKUP}</g>`
    : '';
  return (
    '<g fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round">' +
    number +
    `<path d="${LETTERS_PATH}" stroke-width="${LETTERS_STROKE}"/>` +
    '</g>'
  );
}

function svg(body, { title = 'Elementa', style = '' } = {}) {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">` +
    '<!-- Generado por scripts/generate-icons.mjs (npm run icons): edita el arte en scripts/icon-art.mjs. -->' +
    `<title>${title}</title>` +
    style +
    body +
    '</svg>\n'
  );
}

/**
 * Icono principal (propósito "any", esquinas transparentes).
 * @param {{ showNumber?: boolean }} [options] `showNumber: false` para favicons de 16–48 px.
 */
export function appIconSvg({ showNumber = true } = {}) {
  // En tamaños de favicon el número atómico sería ruido: el propio SVG lo oculta con una media query.
  const style = showNumber ? '<style>@media (max-width:48px){.el-z{display:none}}</style>' : '';
  return svg(
    `<defs>${gradientDefs('el-face', BRAND)}${GLOSS_DEFS}</defs>` + tile('el-face', BRAND.depth) + glyphs({ showNumber }),
    { style },
  );
}

/**
 * Icono a sangre (fondo cuadrado completo, sin transparencia): maskable y apple-touch-icon.
 * @param {{ scale: number }} options Escala del contenido alrededor del centro (maskable: dentro del 80 %).
 */
export function fullBleedSvg({ scale }) {
  const transform = `translate(${CENTER} ${CENTER}) scale(${scale}) translate(${-GLYPH_CENTER.x} ${-GLYPH_CENTER.y})`;
  return svg(
    `<defs>${gradientDefs('el-face', BRAND)}${GLOSS_DEFS}</defs>` +
      `<rect width="${SIZE}" height="${SIZE}" fill="url(#el-face)"/>` +
      `<rect width="${SIZE}" height="${SIZE}" fill="url(#el-gloss)"/>` +
      `<g transform="${transform}">${glyphs({ showNumber: true })}</g>`,
  );
}

/** Pictogramas blancos de los accesos directos del manifiesto (centrados en la casilla). */
const SHORTCUT_GLYPHS = {
  /** Rayo: "Estudiar ahora". */
  estudiar:
    '<path d="M290 104L170 276H250L222 404L342 228H262Z" fill="#fff" stroke="#fff" stroke-width="22" stroke-linejoin="round"/>',
  /** Silueta de la tabla periódica. */
  tabla: (() => {
    const cell = 46;
    const gap = 10;
    const cols = 6;
    const rows = [[0, 5], [0, 1, 3, 4, 5], [0, 1, 2, 3, 4, 5], [0, 1, 2, 3, 4, 5]];
    const width = cols * cell + (cols - 1) * gap;
    const height = rows.length * cell + (rows.length - 1) * gap;
    const x0 = CENTER - width / 2;
    const y0 = 248 - height / 2;
    return rows
      .flatMap((row, r) =>
        row.map((c) => {
          const opacity = r === 0 && c === 0 ? '' : r === 1 && c > 1 ? ' fill-opacity=".72"' : '';
          return `<rect x="${x0 + c * (cell + gap)}" y="${y0 + r * (cell + gap)}" width="${cell}" height="${cell}" rx="11" fill="#fff"${opacity}/>`;
        }),
      )
      .join('');
  })(),
  /** Cronómetro: "Contrarreloj". */
  contrarreloj:
    '<g fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round">' +
    '<circle cx="256" cy="272" r="112" stroke-width="36"/>' +
    '<path d="M256 272V204" stroke-width="32"/>' +
    '<path d="M222 110H290M256 110V150" stroke-width="30"/>' +
    '<path d="M352 164L374 142" stroke-width="28"/>' +
    '</g>',
  /** Dos tarjetas superpuestas: "Flashcards". */
  flashcards:
    '<rect x="150" y="128" width="170" height="232" rx="30" fill="#fff" fill-opacity=".5" transform="rotate(-12 235 244)"/>' +
    '<g transform="rotate(8 290 262)">' +
    '<rect x="200" y="146" width="180" height="236" rx="30" fill="#fff"/>' +
    '<path d="M240 226H340M240 268H316M240 310H330" stroke="#0e8a52" stroke-opacity=".6" stroke-width="18" stroke-linecap="round"/>' +
    '</g>',
};

/** Colores de cada acceso directo (el degradado de la casilla). */
const SHORTCUT_COLORS = {
  estudiar: BRAND,
  tabla: { from: '#4f9bff', via: '#3a74e6', to: '#2549b8', depth: '#1b3689' },
  contrarreloj: { from: '#ff9a4a', via: '#f26b1d', to: '#cf4210', depth: '#9c300a' },
  flashcards: { from: '#3fd98a', via: '#1bb36a', to: '#0e8a52', depth: '#0a663c' },
};

/** @typedef {keyof typeof SHORTCUT_GLYPHS} ShortcutId */

/** @type {ShortcutId[]} */
export const SHORTCUT_IDS = /** @type {ShortcutId[]} */ (Object.keys(SHORTCUT_GLYPHS));

/** @param {ShortcutId} id */
export function shortcutSvg(id) {
  const colors = SHORTCUT_COLORS[id];
  return svg(
    `<defs>${gradientDefs('el-face', colors)}${GLOSS_DEFS}</defs>` + tile('el-face', colors.depth) + SHORTCUT_GLYPHS[id],
  );
}
