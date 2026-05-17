# Build Plan

## Slice 0: Project Setup and Technical Foundation

Create the Next.js/TypeScript app foundation, Tailwind configuration, shadcn-compatible folders, app shell, placeholder routes, Supabase helper structure, migration folder, fixtures folder, docs, and task tracking.

## Slice 1: Data Model Draft

Define the first database schema draft for organizations, fiscal periods, imports, raw files, templates, normalized records, mappings, snapshots, and audit trails.

Slice 1 implementation creates the first Supabase core schema migration and a static schema check script. The migration establishes organization/user/role tables, fiscal calendar tables, configurable account structure tables, import metadata, source file metadata, import batches/exceptions, trial balance actuals, mapping/reference tables, calculation result foundations, report reproducibility foundations, audit logs, and inactivation/reactivation request tables.

Completion note: Slice 1 should remain pending in `TASKS.md` until `npm run lint`, `npm run typecheck`, `npm run build`, and migration validation can be run in an environment with `npm`, dependencies, and Supabase CLI available.

## Slice 2: Seed Data and Setup Configuration Foundation

Add organization-scoped setup configuration for display name, current fiscal year, fiscal year dates, standard period count, optional period 0, optional period 13, accrual reporting, and default report period mode. Confirm baseline roles, import types, account structure configuration, account segments, and a Monthly Finance Report shell remain seed data rather than hardcoded application logic.

Slice 2 implementation creates `supabase/migrations/20260517000200_setup_configuration.sql`, adds a read-only Setup Configuration page under Settings, and documents fiscal calendar behavior. Editing, fiscal calendar imports, trial balance imports, dashboards, calculations, report generation, budget import, and AI commentary remain deferred.

Completion note: Slice 2 should only be marked complete in `TASKS.md` after lint, typecheck, build, schema checks, and available Supabase validation pass.

## Slice 3: Raw File Upload and Source File Storage

Add the first import-facing workflow for preserving raw CSV and Excel files in Supabase Storage, recording source file metadata, calculating SHA-256 hashes, detecting duplicate uploads by organization, creating uploaded/excluded import batch shells, and showing upload history.

Slice 3 implementation should not parse rows, inspect Excel sheets, map fields, validate financial content, post imports, write normalized financial rows, update dashboards, generate reports, import budgets, or add AI commentary.

## Slice 4: Template Selection and Basic Template Builder

Add import template management for uploaded source files. Users can create templates, inspect limited CSV/Excel sample data, configure sheet/header/data-start settings, map source columns to target fields, choose an account structure for trial balance templates, save transformation settings, and create new template versions without overwriting prior versions.

Slice 4 implementation does not parse full files, validate financial content, post imports, write normalized rows, update dashboards, generate reports, import budgets, or add AI commentary.

## Slice 5: Trial Balance Parsing and Preview

Add non-posted trial balance parsing and preview for CSV and Excel source files using saved template versions. Preview applies configured field mappings, transformation rules, and account structures; stores preview runs/rows/issues separately from posted actuals; shows parsed fund, ACFR, department, function, and object segments; and summarizes preview totals.

Slice 5 does not validate, approve, post, write active trial balance lines, update dashboards, generate reports, import budgets, or add AI commentary.

## Slice 6: Mapping and Classification MVP

Implement mapping import and classification support without hardcoding file layouts.

## Slice 7: Validation and Exception Review

Implement validation rules, warnings, errors, exception review, and import states.

## Slice 8: Data Review Tables

Create period and import review screens for normalized financial records.

## Slice 9: Analysis Outputs

Implement reproducible trend and variance calculations after normalized data exists.

## Slice 10: Dashboard Placeholders to Real Views

Replace placeholder dashboard screens with governed dashboard views backed by analysis outputs.

## Slice 11: Monthly Report Drafting

Create report snapshot structures, standard sections, and review workflows.

## Slice 12: Report Export and Finalization

Add report approval, locking, export, and retrieval behavior.

## Slice 13: Hardening and Pilot Readiness

Tighten QA, auditability, performance, security, and pilot rollout readiness.

## Deferred Past Slice 13

- Budget import.
- Budget-to-actual reporting.
- AI commentary.
- Full role and permission workflow.
