-- KONJO IMS final outlet controls and priced-delivery migration.
-- Additive and safe to re-run after the verified Part 5 deployment.

begin;

alter table public.products
  add column if not exists bottles_per_pack integer not null default 15;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'products_bottles_per_pack_positive') then
    alter table public.products add constraint products_bottles_per_pack_positive check (bottles_per_pack between 1 and 10000);
  end if;
end $$;

alter table public.outlet_logs
  add column if not exists delivery_batch_id uuid,
  add column if not exists operation_id uuid,
  add column if not exists operation_kind text not null default 'STOCK_CHANGE',
  add column if not exists quantity_entered integer,
  add column if not exists quantity_unit text,
  add column if not exists bottles_per_pack_snapshot integer,
  add column if not exists unit_price_etb_snapshot numeric(16,4),
  add column if not exists tax_rate_snapshot numeric(7,6),
  add column if not exists subtotal_etb numeric(18,4),
  add column if not exists tax_amount_etb numeric(18,4),
  add column if not exists total_amount_etb numeric(18,4),
  add column if not exists notes text;

create unique index if not exists outlet_logs_operation_id_uidx
  on public.outlet_logs(operation_id) where operation_id is not null;
create unique index if not exists outlet_logs_delivery_product_uidx
  on public.outlet_logs(delivery_batch_id, product_id)
  where delivery_batch_id is not null;
create index if not exists outlet_logs_priced_delivery_idx
  on public.outlet_logs(outlet_id, "timestamp" desc)
  where operation_kind = 'DELIVERY';

-- All outlet metadata writes go through this role-checking function. BASIC
-- users retain read access to the outlets portal but cannot create/edit/archive.
create or replace function public.admin_save_outlet(
  target_outlet_id uuid,
  outlet_name text,
  outlet_type_value public.outlet_type,
  outlet_address text,
  outlet_subcity text,
  outlet_active boolean
)
returns setof public.outlets
language plpgsql security definer
set search_path = ''
as $$
declare
  saved_id uuid;
  clean_name text := nullif(trim(outlet_name), '');
  generated_key text;
begin
  if public.current_user_role() not in ('SUPER_ADMIN', 'ADMIN') then
    raise exception 'Admin access required';
  end if;
  if clean_name is null or length(clean_name) > 120 then
    raise exception 'Outlet name must contain between 1 and 120 characters';
  end if;

  if target_outlet_id is null then
    generated_key := encode(extensions.digest(
      lower(clean_name) || '|' || lower(trim(coalesce(outlet_address, ''))) || '|' || lower(trim(coalesce(outlet_subcity, ''))),
      'sha256'
    ), 'hex');
    insert into public.outlets(name, normalized_name, type, address, subcity, source_key, is_active)
    values(clean_name, private.normalize_outlet_name(clean_name), outlet_type_value,
      nullif(trim(outlet_address), ''), nullif(trim(outlet_subcity), ''), generated_key, outlet_active)
    on conflict(source_key) do update set
      name = excluded.name,
      normalized_name = excluded.normalized_name,
      type = excluded.type,
      address = excluded.address,
      subcity = excluded.subcity,
      is_active = excluded.is_active,
      updated_at = now()
    returning id into saved_id;
  else
    update public.outlets set
      name = clean_name,
      normalized_name = private.normalize_outlet_name(clean_name),
      type = outlet_type_value,
      address = nullif(trim(outlet_address), ''),
      subcity = nullif(trim(outlet_subcity), ''),
      is_active = outlet_active,
      updated_at = now()
    where id = target_outlet_id
    returning id into saved_id;
    if saved_id is null then raise exception 'Outlet not found'; end if;
  end if;

  return query select o.* from public.outlets o where o.id = saved_id;
end;
$$;

-- Prices are per bottle. Pack size is product-specific and is used only for
-- conversion; all inventory continues to be stored as whole bottles.
create or replace function public.admin_update_product_commercials(
  target_product_id uuid,
  new_unit_price numeric,
  new_tax_rate numeric,
  new_bottles_per_pack integer
)
returns setof public.products
language plpgsql security definer
set search_path = ''
as $$
begin
  if public.current_user_role() not in ('SUPER_ADMIN', 'ADMIN') then
    raise exception 'Admin access required';
  end if;
  if new_unit_price is null or new_unit_price < 0 then raise exception 'Bottle price cannot be negative'; end if;
  if new_tax_rate is null or new_tax_rate < 0 or new_tax_rate > 1 then raise exception 'Tax rate must be between 0 and 1'; end if;
  if new_bottles_per_pack is null or new_bottles_per_pack not between 1 and 10000 then raise exception 'Bottles per pack must be between 1 and 10,000'; end if;

  update public.products set
    unit_price_etb = round(new_unit_price, 4),
    tax_rate = new_tax_rate,
    bottles_per_pack = new_bottles_per_pack,
    updated_at = now()
  where id = target_product_id and is_active;
  if not found then raise exception 'Active product not found'; end if;
  return query select p.* from public.products p where p.id = target_product_id;
