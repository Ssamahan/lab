-- ============================================================================
-- LAB SYSTEMS · RULI DISTRICT HOSPITAL — Supabase schema
-- Run this once in the Supabase SQL editor (Dashboard → SQL → New query).
-- ----------------------------------------------------------------------------
-- One row holds one laboratory register. The console is offline-first: the whole
-- register lives in the browser and this table is the shared copy that lets a
-- phone and a PC see the same work.
--
-- Security model
--   * Row level security is on, with NO anonymous policies.
--   * Every signed-in account of the laboratory project may read and write the
--     single 'ruli-dh' register. That is deliberate: the app has its own role
--     model, and Supabase is only the transport. If you later need per-user
--     isolation, replace the two policies below with a `lab_members` join table.
--   * Use the ANON key in the app. Never put the service_role key in a browser.
-- ============================================================================

create extension if not exists pgcrypto;

create table if not exists public.lab_registers (
  id          text primary key,
  data        jsonb        not null,
  revision    bigint       not null default 1,
  client_id   text,
  updated_at  timestamptz  not null default now(),
  updated_by  text
);

comment on table public.lab_registers is 'Whole-register documents for Lab Systems (one row per laboratory).';
comment on column public.lab_registers.revision is 'Incremented by the server on every write; the client uses it to detect a conflict.';

create index if not exists lab_registers_updated_at_idx on public.lab_registers (updated_at desc);

-- Keep updated_at honest even if a client forgets to send it.
create or replace function public.touch_lab_register()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists lab_registers_touch on public.lab_registers;
create trigger lab_registers_touch before insert or update on public.lab_registers
for each row execute function public.touch_lab_register();

-- ---------------------------------------------------------------- repair ------
-- Re-running this file must also heal a table created by an older version of it.
-- (An early build selected a `device_id` column that never existed; the client now
-- uses `client_id`, and these lines make any older table match the current one.)
alter table public.lab_registers add column if not exists client_id  text;
alter table public.lab_registers add column if not exists updated_by text;
alter table public.lab_registers add column if not exists revision   bigint not null default 1;

-- ---------------------------------------------------------------- RLS --------
alter table public.lab_registers enable row level security;

drop policy if exists "lab register read"  on public.lab_registers;
drop policy if exists "lab register write" on public.lab_registers;

create policy "lab register read" on public.lab_registers
  for select to authenticated using (true);

create policy "lab register write" on public.lab_registers
  for insert to authenticated with check (true);

create policy "lab register update" on public.lab_registers
  for update to authenticated using (true) with check (true);

-- If the laboratory would rather use a single shared passphrase than Supabase
-- Auth accounts, enable "Allow anonymous sign-ins" and swap `authenticated` for
-- `anon` in the three policies above — but understand that anyone with the anon
-- key then has the register. The default (authenticated) is the safer one.

"-- ---------------------------------------------------------- hardening -------
-- Anonymous sessions are ordinary `authenticated` sessions, so the policies above already
-- let them in. If a device was set up with "Allow anonymous sign-ins" turned on, close that
-- door once every device has a real project user: replace the three policies so only a
-- session that is NOT anonymous may touch the register, then switch the toggle off.
--
--   drop policy if exists "lab register read"   on public.lab_registers;
--   drop policy if exists "lab register write"  on public.lab_registers;
--   drop policy if exists "lab register update" on public.lab_registers;
--
--   create policy "lab register read" on public.lab_registers
--     for select to authenticated
--     using ((auth.jwt() ->> 'is_anonymous')::boolean is not true);
--   create policy "lab register write" on public.lab_registers
--     for insert to authenticated
--     with check ((auth.jwt() ->> 'is_anonymous')::boolean is not true);
--   create policy "lab register update" on public.lab_registers
--     for update to authenticated
--     using ((auth.jwt() ->> 'is_anonymous')::boolean is not true)
--     with check ((auth.jwt() ->> 'is_anonymous')::boolean is not true);

