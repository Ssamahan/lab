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

-- ---------------------------------------------------------------- seed -------
-- Nothing is inserted here: the first device to press "Push to cloud" creates
-- the row. To pre-seed from a device export, paste the JSON:
-- insert into public.lab_registers (id, data, client_id, updated_by)
-- values ('ruli-dh', '<paste export here>'::jsonb, 'setup', 'kelvin');
