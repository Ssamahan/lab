-- Preparation only: this isolated draft store does not change the shared
-- register, grant access to it, or enable application role enforcement.
-- Install only after testing against the target project's staff foundation.
create table if not exists public.lab_roster_drafts (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('working_plan', 'weekly_roster')),
  period text not null,
  payload jsonb not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
alter table public.lab_roster_drafts enable row level security;
revoke all on public.lab_roster_drafts from public, anon, authenticated;
revoke all on sequence public.lab_roster_drafts_id_seq from public, anon, authenticated;

-- These are untrusted, append-only drafts, never the official plan in force.
-- The UI must not treat one as an approved or published document.
create or replace function public.lab_submit_roster_draft(p_kind text, p_period text, p_payload jsonb)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  v_role text;
  v_day date;
  v_id bigint;
begin
  v_role := public.lab_my_access_role();
  if v_role is null or v_role not in ('Admin','Reviewer') then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_kind is null or p_kind not in ('working_plan','weekly_roster')
     or p_period is null or p_payload is null
     or jsonb_typeof(p_payload) <> 'object'
     or octet_length(p_payload::text) > 262144 then
    raise exception 'invalid draft' using errcode = '22023';
  end if;
  if p_kind = 'working_plan' then
    if p_period !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' or left(p_period,4) = '0000' then
      raise exception 'invalid period' using errcode = '22023';
    end if;
  else
    if p_period !~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$' then
      raise exception 'invalid period' using errcode = '22023';
    end if;
    begin
      v_day := p_period::date;
    exception when datetime_field_overflow or invalid_datetime_format then
      raise exception 'invalid period' using errcode = '22023';
    end;
    if extract(isodow from v_day) <> 1 then
      raise exception 'week must begin on Monday' using errcode = '22023';
    end if;
  end if;
  insert into public.lab_roster_drafts(kind,period,payload,created_by)
    values(p_kind,p_period,p_payload,auth.uid()) returning id into v_id;
  return v_id;
end $$;

-- All active staff can review drafts; unauthenticated and anonymous sessions
-- cannot access either the function or its underlying table.
create or replace function public.lab_list_roster_drafts()
returns table(id bigint,kind text,period text,payload jsonb,created_by uuid,created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if public.lab_my_access_role() is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return query select d.id,d.kind,d.period,d.payload,d.created_by,d.created_at
    from public.lab_roster_drafts d order by d.id desc limit 100;
end $$;
revoke all on function public.lab_submit_roster_draft(text,text,jsonb) from public, anon;
revoke all on function public.lab_list_roster_drafts() from public, anon;
grant execute on function public.lab_submit_roster_draft(text,text,jsonb) to authenticated;
grant execute on function public.lab_list_roster_drafts() to authenticated;
