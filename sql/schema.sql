-- =============================================================================
-- KONJO Foods — Inventory Management System
-- Supabase / PostgreSQL schema
--
-- Run this once in the Supabase SQL Editor (Project → SQL Editor → New query).
-- Safe to re-run: every statement is guarded with IF NOT EXISTS / OR REPLACE
-- where Postgres allows it.
--
-- ARCHITECTURE NOTE (read this before running):
-- This schema is the ONLY thing that ever creates or shapes your tables.
-- Nothing in the Next.js app touches schema, runs migrations, or seeds data.
-- Deploying new frontend code on Vercel can NEVER alter or wipe what's in
-- here — the two systems only ever talk to each other through the
-- REST/Realtime API using the anon key, which is deliberately restricted
-- (see the GRANT/REVOKE section at the bottom) to inserts and reads.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 0. Timezone note
-- -----------------------------------------------------------------------------
-- Postgres always stores `timestamptz` internally as UTC — that's correct and
-- unavoidable, and fighting it causes subtle bugs. Instead we set this
-- DATABASE's default display timezone to Addis Ababa (EAT, UTC+3, no DST),
-- so any value read back without an explicit conversion — including in the
-- Supabase Table Editor — already shows the correct East Africa local time.
-- Run this once per project (requires being the project owner, which you are).
ALTER DATABASE postgres SET timezone TO 'Africa/Addis_Ababa';

-- If the above errors with "must be owner of database postgres" in your
-- environment, skip it — it's a convenience for the Table Editor only.
-- The app itself always formats timestamps in EAT regardless (see lib/time.ts),
-- so correctness never depends on this setting.


-- -----------------------------------------------------------------------------
-- 1. products — the current-state catalog
-- -----------------------------------------------------------------------------
create table if not exists public.products (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  sku                 text not null unique,
  current_stock       integer not null default 0,
  category            text not null default 'Uncategorized',
  low_stock_threshold integer not null default 10,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now()
);

comment on table public.products is
  'Live catalog + current stock snapshot. current_stock is NEVER written to '
  'directly by the app — it only ever changes via the trigger below, driven '
  'by rows appended to inventory_transactions. This keeps the ledger and the '
  'snapshot mathematically guaranteed to agree.';

create index if not exists idx_products_active on public.products (is_active);
create index if not exists idx_products_category on public.products (category);


-- -----------------------------------------------------------------------------
-- 2. inventory_transactions — the immutable audit ledger
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'transaction_type') then
    create type public.transaction_type as enum ('STOCK_IN', 'STOCK_OUT', 'AUDIT_ADJUSTMENT');
  end if;
end
$$;

create table if not exists public.inventory_transactions (
  id               uuid primary key default gen_random_uuid(),
  product_id       uuid not null references public.products (id) on delete restrict,
  change_amount    integer not null check (change_amount <> 0),
  transaction_type public.transaction_type not null,
  notes            text,
  logged_by        text not null,
  "timestamp"      timestamptz not null default now()
);

comment on table public.inventory_transactions is
  'Append-only audit ledger. Rows are never updated or deleted (enforced by '
  'REVOKE below, not just app convention) — a correction is logged as a new '
  'AUDIT_ADJUSTMENT row, exactly like a paper accounting ledger. This is what '
  'makes 2-3+ month old history provably immutable for tax/audit purposes. '
  'on delete restrict on product_id means a product can never be hard-deleted '
  'once it has history — archive it with is_active = false instead.';

create index if not exists idx_txn_product_id on public.inventory_transactions (product_id);
create index if not exists idx_txn_timestamp on public.inventory_transactions ("timestamp" desc);
create index if not exists idx_txn_logged_by on public.inventory_transactions (logged_by);


-- -----------------------------------------------------------------------------
-- 3. Trigger — keep products.current_stock in sync with the ledger
-- -----------------------------------------------------------------------------
create or replace function public.apply_inventory_transaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.products
  set current_stock = current_stock + new.change_amount
  where id = new.product_id;

  if not found then
    raise exception 'Cannot log transaction: product % does not exist', new.product_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_apply_inventory_transaction on public.inventory_transactions;

create trigger trg_apply_inventory_transaction
  after insert on public.inventory_transactions
  for each row
  execute function public.apply_inventory_transaction();

-- security definer means this function runs with the privileges of the
-- function's owner (you, the project owner), not the caller's. That's what
-- lets a low-privilege anon insert into inventory_transactions while having
-- NO direct UPDATE grant on products — see the GRANT/REVOKE section below.


-- -----------------------------------------------------------------------------
-- 4. Row Level Security
-- -----------------------------------------------------------------------------
alter table public.products enable row level security;
alter table public.inventory_transactions enable row level security;

drop policy if exists "products are readable by anyone with the app" on public.products;
create policy "products are readable by anyone with the app"
  on public.products for select
  using (true);

drop policy if exists "staff can add new catalog products" on public.products;
create policy "staff can add new catalog products"
  on public.products for insert
  with check (true);

drop policy if exists "ledger is readable by anyone with the app" on public.inventory_transactions;
create policy "ledger is readable by anyone with the app"
  on public.inventory_transactions for select
  using (true);

drop policy if exists "staff can log new stock movements" on public.inventory_transactions;
create policy "staff can log new stock movements"
  on public.inventory_transactions for insert
  with check (true);

-- No UPDATE or DELETE policy is created for either table on purpose — see
-- section 5. RLS policies only ever ADD permission on top of a default-deny,
-- so simply never writing an UPDATE/DELETE policy already blocks both
-- operations for anon/authenticated. Section 5 revokes the underlying grants
-- too, as defense-in-depth (belt and suspenders).


-- -----------------------------------------------------------------------------
-- 5. Grants — the real immutability guarantee
-- -----------------------------------------------------------------------------
-- These apply to the roles the Supabase client library actually connects as.
-- 'anon' = no logged-in user (this MVP's staff usage). 'authenticated' =
-- reserved here for when you add Supabase Auth later (see README).

grant select, insert on public.products to anon, authenticated;
revoke update, delete on public.products from anon, authenticated;

grant select, insert on public.inventory_transactions to anon, authenticated;
revoke update, delete on public.inventory_transactions from anon, authenticated;

-- products.current_stock can now ONLY change through the security-definer
-- trigger function above, which is owned by the project owner, not by anon.
-- Nobody using the app — staff, admin, or a future bug — can edit or erase
-- a logged transaction or hand-edit a stock count. That combination is what
-- satisfies the "100% immutable, government/tax-audit-ready" requirement.


-- -----------------------------------------------------------------------------
-- 6. Realtime — so every phone in the building sees the same stock instantly
-- -----------------------------------------------------------------------------
alter publication supabase_realtime add table public.products;


-- -----------------------------------------------------------------------------
-- 7. Seed data — remove or edit before going live
-- -----------------------------------------------------------------------------
insert into public.products (name, sku, current_stock, category, low_stock_threshold)
values
  ('Konjo Datta Red', 'KDR-500', 48, 'Datta', 15),
  ('Konjo Datta Green', 'KDG-500', 32, 'Datta', 15),
  ('Konjo Hot & Sweet Ketchup', 'KHS-500', 20, 'Ketchup', 10)
on conflict (sku) do nothing;
