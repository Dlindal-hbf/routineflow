# RoutineFlow Agent Notes

## Project Shape
- Next.js 16 app using the `app/` router, React 19, TypeScript, Tailwind CSS, shadcn-style UI primitives, Framer Motion, Lucide icons, and Supabase.
- The primary application surface is currently concentrated in `app/page.tsx`. Components live in `components/`, reusable UI primitives live in `components/ui/`, shared browser/server logic lives in `lib/`, and Supabase/data services live in `src/services/`.
- Supabase client setup is in `src/lib/supabaseClient.ts`; session bootstrapping is in `src/hooks/useSupabaseSession.ts`; schema and RLS setup are in `supabase/setup.sql`.
- The app uses anonymous Supabase auth today. Treat that as a real identity layer because all persisted business data is scoped by `user_id`.
- The app still carries legacy localStorage migration paths. Preserve data when changing storage behavior.

## Commands
- `npm run lint` runs ESLint.
- `npm run build` runs the production Next build.
- `npm run dev` starts the local Next dev server.
- If `git` fails with an Xcode developer tools error on this machine, continue without git metadata and do not assume the working tree is clean.

## Current Reliability Priorities
The requested direction is a detailed, reliable overhaul of core systems, especially:

1. Sign-in and session handling
   - Keep Supabase configuration validation explicit and user-facing enough to diagnose missing or invalid env vars.
   - Avoid duplicate anonymous sign-ins. Reuse the existing `ensureSupabaseSessionState()` flow unless intentionally replacing it.
   - Plan for upgrade paths from anonymous users to durable user accounts before making schema or cache changes.
   - Always consider auth state transitions, refresh failures, unreachable Supabase URLs, and session persistence.

2. Data storage and sync
   - Preserve the `user_id` isolation contract enforced by RLS in `supabase/setup.sql`.
   - Be careful with full-table replacement saves such as delete-then-insert service methods. They are simple but can lose data if writes race or fail midway.
   - Prefer upserts, transactional RPCs, or narrower mutations for new storage work when practical.
   - Keep local migration idempotent. Existing migration markers are user-scoped; do not remove or rename them casually.
   - Update client caches immediately for responsive UX, but also handle failed writes by surfacing errors and avoiding silently stale state.

3. Style and UX
   - The app is an operational tool. Favor dense, scannable, predictable workflows over marketing-like presentation.
   - Use existing UI primitives from `components/ui/` and visual helpers from `lib/colors.ts` before adding new style systems.
   - Keep cards for repeated items, dialogs, and framed tool surfaces. Avoid nesting cards inside cards.
   - Use Lucide icons for icon buttons and make actions visually obvious without instructional copy inside the app.
   - Maintain responsive constraints so compact controls, list items, and dialogs do not resize or overlap with dynamic text.

## Implementation Guardrails
- Read the relevant service and component before changing it; this app has several mirrored data shapes between legacy local data and Supabase rows.
- Keep changes scoped. Avoid broad refactors of `app/page.tsx` unless the task is specifically about decomposing the page.
- When touching persisted types, check both the TypeScript type and the Supabase schema.
- When touching a service save path, check associated cache keys in `src/services/clientCache.ts`.
- When adding a new table or changing RLS, update `supabase/setup.sql` in the same change.
- For user-visible errors, prefer concise Norwegian copy where the surrounding UI is Norwegian.
- Do not remove localStorage migration code until there is an explicit product decision that old browser data no longer matters.

## Useful File Map
- `app/page.tsx`: main client app, view state, loading flows, task lists, inventory, compensation, and background sync wiring.
- `app/globals.css`: Tailwind imports, theme tokens, legacy utilities, and global component classes.
- `src/lib/supabaseClient.ts`: Supabase env validation and singleton client creation.
- `src/hooks/useSupabaseSession.ts`: anonymous auth bootstrap, shared session state, and auth change subscription.
- `src/services/serviceUtils.ts`: shared user-id requirement and JSON helpers.
- `src/services/clientCache.ts`: in-memory cache and revalidation coordination.
- `src/services/localMigrationService.ts`: one-time localStorage-to-Supabase migration.
- `src/services/backgroundSync.ts`: global pending/error status for background writes.
- `src/services/taskService.ts`: task list, task history, reset processing, and task storage conversion.
- `src/services/inventoryService.ts`: inventory current state and snapshots.
- `src/services/customerInteractionService.ts`: customer/compensation interaction persistence.
- `supabase/setup.sql`: schema, triggers, indexes, and RLS policies.

## Testing Expectations
- Run `npm run lint` after TypeScript or React changes.
- Run `npm run build` for changes that affect routing, Supabase imports, env handling, or broad app structure.
- For storage changes, manually inspect the service read/write path and verify cache updates, remote errors, and empty-state behavior.
- For UX changes, check both narrow mobile and desktop widths. Pay special attention to dialogs, headers, action rows, and long Norwegian labels.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
