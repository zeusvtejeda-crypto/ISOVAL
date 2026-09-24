// Roles y permisos. Un único lugar para decidir quién puede qué.
//   superadmin — plataforma: gestiona todas las barberías; dentro de una barbería actúa como dueño.
//   owner      — dueño: control total de SU barbería.
//   barber     — barbero: su agenda, su disponibilidad, sus clientes atendidos, sus ganancias.
//   client     — cliente: reserva, ve/cancela/reagenda sus citas, su perfil.
//
// Permisos con sufijo ".own" limitan al barbero a lo suyo (staff_id = el suyo); el handler
// debe aplicar ese filtro cuando ctx.can('x.all') es falso y ctx.can('x.own') es verdadero.

export const ROLES = ['superadmin', 'owner', 'barber', 'client'];

export const ROLE_LABEL = { superadmin: 'Superadmin', owner: 'Dueño', barber: 'Barbero', client: 'Cliente' };

const MATRIX = {
  'shop.read':               ['owner', 'barber', 'client'],
  'shop.update':             ['owner'],
  'staff.read':              ['owner', 'barber'],
  'staff.manage':            ['owner'],
  'services.read':           ['owner', 'barber', 'client'],
  'services.manage':         ['owner'],
  'availability.read':       ['owner', 'barber'],
  'availability.manage.all': ['owner'],
  'availability.manage.own': ['barber'],
  'timeoff.manage.all':      ['owner'],
  'timeoff.manage.own':      ['barber'],
  'appointments.read.all':   ['owner'],
  'appointments.read.own':   ['barber'],
  'appointments.write.all':  ['owner'],
  'appointments.write.own':  ['barber'],
  'clients.read.all':        ['owner'],
  'clients.read.own':        ['barber'],   // clientes que ha atendido o tiene agendados
  'clients.write':           ['owner', 'barber'],
  'clients.delete':          ['owner'],
  'payments.read.all':       ['owner'],
  'payments.read.own':       ['barber'],
  'payments.write':          ['owner', 'barber'],
  'payments.refund':         ['owner'],
  'cash.manage':             ['owner'],
  'cash.read':               ['owner'],
  'commissions.read.all':    ['owner'],
  'commissions.read.own':    ['barber'],
  'commissions.payout':      ['owner'],
  'reports.read':            ['owner'],
  'reports.export':          ['owner'],
  'notifications.read':      ['owner', 'barber', 'client'],
  'messages.send':           ['owner', 'barber'],
  'messages.read.all':       ['owner'],
  'settings.manage':         ['owner'],
  'import.legacy':           ['owner'],
  'my.appointments':         ['client'],
  'platform.manage':         ['superadmin']
};

export const PERMISSIONS = Object.keys(MATRIX);

export function can(role, perm) {
  if (!MATRIX[perm]) throw new Error('Permiso desconocido: ' + perm);
  if (role === 'superadmin') return perm !== 'my.appointments';
  return MATRIX[perm].includes(role);
}

// Lista de permisos del rol (el frontend la usa para mostrar/ocultar menús y botones).
export function permissionsFor(role) { return PERMISSIONS.filter((p) => can(role, p)); }
