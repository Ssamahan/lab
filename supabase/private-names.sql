-- Separate Supabase project only. Does not alter the existing shared register.
-- Run as a privileged migration owner. Authorize individual accounts separately by
-- inserting their actual auth.users UUIDs into private.patient_name_members.
-- This file contains no credentials or patient data.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create table private.patient_name_members (
  user_id uuid primary key references auth.users(id) on delete cascade
);
revoke all on private.patient_name_members from public, anon, authenticated;

-- SECURITY DEFINER reads only the allowlist; callers cannot enumerate its contents.
create function private.can_access_patient_names() returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false
    and exists (select 1 from private.patient_name_members m where m.user_id = auth.uid());
$$;
revoke all on function private.can_access_patient_names() from public, anon;
grant execute on function private.can_access_patient_names() to authenticated;

-- Append-only entries preserve previous values. The client must handle differing
-- values as conflicts and must never assume latest timestamp means correct identity.
create table public.patient_name_entries (
  entry_id uuid primary key,
  sample_id text not null check (length(sample_id) between 1 and 200),
  patient_name text not null check (length(trim(patient_name)) between 1 and 300),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);
comment on table public.patient_name_entries is 'Restricted patient name history; entries are append-only for clients.';
alter table public.patient_name_entries enable row level security;
revoke all on public.patient_name_entries from public, anon, authenticated;
grant select, insert on public.patient_name_entries to authenticated;
create policy "approved users read names" on public.patient_name_entries
  for select to authenticated using (private.can_access_patient_names());
create policy "approved users append names" on public.patient_name_entries
  for insert to authenticated with check (
    private.can_access_patient_names() and created_by = auth.uid()
  );
