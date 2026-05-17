# Build Plan

## Slice 0: Project Setup and Technical Foundation

Create the Next.js/TypeScript app foundation, Tailwind configuration, shadcn-compatible folders, app shell, placeholder routes, Supabase helper structure, migration folder, fixtures folder, docs, and task tracking.

## Slice 1: Data Model Draft

Define the first database schema draft for organizations, fiscal periods, imports, raw files, templates, normalized records, mappings, snapshots, and audit trails.

Slice 1 implementation creates the first Supabase core schema migration and a static schema check script. The migration establishes organization/user/role tables, fiscal calendar tables, configurable account structure tables, import metadata, source file metadata, import batches/exceptions, trial balance actuals, mapping/reference tables, calculation result foundations, report reproducibility foundations, audit logs, and inactivation/reactivation request tables.

Completion note: Slice 1 should remain pending in `TASKS.md` until `npm run lint`, `npm run typecheck`, `npm run build`, and migration validation can be run in an environment with `npm`, dependencies, and Supabase CLI available.

## Slice 2: Authentication Foundation

Wire Supabase Auth into the app shell and establish user attribution without building the full role workflow.

## Slice 3: Import Template Foundations

Create configurable import template storage and UI stubs for later trial balance and mapping imports.

## Slice 4: Raw File Preservation

Integrate Supabase Storage for raw uploaded files and metadata tracking.

## Slice 5: Trial Balance Import MVP

Implement trial balance upload, parsing preview, and normalized storage.

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
