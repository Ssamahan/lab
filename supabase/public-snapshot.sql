-- Preparation only: this does not protect or revoke access to the old register.
-- Never publish unreviewed free text: even an allowlisted title can contain names.
create table if not exists public.lab_public_snapshot (
  singleton boolean primary key default true check (singleton),
  revision bigint not null check (revision > 0),
  data jsonb not null,
  reviewed_by uuid not null references auth.users(id) on delete restrict,
  reviewed_at timestamptz not null default now()
);
alter table public.lab_public_snapshot enable row level security;
revoke all on public.lab_public_snapshot from public, anon, authenticated;

-- Empty until an administrator explicitly reviews and publishes a snapshot.
create or replace function public.lab_read_public_snapshot()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('revision',s.revision,'data',s.data,'reviewed_at',s.reviewed_at)
    from public.lab_public_snapshot s where s.singleton=true;
$$;

create or replace function public.lab_publish_public_snapshot(p_expected_revision bigint,p_data jsonb,p_reviewed boolean)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  v_row jsonb;
  v_field record;
  v_revision bigint;
begin
  if public.lab_my_access_role() is distinct from 'Admin' then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_reviewed is not true or p_expected_revision is null or p_expected_revision < 0
     or jsonb_typeof(p_data) is distinct from 'object'
     or jsonb_typeof(p_data->'trainings') is distinct from 'array'
     or jsonb_typeof(p_data->'equipment') is distinct from 'array'
     or (p_data - 'trainings' - 'equipment') <> '{}'::jsonb then
    raise exception 'invalid or unreviewed snapshot' using errcode = '22023';
  end if;
  for v_row in select value from jsonb_array_elements(p_data->'trainings') loop
    if jsonb_typeof(v_row) is distinct from 'object'
       or jsonb_typeof(v_row->'title') is distinct from 'string'
       or btrim(v_row->>'title') = ''
       or (v_row - 'id' - 'title' - 'start' - 'end' - 'location') <> '{}'::jsonb then
      raise exception 'invalid training row' using errcode = '22023';
    end if;
    for v_field in select key,value from jsonb_each(v_row) loop
      if jsonb_typeof(v_field.value) is distinct from 'string' or length(v_field.value #>> '{}') > 300 then
        raise exception 'invalid training field' using errcode = '22023';
      end if;
    end loop;
  end loop;
  for v_row in select value from jsonb_array_elements(p_data->'equipment') loop
    if jsonb_typeof(v_row) is distinct from 'object'
       or jsonb_typeof(v_row->'name') is distinct from 'string'
       or btrim(v_row->>'name') = ''
       or (v_row - 'id' - 'name' - 'status') <> '{}'::jsonb then
      raise exception 'invalid equipment row' using errcode = '22023';
    end if;
    for v_field in select key,value from jsonb_each(v_row) loop
      if jsonb_typeof(v_field.value) is distinct from 'string' or length(v_field.value #>> '{}') > 300 then
        raise exception 'invalid equipment field' using errcode = '22023';
      end if;
    end loop;
  end loop;
  if p_expected_revision = 0 then
    insert into public.lab_public_snapshot(singleton,revision,data,reviewed_by)
      values(true,1,p_data,auth.uid()) on conflict (singleton) do nothing returning revision into v_revision;
  else
    update public.lab_public_snapshot s set revision=s.revision+1,data=p_data,reviewed_by=auth.uid(),reviewed_at=now()
      where s.singleton=true and s.revision=p_expected_revision returning s.revision into v_revision;
  end if;
  if v_revision is null then
    raise exception 'snapshot changed; review the current version before retrying' using errcode = '40001';
  end if;
  return v_revision;
end $$;
revoke all on function public.lab_read_public_snapshot() from public;
revoke all on function public.lab_publish_public_snapshot(bigint,jsonb,boolean) from public, anon;
grant execute on function public.lab_read_public_snapshot() to anon, authenticated;
grant execute on function public.lab_publish_public_snapshot(bigint,jsonb,boolean) to authenticated;
