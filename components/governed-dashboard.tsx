import Link from "next/link";
import type { ReactNode } from "react";

import { DashboardRunCalculationForm } from "@/components/dashboard-run-calculation-form";
import { FundExceptionsDialog } from "@/components/fund-exceptions-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type CalculationRun,
  type DashboardFinancialFactRow,
  type DashboardOptions,
  type DashboardOutput,
  type DashboardSelection,
  type DashboardView,
  type ExceptionRow,
  type MappingCoverageRow,
  formatAmount,
  formatDate,
  formatPercent,
  getRunReportingScope
} from "@/lib/dashboards/governed-dashboard";

export function DashboardNav() {
  const links = [
    ["/analysis", "CFO Overview"],
    ["/analysis/financial-statements", "Financial Statements"],
    ["/analysis/funds", "Funds"],
    ["/analysis/variances", "Variances"],
    ["/analysis/exceptions", "Exceptions"]
  ];

  return (
    <nav className="flex flex-wrap gap-2" aria-label="Dashboard views">
      {links.map(([href, label]) => (
        <Link
          className="inline-flex items-center rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
          href={href}
          key={href}
        >
          {label}
        </Link>
      ))}
      <Link
        className="inline-flex items-center rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
        href="/analysis/calculation-runs"
      >
        Calculation Runs
      </Link>
    </nav>
  );
}

export function DashboardFilterBar({
  options,
  selection,
  view
}: {
  options: DashboardOptions;
  selection: DashboardSelection;
  view: DashboardView;
}) {
  const fiscalYears = Array.from(
    new Set(options.fiscalPeriods.map((period) => period.fiscal_year))
  ).sort((a, b) => b - a);
  const periods = options.fiscalPeriods
    .filter((period) => period.fiscal_year === selection.fiscalYear)
    .sort((a, b) => a.period - b.period);
  const fundGroups = Array.from(
    new Set(
      options.funds
        .map((fund) => fund.fund_group?.trim())
        .filter((group): group is string => Boolean(group))
    )
  ).sort((a, b) => a.localeCompare(b));

  return (
    <form className="space-y-5" method="get">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)]">
        <FilterSection title="Period and scope">
          <Select label="Fiscal year" name="fiscalYear" value={String(selection.fiscalYear)}>
            {fiscalYears.length === 0 ? (
              <option value={selection.fiscalYear}>No values available</option>
            ) : (
              fiscalYears.map((year) => (
                <option key={year} value={year}>
                  FY {year}
                </option>
              ))
            )}
          </Select>
          <Select label="Period from" name="periodFrom" value={String(selection.periodFrom)}>
            {periods.map((period) => (
              <option key={period.period} value={period.period}>
                Period {period.period} - {period.period_name}
              </option>
            ))}
          </Select>
          <Select label="Period to" name="periodTo" value={String(selection.periodTo)}>
            {periods.map((period) => (
              <option key={period.period} value={period.period}>
                Period {period.period} - {period.period_name}
              </option>
            ))}
          </Select>
          <div className="md:col-span-2">
            <Select
              label="Reporting scope"
              name="reportingScope"
              value={selection.reportingScope}
            >
              <option value="standard">Standard Reporting</option>
              <option value="cash_reconciliation">
                Include Pooled Cash / Reconciliation
              </option>
              <option value="all_active">All Active Funds</option>
            </Select>
          </div>
        </FilterSection>

        <FilterSection title="Reference dimensions">
          <Select label="Fund" name="fund" value={selection.fund}>
            <option value="">All funds</option>
            {options.funds.map((fund) => (
              <option key={fund.fund_code} value={fund.fund_code}>
                {fund.fund_code} - {fund.fund_name}
              </option>
            ))}
          </Select>
          <Select label="Fund group" name="fundGroup" value={selection.fundGroup}>
            <option value="">All groups</option>
            {fundGroups.map((group) => (
              <option key={group} value={group}>
                {group}
              </option>
            ))}
          </Select>
          <Select label="Department" name="department" value={selection.department}>
            <option value="">All departments</option>
            {options.departments.map((department) => (
              <option key={department.code} value={department.code}>
                {department.code} - {department.name}
              </option>
            ))}
          </Select>
          <Select label="Function" name="functionCode" value={selection.functionCode}>
            <option value="">All functions</option>
            {options.functions.map((functionRow) => (
              <option key={functionRow.code} value={functionRow.code}>
                {functionRow.code} - {functionRow.name}
              </option>
            ))}
          </Select>
          <Select label="ACFR" name="acfr" value={selection.acfr}>
            <option value="">All ACFR</option>
            {options.acfr.map((row) => (
              <option key={row.code} value={row.code}>
                {row.code} - {row.name}
              </option>
            ))}
          </Select>
          <Select label="Account type" name="accountType" value={selection.accountType}>
            <option value="">All account types</option>
            {options.accountTypes.map((accountType) => (
              <option key={accountType} value={accountType}>
                {titleize(accountType)}
              </option>
            ))}
          </Select>
        </FilterSection>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        {view === "variances" ? (
          <FilterSection title="Display">
            <Select label="Top N" name="topN" value={String(selection.topN)}>
              {[5, 10, 20, 50].map((value) => (
                <option key={value} value={value}>
                  Top {value}
                </option>
              ))}
            </Select>
            <Select label="Sort" name="sort" value={selection.sort}>
              <option value="largest_amount">Largest dollar variance</option>
              <option value="largest_percent">Largest percent variance</option>
            </Select>
          </FilterSection>
        ) : (
          <div />
        )}
        <button className="h-10 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
          Apply Filters
        </button>
      </div>
    </form>
  );
}

