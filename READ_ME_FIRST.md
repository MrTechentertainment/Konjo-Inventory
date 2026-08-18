# KONJO IMS — Final Verified Website Package

Verified on 2026-08-11 for the completed fiscal-2019 Supabase database.

## Important

- The database migration and data reset are already complete.
- Do **not** run Part 4D, Part 5, `schema.sql`, `update_schema.sql`, or any older SQL file again.
- For this feature branch, run only the two additive migrations in `supabase/migrations/`, in filename order. The second migration creates the product-image bucket and Root Owner-only image controls.
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
- Root Owner pricing, tax, outlet, role, and import controls
- Official KONJO Foods logo

## Local validation already completed

- `npm ci`
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`

Follow the step-by-step instructions provided in the chat. Do not copy this folder into production until you have confirmed that you are working inside the existing KONJO Git repository.
