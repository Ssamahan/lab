-- Preparation only. This table alone does not restrict the existing public register
-- policies. Do not grant staff access or change register policies until the new login,
-- scoped data endpoints and safe cutover are complete and independently tested.
create table if not exists public.lab_access_members (
  user_id uuid primary key references auth.users(id) on delete restrict,
  role text not null check (role in ('Admin','Manager','Technologist','Reviewer','Viewer')),
  active boolean not null default false,
  invited_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
alter table public.lab_access_members enable row level security;
revoke all on table public.lab_access_members from public, anon, authenticated;
grant select, insert, update on table public.lab_access_members to service_role;

-- Staff can inspect only their own enabled role. The JWT's anonymous marker is
-- checked because anonymous Supabase sessions can also use authenticated.
create or replace function public.lab_my_access_role() returns text
language sql stable security definer set search_path = '' as $$
  select m.role from public.lab_access_members m
  where m.user_id=auth.uid() and m.active is true
    and coalesce((auth.jwt()->>'is_anonymous')::boolean,true) is false;
$$;
revoke all on function public.lab_my_access_role() from public, anon;
grant execute on function public.lab_my_access_role() to authenticated;