export function DataReadinessBanner({
  calculationRun,
  failedRun,
  output,
  selection
}: {
  calculationRun: CalculationRun | null;
  failedRun: CalculationRun | null;
  output: DashboardOutput;
  selection: DashboardSelection;
}) {
  const criticalCount =
    output.exceptions.filter((row) => row.severity_level === "Critical").length +
    output.mappingCoverage.filter((row) => row.severity === "Critical").length;
  const warningCount =
    output.exceptions.filter((row) => row.severity_level === "Warning").length +
    output.mappingCoverage.filter((row) => row.severity === "Warning").length;
  const factCounts = output.dashboardFactCounts;

  return (
    <div className="space-y-4">
        <div className="grid gap-4 text-sm md:grid-cols-3 xl:grid-cols-6">
          <Info label="Selection" value={`FY ${selection.fiscalYear} P${selection.periodFrom}-P${selection.periodTo}`} />
          <Info label="Reporting scope" value={formatReportingScope(selection.reportingScope)} />
          <Info
            label="Calculation"
            value={
              calculationRun
                ? `${shortId(calculationRun.calculation_run_id)} / ${calculationRun.run_status}`
                : "Missing"
            }
          />
          <Info
            label="Mapping coverage"
            value={calculationRun?.mapping_coverage_status ?? "Not available"}
          />
          <Info label="Last calculated" value={formatDate(calculationRun?.completed_at)} />
          <Info label="Critical exceptions" value={criticalCount} />
          <Info label="Warnings" value={warningCount} />
          <Info
            label="Freshness"
            value={calculationRun?.is_stale ? "Stale" : calculationRun ? "Current" : "Not calculated"}
          />
          <Info
            label="Version"
            value={calculationRun?.calculation_version ?? "Not available"}
          />
          <Info
            label="Source batches"
            value={calculationRun?.source_import_batch_ids?.length ?? 0}
          />
          <Info
            label="Posting runs"
            value={calculationRun?.posting_run_ids?.length ?? 0}
          />
          <Info label="Dashboard facts" value={`${factCounts.filteredTotal} / ${factCounts.rawTotal}`} />
          <Info label="All facts" value={factCounts.bySummaryType.all ?? 0} />
          <Info label="Fund facts" value={factCounts.bySummaryType.fund ?? 0} />
          <Info label="Department facts" value={factCounts.bySummaryType.department ?? 0} />
          <Info label="Function facts" value={factCounts.bySummaryType.function ?? 0} />
          <Info label="ACFR facts" value={factCounts.bySummaryType.acfr ?? 0} />
          <Info label="Account type facts" value={factCounts.bySummaryType.account_type ?? 0} />
          <Info label="Detail facts" value={factCounts.bySummaryType.dashboard_detail ?? 0} />
        </div>
        <div className="rounded-md border border-border bg-card px-3 py-2 text-sm">
          <span className="font-medium text-foreground">Active filters: </span>
          <span className="text-muted-foreground">{formatActiveFilters(selection)}</span>
        </div>
        {!calculationRun ? (
          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">
              No governed calculation output exists for this dashboard selection.
            </p>
            {failedRun?.error_message ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                Most recent matching failed run: {failedRun.error_message}
              </p>
            ) : null}
            <DashboardRunCalculationForm
              fiscalYear={selection.fiscalYear}
              periodFrom={selection.periodFrom}
              periodTo={selection.periodTo}
              reportingScope={selection.reportingScope}
              timeView={selection.timeView}
            />
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Link
              className="inline-flex items-center rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
              href={`/analysis/calculation-runs?calculationRunId=${calculationRun.calculation_run_id}`}
            >
              View Calculation Run
            </Link>
            <DashboardRunCalculationForm
              fiscalYear={selection.fiscalYear}
              periodFrom={selection.periodFrom}
              periodTo={selection.periodTo}
              reportingScope={selection.reportingScope}
              timeView={selection.timeView}
            />
          </div>
        )}
    </div>
  );
}

