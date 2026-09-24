/**
 * Genera la versión de un solo archivo de Elementa:
 *   dist-standalone/elementa.html           documento completo (abrir con doble clic, sin servidor)
 *   dist-standalone/elementa.fragment.html  el mismo contenido sin <html>/<head>/<body>, para
 *                                           publicarlo en hosts que ponen su propio esqueleto
 * Uso: npm run build:standalone
 */
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build, createServer } from 'vite';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const configFile = here('./vite.config.mts');
const outDir = here('../dist-standalone');
const viteOut = `${outDir}/.vite`;

process.chdir(here('..')); // Tailwind detecta las clases desde la raíz del proyecto.
await build({ configFile });

// Script de tema previo al pintado: el mismo que usa layout.tsx.
const server = await createServer({ configFile, server: { middlewareMode: true }, appType: 'custom' });
const { THEME_INIT_SCRIPT } = await server.ssrLoadModule('/../src/services/theme.ts');
await server.close();

const assets = await readdir(`${viteOut}/assets`);
const read = (ext) =>
  Promise.all(assets.filter((f) => f.endsWith(ext)).map((f) => readFile(`${viteOut}/assets/${f}`, 'utf8'))).then((parts) =>
    parts.join('\n'),
  );
const js = (await read('.js')).replaceAll('</script', '<\\/script');
const css = (await read('.css')).replaceAll('</style', '<\\/style');

const FONT =
  'https://fonts.googleapis.com/css2?family=Nunito:ital,wght@0,400..1000;1,400..1000&display=swap';
const BASE_CSS = `:root{--font-nunito:'Nunito'}body{margin:0;font-size:1rem;line-height:1.5}`;

const content = `<title>Elementa</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONT}">
<script>${THEME_INIT_SCRIPT}</script>
<style>${css}</style>
<style>${BASE_CSS}</style>
<div id="elementa-root"></div>
<script type="module">${js}</script>
`;

const doc = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="Memoriza los 118 elementos de la tabla periódica jugando.">
${content.replace('<div id="elementa-root"></div>', '</head>\n<body>\n<div id="elementa-root"></div>')}</body>
</html>
`;

await mkdir(outDir, { recursive: true });
await writeFile(`${outDir}/elementa.html`, doc);
await writeFile(`${outDir}/elementa.fragment.html`, content);
await rm(viteOut, { recursive: true, force: true });
const kb = (s) => `${Math.round(Buffer.byteLength(s) / 1024)} KB`;
console.log(`✓ dist-standalone/elementa.html (${kb(doc)})`);
console.log(`✓ dist-standalone/elementa.fragment.html (${kb(content)})`);