end;
$$;

-- Preserve the existing quick-change RPC for bottle-by-bottle sales, but stop
-- BASIC users from using it to create unpriced positive stock deliveries.
drop function if exists public.log_outlet_change_v2(uuid, uuid, integer, uuid);
create function public.log_outlet_change_v2(
  target_outlet_id uuid,
  target_product_id uuid,
  bottle_change integer,
  p_operation_id uuid
)
returns setof public.outlet_inventory
language plpgsql security definer
set search_path = ''
as $$
declare
  current_stock integer;
begin
  if auth.uid() is null or public.current_user_role() is null then raise exception 'Authentication required'; end if;
  if bottle_change = 0 then raise exception 'Bottle change cannot be zero'; end if;
  if public.current_user_role() = 'BASIC' and bottle_change > 0 then
    raise exception 'Use the priced delivery form to add outlet stock';
  end if;
  if not exists(select 1 from public.outlets where id = target_outlet_id and is_active) then raise exception 'Outlet not found or inactive'; end if;
  if not exists(select 1 from public.products where id = target_product_id and is_active) then raise exception 'Product not found or inactive'; end if;

  if exists(select 1 from public.outlet_logs where operation_id = p_operation_id) then
    return query select oi.* from public.outlet_inventory oi where oi.outlet_id = target_outlet_id and oi.product_id = target_product_id;
    return;
  end if;
  insert into public.outlet_inventory(outlet_id, product_id, stock_bottles)
  values(target_outlet_id, target_product_id, 0)
  on conflict(outlet_id, product_id) do nothing;
  select stock_bottles into current_stock from public.outlet_inventory
    where outlet_id = target_outlet_id and product_id = target_product_id for update;
  if current_stock + bottle_change < 0 then raise exception 'Insufficient outlet stock'; end if;

  insert into public.outlet_logs(outlet_id, product_id, change_bottles, logged_by, operation_id, operation_kind, quantity_entered, quantity_unit, notes)
  values(target_outlet_id, target_product_id, bottle_change, auth.uid(), p_operation_id,
    case when bottle_change < 0 then 'SALE' else 'STOCK_CHANGE' end, abs(bottle_change), 'BOTTLE',
    case when bottle_change < 0 then 'Bottle-by-bottle outlet sale/usage' else 'Admin stock addition' end);
  return query select oi.* from public.outlet_inventory oi where oi.outlet_id = target_outlet_id and oi.product_id = target_product_id;
end;
$$;

-- Admin-only absolute correction used by the pencil icon. The delta is audited;
-- it deliberately has no commercial value because it is not a new delivery.
create or replace function public.admin_set_outlet_stock_exact(
  target_outlet_id uuid,
  target_product_id uuid,
  target_stock_bottles integer,
  adjustment_reason text,
  p_operation_id uuid
)
returns setof public.outlet_inventory
language plpgsql security definer
set search_path = ''
as $$
declare
  current_stock integer;
  stock_delta integer;
begin
  if public.current_user_role() not in ('SUPER_ADMIN', 'ADMIN') then raise exception 'Admin access required'; end if;
  if target_stock_bottles is null or target_stock_bottles < 0 then raise exception 'Final stock cannot be negative'; end if;
  if length(trim(coalesce(adjustment_reason, ''))) < 3 then raise exception 'A correction reason is required'; end if;
  if not exists(select 1 from public.outlets where id = target_outlet_id) then raise exception 'Outlet not found'; end if;
  if not exists(select 1 from public.products where id = target_product_id and is_active) then raise exception 'Product not found or inactive'; end if;

  if exists(select 1 from public.outlet_logs where operation_id = p_operation_id) then
    return query select oi.* from public.outlet_inventory oi where oi.outlet_id = target_outlet_id and oi.product_id = target_product_id;
    return;
  end if;
  insert into public.outlet_inventory(outlet_id, product_id, stock_bottles)
  values(target_outlet_id, target_product_id, 0)
  on conflict(outlet_id, product_id) do nothing;
  select stock_bottles into current_stock from public.outlet_inventory
    where outlet_id = target_outlet_id and product_id = target_product_id for update;
  stock_delta := target_stock_bottles - current_stock;
  if stock_delta <> 0 then
    insert into public.outlet_logs(outlet_id, product_id, change_bottles, logged_by, operation_id, operation_kind, notes)
    values(target_outlet_id, target_product_id, stock_delta, auth.uid(), p_operation_id, 'STOCK_CORRECTION', trim(adjustment_reason));
  end if;
  return query select oi.* from public.outlet_inventory oi where oi.outlet_id = target_outlet_id and oi.product_id = target_product_id;
