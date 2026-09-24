// Equipo de la barbería: listado, alta (con acceso opcional por correo), edición, baja (desactivar),
// PIN y cuenta de acceso. Dueño: todo (staff.manage). Barbero: solo su propio perfil (nombre, teléfono,
// bio, foto, PIN y color). Ver docs/API.md → "Contexto de barbería".
import { conflict, forbidden, notFound, bad, newId, nowIso, normEmail, isEmail } from '../util.js';
import { hashSecret, verifySecret, PIN_ITERATIONS } from '../crypto.js';
import { rateHit, rateCheck, rateFail, revokePinSessions } from '../session.js';
import { staffView } from '../domain/views.js';
import { shopSettings } from '../domain/settings.js';
import { notify } from '../domain/notify.js';
import { passwordError } from './auth.js';
import { body, failIf, dupError, textIn, phoneIn, colorIn, boolIn, boolOf, numIn, intIn, urlIn, IMAGE_KB } from './shop.js';

export const STAFF_ROLES = ['owner', 'barber'];
// Paleta sobria para distinguir barberos en la agenda (se asigna la primera libre).
export const STAFF_COLORS = ['#c8a24a', '#4f7cac', '#3e8e7e', '#b5654a', '#8e6c8a', '#6b7a8f', '#5e8c61', '#c27c8e', '#d4a373', '#2f6690', '#9c6644', '#7d8cc4'];
const SELF_FIELDS = ['name', 'phone', 'bio', 'avatar_url', 'pin', 'color'];
const MANAGER_FIELDS = ['role', 'bookable', 'commission_pct', 'active', 'sort', 'email', 'password'];
// Límites al fijar PIN (el PIN es único en la barbería, así que "ese PIN ya existe" delata un PIN ajeno):
//  - PIN_SELF_LIMIT: quien cambia SU PROPIO PIN sin ser dueño (barbero): cuenta CADA intento, choque o no,
//    5 por día. Probar PINs ajenos por aquí es muchísimo más lento que el propio login por PIN.
//  - PIN_SET_LIMIT + PIN_DUP_LIMIT: dueños (staff.manage), que dan de alta al equipo: cada intento cuenta con
//    un margen amplio y, además, los choques se limitan a 5 cada 15 min.
const PIN_SELF_LIMIT = { max: 5, windowMin: 1440, lockMin: 1440 };
const PIN_SET_LIMIT = { max: 30, windowMin: 60, lockMin: 60 };
const PIN_DUP_LIMIT = { max: 5, windowMin: 15, lockMin: 15 };
const IN_CHUNK = 80;
const BAD_EMAIL = 'Escribe un correo válido, por ejemplo nombre@correo.com.';

export function pickColor(used) {
  const taken = new Set((used || []).filter(Boolean).map((c) => String(c).toLowerCase()));
  return STAFF_COLORS.find((c) => !taken.has(c)) || STAFF_COLORS[taken.size % STAFF_COLORS.length];
}

// Cuentas vinculadas (tabla global users) de las filas de staff dadas: { user_id: user }.
async function usersOf(db, rows) {
  const ids = [...new Set(rows.map((s) => s.user_id).filter(Boolean))];
  const out = {};
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    for (const u of await db.find('users', { id: { in: ids.slice(i, i + IN_CHUNK) } })) out[u.id] = u;
  }
  return out;
}
// Vista Staff (docs/API.md) de varias filas con el correo de su cuenta, en una sola consulta.
export async function staffViews(db, rows) {
  const users = await usersOf(db, rows);
  return rows.map((s) => staffView(s, s.user_id ? users[s.user_id] : null));
}

async function getStaff(ctx) {
  const st = await ctx.sdb.findOne('staff', { id: String(ctx.params.id || '') });
  if (!st) throw notFound('No encontramos a esa persona del equipo.');
  return st;
}
const otherActiveOwners = (sdb, id, extra) => sdb.count('staff', Object.assign({ role: 'owner', active: true, id: { ne: id } }, extra || {}));

