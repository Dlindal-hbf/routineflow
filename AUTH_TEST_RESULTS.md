# Authentication Verification

## Passed Locally

- ESLint, TypeScript checks, and the production Next.js build.
- Eight automated auth tests: input validation, real PostgreSQL RLS execution in PGlite, safe migration preflight, rejection/reapproval, protected admin roles, notification leases, and email-provider request/error handling.
- Five Playwright checks: desktop (1440px), tablet (768px), mobile (375px), form/autocomplete semantics, password visibility controls, server validation, anonymous route redirects and protected API denial.
- Real local Supabase lifecycle: registration, captured confirmation email, verification, pending status, admin review, approval, application access, rejection, captured recovery email, password update, login, reapproval, preserved business data and logout.
- Direct Supabase queries: pending users cannot read all nine business tables or insert business data; profile self-approval and review RPC calls are denied. Rejected users cannot read their existing data. Ordinary approved users cannot use the admin screen or admin review RPC.
- Screenshots inspected for login, registration, pending status and the admin list at desktop/mobile widths. No horizontal overflow in the checked views.
- Runtime dependency audit (`npm audit --omit=dev`): zero vulnerabilities after targeted Next.js and transitive dependency security updates.

The lifecycle test created unique local accounts and removed them afterwards. Only the local test database received migrations. No production database, deployment, mailbox or DNS records were changed.

## Findings Fixed

- Added the missing notification claim RPC and expiring leases; delivery previously could not claim its queued requests.
- Split approval enforcement from profile preparation, with a preflight that refuses to lock existing business-data owners out.
- Fixed the password-reset success redirect racing the reset page's unauthenticated guard.
- Included user identity in the periodic access check so an account switch in another tab cannot be mistaken for the original approved session.
- Corrected a Playwright selector to match the accessible label for the new-password visibility button.

## Still Requires Your Configuration

Real Resend delivery, sender-domain DNS, Supabase production SMTP/templates, and Vercel cron execution require the configuration in [AUTH_SETUP.md](./AUTH_SETUP.md). Provider calls were contract-tested with a mocked response; a real provider acceptance/delivery smoke test has not been performed. Actual third-party password-manager extensions have not been tested; standard form semantics and autocomplete attributes were verified.

Git status could not run because the machine's Xcode command-line tools are incomplete. Existing development-tool dependency advisories remain outside the targeted runtime security fixes; the runtime-only audit is clean. Production database ownership recovery for lost anonymous sessions remains an explicit operator decision, never an automatic migration.
