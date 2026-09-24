-- TuBarbería — esquema inicial de Cloudflare D1 (17 tablas).
-- GENERADO por scripts/gen-migration.mjs desde core/schema.js: no lo edites a mano.
-- La app lo aplica sola al arrancar (core/d1-migrate.js); todas las sentencias son IF NOT EXISTS.
CREATE TABLE IF NOT EXISTS shops (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  tagline TEXT,
  description TEXT,
  phone TEXT,
  whatsapp TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  maps_url TEXT,
  timezone TEXT NOT NULL DEFAULT 'America/Mexico_City',
  currency TEXT NOT NULL DEFAULT 'MXN',
  logo_url TEXT,
  cover_url TEXT,
  brand_color TEXT,
  domain TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  plan TEXT NOT NULL DEFAULT 'basic',
  settings TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_shops_slug ON shops (slug);
CREATE INDEX IF NOT EXISTS ix_shops_domain ON shops (domain);
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  password_hash TEXT,
  is_superadmin INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  last_login_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_users_email ON users (email);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  staff_id TEXT,
  shop_id TEXT,
  kind TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT,
  user_agent TEXT
);
CREATE INDEX IF NOT EXISTS ix_sessions_user_id ON sessions (user_id);
CREATE INDEX IF NOT EXISTS ix_sessions_staff_id ON sessions (staff_id);
CREATE TABLE IF NOT EXISTS login_attempts (
  id TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  first_at TEXT NOT NULL,
  locked_until TEXT
);
CREATE TABLE IF NOT EXISTS staff (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL,
  user_id TEXT,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  bookable INTEGER NOT NULL DEFAULT 1,
  active INTEGER NOT NULL DEFAULT 1,
  color TEXT,
  avatar_url TEXT,
  bio TEXT,
  phone TEXT,
  commission_pct REAL NOT NULL DEFAULT 50,
  pin_hash TEXT,
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS ix_staff_shop_id_user_id ON staff (shop_id, user_id);
CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL,
  user_id TEXT,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  birthday TEXT,
  notes TEXT,
  tags TEXT,
  source TEXT,
  marketing_ok INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS ix_clients_shop_id_phone ON clients (shop_id, phone);
CREATE INDEX IF NOT EXISTS ix_clients_shop_id_user_id ON clients (shop_id, user_id);
CREATE INDEX IF NOT EXISTS ix_clients_shop_id_email ON clients (shop_id, email);
CREATE TABLE IF NOT EXISTS services (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  duration_min INTEGER NOT NULL,
  price REAL NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  popular INTEGER NOT NULL DEFAULT 0,
  staff_ids TEXT,
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT
);
CREATE TABLE IF NOT EXISTS availability (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL,
  staff_id TEXT NOT NULL,
  weekday INTEGER NOT NULL,
  start_min INTEGER NOT NULL,
  end_min INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_availability_shop_id_staff_id ON availability (shop_id, staff_id);
CREATE TABLE IF NOT EXISTS time_off (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL,
  staff_id TEXT,
  date_from TEXT NOT NULL,
  date_to TEXT NOT NULL,
  start_min INTEGER,
  end_min INTEGER,
  reason TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_time_off_shop_id_date_from ON time_off (shop_id, date_from);
CREATE TABLE IF NOT EXISTS appointments (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL,
  folio TEXT NOT NULL,
  client_id TEXT,
  staff_id TEXT NOT NULL,
  date TEXT NOT NULL,
  start_min INTEGER NOT NULL,
  end_min INTEGER NOT NULL,
  duration_min INTEGER NOT NULL,
  services TEXT NOT NULL,
  total REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  client_name TEXT,
  client_phone TEXT,
  client_note TEXT,
  internal_note TEXT,
  cancel_reason TEXT,
  cancelled_by TEXT,
  manage_token_hash TEXT,
  first_visit INTEGER,
  reminder_sent_at TEXT,
  confirmed_at TEXT,
  completed_at TEXT,
  reschedule_count INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS ix_appointments_shop_id_date ON appointments (shop_id, date);
CREATE INDEX IF NOT EXISTS ix_appointments_shop_id_staff_id_date ON appointments (shop_id, staff_id, date);
CREATE INDEX IF NOT EXISTS ix_appointments_shop_id_client_id ON appointments (shop_id, client_id);
CREATE INDEX IF NOT EXISTS ix_appointments_manage_token_hash ON appointments (manage_token_hash);
CREATE INDEX IF NOT EXISTS ix_appointments_shop_id_folio ON appointments (shop_id, folio);
CREATE TABLE IF NOT EXISTS appointment_events (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL,
  appointment_id TEXT NOT NULL,
  type TEXT NOT NULL,
  data TEXT,
  actor_id TEXT,
  actor_name TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_appointment_events_shop_id_appointment_id ON appointment_events (shop_id, appointment_id);
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL,
  appointment_id TEXT,
  client_id TEXT,
  staff_id TEXT,
  amount REAL NOT NULL,
  tip REAL NOT NULL DEFAULT 0,
  method TEXT NOT NULL,
  concept TEXT,
  status TEXT NOT NULL DEFAULT 'paid',
  cash_session_id TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL,
  date TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_payments_shop_id_date ON payments (shop_id, date);
CREATE INDEX IF NOT EXISTS ix_payments_shop_id_appointment_id ON payments (shop_id, appointment_id);
CREATE INDEX IF NOT EXISTS ix_payments_shop_id_staff_id_date ON payments (shop_id, staff_id, date);
CREATE TABLE IF NOT EXISTS cash_sessions (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL,
  status TEXT NOT NULL,
  opened_by TEXT,
  opened_by_name TEXT,
  opened_at TEXT NOT NULL,
  opening_float REAL NOT NULL DEFAULT 0,
  closed_by TEXT,
  closed_by_name TEXT,
  closed_at TEXT,
  expected_cash REAL,
  counted_cash REAL,
  difference REAL,
  notes TEXT,
  date TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_cash_sessions_shop_id_status ON cash_sessions (shop_id, status);
CREATE INDEX IF NOT EXISTS ix_cash_sessions_shop_id_date ON cash_sessions (shop_id, date);
CREATE TABLE IF NOT EXISTS cash_movements (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL,
  cash_session_id TEXT NOT NULL,
  type TEXT NOT NULL,
  amount REAL NOT NULL,
  concept TEXT,
  created_by TEXT,
  created_by_name TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_cash_movements_shop_id_cash_session_id ON cash_movements (shop_id, cash_session_id);
CREATE TABLE IF NOT EXISTS commission_payouts (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL,
  staff_id TEXT NOT NULL,
  period_from TEXT NOT NULL,
  period_to TEXT NOT NULL,
  amount REAL NOT NULL,
  note TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_commission_payouts_shop_id_staff_id ON commission_payouts (shop_id, staff_id);
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL,
  staff_id TEXT,
  client_id TEXT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  data TEXT,
  read_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_notifications_shop_id_staff_id_read_at ON notifications (shop_id, staff_id, read_at);
CREATE INDEX IF NOT EXISTS ix_notifications_shop_id_client_id ON notifications (shop_id, client_id);
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL,
  appointment_id TEXT,
  client_id TEXT,
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  kind TEXT NOT NULL,
  to_phone TEXT,
  body TEXT NOT NULL,
  status TEXT NOT NULL,
  provider_id TEXT,
  error TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL,
  sent_at TEXT
);
CREATE INDEX IF NOT EXISTS ix_messages_shop_id_status ON messages (shop_id, status);
CREATE INDEX IF NOT EXISTS ix_messages_shop_id_appointment_id ON messages (shop_id, appointment_id);
CREATE INDEX IF NOT EXISTS ix_messages_shop_id_client_id ON messages (shop_id, client_id);
