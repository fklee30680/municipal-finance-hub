# Database Schema

Slice 1 adds the first production-style Supabase/PostgreSQL schema migration:

```text
supabase/migrations/20260517000100_core_schema.sql
```

Slice 2 adds the setup configuration migration:

```text
supabase/migrations/20260517000200_setup_configuration.sql
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

Slice 2 confirms or adds:

- Organization-scoped setup settings.
- Baseline setup defaults for a bootstrap organization.
- Baseline roles required by the setup foundation.
- Baseline import types for trial balance and core mapping imports.
- City Standard Account Structure and five account segment definitions as stored configuration.
- Monthly Finance Report template shell configuration.

## Reporting Defaults

Standard reporting should use active, posted, included imports. The migration creates `public.active_trial_balance_lines` as the default view for active posted actuals. Inactive and superseded import batches are excluded from that view.

Slice 2 defaults report period mode to `standard`, which excludes optional period 0 and period 13 from normal monthly reporting.

## Setup Configuration

`organization_settings` stores the user-configurable organization display name, current fiscal year, fiscal year start and end dates, standard period count, optional period 0, optional period 13, accrual reporting, and default report period mode.

The migration permits fiscal period `0` so later setup or import workflows can support opening and beginning-balance periods. Slice 2 does not seed fixed fiscal years or fiscal periods.

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
