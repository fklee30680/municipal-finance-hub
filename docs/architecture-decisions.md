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

## Slice 2 Setup Configuration Decisions

- Store fiscal calendar setup in organization-scoped configuration data through `organization_settings`.
- Keep organization display name user-configurable instead of relying on application constants.
- Keep current fiscal year, fiscal year start date, fiscal year end date, period 0, period 13, accrual reporting, and default report period mode configurable per organization.
- Default normal monthly reporting to `standard`, which excludes period 0 and period 13.
- Allow period 0 in the fiscal period table so later setup/import workflows can support opening or beginning-balance periods without a schema rewrite.
- Do not seed fixed fiscal years or fiscal periods until the user configures or imports them.
- Keep setup editing read-only in Slice 2; editable workflows should wait for settled auth, validation, and audit patterns.
- Continue excluding operational budget import, budget-to-actual reporting, and AI commentary.

## Slice 3 Raw Upload Decisions

- Use the private Supabase Storage bucket `source-files` for raw uploaded files.
- Store files under `organizations/{organization_id}/imports/{import_batch_id}/{safe_original_filename}`.
- Preserve the original filename in `source_files` while sanitizing only the storage path filename.
- Calculate SHA-256 hashes from raw file bytes for duplicate detection.
- Warn on duplicate hashes within the same organization but do not block or delete duplicates in Slice 3.
- Create import batches with `batch_status = uploaded`, `reporting_status = excluded`, and `is_active_for_reporting = false`.
- Use server-side upload handling with the service role key kept out of browser code because table RLS policies are not yet implemented.
- Do not parse, validate, post, calculate, dashboard, report, import budgets, or generate AI commentary in Slice 3.
