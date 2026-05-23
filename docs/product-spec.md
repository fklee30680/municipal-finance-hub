# Product Specification

This file is the source-of-truth product summary for the Municipal Finance Reporting Hub until the full product specification is added to the repository.

## Locked Product Direction

Municipal Finance Reporting Hub is a web-based municipal finance reporting and analysis platform for CFO-level dashboards and recurring Monthly Finance Reports. It is a reporting and analysis layer, not an ERP replacement or accounting system of record.

The MVP direction includes configurable imports, raw file preservation, normalized financial storage, account parsing, mapping/classification, trend and variance analysis, dashboards, and report generation.

## Non-Goals

- Do not replace the ERP.
- Do not post journal entries.
- Do not modify official financial records.
- Do not produce audited financial statements.
- Do not hardcode account structures.
- Do not hardcode file layouts.
- Do not implement budget import or budget-to-actual reporting through Slice 13.
- Do not implement AI commentary through Slice 13.

## Phase 0: Product Definition and Design Guardrails

Define the app identity, primary users, MVP scope, out-of-scope boundaries, high-level workflow, terminology, and acceptance criteria.

Acceptance criteria:

- Everyone can explain the app in one paragraph.
- The first version has bounded scope.
- The app is understood as a reporting and analysis layer, not the system of record.

## Phase 1: Data Discovery and Financial Model Design

Understand source files and define the internal financial model. Trial balance lines should eventually support fiscal year, period, account number, parsed segments, account name, balances, source file, import batch, and template version.

Acceptance criteria:

- Uploaded trial balances can be converted into structured financial data.
- Account lines can be enriched with fund, ACFR/function, department, and object classifications.
- The internal model is stable even though file imports are flexible.

## Phase 2: Configurable Import Engine Design

Design import types, templates, template versions, source files, field mappings, transformations, validations, import batches, results, and exception logs.

Acceptance criteria:

- A non-developer finance admin can define a file layout.
- Templates can be reused for future uploads.
- Each import stores the template version used.
- Bad data is stopped or flagged before reaching reporting surfaces.

## Phase 3: Core Database and Storage Architecture

Separate raw uploaded files, normalized parsed records, validation logs, import metadata, template versions, analysis outputs, and final report snapshots.

Acceptance criteria:

- Every uploaded file has a traceable source.
- Every financial line can be traced back to a file, import batch, and template version.
- Finalized reports can be reproduced or explained.

## Phase 4: Basic Upload, Validation, and Data Review MVP

Build the first working import pipeline experience: login, upload, template selection, column mapping, parsing preview, validation results, exception detail, import history, and parsed data review.

Acceptance criteria:

- Users can upload sample monthly trial balances.
- Users can upload mapping workbooks.
- Validation issues are visible before data is accepted.
- Imported records can be viewed by period.

## Phase 5: Financial Calculation and Analysis Engine

Turn stored financial data into period, YTD, trend, variance, and exception analysis.

Acceptance criteria:

- The app identifies largest changes by fund, department, object, and account.
- The app generates period-level and YTD summaries.
- Analysis can be reproduced from stored data.

## Phase 6: Dashboard Design and Build

Create dashboard views after the import and calculation engine exist. Dashboards should be executive first, drilldown second, and traceable to source data.

Acceptance criteria:

- Users can move from executive summary to fund detail to account line.
- Users can identify material changes without exporting to Excel.
- Users can see whether current data is complete and validated.

## Phase 7: Monthly Report Generator

Generate recurring monthly reports from governed data with standard tables, charts, variance schedules, commentary review, approval, frozen snapshots, and exports.

Acceptance criteria:

- The app can generate a monthly report for a selected period.
- Finance staff can edit commentary.
- Approved reports are frozen and retrievable.

## Slice 0 Boundary

Slice 0 only creates the technical foundation. It must not implement finance business logic, database schema beyond placeholders, imports, calculations, dashboards, report generation, budgets, or AI commentary.

## Slice 1 Core Schema Boundary

Slice 1 creates the database foundation required for the product through Phase 7. It establishes migration-driven storage for organizations, users, roles, fiscal calendars, configurable account structures, import templates, raw file metadata, import batches and exceptions, normalized trial balance actuals, reference mappings, calculation result foundations, report reproducibility foundations, audit logs, and controlled inactivation/reactivation workflows.

