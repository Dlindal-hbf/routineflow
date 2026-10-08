# RoutineFlow Authentication Setup

## Architecture

Supabase Auth owns credentials, email confirmation and password recovery. RoutineFlow never stores passwords. Cookie-based browser/server clients use `@supabase/ssr`. Server pages and API handlers verify the user with Supabase; PostgreSQL independently requires a verified, nonanonymous, approved account on all nine business tables. Existing per-user ownership rules still apply, including to administrators.

`account_profiles` contains application approval status. `account_admins` contains protected administrator membership. Neither table accepts browser writes. The `review_account_request` database function rechecks administrator authorization and records reviewer/time. Metadata such as `role` or `is_admin` cannot grant privileges.

Registration creates a pending profile through an Auth database trigger, even if someone calls Supabase directly. Email verification does not approve the account. Rejection preserves the Auth user and business records and can be reconsidered later.

## Before Production Deployment

Do not reset your production database. Take a backup, inventory existing identities and test in a separate Supabase project first. Do not deploy this as a UI-only change: the database approval policies must be active before public registration is enabled.

The old application used anonymous Supabase accounts plus a local `admin123`/`staff123` UI prototype. Those codes no longer authenticate anyone. Existing records belong to the original Supabase UUID, not an email or prototype code. Creating a different account does not transfer those records.

Use `/account/upgrade` in the **same browser and origin** that holds an old session. The recovery button validates the old session through Supabase and moves it into cookie-based authentication without changing the UUID. Enter a name/email, verify the email, then set a password. Supabase requires verification before adding a password to an anonymous identity. Approve that same UUID. Enable **Allow manual linking** in Supabase Auth for this upgrade path. If the old session is lost, stop and arrange a reviewed ownership recovery; do not guess an owner or delete orphaned data.

Unscoped legacy localStorage data is retained. Automatic import runs only for the explicitly recovered legacy identity. Existing user-specific migration markers remain intact. Local storage is never an authorization source.

## Database Deployment

The existing baseline is [setup.sql](./supabase/setup.sql); do not rerun it as a production reset. Apply the additive files in [migrations](./supabase/migrations/) in order using a trusted database connection or Supabase SQL editor. Review each migration's deployment preflight first. On an existing project whose baseline was created manually, reconcile the migration history before `supabase db push`; do not blindly apply a duplicate baseline.

The identity preparation migration backfills profiles as pending without deleting users or business rows. The separate access-enforcement migration must be applied before the new public app goes live. Its legacy-owner preflight deliberately stops rollout if existing data owners would lose access. Upgrade and approve each existing owner first. An inaccessible/dormant identity requires an explicit ownership decision, not automatic approval or a bypass policy.

Apply [identity preparation](./supabase/migrations/20261005000000_approval_auth.sql), [approval enforcement](./supabase/migrations/20261005001000_enforce_approval.sql), [notification leases](./supabase/migrations/20261005002000_notification_leases.sql), and [account lifecycle hardening](./supabase/migrations/20261008000000_admin_lifecycle.sql), in that order. Pause between preparation and enforcement when the legacy-owner preflight requires it. Restrict the upgrade deployment to existing users during this window; the baseline policies alone are not the final security model.

Never remove the restrictive `application_approval_required` policies to fix an access issue. A pending user seeing no business rows is a security result, not evidence that data was deleted.

## First Administrator

Register or upgrade your own account, verify its email, then find its UUID under Supabase **Authentication > Users**. Do not use an anonymous UUID without completing the upgrade. Run the trusted one-time bootstrap script instead of using a public application endpoint:

```sql
BOOTSTRAP_ADMIN_USER_ID=the-exact-auth-users-UUID \
BOOTSTRAP_ADMIN_EMAIL=the-verified-email \
npm run bootstrap:first-admin
```

Run it only from a trusted machine with `SUPABASE_SERVICE_ROLE_KEY` loaded and never expose that key to the browser or commit it. The script verifies that the UUID and email identify the same confirmed, non-anonymous user, upserts the existing profile, and adds that exact UUID to `account_admins`. It is safe to rerun for the same account and does not promote arbitrary registrations. Later approvals are handled through the website; do not revoke the last active administrator without first appointing another.

## Environment Variables

