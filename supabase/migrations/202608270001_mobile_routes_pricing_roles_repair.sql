-- KONJO IMS user-access repair and PostgREST schema-cache refresh.
-- Run after 202608180001_outlet_admin_stock_pricing.sql and
-- 202608180002_outlet_directory_product_images.sql.

begin;

alter table public.users_profiles
  add column if not exists is_banned boolean not null default false,
  add column if not exists banned_at timestamptz,
  add column if not exists banned_by uuid references public.users_profiles(id) on delete set null;

create or replace function public.current_user_role()
returns public.user_role
language sql stable security definer
set search_path = ''
as $$
  select p.role
  from public.users_profiles p
  where p.id = auth.uid() and not p.is_banned
$$;

drop function if exists public.get_my_profile();
create function public.get_my_profile()
returns table(
  id uuid,
  username text,
  role public.user_role,
  created_at timestamptz,
  is_banned boolean,
  banned_at timestamptz
)
language sql stable security definer
set search_path = ''
as $$
  select p.id, p.username, p.role, p.created_at, p.is_banned, p.banned_at
  from public.users_profiles p
  where p.id = auth.uid()
$$;

drop function if exists public.list_user_profiles();
create function public.list_user_profiles()
returns table(
  id uuid,
  username text,
  role public.user_role,
  created_at timestamptz,
  is_banned boolean,
  banned_at timestamptz
)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not public.is_root_owner() then raise exception 'Root Owner access required'; end if;
  return query
  select p.id, p.username, p.role, p.created_at, p.is_banned, p.banned_at
  from public.users_profiles p
  order by lower(p.username);
end;
$$;

create or replace function public.root_manage_user(target_user_id uuid, action_name text)
returns table(
  id uuid,
  username text,
  role public.user_role,
  created_at timestamptz,
  is_banned boolean,
  banned_at timestamptz
)
language plpgsql security definer
set search_path = ''
as $$
declare
  target_profile public.users_profiles%rowtype;
  requested_action text := upper(trim(coalesce(action_name, '')));
begin
  if not public.is_root_owner() then raise exception 'Root Owner access required'; end if;

  select p.* into target_profile
  from public.users_profiles p
  where p.id = target_user_id
  for update;

  if not found then raise exception 'User not found'; end if;
  if target_profile.id = '4b36aa09-11b2-4b2e-9322-69e4f1a80001'::uuid
     or lower(target_profile.username) = 'natanim'
     or target_profile.role = 'SUPER_ADMIN' then
    raise exception 'The Root Owner cannot be changed or banned';
  end if;

  case requested_action
    when 'PROMOTE' then
      if target_profile.is_banned then raise exception 'Restore the account before changing its rank'; end if;
      update public.users_profiles as p set role = 'ADMIN' where p.id = target_user_id;
    when 'DEMOTE' then
      if target_profile.is_banned then raise exception 'Restore the account before changing its rank'; end if;
      update public.users_profiles as p set role = 'BASIC' where p.id = target_user_id;
    when 'BAN' then
      update public.users_profiles as p
      set is_banned = true, banned_at = now(), banned_by = auth.uid()
      where p.id = target_user_id;
      update auth.users set banned_until = 'infinity'::timestamptz where auth.users.id = target_user_id;
    when 'UNBAN' then
      update public.users_profiles as p
      set is_banned = false, banned_at = null, banned_by = null
      where p.id = target_user_id;
      update auth.users set banned_until = null where auth.users.id = target_user_id;
    else
      raise exception 'Action must be PROMOTE, DEMOTE, BAN, or UNBAN';
  end case;

  return query
  select p.id, p.username, p.role, p.created_at, p.is_banned, p.banned_at
  from public.users_profiles p
  where p.id = target_user_id;
end;
$$;

-- Preserve compatibility for older clients while routing role changes through
-- the same protected implementation used by the standalone users page.
create or replace function public.set_user_role(target_user_id uuid, new_role public.user_role)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if new_role = 'ADMIN' then
    perform public.root_manage_user(target_user_id, 'PROMOTE');
  elsif new_role = 'BASIC' then
    perform public.root_manage_user(target_user_id, 'DEMOTE');
  else
    raise exception 'Users may only be promoted to ADMIN or demoted to BASIC';
  end if;
end;
$$;

-- Existing permissive read policies must not let a newly banned account keep
-- reading data while its current access token is still valid.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'products', 'inventory_transactions', 'outlets', 'outlet_inventory',
    'outlet_logs', 'credit_sales', 'sales_orders', 'product_samples',
    'inventory_ledger_entries'
  ] loop
    if to_regclass('public.' || table_name) is not null then
      execute format('drop policy if exists banned_users_have_no_access on public.%I', table_name);
      execute format(
        'create policy banned_users_have_no_access on public.%I as restrictive for all to authenticated using (public.current_user_role() is not null) with check (public.current_user_role() is not null)',
        table_name
      );
    end if;
  end loop;
end $$;

revoke all on function public.get_my_profile() from public, anon;
revoke all on function public.list_user_profiles() from public, anon;
revoke all on function public.root_manage_user(uuid,text) from public, anon;
revoke all on function public.set_user_role(uuid,public.user_role) from public, anon;

grant execute on function public.get_my_profile() to authenticated;
grant execute on function public.list_user_profiles() to authenticated;
grant execute on function public.root_manage_user(uuid,text) to authenticated;
grant execute on function public.set_user_role(uuid,public.user_role) to authenticated;

notify pgrst, 'reload schema';

commit;
