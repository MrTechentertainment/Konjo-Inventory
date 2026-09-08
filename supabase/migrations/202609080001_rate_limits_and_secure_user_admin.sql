-- KONJO IMS targeted rate limiting and Root Owner security audit support.
-- Run once after 202608270001_mobile_routes_pricing_roles_repair.sql.

begin;

create schema if not exists private;

create table if not exists private.rate_limit_counters (
  scope text not null,
  actor_key text not null,
  window_started_at timestamptz not null default clock_timestamp(),
  request_count integer not null default 0,
  updated_at timestamptz not null default clock_timestamp(),
  primary key (scope, actor_key),
  check (request_count >= 0)
);

revoke all on table private.rate_limit_counters from public, anon, authenticated;

create or replace function private.consume_rate_limit_internal(
  p_scope text,
  p_actor_key text,
  p_limit integer,
  p_window_seconds integer
)
returns table(allowed boolean, remaining integer, retry_after_seconds integer)
language plpgsql security definer
set search_path = ''
as $$
declare
  now_value timestamptz := clock_timestamp();
  current_count integer;
  started_at timestamptz;
begin
  if nullif(trim(p_scope), '') is null or length(p_scope) > 80 then
    raise exception 'Invalid rate-limit scope';
  end if;
  if nullif(trim(p_actor_key), '') is null or length(p_actor_key) > 160 then
    raise exception 'Invalid rate-limit actor';
  end if;
  if p_limit not between 1 and 10000 or p_window_seconds not between 1 and 604800 then
    raise exception 'Invalid rate-limit configuration';
  end if;

  insert into private.rate_limit_counters as counters(
    scope, actor_key, window_started_at, request_count, updated_at
  ) values (
    upper(trim(p_scope)), trim(p_actor_key), now_value, 1, now_value
  )
  on conflict (scope, actor_key) do update set
    window_started_at = case
      when counters.window_started_at + make_interval(secs => p_window_seconds) <= now_value then now_value
      else counters.window_started_at
    end,
    request_count = case
      when counters.window_started_at + make_interval(secs => p_window_seconds) <= now_value then 1
      else counters.request_count + 1
    end,
    updated_at = now_value
  returning request_count, window_started_at into current_count, started_at;

  return query select
    current_count <= p_limit,
    greatest(p_limit - current_count, 0),
    case when current_count <= p_limit then 0 else greatest(
      ceil(extract(epoch from (started_at + make_interval(secs => p_window_seconds) - now_value)))::integer,
      1
    ) end;
end;
$$;

-- PostgREST can expose only public-schema RPCs. This wrapper is executable by
-- service_role only and is called exclusively from the Next.js server routes.
create or replace function public.consume_server_rate_limit(
  p_scope text,
  p_actor_key text,
  p_limit integer,
  p_window_seconds integer
)
returns table(allowed boolean, remaining integer, retry_after_seconds integer)
language sql security definer
set search_path = ''
as $$
  select * from private.consume_rate_limit_internal(p_scope, p_actor_key, p_limit, p_window_seconds)
$$;

create or replace function public.clear_server_rate_limit(p_scope text, p_actor_key text)
returns void
language sql security definer
set search_path = ''
as $$
  delete from private.rate_limit_counters
  where scope = upper(trim(p_scope)) and actor_key = trim(p_actor_key)
$$;

revoke all on function public.consume_server_rate_limit(text,text,integer,integer) from public, anon, authenticated;
revoke all on function public.clear_server_rate_limit(text,text) from public, anon, authenticated;
grant execute on function public.consume_server_rate_limit(text,text,integer,integer) to service_role;
grant execute on function public.clear_server_rate_limit(text,text) to service_role;

create or replace function private.enforce_authenticated_rate_limit(
  p_scope text,
  p_limit integer,
  p_window_seconds integer
)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  result_row record;
  actor_id uuid := auth.uid();
