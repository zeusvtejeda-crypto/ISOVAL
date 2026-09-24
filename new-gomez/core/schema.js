// Esquema único de la base de datos. De aquí salen:
//   - la migración SQL de Cloudflare D1 (scripts/gen-migration.mjs → migrations/0001_init.sql)
//   - la (de)serialización de columnas en ambos adaptadores (db-d1.js y db-memory.js)
// Tipos: text | int | real | bool (0/1 en SQL, true/false en JS) | json (TEXT en SQL, objeto en JS).
//
// AISLAMIENTO MULTIBARBERÍA: toda tabla con `scoped: true` lleva shop_id y solo se accede a
// través de scopedDb(db, shopId) (ver db.js), que inyecta shop_id en cada consulta/escritura.
// Ningún handler recibe shop_id del cliente para filtrar: sale de la sesión.

const T = (type, extra) => Object.assign({ type }, extra || {});

export const SCHEMA = {
  shops: {
    scoped: false,
    columns: {
      id: T('text', { pk: true }),
      slug: T('text', { notNull: true }),
      name: T('text', { notNull: true }),
      tagline: T('text'),
      description: T('text'),
      phone: T('text'),        // 10 dígitos
      whatsapp: T('text'),     // 10 dígitos (si vacío se usa phone)
      email: T('text'),
      address: T('text'),
      city: T('text'),
      maps_url: T('text'),
      timezone: T('text', { notNull: true, default: 'America/Mexico_City' }),
      currency: T('text', { notNull: true, default: 'MXN' }),
      logo_url: T('text'),
      cover_url: T('text'),
      brand_color: T('text'),
      domain: T('text'),       // dominio propio opcional (p. ej. gomez.tubarberia.mx)
      status: T('text', { notNull: true, default: 'active' }), // active | suspended
      plan: T('text', { notNull: true, default: 'basic' }),    // demo | basic | pro
      settings: T('json'),     // ver DEFAULT_SETTINGS en domain/settings.js
      created_at: T('text', { notNull: true }),
      updated_at: T('text')
    },
    unique: [['slug']],
    indexes: [['domain']]
  },

  users: {
    scoped: false,
    columns: {
      id: T('text', { pk: true }),
      email: T('text', { notNull: true }),
      name: T('text', { notNull: true }),
      phone: T('text'),
      password_hash: T('text'),
      is_superadmin: T('bool', { notNull: true, default: false }),
      status: T('text', { notNull: true, default: 'active' }), // active | disabled
      created_at: T('text', { notNull: true }),
      last_login_at: T('text')
    },
    unique: [['email']]
  },

  sessions: {
    scoped: false,
    columns: {
      id: T('text', { pk: true }),          // sha256(token) — el token en claro solo vive en la cookie
      user_id: T('text'),                   // sesión por correo/contraseña
      staff_id: T('text'),                  // sesión por PIN (sin usuario)
      shop_id: T('text'),                   // barbería fija para sesiones PIN
      kind: T('text', { notNull: true }),   // password | pin
      created_at: T('text', { notNull: true }),
      expires_at: T('text', { notNull: true }),
      last_seen_at: T('text'),
      user_agent: T('text')
    },
    indexes: [['user_id'], ['staff_id']]
  },

  login_attempts: {
    scoped: false,
    columns: {
      id: T('text', { pk: true }),          // clave: 'pw:<email>' | 'pin:<shop>:<ip>' | 'ip:<ip>'
      count: T('int', { notNull: true, default: 0 }),
      first_at: T('text', { notNull: true }),
      locked_until: T('text')
    }
  },

  staff: {
    scoped: true,
    columns: {
      id: T('text', { pk: true }),
      shop_id: T('text', { notNull: true }),
      user_id: T('text'),                   // cuenta con la que inicia sesión (opcional)
      name: T('text', { notNull: true }),
      role: T('text', { notNull: true }),   // owner | barber
      bookable: T('bool', { notNull: true, default: true }), // aparece en la reserva en línea
      active: T('bool', { notNull: true, default: true }),
      color: T('text'),
      avatar_url: T('text'),
      bio: T('text'),
      phone: T('text'),
      commission_pct: T('real', { notNull: true, default: 50 }),
      pin_hash: T('text'),
      sort: T('int', { notNull: true, default: 0 }),
      created_at: T('text', { notNull: true }),
      updated_at: T('text')
    },
    indexes: [['shop_id', 'user_id']]
  },

  clients: {
    scoped: true,
    columns: {
      id: T('text', { pk: true }),
      shop_id: T('text', { notNull: true }),
      user_id: T('text'),                   // si el cliente creó cuenta
      name: T('text', { notNull: true }),
      phone: T('text'),
      email: T('text'),
      birthday: T('text'),                  // YYYY-MM-DD
      notes: T('text'),                     // notas internas (preferencias, alergias…)
      tags: T('json'),                      // ['VIP', 'Barba', …]
      source: T('text'),                    // online | manual | walkin | import
      marketing_ok: T('bool', { notNull: true, default: true }),
      deleted_at: T('text'),
      created_at: T('text', { notNull: true }),
      updated_at: T('text')
    },
    indexes: [['shop_id', 'phone'], ['shop_id', 'user_id'], ['shop_id', 'email']]
  },

  services: {
    scoped: true,
    columns: {
      id: T('text', { pk: true }),
      shop_id: T('text', { notNull: true }),
      name: T('text', { notNull: true }),
      description: T('text'),
      category: T('text'),
      duration_min: T('int', { notNull: true }),
      price: T('real', { notNull: true, default: 0 }),
      active: T('bool', { notNull: true, default: true }),
      popular: T('bool', { notNull: true, default: false }),
      staff_ids: T('json'),                 // [] o null = lo ofrecen todos los barberos
      sort: T('int', { notNull: true, default: 0 }),
      created_at: T('text', { notNull: true }),
      updated_at: T('text')
    }
  },

  availability: {
    scoped: true,
    columns: {
      id: T('text', { pk: true }),
      shop_id: T('text', { notNull: true }),
      staff_id: T('text', { notNull: true }),
      weekday: T('int', { notNull: true }), // 0 = domingo … 6 = sábado
      start_min: T('int', { notNull: true }),
      end_min: T('int', { notNull: true })
    },
    indexes: [['shop_id', 'staff_id']]
  },

  time_off: {
    scoped: true,
    columns: {
      id: T('text', { pk: true }),
      shop_id: T('text', { notNull: true }),
      staff_id: T('text'),                  // null = toda la barbería (feriado)
      date_from: T('text', { notNull: true }),
      date_to: T('text', { notNull: true }),
      start_min: T('int'),                  // null = día completo
      end_min: T('int'),
      reason: T('text'),
      created_at: T('text', { notNull: true })
    },
    indexes: [['shop_id', 'date_from']]
  },

  appointments: {
    scoped: true,
    columns: {
      id: T('text', { pk: true }),
      shop_id: T('text', { notNull: true }),
      folio: T('text', { notNull: true }),
      client_id: T('text'),
      staff_id: T('text', { notNull: true }),
      date: T('text', { notNull: true }),   // YYYY-MM-DD hora local de la barbería
      start_min: T('int', { notNull: true }),
      end_min: T('int', { notNull: true }),
      duration_min: T('int', { notNull: true }),
      services: T('json', { notNull: true }), // [{id,name,price,duration_min}]
      total: T('real', { notNull: true, default: 0 }),
      status: T('text', { notNull: true }), // pending | confirmed | completed | cancelled | no_show
      source: T('text', { notNull: true, default: 'manual' }), // online | manual | walkin | import
      client_name: T('text'),               // copia para listados rápidos
      client_phone: T('text'),
      client_note: T('text'),               // lo que escribió el cliente
      internal_note: T('text'),             // nota del equipo (no la ve el cliente)
      cancel_reason: T('text'),
      cancelled_by: T('text'),              // client | staff
      manage_token_hash: T('text'),         // enlace "gestionar mi cita" sin cuenta
      first_visit: T('bool'),
      reminder_sent_at: T('text'),
      confirmed_at: T('text'),
      completed_at: T('text'),
      reschedule_count: T('int', { notNull: true, default: 0 }),
      created_by: T('text'),
      created_at: T('text', { notNull: true }),
      updated_at: T('text')
    },
    indexes: [['shop_id', 'date'], ['shop_id', 'staff_id', 'date'], ['shop_id', 'client_id'], ['manage_token_hash'], ['shop_id', 'folio']]
  },

  appointment_events: {
    scoped: true,
    columns: {
      id: T('text', { pk: true }),
      shop_id: T('text', { notNull: true }),
      appointment_id: T('text', { notNull: true }),
      type: T('text', { notNull: true }),   // created | status | rescheduled | edited | note | payment | message
      data: T('json'),
      actor_id: T('text'),
      actor_name: T('text'),
      created_at: T('text', { notNull: true })
    },
    indexes: [['shop_id', 'appointment_id']]
  },

  payments: {
    scoped: true,
    columns: {
      id: T('text', { pk: true }),
      shop_id: T('text', { notNull: true }),
      appointment_id: T('text'),
      client_id: T('text'),
      staff_id: T('text'),
      amount: T('real', { notNull: true }), // monto de servicios/productos (sin propina)
      tip: T('real', { notNull: true, default: 0 }),
      method: T('text', { notNull: true }), // cash | card | transfer | other
      concept: T('text'),
      status: T('text', { notNull: true, default: 'paid' }), // paid | refunded
      cash_session_id: T('text'),
      created_by: T('text'),
      created_at: T('text', { notNull: true }),
      date: T('text', { notNull: true })    // fecha local del cobro (para reportes por día)
    },
    indexes: [['shop_id', 'date'], ['shop_id', 'appointment_id'], ['shop_id', 'staff_id', 'date']]
  },

  cash_sessions: {
    scoped: true,
    columns: {
      id: T('text', { pk: true }),
      shop_id: T('text', { notNull: true }),
      status: T('text', { notNull: true }), // open | closed
      opened_by: T('text'),
      opened_by_name: T('text'),
      opened_at: T('text', { notNull: true }),
      opening_float: T('real', { notNull: true, default: 0 }),
      closed_by: T('text'),
      closed_by_name: T('text'),
      closed_at: T('text'),
      expected_cash: T('real'),
      counted_cash: T('real'),
      difference: T('real'),
      notes: T('text'),
      date: T('text', { notNull: true })
    },
    indexes: [['shop_id', 'status'], ['shop_id', 'date']]
  },

  cash_movements: {
    scoped: true,
    columns: {
      id: T('text', { pk: true }),
      shop_id: T('text', { notNull: true }),
      cash_session_id: T('text', { notNull: true }),
      type: T('text', { notNull: true }),   // income | expense | withdrawal
      amount: T('real', { notNull: true }),
      concept: T('text'),
      created_by: T('text'),
      created_by_name: T('text'),
      created_at: T('text', { notNull: true })
    },
    indexes: [['shop_id', 'cash_session_id']]
  },

  commission_payouts: {
    scoped: true,
    columns: {
      id: T('text', { pk: true }),
      shop_id: T('text', { notNull: true }),
      staff_id: T('text', { notNull: true }),
      period_from: T('text', { notNull: true }),
      period_to: T('text', { notNull: true }),
      amount: T('real', { notNull: true }),
      note: T('text'),
      created_by: T('text'),
      created_at: T('text', { notNull: true })
    },
    indexes: [['shop_id', 'staff_id']]
  },

  notifications: {
    scoped: true,
    columns: {
      id: T('text', { pk: true }),
      shop_id: T('text', { notNull: true }),
      staff_id: T('text'),                  // destinatario del equipo
      client_id: T('text'),                 // o destinatario cliente
      type: T('text', { notNull: true }),   // booking_new | booking_cancelled | booking_rescheduled | reminder_due | cash_closed | client_new | system
      title: T('text', { notNull: true }),
      body: T('text'),
      link: T('text'),                      // ruta dentro de la app, p. ej. '#/agenda?cita=ap_x'
      data: T('json'),
      read_at: T('text'),
      created_at: T('text', { notNull: true })
    },
    indexes: [['shop_id', 'staff_id', 'read_at'], ['shop_id', 'client_id']]
  },

  messages: {
    scoped: true,
    columns: {
      id: T('text', { pk: true }),
      shop_id: T('text', { notNull: true }),
      appointment_id: T('text'),
      client_id: T('text'),
      channel: T('text', { notNull: true, default: 'whatsapp' }),
      kind: T('text', { notNull: true }),   // confirmation | reminder | reschedule | cancellation | thanks | no_show | custom
      to_phone: T('text'),
      body: T('text', { notNull: true }),
      status: T('text', { notNull: true }), // prepared | opened | sent | queued | failed
      provider_id: T('text'),
      error: T('text'),
      created_by: T('text'),
      created_at: T('text', { notNull: true }),
      sent_at: T('text')
    },
    indexes: [['shop_id', 'status'], ['shop_id', 'appointment_id'], ['shop_id', 'client_id']]
  }
};