export function DashboardFilterNotes({ notes }: { notes: string[] }) {
  if (notes.length === 0) return null;

  return (
    <Card className="border-amber-200 bg-amber-50/70">
      <CardContent className="space-y-2 pt-6">
        {notes.map((note) => (
          <p className="text-sm text-amber-950" key={note}>
            {note}
          </p>
        ))}
      </CardContent>
    </Card>
  );
}

export function ExecutiveFinancialPositionView({
  output,
  selection
}: {
  output: DashboardOutput;
  selection: DashboardSelection;
}) {
  const hasDisplayFilter = Boolean(
    selection.fund ||
      selection.fundGroup ||
      selection.department ||
      selection.functionCode ||
      selection.acfr ||
      selection.accountType
  );
  const facts = output.dashboardFacts;
  const totals = summarizeFacts(facts);
  const helper = hasDisplayFilter ? "Selected dashboard filters" : "Governed dashboard facts";

  if (facts.length === 0) {
    return <DashboardFactsEmptyState hasDisplayFilter={hasDisplayFilter} output={output} />;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          helper={helper}
          label="Beginning balance"
          value={formatAmount(totals.beginningBalance)}
        />
        <MetricCard
          helper={helper}
          label="Revenues"
          value={formatMaybeAmount(totals.revenues)}
        />
        <MetricCard
          helper={helper}
          label="Expenditures / expenses"
          value={formatMaybeAmount(totals.expenditures)}
        />
        <MetricCard
          helper={helper}
          label="Other financing sources"
          value={formatMaybeAmount(totals.otherFinancingSources)}
        />
        <MetricCard
          helper={helper}
          label="Other financing uses"
          value={formatMaybeAmount(totals.otherFinancingUses)}
        />
        <MetricCard
          helper={helper}
          label="Net change"
          value={formatAmount(totals.netChange)}
        />
        <MetricCard
          helper={helper}
          label="Ending balance"
          value={formatAmount(totals.endingBalance)}
        />
        <MetricCard
          helper={
            totals.cashAndInvestments === null
              ? "Cash / investments not available from current classifications."
              : helper
          }
          label="Cash / investments"
          value={formatMaybeAmount(totals.cashAndInvestments)}
        />
      </div>
      <p className="text-sm text-muted-foreground">
        Active filters: {formatActiveFilters(selection)}
      </p>
    </div>
  );
}

export const SummaryCards = ExecutiveFinancialPositionView;

