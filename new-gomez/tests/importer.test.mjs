import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeFixture } from './helpers.mjs';
import { createSession } from '../core/session.js';
import { nameKey } from '../core/api/importer.js';

// Equipo y citas tal como los guardaba la app anterior (index.html v1) en localStorage.
const LEGACY_STAFF = [
  { id: 'zeus', nombre: 'Zeus', rol: 'superadmin', pin: '9ed63160', activo: true, barbero: false },
  { id: 'angel', nombre: 'Angel', rol: 'owner', pin: 'd59e0b84', activo: true, barbero: true, img: 'img/angel.jpg' },
  { id: 'alexis', nombre: 'Alexis', rol: 'employee', pin: 'fec20396', activo: true, barbero: true, img: 'img/alexis.jpg' },
  { id: 'viejo', nombre: 'barbero a', rol: 'employee', activo: true, barbero: true }
];
const cita = (o) => Object.assign({
  id: 'NG-K3F9A1', fecha: '2025-03-14', inicio: 600, dur: 40, barbero: 'angel', barberoNombre: 'Angel', servicios: ['Corte'], total: 200,
  nombre: 'Luis Ramírez', telefono: '3111112233', primera: 'Sí', nota: '', creado: '2025-03-10T18:22:11.000Z', estado: 'registrada'
}, o);
const LEGACY_CITAS = [
  cita({ id: 'NG-0001AA' }),
  cita({ id: 'NG-0002BB', estado: 'confirmada', barbero: 'alexis', barberoNombre: 'Alexis', servicios: ['CORTE', 'barba'], total: 320, dur: 60, telefono: '311 111 2233', primera: 'No' }),
  cita({ id: 'NG-0003CC', estado: 'cancelada', barbero: 'any', barberoNombre: 'Cualquiera', nombre: 'Ana Torres', telefono: '3112223344', nota: 'Llega tarde' }),
  cita({ id: 'NG-0004DD', estado: 'atendida', servicios: ['Corte', 'Tinte especial'], total: 500, dur: 90, nombre: 'Cliente A', telefono: '3110000001' }),
  cita({ id: 'NG-0005EE', barbero: 'beto', barberoNombre: 'Beto', nombre: 'Sin Tel', telefono: '', servicios: ['Limpieza de cejas', 'Limpieza nasal'], total: 160, dur: 30 }),
  cita({ id: 'NG-0006FF', barbero: 'viejo', barberoNombre: 'Barbero A', nombre: 'Sin Tel', telefono: '' }),
  cita({ id: 'NG-0007GG', barbero: 'zeus', barberoNombre: 'Zeus', estado: 'atendida' }),
  cita({ id: 'NG-0001AA', nombre: 'Repetida en el archivo' }),
  cita({ id: 'NG-BADDATE', fecha: '2025-02-30' }),
  cita({ id: 'NG-BADHOUR', inicio: 'diez' }),
  cita({ id: '' }),
  'basura'
];

async function setup() {
  const f = await makeFixture();
  for (const k of ['ownerA', 'barberA', 'ownerB', 'clientA', 'super']) f.tokens[k] = await createSession(f.db, { kind: 'password', user_id: 'u_' + k });
  f.imp = (as, body, shop) => f.call('POST', '/api/import/legacy', { as, shop: shop || 'shop_a', body });
  return f;
}

