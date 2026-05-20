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

## Slice 4 Template Builder Decisions

- Store template builder output in existing template tables: `import_templates`, `import_template_versions`, `sheet_mappings`, `field_mappings`, and `transformation_rules`.
- Add focused metadata columns for file type, source sample, sheet ignore flags, source column indexes, default values, and template/source linkage rather than creating duplicate template tables.
- Keep target field definitions centralized in `lib/templates/target-fields.ts` as a temporary typed bridge until a database-backed target-field catalog is justified.
- Inspect source files server-side from Supabase Storage and send only limited previews to the browser.
- Save edits by creating new `import_template_versions`; never overwrite historical versions in place.
- Require account structure selection for trial balance templates.
- Save transformations as configuration only; do not apply transformations to imported financial rows in Slice 4.
- Keep budget import and AI commentary inactive.

## Slice 5 Trial Balance Preview Decisions

- Store preview output in separate non-posted tables: `import_preview_runs`, `import_preview_rows`, and `import_preview_issues`.
- Generate preview from the preserved raw source file and the selected `trial_balance` template version; never require a second upload.
- Apply saved field mappings and transformation rules for preview only.
- Load account structure and segment definitions from the database for account parsing; do not hardcode City account segments in application logic.
- Preserve leading zeros by treating account numbers and segment codes as text.
- Update import batches to `previewed` only after successful preview generation; never mark them validated, posted, included, or active for reporting in Slice 5.
- Keep preview issues separate from formal validation results.
- Continue excluding budget import, budget-to-actual reporting, dashboards, reports, and AI commentary.

## Slice 6 Mapping Import Decisions

- One mapping import updates one mapping/reference table only.
- Excel mapping imports use exactly one selected active sheet from the saved template version; multi-sheet mapping packages are not supported.
- Store mapping import preview/review data in `mapping_import_runs`, `mapping_import_rows`, and `mapping_import_issues` instead of reusing trial-balance-specific preview tables.
- Preserve mapping codes as text so leading zeros are not lost.
- Require review before commit; changed mappings are summarized before the user commits accepted rows.
- Create a `mapping_versions` record for each committed mapping import.
- Insert new effective-dated mapping rows for committed imports and preserve prior rows/history.
- Keep mapping rows compatible with future manual maintenance through source method, source file, import batch, template version, and change reason metadata.
- Continue excluding trial balance posting, dashboards, reports, budget import, and AI commentary.

## Slice 7 Validation Decisions

- Validate trial balance imports from `import_preview_rows`; do not bypass preview by validating raw uploads directly.
- Store validation history in `validation_runs` and keep prior runs by marking older completed runs superseded.
- Store row-level validation exceptions in `import_exceptions` with source row, source column, target field, raw value, transformed value, severity, message, suggested fix, and resolution status.
- Link validation runs to committed `mapping_versions` through `validation_run_mapping_versions` where mappings provide version IDs.
- Use `critical_error`, `warning`, and `information` as Slice 7 validation severities while keeping legacy exception severity values allowed for earlier data.
- Keep warning acknowledgement separate in `warning_acknowledgements`; critical errors cannot be acknowledged into posting eligibility.
- Use an isolated MVP sign convention for validation formula checks so Slice 9 can replace it with configurable calculation rules later.
- Update import batches to validation statuses only: `validation_failed`, `validated_with_warnings`, or `validated`.
- Continue excluding posting, active reporting rows, replacement execution, calculations, dashboards, reports, budget import, and AI commentary.

## Slice 8 Posting and Data Review Decisions

- Post only `trial_balance` import batches with a completed eligible validation run.
- Consume validated preview rows for posting; do not reread raw files or reinterpret templates during posting.
- Store posting history in `posting_runs` and link posting runs to mapping versions where available.
- Write active reporting data to `trial_balance_lines` and generic segment rows to `trial_balance_line_segments`.
- Preserve lineage to source file, import batch, template version, account structure, validation run, posting run, and mapping versions.
- Set `is_active_for_reporting = true` only after posting succeeds.
- Block normal posting when another active posted import exists for the same organization, fiscal year, and period.
- Use replacement requests and approval to supersede old active period data without physically deleting old rows or files.
- Use reactivation requests and approval with conflict checks before making inactive/superseded imports active again.
- Exclude inactive and superseded imports from default active views while keeping them visible through review filters.
- Continue excluding calculations, dashboards, reports, budget import, and AI commentary.