export function FinancialStatementsView({ output }: { output: DashboardOutput }) {
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Statement Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <SimpleTable
            empty="No statement summary rows are available for this calculation."
            rows={output.statementSummaries}
            columns={[
              ["Line", (row) => row.line_item_name ?? row.line_name],
              ["Statement", (row) => row.statement_type],
              ["Amount", (row) => formatAmount(row.presentation_amount ?? row.amount_value)]
            ]}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Balance Sheet Lines</CardTitle>
        </CardHeader>
        <CardContent>
          <SimpleTable
            empty="No balance sheet line summary rows are available."
            rows={output.financialSummaries.filter((row) => row.summary_type === "balance_sheet_line")}
            columns={[
              ["Line", (row) => row.summary_key],
              ["Ending Balance", (row) => formatAmount(row.ending_balance)],
              ["Net Change", (row) => formatAmount(row.presentation_amount ?? row.net_change)]
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}

export function FundsView({
  output,
  selection
}: {
  output: DashboardOutput;
  selection: DashboardSelection;
}) {
  const rows = buildFundPerformanceRows(output, selection);

  if (output.dashboardFactCounts.rawTotal === 0) {
    return <DashboardFactsEmptyState hasDisplayFilter={false} output={output} />;
  }

  return (
    <div className="space-y-4">
      <SectionPanel title="Fund Summary">
        <SimpleTable
          empty="No fund-level summary rows are available for this calculation."
          rows={rows}
          columns={[
            ["Fund", (row) => row.fund],
            ["Fund Group", (row) => row.fundGroup ?? "Not provided"],
            ["Revenues", (row) => formatMaybeAmount(row.revenues)],
            ["Expenditures", (row) => formatMaybeAmount(row.expenditures)],
            ["OFS", (row) => formatMaybeAmount(row.otherFinancingSources)],
            ["OFU", (row) => formatMaybeAmount(row.otherFinancingUses)],
            ["Net Activity", (row) => formatMaybeAmount(row.netActivity)],
            ["Fund Balance / Net Position", (row) => formatMaybeAmount(row.fundBalanceNetPosition)],
            ["TB Ending Net", (row) => formatAmount(row.trialBalanceEndingNet)],
            ["Exceptions", (row) => (
              <FundExceptionsDialog
                exceptionCount={row.exceptionCount}
                exceptions={row.exceptions}
                fund={row.fund}
              />
            )],
            ["Readiness Issues", (row) => row.mappingIssueCount]
          ]}
        />
      </SectionPanel>
    </div>
  );
}

export function MaterialChangesView({
  output,
  selection
}: {
  output: DashboardOutput;
  selection: DashboardSelection;
}) {
  const fundMovements = buildFundPerformanceRows(output, selection)
    .sort((a, b) => Math.abs(b.netActivity ?? 0) - Math.abs(a.netActivity ?? 0))
    .slice(0, selection.topN);

  return (
    <div className="space-y-6">
      <SectionPanel
        title={`Material variance rows (${formatMaterialSort(selection.sort)}, Top ${selection.topN})`}
      >
        <SimpleTable
          empty="No governed variance rows are available for this calculation and filter selection."
          rows={output.variances}
          columns={[
            ["Object", (row) => row.object_code ?? row.variance_key],
            ["Fund", (row) => row.fund_code ?? "Global"],
            ["Department", (row) => row.department_code ?? "Global"],
            ["Function", (row) => row.function_code ?? "Global"],
            ["ACFR", (row) => row.acfr_code ?? "Global"],
            ["Account Type", (row) => titleize(row.account_type ?? "not classified")],
            ["Type", (row) => titleize(row.variance_type ?? "variance")],
            ["Current", (row) => formatAmount(row.current_amount)],
            ["Comparison", (row) => formatAmount(row.comparison_amount)],
            ["Variance", (row) => formatAmount(row.variance_amount)],
            ["Percent", (row) => formatPercent(row.variance_percent)],
            ["Severity", (row) => row.severity ?? "Not classified"]
          ]}
        />
      </SectionPanel>
      <SectionPanel title={`Largest fund-level net changes (Top ${selection.topN})`}>
        <SimpleTable
          empty="No fund-level dashboard facts are available for this calculation."
          rows={fundMovements}
          columns={[
            ["Fund", (row) => row.fund],
            ["Fund Group", (row) => row.fundGroup ?? "Not provided"],
            ["Net Activity", (row) => formatMaybeAmount(row.netActivity)],
            ["Revenues", (row) => formatMaybeAmount(row.revenues)],
            ["Expenditures", (row) => formatMaybeAmount(row.expenditures)]
          ]}
        />
      </SectionPanel>
    </div>
  );
}

export const VariancesView = MaterialChangesView;

export function ExceptionsView({
  compact = false,
  output
}: {
  compact?: boolean;
  output: DashboardOutput;
}) {
  const criticalExceptions = output.exceptions.filter((row) => row.severity_level === "Critical");
  const warningExceptions = output.exceptions.filter((row) => row.severity_level === "Warning");
  const missingReferenceRows = output.mappingCoverage.filter((row) =>
    row.coverage_issue_type.toLowerCase().includes("missing")
  );
  const inactiveRows = output.mappingCoverage.filter((row) =>
    row.coverage_issue_type.toLowerCase().includes("inactive")
  );
  const incompleteRows = output.mappingCoverage.filter((row) =>
    row.coverage_issue_type.toLowerCase().includes("incomplete")
  );
  const integrityRows = output.exceptions.filter(
    (row) => row.exception_category === "trial_balance_integrity"
  );
  const period13Rows = output.exceptions.filter((row) =>
    `${row.exception_category ?? ""} ${row.exception_type ?? ""} ${row.message ?? ""}`
      .toLowerCase()
      .includes("period 13")
  );
  const mappingRows = compact ? output.mappingCoverage.slice(0, 8) : output.mappingCoverage;
  const exceptionRows = compact ? output.exceptions.slice(0, 8) : output.exceptions;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MiniStat label="Critical exceptions" value={criticalExceptions.length} />
        <MiniStat label="Warnings" value={warningExceptions.length} />
        <MiniStat label="Mapping issues" value={output.mappingCoverage.length} />
        <MiniStat label="Missing references" value={missingReferenceRows.length} />
      </div>
      <SectionPanel title="Critical exceptions">
        <ExceptionTable rows={compact ? criticalExceptions.slice(0, 8) : criticalExceptions} />
      </SectionPanel>
      <SectionPanel title="Warnings">
        <ExceptionTable rows={compact ? warningExceptions.slice(0, 8) : warningExceptions} />
      </SectionPanel>
      <SectionPanel title="Mapping coverage issues">
        <MappingCoverageTable rows={mappingRows} />
      </SectionPanel>
      <SectionPanel title="Missing reference data">
        <MappingCoverageTable rows={compact ? missingReferenceRows.slice(0, 8) : missingReferenceRows} />
      </SectionPanel>
      <SectionPanel title="Inactive reference rows used">
        <MappingCoverageTable rows={compact ? inactiveRows.slice(0, 8) : inactiveRows} />
      </SectionPanel>
      <SectionPanel title="Incomplete classifications">
        <MappingCoverageTable rows={compact ? incompleteRows.slice(0, 8) : incompleteRows} />
      </SectionPanel>
      <SectionPanel title="Trial balance integrity">
        <ExceptionTable rows={compact ? integrityRows.slice(0, 8) : integrityRows} />
      </SectionPanel>
      <SectionPanel title="Period 13 close verification">
        <ExceptionTable rows={compact ? period13Rows.slice(0, 8) : period13Rows} />
      </SectionPanel>
      {compact && (output.exceptions.length > exceptionRows.length || output.mappingCoverage.length > mappingRows.length) ? (
        <p className="text-sm text-muted-foreground">
          CFO Overview shows a shortened readiness view. Open Exceptions for the full list.
        </p>
      ) : null}
    </div>
  );
}

export function TraceabilityCard({ calculationRun }: { calculationRun: CalculationRun | null }) {
  if (!calculationRun) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Traceability</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm md:grid-cols-3">
        <Info label="Calculation run ID" value={calculationRun.calculation_run_id} />
        <Info label="Reporting scope" value={formatReportingScope(getRunReportingScope(calculationRun))} />
        <Info label="Calculation version" value={calculationRun.calculation_version ?? "Not available"} />
        <Info label="Source import batches" value={calculationRun.source_import_batch_ids?.join(", ") || "None recorded"} />
        <Info label="Posting runs" value={calculationRun.posting_run_ids?.join(", ") || "None recorded"} />
        <Info label="Validation runs" value={calculationRun.validation_run_ids?.join(", ") || "None recorded"} />
      </CardContent>
    </Card>
  );
}

