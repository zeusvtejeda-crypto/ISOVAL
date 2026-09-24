// Catálogo de servicios de la barbería: listado, alta, edición, borrado y orden.
// Las citas guardan una copia del servicio (nombre, precio, duración), así que borrar no altera el historial.
import { bad, notFound, newId, nowIso } from '../util.js';
import { body, failIf, textIn, boolIn, boolOf, intIn, numIn } from './shop.js';

const MAX_REORDER = 500;
const MAX_STAFF_IDS = 100;

export function serviceView(s) {
  return Object.assign({}, s, { staff_ids: Array.isArray(s.staff_ids) ? s.staff_ids : [] });
}

async function getService(ctx) {
  const s = await ctx.sdb.findOne('services', { id: String(ctx.params.id || '') });
  if (!s) throw notFound('No encontramos ese servicio.');
  return s;
}

// Campos del formulario (solo los enviados). create: nombre, duración y precio obligatorios.
async function parseInput(ctx, b, { create }) {
  const errs = {};
  const v = {};
  const put = (k, x) => { if (x !== undefined) v[k] = x; };
  const req = (k) => (create && b[k] === undefined ? null : b[k]);
  put('name', textIn(errs, 'name', req('name'), { min: 2, max: 80, label: 'El nombre', empty: 'Escribe el nombre del servicio.' }));
  const dur = req('duration_min');
  if (dur === null) errs.duration_min = 'Indica la duración en minutos.';
  else {
    const d = intIn(errs, 'duration_min', dur, 5, 480, 'La duración');
    if (d !== undefined) { if (d % 5) errs.duration_min = 'La duración debe ser múltiplo de 5 minutos.'; else v.duration_min = d; }
  }
  const price = req('price');
  if (price === null) errs.price = 'Indica el precio (puede ser 0).';
  else put('price', numIn(errs, 'price', price, 0, 100000, 'El precio'));
  const cat = textIn(errs, 'category', b.category, { max: 40, label: 'La categoría' });
  if (cat !== undefined) v.category = cat || null;
  const desc = textIn(errs, 'description', b.description, { max: 300, label: 'La descripción', multiline: true });
  if (desc !== undefined) v.description = desc || null;
  put('popular', boolIn(errs, 'popular', b.popular));
  put('active', boolIn(errs, 'active', b.active));
  put('sort', intIn(errs, 'sort', b.sort, 0, 10000, 'El orden'));
  if (b.staff_ids !== undefined) {
    const raw = b.staff_ids === null ? [] : b.staff_ids;
    if (!Array.isArray(raw) || raw.length > MAX_STAFF_IDS || raw.some((x) => typeof x !== 'string' || !x || x.length > 64)) errs.staff_ids = 'La lista de barberos no es válida.';
    else {
      const ids = [...new Set(raw)];
      // Solo barberos de ESTA barbería (sdb): un id de otra barbería no existe aquí.
      const found = ids.length ? await ctx.sdb.find('staff', { id: { in: ids } }) : [];
      if (found.length !== ids.length) errs.staff_ids = 'Alguno de los barberos elegidos ya no existe. Actualiza la página y vuelve a elegir.';
      else v.staff_ids = ids;
    }
  }
  failIf(errs);
  return v;
}

async function list(ctx) {
  const all = boolOf(ctx.req.query.all) === true && ctx.can('services.manage');
  const rows = await ctx.sdb.find('services', all ? {} : { active: true }, { order: ['sort asc', 'name asc'] });
  return rows.map(serviceView);
}

async function create(ctx) {
  const v = await parseInput(ctx, body(ctx), { create: true });
  const now = nowIso();
  let sort = v.sort;
  if (sort === undefined) {
    const last = await ctx.sdb.find('services', {}, { order: 'sort desc', limit: 1 });
    sort = last.length ? (Number(last[0].sort) || 0) + 1 : 0;
  }
  const row = await ctx.sdb.insert('services', {
    id: newId('sv'), name: v.name, description: v.description || null, category: v.category || null,
    duration_min: v.duration_min, price: v.price, active: v.active === undefined ? true : v.active,
    popular: v.popular === undefined ? false : v.popular, staff_ids: v.staff_ids || [], sort, created_at: now, updated_at: now
  });
  return serviceView(row);
}

async function update(ctx) {
  const s = await getService(ctx);
  const v = await parseInput(ctx, body(ctx), { create: false });
  if (!Object.keys(v).length) throw bad('No hay cambios que guardar.');
  v.updated_at = nowIso();
  await ctx.sdb.update('services', { id: s.id }, v);
  return serviceView(await ctx.sdb.findOne('services', { id: s.id }));
}

async function remove(ctx) {
  const s = await getService(ctx);
  await ctx.sdb.delete('services', { id: s.id });
  return null;
}

// { ids:[…] } en el orden deseado. Los servicios no incluidos quedan después, en su orden actual.
async function reorder(ctx) {
  const ids = body(ctx).ids;
  if (!Array.isArray(ids) || !ids.length || ids.length > MAX_REORDER || ids.some((x) => typeof x !== 'string' || !x)) {
    throw bad('Envía la lista de servicios en el nuevo orden.', { ids: 'Lista no válida.' });
  }
  if (new Set(ids).size !== ids.length) throw bad('La lista tiene servicios repetidos.', { ids: 'Servicios repetidos.' });
  const rows = await ctx.sdb.find('services', {}, { order: ['sort asc', 'name asc'] });
  const byId = Object.fromEntries(rows.map((s) => [s.id, s]));
  if (ids.some((id) => !byId[id])) throw bad('Alguno de los servicios ya no existe. Actualiza la página e intenta de nuevo.', { ids: 'Servicio no encontrado.' });
  const order = ids.concat(rows.map((s) => s.id).filter((id) => !ids.includes(id)));
  const now = nowIso();
  for (let i = 0; i < order.length; i++) {
    if (byId[order[i]].sort !== i) await ctx.sdb.update('services', { id: order[i] }, { sort: i, updated_at: now });
  }
  return null;
}

export const routes = [
  { method: 'GET', path: '/api/services', auth: 'shop', perm: 'services.read', handler: list },
  { method: 'POST', path: '/api/services/reorder', auth: 'shop', perm: 'services.manage', handler: reorder },
  { method: 'POST', path: '/api/services', auth: 'shop', perm: 'services.manage', handler: create },
  { method: 'PATCH', path: '/api/services/:id', auth: 'shop', perm: 'services.manage', handler: update },
  { method: 'DELETE', path: '/api/services/:id', auth: 'shop', perm: 'services.manage', handler: remove }
];
