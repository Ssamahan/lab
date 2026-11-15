-- Install only in the separate private-names project, not the public register.
-- Source reports and patient details must never be committed to this repository.
create table private.referral_result_reports (
  sample_id text primary key check (length(trim(sample_id)) between 1 and 200),
  report jsonb not null check (jsonb_typeof(report) = 'object'),
  source_reference text not null,
  imported_at timestamptz not null default now()
);
revoke all on private.referral_result_reports from public, anon, authenticated;

create table private.referral_result_access_log (
  id bigint generated always as identity primary key,
  actor uuid not null,
  accessed_at timestamptz not null default now(),
  returned_count integer not null
);
revoke all on private.referral_result_access_log from public, anon, authenticated;

-- Only approved, non-anonymous Supabase accounts may read; the audit and read are
-- in one transaction so a failed audit cannot silently release patient records.
create function public.private_referral_results(p_after text default '')
returns table(sample_id text, report jsonb)
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if not private.can_access_patient_names() then
    raise exception 'not authorized' using errcode='42501';
  end if;
  if p_after is null or length(p_after)>200 then
    raise exception 'invalid cursor' using errcode='22023';
  end if;
  select count(*) into n from (select 1 from private.referral_result_reports r
    where r.sample_id > p_after order by r.sample_id limit 100) page;
  insert into private.referral_result_access_log(actor,returned_count) values(auth.uid(),n);
  return query select r.sample_id,r.report from private.referral_result_reports r
    where r.sample_id > p_after order by r.sample_id limit 100;
end $$;
revoke all on function public.private_referral_results(text) from public, anon;
grant execute on function public.private_referral_results(text) to authenticated;
