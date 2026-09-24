// Generador de códigos QR sin dependencias (ISO/IEC 18004).
//
//   · Modo byte con el texto en UTF-8 (sin cabecera ECI: los lectores actuales —cámara de
//     iOS/Android, ZXing, jsQR— detectan UTF-8 solos y algunos lectores viejos se confunden con ECI).
//   · Niveles de corrección L / M / Q / H (por defecto M).
//   · Versión (tamaño) elegida automáticamente según la longitud: 1–40 (21×21 … 177×177 módulos).
//   · Las 8 máscaras se evalúan con las 4 reglas de penalización de la norma y se elige la menor.
//
// API:
//   qrMatrix(text, { ecc })  → boolean[][]  (fila por fila; true = módulo oscuro, sin margen)
//   qrSVG(text, { size = 256, margin = 4, dark, light, ecc, logoText, logoBg }) → string <svg>
//   qrPNG(text, { size = 1024, ...mismas opciones }) → Promise<Blob> (image/png, dibujado en <canvas>)
//   qrEncode(text, { ecc, minVersion, maxVersion, mask }) → { version, ecc, mask, size, modules }
//
// Con `logoText` se dibuja al centro un cuadro redondeado con las iniciales (máx. 3) y se fuerza
// corrección H; el hueco ocupa ~9 % del área (H recupera ~30 % de los codewords), así que sigue
// escaneando con holgura.
//
// Compatible con Safari 15+ (sin roundRect de canvas, sin OffscreenCanvas, sin Array#at).

// ───────────────────────── Tablas de la norma ─────────────────────────

const ECC_INDEX = { L: 0, M: 1, Q: 2, H: 3 };
const ECC_NAMES = ['L', 'M', 'Q', 'H'];
// Bits de nivel en la info de formato: L=01, M=00, Q=11, H=10.
const ECC_FORMAT_BITS = [1, 0, 3, 2];

// Codewords de corrección por bloque, por nivel y versión (índice 0 sin uso).
const EC_PER_BLOCK = [
  [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30], // L
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28], // M
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30], // Q
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30], // H
];

// Número de bloques Reed-Solomon, por nivel y versión (índice 0 sin uso).
const EC_BLOCKS = [
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25], // L
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49], // M
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68], // Q
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81], // H
];

const MIN_VERSION = 1;
const MAX_VERSION = 40;

// Módulos disponibles para datos + corrección en una versión: área total menos patrones de
// función (localización, temporización, alineación, formato y versión). Fórmula cerrada
// equivalente a la tabla de capacidades de la norma.
function rawDataModules(ver) {
  let result = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const numAlign = Math.floor(ver / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (ver >= 7) result -= 36; // dos bloques de 6×3 con la info de versión
  }
  return result;
}

// Codewords de datos (sin corrección) que caben en una versión/nivel.
function dataCodewords(ver, e) {
  return Math.floor(rawDataModules(ver) / 8) - EC_PER_BLOCK[e][ver] * EC_BLOCKS[e][ver];
}

// Centros de los patrones de alineación (mismos valores en filas y columnas).
function alignmentPositions(ver) {
  if (ver === 1) return [];
  const size = ver * 4 + 17;
  const numAlign = Math.floor(ver / 7) + 2;
  const step = Math.floor((ver * 8 + numAlign * 3 + 5) / (numAlign * 4 - 4)) * 2;
  const result = [6];
  for (let pos = size - 7; result.length < numAlign; pos -= step) result.splice(1, 0, pos);
  return result;
}

// ───────────────────────── Reed-Solomon en GF(256) ─────────────────────────
// Campo con polinomio primitivo x^8 + x^4 + x^3 + x^2 + 1 (0x11D) y α = 2.

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(function initGaloisField() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  // Duplicamos la tabla para multiplicar sin hacer módulo 255.
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
})();

