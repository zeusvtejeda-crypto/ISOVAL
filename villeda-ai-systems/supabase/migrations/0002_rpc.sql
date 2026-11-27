-- Creación atómica de workspace: crea, asigna owner y audita. Único camino de alta para usuarios.
create or replace function create_workspace(p_name text, p_locale text default 'es') returns uuid
language plpgsql security definer set search_path = public as $$
declare ws uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if length(trim(p_name)) < 2 then raise exception 'invalid name'; end if;
  insert into workspaces(name, locale) values (trim(p_name), p_locale) returning id into ws;
  insert into members(workspace_id, user_id, role) values (ws, auth.uid(), 'owner');
  insert into audit_log(workspace_id, actor, action) values (ws, auth.uid(), 'workspace.created');
  return ws;
end $$;
revoke all on function create_workspace(text,text) from public;
grant execute on function create_workspace(text,text) to authenticated;
