-- VILLEDA AI Systems — núcleo multi-tenant. Aislamiento por workspace vía RLS.
create extension if not exists pgcrypto;

create type role_t as enum ('owner','admin','member','viewer');
create type plan_t as enum ('starter','professional','business','agency');

create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  parent_id uuid references workspaces(id), -- Agency: sub-espacios de clientes
  plan plan_t not null default 'starter',
  locale text not null default 'es' check (locale in ('es','en')),
  branding jsonb not null default '{}', -- marca blanca
  created_at timestamptz not null default now()
);
create table members (
  workspace_id uuid references workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role role_t not null default 'member',
  primary key (workspace_id, user_id)
);
create table module_subscriptions (
  workspace_id uuid references workspaces(id) on delete cascade,
  module_id text not null,
  active boolean not null default true,
  primary key (workspace_id, module_id)
);
create table usage_ledger (
  id bigserial primary key,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  module_id text not null, provider text, units numeric not null, kind text not null,
  period date not null default date_trunc('month', now())::date, at timestamptz default now()
);
create table module_links ( -- el usuario autoriza compartir datos entre módulos
  workspace_id uuid references workspaces(id) on delete cascade,
  source text, target text, granted_by uuid references auth.users(id), primary key (workspace_id, source, target)
);
create table automations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  enabled boolean default true, trigger jsonb not null, action jsonb not null, requires_approval boolean default true
);
create table events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  source text not null, type text not null, payload jsonb not null default '{}', at timestamptz default now()
);
create table audit_log (
  id bigserial primary key,
  workspace_id uuid references workspaces(id) on delete cascade,
  actor uuid, action text not null, detail jsonb default '{}', at timestamptz default now()
);

create or replace function is_member(ws uuid, min_role role_t default 'viewer') returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from members m where m.workspace_id = ws and m.user_id = auth.uid()
    and array_position(array['viewer','member','admin','owner']::text[], m.role::text)
      >= array_position(array['viewer','member','admin','owner']::text[], min_role::text));
$$;

do $$ declare t text; begin
  foreach t in array array['workspaces','members','module_subscriptions','usage_ledger','module_links','automations','events','audit_log'] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

create policy ws_read on workspaces for select using (is_member(id));
create policy ws_write on workspaces for update using (is_member(id,'admin'));
create policy mem_read on members for select using (is_member(workspace_id));
create policy mem_admin on members for all using (is_member(workspace_id,'admin')) with check (is_member(workspace_id,'admin'));
create policy sub_read on module_subscriptions for select using (is_member(workspace_id));
create policy use_read on usage_ledger for select using (is_member(workspace_id));
create policy lnk_read on module_links for select using (is_member(workspace_id));
create policy lnk_admin on module_links for all using (is_member(workspace_id,'admin')) with check (is_member(workspace_id,'admin'));
create policy aut_read on automations for select using (is_member(workspace_id));
create policy aut_admin on automations for all using (is_member(workspace_id,'admin')) with check (is_member(workspace_id,'admin'));
create policy evt_read on events for select using (is_member(workspace_id));
create policy aud_read on audit_log for select using (is_member(workspace_id,'admin'));
-- Escrituras de subscriptions/usage/events/audit: solo service_role (servidor) — sin policy de insert para usuarios.