test('importación: datos reales de la app anterior (estados, barberos, servicios, clientes)', async () => {
  const f = await setup();
  const before = await f.db.count('clients', { shop_id: 'shop_a' });
  const r = await f.imp('ownerA', { citas: LEGACY_CITAS, staff: LEGACY_STAFF });
  assert.equal(r.status, 200, r.body);
  assert.equal(r.data.imported, 7);
  assert.equal(r.data.skipped, 5);
  assert.equal(r.data.staff_created, 3, 'Angel, Alexis y Beto (Zeus es superadmin; "barbero a" ya existe)');
  assert.deepEqual(r.data.errors.map((e) => e.message), ['Ya estaba importada.', 'Fecha no válida.', 'Hora no válida.', 'La cita no tiene folio válido.', 'Registro no válido.']);

  const staff = await f.db.find('staff', { shop_id: 'shop_a' });
  const byName = Object.fromEntries(staff.map((s) => [s.name, s]));
  assert.ok(!byName.Zeus, 'el superadmin viejo se ignora');
  for (const n of ['Angel', 'Alexis', 'Beto']) {
    assert.equal(byName[n].role, 'barber', n);
    assert.equal(byName[n].pin_hash, null);
    assert.equal(byName[n].user_id, null);
    assert.ok(/^#[0-9a-f]{6}$/.test(byName[n].color));
  }
  assert.equal(byName.Angel.avatar_url, '/img/angel.jpg');
  assert.equal(staff.length, 6);

  const appts = await f.db.find('appointments', { shop_id: 'shop_a', source: 'import' });
  const A = Object.fromEntries(appts.map((a) => [a.folio, a]));
  assert.equal(appts.length, 7);
  // Estados
  assert.equal(A['NG-0001AA'].status, 'confirmed');
  assert.equal(A['NG-0002BB'].status, 'confirmed');
  assert.equal(A['NG-0003CC'].status, 'cancelled');
  assert.equal(A['NG-0004DD'].status, 'completed');
  assert.equal(A['NG-0004DD'].completed_at, '2025-03-10T18:22:11.000Z');
  // Barberos
  assert.equal(A['NG-0001AA'].staff_id, byName.Angel.id);
  assert.equal(A['NG-0002BB'].staff_id, byName.Alexis.id);
  assert.equal(A['NG-0003CC'].staff_id, 'st_barberA', "'any' → primer barbero reservable (orden sort, nombre)");
  assert.equal(A['NG-0005EE'].staff_id, byName.Beto.id);
  assert.equal(A['NG-0006FF'].staff_id, 'st_barberA', 'nombre sin acentos/mayúsculas');
  assert.equal(A['NG-0007GG'].staff_id, 'st_barberA', 'cita del superadmin → primer barbero reservable');
  // Servicios: por nombre contra el catálogo; los desconocidos se reparten el resto.
  assert.deepEqual(A['NG-0002BB'].services, [
    { id: 'sv_corte', name: 'Corte', price: 200, duration_min: 40 }, { id: 'sv_barba', name: 'Barba', price: 120, duration_min: 20 }
  ]);
  assert.deepEqual(A['NG-0004DD'].services, [
    { id: 'sv_corte', name: 'Corte', price: 200, duration_min: 40 }, { id: null, name: 'Tinte especial', price: 300, duration_min: 50 }
  ]);
  assert.deepEqual(A['NG-0005EE'].services, [
    { id: null, name: 'Limpieza de cejas', price: 80, duration_min: 15 }, { id: null, name: 'Limpieza nasal', price: 80, duration_min: 15 }
  ]);
  assert.equal(A['NG-0004DD'].total, 500);
  assert.deepEqual([A['NG-0004DD'].start_min, A['NG-0004DD'].end_min, A['NG-0004DD'].duration_min], [600, 690, 90]);
  // Otros campos
  assert.equal(A['NG-0001AA'].first_visit, true);
  assert.equal(A['NG-0002BB'].first_visit, false);
  assert.equal(A['NG-0003CC'].client_note, 'Llega tarde');
  assert.equal(A['NG-0001AA'].created_at, '2025-03-10T18:22:11.000Z');
  assert.equal(A['NG-0001AA'].created_by, 'st_ownerA');
  assert.equal(A['NG-0001AA'].manage_token_hash, null);
  // Clientes: misma ficha por teléfono; la existente se reutiliza; sin teléfono → una por nombre.
  assert.equal(A['NG-0001AA'].client_id, A['NG-0002BB'].client_id, 'mismo teléfono con espacios');
  assert.equal(A['NG-0004DD'].client_id, 'cl_clientA', 'ficha existente por teléfono');
  assert.equal(A['NG-0005EE'].client_id, A['NG-0006FF'].client_id);
  assert.equal(A['NG-0005EE'].client_phone, '');
  const luis = await f.db.findOne('clients', { id: A['NG-0001AA'].client_id });
  assert.deepEqual([luis.name, luis.phone, luis.source, luis.shop_id], ['Luis Ramírez', '3111112233', 'import', 'shop_a']);
  assert.equal(r.data.clients_created, 3);
  assert.equal(await f.db.count('clients', { shop_id: 'shop_a' }), before + 3);
  // Las citas importadas se ven en la agenda con la forma normal.
  const list = await f.call('GET', '/api/appointments?from=2025-03-14&to=2025-03-14', { as: 'ownerA', shop: 'shop_a' });
  assert.equal(list.data.total, 7);
  assert.equal(list.data.items.find((a) => a.folio === 'NG-0002BB').staff_name, 'Alexis');
});

test('importación: idempotente (el mismo folio no se duplica) y reutiliza el equipo creado', async () => {
  const f = await setup();
  await f.imp('ownerA', { citas: LEGACY_CITAS, staff: LEGACY_STAFF });
  const r = await f.imp('ownerA', { citas: LEGACY_CITAS, staff: LEGACY_STAFF });
  assert.equal(r.status, 200);
  assert.equal(r.data.imported, 0);
  assert.equal(r.data.skipped, LEGACY_CITAS.length);
  assert.equal(r.data.staff_created, 0);
  assert.equal(r.data.clients_created, 0);
  assert.equal(await f.db.count('appointments', { shop_id: 'shop_a', source: 'import' }), 7);
  // Una cita nueva en otro respaldo sí entra.
  const r2 = await f.imp('ownerA', { citas: [cita({ id: 'NG-NUEVA1', barbero: 'angel' })] });
  assert.equal(r2.data.imported, 1);
  assert.equal(r2.data.staff_created, 0);
});

test('importación: permisos y aislamiento entre barberías', async () => {
  const f = await setup();
  const body = { citas: [cita({ id: 'NG-ISO001', barbero: 'angel' })], staff: LEGACY_STAFF };
  assert.equal((await f.imp('barberA', body)).status, 403);
  assert.equal((await f.imp('clientA', body)).status, 403);
  assert.equal((await f.imp('ownerB', body)).status, 403, 'sin acceso a la barbería A');
  assert.equal((await f.call('POST', '/api/import/legacy', { shop: 'shop_a', body })).status, 401);
  // Cada barbería importa a lo suyo; el mismo folio puede existir en ambas.
  assert.equal((await f.imp('ownerA', body)).data.imported, 1);
  const rb = await f.imp('ownerB', body, 'shop_b');
  assert.equal(rb.status, 200);
  assert.equal(rb.data.imported, 1);
  assert.equal(rb.data.staff_created, 3, 'Angel, Alexis y "barbero a" en B (el equipo de A no cuenta)');
  const inB = await f.db.find('appointments', { folio: 'NG-ISO001' });
  assert.deepEqual(inB.map((a) => a.shop_id).sort(), ['shop_a', 'shop_b']);
  const bAppt = inB.find((a) => a.shop_id === 'shop_b');
  const bStaff = await f.db.findOne('staff', { id: bAppt.staff_id });
  assert.equal(bStaff.shop_id, 'shop_b');
  const bClient = await f.db.findOne('clients', { id: bAppt.client_id });
  assert.equal(bClient.shop_id, 'shop_b');
  // Ignora cualquier shop_id que venga en los datos.
  const rc = await f.imp('ownerA', { citas: [cita({ id: 'NG-ISO002', shop_id: 'shop_b' })] });
  assert.equal(rc.data.imported, 1);
  assert.equal((await f.db.findOne('appointments', { folio: 'NG-ISO002' })).shop_id, 'shop_a');
  // Superadmin actúa como dueño.
  assert.equal((await f.imp('super', { citas: [cita({ id: 'NG-SUPER1' })] })).data.imported, 1);
});

test('importación: validaciones del archivo', async () => {
  const f = await setup();
  let r = await f.imp('ownerA', { citas: 'no' });
  assert.equal(r.status, 400);
  assert.ok(r.error.fields.citas);
  r = await f.imp('ownerA', {});
  assert.equal(r.status, 400);
  assert.equal(r.error.message, 'El archivo no trae citas ni equipo para importar.');
  r = await f.imp('ownerA', { citas: new Array(5001).fill(cita({})) });
  assert.equal(r.status, 400);
  assert.match(r.error.message, /5000/);
  r = await f.imp('ownerA', { citas: [], staff: 'x' });
  assert.equal(r.status, 400);
  assert.ok(r.error.fields.staff);
  // Solo equipo: crea a los que falten.
  r = await f.imp('ownerA', { staff: LEGACY_STAFF });
  assert.equal(r.status, 200);
  assert.deepEqual([r.data.imported, r.data.staff_created], [0, 2]);
  // Campos raros no rompen: total inválido → suma del catálogo; sin duración → la del catálogo; hora que se pasa de medianoche se recorta.
  r = await f.imp('ownerA', { citas: [
    cita({ id: 'NG-RARO01', total: 'gratis', dur: null, servicios: ['Corte', 'Barba'] }),
    cita({ id: 'NG-RARO02', inicio: 1420, dur: 60, estado: 'desconocido', servicios: [] })
  ] });
  assert.equal(r.data.imported, 2);
  const x1 = await f.db.findOne('appointments', { folio: 'NG-RARO01' });
  assert.deepEqual([x1.total, x1.duration_min], [320, 60]);
  const x2 = await f.db.findOne('appointments', { folio: 'NG-RARO02' });
  assert.deepEqual([x2.end_min, x2.status], [1440, 'confirmed']);
  assert.deepEqual(x2.services, [{ id: null, name: 'Servicio', price: 200, duration_min: 60 }]);
  assert.equal(nameKey('  ÁNGEL   Gómez '), 'angel gomez');
});

test('importación: nombre corto casa con el nombre completo si es único', async () => {
  const f = await setup();
  await f.db.update('staff', { id: 'st_barberA2' }, { name: 'Ángel Gómez' });
  const r = await f.imp('ownerA', { citas: [cita({ id: 'NG-ANGEL1', barbero: 'angel', barberoNombre: 'Angel' })], staff: LEGACY_STAFF.slice(0, 2) });
  assert.equal(r.data.staff_created, 0);
  assert.equal((await f.db.findOne('appointments', { folio: 'NG-ANGEL1' })).staff_id, 'st_barberA2');
});
