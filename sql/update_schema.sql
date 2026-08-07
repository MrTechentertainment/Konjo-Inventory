-- =============================================================================
-- KONJO IMS secure authentication, RBAC and outlet operations migration
-- Run once in Supabase Dashboard -> SQL Editor after sql/schema.sql.
-- Safe to re-run. Authentication uses Supabase Auth; password_hash exists only
-- to satisfy the requested profile schema and is never exposed to the client.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

do $$ begin
  create type public.user_role as enum ('SUPER_ADMIN', 'ADMIN', 'BASIC');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.outlet_type as enum ('SUPERMARKET', 'BAZAAR', 'EVENT', 'GIFT', 'SAMPLE');
exception when duplicate_object then null; end $$;

create table if not exists public.users_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  password_hash text,
  role public.user_role not null default 'BASIC',
  created_at timestamptz not null default now(),
  constraint users_profiles_username_format check (username ~ '^[A-Za-z][A-Za-z0-9._-]{2,31}$'),
  constraint users_profiles_single_root check (
    (lower(username) = 'natanim' and role = 'SUPER_ADMIN') or
    (lower(username) <> 'natanim' and role <> 'SUPER_ADMIN')
  )
);

create unique index if not exists users_profiles_username_lower_uidx on public.users_profiles (lower(username));

create table if not exists public.outlets (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  type public.outlet_type not null,
  created_at timestamptz not null default now()
);

create table if not exists public.outlet_inventory (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references public.outlets(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  stock_bottles integer not null default 0 check (stock_bottles >= 0),
  updated_at timestamptz not null default now(),
  unique (outlet_id, product_id)
);

create table if not exists public.outlet_logs (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references public.outlets(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  change_bottles integer not null check (change_bottles <> 0),
  logged_by uuid not null references public.users_profiles(id) on delete restrict,
  "timestamp" timestamptz not null default now()
);

create index if not exists outlet_inventory_outlet_idx on public.outlet_inventory(outlet_id);
create index if not exists outlet_logs_outlet_time_idx on public.outlet_logs(outlet_id, "timestamp" desc);
create index if not exists outlet_logs_time_idx on public.outlet_logs("timestamp" desc);

-- -----------------------------------------------------------------------------
-- Root Owner profile attachment
--
-- Create the Auth identity through Supabase Dashboard or the Auth Admin API.
-- This migration never creates or resets Auth passwords.
-- -----------------------------------------------------------------------------
do $$
declare
  root_id uuid;
begin
  select id
    into root_id
  from auth.users
  where lower(email) = 'natanim@konjo.com'
  limit 1;

  if root_id is null then
    raise exception
      'Create and confirm natanim@konjo.com in Supabase Auth before running this migration';
  end if;

  insert into public.users_profiles (
    id,
    username,
    password_hash,
    role
  )
  values (
    root_id,
    'Natanim',
    null,
    'SUPER_ADMIN'
  )
  on conflict (id) do nothing;
end $$;

insert into public.outlets(name, type) values
  ('Garrett Supermarket', 'SUPERMARKET'),
  ('Safeway Supermarket', 'SUPERMARKET'),
  ('KONJO Weekend Bazaar', 'BAZAAR'),
  ('Meskel Square Activation', 'EVENT'),
  ('Promotional Gifts', 'GIFT'),
  ('Field Samples', 'SAMPLE')
on conflict (name) do nothing;

-- -----------------------------------------------------------------------------
-- Profile creation and immutable-root guards
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  requested_username text;
begin
  requested_username := trim(coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)));
  if lower(requested_username) = 'natanim' then
    raise exception 'The Natanim username is reserved';
  end if;
  insert into public.users_profiles(id, username, role)
  values (new.id, requested_username, 'BASIC');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_auth_user();

create or replace function public.protect_root_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(old.username) = 'natanim' then
    raise exception 'Natanim is the immutable Root Owner and cannot be changed or deleted';
  end if;
  if tg_op = 'UPDATE' and (lower(new.username) = 'natanim' or new.role = 'SUPER_ADMIN') then
    raise exception 'Only the immutable Natanim profile may be SUPER_ADMIN';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists protect_root_profile_trigger on public.users_profiles;
create trigger protect_root_profile_trigger before update or delete on public.users_profiles
for each row execute function public.protect_root_profile();

