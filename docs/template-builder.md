# Import Template Builder

Slice 4 adds template selection and a basic import template builder. Templates are versioned configuration that describe how later slices should read uploaded source files.

## Scope

The builder supports:

- Selecting a previously uploaded source file as a sample.
- Inspecting CSV headers and limited sample rows.
- Inspecting Excel sheet names, headers, and limited sample rows.
- Selecting header row and data start row.
- Ignoring irrelevant sheets.
- Mapping source columns to target fields.
- Selecting an account structure for trial balance templates.
- Saving transformation settings as configuration.
- Creating template version 1 for new templates.
- Creating a new version when editing an existing template.

## Target Fields

Target fields are centralized in `lib/templates/target-fields.ts`. This is a typed bridge for Slice 4 and may later move to database-backed configuration.

Trial balance templates require:

- `full_account_number`
- `account_name`
- `beginning_balance`
- `debits`
- `credits`
- `net_change`
- `ending_balance`

Mapping templates use target fields for fund, object, ACFR, department, and function reference data. Required fields are shown in the UI and enforced before saving.

## File Inspection

The builder reads only a limited preview from Supabase Storage. It does not load full workbooks into the browser and does not import rows into financial tables.

The current sample limit is 15 rows per sheet and 60 columns per sheet.

## Deferred Work

Slice 4 does not:

- Parse full files.
- Validate financial content.
- Post imports.
- Write trial balance lines.
- Write mapping/reference rows.
- Update dashboards.
- Generate reports.
- Activate budget imports.
- Add AI commentary.