begin
  -- Migrations and service jobs have no end-user identity and are not throttled.
  if actor_id is null then return; end if;
  select * into result_row
  from private.consume_rate_limit_internal(p_scope, actor_id::text, p_limit, p_window_seconds);
  if not result_row.allowed then
    raise exception 'Rate limit exceeded for %. Try again in % seconds.', p_scope, result_row.retry_after_seconds
      using errcode = 'P0001';
  end if;
end;
$$;

create table if not exists public.security_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.users_profiles(id) on delete restrict,
  target_user_id uuid references public.users_profiles(id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.security_audit_events enable row level security;
drop policy if exists root_reads_security_audit on public.security_audit_events;
create policy root_reads_security_audit on public.security_audit_events
  for select to authenticated using (public.is_root_owner());
revoke all on table public.security_audit_events from public, anon, authenticated;
grant select on table public.security_audit_events to authenticated;
grant insert, select on table public.security_audit_events to service_role;

create or replace function private.rate_limit_outlet_statement()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  perform private.enforce_authenticated_rate_limit('OUTLET_WRITE', 30, 60);
  return null;
end;
$$;

create or replace function private.rate_limit_sensitive_write()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'products' then
    if new.unit_price_etb is distinct from old.unit_price_etb
       or new.tax_rate is distinct from old.tax_rate
       or new.bottles_per_pack is distinct from old.bottles_per_pack then
      perform private.enforce_authenticated_rate_limit('PRICE_TAX_WRITE', 20, 3600);
    end if;
    if new.image_url is distinct from old.image_url then
      perform private.enforce_authenticated_rate_limit('PRODUCT_IMAGE_WRITE', 20, 3600);
    end if;
  elsif tg_table_name = 'users_profiles' then
    if new.role is distinct from old.role or new.is_banned is distinct from old.is_banned then
      perform private.enforce_authenticated_rate_limit('ROOT_USER_MUTATION', 20, 3600);
    end if;
  elsif tg_table_name = 'outlet_logs' then
    if new.operation_kind = 'DELIVERY' then
      if new.delivery_batch_id is null or not exists (
        select 1 from public.outlet_logs existing
        where existing.delivery_batch_id = new.delivery_batch_id
      ) then
        perform private.enforce_authenticated_rate_limit('OUTLET_DELIVERY', 10, 60);
      end if;
    elsif new.operation_kind = 'STOCK_CORRECTION' then
      perform private.enforce_authenticated_rate_limit('STOCK_CORRECTION', 10, 60);
    else
      perform private.enforce_authenticated_rate_limit('OUTLET_STOCK_ACTIVITY', 60, 60);
    end if;
  elsif tg_table_name = 'import_runs' then
    perform private.enforce_authenticated_rate_limit('DATA_IMPORT', 5, 3600);
  end if;
  return new;
end;
$$;

drop trigger if exists rate_limit_outlet_writes on public.outlets;
create trigger rate_limit_outlet_writes before insert or update on public.outlets
for each statement execute function private.rate_limit_outlet_statement();

drop trigger if exists rate_limit_product_commercial_writes on public.products;
create trigger rate_limit_product_commercial_writes before update on public.products
for each row execute function private.rate_limit_sensitive_write();

drop trigger if exists rate_limit_outlet_activity on public.outlet_logs;
create trigger rate_limit_outlet_activity before insert on public.outlet_logs
for each row execute function private.rate_limit_sensitive_write();

drop trigger if exists rate_limit_user_management on public.users_profiles;
create trigger rate_limit_user_management before update on public.users_profiles
for each row execute function private.rate_limit_sensitive_write();

do $$
begin
  if to_regclass('public.import_runs') is not null then
    execute 'drop trigger if exists rate_limit_data_imports on public.import_runs';
    execute 'create trigger rate_limit_data_imports before insert on public.import_runs for each row execute function private.rate_limit_sensitive_write()';
  end if;
end $$;

notify pgrst, 'reload schema';

commit;