function gfMul(a, b) {
  return a === 0 || b === 0 ? 0 : GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

// Polinomio generador de grado n: ∏ (x − α^i), i = 0…n−1. Coeficientes de mayor a menor grado.
const generatorCache = {};
function rsGenerator(degree) {
  if (generatorCache[degree]) return generatorCache[degree];
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j]; // · x
      next[j + 1] ^= gfMul(poly[j], GF_EXP[i]); // · α^i  (en GF(2^8) restar = sumar = XOR)
    }
    poly = next;
  }
  return (generatorCache[degree] = poly);
}

// Resto de dividir data(x)·x^n entre el generador → los n codewords de corrección.
function rsRemainder(data, gen) {
  const degree = gen.length - 1;
  const rem = new Uint8Array(degree);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ rem[0];
    rem.copyWithin(0, 1);
    rem[degree - 1] = 0;
    if (factor !== 0) {
      for (let j = 0; j < degree; j++) rem[j] ^= gfMul(gen[j + 1], factor);
    }
  }
  return rem;
}

// ───────────────────────── Codificación de datos ─────────────────────────

function utf8Bytes(text) {
  return new TextEncoder().encode(String(text == null ? '' : text));
}

function parseEcc(ecc) {
  const key = String(ecc == null ? 'M' : ecc).toUpperCase();
  if (!(key in ECC_INDEX)) throw new TypeError(`Nivel de corrección inválido: ${ecc} (usa L, M, Q o H)`);
  return ECC_INDEX[key];
}

// Bits del indicador de longitud en modo byte: 8 para v1–9, 16 para v10–40.
function countBits(ver) {
  return ver < 10 ? 8 : 16;
}

function pickVersion(byteLen, e, minVer, maxVer) {
  for (let ver = minVer; ver <= maxVer; ver++) {
    if (byteLen >= 1 << countBits(ver)) continue;
    const needed = 4 + countBits(ver) + byteLen * 8;
    if (needed <= dataCodewords(ver, e) * 8) return ver;
  }
  const max = Math.floor((dataCodewords(maxVer, e) * 8 - 4 - countBits(maxVer)) / 8);
  throw new RangeError(
    `Texto demasiado largo para un código QR: ${byteLen} bytes (máx. ${max} con corrección ${ECC_NAMES[e]})`
  );
}

// Flujo de bits: modo (0100) + longitud + bytes + terminador + relleno 0xEC/0x11.
function buildDataCodewords(bytes, ver, e) {
  const capacity = dataCodewords(ver, e);
  const bits = [];
  const push = (value, len) => {
    for (let i = len - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };
  push(0b0100, 4);
  push(bytes.length, countBits(ver));
  for (let i = 0; i < bytes.length; i++) push(bytes[i], 8);
  push(0, Math.min(4, capacity * 8 - bits.length)); // terminador (hasta 4 ceros)
  push(0, (8 - (bits.length % 8)) % 8); // alinear a byte

  const out = new Uint8Array(capacity);
  for (let i = 0; i < bits.length; i++) out[i >>> 3] |= bits[i] << (7 - (i & 7));
  for (let i = bits.length / 8, pad = 0xec; i < capacity; i++, pad ^= 0xec ^ 0x11) out[i] = pad;
  return out;
}

// Parte los datos en bloques, calcula la corrección de cada uno y los intercala.
// Los bloques "cortos" van primero; los largos llevan un codeword de datos más.
function addErrorCorrection(data, ver, e) {
  const numBlocks = EC_BLOCKS[e][ver];
  const ecLen = EC_PER_BLOCK[e][ver];
  const rawCodewords = Math.floor(rawDataModules(ver) / 8);
  const numShort = numBlocks - (rawCodewords % numBlocks);
  const shortDataLen = Math.floor(rawCodewords / numBlocks) - ecLen;
  const gen = rsGenerator(ecLen);

  const blocks = [];
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const len = shortDataLen + (i < numShort ? 0 : 1);
    const dat = data.subarray(k, k + len);
    k += len;
    blocks.push({ dat, ec: rsRemainder(dat, gen) });
  }

  const out = [];
  for (let i = 0; i <= shortDataLen; i++) {
    for (const b of blocks) if (i < b.dat.length) out.push(b.dat[i]);
  }
  for (let i = 0; i < ecLen; i++) {
    for (const b of blocks) out.push(b.ec[i]);
  }
  return out;
}