Use `.env.local` for local development and **Vercel > Project > Settings > Environment Variables** for deployment. Never commit values. Existing public Supabase variable names are preserved.

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
APP_URL=https://your-routineflow-domain.example
SUPABASE_SERVICE_ROLE_KEY=
ADMIN_APPROVAL_EMAIL=
EMAIL_PROVIDER_API_KEY=
EMAIL_FROM=
CRON_SECRET=
```

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`: project URL and public anon/publishable key. These are intentionally browser-visible; RLS is essential.
- `APP_URL`: canonical HTTPS origin, without a path. Local testing permits `http://localhost:3100`. Redirect destinations never come from submitted form values.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only, used only by the notification worker. Page access, signup, login and approval use the user's client and database authorization, not this privileged key.
- `ADMIN_APPROVAL_EMAIL`: the dedicated receiving mailbox or alias you choose. No personal address is embedded in code.
- `EMAIL_PROVIDER_API_KEY`: Resend sending key, preferably restricted to the verified sending domain.
- `EMAIL_FROM`: a verified sender such as `RoutineFlow <notifications@your-domain.example>`.
- `CRON_SECRET`: a long, random secret for the notification retry endpoint. Vercel sends it in the Authorization header. Never use a public variable prefix.

Set production and preview values separately. Preview deployments should use a separate test Supabase project and test recipients, never production user records. Redeploy after changing variables. Install Node.js 22.18+ with npm on your machine and select Node.js 22 in Vercel; validation tests require Node's TypeScript stripping support. The temporary runtime used during implementation is not a permanent Node installation.

## Supabase Dashboard Settings

1. Enable the Email provider and email/password signup. Enable **Confirm email**. Set the minimum password length to at least 12. Retain secure email change behavior.
2. Disable new anonymous sign-ins. Existing anonymous identities are not deleted; retain them for the staged upgrade. Enable **Allow manual linking** while converting those identities.
3. Under URL Configuration, set **Site URL** to the same origin as `APP_URL`.
4. Add exact redirect URLs: `https://your-domain.example/auth/confirm` and `https://your-domain.example/auth/confirm?next=/reset-password`. For local tests add their `http://localhost:3100` equivalents. Avoid broad production wildcard redirects.
5. Configure custom SMTP for Supabase authentication mail, with a verified sender. Supabase's default mail service is unsuitable for general production registration. This SMTP setup is separate from the application's Resend API configuration.
6. Review Auth rate limits and password security settings. Apply per-IP Vercel Firewall rules to login/registration/recovery routes for your traffic profile. Do not enable a CAPTCHA requirement without wiring its challenge/token into the forms.

### Email Templates

Use token-hash links so confirmation can work in another browser without depending on the initiating browser's PKCE verifier. In Supabase **Authentication > Email Templates**, use these link targets, retaining your preferred email content:

**Confirm signup**
```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup">Bekreft e-postadressen</a>
```

**Reset password**
```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery">Velg nytt passord</a>
```

**Change email address** (also used for the anonymous-account upgrade)
```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email_change">Bekreft e-postadressen</a>
```

The change-email callback opens the password-setting screen. Signup opens account status. Recovery opens password reset, then signs the user out after success. Expired/invalid links return a neutral error. `/verify-email` resends signup confirmation without revealing whether an address exists. The callback also supports standard Supabase PKCE `code` redirects, but token-hash templates are recommended for cross-browser use. Do not enable click tracking on authentication links.

## Dedicated Mailbox And Sending Provider

Create a real mailbox or alias with your existing mail host for account approvals. Restrict access to the administrators who should see applicants' names/emails. Receiving mail is the mailbox provider's responsibility; Resend is the outbound notification provider. Configure the mailbox host's MX records separately from Resend's sending records.

Create a Resend account, add your sending domain or subdomain, and copy the exact DNS records from its dashboard. Typically this includes DKIM TXT records and SPF/return-path records; publish the requested MX record for the sending return-path subdomain where applicable. Add DMARC appropriate to your domain's mail policy. Do not create multiple SPF TXT records on the same hostname; merge requirements with your mail administrator. Verify the domain before setting `EMAIL_FROM`.

Resend is used for its small HTTP API and idempotent delivery support. The provider-specific adapter is [provider.ts](./src/email/provider.ts); it can be replaced without changing auth or approval logic. Applicants' names are sent as plain text, not interpolated HTML. Emails contain only an authenticated review link, never approve/reject tokens.

The durable outbox captures registrations even when the provider is down or signup bypasses the app UI. App registration/callbacks attempt immediate delivery after the response. [vercel.json](./vercel.json) schedules a daily fallback at 08:00 UTC, compatible with low-frequency cron plans. Configure a more frequent schedule on a plan that supports it if delayed retries are unacceptable. A cron call claims up to five items; increase frequency for higher volume. Direct-to-Supabase registrations may wait for this worker.

Monitor unsent rows and `attempts`/`last_error` in `account_notification_outbox` using trusted SQL or monitoring. Claims use leases to avoid concurrent workers sending the same item. Delivery is at least once, with provider idempotency reducing duplicates; an extended outage after a provider accepted a message but before a receipt was saved can still produce a duplicate. Do not delete sent rows casually because they deduplicate registrations. A notification failure never approves or loses a request; administrators can always review the queue at `/admin/users`.

