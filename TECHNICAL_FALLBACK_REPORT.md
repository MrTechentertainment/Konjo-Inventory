# Technical Fallback Report

## 1. Database migrations cannot be executed from the application

This is intentional: the browser key must not create tables, triggers, policies or privileged functions.

Manual resolution:

1. Back up the Supabase database.
2. Open Supabase **SQL Editor**.
3. Run `sql/schema.sql`, then `sql/update_schema.sql`, then `sql/accounting_upgrade.sql`.
4. Confirm the migration created `product_prices`, `delivery_batches`, `financial_ledger`, `delivery_status_events`, `stock_orders` and `stock_order_items`.
5. Confirm the `profile-pictures` Storage bucket exists.
6. Configure at least one current price for every active product before testing deliveries.

## 2. Temporary passwords require a protected server secret

Changing another Supabase Auth user's password cannot be done safely with the public browser key. The protected route therefore needs `SUPABASE_SERVICE_ROLE_KEY` in the deployment environment.

Manual resolution:

1. Obtain the service-role key from Supabase Project Settings → API.
2. Add `SUPABASE_SERVICE_ROLE_KEY` to the Next.js server/deployment environment.
3. Never add `NEXT_PUBLIC_` to this name and never commit the actual value.
4. Redeploy, then test **Temporary password** as Natanim.

If company policy forbids a service-role key on the application server, disable that route and perform password resets through Supabase Authentication Dashboard. The application cannot securely generate employee temporary passwords purely client-side.

## 3. Root profile editing is intentionally unavailable

The Account page hides Root editing and the database trigger rejects Root profile mutation. If an emergency Root password rotation is required:

1. Sign in to Supabase Dashboard with an authorized infrastructure account.
2. Open Authentication → Users → `natanim@konjo.internal`.
3. Change the password there.
4. Record the change in the company's credential register.

Do not weaken or remove the immutable Root role trigger to perform routine password changes.

## 4. Username-only accounts require email confirmation to be disabled

The UI maps usernames to internal aliases such as `employee@konjo.internal`; they cannot receive confirmation mail.

Manual resolution:

1. Open Supabase Authentication → Providers → Email.
2. Enable Email/Password.
3. Turn **Confirm email** off.

If verified company email is required, change the login/register form and `usernameEmail()` to collect real addresses; keep the profile trigger and RBAC policies.

## 5. Root seed compatibility

The bootstrap block creates the specifically requested `Natanim/N4321` Auth record. Supabase may change its private Auth schema.

If only that seed block fails:

1. Create `natanim@konjo.internal` manually in Authentication → Users with password `N4321` and auto-confirm enabled.
2. Copy its UUID.
3. Insert the matching `users_profiles` row as `SUPER_ADMIN` using the fallback SQL already documented in `sql/update_schema.sql` comments.
4. Re-run `sql/update_schema.sql`, then `sql/accounting_upgrade.sql`.

## 6. No live Supabase project was available during source validation

The source passes TypeScript, ESLint and the optimized Next.js build, but database policies and RPCs must still be integration-tested against the actual project.

Minimum staging checks:

- BASIC cannot open factory/pricing/analytics/user-management data.
- BASIC cannot mutate the product catalog even with a direct API request.
- BASIC can edit only outlets they created and cannot delete any outlet.
- Duplicate creation is blocked until a justification is supplied.
- Two same-day deliveries produce two batches and separate chronological lines.
- Historical exports remain unchanged after a price version update.
- A temporary password forces replacement at the next login.
- A delivery with insufficient factory stock rolls back every related row.
