// Genera los íconos de la PWA del panel (app/icons/*) a partir de un SVG maestro.
//
//   node scripts/gen-icons.mjs
//
// Requiere Playwright con Chromium (en este entorno: paquete global 'playwright' y navegadores en
// /opt/pw-browsers). Si no lo encuentra en node_modules, lo busca en `npm root -g`.
//
// Salida (todo en app/icons/):
//   icon.svg              maestro vectorial (cuadro redondeado, fondo tinta, marca en latón)
//   icon-192.png          purpose "any"
//   icon-512.png          purpose "any"
//   maskable-512.png      purpose "maskable": sangrado completo, marca dentro del 80% central (zona segura)
//   apple-touch-icon.png  180×180 opaco (iOS redondea las esquinas por su cuenta)
//   favicon-32.png        pestaña del navegador (versión simplificada, sin anillo)
//   shortcut-agenda.png, shortcut-new.png, shortcut-cash.png   96×96 para los atajos del manifest
//
// La marca es la del logo de app/lib/icons.js ('logo'): dos piezas + navajas cruzadas.
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'app', 'icons');

// ── Paleta ──
const INK = '#15130F';
const BRASS = '#D9B25A';
const BRASS_HI = '#EFD38E';
const BRASS_LO = '#B98E3E';

// ── Marca (coordenadas del viewBox 24×24 del logo; alto útil y = 3…21) ──
const MARK = {
  top: 'M7 3h10v2.5a3 3 0 0 1-3 3h-4a3 3 0 0 1-3-3z',
  bottom: 'M7 21h10v-2.5a3 3 0 0 0-3-3h-4a3 3 0 0 0-3 3z',
  cross: 'M9 8.5 15 15.5M15 8.5 9 15.5',
  // En el ícono grande las navajas se alargan un poco para que crucen por delante de las piezas.
  crossLong: 'M8.6 8 15.4 16M15.4 8 8.6 16'
};

/**
 * SVG de ícono.
 * @param {object} o
 * @param {number} o.size        lado en px (el viewBox es size×size)
 * @param {number} o.radius      radio de esquinas (0 = sangrado completo)
 * @param {number} o.markH       alto de la marca como fracción del lado
 * @param {number} [o.ring]      radio del anillo como fracción del lado (0 = sin anillo)
 * @param {boolean} [o.pivot]    remache en el cruce de las navajas
 * @param {number} [o.knock]     separación en tinta alrededor de las navajas (unidades del logo; 0 = sin)
 * @param {boolean} [o.long]     navajas alargadas (cruzan por delante de las piezas)
 * @param {number} [o.stroke]    grosor de las navajas en unidades del logo (24)
 * @param {boolean} [o.glow]     brillo cálido de fondo
 */
function iconSvg(o) {
  const S = o.size;
  const c = S / 2;
  const s = (o.markH * S) / 18; // escala: 18 unidades de alto → markH·S px
  const tx = c - 12 * s;
  const ty = c - 12 * s;
  const stroke = o.stroke || 2.2;
  const bg = o.radius
    ? `<rect width="${S}" height="${S}" rx="${round(o.radius * S)}" fill="${INK}"/>`
    : `<rect width="${S}" height="${S}" fill="${INK}"/>`;
  const clip = o.radius ? `<clipPath id="cl"><rect width="${S}" height="${S}" rx="${round(o.radius * S)}"/></clipPath>` : '';
  const glow = o.glow === false ? '' :
    `<rect width="${S}" height="${S}" fill="url(#glow)"${o.radius ? ' clip-path="url(#cl)"' : ''}/>`;
  const ring = o.ring
    ? `<circle cx="${c}" cy="${c}" r="${round(o.ring * S)}" fill="none" stroke="url(#brass)" stroke-opacity=".42" stroke-width="${round(S * 0.011)}"/>`
    : '';
  const cross = o.long ? MARK.crossLong : MARK.cross;
  const knock = o.knock
    ? `<path d="${cross}" fill="none" stroke="${INK}" stroke-width="${round(stroke + 2 * o.knock, 3)}" stroke-linecap="round"/>`
    : '';
  // Remache tipo tijera: aro de tinta con centro de latón.
  const pivot = o.pivot
    ? `<circle cx="12" cy="12" r="1.35" fill="${INK}"/><circle cx="12" cy="12" r=".68" fill="url(#brassMark)"/>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  <title>TuBarbería</title>
  <defs>
    ${clip}
    <radialGradient id="glow" cx="50%" cy="34%" r="70%">
      <stop offset="0" stop-color="${BRASS}" stop-opacity=".20"/>
      <stop offset=".55" stop-color="${BRASS}" stop-opacity=".05"/>
      <stop offset="1" stop-color="${BRASS}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="brass" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${BRASS_HI}"/>
      <stop offset=".5" stop-color="${BRASS}"/>
      <stop offset="1" stop-color="${BRASS_LO}"/>
    </linearGradient>
    <linearGradient id="brassMark" gradientUnits="userSpaceOnUse" x1="12" y1="3" x2="12" y2="21">
      <stop offset="0" stop-color="${BRASS_HI}"/>
      <stop offset=".5" stop-color="${BRASS}"/>
      <stop offset="1" stop-color="${BRASS_LO}"/>
    </linearGradient>
  </defs>
  ${bg}
  ${glow}
  ${ring}
  <g transform="translate(${round(tx)} ${round(ty)}) scale(${round(s, 4)})">
    <path d="${MARK.top}" fill="url(#brassMark)"/>
    <path d="${MARK.bottom}" fill="url(#brassMark)"/>
    ${knock}
    <path d="${cross}" fill="none" stroke="url(#brassMark)" stroke-width="${stroke}" stroke-linecap="round"/>
    ${pivot}
  </g>
</svg>
`;
}