function DashboardFactsEmptyState({
  hasDisplayFilter,
  output
}: {
  hasDisplayFilter: boolean;
  output: DashboardOutput;
}) {
  const rawFactCount = output.dashboardFactCounts.rawTotal;
  const filteredFactCount = output.dashboardFactCounts.filteredTotal;
  let message =
    "This calculation run does not have dashboard-ready facts. Apply the dashboard facts migration if needed, then rerun calculation for this dashboard selection.";

  if (rawFactCount > 0 && filteredFactCount === 0 && hasDisplayFilter) {
    message = "No governed dashboard facts match the selected filters.";
  } else if (rawFactCount > 0 && filteredFactCount === 0) {
    message =
      "Dashboard facts exist, but this section does not have the required summary grain for the selected view.";
  }

  return (
    <div className="rounded-md border border-dashed border-border bg-muted/20 p-4 text-sm leading-6 text-muted-foreground">
      {message}
    </div>
  );
}

function ExceptionTable({ rows }: { rows: ExceptionRow[] }) {
  return (
    <SimpleTable
      empty="No rows in this section."
      rows={rows}
      columns={[
        ["Severity", (row) => row.severity_level ?? "Not classified"],
        ["Category", (row) => titleize(row.exception_category ?? "exception")],
        ["Type", (row) => titleize(row.exception_type ?? "review")],
        ["Fund", (row) => row.fund_code ?? "Global"],
        ["Object", (row) => row.object_code ?? "Not provided"],
        ["Department", (row) => row.department_code ?? "Not provided"],
        ["Function", (row) => row.function_code ?? "Not provided"],
        ["ACFR", (row) => row.acfr_code ?? "Not provided"],
        ["Account Type", (row) => titleize(row.account_type ?? "not classified")],
        ["Amount", (row) => formatAmount(row.current_amount)],
        ["Message", (row) => row.message ?? "No message"],
        ["Action", (row) => row.recommended_review_action ?? "Review calculation output"]
      ]}
    />
  );
}

