create table web_projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null, brief jsonb not null default '{}',
  created_by uuid references auth.users(id), created_at timestamptz default now()
);
create table web_versions (
  id bigserial primary key,
  project_id uuid not null references web_projects(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  n int not null, spec jsonb not null, note text not null default '', at timestamptz default now(),
  unique (project_id, n)
);
alter table web_projects enable row level security; alter table web_versions enable row level security;
-- exige módulo contratado además de pertenencia
create or replace function has_module(ws uuid, m text) returns boolean language sql stable security definer set search_path=public as $$
  select is_member(ws) and exists (select 1 from module_subscriptions s where s.workspace_id=ws and s.module_id=m and s.active) $$;
create policy wp_all on web_projects for all using (has_module(workspace_id,'web-studio')) with check (has_module(workspace_id,'web-studio') and is_member(workspace_id,'member'));
create policy wv_all on web_versions for all using (has_module(workspace_id,'web-studio')) with check (has_module(workspace_id,'web-studio') and is_member(workspace_id,'member'));
