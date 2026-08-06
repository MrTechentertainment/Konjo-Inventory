# KONJO Inventory Management System

Mobile-first Next.js 14 PWA for KONJO Foods factory inventory and outlet operations. It uses Supabase Auth, PostgreSQL Row Level Security, immutable ledgers, optimistic mobile stock updates, Framer Motion micro-interactions, and the supplied official logo.

## Implemented access model

| Role | Landing page | Access |
| --- | --- | --- |
| `SUPER_ADMIN` | Factory dashboard | Everything, including role management. Reserved permanently for `Natanim`. |
| `ADMIN` | Factory dashboard | Factory stock control, audit ledger, all outlets, outlet operations tracker. No role management. |
| `BASIC` | Outlets portal | Outlet selection, supermarket delivery entry, bazaar/event/gift/sample stock and quick deductions. No factory dashboard or admin feed. |

UI guards improve navigation, but security does not depend on them. `sql/update_schema.sql` enforces the same permissions through RLS and security-definer RPC functions. The database rejects attempts to demote, rename, or delete `Natanim`.

## First-time setup

1. Create a Supabase project.
2. For a new database, run all of `sql/schema.sql` in the Supabase SQL Editor.
3. Run all of `sql/update_schema.sql`. It creates authentication profiles, outlet tables, policies, RPC functions, default outlets, and the initial `Natanim` account.
4. Run all of `sql/accounting_upgrade.sql` to install pricing/tax versions, duplicate exceptions, timestamped delivery/order ledgers, analytics, exports and account profiles.
5. In **Authentication → Providers → Email**, enable Email/Password and turn **Confirm email** off. The application uses internal username aliases such as `username@konjo.internal`; those addresses cannot receive confirmation messages.
6. Copy `.env.local.example` to `.env.local` and add all three environment values.
7. Install and run:

```bash
npm install
npm run dev
```

Initial Root Owner sign-in:

```text
Username: Natanim
Password: N4321
```

`N4321` is intentionally only the requested initial password. It is short and publicly known in source code, so rotate it in Supabase Authentication before real operational use. Changing the Auth password does not change the immutable Root Owner role.

## Outlet behavior

- The universal conversion lives in `lib/outlets.ts`: **1 pack = 15 bottles**. Both supermarket deliveries and all field initial-stock forms import this single constant, so present and future products use the same ratio.
- Bazaar, gift and sample pages accept packs for initial stock, persist bottle deltas, and provide large `-1 bottle` tap targets. Activation Events redirects to the external KONJO Tally portal.
- `create_delivery` atomically reduces factory stock, increases outlet stock and snapshots price/tax lines. Repeated deliveries always append separate batches.
- Admin tracker data is live-refreshed from Supabase Realtime and its detailed activity feed is exposed only through an admin-checked RPC.

## Performance work

- Audit, add-product, batch-adjust, supermarket-delivery, and role-management interfaces are code-split or mounted only when open.
- Expensive drawers and modal components use `React.memo`.
- Factory fetching is disabled entirely for Basic users.
- Product cards are memoized and Framer Motion grid animation uses position-only layout work.
- Mobile lists use `content-visibility`, touch manipulation, reduced blur, and the existing reduced-motion preference.
- Google font build-time downloads were removed in favor of a tuned system font stack, improving cold-load reliability on constrained Ethiopian mobile connections.

## Deployment

Deploy to any Next.js 14 host and set these environment variables:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

Never expose the service-role key in browser code or a `NEXT_PUBLIC_*` variable. It is used only by the protected temporary-password server route.

## Validation

The delivered source passes `tsc --noEmit`, ESLint and a Next.js production build.

## Main files

```text
app/page.tsx                         Factory dashboard and role redirect
app/outlets/page.tsx                 Outlet portal
app/outlets/[outletId]/page.tsx      Location workspace
app/outlets/tracker/page.tsx         Admin oversight feed
app/outlets/category/[type]/page.tsx Category CRUD and duplicate workflow
app/admin/prices/page.tsx            Master price and tax versions
app/admin/users/page.tsx             Root-only full-screen role management
app/analytics/page.tsx               Restricted financial analytics and export
components/LoginGate.tsx             Password sign-in and Basic registration
components/Header.tsx                Logo, identity badge and menu
components/HamburgerMenu.tsx         Role-aware navigation
components/OutletFormModal.tsx       Duplicate conflict and exception flow
components/ProductEditModal.tsx      Admin-only catalog metadata editor
components/BazaarSalesTracker.tsx    Pack entry and optimistic -1 taps
components/SupermarketDeliveryModal.tsx Multi-product pack delivery
lib/AuthContext.tsx                  Supabase Auth session/profile state
lib/useOutletInventory.ts            Realtime outlet data and optimistic RPC
sql/update_schema.sql                Complete security/outlet migration
sql/accounting_upgrade.sql           Accounting, pricing, analytics and export migration
IMPLEMENTATION_GUIDE.md              Architecture, RBAC and deployment guide
TECHNICAL_FALLBACK_REPORT.md         Manual deployment contingencies
```
