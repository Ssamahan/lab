-- Separate private-names project only. Immutable source, never the shared register.
-- This file contains no workbook figures or credentials.
create table if not exists private.report_source_snapshot (
  id text primary key check (id = 'district-workbook-2024-2026'),
  gzip_base64 text not null,
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now()
);
revoke all on private.report_source_snapshot from public, anon, authenticated;
create or replace function public.private_report_workbook() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not private.can_access_patient_names() then
    raise exception 'not authorized' using errcode='42501';
  end if;
  select jsonb_build_object('gzip_base64',s.gzip_base64,'sha256',s.sha256) into result
    from private.report_source_snapshot s where s.id='district-workbook-2024-2026';
  return result;
end $$;
revoke all on function public.private_report_workbook() from public, anon;
grant execute on function public.private_report_workbook() to authenticated;