-- -----------------------------------------------------------------------------
-- Safe role helpers and client RPCs. Password hashes are never returned.
-- -----------------------------------------------------------------------------
create or replace function public.current_user_role()
returns public.user_role
language sql stable security definer
set search_path = public
as $$ select role from public.users_profiles where id = auth.uid() $$;

create or replace function public.current_username()
returns text
language sql stable security definer
set search_path = public
as $$ select username from public.users_profiles where id = auth.uid() $$;

create or replace function public.is_root_owner()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists(select 1 from public.users_profiles where id = auth.uid() and lower(username) = 'natanim' and role = 'SUPER_ADMIN')
$$;

create or replace function public.get_my_profile()
returns table(id uuid, username text, role public.user_role, created_at timestamptz)
language sql stable security definer
set search_path = public
as $$
  select p.id, p.username, p.role, p.created_at from public.users_profiles p where p.id = auth.uid()
$$;

create or replace function public.list_user_profiles()
returns table(id uuid, username text, role public.user_role, created_at timestamptz)
language plpgsql stable security definer
set search_path = public
as $$
begin
  if not public.is_root_owner() then raise exception 'Root Owner access required'; end if;
  return query select p.id, p.username, p.role, p.created_at from public.users_profiles p order by lower(p.username);
end;
$$;

create or replace function public.set_user_role(target_user_id uuid, new_role public.user_role)
returns void
language plpgsql security definer
set search_path = public
as $$
declare target_username text;
begin
  if not public.is_root_owner() then raise exception 'Root Owner access required'; end if;
  if new_role not in ('ADMIN', 'BASIC') then raise exception 'Users may only be promoted to ADMIN or demoted to BASIC'; end if;
  select username into target_username from public.users_profiles where id = target_user_id;
  if target_username is null then raise exception 'User not found'; end if;
  if lower(target_username) = 'natanim' then raise exception 'Natanim can never be demoted'; end if;
  update public.users_profiles set role = new_role where id = target_user_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Atomic outlet ledger. One pack is converted in the app through the universal
-- constant; this database accepts only integer bottle deltas and prevents stock
-- going below zero under concurrent phone taps.
-- -----------------------------------------------------------------------------
create or replace function public.apply_outlet_log()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  update public.outlet_inventory
     set stock_bottles = stock_bottles + new.change_bottles, updated_at = now()
   where outlet_id = new.outlet_id and product_id = new.product_id;
  if not found then raise exception 'Outlet inventory row missing'; end if;
  return new;
end;
$$;

drop trigger if exists apply_outlet_log_trigger on public.outlet_logs;
create trigger apply_outlet_log_trigger after insert on public.outlet_logs
for each row execute function public.apply_outlet_log();

create or replace function public.log_outlet_change(target_outlet_id uuid, target_product_id uuid, bottle_change integer)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare current_stock integer; new_log_id uuid;
begin
  if auth.uid() is null or public.current_user_role() is null then raise exception 'Authentication required'; end if;
  if bottle_change = 0 then raise exception 'Bottle change cannot be zero'; end if;
  if not exists(select 1 from public.outlets where id = target_outlet_id) then raise exception 'Outlet not found'; end if;
  if not exists(select 1 from public.products where id = target_product_id and is_active) then raise exception 'Product not found or inactive'; end if;

  insert into public.outlet_inventory(outlet_id, product_id, stock_bottles)
  values(target_outlet_id, target_product_id, 0)
  on conflict (outlet_id, product_id) do nothing;

  select stock_bottles into current_stock from public.outlet_inventory
   where outlet_id = target_outlet_id and product_id = target_product_id for update;
  if current_stock + bottle_change < 0 then raise exception 'Insufficient outlet stock'; end if;

  insert into public.outlet_logs(outlet_id, product_id, change_bottles, logged_by)
  values(target_outlet_id, target_product_id, bottle_change, auth.uid()) returning id into new_log_id;
  return new_log_id;
end;
$$;