// ───────────────────────── Construcción de la matriz ─────────────────────────
// Coordenadas: x = columna, y = fila. modules[y][x] = 1 → oscuro.

function createGrid(ver) {
  const size = ver * 4 + 17;
  const modules = [];
  const isFn = []; // 1 = módulo de función (no lleva datos ni se enmascara)
  for (let i = 0; i < size; i++) {
    modules.push(new Uint8Array(size));
    isFn.push(new Uint8Array(size));
  }
  return { ver, size, modules, isFn };
}

function setFn(g, x, y, dark) {
  g.modules[y][x] = dark ? 1 : 0;
  g.isFn[y][x] = 1;
}

function drawFunctionPatterns(g) {
  const { size, ver } = g;
  // Patrones de temporización: fila 6 y columna 6, alternando.
  for (let i = 0; i < size; i++) {
    setFn(g, 6, i, i % 2 === 0);
    setFn(g, i, 6, i % 2 === 0);
  }
  // Patrones de localización (7×7) con su separador claro.
  drawFinder(g, 3, 3);
  drawFinder(g, size - 4, 3);
  drawFinder(g, 3, size - 4);
  // Patrones de alineación (5×5), salvo donde chocan con los de localización.
  const pos = alignmentPositions(ver);
  const last = pos.length - 1;
  for (let i = 0; i <= last; i++) {
    for (let j = 0; j <= last; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) continue;
      drawAlignment(g, pos[i], pos[j]);
    }
  }
  // Reservamos las zonas de formato y versión (el formato se reescribe con la máscara final).
  drawFormatBits(g, 0, 0);
  drawVersion(g);
}

function drawFinder(g, cx, cy) {
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || y < 0 || x >= g.size || y >= g.size) continue;
      const dist = Math.max(Math.abs(dx), Math.abs(dy)); // anillos concéntricos
      setFn(g, x, y, dist !== 2 && dist !== 4);
    }
  }
}

function drawAlignment(g, cx, cy) {
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      setFn(g, cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }
}

// 15 bits de formato: nivel (2) + máscara (3) + BCH(15,5) con generador 0x537, XOR 0x5412.
function formatBits(e, mask) {
  const data = (ECC_FORMAT_BITS[e] << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return ((data << 10) | rem) ^ 0x5412;
}

function drawFormatBits(g, e, mask) {
  const bits = formatBits(e, mask);
  const bit = (i) => (bits >>> i) & 1;
  const n = g.size;
  // Copia 1: alrededor del localizador superior izquierdo (saltando la temporización).
  for (let i = 0; i <= 5; i++) setFn(g, 8, i, bit(i));
  setFn(g, 8, 7, bit(6));
  setFn(g, 8, 8, bit(7));
  setFn(g, 7, 8, bit(8));
  for (let i = 9; i < 15; i++) setFn(g, 14 - i, 8, bit(i));
  // Copia 2: repartida entre los localizadores superior derecho e inferior izquierdo.
  for (let i = 0; i < 8; i++) setFn(g, n - 1 - i, 8, bit(i));
  for (let i = 8; i < 15; i++) setFn(g, 8, n - 15 + i, bit(i));
  setFn(g, 8, n - 8, true); // módulo oscuro fijo
}

// Versión ≥ 7: 18 bits (6 de versión + BCH(18,6) con generador 0x1F25), dos copias de 6×3.
function drawVersion(g) {
  if (g.ver < 7) return;
  let rem = g.ver;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  const bits = (g.ver << 12) | rem;
  for (let i = 0; i < 18; i++) {
    const dark = (bits >>> i) & 1;
    const a = g.size - 11 + (i % 3);
    const b = Math.floor(i / 3);
    setFn(g, a, b, dark); // arriba a la derecha
    setFn(g, b, a, dark); // abajo a la izquierda
  }
}

// Coloca los codewords en zigzag: columnas de 2 módulos, de derecha a izquierda,
// alternando subida/bajada y saltando la columna 6 (temporización vertical).
function placeCodewords(g, codewords) {
  const n = g.size;
  const totalBits = codewords.length * 8;
  let i = 0;
  for (let right = n - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    const upward = ((right + 1) & 2) === 0;
    for (let vert = 0; vert < n; vert++) {
      const y = upward ? n - 1 - vert : vert;
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        if (g.isFn[y][x] || i >= totalBits) continue;
        g.modules[y][x] = (codewords[i >>> 3] >>> (7 - (i & 7))) & 1;
        i++;
      }
    }
  }
  // Los bits sobrantes (0–7 "remainder bits") quedan claros.
}

