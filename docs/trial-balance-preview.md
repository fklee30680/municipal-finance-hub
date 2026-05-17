# Trial Balance Preview

Slice 5 adds non-posted trial balance preview parsing for uploaded CSV and Excel files.

Preview uses:

- A raw source file preserved in Supabase Storage.
- The linked import batch.
- A saved `trial_balance` template version.
- Sheet mappings and field mappings from the template version.
- Transformation rules saved with the template version.
- The configured account structure and account segment definitions.

Preview does not validate, approve, post, calculate dashboards, generate reports, import budgets, or create AI commentary.

## Preview Persistence

Preview output is stored separately from posted financial actuals:

- `import_preview_runs`
- `import_preview_rows`
- `import_preview_issues`

These tables link back to organization, import batch, source file, template version, and account structure. Preview rows are not active financial records and are excluded from reporting.

When a new preview is generated for the same import batch, prior completed preview runs are marked `superseded`.

## CSV and Excel Behavior

CSV preview reads the first worksheet-like table using the template header row, data start row, and field mappings.

Excel preview reads one selected active trial balance sheet. If more than one active sheet is configured for trial balance, the user must adjust the template so only one trial balance sheet is active for preview.

The UI shows a limited set of saved preview rows so large files do not render all rows at once.

## Account Parsing

Account parsing uses stored account structure data:

- Delimiter.
- Segment count.
- Trim-space behavior.
- Trailing-delimiter behavior.
- Segment order and segment keys.

The parser preserves leading zeros because account numbers and segment codes remain text.

For the City Standard Account Structure, this configured account number:

```text
100 -00-000-0000-111111-
```

parses as:

```text
Fund: 100
ACFR: 00
Department: 000
Function: 0000
Object: 111111
```

This behavior comes from stored configuration, not hardcoded business logic.

## Preview Issues

Preview issues are parse issues, not formal validation results. Examples include:

- Missing mapped required fields.
- Numeric parse failures.
- Blank numeric values when no blank handling rule is configured.
- Account segment count mismatches.

Formal validation against mapping/reference tables is deferred to later slices.