Approval emails to applicants are not currently sent. They can check account status and sign in after approval.

## Local Verification

```sh
npm ci
npm run lint
npm run typecheck
npm run test:auth
npm run build
npm run dev -- --port 3100
npx playwright install chromium
npm run test:browser
```

For the optional real local Supabase lifecycle test, start the local stack with the documented templates, use `APP_URL=http://localhost:3100`, ensure the Supabase CLI is on PATH, and run `AUTH_INTEGRATION=1 npm run test:browser -- tests/browser/lifecycle.spec.ts`. It refuses a nonlocal Supabase URL, creates unique test accounts, follows captured verification/recovery emails, and deletes its own accounts afterwards. It never sends mail through a real provider.

Database tests execute PostgreSQL policies in an isolated PGlite runtime. They model Supabase roles/identity functions and run the real migration SQL; they do not replace an actual Supabase Auth delivery test. The rollback-based [SQL tests](./supabase/migrations/tests/approval_auth.sql) can also run against a disposable local Supabase instance. Never run test fixtures or database resets against production.

For acceptance testing, use a dedicated staging project and mailboxes you control:

1. Register, verify the confirmation message, and check the pending page. Check the admin notification and pending request list.
2. With the pending user's real access token, query each business table through Supabase REST: no business rows should be returned and inserts should be denied. Confirm `/`, `/admin/users`, and protected APIs cannot bypass the approval check.
3. Approve from the administrator screen. Sign in as that user and confirm their own routines load. Verify another user's business data remains inaccessible.
4. Reject a second verified test account. Confirm business access is denied, then reapprove it to test reconsideration.
5. As an ordinary approved user, attempt the review RPC and profile/admin-table writes directly. All privilege-changing attempts must fail.
6. Request a password reset, follow the email, set a new password, and sign in again. Also test expired/reused links and wrong credentials.
7. Disable the mail provider temporarily in staging, register, then restore it and invoke the protected retry worker. Confirm the request remains pending throughout and mail is eventually delivered.
8. Test an existing anonymous identity upgrade before production enforcement. Its UUID and business row counts must stay unchanged.

Password-manager support uses ordinary HTML forms, names, labels and autocomplete attributes; there is no password vault or custom storage. Browser layout tests inspect these attributes, but real Apple Passwords/1Password/Bitwarden extension behavior should also be checked on your devices.

## Reference Documentation

- [Supabase SSR clients](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
- [Supabase password authentication](https://supabase.com/docs/guides/auth/passwords)
- [Anonymous identity upgrades](https://supabase.com/docs/guides/auth/auth-anonymous)
- [Resend domain verification](https://resend.com/docs/dashboard/domains/introduction)
- [Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys)

## Change Inventory

New authentication UI is in [components/auth](./components/auth/); server validation, authentication and authorization are in [src/auth](./src/auth/). [src/email](./src/email/) holds the server-only notification worker and interchangeable provider adapter.

New pages: [login](./app/(auth)/login/page.tsx), [registration](./app/(auth)/register/page.tsx), [forgot password](./app/(auth)/forgot-password/page.tsx), [reset password](./app/(auth)/reset-password/page.tsx), [resend verification](./app/(auth)/verify-email/page.tsx), [status](./app/account/status/page.tsx), [legacy upgrade](./app/account/upgrade/page.tsx), and [admin users](./app/admin/users/page.tsx). New handlers: [confirmation callback](./app/auth/confirm/route.ts), [access check](./app/api/account/access/route.ts), and [notification retry](./app/api/internal/approval-notifications/route.ts). Shared additions include [auth layout](./app/(auth)/layout.tsx), [error page](./app/error.tsx), [proxy](./proxy.ts), [cron configuration](./vercel.json), and [browser test configuration](./playwright.config.ts).

The existing app was moved into [RoutineFlowApp](./components/RoutineFlowApp.tsx), removing its prototype login. [The root page](./app/page.tsx) now verifies access server-side. Modified integration files: [root layout](./app/layout.tsx), [reset API](./app/api/process-resets/route.ts), [browser Supabase client](./src/lib/supabaseClient.ts), [session hook](./src/hooks/useSupabaseSession.ts), [legacy import](./src/services/localMigrationService.ts), [Next configuration](./next.config.ts), [package manifest](./package.json), and [lockfile](./package-lock.json). Next.js was updated within version 16 for security fixes.

Database additions are the three migrations listed above and [rollback security tests](./supabase/migrations/tests/approval_auth.sql). [Baseline setup notes](./supabase/setup.sql) and [local Supabase configuration](./supabase/config.toml) were updated, with new [email templates](./supabase/templates/). Additional tests are in [tests/auth](./tests/auth/) and [tests/browser](./tests/browser/). Next.js automatically appended its framework guidance to [AGENTS.md](./AGENTS.md).
