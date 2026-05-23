# Trial Balance Validation and Exception Review

Slice 7 adds validation for previewed trial balance imports. Validation uses the non-posted preview rows from Slice 5 and committed reference mappings from Slice 6. It does not reprocess raw files directly, post trial balance rows, activate data for reporting, run calculations, update dashboards, generate reports, import budgets, or create AI commentary.

## Validation Flow

Validation is available from `/imports/[importBatchId]/validation` for `trial_balance` import batches with a completed preview run. The workflow:

- Confirms the import batch, source file, template version, account structure, and preview run exist.
- Validates required trial balance fields.
- Checks numeric values, account segments, reference mappings, duplicate account numbers, fiscal year/period setup, and basic MVP formula rules.
- Carries forward preview issues as validation exceptions.
- Captures mapping versions used where committed mappings provide `mapping_version_id`.
- Updates the import batch to `validation_failed`, `validated_with_warnings`, or `validated`.

Amount parsing supports normal municipal trial balance formatting before validation runs. The preview parser accepts plain numbers, comma-formatted values, dollar signs, `.00`, negative values, and parentheses negatives for amount fields only. Account numbers and segment codes remain text so leading zeros are preserved.

Fiscal setup is required. When an import batch has fiscal year and period values, validation looks for active matching rows in `fiscal_years` and `fiscal_periods` for the same organization. If both records exist, the import batch is linked to their IDs. If either setup record is missing, validation creates one clear fiscal setup error and posting remains blocked until Setup is corrected and validation is rerun.

## Persistence

Validation state is stored in:

- `validation_runs`
- `validation_run_mapping_versions`
- `import_exceptions`
- `warning_acknowledgements`

`import_exceptions` stores row-level exception details including source row, source column, target field, raw value, transformed value, severity, message, suggested fix, and resolution status.

Validation output also groups exceptions by root cause in the UI so setup errors, numeric parsing, required fields, account parsing, reference mappings, formula checks, and period conflicts are easier to separate. Preview numeric parse issues are not duplicated as both missing and invalid field errors when the raw mapped value exists.

## Severity and Eligibility

Slice 7 uses these validation severities:

- `critical_error`
- `warning`
- `information`

Critical errors block posting eligibility. Warnings may be acknowledged only by allowed roles when no critical errors exist. Information messages do not block eligibility. Warning acknowledgement does not post data and cannot bypass critical errors.

## MVP Sign Convention

The MVP validation convention is isolated in `lib/imports/trial-balance-validation.ts`:

- `beginning_balance + net_change = ending_balance`
- `debits - credits = net_change`

This default is documented and intentionally isolated so later calculation work can replace it with configurable sign-convention rules.

## Boundaries

Validation is not posting. It does not write active `trial_balance_lines`, does not set imports active for reporting, and does not feed dashboards or reports. Users must fix bad source data in the original file and reupload; the MVP does not allow editing source row values inside the app.
