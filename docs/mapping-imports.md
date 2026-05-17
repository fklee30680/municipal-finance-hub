# Mapping and Reference Imports

Slice 6 adds one-mapping-type-at-a-time imports for:

- Fund mappings.
- Object mappings.
- ACFR mappings.
- Department mappings.
- Function mappings.

Each mapping import uses one uploaded raw source file from Supabase Storage and one saved template version. CSV files are processed as a single mapping import. Excel files use exactly one selected active sheet from the template version.

## No Multi-Sheet Package Imports

Multi-sheet mapping packages are intentionally out of scope. Excel sheet detection remains available so the user can select the correct sheet while building a template, but one committed mapping import updates one mapping/reference table only.

Object, ACFR, Department, Function, and Fund imports should be uploaded and reviewed as separate mapping imports.

## User Workflow

Reference imports use dedicated lanes under `/imports/reference`:

- `/imports/reference/funds`
- `/imports/reference/objects`
- `/imports/reference/acfr`
- `/imports/reference/departments`
- `/imports/reference/functions`

Each lane shows active reference row counts, the latest template, import history, and focused actions for upload, template configuration, review, bad-data export, and commit.

## Preview and Bad-Data Review

The mapping import review workflow stages data in:

- `mapping_import_runs`
- `mapping_import_rows`
- `mapping_import_issues`

Preview classifies rows as new, changed, unchanged, duplicate, conflict, warning, or rejected. Bad-data issues include row number, source column, target field, raw value, transformed value, severity, issue message, and suggested fix.

Bad source rows are not edited in the app. Users should fix the source file and reupload, or later use the future manual mapping maintenance workflow.

## Commit Behavior

Accepted rows can be committed after user confirmation. Rejected rows are excluded from commit and remain visible in the bad-data report.

Each commit creates a `mapping_versions` record and inserts accepted rows into the appropriate reference table. Prior mapping rows are preserved. Slice 6 uses effective-dated inserts and metadata rather than destructive deletion.

If source rows do not provide effective start dates, the user must provide a default effective start date before commit.

## Boundaries

Slice 6 does not post trial balance actuals, run the full validation engine, update dashboards, generate reports, import budgets, add AI commentary, or add manual mapping maintenance screens.
