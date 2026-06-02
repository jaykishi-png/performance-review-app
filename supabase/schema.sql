-- ============================================================
-- Performance Review App — Database Schema
-- Run this in the Supabase SQL Editor (supabase.com → SQL Editor)
-- ============================================================

-- 1. Profiles table (extends auth.users)
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  name text,
  email text unique not null,
  role text not null default 'pending' check (role in ('admin', 'manager', 'employee', 'pending')),
  manager_id uuid references public.profiles(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Invites table
create table if not exists public.invites (
  id uuid default gen_random_uuid() primary key,
  email text not null,
  role text not null default 'employee' check (role in ('admin', 'manager', 'employee')),
  invited_by uuid references public.profiles(id) on delete set null,
  token text unique not null,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint invites_email_unique unique (email)
);

-- 3. Audit logs table
create table if not exists public.audit_logs (
  id uuid default gen_random_uuid() primary key,
  actor_user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.profiles enable row level security;
alter table public.invites enable row level security;
alter table public.audit_logs enable row level security;

-- Profiles: users can always read their own row
create policy "profiles_read_own" on public.profiles
  for select using (auth.uid() = id);

-- Profiles: admins can read all profiles
create policy "profiles_read_all_admin" on public.profiles
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Profiles: managers can read their direct reports
create policy "profiles_read_team_manager" on public.profiles
  for select using (manager_id = auth.uid());

-- Profiles: users can update their own name
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id);

-- Profiles: admins can update any profile
create policy "profiles_update_admin" on public.profiles
  for update using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Invites: admins can read all invites
create policy "invites_read_admin" on public.invites
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Invites: anyone can read their own invite (by email match)
create policy "invites_read_own_email" on public.invites
  for select using (
    email = (select email from public.profiles where id = auth.uid())
  );

-- Audit logs: only admins can read
create policy "audit_logs_read_admin" on public.audit_logs
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ============================================================
-- Auto-create profile on new user signup
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  user_role text := 'pending';
  user_count int;
begin
  -- First user ever becomes admin automatically
  select count(*) into user_count from public.profiles;
  if user_count = 0 then
    user_role := 'admin';
  end if;

  insert into public.profiles (id, email, name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    user_role
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Drop trigger if exists and recreate
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Helper: update updated_at on profile changes
-- ============================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();
