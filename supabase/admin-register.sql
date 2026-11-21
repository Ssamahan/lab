-- Preparation only. These functions do not revoke the existing anonymous table
-- policies. Do not claim the register is protected until the cutover is complete.
-- The existing version and revision triggers must remain enabled for safe writes.
create or replace function public.lab_admin_read_register()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_result jsonb;
begin
  if public.lab_my_access_role() is distinct from 'Admin' then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  select jsonb_build_object('data',r.data,'revision',r.revision,'updated_at',r.updated_at)
    into v_result from public.lab_registers r where r.id='ruli-dh';
  if not found then raise exception 'register not found' using errcode = 'P0002'; end if;
  return v_result;
end $$;

-- A whole-register write is only for Admin. Reviewer roster work must use a
-- narrower endpoint. A device must reconcile conflicts, never force a stale copy.
create or replace function public.lab_admin_write_register(p_expected_revision bigint,p_data jsonb,p_client_id text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  v_revision bigint;
  v_old jsonb;
begin
  if public.lab_my_access_role() is distinct from 'Admin' then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_expected_revision is null or p_expected_revision < 1 or p_data is null
     or jsonb_typeof(p_data) <> 'object' or p_client_id is null
     or length(p_client_id) < 1 or length(p_client_id) > 128 then
    raise exception 'invalid request' using errcode = '22023';
  end if;
  select r.revision,r.data into v_revision,v_old
    from public.lab_registers r where r.id='ruli-dh' for update;
  if not found then raise exception 'register not found' using errcode = 'P0002'; end if;
  if v_revision <> p_expected_revision then
    raise exception 'register changed; reconcile before retrying' using errcode = '40001';
  end if;
  -- A partial document must never silently erase sections the device did not read.
  if jsonb_typeof(v_old) <> 'object' or exists
     (select 1 from jsonb_object_keys(v_old) as k(key) where not (p_data ? k.key)) then
    raise exception 'incomplete register' using errcode = '22023';
  end if;
  update public.lab_registers r set data=p_data,client_id=p_client_id,updated_by=auth.uid()::text
    where r.id='ruli-dh' returning r.revision into v_revision;
  return v_revision;
end $$;
revoke all on function public.lab_admin_read_register() from public, anon;
revoke all on function public.lab_admin_write_register(bigint,jsonb,text) from public, anon;
grant execute on function public.lab_admin_read_register() to authenticated;
grant execute on function public.lab_admin_write_register(bigint,jsonb,text) to authenticated;