// Condiciones de las 8 máscaras (x = columna j, y = fila i en la notación de la norma).
const MASKS = [
  (x, y) => (x + y) % 2 === 0,
  (x, y) => y % 2 === 0,
  (x, y) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

// XOR de la máscara sobre los módulos de datos (aplicarla dos veces la deshace).
function applyMask(g, mask) {
  const fn = MASKS[mask];
  for (let y = 0; y < g.size; y++) {
    const row = g.modules[y];
    const fnRow = g.isFn[y];
    for (let x = 0; x < g.size; x++) {
      if (!fnRow[x] && fn(x, y)) row[x] ^= 1;
    }
  }
}

// ───────────────────────── Penalización de máscaras ─────────────────────────

const N1 = 3;
const N2 = 3;
const N3 = 40;
const N4 = 10;

// Reglas 1 y 3 sobre una fila o columna.
function lineScore(line) {
  const n = line.length;
  let score = 0;
  // Regla 1: rachas de ≥5 módulos del mismo color → N1 + (largo − 5).
  let run = 1;
  for (let i = 1; i <= n; i++) {
    if (i < n && line[i] === line[i - 1]) {
      run++;
    } else {
      if (run >= 5) score += N1 + (run - 5);
      run = 1;
    }
  }
  // Regla 3: patrón tipo localizador 1:1:3:1:1 (1011101) con 4 módulos claros antes o después.
  // Fuera del símbolo cuenta como claro (zona de silencio).
  for (let i = 0; i + 6 < n; i++) {
    if (
      line[i] && !line[i + 1] && line[i + 2] && line[i + 3] && line[i + 4] && !line[i + 5] && line[i + 6] &&
      (isLightRange(line, i - 4, i) || isLightRange(line, i + 7, i + 11))
    ) {
      score += N3;
    }
  }
  return score;
}

function isLightRange(line, from, to) {
  for (let k = Math.max(from, 0); k < Math.min(to, line.length); k++) if (line[k]) return false;
  return true;
}

function penaltyScore(modules) {
  const n = modules.length;
  let score = 0;
  let dark = 0;
  const col = new Uint8Array(n);
  for (let a = 0; a < n; a++) {
    score += lineScore(modules[a]);
    for (let k = 0; k < n; k++) col[k] = modules[k][a];
    score += lineScore(col);
  }
  // Regla 2: cada bloque 2×2 del mismo color.
  for (let y = 0; y < n - 1; y++) {
    const r0 = modules[y];
    const r1 = modules[y + 1];
    for (let x = 0; x < n - 1; x++) {
      const c = r0[x];
      if (c === r0[x + 1] && c === r1[x] && c === r1[x + 1]) score += N2;
    }
  }
  // Regla 4: proporción de oscuros; N4 por cada 5 % completo de desviación respecto al 50 %.
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) dark += modules[y][x];
  const total = n * n;
  score += Math.floor(Math.abs(dark * 20 - total * 10) / total) * N4;
  return score;
}

// Arma el símbolo completo a partir de los codewords de datos ya codificados.
function renderSymbol(data, ver, e, forcedMask) {
  const g = createGrid(ver);
  drawFunctionPatterns(g);
  placeCodewords(g, addErrorCorrection(data, ver, e));

  let mask = forcedMask;
  if (!(Number.isInteger(mask) && mask >= 0 && mask <= 7)) {
    let best = Infinity;
    for (let m = 0; m < 8; m++) {
      applyMask(g, m);
      drawFormatBits(g, e, m);
      const score = penaltyScore(g.modules);
      if (score < best) {
        best = score;
        mask = m;
      }
      applyMask(g, m); // deshacer
    }
  }
  applyMask(g, mask);
  drawFormatBits(g, e, mask);
  return { version: ver, ecc: ECC_NAMES[e], mask, size: g.size, modules: g.modules };
}