Slice 1 does not implement import processing, parsing, validation logic, posting workflows, calculations, dashboards, report generation, budget workflows, or AI commentary.

## Slice 3 Raw Upload Boundary

Slice 3 implements raw file intake only. It preserves CSV and Excel files in private object storage, records source file metadata, calculates file hashes, warns on duplicate hashes, creates uploaded/excluded import batch shells, and displays upload history.

Slice 3 does not parse rows, inspect Excel sheets, map fields, validate financial content, post imports, create normalized financial rows, update dashboards, generate reports, import budgets, or add AI commentary.

## Slice 4 Template Builder Boundary

Slice 4 implements configurable, versioned template setup. It inspects limited sample rows from uploaded CSV and Excel files, stores sheet mappings, field mappings, transformation configuration, and account structure selection.

Slice 4 does not parse full files, validate financial content, post imports, write trial balance lines, write mapping/reference rows, update dashboards, generate reports, import budgets, or add AI commentary.

## Slice 5 Trial Balance Preview Boundary

Slice 5 implements non-posted trial balance preview parsing for CSV and Excel source files using saved trial balance template versions. It applies saved mappings and transformations, parses account segments from configured account structure data, stores preview runs/rows/issues, and shows preview totals.

Slice 5 does not run the formal validation engine, validate against mapping/reference tables, post imports, write active `trial_balance_lines`, update dashboards, generate reports, import budgets, or add AI commentary.

## Slice 6 Mapping Import Boundary

Slice 6 implements mapping/reference imports for funds, objects, ACFR mappings, departments, and functions. Each import uses one source file or one selected Excel sheet, one mapping import type, and one target mapping table.

Slice 6 does not support multi-sheet mapping package imports, post trial balance actuals, run the full validation engine, update dashboards, generate reports, import budgets, add AI commentary, or add manual mapping maintenance screens.

## Slice 7: Trial Balance Validation and Exception Review

Slice 7 validates previewed trial balance rows before posting. Validation uses Slice 5 preview rows, committed Slice 6 mappings, configured account structures, fiscal setup, and centralized validation rules. It stores validation runs, exception details, mapping-version traceability, and warning acknowledgements where allowed.

Slice 7 does not post data, create active trial balance lines, execute period replacement/supersession, run calculations, update dashboards, generate reports, import budgets, add AI commentary, or allow in-app source row editing.

## Slice 8: Post Validated Trial Balance and Data Review

Slice 8 posts eligible validated trial balance imports into governed reporting tables. Posting consumes Slice 5/Slice 7 validated preview rows, creates normalized `trial_balance_lines` and `trial_balance_line_segments`, records posting runs, preserves warning acknowledgement and mapping-version traceability, and exposes import/period review.

Posting is blocked when validation has critical errors, required warnings are unacknowledged, fiscal period context is missing, or active posted data already exists for the same fiscal year and period. Period replacement requires a request and approval. Replacement supersedes/inactivates old rows rather than physically deleting them. Reactivation also requires request, approval, audit trail, and active-period conflict checks.

Slice 8 does not parse files, build templates, rerun validation rules beyond consuming Slice 7 eligibility, run calculations, build dashboards, generate reports, import budgets, add AI commentary, or allow in-app source row editing.

## Slice 9: Analysis Outputs, Calculation Engine MVP, and Mapping Coverage

Slice 9 creates governed analysis outputs from posted, active trial balance rows
only. It generates calculation runs, current-period/YTD/range summaries,
statement summaries, variances, trends, exceptions, and mapping coverage results
for reference completeness.

Trial balance data remains the strict source of record for financial analysis.
Reference tables are current/static presentation and classification master data.
Fund, Object, ACFR, Department, and Function reference imports do not require
trial-balance-style raw file retention for Slice 9. Missing or incomplete
reference data is surfaced through mapping coverage results.

Slice 9 does not build dashboard views, draft Monthly Finance Reports, export
reports, import budgets, calculate budget-to-actual variance, add AI commentary,
or use raw uploads/previews/unposted imports as reporting input.
