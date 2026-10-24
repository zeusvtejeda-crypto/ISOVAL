// Huella de todo lo que entra en dist/_worker.js. Si cambia cualquier archivo de la app, la API o el empaquetador,
// la huella cambia y se sabe que el paquete quedó viejo (lo revisa tests/paquete.test.mjs).
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export function calcularHuella(raiz) {
  const h = createHash('sha256');
  const agregar = (rel) => { h.update(rel + '\0'); h.update(readFileSync(join(raiz, rel))); };
  const recorrer = (dir) => {
    for (const nombre of readdirSync(join(raiz, dir)).sort()) {
      const rel = dir + '/' + nombre;
      if (statSync(join(raiz, rel)).isDirectory()) recorrer(rel); else agregar(rel);
    }
  };
  recorrer('public');
  recorrer('functions');
  agregar('scripts/entrada-worker.js');
  agregar('scripts/empaquetar.mjs');
  return h.digest('hex').slice(0, 16);
}