// Campos del formulario (solo los enviados). create: el nombre es obligatorio.
function parseInput(errs, b, { create }) {
  const v = {};
  const put = (k, x) => { if (x !== undefined) v[k] = x; };
  put('name', textIn(errs, 'name', create && b.name === undefined ? null : b.name, { min: 2, max: 60, label: 'El nombre', empty: 'Escribe el nombre.' }));
  if (b.role !== undefined) { if (STAFF_ROLES.includes(b.role)) v.role = b.role; else errs.role = 'Elige un rol: dueño o barbero.'; }
  put('bookable', boolIn(errs, 'bookable', b.bookable));
  if (!create) put('active', boolIn(errs, 'active', b.active));
  put('color', colorIn(errs, 'color', b.color));
  put('commission_pct', numIn(errs, 'commission_pct', b.commission_pct, 0, 100, 'La comisión'));
  put('phone', phoneIn(errs, 'phone', b.phone));
  put('bio', textIn(errs, 'bio', b.bio, { max: 300, label: 'La presentación', multiline: true }));
  put('avatar_url', urlIn(errs, 'avatar_url', b.avatar_url, { label: 'La foto', image: true, dataKB: IMAGE_KB.avatar }));
  put('sort', intIn(errs, 'sort', b.sort, 0, 10000, 'El orden'));
  if (b.pin !== undefined) {
    const p = typeof b.pin === 'string' || typeof b.pin === 'number' ? String(b.pin).trim() : null;
    if (p === '' || b.pin === null) v.pin = null;
    else if (p && /^\d{4,6}$/.test(p)) v.pin = p;
    else errs.pin = 'El PIN debe tener de 4 a 6 dígitos.';
  }
  return v;
}

// PIN único dentro de la barbería (se compara contra los hashes de todo el equipo, activo o no).
// Como la respuesta "ya existe" revela un PIN ajeno, cada intento se cuenta ANTES de comparar (rateHit,
// atómico): ver PIN_SELF_LIMIT / PIN_SET_LIMIT. Al barbero no se le dice de quién es ni que es de alguien.
async function assertPinFree(ctx, pin, exceptId) {
  const who = ctx.staff ? ctx.staff.id : (ctx.user ? ctx.user.id : 'anon');
  const manager = ctx.can('staff.manage');
  const dupKey = 'pindup:' + ctx.shop.id + ':' + who;
  if (manager) {
    await rateCheck(ctx.db, dupKey, PIN_DUP_LIMIT);
    await rateHit(ctx.db, 'pinset:' + ctx.shop.id + ':' + who, PIN_SET_LIMIT);
  } else {
    await rateHit(ctx.db, 'pinself:' + ctx.shop.id + ':' + who, PIN_SELF_LIMIT);
  }
  const rows = await ctx.sdb.find('staff', { pin_hash: { isNull: false } });
  for (const s of rows) {
    if (s.id !== exceptId && await verifySecret(pin, s.pin_hash)) {
      if (manager) {
        await rateFail(ctx.db, dupKey, PIN_DUP_LIMIT);
        throw dupError('Ese PIN ya lo usa otra persona del equipo. Elige otro.', 'pin');
      }
      throw dupError('Ese PIN no se puede usar. Elige otro.', 'pin');
    }
  }
}