function MappingCoverageTable({ rows }: { rows: MappingCoverageRow[] }) {
  return (
    <SimpleTable
      empty="No rows in this section."
      rows={rows}
      columns={[
        ["Severity", (row) => row.severity],
        ["Segment", (row) => `${row.segment_type}: ${row.segment_code ?? "Not provided"}`],
        ["Reference", (row) => row.reference_table],
        ["Status", (row) => titleize(row.reference_status)],
        ["Issue", (row) => titleize(row.coverage_issue_type)],
        ["Rows", (row) => row.affected_row_count],
        ["Amount", (row) => formatAmount(row.affected_amount)],
        ["Message", (row) => row.message],
        ["Action", (row) => (
          <div className="space-y-1">
            <ReferenceLink referenceTable={row.reference_table} segmentCode={row.segment_code} />
            {row.recommended_action ? (
              <p className="text-xs text-muted-foreground">{row.recommended_action}</p>
            ) : null}
          </div>
        )]
      ]}
    />
  );
}

function SectionPanel({
  children,
  title
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <section className="space-y-3 rounded-md border border-border bg-background p-4">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </section>
  );
}

function MiniStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

type FactSummary = {
  beginningBalance: number;
  cashAndInvestments: number | null;
  endingBalance: number;
  expenditures: number | null;
  fundBalanceNetPosition: number | null;
  netChange: number;
  netActivity: number | null;
  otherFinancingSources: number | null;
  otherFinancingUses: number | null;
  revenues: number | null;
  trialBalanceEndingNet: number;
};

type FundPerformanceRow = FactSummary & {
  exceptionCount: number;
  exceptions: ExceptionRow[];
  fund: string;
  fundGroup: string | null;
  mappingIssueCount: number;
};

function buildFundPerformanceRows(
  output: DashboardOutput,
  selection: DashboardSelection
): FundPerformanceRow[] {
  const accountTypeFacts = selectFundPerformanceFacts(output, selection);
  const groups = new Map<string, DashboardFinancialFactRow[]>();

  for (const fact of accountTypeFacts) {
    const fund = fact.fund_code;
    if (!fund) continue;
    groups.set(fund, [...(groups.get(fund) ?? []), fact]);
  }

  return [...groups.entries()]
    .map(([fund, facts]) => {
      const fundTrialBalanceFacts = selectFundTrialBalanceFacts(output, selection, fund);
      const exceptions = output.exceptions.filter((row) => row.fund_code === fund);
      return {
        ...summarizeFacts(facts, fundTrialBalanceFacts),
        exceptionCount: exceptions.length,
        exceptions,
        fund,
        fundGroup: facts.find((fact) => fact.fund_group)?.fund_group ?? null,
        mappingIssueCount: output.mappingCoverage.filter(
          (row) => row.segment_type === "fund" && row.segment_code === fund
        ).length
      };
    })
    .sort((a, b) => a.fund.localeCompare(b.fund));
}

function selectFundPerformanceFacts(
  output: DashboardOutput,
  selection: DashboardSelection
) {
  const hasCrossDimensionFilter = Boolean(
    selection.department ||
      selection.functionCode ||
      selection.acfr
  );
  const sourceFacts = hasCrossDimensionFilter
    ? output.dashboardFacts
    : output.dashboardRawFacts.filter((fact) => fact.summary_type === "fund_account_type");

  return sourceFacts.filter((fact) => {
    if (selection.fund && fact.fund_code !== selection.fund) return false;
    if (selection.fundGroup && fact.fund_group !== selection.fundGroup) return false;
    if (selection.accountType && fact.account_type !== selection.accountType) return false;
    return true;
  });
}

