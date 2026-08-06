# KONJO IMS Accounting & Scale Upgrade

## Database schema and security

Run the migrations in this exact order:

1. `sql/schema.sql`
2. `sql/update_schema.sql`
3. `sql/accounting_upgrade.sql`

The third migration adds the accounting model without rewriting the earlier factory and outlet ledgers.

### Core records

| Record | Purpose | Mutation policy |
| --- | --- | --- |
| `users_profiles` | Display name, picture, RBAC, forced-reset and analytics flags | Self-service through checked RPCs; Root profile locked |
| `outlets` | Ownership, normalized duplicate key, exception note and soft deletion | BASIC creates Supermarket/Bazaar and edits only their own; Admin can soft-delete |
| `product_prices` | Effective-dated bottle/pack before-tax and after-tax prices | Admin-only version creation; no client update/delete |
| `delivery_batches` | One header per press of Deliver, with occurrence and recording timestamps | Append; status changes through audited RPC |
| `financial_ledger` | Immutable delivery/sale line with price, tax and product snapshots | Append-only trigger; no update/delete grants |
| `stock_orders` / `stock_order_items` | “Bottles not delivered” requests and status pipeline | Authenticated request RPC; Admin status RPC |
| `delivery_status_events` | Every delivery status transition | Append-only trigger |

Money uses `numeric`, not floating point. A transaction copies product name, SKU, pricing version, tax rate, unit prices, taxable amount, tax and total. Later catalog or price edits cannot change historical reports.

`create_delivery` performs one database transaction: it validates every current price, locks and reduces factory stock, appends factory/outlet logs, increases outlet stock and writes all accounting lines. Failure of any line rolls back the entire batch.

### RBAC enforcement

Frontend role checks are for navigation only. Supabase enforces authorization independently:

- BASIC has no catalog mutation or finance-table grants.
- Product creation/edit/removal is available only through role-checking security-definer RPCs.
- BASIC outlet edits require `created_by = auth.uid()` in the RPC.
- Outlet removal is a soft delete and requires ADMIN/SUPER_ADMIN.
- Analytics requires Root or an ADMIN with `analytics_access = true`.
- Accounting export and employee listing require the immutable Root Owner.
- Root protection remains in the database trigger; the Account page also hides editing controls.
- Temporary passwords require a server-only service-role key and a fresh Root bearer token. The password is returned once and forces replacement at next login.

## Frontend components and routes

| Route/component | Responsibility |
| --- | --- |
| `/outlets` | Icon dashboard for Supermarkets, Bazaars, Activation Events, Gifts and Samples |
| `/outlets/category/[type]` | Dedicated category list, Add New, three-dot edit/delete actions |
| `OutletFormModal` | Duplicate lookup, conflict message, existing-location route and justified exception creation |
| `/outlets/[outletId]` | Stock, delivery/order actions, five-status pipeline and chronological line items |
| `SupermarketDeliveryModal` | Product `+/-` picker, Pack/Bottle unit, device datetime with manual correction |
| `BazaarSalesTracker` | 15-bottle pack entry and optimistic one-bottle sale actions |
| `/admin/prices` | Reconciled bottle/pack, before/after-tax, tax-rate versioning |
| `ProductEditModal` | Admin SKU, name, category, description and threshold edits |
| `/analytics` | Restricted monthly inventory, volume, pending/projected sales, revenue and tax KPIs |
| `/admin/users` | Basic/Admin tables, search, promote/demote, analytics assignment and forced reset |
| `/account` | Picture, display name and password for BASIC/ADMIN; locked notice for Root |

Activation Events navigates directly to `https://ktally.netlify.app`; there is no native event page.

## Spreadsheet export

Root uses **Export to Spreadsheet** on `/analytics`. The protected server route generates an `.xlsx` workbook with:

- `Summary`: branded KPI cards and metadata.
- `Transactions`: frozen headers, filters, typed dates/numbers, ETB formats, status styling and totals.
- `Factory Inventory`: complete catalog and stock snapshot.
- `Outlet Stock`: current stock by outlet and product.
- `Prices`: active price/tax versions.
- `Employees`: roles, analytics and reset state; never passwords.
- `Checks`: tax reconciliation, quantity and required-label controls.

The transaction sheet begins with the required fields: Date, Supermarket/Outlet Name, Product, Quantity Delivered, Status, Unit Price, Taxable Amount, Tax Paid and Total Revenue. Extra audit columns follow.

## Runtime configuration

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

`SUPABASE_SERVICE_ROLE_KEY` is server-only. It is used only by the temporary-password route and must never have a `NEXT_PUBLIC_` prefix.

## Production controls

- Back up the database before migration.
- Test pricing and VAT configuration on a staging project before accepting real sales.
- Configure a current price for every active product before field delivery/order entry.
- Reconcile the export `Checks` sheet before filing tax reports.
- Restrict deployment environment access because the service-role key bypasses RLS.
- Use `Natanim/N4321` only for bootstrap. Root editing is intentionally disabled in the app; rotate that password through Supabase Authentication under a controlled administrator procedure.