// Plan para la cuenta de acceso (correo/contraseña) de un miembro; no escribe nada.
//   { kind: 'none' | 'link' (usuario existente, sin tocar su contraseña) | 'create' | 'unlink', user?, email?, password? }
// strict: el correo es obligatorio (POST /api/staff/:id/account).
async function planAccount(ctx, st, { email, password }, errs, strict) {
  const pw = typeof password === 'string' ? password : '';
  const cur = st && st.user_id ? await ctx.db.findOne('users', { id: st.user_id }) : null;
  const curEmail = cur ? cur.email : '';
  const self = !!(st && ctx.staff && ctx.staff.id === st.id);
  if (email === undefined) {
    if (!pw) { if (strict) errs.email = 'Escribe el correo para el acceso.'; return { kind: 'none', user: cur }; }
    email = curEmail;
  }
  if (email !== null && typeof email !== 'string') { errs.email = BAD_EMAIL; return null; }
  const e = email === null ? '' : normEmail(email);
  if (e === curEmail) {
    if (!pw) { if (strict && !e) errs.email = 'Escribe el correo para el acceso.'; return { kind: 'none', user: cur }; }
    if (cur) {
      errs.password = self ? 'Cambia tu contraseña desde tu perfil.' : 'Esta persona ya tiene acceso con ese correo. Su contraseña solo la puede cambiar ella desde su perfil.';
      return null;
    }
    errs.email = 'Escribe el correo para crear el acceso.';
    return null;
  }
  if (self) { errs.email = 'Tu propio correo de acceso no se cambia desde aquí.'; return null; }
  if (!e) {
    if (st.role === 'owner' && st.active && !(await otherActiveOwners(ctx.sdb, st.id, { user_id: { isNull: false } }))) {
      throw conflict('Debe quedar al menos un dueño activo con acceso por correo.');
    }
    return { kind: 'unlink', user: null };
  }
  if (!isEmail(e) || e.length > 160) { errs.email = BAD_EMAIL; return null; }
  const user = await ctx.db.findOne('users', { email: e });
  if (user) {
    if (user.status !== 'active') { errs.email = 'Esa cuenta está desactivada. Usa otro correo.'; return null; }
    const dup = await ctx.sdb.findOne('staff', st ? { user_id: user.id, id: { ne: st.id } } : { user_id: user.id });
    if (dup) {
      throw dupError(dup.active ? 'Ese correo ya es el acceso de ' + dup.name + ' en tu equipo.'
        : 'Ese correo es el acceso de ' + dup.name + ', que está desactivado. Reactívalo desde la lista del equipo.', 'email');
    }
    return { kind: 'link', user };
  }
  const pe = passwordError(pw);
  if (pe) { errs.password = pw ? pe : 'Escribe una contraseña de al menos 8 caracteres para crear su acceso.'; return null; }
  return { kind: 'create', email: e, password: pw };
}
// Ejecuta el plan: devuelve el usuario que queda vinculado (o null) y si se creó.
async function accountUser(ctx, plan, { name, phone }) {
  if (plan.kind === 'link' || plan.kind === 'none') return plan.user || null;
  if (plan.kind !== 'create') return null;
  return ctx.db.insert('users', {
    id: newId('us'), email: plan.email, name, phone: phone || null, password_hash: await hashSecret(plan.password),
    is_superadmin: false, status: 'active', created_at: nowIso(), last_login_at: null
  });
}
const accountLabel = (plan) => (plan && plan.kind === 'create' ? 'created' : plan && plan.kind === 'link' ? 'linked' : plan && plan.kind === 'unlink' ? 'removed' : null);
// Campos extra de la respuesta cuando se tocó el acceso por correo. Al VINCULAR una cuenta que ya existía
// (el correo ya estaba registrado en TuBarbería) nunca se cambia su contraseña: se avisa claramente al dueño,
// porque la contraseña que escribió (si escribió una) no se usa. Ver docs/API.md → "Contexto de barbería", nota ³.
function accountInfo(plan, password) {
  const account = accountLabel(plan);
  if (!account) return {};
  const out = { account };
  if (plan.kind === 'link') {
    const typed = typeof password === 'string' && password !== '';
    out.password_ignored = typed;
    out.notice = 'Ese correo ya tenía una cuenta en TuBarbería, así que se vinculó esa cuenta: la persona entra con SU contraseña de siempre.'
      + (typed ? ' La contraseña que escribiste no se usó ni se guardó.' : '')
      + ' Si no reconoce esa cuenta, quítale el acceso y usa otro correo.';
  }
  return out;
}
// Aviso en el panel del miembro cuando se vincula su cuenta existente (lo ve quien controla esa cuenta).
async function notifyLinked(ctx, plan, st) {
  if (!plan || plan.kind !== 'link' || !st) return;
  await notify(ctx.sdb, 'staff:' + st.id, {
    type: 'system', title: 'Te agregaron al equipo de ' + ctx.shop.name,
    body: 'Tu cuenta ' + plan.user.email + ' ahora da acceso a ' + ctx.shop.name + '. Si no esperabas esto, avisa al dueño de la barbería.',
    link: '#/', data: { kind: 'staff_linked', shop_id: ctx.shop.id }
  });
}

