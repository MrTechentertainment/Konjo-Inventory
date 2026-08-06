-- =============================================================================
-- KONJO IMS accounting, pricing, outlet CRUD and reporting upgrade
-- Run AFTER sql/schema.sql and sql/update_schema.sql.
-- PostgreSQL/Supabase migration; safe to re-run.
-- Currency values are NUMERIC (never floating point) and every commercial
-- transaction snapshots the price/tax that was effective when it occurred.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

do $$ begin
  create type public.quantity_unit as enum ('BOTTLE', 'PACK');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.pipeline_status as enum ('DELIVERED', 'PENDING_ORDER', 'WAITING_CONFIRMATION', 'PAID', 'CONSIGNMENT');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.financial_transaction_kind as enum ('DELIVERY', 'SALE');
exception when duplicate_object then null; end $$;

alter table public.users_profiles
  add column if not exists display_name text,
  add column if not exists avatar_url text,
  add column if not exists must_reset_password boolean not null default false,
  add column if not exists analytics_access boolean not null default false;
alter table public.users_profiles disable trigger protect_root_profile_trigger;
update public.users_profiles set display_name = username where display_name is null;
update public.users_profiles set analytics_access = true where role = 'SUPER_ADMIN';
alter table public.users_profiles enable trigger protect_root_profile_trigger;
alter table public.users_profiles alter column display_name set not null;

create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public, auth as $$
declare requested_username text;
begin
  requested_username := trim(coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)));
  if lower(requested_username) = 'natanim' then raise exception 'The Natanim username is reserved'; end if;
  insert into public.users_profiles(id, username, display_name, role)
  values(new.id, requested_username, requested_username, 'BASIC');
  return new;
end; $$;

alter table public.products
  add column if not exists description text,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists updated_by uuid references public.users_profiles(id) on delete restrict;

-- Exception outlets intentionally allow the same normalized name. The RPC uses
-- an advisory transaction lock to make duplicate checks race-safe.
alter table public.outlets drop constraint if exists outlets_name_key;
alter table public.outlets
  add column if not exists normalized_name text,
  add column if not exists created_by uuid references public.users_profiles(id) on delete restrict,
  add column if not exists exception_flag boolean not null default false,
  add column if not exists exception_note text,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists deleted_at timestamptz;
update public.outlets
   set normalized_name = regexp_replace(lower(trim(name)), '\s+', ' ', 'g')
 where normalized_name is null;
update public.outlets
   set created_by = (select id from public.users_profiles where lower(username) = 'natanim' limit 1)
 where created_by is null;
alter table public.outlets alter column normalized_name set not null;
create index if not exists outlets_active_type_name_idx on public.outlets(type, normalized_name) where deleted_at is null;
create index if not exists outlets_created_by_idx on public.outlets(created_by);

create table if not exists public.product_prices (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  pack_size integer not null default 15 check (pack_size = 15),
  tax_rate numeric(7,6) not null check (tax_rate between 0 and 1),
  bottle_price_before_tax numeric(16,4) not null check (bottle_price_before_tax >= 0),
  bottle_price_after_tax numeric(16,4) not null check (bottle_price_after_tax >= bottle_price_before_tax),
  pack_price_before_tax numeric(16,4) not null check (pack_price_before_tax >= 0),
  pack_price_after_tax numeric(16,4) not null check (pack_price_after_tax >= pack_price_before_tax),
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  version integer not null check (version > 0),
  created_by uuid not null references public.users_profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (effective_to is null or effective_to > effective_from),
  unique(product_id, version)
);
create unique index if not exists product_prices_one_current_idx on public.product_prices(product_id) where effective_to is null;
create index if not exists product_prices_effective_idx on public.product_prices(product_id, effective_from desc);

create table if not exists public.delivery_batches (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references public.outlets(id) on delete restrict,
  status public.pipeline_status not null default 'DELIVERED',
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  recorded_by uuid not null references public.users_profiles(id) on delete restrict,
  device_timezone text,
  notes text,
  check (occurred_at <= now() + interval '1 day')
);
create index if not exists delivery_batches_outlet_time_idx on public.delivery_batches(outlet_id, occurred_at desc);

