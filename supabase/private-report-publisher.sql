-- Run only in the private-names project. No credentials or report contents belong here.
-- The publisher key is a separate 256-bit random value, stored only as a SHA-256
-- digest in this table. With no row, both endpoints fail closed.
create table if not exists private.report_publisher_key (
  id boolean primary key default true check (id),
  key_sha256 text not null check (key_sha256 ~ '^[0-9a-f]{64}$')
);
create table if not exists private.report_snapshot_backup (
  sha256 text primary key,
  gzip_base64 text not null,
  snapshot_created_at timestamptz not null,
  backed_up_at timestamptz not null default now()
);
revoke all on private.report_publisher_key, private.report_snapshot_backup from public, anon, authenticated;

create or replace function public.report_publisher_read(p_secret text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if p_secret is null or not exists (select 1 from private.report_publisher_key k where k.id and k.key_sha256=encode(extensions.digest(p_secret,'sha256'),'hex')) then
    raise exception 'not authorized' using errcode='42501';
  end if;
  select jsonb_build_object('sha256',s.sha256,'gzip_base64',s.gzip_base64) into result from private.report_source_snapshot s where s.id='district-workbook-2024-2026';
  if result is null then raise exception 'snapshot missing'; end if;
  return result;
end $$;

create or replace function public.report_publisher_write(p_secret text,p_expected text,p_sha256 text,p_gzip_base64 text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare current_snapshot private.report_source_snapshot%rowtype; raw bytea;
begin
  if p_secret is null or not exists (select 1 from private.report_publisher_key k where k.id and k.key_sha256=encode(extensions.digest(p_secret,'sha256'),'hex')) then
    raise exception 'not authorized' using errcode='42501';
  end if;
  if p_expected is null or p_expected !~ '^[0-9a-f]{64}$' or p_sha256 is null or p_sha256 !~ '^[0-9a-f]{64}$' or p_gzip_base64 is null or length(p_gzip_base64)>16777216 then
    raise exception 'invalid snapshot';
  end if;
  raw:=decode(p_gzip_base64,'base64');
  if length(raw)<10 or substring(raw from 1 for 3)<>decode('1f8b08','hex') or encode(extensions.digest(raw,'sha256'),'hex')<>p_sha256 then
    raise exception 'invalid snapshot';
  end if;
  select * into current_snapshot from private.report_source_snapshot where id='district-workbook-2024-2026' for update;
  if not found then raise exception 'snapshot missing'; end if;
  if current_snapshot.sha256<>p_expected then return jsonb_build_object('status','conflict'); end if;
  if current_snapshot.sha256=p_sha256 then return jsonb_build_object('status','saved'); end if;
  insert into private.report_snapshot_backup(sha256,gzip_base64,snapshot_created_at)
    values(current_snapshot.sha256,current_snapshot.gzip_base64,current_snapshot.created_at) on conflict (sha256) do nothing;
  update private.report_source_snapshot set sha256=p_sha256,gzip_base64=p_gzip_base64,created_at=now() where id='district-workbook-2024-2026';
  return jsonb_build_object('status','saved');
end $$;
revoke all on function public.report_publisher_read(text) from public, anon, authenticated;
revoke all on function public.report_publisher_write(text,text,text,text) from public, anon, authenticated;
grant execute on function public.report_publisher_read(text) to anon;
grant execute on function public.report_publisher_write(text,text,text,text) to anon;
