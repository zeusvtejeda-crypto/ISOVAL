#!/usr/bin/env node
// Genera dist/new-gomez.html: un solo archivo con las imágenes de /img embebidas
// como data URI. Sirve para subirlo a cualquier hosting o publicarlo como Artifact.
// Uso: node build.js
const fs = require('fs'), path = require('path');
const root = __dirname, src = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const mime = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
let n = 0;
const out = src.replace(/(["'])img\/([a-z0-9._-]+)\1/gi, (m, q, file) => {
  const p = path.join(root, 'img', file), ext = path.extname(file).toLowerCase();
  if (!fs.existsSync(p) || !mime[ext]) return m;
  n++;
  return q + 'data:' + mime[ext] + ';base64,' + fs.readFileSync(p).toString('base64') + q;
});
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'new-gomez.html'), out);
console.log('dist/new-gomez.html listo · ' + n + ' imágenes embebidas · ' + (out.length / 1024).toFixed(0) + ' KB');
