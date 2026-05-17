# Database Schema

Slice 1 adds the first production-style Supabase/PostgreSQL schema migration:

```text
supabase/migrations/20260517000100_core_schema.sql
```

Slice 2 adds the setup configuration migration:

```text
supabase/migrations/20260517000200_setup_configuration.sql
```

Slice 3 adds raw upload storage support:

```text
supabase/migrations/20260517000300_raw_file_upload_storage.sql
```

Slice 4 adds template-builder support:

```text
supabase/migrations/20260517000400_template_builder_support.sql
```

## Migration Scope

The migration creates foundations for:

- Multi-organization readiness.
- Application users and roles separate from Supabase Auth internals.
- Fiscal years and fiscal periods.
- Configurable account structures and segment definitions.
- Versioned import templates and mapping metadata.
- Raw source file metadata.
- Import batches and import exceptions.
- Normalized trial balance actuals and parsed account segments.
- Effective-dated reference and mapping tables.
- Calculation run/result foundations.
- Monthly Finance Report template, instance, parameter, comment, export, import-batch, and mapping-version traceability.
- Audit logs.
- Two-step inactivation and reactivation request workflows.

## Seed Data

The migration seeds:

- Default Municipal Organization.
- Baseline roles.
- Import types for trial balance and core mapping imports.
- City Standard Account Structure.
- Five default account segment definitions: Fund, ACFR, Department, Function, Object.
- Initial mapping version records.
- Default calculation threshold shell.
- Monthly Finance Report template shell and version shell.

Slice 2 confirms or adds:

- Organization-scoped setup settings.
- Baseline setup defaults for a bootstrap organization.
- Baseline roles required by the setup foundation.
- Baseline import types for trial balance and core mapping imports.
- City Standard Account Structure and five account segment definitions as stored configuration.
- Monthly Finance Report template shell configuration.

Slice 3 adds:

- Private Supabase Storage bucket configuration for `source-files`.
- Fiscal year and period metadata on `source_files`.
- Duplicate source file linkage by SHA-256 hash.
- Indexes for source file hash and period lookup.

Slice 4 adds:

- Source file and file type linkage on template versions.
- Header/data-start defaults and sample payload storage for template versions.
- Sheet target entity and ignore-sheet configuration.
- Field source column indexes, default values, and ignore-column configuration.
- Indexes for template version/source and field/sheet mapping lookups.

Slice 5 adds:

- `import_preview_runs` for non-posted trial balance preview executions.
- `import_preview_rows` for mapped/transformed preview rows and parsed account segments.
- `import_preview_issues` for row-level parse issues.
- `previewed` as an import batch status for successful non-posted preview.
- Indexes for preview run, row, and issue lookup by organization, batch, run, and source row.

## Reporting Defaults

Standard reporting should use active, posted, included imports. The migration creates `public.active_trial_balance_lines` as the default view for active posted actuals. Inactive and superseded import batches are excluded from that view.

Slice 2 defaults report period mode to `standard`, which excludes optional period 0 and period 13 from normal monthly reporting.

## Setup Configuration

`organization_settings` stores the user-configurable organization display name, current fiscal year, fiscal year start and end dates, standard period count, optional period 0, optional period 13, accrual reporting, and default report period mode.

The migration permits fiscal period `0` so later setup or import workflows can support opening and beginning-balance periods. Slice 2 does not seed fixed fiscal years or fiscal periods.

## Raw Upload Storage

Slice 3 stores uploaded files in Supabase Storage instead of database rows. The database stores `source_files` metadata, SHA-256 hashes, fiscal year/period metadata when provided, and import batch shell records. Uploaded batches remain excluded from reporting and inactive for reporting until later validation and posting workflows exist.

## Template Builder

Slice 4 stores reusable file-layout instructions as versioned templates. The template tables hold sheet mappings, field mappings, and transformation rule configuration. Template versions can be linked back to a sample `source_files` record and to import batches through existing template version fields.

Creating or editing templates does not write to financial actuals or mapping/reference tables.

## Trial Balance Preview

Slice 5 preview records are separate from `trial_balance_lines`. They are linked to source files, import batches, template versions, and account structures for traceability, but they are not standard reporting data.

Preview can supersede prior preview runs for the same import batch without deleting raw files or import batches.

## Deferred

Slice 1 does not implement:

- Import processing.
- CSV or Excel parsing.
- Validation engine logic.
- Posting workflows.
- Financial calculations.
- Dashboard queries.
- Monthly Finance Report generation.
- Budget import or budget-to-actual reporting.
- AI commentary.