end;
$$;

-- Atomic multi-product delivery. All arithmetic is repeated server-side using
-- current product settings; client totals are previews only.
create or replace function public.record_priced_outlet_delivery_batch(
  target_outlet_id uuid,
  p_items jsonb,
  p_operation_id uuid,
  p_notes text default null
)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  item jsonb;
  product_row public.products%rowtype;
  quantity_value integer;
  unit_value text;
  bottle_count integer;
  line_operation_id uuid;
  line_subtotal numeric(18,4);
  line_tax numeric(18,4);
  line_total numeric(18,4);
  total_bottles integer := 0;
  subtotal_sum numeric(18,4) := 0;
  tax_sum numeric(18,4) := 0;
  total_sum numeric(18,4) := 0;
begin
  if auth.uid() is null or public.current_user_role() is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.outlets where id = target_outlet_id and is_active) then raise exception 'Outlet not found or inactive'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 then raise exception 'At least one delivery item is required'; end if;
  if jsonb_array_length(p_items) > 200 then raise exception 'A delivery cannot contain more than 200 product lines'; end if;
  if exists(select 1 from public.outlet_logs where delivery_batch_id = p_operation_id) then
    select coalesce(sum(change_bottles),0), coalesce(sum(subtotal_etb),0), coalesce(sum(tax_amount_etb),0), coalesce(sum(total_amount_etb),0)
      into total_bottles, subtotal_sum, tax_sum, total_sum
      from public.outlet_logs where delivery_batch_id = p_operation_id;
    return jsonb_build_object('delivery_batch_id', p_operation_id, 'bottles', total_bottles, 'subtotal_etb', subtotal_sum, 'tax_amount_etb', tax_sum, 'total_amount_etb', total_sum);
  end if;

  if (select count(*) from jsonb_array_elements(p_items)) <>
     (select count(distinct value->>'product_id') from jsonb_array_elements(p_items)) then
    raise exception 'Each product may appear only once in a delivery';
  end if;

  for item in select value from jsonb_array_elements(p_items) loop
    if coalesce(item->>'product_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then raise exception 'Invalid product ID'; end if;
    if coalesce(item->>'quantity', '') !~ '^\d+$' then raise exception 'Delivery quantity must be a positive whole number'; end if;
    quantity_value := (item->>'quantity')::integer;
    if quantity_value < 1 then raise exception 'Delivery quantity must be positive'; end if;
    unit_value := upper(coalesce(item->>'unit', 'PACK'));
    if unit_value not in ('PACK', 'BOTTLE') then raise exception 'Delivery unit must be PACK or BOTTLE'; end if;

    select * into product_row from public.products where id = (item->>'product_id')::uuid and is_active for update;
    if product_row.id is null then raise exception 'Product not found or inactive'; end if;
    if product_row.unit_price_etb is null or product_row.unit_price_etb <= 0 then
      raise exception 'Set a positive bottle price for % before recording a delivery', product_row.name;
    end if;
    if quantity_value::numeric * case when unit_value = 'PACK' then product_row.bottles_per_pack else 1 end > 2147483647 then
      raise exception 'Delivery quantity is larger than the supported whole-bottle limit';
    end if;
    bottle_count := quantity_value * case when unit_value = 'PACK' then product_row.bottles_per_pack else 1 end;
    line_subtotal := round(bottle_count * product_row.unit_price_etb, 4);
    line_tax := round(line_subtotal * product_row.tax_rate, 4);
    line_total := line_subtotal + line_tax;
    line_operation_id := (md5(p_operation_id::text || ':' || product_row.id::text))::uuid;

    insert into public.outlet_inventory(outlet_id, product_id, stock_bottles)
    values(target_outlet_id, product_row.id, 0)
    on conflict(outlet_id, product_id) do nothing;
    perform 1 from public.outlet_inventory where outlet_id = target_outlet_id and product_id = product_row.id for update;
    insert into public.outlet_logs(
      outlet_id, product_id, change_bottles, logged_by, operation_id, delivery_batch_id, operation_kind,
      quantity_entered, quantity_unit, bottles_per_pack_snapshot, unit_price_etb_snapshot, tax_rate_snapshot,
      subtotal_etb, tax_amount_etb, total_amount_etb, notes
    ) values(
      target_outlet_id, product_row.id, bottle_count, auth.uid(), line_operation_id, p_operation_id, 'DELIVERY',
      quantity_value, unit_value, product_row.bottles_per_pack, product_row.unit_price_etb, product_row.tax_rate,
      line_subtotal, line_tax, line_total, nullif(trim(p_notes), '')
    );
    total_bottles := total_bottles + bottle_count;
    subtotal_sum := subtotal_sum + line_subtotal;
    tax_sum := tax_sum + line_tax;
    total_sum := total_sum + line_total;
  end loop;

  return jsonb_build_object('delivery_batch_id', p_operation_id, 'bottles', total_bottles,
    'subtotal_etb', subtotal_sum, 'tax_amount_etb', tax_sum, 'total_amount_etb', total_sum);
end;
$$;

create or replace function public.get_outlet_delivery_financials(target_outlet_id uuid, row_limit integer default 250)
returns table(
  id uuid, delivery_batch_id uuid, product_id uuid, product_name text, product_sku text,
  quantity_entered integer, quantity_unit text, quantity_bottles integer, bottles_per_pack integer,
  unit_price_etb numeric, tax_rate numeric, subtotal_etb numeric, tax_amount_etb numeric,
  total_amount_etb numeric, username text, "timestamp" timestamptz, notes text
)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or public.current_user_role() is null then raise exception 'Authentication required'; end if;
  return query
  select l.id, l.delivery_batch_id, l.product_id, p.name, p.sku, l.quantity_entered, l.quantity_unit,
    l.change_bottles, l.bottles_per_pack_snapshot, l.unit_price_etb_snapshot, l.tax_rate_snapshot,
    l.subtotal_etb, l.tax_amount_etb, l.total_amount_etb, u.username, l."timestamp", l.notes
  from public.outlet_logs l
  join public.products p on p.id = l.product_id
  join public.users_profiles u on u.id = l.logged_by
  where l.outlet_id = target_outlet_id and l.operation_kind = 'DELIVERY'
  order by l."timestamp" desc, l.id
  limit least(greatest(row_limit, 1), 1000);
end;
$$;

-- Disable older outlet-mutation entry points when present. The new admin RPC
-- is the only metadata write path granted to app users.
revoke insert, update, delete on public.products, public.outlets, public.outlet_inventory, public.outlet_logs from authenticated, anon;

do $$
begin
  if to_regprocedure('public.admin_upsert_outlet(uuid,text,public.outlet_type,text,text,boolean)') is not null then
    execute 'revoke all on function public.admin_upsert_outlet(uuid,text,public.outlet_type,text,text,boolean) from public, anon, authenticated';
  end if;
  if to_regprocedure('public.create_outlet(text,public.outlet_type,text)') is not null then
    execute 'revoke all on function public.create_outlet(text,public.outlet_type,text) from public, anon, authenticated';
  end if;
  if to_regprocedure('public.update_outlet(uuid,text,public.outlet_type,text)') is not null then
    execute 'revoke all on function public.update_outlet(uuid,text,public.outlet_type,text) from public, anon, authenticated';
  end if;
end $$;

revoke all on function public.admin_save_outlet(uuid,text,public.outlet_type,text,text,boolean) from public, anon;
revoke all on function public.admin_update_product_commercials(uuid,numeric,numeric,integer) from public, anon;
revoke all on function public.log_outlet_change_v2(uuid,uuid,integer,uuid) from public, anon;
revoke all on function public.admin_set_outlet_stock_exact(uuid,uuid,integer,text,uuid) from public, anon;
revoke all on function public.record_priced_outlet_delivery_batch(uuid,jsonb,uuid,text) from public, anon;
revoke all on function public.get_outlet_delivery_financials(uuid,integer) from public, anon;

grant execute on function public.admin_save_outlet(uuid,text,public.outlet_type,text,text,boolean) to authenticated;
grant execute on function public.admin_update_product_commercials(uuid,numeric,numeric,integer) to authenticated;
grant execute on function public.log_outlet_change_v2(uuid,uuid,integer,uuid) to authenticated;
grant execute on function public.admin_set_outlet_stock_exact(uuid,uuid,integer,text,uuid) to authenticated;
grant execute on function public.record_priced_outlet_delivery_batch(uuid,jsonb,uuid,text) to authenticated;
grant execute on function public.get_outlet_delivery_financials(uuid,integer) to authenticated;

commit;
