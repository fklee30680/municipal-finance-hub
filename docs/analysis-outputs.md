# Analysis Outputs and Mapping Coverage

Slice 9 adds the first governed calculation engine for posted, active trial
balance data. Calculations use `active_trial_balance_lines`, which already
excludes raw uploads, preview rows, validation rows, unposted imports, inactive
imports, superseded imports, rejected imports, and archived imports.

The calculation engine creates `calculation_runs` and writes MVP outputs to:

- `financial_summary_results`
- `statement_summary_results`
- `variance_results`
- `trend_results`
- `exception_results`
- `mapping_coverage_results`

Reference tables are treated as current presentation and classification master
data. Fund, Object, ACFR, Department, and Function reference imports do not need
trial-balance-style raw file lineage for Slice 9. Instead, Slice 9 generates
mapping coverage results that identify codes used by posted trial balance rows
but missing or incomplete in the reference tables.

Mapping coverage checks include missing fund, object, ACFR, department, and
function codes; inactive reference rows; missing fund type/reporting model; and
missing or conflicting object classifications needed for statement and cash
analysis.

Funds separate validity from presentation. `funds.active_status` means the fund
code is valid and usable; `reporting_treatment`,
`include_in_standard_reporting`, `include_in_cash_reconciliation`, and
`reporting_exclusion_reason` control reporting and reconciliation behavior.
Active pooled cash or reconciliation-only funds are valid mappings, but standard
analysis outputs exclude funds where `include_in_standard_reporting = false`.
Mapping coverage still flags missing funds and inactive funds used by posted
trial balance data.

Calculation runs store a dependency manifest focused on trial balance lineage
and calculation settings:

- trial balance import batch IDs
- posting run IDs
- validation run IDs
- account structure ID
- fiscal year and period range
- time view
- calculation version
- threshold configuration
- sign convention configuration
- comparison availability
- mapping coverage status

The MVP calculation version is `mvp_actuals_v1`. If no active threshold or sign
convention configuration exists, the app uses documented MVP defaults and stores
that dependency in the run metadata where possible.

Slice 9 intentionally does not build dashboards, CFO executive cards, Monthly
Finance Reports, report exports, budget import, budget variance output, or AI
commentary. The `/analysis/calculation-runs` page is a review and run-status
surface only.
