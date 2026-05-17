# Architecture Decisions

- Use Next.js App Router and TypeScript.
- Use Supabase for PostgreSQL, Auth, and Storage.
- Use Supabase SQL migrations.
- Target Vercel for hosting.
- Preserve raw uploaded files.
- Use configurable imports and account structures.
- Do not hardcode file layouts.
- Do not physically delete imports in normal workflows.
- Exclude AI commentary through Slice 13.
- Exclude budget import and budget-to-actual through Slice 13.
- Respect governmental and proprietary fund reporting differences later.
- Keep the Slice 0 database layer to folder structure and placeholders only.
- Keep the app shell conservative and finance-oriented.
- Use a shadcn-compatible component organization with `components/`, `components/ui/`, and `lib/utils/`.

## Slice 1 Database Schema Decisions

- Use a timestamped Supabase SQL migration for the core schema: `supabase/migrations/20260517000100_core_schema.sql`.
- Use UUID primary keys with `gen_random_uuid()` for application tables.
- Keep `organization_id` on organization-scoped tables to support multi-organization readiness.
- Use `app_users` instead of `users` to avoid confusion with Supabase Auth internals.
- Keep `auth_user_id` nullable in `app_users` so Supabase Auth can be linked without forcing it during schema bootstrapping.
- Store account structures and segment definitions as data, not application logic.
- Store account, fund, ACFR, department, function, and object codes as text to preserve leading zeros.
- Preserve raw file metadata in `source_files`; raw uploaded files should remain unchanged in Supabase Storage.
- Treat import inactivation and reactivation as controlled workflows through request tables rather than normal deletion.
- Use `is_active_for_reporting`, `reporting_status`, and supersession fields so inactive or superseded imports can be excluded from standard reporting.
- Add `active_trial_balance_lines` as the default reporting view for active posted actuals.
- Create calculation and report foundation tables only; calculation logic and report generation are later slices.
- Seed only baseline roles, import types, the City standard account structure, account segments, a report template shell, and a threshold shell.
- Defer operational budget import and budget-to-actual tables until Phase 9.
- Defer AI commentary tables and workflows.