function selectFundTrialBalanceFacts(
  output: DashboardOutput,
  selection: DashboardSelection,
  fund: string
) {
  const hasCrossDimensionFilter = Boolean(
    selection.department ||
      selection.functionCode ||
      selection.acfr ||
      selection.accountType
  );

  if (hasCrossDimensionFilter) {
    return output.dashboardFacts.filter((fact) => fact.fund_code === fund);
  }

  return output.dashboardRawFacts.filter(
    (fact) => fact.summary_type === "fund" && fact.fund_code === fund
  );
}

function summarizeFacts(
  facts: DashboardFinancialFactRow[],
  trialBalanceFacts = facts
): FactSummary {
  const revenues = sumCategory(facts, isRevenueType);
  const expenditures = sumCategory(facts, isExpenditureType);
  const otherFinancingSources = sumCategory(facts, isOtherFinancingSourceType);
  const otherFinancingUses = sumCategory(facts, isOtherFinancingUseType);
  const fundBalanceNetPosition = sumEndingCategory(facts, isFundBalanceOrNetPositionType);
  const cashFacts = facts.filter(isCashOrInvestmentFact);

  return {
    beginningBalance: sumFactAmount(trialBalanceFacts, "beginning_balance"),
    cashAndInvestments:
      cashFacts.length > 0 ? sumFactAmount(cashFacts, "ending_balance") : null,
    endingBalance: sumFactAmount(trialBalanceFacts, "ending_balance"),
    expenditures,
    fundBalanceNetPosition,
    netChange: sumFactAmount(facts, "presentation_amount"),
    netActivity: calculateNetActivity({
      expenditures,
      otherFinancingSources,
      otherFinancingUses,
      revenues
    }),
    otherFinancingSources,
    otherFinancingUses,
    revenues,
    trialBalanceEndingNet: sumFactAmount(trialBalanceFacts, "ending_balance")
  };
}

function sumCategory(
  facts: DashboardFinancialFactRow[],
  predicate: (accountType: string) => boolean
) {
  const matching = facts.filter((fact) => predicate(normalizeKey(fact.account_type)));
  return matching.length > 0 ? sumFactAmount(matching, "presentation_amount") : null;
}

function sumEndingCategory(
  facts: DashboardFinancialFactRow[],
  predicate: (accountType: string) => boolean
) {
  const matching = facts.filter((fact) => predicate(normalizeKey(fact.account_type)));
  return matching.length > 0
    ? matching.reduce(
        (total, fact) =>
          total + endingPresentationAmount(fact.account_type, numericAmount(fact.ending_balance)),
        0
      )
    : null;
}

function calculateNetActivity({
  expenditures,
  otherFinancingSources,
  otherFinancingUses,
  revenues
}: {
  expenditures: number | null;
  otherFinancingSources: number | null;
  otherFinancingUses: number | null;
  revenues: number | null;
}) {
  if (
    revenues === null &&
    expenditures === null &&
    otherFinancingSources === null &&
    otherFinancingUses === null
  ) {
    return null;
  }

  return (
    (revenues ?? 0) +
    (otherFinancingSources ?? 0) -
    (expenditures ?? 0) -
    (otherFinancingUses ?? 0)
  );
}

function sumFactAmount(
  facts: DashboardFinancialFactRow[],
  field: keyof Pick<
    DashboardFinancialFactRow,
    "beginning_balance" | "ending_balance" | "net_change" | "presentation_amount"
  >
) {
  return facts.reduce((total, fact) => total + numericAmount(fact[field]), 0);
}

function isRevenueType(value: string) {
  return value === "revenue" || value === "revenues";
}

function isExpenditureType(value: string) {
  return value === "expenditure" || value === "expenditures" || value === "expense" || value === "expenses";
}

function isOtherFinancingSourceType(value: string) {
  return value === "other_financing_source" || value === "other_financing_sources" || value === "transfer_in" || value === "transfers_in";
}

function isOtherFinancingUseType(value: string) {
  return value === "other_financing_use" || value === "other_financing_uses" || value === "transfer_out" || value === "transfers_out";
}

function isFundBalanceOrNetPositionType(value: string) {
  return value === "fund_balance" || value === "net_position";
}

function endingPresentationAmount(accountType: string | null | undefined, amount: number) {
  return isFundBalanceOrNetPositionType(normalizeKey(accountType)) ? amount * -1 : amount;
}

function isCashOrInvestmentFact(fact: DashboardFinancialFactRow) {
  const balanceLine = normalizeKey(fact.balance_sheet_line);
  const activityLine = normalizeKey(fact.activity_statement_line);
  const accountType = normalizeKey(fact.account_type);
  return (
    balanceLine.includes("cash") ||
    balanceLine.includes("investment") ||
    activityLine.includes("cash") ||
    accountType === "cash" ||
    accountType === "cash_and_investments"
  );
}