export const TABLES = Object.keys(SCHEMA);

// Genera el SQL de creación (D1 / SQLite).
export function toSQL() {
  const sqlType = { text: 'TEXT', int: 'INTEGER', real: 'REAL', bool: 'INTEGER', json: 'TEXT' };
  const out = [];
  for (const [name, def] of Object.entries(SCHEMA)) {
    const cols = Object.entries(def.columns).map(([c, d]) => {
      let s = '  ' + c + ' ' + sqlType[d.type];
      if (d.pk) s += ' PRIMARY KEY';
      if (d.notNull && !d.pk) s += ' NOT NULL';
      if (d.default !== undefined) {
        const v = d.type === 'bool' ? (d.default ? 1 : 0) : d.default;
        s += ' DEFAULT ' + (typeof v === 'string' ? "'" + v.replace(/'/g, "''") + "'" : v);
      }
      return s;
    });
    out.push('CREATE TABLE IF NOT EXISTS ' + name + ' (\n' + cols.join(',\n') + '\n);');
    (def.unique || []).forEach((u) => out.push('CREATE UNIQUE INDEX IF NOT EXISTS ux_' + name + '_' + u.join('_') + ' ON ' + name + ' (' + u.join(', ') + ');'));
    (def.indexes || []).forEach((u) => out.push('CREATE INDEX IF NOT EXISTS ix_' + name + '_' + u.join('_') + ' ON ' + name + ' (' + u.join(', ') + ');'));
  }
  return out.join('\n') + '\n';
}
