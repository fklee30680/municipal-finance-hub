# Database Schema

Slice 1 adds the first production-style Supabase/PostgreSQL schema migration:

```text
supabase/migrations/20260517000100_core_schema.sql
```

## Migration Scope

The migration creates foundations for:

- Multi-organization readiness.
- Application users and roles separate from Supabase Auth internals.
- Fiscal years and fiscal periods.
- Configurable account structures and segment definitions.
- Versioned import templates and mapping metadata.
- Raw source file metadata.
- Import batches and import exceptions.
- Normalized trial balance actuals and parsed account segments.
- Effective-dated reference and mapping tables.
- Calculation run/result foundations.
- Monthly Finance Report template, instance, parameter, comment, export, import-batch, and mapping-version traceability.
- Audit logs.
- Two-step inactivation and reactivation request workflows.

## Seed Data

The migration seeds:

- Default Municipal Organization.
- Baseline roles.
- Import types for trial balance and core mapping imports.
- City Standard Account Structure.
- Five default account segment definitions: Fund, ACFR, Department, Function, Object.
- Initial mapping version records.
- Default calculation threshold shell.
- Monthly Finance Report template shell and version shell.

## Reporting Defaults

Standard reporting should use active, posted, included imports. The migration creates `public.active_trial_balance_lines` as the default view for active posted actuals. Inactive and superseded import batches are excluded from that view.

## Deferred

Slice 1 does not implement:

- Import processing.
- CSV or Excel parsing.
- Validation engine logic.
- Posting workflows.
- Financial calculations.
- Dashboard queries.
- Monthly Finance Report generation.
- Budget import or budget-to-actual reporting.
- AI commentary.

