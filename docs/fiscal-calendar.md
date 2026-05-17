# Fiscal Calendar Configuration

Slice 2 adds organization-scoped setup settings for fiscal year and reporting-period behavior. These settings are configuration data, not hardcoded application logic.

## Organization Scope

Each organization can have one setup settings record. The record stores the display name, current fiscal year, fiscal year start and end dates, standard period count, optional period flags, and default report period mode.

The seeded organization is only a bootstrap record. It should be reviewed and edited through a later setup workflow before production use.

## Reporting Periods

Normal monthly reporting defaults to standard periods only:

- Periods 1-12 are the standard monthly reporting periods.
- Period 0 is optional and intended for opening, beginning-balance, or pre-period activity only when configured.
- Period 13 is optional and intended for year-end or post-closing activity only when configured.

If `enable_period_0` is false, period 0 should not appear as a standard reporting period. If `enable_period_13` is false, period 13 should not appear as a standard reporting period.

## Accrual Modes

Accrual reporting is a configuration concept only in Slice 2. If `enable_accrual_reporting` is false, accrual reporting modes should not be active or selected as defaults.

Allowed default report period modes are:

- `standard`
- `include_period_0`
- `include_period_13`
- `accrual`
- `year_end`

The default is `standard`, which excludes period 0 and period 13 from normal monthly reporting.

## Deferred Work

Fiscal year and fiscal period import files will be handled later through the configurable import engine. Slice 2 does not create a special-case fiscal calendar importer, does not seed fixed fiscal years, and does not implement dashboard, calculation, report, budget, or AI behavior.