// ── Handlers ──
async function list(ctx) {
  const manage = ctx.can('staff.manage');
  const all = manage && boolOf(ctx.req.query.all) === true;
  const rows = await ctx.sdb.find('staff', all ? {} : { active: true }, { order: ['sort asc', 'name asc'] });
  const views = await staffViews(ctx.db, rows);
  if (manage) return views;
  // Barbero: de sus compañeros no ve correo, teléfono ni comisión. La forma NO cambia (mismas claves que
  // la vista Staff): email '', phone null y commission_pct null. Ver docs/API.md → "Vistas".
  const me = ctx.staff ? ctx.staff.id : null;
  return views.map((v) => (v.id === me ? v : Object.assign(v, { email: '', phone: null, commission_pct: null })));
}

async function create(ctx) {
  const b = body(ctx);
  const errs = {};
  const v = parseInput(errs, b, { create: true });
  const plan = await planAccount(ctx, null, { email: b.email, password: b.password }, errs, false);
  failIf(errs);
  if (v.pin) await assertPinFree(ctx, v.pin, null);
  const now = nowIso();
  const team = await ctx.sdb.find('staff', {});
  const role = v.role || 'barber';
  const row = {
    id: newId('st'), user_id: null, name: v.name, role, bookable: v.bookable === undefined ? true : v.bookable, active: true,
    color: v.color || pickColor(team.filter((s) => s.active).map((s) => s.color)),
    avatar_url: v.avatar_url || null, bio: v.bio || null, phone: v.phone || null,
    commission_pct: v.commission_pct === undefined ? (role === 'owner' ? 0 : 50) : v.commission_pct,
    pin_hash: v.pin ? await hashSecret(v.pin, PIN_ITERATIONS) : null,
    sort: v.sort === undefined ? team.reduce((m, s) => Math.max(m, Number(s.sort) || 0), -1) + 1 : v.sort,
    created_at: now, updated_at: now
  };
  const user = await accountUser(ctx, plan, row);
  row.user_id = user ? user.id : null;
  let st;
  try {
    st = await ctx.sdb.insert('staff', row);
    // Disponibilidad inicial = horario de la barbería (luego cada barbero la ajusta).
    const hours = shopSettings(ctx.shop).hours || {};
    const avail = [];
    for (let wd = 0; wd <= 6; wd++) {
      for (const r of (Array.isArray(hours[wd]) ? hours[wd] : [])) {
        if (Array.isArray(r) && Number.isInteger(r[0]) && Number.isInteger(r[1]) && r[0] < r[1]) avail.push({ id: newId('av'), staff_id: st.id, weekday: wd, start_min: r[0], end_min: r[1] });
      }
    }
    if (avail.length) await ctx.sdb.insertMany('availability', avail);
  } catch (e) {
    // Sin transacciones: limpieza best-effort para no dejar una cuenta o un miembro a medias.
    if (st) { try { await ctx.sdb.delete('availability', { staff_id: st.id }); await ctx.sdb.delete('staff', { id: st.id }); } catch (x) { /* nada */ } }
    if (plan && plan.kind === 'create' && user) { try { await ctx.db.delete('users', { id: user.id }); } catch (x) { /* nada */ } }
    throw e;
  }
  await notifyLinked(ctx, plan, st);
  return Object.assign(staffView(st, user), { account: accountLabel(plan) }, accountInfo(plan, b.password));
}

