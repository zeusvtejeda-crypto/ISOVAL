create table chat_agents (
  workspace_id uuid primary key references workspaces(id) on delete cascade,
  config jsonb not null, whatsapp_phone_number_id text unique, updated_at timestamptz default now()
);
create table chat_docs (id uuid primary key default gen_random_uuid(), workspace_id uuid not null references workspaces(id) on delete cascade, title text not null, text text not null, updated_at timestamptz default now());
create table chat_contacts (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references workspaces(id) on delete cascade,
  wa_id text not null, name text, stage text not null default 'nuevo', tags text[] not null default '{}', notes text,
  opted_out boolean not null default false, created_at timestamptz default now(), unique (workspace_id, wa_id)
);
create table chat_messages (
  id bigserial primary key, workspace_id uuid not null references workspaces(id) on delete cascade,
  contact_id uuid not null references chat_contacts(id) on delete cascade,
  direction text not null check (direction in ('in','out')), body text not null,
  wa_message_id text unique, status text not null default 'ok', -- ok | needs_human | blocked
  reason text, sources text[] default '{}', at timestamptz default now()
);
do $$ declare t text; begin
  foreach t in array array['chat_agents','chat_docs','chat_contacts','chat_messages'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for all using (has_module(workspace_id,''chat-agent'')) with check (has_module(workspace_id,''chat-agent'') and is_member(workspace_id,''member''))', t||'_all', t);
  end loop;
end $$;
