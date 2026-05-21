# Import Workspace UX

The Import Workspace is the main user path for imports. It consolidates upload,
file layout, column mapping, preview, validation/review, and commit/post actions
without weakening the governed backend model.

The workspace follows the invoice-management pattern:

1. Select an import type.
2. Upload a file or resume a recent upload.
3. Select the header row and, for Excel, the relevant sheet.
4. Preview detected headers with column letters and column indexes.
5. Map source columns to required and optional target fields.
6. Enter manual mapping overrides by header name, column letter, or column
   number when detection is not clean.
7. Generate preview/review.
8. Validate trial balance imports or review mapping-import bad data.
9. Commit accepted mappings or post validated trial balance data when eligible.

The workspace intentionally keeps these backend records intact:

- `source_files`
- `import_batches`
- `import_template_versions`
- `sheet_mappings`
- `field_mappings`
- `transformation_rules`
- `import_preview_runs` and preview rows
- `validation_runs`
- `import_exceptions`
- `mapping_versions`
- `posting_runs`
- `trial_balance_lines`
- `trial_balance_line_segments`
- `audit_logs`

Advanced pages remain available for detailed audit review:

- `/imports`
- `/imports/templates`
- `/imports/[importBatchId]/review`
- `/imports/[importBatchId]/preview`
- `/imports/[importBatchId]/validation`
- `/imports/[importBatchId]/mapping-preview`
- `/imports/[importBatchId]/post`

The workspace does not bypass template versioning, trial balance preview,
trial balance validation, mapping review, posting permissions, warning
acknowledgement, or period replacement controls. It is a cleaner front door over
the same governed import engine, not a second import engine.

Budget import, dashboard updates, report generation, and AI commentary remain
out of scope.
