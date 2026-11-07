-- Run only on the private-names project, after private-names.sql.
-- Atomic, idempotent compare-and-append: never overwrite a name another device changed.
alter table public.patient_name_entries add column parent_id uuid references public.patient_name_entries(entry_id);
revoke insert on public.patient_name_entries from authenticated;
drop policy "approved users append names" on public.patient_name_entries;

create table private.patient_name_heads (
  sample_id text primary key,
  entry_id uuid not null references public.patient_name_entries(entry_id)
);
revoke all on private.patient_name_heads from public, anon, authenticated;

create function public.private_name_heads()
returns table(sample_id text, entry_id uuid, patient_name text)
language plpgsql security definer set search_path = '' as $$
begin
  if not private.can_access_patient_names() then raise exception 'not authorized' using errcode='42501'; end if;
  return query select h.sample_id, e.entry_id, e.patient_name
    from private.patient_name_heads h join public.patient_name_entries e on e.entry_id=h.entry_id
    order by h.sample_id;
end $$;
revoke all on function public.private_name_heads() from public, anon;
grant execute on function public.private_name_heads() to authenticated;

create function public.private_name_append(p_entry uuid, p_sample text, p_name text, p_parent uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare old_entry public.patient_name_entries%rowtype; head uuid;
begin
  if not private.can_access_patient_names() then raise exception 'not authorized' using errcode='42501'; end if;
  if p_entry is null or p_sample is null or length(p_sample) not between 1 and 200
    or p_name is null or length(trim(p_name)) not between 1 and 300
  then raise exception 'invalid entry' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_sample, 29181));
  select * into old_entry from public.patient_name_entries e where e.entry_id=p_entry;
  if found then
    if old_entry.sample_id = p_sample and old_entry.patient_name = p_name
       and old_entry.parent_id is not distinct from p_parent then
      return jsonb_build_object('status','already_saved','entry_id',p_entry);
    end if;
    raise exception 'entry id reused with different contents' using errcode='22023';
  end if;
  select h.entry_id into head from private.patient_name_heads h where h.sample_id=p_sample;
  if head is distinct from p_parent then return jsonb_build_object('status','conflict'); end if;
  insert into public.patient_name_entries(entry_id,sample_id,patient_name,parent_id,created_by,created_at)
    values(p_entry,p_sample,p_name,p_parent,auth.uid(),clock_timestamp());
  insert into private.patient_name_heads(sample_id,entry_id) values(p_sample,p_entry)
    on conflict(sample_id) do update set entry_id=excluded.entry_id;
  return jsonb_build_object('status','saved','entry_id',p_entry);
end $$;
revoke all on function public.private_name_append(uuid,text,text,uuid) from public, anon;
grant execute on function public.private_name_append(uuid,text,text,uuid) to authenticated;