function unchanged(k, v, st, curEmail) {
  if (k === 'password') return v == null || v === '';
  if (k === 'email') return (typeof v === 'string' ? normEmail(v) : v == null ? '' : null) === curEmail;
  if (k === 'role') return v === st.role;
  if (k === 'bookable' || k === 'active') return boolOf(v) === st[k];
  return Number(v) === Number(st[k]);
}

async function update(ctx) {
  const st = await getStaff(ctx);
  const b = body(ctx);
  const manage = ctx.can('staff.manage');
  const self = !!ctx.staff && ctx.staff.id === st.id;
  let src = b;
  if (!manage) {
    if (!self) throw forbidden('Solo puedes editar tu propio perfil.');
    // Se toleran campos de dueño SIN cambios (formularios que reenvían todo); cualquier cambio → 403.
    let curEmail = '';
    if (b.email !== undefined && st.user_id) { const u = await ctx.db.findOne('users', { id: st.user_id }); curEmail = u ? u.email : ''; }
    if (MANAGER_FIELDS.some((k) => b[k] !== undefined && !unchanged(k, b[k], st, curEmail))) {
      throw forbidden('Solo puedes cambiar tu nombre, teléfono, presentación, foto, PIN y color.');
    }
    src = {};
    for (const k of SELF_FIELDS) if (b[k] !== undefined) src[k] = b[k];
  }
  const errs = {};
  const v = parseInput(errs, src, { create: false });
  const wantsAccount = manage && (b.email !== undefined || (typeof b.password === 'string' && b.password !== ''));
  const plan = wantsAccount ? await planAccount(ctx, st, { email: b.email, password: b.password }, errs, false) : null;
  failIf(errs);
  if (!Object.keys(v).length && !wantsAccount) throw bad('No hay cambios que guardar.');

  const role = v.role || st.role;
  const active = v.active === undefined ? st.active : v.active;
  if (self && !active) throw conflict('No puedes desactivarte a ti mismo.');
  if (self && st.role === 'owner' && role !== 'owner') throw conflict('No puedes quitarte el rol de dueño a ti mismo. Pídeselo a otro dueño.');
  if (st.role === 'owner' && st.active && (role !== 'owner' || !active) && !(await otherActiveOwners(ctx.sdb, st.id))) {
    throw conflict('Debe quedar al menos un dueño activo en la barbería.');
  }

  const patch = {};
  for (const k of ['name', 'role', 'bookable', 'commission_pct', 'sort']) if (v[k] !== undefined) patch[k] = v[k];
  for (const k of ['phone', 'bio', 'avatar_url']) if (v[k] !== undefined) patch[k] = v[k] || null;
  if (v.color !== undefined) {
    patch.color = v.color || pickColor((await ctx.sdb.find('staff', { active: true, id: { ne: st.id } })).map((s) => s.color));
  }
  if (v.active !== undefined) {
    patch.active = v.active;
    if (!v.active) patch.bookable = false;
    else if (!st.active && v.bookable === undefined) patch.bookable = true; // al reactivar vuelve a la reserva en línea
  }
  if (!active && patch.bookable) patch.bookable = false; // inactivo nunca aparece en la reserva
  if (v.pin !== undefined) {
    if (v.pin) { await assertPinFree(ctx, v.pin, st.id); patch.pin_hash = await hashSecret(v.pin, PIN_ITERATIONS); } else patch.pin_hash = null;
  }
  let user;
  if (plan) {
    user = await accountUser(ctx, plan, { name: v.name || st.name, phone: v.phone || st.phone });
    if (plan.kind !== 'none') patch.user_id = user ? user.id : null;
  } else user = st.user_id ? await ctx.db.findOne('users', { id: st.user_id }) : null;
  if (Object.keys(patch).length) {
    patch.updated_at = nowIso();
    await ctx.sdb.update('staff', { id: st.id }, patch);
  }
  // PIN cambiado o quitado, o miembro desactivado: se cierran sus sesiones PIN abiertas (quien conociera el
  // PIN viejo queda fuera). La sesión actual se conserva si es la suya (cambió su propio PIN desde el PIN).
  if (patch.pin_hash !== undefined || patch.active === false) await revokePinSessions(ctx.db, [st.id], { exceptId: ctx.session && ctx.session.id });
  const fresh = await ctx.sdb.findOne('staff', { id: st.id });
  const out = staffView(fresh, user);
  if (plan && plan.kind !== 'none') { Object.assign(out, accountInfo(plan, b.password)); await notifyLinked(ctx, plan, fresh); }
  return out;
}