// ───────────────────────── API pública ─────────────────────────

/**
 * Codifica `text` y devuelve el símbolo con sus metadatos.
 * modules es un array de filas (Uint8Array), 1 = oscuro.
 */
export function qrEncode(text, opts = {}) {
  const e = parseEcc(opts.ecc);
  const minVer = Math.max(MIN_VERSION, Math.floor(opts.minVersion || MIN_VERSION));
  const maxVer = Math.min(MAX_VERSION, Math.floor(opts.maxVersion || MAX_VERSION));
  const bytes = utf8Bytes(text);
  const ver = pickVersion(bytes.length, e, minVer, maxVer);
  return renderSymbol(buildDataCodewords(bytes, ver, e), ver, e, opts.mask);
}

/** Matriz de módulos (sin zona de silencio): boolean[fila][columna], true = oscuro. */
export function qrMatrix(text, opts = {}) {
  return qrEncode(text, { ecc: opts.ecc }).modules.map((row) => Array.from(row, (v) => v === 1));
}

// Tamaño del hueco central respecto al lado del símbolo. 0.3 → ~9 % del área, holgado frente
// al ~30 % que recupera el nivel H (y bajo el tope de ~18 % recomendado para logos).
const LOGO_RATIO = 0.3;
const LOGO_FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

// Iniciales para el logo, en mayúsculas y máximo 3 (Array.from respeta acentos y emojis).
// "NG" → "NG"; si viene un nombre con espacios, una inicial por palabra: "New Gómez" → "NG".
function cleanInitials(logoText) {
  if (logoText == null) return '';
  const words = String(logoText).trim().split(/\s+/).filter(Boolean);
  const chars = words.length > 1 ? words.map((w) => Array.from(w)[0]) : Array.from(words[0] || '');
  return chars.slice(0, 3).join('').toUpperCase();
}

// ¿Color claro? Solo entiende #rgb / #rrggbb; ante la duda lo tratamos como oscuro.
function isLightColor(color) {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(color || '').trim());
  if (!m) return false;
  let hex = m[1];
  if (hex.length === 3) hex = hex.replace(/./g, '$&$&');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 150;
}

function isVisible(color) {
  return !!color && color !== 'none' && color !== 'transparent';
}

// Geometría común a SVG y PNG, en unidades de módulo (incluyendo el margen).
function layout(text, opts) {
  const {
    margin = 4,
    dark = '#15130F',
    light = '#FFFFFF',
    ecc,
    logoText,
    logoBg,
  } = opts;
  const initials = cleanInitials(logoText);
  const q = qrEncode(text, { ecc: initials ? 'H' : ecc });
  const n = q.size;
  const quiet = Math.max(0, Math.floor(Number(margin) || 0));
  const total = n + quiet * 2;

  let logo = null;
  if (initials) {
    let side = Math.floor(n * LOGO_RATIO);
    if (side % 2 === 0) side--; // impar para quedar centrado exacto (n siempre es impar)
    const start = (n - side) / 2;
    const inset = 0.5; // anillo claro entre los módulos y el cuadro
    const box = side - inset * 2;
    const bg = logoBg || dark;
    const fontScale = [0.56, 0.44, 0.31][Array.from(initials).length - 1];
    logo = {
      start,
      end: start + side,
      x: quiet + start + inset,
      size: box,
      radius: box * 0.22,
      bg,
      // Iniciales en contraste: oscuras sobre fondo claro, claras sobre fondo oscuro.
      fg: isLightColor(bg)
        ? isLightColor(dark) ? '#15130F' : dark
        : isLightColor(light) ? light : '#FFFFFF',
      text: initials,
      fontSize: box * fontScale,
    };
  }

  // ¿Se pinta el módulo (x, y)? Los que quedan bajo el logo se dejan claros.
  const isDark = (x, y) =>
    q.modules[y][x] === 1 && !(logo && x >= logo.start && x < logo.end && y >= logo.start && y < logo.end);

  return { n, quiet, total, dark, light, logo, isDark };
}