-- ---------------------------------------------------------------- seed -------
-- Nothing is inserted here: the first device to press "Push to cloud" creates
-- the row. To pre-seed from a device export, paste the JSON:
-- insert into public.lab_registers (id, data, client_id, updated_by)
-- values ('ruli-dh', '<paste export here>'::jsonb, 'setup', 'kelvin');

-- ============================================================================
-- The month vault — the laboratory's returns, kept online for good
-- ----------------------------------------------------------------------------
-- The register is one document and is rewritten whole on every push; a monthly
-- return is a record and must not be. Each month is therefore its own row here,
-- written once and kept, so a cleared browser, a new phone or a register started
-- again cannot take the history with it.
-- ============================================================================

create table if not exists public.lab_report_months (
  ym          text primary key,
  data        jsonb        not null,
  updated_at  timestamptz  not null default now(),
  updated_by  text
);

comment on table public.lab_report_months is 'One row per monthly HMIS return — the laboratory history kept online for good.';

create index if not exists lab_report_months_updated_at_idx on public.lab_report_months (updated_at desc);

alter table public.lab_report_months enable row level security;

create policy "report months read"  on public.lab_report_months for select to authenticated using (true);
create policy "report months write" on public.lab_report_months for insert to authenticated with check (true);
create policy "report months update" on public.lab_report_months for update to authenticated using (true) with check (true);

-- A device that has never been set up carries the publishable key and nothing else.
-- Denying it meant a new phone could never reach the live register; the laboratory's
-- own login still decides who may use the console.
create policy "report months read anon"   on public.lab_report_months for select to anon using (true);
create policy "report months write anon"  on public.lab_report_months for insert to anon with check (true);
create policy "report months update anon" on public.lab_report_months for update to anon using (true) with check (true);

grant select, insert, update on public.lab_report_months to anon, authenticated;

-- A month opened by mistake has to be removable from the record, and a delete that only
-- cleared one browser would be undone by the next Fetch. The rule is narrow on purpose:
-- a row may be deleted, the table may not be truncated, and the app deletes one month at
-- a time, by key, with an audit line left behind in the register.
create policy "report months delete"      on public.lab_report_months for delete to authenticated using (true);
create policy "report months delete anon" on public.lab_report_months for delete to anon using (true);
grant delete on public.lab_report_months to anon, authenticated;

-- The register's own, same reasoning
create policy "lab register read anon"   on public.lab_registers for select to anon using (true);
create policy "lab register write anon"  on public.lab_registers for insert to anon with check (true);
create policy "lab register update anon" on public.lab_registers for update to anon using (true) with check (true);

grant select, insert, update on public.lab_registers to anon;

-- ============================================================================
-- Every write keeps the version it replaced
-- ----------------------------------------------------------------------------
-- A wrong push, or a device that publishes over a good copy, is then recoverable
-- from the database itself and not only from the browser that wrote it.
-- ============================================================================

create table if not exists public.lab_register_history (
  id          bigserial primary key,
  register_id text        not null,
  revision    bigint,
  data        jsonb       not null,
  saved_at    timestamptz not null default now(),
  replaced_by text
);

create index if not exists lab_register_history_reg_idx on public.lab_register_history (register_id, saved_at desc);

alter table public.lab_register_history enable row level security;
create policy "history read"  on public.lab_register_history for select to anon, authenticated using (true);
create policy "history write" on public.lab_register_history for insert to anon, authenticated with check (true);
grant select, insert on public.lab_register_history to anon, authenticated;

create or replace function public.keep_lab_register_version()
returns trigger language plpgsql security definer as $$
begin
  insert into public.lab_register_history (register_id, revision, data, replaced_by)
  values (old.id, old.revision, old.data, new.client_id);
  delete from public.lab_register_history h
   where h.register_id = old.id
     and h.id not in (select id from public.lab_register_history
                       where register_id = old.id order by saved_at desc limit 50);
  return new;
end $$;

drop trigger if exists lab_register_version_trigger on public.lab_registers;
create trigger lab_register_version_trigger
  before update on public.lab_registers
  for each row execute function public.keep_lab_register_version();