function formatMaybeAmount(value: number | null) {
  return value === null ? "Not available" : formatAmount(value);
}

function formatMaterialSort(value: string) {
  return value === "largest_percent" ? "largest percent variance" : "largest dollar variance";
}

function Select({
  children,
  label,
  name,
  value
}: {
  children: ReactNode;
  label: string;
  name: string;
  value: string;
}) {
  return (
    <label className="space-y-2 text-sm font-medium text-foreground">
      {label}
      <select
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        defaultValue={value}
        name={name}
      >
        {children}
      </select>
    </label>
  );
}

function FilterSection({
  children,
  title
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <fieldset className="grid gap-4 rounded-md border border-border bg-muted/30 p-4 md:grid-cols-2">
      <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

function Info({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="break-words text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function MetricCard({
  helper,
  label,
  value
}: {
  helper?: string;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="space-y-1 pt-6">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="text-2xl font-semibold text-foreground">{value}</p>
        {helper ? <p className="text-xs text-muted-foreground">{helper}</p> : null}
      </CardContent>
    </Card>
  );
}

function SimpleTable<T>({
  columns,
  empty,
  rows
}: {
  columns: Array<[string, (row: T) => ReactNode]>;
  empty: string;
  rows: T[];
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            {columns.map(([label]) => (
              <th className="py-3 pr-4 font-medium" key={label}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr className="border-b border-border align-top" key={rowIndex}>
              {columns.map(([label, render]) => (
                <td className="py-3 pr-4 text-muted-foreground" key={label}>
                  {render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReferenceLink({
  referenceTable,
  segmentCode
}: {
  referenceTable: string;
  segmentCode: string | null;
}) {
  const route = getReferenceRoute(referenceTable);
  if (!route) return "Review reference data";
  const addParam = segmentCode
    ? `?add=1&${getCodeParam(referenceTable)}=${encodeURIComponent(segmentCode)}`
    : "";
  return (
    <div className="flex flex-wrap gap-2">
      <Link className="text-primary hover:underline" href={route}>
        Open
      </Link>
      {segmentCode ? (
        <Link className="text-primary hover:underline" href={`${route}${addParam}`}>
          Add
        </Link>
      ) : null}
    </div>
  );
}

function getReferenceRoute(referenceTable: string) {
  const routes: Record<string, string> = {
    acfr_mappings: "/reference-data/acfr",
    departments: "/reference-data/departments",
    functions: "/reference-data/functions",
    funds: "/reference-data/funds",
    objects: "/reference-data/objects"
  };
  return routes[referenceTable] ?? "";
}

function getCodeParam(referenceTable: string) {
  const params: Record<string, string> = {
    acfr_mappings: "acfrCode",
    departments: "departmentCode",
    functions: "functionCode",
    funds: "fundCode",
    objects: "objectCode"
  };
  return params[referenceTable] ?? "code";
}

export function formatActiveFilters(selection: DashboardSelection) {
  const filters = [
    selection.fund ? `Fund ${selection.fund}` : null,
    selection.fundGroup ? `Fund Group ${selection.fundGroup}` : null,
    selection.department ? `Department ${selection.department}` : null,
    selection.functionCode ? `Function ${selection.functionCode}` : null,
    selection.acfr ? `ACFR ${selection.acfr}` : null,
    selection.accountType ? `Account Type ${titleize(selection.accountType)}` : null,
    selection.topN !== 10 ? `Top ${selection.topN}` : null,
    selection.sort !== "largest_amount" ? `Sort ${titleize(selection.sort)}` : null
  ].filter(Boolean);

  return filters.length > 0 ? filters.join("; ") : "None";
}

function numericAmount(value: number | string | null | undefined) {
  const numeric = typeof value === "number" ? value : Number.parseFloat(value ?? "0");
  return Number.isFinite(numeric) ? numeric : 0;
}

function normalizeKey(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replaceAll(" ", "_")
    .replaceAll("-", "_");
}

export function formatReportingScope(value: string) {
  if (value === "cash_reconciliation") return "Include Pooled Cash / Reconciliation";
  if (value === "all_active") return "All Active Funds";
  return "Standard Reporting";
}

function shortId(value: string) {
  return value.slice(0, 8);
}

function titleize(value: string) {
  return value
    .replaceAll("_", " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