// DELETE = desactivar (conserva historial de citas, pagos y comisiones).
async function deactivate(ctx) {
  const st = await getStaff(ctx);
  if (ctx.staff && ctx.staff.id === st.id) throw conflict('No puedes desactivarte a ti mismo.');
  if (st.role === 'owner' && st.active && !(await otherActiveOwners(ctx.sdb, st.id))) throw conflict('Debe quedar al menos un dueño activo en la barbería.');
  if (st.active || st.bookable) await ctx.sdb.update('staff', { id: st.id }, { active: false, bookable: false, updated_at: nowIso() });
  await revokePinSessions(ctx.db, [st.id]);
  const [fresh, user, upcoming] = await Promise.all([
    ctx.sdb.findOne('staff', { id: st.id }),
    st.user_id ? ctx.db.findOne('users', { id: st.user_id }) : null,
    ctx.sdb.count('appointments', { staff_id: st.id, date: { gte: ctx.now().date }, status: { in: ['pending', 'confirmed'] } })
  ]);
  // upcoming_appointments: citas próximas que quedaron a su nombre (el panel sugiere reasignarlas).
  return Object.assign(staffView(fresh, user), { upcoming_appointments: upcoming });
}

async function setAccount(ctx) {
  const st = await getStaff(ctx);
  const b = body(ctx);
  const errs = {};
  const remove = b.remove === true;
  // Sin correo no hay nada que hacer aquí; para quitar el acceso se pide explícitamente { remove: true }.
  if (!remove && (b.email == null || (typeof b.email === 'string' && !b.email.trim()))) throw bad('Escribe el correo para el acceso.', { email: 'Escribe el correo para el acceso.' });
  const plan = await planAccount(ctx, st, remove ? { email: '' } : { email: b.email, password: b.password }, errs, !remove);
  failIf(errs);
  const user = await accountUser(ctx, plan, { name: st.name, phone: st.phone });
  if (plan.kind !== 'none') await ctx.sdb.update('staff', { id: st.id }, { user_id: user ? user.id : null, updated_at: nowIso() });
  const fresh = await ctx.sdb.findOne('staff', { id: st.id });
  await notifyLinked(ctx, plan, fresh);
  return Object.assign(staffView(fresh, user), { account: accountLabel(plan) }, accountInfo(plan, remove ? undefined : b.password));
}

export const routes = [
  { method: 'GET', path: '/api/staff', auth: 'shop', perm: 'staff.read', handler: list },
  { method: 'POST', path: '/api/staff', auth: 'shop', perm: 'staff.manage', handler: create },
  { method: 'POST', path: '/api/staff/:id/account', auth: 'shop', perm: 'staff.manage', handler: setAccount },
  { method: 'PATCH', path: '/api/staff/:id', auth: 'shop', perm: ['staff.manage', 'staff.read'], handler: update },
  { method: 'DELETE', path: '/api/staff/:id', auth: 'shop', perm: 'staff.manage', handler: deactivate }
];
