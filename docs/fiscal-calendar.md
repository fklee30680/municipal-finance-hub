# Fiscal Calendar Configuration

Slice 2 adds organization-scoped setup settings for fiscal year and reporting-period behavior. The focused fiscal setup feature adds `/setup/fiscal-years`, where users can maintain fiscal defaults, create individual fiscal years, bulk-generate historical/current/future fiscal years, and generate missing periods.

## Organization Scope

Each organization can have one setup settings record. The record stores the display name, current fiscal year, fiscal year start/end month/day defaults, standard period count, optional period flags, special period labels, and default report period mode.

The seeded organization is only a bootstrap record. It should be reviewed and edited through fiscal setup before production use.

## Fiscal Year and Period Setup

Fiscal setup records are stored in:

- `fiscal_years`
- `fiscal_periods`

Fiscal year numbers are unique per organization. Fiscal periods are unique by organization, fiscal year, and period number. Generation skips existing years and periods, so users can safely generate FY 2023 through FY 2026 and later regenerate missing FY 2026 periods without duplicating rows.

For a July 1 through June 30 calendar, FY 2026 generates as:

- FY 2026: `2025-07-01` through `2026-06-30`
- Period 1: July 2025
- Period 2: August 2025
- Period 3: September 2025
- Period 12: June 2026

The July calendar is a configurable default, not a hardcoded global rule.

## Reporting Periods

Normal monthly reporting defaults to standard periods only:

- Periods 1-12 are the standard monthly reporting periods.
- Period 0 is optional and intended for opening, beginning-balance, or pre-period activity only when configured.
- Period 13 is optional and intended for year-end or post-closing activity only when configured.

If `enable_period_0` is false, period 0 should not appear as a standard reporting period. If `enable_period_13` is false, period 13 should not appear as a standard reporting period.

Period 0 uses the fiscal year start date as both start and end date. Period 13 uses the fiscal year end date as both start and end date. These conventions keep special periods linkable without extending the fiscal year date range.

## Validation Linkage

Trial balance validation requires an active fiscal year and fiscal period for the import batch organization, fiscal year, and period. Validation does not silently create fiscal setup. When matching setup exists, validation links the import batch to `fiscal_year_id` and `fiscal_period_id`. When setup is missing, validation blocks posting and links the user to Fiscal Year Setup.

## Accrual Modes

Accrual reporting is a configuration concept only in Slice 2. If `enable_accrual_reporting` is false, accrual reporting modes should not be active or selected as defaults.

Allowed default report period modes are:

- `standard`
- `include_period_0`
- `include_period_13`
- `accrual`
- `year_end`

The default is `standard`, which excludes period 0 and period 13 from normal monthly reporting.

## Boundaries

Fiscal setup does not post trial balances, run calculations, build dashboards, generate reports, import budgets, or create AI commentary. Period 0 and Period 13 are excluded from normal monthly/YTD behavior unless future workflows explicitly include them.
