# Raw File Upload and Source Storage

Slice 3 adds the raw file intake workflow. This is the first import-facing workflow, but it intentionally stops before parsing, validation, posting, calculations, dashboards, reports, budget imports, or AI commentary.

## Scope

Users can upload supported source files from the Imports area. The application stores each file unchanged in the private Supabase Storage bucket:

```text
source-files
```

The upload also creates metadata in `source_files` and a shell record in `import_batches` with `batch_status = uploaded`, `reporting_status = excluded`, and `is_active_for_reporting = false`.

## Supported File Types

Slice 3 accepts:

- `.csv`
- `.xlsx`
- `.xls`

The size limit is 25 MB.

## Storage Path

Raw files use deterministic organization and batch-scoped paths:

```text
organizations/{organization_id}/imports/{import_batch_id}/{safe_original_filename}
```

The original filename is preserved in database metadata. The storage path uses a sanitized filename.

## Duplicate Detection

The upload action calculates a SHA-256 hash from the file bytes and checks for an existing `source_files` record in the same organization with the same hash.

Duplicates are not blocked in Slice 3. A duplicate warning is stored and displayed, but the upload is still preserved unless storage or metadata creation fails.

## Deferred Work

Slice 3 does not:

- Parse rows.
- Read Excel sheets.
- Map fields.
- Parse accounts.
- Validate financial content.
- Post imports.
- Write to `trial_balance_lines` or reference/mapping tables.
- Update dashboards or reports.
- Implement budget import or budget-to-actual reporting.
- Implement AI commentary.