function escapeXml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function round3(v) {
  return Math.round(v * 1000) / 1000;
}

/**
 * SVG escalable: un único <path> con los módulos (tramos horizontales unidos) sobre un fondo.
 * `size` = ancho/alto en px del <svg>; `margin` = zona de silencio en módulos.
 */
export function qrSVG(text, opts = {}) {
  const { size = 256 } = opts;
  const L = layout(text, opts);
  let d = '';
  for (let y = 0; y < L.n; y++) {
    for (let x = 0; x < L.n; x++) {
      if (!L.isDark(x, y)) continue;
      let run = 1;
      while (x + run < L.n && L.isDark(x + run, y)) run++;
      d += `M${x + L.quiet} ${y + L.quiet}h${run}v1h-${run}z`;
      x += run - 1;
    }
  }

  const t = L.total;
  let svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${escapeXml(size)}" height="${escapeXml(size)}" ` +
    `viewBox="0 0 ${t} ${t}" shape-rendering="crispEdges" role="img" aria-label="Código QR">`;
  if (isVisible(L.light)) svg += `<rect width="${t}" height="${t}" fill="${escapeXml(L.light)}"/>`;
  svg += `<path fill="${escapeXml(L.dark)}" d="${d}"/>`;
  if (L.logo) {
    const o = L.logo;
    const c = round3(o.x + o.size / 2);
    svg +=
      `<rect x="${round3(o.x)}" y="${round3(o.x)}" width="${round3(o.size)}" height="${round3(o.size)}" ` +
      `rx="${round3(o.radius)}" fill="${escapeXml(o.bg)}" shape-rendering="geometricPrecision"/>` +
      `<text x="${c}" y="${c}" dy=".35em" text-anchor="middle" font-family="${escapeXml(LOGO_FONT)}" ` +
      `font-weight="700" font-size="${round3(o.fontSize)}" fill="${escapeXml(o.fg)}">${escapeXml(o.text)}</text>`;
  }
  return svg + '</svg>';
}

// Rectángulo redondeado a mano (ctx.roundRect no existe en Safari 15).
function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * PNG (Blob) dibujado en un <canvas> de `size`×`size` px. Mismas opciones que qrSVG.
 * Los bordes de cada módulo se redondean a píxel entero para que no aparezcan costuras.
 */
export function qrPNG(text, opts = {}) {
  return new Promise((resolve, reject) => {
    try {
      const size = Math.max(1, Math.round(Number(opts.size) || 1024));
      const L = layout(text, opts);
      const scale = size / L.total;
      const px = (v) => Math.round(v * scale);

      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (isVisible(L.light)) {
        ctx.fillStyle = L.light;
        ctx.fillRect(0, 0, size, size);
      }

      ctx.fillStyle = L.dark;
      for (let y = 0; y < L.n; y++) {
        for (let x = 0; x < L.n; x++) {
          if (!L.isDark(x, y)) continue;
          let run = 1;
          while (x + run < L.n && L.isDark(x + run, y)) run++;
          const x0 = px(x + L.quiet);
          const y0 = px(y + L.quiet);
          ctx.fillRect(x0, y0, px(x + run + L.quiet) - x0, px(y + 1 + L.quiet) - y0);
          x += run - 1;
        }
      }

      if (L.logo) {
        const o = L.logo;
        roundRectPath(ctx, o.x * scale, o.x * scale, o.size * scale, o.size * scale, o.radius * scale);
        ctx.fillStyle = o.bg;
        ctx.fill();
        const fontPx = o.fontSize * scale;
        ctx.fillStyle = o.fg;
        ctx.font = `700 ${fontPx}px ${LOGO_FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        const c = (o.x + o.size / 2) * scale;
        ctx.fillText(o.text, c, c + fontPx * 0.35, o.size * scale * 0.84); // maxWidth: no se sale del cuadro
      }

      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('No se pudo generar el PNG del QR'))), 'image/png');
    } catch (err) {
      reject(err);
    }
  });
}
