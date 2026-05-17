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