create or replace function public.get_outlet_operations_feed(row_limit integer default 200)
returns table(
  id uuid, outlet_id uuid, outlet_name text, outlet_type public.outlet_type,
  product_id uuid, product_name text, product_sku text, change_bottles integer,
  username text, "timestamp" timestamptz
)
language plpgsql stable security definer
set search_path = public
as $$
begin
  if public.current_user_role() not in ('SUPER_ADMIN', 'ADMIN') then raise exception 'Admin access required'; end if;
  return query
  select l.id, l.outlet_id, o.name, o.type, l.product_id, p.name, p.sku,
         l.change_bottles, u.username, l."timestamp"
    from public.outlet_logs l
    join public.outlets o on o.id = l.outlet_id
    join public.products p on p.id = l.product_id
    join public.users_profiles u on u.id = l.logged_by
   order by l."timestamp" desc limit least(greatest(row_limit, 1), 1000);
end;
$$;

-- -----------------------------------------------------------------------------
-- RLS and grants: unauthenticated users get no operational data. BASIC can
-- read the catalog/outlet stock and log outlet changes only through the RPC.
-- ADMIN/SUPER_ADMIN can manage factory inventory and inspect outlet logs.
-- -----------------------------------------------------------------------------
alter table public.users_profiles enable row level security;
alter table public.outlets enable row level security;
alter table public.outlet_inventory enable row level security;
alter table public.outlet_logs enable row level security;

drop policy if exists "products are readable by anyone with the app" on public.products;
drop policy if exists "staff can add new catalog products" on public.products;
drop policy if exists "ledger is readable by anyone with the app" on public.inventory_transactions;
drop policy if exists "staff can log new stock movements" on public.inventory_transactions;

drop policy if exists products_authenticated_read on public.products;
create policy products_authenticated_read on public.products for select to authenticated using (true);
drop policy if exists products_admin_insert on public.products;
create policy products_admin_insert on public.products for insert to authenticated
with check (public.current_user_role() in ('SUPER_ADMIN', 'ADMIN'));

drop policy if exists factory_ledger_admin_read on public.inventory_transactions;
create policy factory_ledger_admin_read on public.inventory_transactions for select to authenticated
using (public.current_user_role() in ('SUPER_ADMIN', 'ADMIN'));
drop policy if exists factory_ledger_admin_insert on public.inventory_transactions;
create policy factory_ledger_admin_insert on public.inventory_transactions for insert to authenticated
with check (public.current_user_role() in ('SUPER_ADMIN', 'ADMIN') and logged_by = public.current_username());

drop policy if exists outlets_authenticated_read on public.outlets;
create policy outlets_authenticated_read on public.outlets for select to authenticated using (true);
drop policy if exists outlet_inventory_authenticated_read on public.outlet_inventory;
create policy outlet_inventory_authenticated_read on public.outlet_inventory for select to authenticated using (true);
drop policy if exists outlet_logs_admin_read on public.outlet_logs;
create policy outlet_logs_admin_read on public.outlet_logs for select to authenticated
using (public.current_user_role() in ('SUPER_ADMIN', 'ADMIN'));

revoke all on public.users_profiles from anon, authenticated;
revoke all on public.outlets, public.outlet_inventory, public.outlet_logs from anon;
revoke all on public.products, public.inventory_transactions from anon;
grant select on public.products, public.outlets, public.outlet_inventory to authenticated;
grant insert on public.products, public.inventory_transactions to authenticated;
grant select on public.inventory_transactions, public.outlet_logs to authenticated;
revoke insert, update, delete on public.outlet_logs, public.outlet_inventory from authenticated;
revoke update, delete on public.products, public.inventory_transactions from authenticated;

revoke all on function public.get_my_profile() from public;
revoke all on function public.list_user_profiles() from public;
revoke all on function public.set_user_role(uuid, public.user_role) from public;
revoke all on function public.log_outlet_change(uuid, uuid, integer) from public;
revoke all on function public.get_outlet_operations_feed(integer) from public;
grant execute on function public.get_my_profile() to authenticated;
grant execute on function public.list_user_profiles() to authenticated;
grant execute on function public.set_user_role(uuid, public.user_role) to authenticated;
grant execute on function public.log_outlet_change(uuid, uuid, integer) to authenticated;
grant execute on function public.get_outlet_operations_feed(integer) to authenticated;

do $$ begin
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'outlet_inventory'
  ) then alter publication supabase_realtime add table public.outlet_inventory; end if;
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'outlet_logs'
  ) then alter publication supabase_realtime add table public.outlet_logs; end if;
end $$;