// Ícono de atajo: fondo tinta a sangrado completo y glifo de línea (de app/lib/icons.js) en latón,
// dentro del 50% central para que sobreviva a la máscara circular de Android.
function shortcutSvg(glyphSvg, S) {
  const inner = glyphSvg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
  const g = S * 0.5;
  const k = g / 24;
  const o = (S - g) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  <defs><radialGradient id="glow" cx="50%" cy="34%" r="70%"><stop offset="0" stop-color="${BRASS}" stop-opacity=".2"/><stop offset="1" stop-color="${BRASS}" stop-opacity="0"/></radialGradient></defs>
  <rect width="${S}" height="${S}" fill="${INK}"/><rect width="${S}" height="${S}" fill="url(#glow)"/>
  <g transform="translate(${o} ${o}) scale(${round(k, 4)})" fill="none" stroke="${BRASS}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</g>
</svg>
`;
}

const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

// ── Variantes ──
const MARK_FULL = { pivot: true, knock: 0.45, long: true };
const ANY = { radius: 0.225, markH: 0.56, ring: 0.39, ...MARK_FULL };
const VARIANTS = [
  { file: 'icon-192.png', size: 192, ...ANY },
  { file: 'icon-512.png', size: 512, ...ANY },
  // Zona segura de maskable: círculo de radio 40% del lado. El anillo (31.5%) y la esquina más lejana
  // de la marca (~26%) quedan dentro aunque el sistema lo recorte en círculo o en "squircle".
  { file: 'maskable-512.png', size: 512, radius: 0, markH: 0.44, ring: 0.315, ...MARK_FULL },
  { file: 'apple-touch-icon.png', size: 180, radius: 0, markH: 0.56, ring: 0.39, opaque: true, ...MARK_FULL },
  // A 32 px el anillo, el remache y la separación ensucian: marca del logo tal cual, más grande.
  { file: 'favicon-32.png', size: 32, radius: 0.22, markH: 0.74, ring: 0, pivot: false, glow: false }
];

async function loadPlaywright() {
  const require = createRequire(import.meta.url);
  try { return require('playwright'); } catch (e) { /* cae al global */ }
  const g = execSync('npm root -g').toString().trim();
  return require(join(g, 'playwright'));
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  if (!process.env.PLAYWRIGHT_BROWSERS_PATH) process.env.PLAYWRIGHT_BROWSERS_PATH = '/opt/pw-browsers';
  const { chromium } = await loadPlaywright();
  const { icon } = await import(pathToFileURL(join(ROOT, 'app', 'lib', 'icons.js')).href);

  // Maestro vectorial (512, cuadro redondeado).
  const master = iconSvg({ size: 512, ...ANY });
  writeFileSync(join(OUT, 'icon.svg'), master);
  console.log('✓ app/icons/icon.svg');

  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  const render = async (svg, size, file, opaque) => {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<!doctype html><html><head><style>html,body{margin:0;padding:0;background:${opaque ? INK : 'transparent'}}svg{display:block}</style></head><body>${svg}</body></html>`);
    await page.screenshot({ path: join(OUT, file), omitBackground: !opaque, clip: { x: 0, y: 0, width: size, height: size } });
    console.log('✓ app/icons/' + file + ' (' + size + '×' + size + ')');
  };
  for (const v of VARIANTS) await render(iconSvg(v), v.size, v.file, v.opaque);

  const SHORTCUTS = [['shortcut-agenda.png', 'calendar'], ['shortcut-new.png', 'calendar-plus'], ['shortcut-cash.png', 'wallet']];
  for (const [file, name] of SHORTCUTS) await render(shortcutSvg(icon(name), 96), 96, file, true);

  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
