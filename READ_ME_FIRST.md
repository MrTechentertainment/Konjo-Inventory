# KONJO IMS — Mobile Outlet, Access, and Rate-Limit Repair

Verified locally on 2026-08-27 against the completed fiscal-2019 website source.

## Important

- The historical database reset is already complete.
- Do **not** run Part 4D, Part 5, `schema.sql`, `update_schema.sql`, or any older SQL file again.
- Run the three additive files in `supabase/migrations/` in filename order. They are safe to re-run and do not reset historical data:
  1. `202608180001_outlet_admin_stock_pricing.sql`
  2. `202608180002_outlet_directory_product_images.sql`
  3. `202608270001_mobile_routes_pricing_roles_repair.sql`
- Then run `202609080001_rate_limits_and_secure_user_admin.sql` once. It adds targeted write throttles, server authentication throttles, and the password-reset audit table. It does not delete operational data.
- The first file creates the priced-delivery and outlet-admin functions currently reported missing by the API. All three files explicitly refresh the PostgREST schema cache.
- This package contains website source code only. It intentionally contains no database-reset SQL, audit workbook, `.env.local`, password, or private key.
- Keep the existing `.env.local` in your Git repository. Do not replace it with `.env.local.example`.

## Verified database target

- 13 products
- 90 outlet-location records
- 61 credit sales
- 54 orders
- 1 sample
- 23 historical inventory entries
- zero initial live factory stock
- Natanim Root Owner profile ready

## Included website features

- Factory inventory and exact-stock setting
- Credit Sales, Orders, Samples, and Inventory Ledger screens
- Editable DRAFT records
- CSV, XLSX, and text-based PDF imports with preview
- Standalone, category-scoped outlet pages and fuzzy search
- Mobile bottom-sheet outlet editing at the selected card
- Live bottle price, tax, and pack-size delivery calculations
- Root Owner user-management page with promote, demote, ban, and restore controls
- Tap-to-expand user actions and Root Owner-only password reset to `123456`
- Server-side login, registration, delivery, correction, pricing, outlet, import, and role rate limits
- Root Owner product-image and import controls
- Official KONJO Foods logo

## Local validation already completed

- `npm ci`
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`

Follow the step-by-step instructions provided in the chat. Do not copy this folder into production until you have confirmed that you are working inside the existing KONJO Git repository.

## Required Netlify environment variables

Keep the existing `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Add `SUPABASE_SERVICE_ROLE_KEY` as a server-only secret and add a long random `RATE_LIMIT_SECRET`. Never prefix the service-role key with `NEXT_PUBLIC_`.

In Supabase Authentication settings, set the minimum password length to 6 if it is currently higher. The website cannot override a stronger server-side Supabase password policy.