create table if not exists public.financial_ledger (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null,
  transaction_kind public.financial_transaction_kind not null,
  outlet_id uuid not null references public.outlets(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  product_name_snapshot text not null,
  product_sku_snapshot text not null,
  quantity numeric(14,3) not null check (quantity > 0),
  quantity_unit public.quantity_unit not null,
  quantity_bottles integer not null check (quantity_bottles > 0),
  pack_size_snapshot integer not null check (pack_size_snapshot = 15),
  price_version integer not null,
  unit_price_before_tax numeric(16,4) not null,
  unit_price_after_tax numeric(16,4) not null,
  taxable_amount numeric(18,4) not null,
  tax_amount numeric(18,4) not null,
  total_amount numeric(18,4) not null,
  tax_rate_snapshot numeric(7,6) not null,
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  recorded_by uuid not null references public.users_profiles(id) on delete restrict,
  check (abs((taxable_amount + tax_amount) - total_amount) <= 0.02),
  unique(transaction_kind, transaction_id, product_id, quantity_unit)
);
create index if not exists financial_ledger_month_idx on public.financial_ledger(occurred_at desc);
create index if not exists financial_ledger_outlet_idx on public.financial_ledger(outlet_id, occurred_at desc);

create table if not exists public.delivery_status_events (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.delivery_batches(id) on delete restrict,
  from_status public.pipeline_status,
  to_status public.pipeline_status not null,
  changed_by uuid not null references public.users_profiles(id) on delete restrict,
  changed_at timestamptz not null default now(),
  note text
);

create table if not exists public.stock_orders (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references public.outlets(id) on delete restrict,
  status public.pipeline_status not null default 'PENDING_ORDER',
  requested_by uuid not null references public.users_profiles(id) on delete restrict,
  requested_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  notes text
);
create table if not exists public.stock_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.stock_orders(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity numeric(14,3) not null check (quantity > 0),
  quantity_unit public.quantity_unit not null,
  quantity_bottles integer not null check (quantity_bottles > 0),
  unique(order_id, product_id, quantity_unit)
);
create index if not exists stock_orders_outlet_status_idx on public.stock_orders(outlet_id, status, requested_at desc);

-- Audit-grade tables are append-only. Status changes are separately logged.
create or replace function public.reject_ledger_mutation()
returns trigger language plpgsql security definer set search_path = public as $$
begin raise exception 'Accounting ledger rows are immutable'; end; $$;
drop trigger if exists financial_ledger_immutable on public.financial_ledger;
create trigger financial_ledger_immutable before update or delete on public.financial_ledger
for each row execute function public.reject_ledger_mutation();
drop trigger if exists delivery_status_events_immutable on public.delivery_status_events;
create trigger delivery_status_events_immutable before update or delete on public.delivery_status_events
for each row execute function public.reject_ledger_mutation();

create or replace function public.get_my_profile()
returns table(id uuid, username text, display_name text, avatar_url text, role public.user_role,
              must_reset_password boolean, analytics_access boolean, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.username, p.display_name, p.avatar_url, p.role,
         p.must_reset_password, p.analytics_access, p.created_at
    from public.users_profiles p where p.id = auth.uid()
$$;

create or replace function public.list_user_profiles()
returns table(id uuid, username text, display_name text, avatar_url text, role public.user_role,
              must_reset_password boolean, analytics_access boolean, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_root_owner() then raise exception 'Root Owner access required'; end if;
  return query select p.id, p.username, p.display_name, p.avatar_url, p.role,
                      p.must_reset_password, p.analytics_access, p.created_at
                 from public.users_profiles p order by lower(p.display_name);
end; $$;

create or replace function public.update_my_profile(new_display_name text, new_avatar_url text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.is_root_owner() then raise exception 'The Root Owner profile is locked'; end if;
  if length(trim(new_display_name)) not between 2 and 80 then raise exception 'Display name must be 2-80 characters'; end if;
  if new_avatar_url is not null and length(new_avatar_url) > 1000 then raise exception 'Avatar URL is too long'; end if;
  update public.users_profiles set display_name = trim(new_display_name), avatar_url = nullif(trim(new_avatar_url), '') where id = auth.uid();
end; $$;

create or replace function public.complete_password_reset()
returns void language plpgsql security definer set search_path = public as $$
begin update public.users_profiles set must_reset_password = false where id = auth.uid() and not public.is_root_owner(); end; $$;

create or replace function public.set_analytics_access(target_user_id uuid, enabled boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_root_owner() then raise exception 'Root Owner access required'; end if;
  if not exists(select 1 from public.users_profiles where id = target_user_id and role = 'ADMIN') then
    raise exception 'Analytics can only be assigned to Admins';
  end if;
  update public.users_profiles set analytics_access = enabled where id = target_user_id;
end; $$;

create or replace function public.check_outlet_duplicate(candidate_name text)
returns table(id uuid, name text, created_by_name text)
language sql stable security definer set search_path = public as $$
  select o.id, o.name, coalesce(p.display_name, p.username, 'System')
    from public.outlets o left join public.users_profiles p on p.id = o.created_by
   where o.deleted_at is null
     and o.normalized_name = regexp_replace(lower(trim(candidate_name)), '\s+', ' ', 'g')
   order by o.created_at limit 1
$$;

create or replace function public.create_outlet(candidate_name text, candidate_type public.outlet_type, exception_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare normalized text; existing_id uuid; new_id uuid; is_exception boolean;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if length(trim(candidate_name)) not between 2 and 120 then raise exception 'Outlet name must be 2-120 characters'; end if;
  if public.current_user_role() = 'BASIC' and candidate_type not in ('SUPERMARKET', 'BAZAAR') then
    raise exception 'Field users may add only Supermarkets or Bazaars';
  end if;
  normalized := regexp_replace(lower(trim(candidate_name)), '\s+', ' ', 'g');
  perform pg_advisory_xact_lock(hashtext(normalized));
  select o.id into existing_id from public.outlets o where o.deleted_at is null and o.normalized_name = normalized order by o.created_at limit 1;
  is_exception := existing_id is not null;
  if is_exception and length(trim(coalesce(exception_note, ''))) < 3 then
    raise exception 'DUPLICATE:%', existing_id;
  end if;
  insert into public.outlets(name, normalized_name, type, created_by, exception_flag, exception_note)
  values(trim(candidate_name), normalized, candidate_type, auth.uid(), is_exception, case when is_exception then trim(exception_note) end)
  returning id into new_id;
  return new_id;
end; $$;

create or replace function public.update_outlet(target_outlet_id uuid, new_name text, new_type public.outlet_type, edit_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare owner_id uuid; normalized text;
begin
  select created_by into owner_id from public.outlets where id = target_outlet_id and deleted_at is null for update;
  if owner_id is null then raise exception 'Outlet not found'; end if;
  if public.current_user_role() = 'BASIC' and owner_id <> auth.uid() then raise exception 'You may edit only outlets you created'; end if;
  if public.current_user_role() = 'BASIC' and new_type not in ('SUPERMARKET', 'BAZAAR') then raise exception 'Outlet type not allowed'; end if;
  normalized := regexp_replace(lower(trim(new_name)), '\s+', ' ', 'g');
  update public.outlets set name = trim(new_name), normalized_name = normalized, type = new_type,
    exception_note = coalesce(nullif(trim(edit_note), ''), exception_note), updated_at = now()
  where id = target_outlet_id;
end; $$;

create or replace function public.remove_outlet(target_outlet_id uuid, reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.current_user_role() not in ('SUPER_ADMIN','ADMIN') then raise exception 'Admin access required'; end if;
  if length(trim(reason)) < 3 then raise exception 'Removal reason is required'; end if;
  update public.outlets set deleted_at = now(), exception_note = concat_ws(' | ', exception_note, 'Removed: ' || trim(reason)), updated_at = now()
   where id = target_outlet_id and deleted_at is null;
  if not found then raise exception 'Outlet not found'; end if;
end; $$;

create or replace function public.list_outlets_for_type(target_type public.outlet_type)
returns table(id uuid, name text, type public.outlet_type, created_by uuid, creator_name text,
              exception_flag boolean, exception_note text, deleted_at timestamptz, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select o.id, o.name, o.type, o.created_by, coalesce(p.display_name, p.username),
         o.exception_flag, o.exception_note, o.deleted_at, o.created_at
    from public.outlets o left join public.users_profiles p on p.id = o.created_by
   where o.type = target_type and o.deleted_at is null order by lower(o.name)
$$;

create or replace function public.create_catalog_product(product_name text, product_sku text, product_category text,
  product_description text, starting_stock integer default 0, low_threshold integer default 10)
returns uuid language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  if public.current_user_role() not in ('SUPER_ADMIN','ADMIN') then raise exception 'Admin access required'; end if;
  if length(trim(product_name)) < 2 or length(trim(product_sku)) < 2 or length(trim(product_category)) < 2 then raise exception 'Name, SKU and category are required'; end if;
  insert into public.products(name, sku, category, description, current_stock, low_stock_threshold, is_active, updated_by)
  values(trim(product_name), upper(trim(product_sku)), trim(product_category), nullif(trim(product_description),''), 0, greatest(low_threshold,0), true, auth.uid())
  returning id into new_id;
  if greatest(starting_stock,0) > 0 then
    insert into public.inventory_transactions(product_id,change_amount,transaction_type,notes,logged_by)
    values(new_id,greatest(starting_stock,0),'STOCK_IN','Initial catalog stock',public.current_username());
  end if;
  return new_id;
end; $$;

create or replace function public.update_catalog_product(target_product_id uuid, product_name text, product_sku text,
  product_category text, product_description text, low_threshold integer)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.current_user_role() not in ('SUPER_ADMIN','ADMIN') then raise exception 'Admin access required'; end if;
  update public.products set name=trim(product_name), sku=upper(trim(product_sku)), category=trim(product_category),
    description=nullif(trim(product_description),''), low_stock_threshold=greatest(low_threshold,0), updated_at=now(), updated_by=auth.uid()
  where id=target_product_id and is_active;
  if not found then raise exception 'Active product not found'; end if;
end; $$;

create or replace function public.remove_catalog_product(target_product_id uuid, reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.current_user_role() not in ('SUPER_ADMIN','ADMIN') then raise exception 'Admin access required'; end if;
  if length(trim(reason)) < 3 then raise exception 'Removal reason is required'; end if;
  update public.products set is_active=false, description=concat_ws(E'\n', description, 'Removed: '||trim(reason)), updated_at=now(), updated_by=auth.uid()
  where id=target_product_id and is_active;
  if not found then raise exception 'Active product not found'; end if;
end; $$;

create or replace function public.set_product_price(target_product_id uuid, new_tax_rate numeric,
  new_bottle_before numeric, new_bottle_after numeric, new_pack_before numeric, new_pack_after numeric,
  starts_at timestamptz default now())
returns uuid language plpgsql security definer set search_path = public as $$
declare next_version integer; new_id uuid;
begin
  if public.current_user_role() not in ('SUPER_ADMIN','ADMIN') then raise exception 'Admin access required'; end if;
  if new_tax_rate not between 0 and 1 then raise exception 'Tax rate must be between 0 and 1'; end if;
  if least(new_bottle_before,new_bottle_after,new_pack_before,new_pack_after) < 0 then raise exception 'Prices cannot be negative'; end if;
  if abs(new_bottle_after - new_bottle_before*(1+new_tax_rate)) > 0.02 or abs(new_pack_after - new_pack_before*(1+new_tax_rate)) > 0.02 then
    raise exception 'Before-tax, after-tax and tax rate values do not reconcile';
  end if;
  perform 1 from public.products where id=target_product_id and is_active for update;
  if not found then raise exception 'Active product not found'; end if;
  select coalesce(max(version),0)+1 into next_version from public.product_prices where product_id=target_product_id;
  update public.product_prices set effective_to=starts_at where product_id=target_product_id and effective_to is null;
  insert into public.product_prices(product_id,pack_size,tax_rate,bottle_price_before_tax,bottle_price_after_tax,
    pack_price_before_tax,pack_price_after_tax,effective_from,version,created_by)
  values(target_product_id,15,new_tax_rate,new_bottle_before,new_bottle_after,new_pack_before,new_pack_after,starts_at,next_version,auth.uid())
  returning id into new_id;
  return new_id;
end; $$;

create or replace function public.get_current_prices()
returns table(id uuid, product_id uuid, product_name text, product_sku text, pack_size integer, tax_rate numeric,
  bottle_price_before_tax numeric, bottle_price_after_tax numeric, pack_price_before_tax numeric, pack_price_after_tax numeric,
  effective_from timestamptz, effective_to timestamptz, version integer)
language plpgsql stable security definer set search_path = public as $$
begin
  if public.current_user_role() not in ('SUPER_ADMIN','ADMIN') then raise exception 'Admin access required'; end if;
  return query select pp.id,pp.product_id,p.name,p.sku,pp.pack_size,pp.tax_rate,pp.bottle_price_before_tax,
    pp.bottle_price_after_tax,pp.pack_price_before_tax,pp.pack_price_after_tax,pp.effective_from,pp.effective_to,pp.version
  from public.products p left join public.product_prices pp on pp.product_id=p.id and pp.effective_to is null
  where p.is_active order by p.category,p.name;
end; $$;

create or replace function public.append_financial_line(p_transaction_id uuid, p_kind public.financial_transaction_kind,
  p_outlet_id uuid, p_product_id uuid, p_quantity numeric, p_unit public.quantity_unit, p_occurred_at timestamptz)
returns integer language plpgsql security definer set search_path = public as $$
declare price public.product_prices%rowtype; product_row public.products%rowtype; bottles integer; before_price numeric; after_price numeric;
begin
  select * into product_row from public.products where id=p_product_id and is_active;
  if not found then raise exception 'Product not found or inactive'; end if;
  select * into price from public.product_prices where product_id=p_product_id and effective_from <= p_occurred_at
    and (effective_to is null or effective_to > p_occurred_at) order by effective_from desc limit 1;
  if not found then raise exception 'No effective price configured for %', product_row.name; end if;
  if p_quantity <= 0 or trunc(p_quantity) <> p_quantity then raise exception 'Quantity must be a positive whole number'; end if;
  bottles := p_quantity::integer * case when p_unit='PACK' then price.pack_size else 1 end;
  before_price := case when p_unit='PACK' then price.pack_price_before_tax else price.bottle_price_before_tax end;
  after_price := case when p_unit='PACK' then price.pack_price_after_tax else price.bottle_price_after_tax end;
  insert into public.financial_ledger(transaction_id,transaction_kind,outlet_id,product_id,product_name_snapshot,product_sku_snapshot,
    quantity,quantity_unit,quantity_bottles,pack_size_snapshot,price_version,unit_price_before_tax,unit_price_after_tax,
    taxable_amount,tax_amount,total_amount,tax_rate_snapshot,occurred_at,recorded_by)
  values(p_transaction_id,p_kind,p_outlet_id,p_product_id,product_row.name,product_row.sku,p_quantity,p_unit,bottles,price.pack_size,
    price.version,before_price,after_price,round(p_quantity*before_price,4),round(p_quantity*(after_price-before_price),4),
    round(p_quantity*after_price,4),price.tax_rate,p_occurred_at,auth.uid());
  return bottles;
end; $$;

create or replace function public.create_delivery(target_outlet_id uuid, occurred_at timestamptz, items jsonb,
  delivery_status public.pipeline_status default 'DELIVERED', device_timezone text default null, delivery_notes text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare batch_id uuid; item jsonb; bottles integer; factory_stock integer; product_id uuid; qty numeric; unit_value public.quantity_unit;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.outlets where id=target_outlet_id and deleted_at is null) then raise exception 'Outlet not found'; end if;
  if items is null or jsonb_typeof(items)<>'array' or jsonb_array_length(items)=0 then raise exception 'At least one delivery item is required'; end if;
  insert into public.delivery_batches(outlet_id,status,occurred_at,recorded_by,device_timezone,notes)
  values(target_outlet_id,delivery_status,occurred_at,auth.uid(),nullif(device_timezone,''),nullif(trim(delivery_notes),'')) returning id into batch_id;
  insert into public.delivery_status_events(delivery_id,to_status,changed_by) values(batch_id,delivery_status,auth.uid());
  for item in select * from jsonb_array_elements(items) loop
    product_id := (item->>'product_id')::uuid; qty := (item->>'quantity')::numeric; unit_value := (item->>'unit')::public.quantity_unit;
    bottles := public.append_financial_line(batch_id,'DELIVERY',target_outlet_id,product_id,qty,unit_value,occurred_at);
    select current_stock into factory_stock from public.products where id=product_id for update;
    if factory_stock is null or factory_stock < bottles then
      raise exception 'Insufficient factory stock for product %', product_id;
    end if;
    insert into public.inventory_transactions(product_id,change_amount,transaction_type,notes,logged_by)
    values(product_id,-bottles,'STOCK_OUT','Outlet delivery '||batch_id::text,public.current_username());
    insert into public.outlet_inventory(outlet_id,product_id,stock_bottles) values(target_outlet_id,product_id,0) on conflict(outlet_id,product_id) do nothing;
    insert into public.outlet_logs(outlet_id,product_id,change_bottles,logged_by,"timestamp") values(target_outlet_id,product_id,bottles,auth.uid(),occurred_at);
  end loop;
  return batch_id;
end; $$;

create or replace function public.record_outlet_sale(target_outlet_id uuid, target_product_id uuid, sold_quantity integer default 1)
returns uuid language plpgsql security definer set search_path = public as $$
declare sale_id uuid := gen_random_uuid(); current_stock integer;
begin
  if sold_quantity < 1 then raise exception 'Quantity must be positive'; end if;
  select stock_bottles into current_stock from public.outlet_inventory where outlet_id=target_outlet_id and product_id=target_product_id for update;
  if coalesce(current_stock,0) < sold_quantity then raise exception 'Insufficient outlet stock'; end if;
  perform public.append_financial_line(sale_id,'SALE',target_outlet_id,target_product_id,sold_quantity,'BOTTLE',now());
  insert into public.outlet_logs(outlet_id,product_id,change_bottles,logged_by) values(target_outlet_id,target_product_id,-sold_quantity,auth.uid());
  return sale_id;
end; $$;

create or replace function public.create_stock_order(target_outlet_id uuid, items jsonb, order_notes text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare order_id uuid; item jsonb; qty numeric; unit_value public.quantity_unit; bottles integer;
begin
  if items is null or jsonb_typeof(items)<>'array' or jsonb_array_length(items)=0 then raise exception 'At least one order item is required'; end if;
  insert into public.stock_orders(outlet_id,requested_by,notes) values(target_outlet_id,auth.uid(),nullif(trim(order_notes),'')) returning id into order_id;
  for item in select * from jsonb_array_elements(items) loop
    qty := (item->>'quantity')::numeric; unit_value := (item->>'unit')::public.quantity_unit;
    if qty <= 0 or trunc(qty)<>qty then raise exception 'Quantity must be a positive whole number'; end if;
    if not exists(select 1 from public.products p join public.product_prices pp on pp.product_id=p.id and pp.effective_to is null where p.id=(item->>'product_id')::uuid and p.is_active) then
      raise exception 'Product is inactive or has no current price';
    end if;
    bottles := qty::integer * case when unit_value='PACK' then 15 else 1 end;
    insert into public.stock_order_items(order_id,product_id,quantity,quantity_unit,quantity_bottles)
    values(order_id,(item->>'product_id')::uuid,qty,unit_value,bottles);
  end loop;
  return order_id;
end; $$;

create or replace function public.update_pipeline_status(target_id uuid, target_status public.pipeline_status, status_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare old_status public.pipeline_status;
begin
  if public.current_user_role() not in ('SUPER_ADMIN','ADMIN') then raise exception 'Admin access required'; end if;
  select status into old_status from public.delivery_batches where id=target_id for update;
  if old_status is not null then
    update public.delivery_batches set status=target_status where id=target_id;
    insert into public.delivery_status_events(delivery_id,from_status,to_status,changed_by,note)
    values(target_id,old_status,target_status,auth.uid(),nullif(trim(status_note),''));
    return;
  end if;
  update public.stock_orders set status=target_status,updated_at=now() where id=target_id;
  if not found then raise exception 'Delivery or order not found'; end if;
end; $$;

create or replace function public.get_delivery_logs(target_outlet_id uuid, row_limit integer default 100)
returns table(id uuid,batch_id uuid,product_id uuid,product_name text,quantity numeric,unit public.quantity_unit,
  quantity_bottles integer,occurred_at timestamptz,recorded_at timestamptz,status public.pipeline_status,recorded_by_name text)
language sql stable security definer set search_path = public as $$
  select fl.id,db.id,fl.product_id,fl.product_name_snapshot,fl.quantity,fl.quantity_unit,fl.quantity_bottles,
    db.occurred_at,db.recorded_at,db.status,coalesce(up.display_name,up.username)
  from public.financial_ledger fl join public.delivery_batches db on db.id=fl.transaction_id
  join public.users_profiles up on up.id=db.recorded_by
  where fl.transaction_kind='DELIVERY' and db.outlet_id=target_outlet_id order by db.occurred_at desc,fl.recorded_at desc
  limit least(greatest(row_limit,1),500)
$$;

create or replace function public.get_outlet_pipeline(target_outlet_id uuid)
returns table(status public.pipeline_status,item_count bigint,bottle_count bigint,amount_after_tax numeric)
language sql stable security definer set search_path = public as $$
  with rows as (
    select db.status,db.id,coalesce(sum(fl.quantity_bottles),0)::bigint bottles,coalesce(sum(fl.total_amount),0) amount
      from public.delivery_batches db left join public.financial_ledger fl on fl.transaction_id=db.id and fl.transaction_kind='DELIVERY'
     where db.outlet_id=target_outlet_id group by db.status,db.id
    union all
    select so.status,so.id,coalesce(sum(soi.quantity_bottles),0)::bigint,0::numeric
      from public.stock_orders so left join public.stock_order_items soi on soi.order_id=so.id
     where so.outlet_id=target_outlet_id group by so.status,so.id
  ) select r.status,count(*),sum(r.bottles),sum(r.amount) from rows r group by r.status
$$;

create or replace function public.get_monthly_analytics(month_start date default date_trunc('month',current_date)::date)
returns table(total_current_inventory bigint,outlet_inventory bigint,total_sales_volume bigint,pending_sales numeric,
  projected_sales numeric,gross_revenue numeric,net_revenue numeric,total_tax_liability numeric,outstanding_orders bigint,
  active_outlets bigint,low_stock_products bigint,inventory_turnover numeric)
language plpgsql stable security definer set search_path = public as $$
declare month_end date := (month_start + interval '1 month')::date;
begin
  if not (public.is_root_owner() or exists(select 1 from public.users_profiles where id=auth.uid() and role='ADMIN' and analytics_access)) then
    raise exception 'Analytics access required';
  end if;
  return query select
    ((select coalesce(sum(current_stock),0) from public.products where is_active) +
     (select coalesce(sum(stock_bottles),0) from public.outlet_inventory))::bigint,
    (select coalesce(sum(stock_bottles),0)::bigint from public.outlet_inventory),
    (select coalesce(sum(fl.quantity_bottles),0)::bigint from public.financial_ledger fl left join public.delivery_batches db on db.id=fl.transaction_id and fl.transaction_kind='DELIVERY' where (fl.transaction_kind='SALE' or db.status='PAID') and fl.occurred_at>=month_start and fl.occurred_at<month_end),
    (select coalesce(sum(soi.quantity * case when soi.quantity_unit='PACK' then pp.pack_price_after_tax else pp.bottle_price_after_tax end),0)
       from public.stock_orders so join public.stock_order_items soi on soi.order_id=so.id
       join public.product_prices pp on pp.product_id=soi.product_id and pp.effective_to is null
      where so.status in ('PENDING_ORDER','WAITING_CONFIRMATION') and so.requested_at>=month_start and so.requested_at<month_end),
    ((select coalesce(sum(fl.total_amount),0) from public.financial_ledger fl join public.delivery_batches db on db.id=fl.transaction_id where db.status in ('DELIVERED','WAITING_CONFIRMATION','CONSIGNMENT') and fl.occurred_at>=month_start and fl.occurred_at<month_end) +
     (select coalesce(sum(soi.quantity * case when soi.quantity_unit='PACK' then pp.pack_price_after_tax else pp.bottle_price_after_tax end),0) from public.stock_orders so join public.stock_order_items soi on soi.order_id=so.id join public.product_prices pp on pp.product_id=soi.product_id and pp.effective_to is null where so.status in ('PENDING_ORDER','WAITING_CONFIRMATION') and so.requested_at>=month_start and so.requested_at<month_end)),
    (select coalesce(sum(fl.total_amount),0) from public.financial_ledger fl left join public.delivery_batches db on db.id=fl.transaction_id and fl.transaction_kind='DELIVERY' where (fl.transaction_kind='SALE' or db.status='PAID') and fl.occurred_at>=month_start and fl.occurred_at<month_end),
    (select coalesce(sum(fl.taxable_amount),0) from public.financial_ledger fl left join public.delivery_batches db on db.id=fl.transaction_id and fl.transaction_kind='DELIVERY' where (fl.transaction_kind='SALE' or db.status='PAID') and fl.occurred_at>=month_start and fl.occurred_at<month_end),
    (select coalesce(sum(fl.tax_amount),0) from public.financial_ledger fl left join public.delivery_batches db on db.id=fl.transaction_id and fl.transaction_kind='DELIVERY' where (fl.transaction_kind='SALE' or db.status='PAID') and fl.occurred_at>=month_start and fl.occurred_at<month_end),
    (select count(*) from public.stock_orders where status in ('PENDING_ORDER','WAITING_CONFIRMATION')),
    (select count(*) from public.outlets where deleted_at is null),
    (select count(*) from public.products where is_active and current_stock<=low_stock_threshold),
    round((select coalesce(sum(quantity_bottles),0) from public.financial_ledger where transaction_kind='SALE' and occurred_at>=month_start and occurred_at<month_end)::numeric /
      nullif((select coalesce(sum(current_stock),0) from public.products where is_active) + (select coalesce(sum(stock_bottles),0) from public.outlet_inventory),0),4);
end; $$;

create or replace function public.get_accounting_export()
returns table(date timestamptz,outlet_name text,product text,quantity_delivered integer,status public.pipeline_status,
  unit_price numeric,taxable_amount numeric,tax_paid numeric,total_revenue numeric,record_type text,sku text,recorded_by text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_root_owner() then raise exception 'Root Owner access required'; end if;
  return query select fl.occurred_at,o.name,fl.product_name_snapshot,fl.quantity_bottles,db.status,
    fl.unit_price_after_tax,fl.taxable_amount,fl.tax_amount,fl.total_amount,fl.transaction_kind::text,
    fl.product_sku_snapshot,coalesce(up.display_name,up.username)
  from public.financial_ledger fl join public.outlets o on o.id=fl.outlet_id
  left join public.delivery_batches db on db.id=fl.transaction_id and fl.transaction_kind='DELIVERY'
  join public.users_profiles up on up.id=fl.recorded_by
  order by fl.occurred_at,fl.recorded_at;
end; $$;

-- RLS: BASIC users never receive direct catalog mutation rights or finance
-- table access. All writes are role-checking SECURITY DEFINER functions.
alter table public.product_prices enable row level security;
alter table public.delivery_batches enable row level security;
alter table public.financial_ledger enable row level security;
alter table public.delivery_status_events enable row level security;
alter table public.stock_orders enable row level security;
alter table public.stock_order_items enable row level security;

drop policy if exists outlets_authenticated_read on public.outlets;
create policy outlets_authenticated_read on public.outlets for select to authenticated using (deleted_at is null);
drop policy if exists delivery_batches_scoped_read on public.delivery_batches;
create policy delivery_batches_scoped_read on public.delivery_batches for select to authenticated
using (recorded_by=auth.uid() or public.current_user_role() in ('SUPER_ADMIN','ADMIN'));
drop policy if exists stock_orders_scoped_read on public.stock_orders;
create policy stock_orders_scoped_read on public.stock_orders for select to authenticated
using (requested_by=auth.uid() or public.current_user_role() in ('SUPER_ADMIN','ADMIN'));

revoke insert,update,delete on public.products,public.outlets,public.product_prices,public.delivery_batches,
  public.financial_ledger,public.delivery_status_events,public.stock_orders,public.stock_order_items from authenticated,anon;
revoke select on public.product_prices,public.financial_ledger,public.delivery_status_events,public.stock_order_items from authenticated,anon;

revoke all on function public.append_financial_line(uuid,public.financial_transaction_kind,uuid,uuid,numeric,public.quantity_unit,timestamptz) from public;
revoke all on function public.get_my_profile(),public.list_user_profiles(),public.update_my_profile(text,text),public.complete_password_reset(),
  public.set_analytics_access(uuid,boolean),public.check_outlet_duplicate(text),public.create_outlet(text,public.outlet_type,text),
  public.update_outlet(uuid,text,public.outlet_type,text),public.remove_outlet(uuid,text),public.list_outlets_for_type(public.outlet_type),
  public.create_catalog_product(text,text,text,text,integer,integer),public.update_catalog_product(uuid,text,text,text,text,integer),
  public.remove_catalog_product(uuid,text),public.set_product_price(uuid,numeric,numeric,numeric,numeric,numeric,timestamptz),
  public.get_current_prices(),public.create_delivery(uuid,timestamptz,jsonb,public.pipeline_status,text,text),
  public.record_outlet_sale(uuid,uuid,integer),public.create_stock_order(uuid,jsonb,text),
  public.update_pipeline_status(uuid,public.pipeline_status,text),public.get_delivery_logs(uuid,integer),
  public.get_outlet_pipeline(uuid),public.get_monthly_analytics(date),public.get_accounting_export()
from public;
grant execute on function public.get_my_profile(),public.list_user_profiles(),public.update_my_profile(text,text),public.complete_password_reset(),
  public.set_analytics_access(uuid,boolean),public.check_outlet_duplicate(text),public.create_outlet(text,public.outlet_type,text),
  public.update_outlet(uuid,text,public.outlet_type,text),public.remove_outlet(uuid,text),public.list_outlets_for_type(public.outlet_type),
  public.create_catalog_product(text,text,text,text,integer,integer),public.update_catalog_product(uuid,text,text,text,text,integer),
  public.remove_catalog_product(uuid,text),public.set_product_price(uuid,numeric,numeric,numeric,numeric,numeric,timestamptz),
  public.get_current_prices(),public.create_delivery(uuid,timestamptz,jsonb,public.pipeline_status,text,text),
  public.record_outlet_sale(uuid,uuid,integer),public.create_stock_order(uuid,jsonb,text),
  public.update_pipeline_status(uuid,public.pipeline_status,text),public.get_delivery_logs(uuid,integer),
  public.get_outlet_pipeline(uuid),public.get_monthly_analytics(date),public.get_accounting_export()
to authenticated;

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='delivery_batches') then
    alter publication supabase_realtime add table public.delivery_batches;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='stock_orders') then
    alter publication supabase_realtime add table public.stock_orders;
  end if;
end $$;

-- Public profile pictures; only the owning authenticated user can write below
-- their UUID folder. Root account UI remains locked by application policy.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('profile-pictures','profile-pictures',true,2097152,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=true,file_size_limit=2097152,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists profile_pictures_public_read on storage.objects;
create policy profile_pictures_public_read on storage.objects for select using(bucket_id='profile-pictures');
drop policy if exists profile_pictures_owner_insert on storage.objects;
create policy profile_pictures_owner_insert on storage.objects for insert to authenticated
with check(bucket_id='profile-pictures' and (storage.foldername(name))[1]=auth.uid()::text and not public.is_root_owner());
drop policy if exists profile_pictures_owner_update on storage.objects;
create policy profile_pictures_owner_update on storage.objects for update to authenticated
using(bucket_id='profile-pictures' and (storage.foldername(name))[1]=auth.uid()::text and not public.is_root_owner());
