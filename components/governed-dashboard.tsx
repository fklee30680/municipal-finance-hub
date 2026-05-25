import Link from "next/link";
import type { ReactNode } from "react";

import { DashboardRunCalculationForm } from "@/components/dashboard-run-calculation-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type CalculationRun,
  type DashboardOptions,
  type DashboardOutput,
  type DashboardSelection,
  type DashboardView,
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
    <Card>
      <CardHeader>
        <CardTitle>Dashboard Filters</CardTitle>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
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

  return (
    <Card
      className={
        !calculationRun
          ? "border-destructive/30 bg-destructive/10"
          : calculationRun.run_status === "completed_with_warnings" ||
              calculationRun.mapping_coverage_status !== "Complete"
            ? "border-border bg-muted"
            : "border-border bg-card"
      }
    >
      <CardContent className="space-y-4 pt-6">
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
      </CardContent>
    </Card>
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

export function SummaryCards({
  output,
  selection
}: {
  output: DashboardOutput;
  selection: DashboardSelection;
}) {
  const fundRows = output.financialSummaries.filter((row) => row.summary_type === "fund");
  const hasDisplayFilter = Boolean(
    selection.fund ||
      selection.fundGroup ||
      selection.department ||
      selection.functionCode ||
      selection.acfr ||
      selection.accountType
  );
  const all = output.financialSummaries.find((row) => row.summary_key === "all");
  const revenue = findSummary(output, ["revenue", "revenues"]);
  const expenditures = findSummary(output, [
    "expenditure",
    "expenditures",
    "expense",
    "expenses"
  ]);
  const cash = findSummary(output, ["cash", "cash_and_investments", "cash investments"]);
  const fundNetChange =
    (selection.fund || selection.fundGroup) && fundRows.length > 0
      ? fundRows.reduce(
          (total, row) => total + numericAmount(row.presentation_amount ?? row.net_change),
          0
        )
      : null;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        helper={hasDisplayFilter ? "Selected dashboard filters" : undefined}
        label="Net change"
        value={
          selection.fund || selection.fundGroup
            ? fundNetChange === null
              ? "Not available"
              : formatAmount(fundNetChange)
            : formatAmount(all?.presentation_amount ?? all?.net_change)
        }
      />
      <MetricCard
        helper={hasDisplayFilter ? "Filtered governed facts" : undefined}
        label="Total revenues"
        value={revenue ? formatAmount(revenue.presentation_amount) : "Not available"}
      />
      <MetricCard
        helper={hasDisplayFilter ? "Filtered governed facts" : undefined}
        label="Total expenditures / expenses"
        value={expenditures ? formatAmount(expenditures.presentation_amount) : "Not available"}
      />
      <MetricCard
        helper={hasDisplayFilter ? "Filtered governed facts" : undefined}
        label="Cash / investments"
        value={cash ? formatAmount(cash.ending_balance ?? cash.presentation_amount) : "Not available"}
      />
    </div>
  );
}

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

export function FundsView({ output }: { output: DashboardOutput }) {
  const rows = output.financialSummaries.filter((row) => row.summary_type === "fund");
  return (
    <Card>
      <CardHeader>
        <CardTitle>Fund Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <SimpleTable
          empty="No fund-level summary rows are available for this calculation."
          rows={rows}
          columns={[
            ["Fund", (row) => row.summary_key],
            ["Beginning", (row) => formatAmount(row.beginning_balance)],
            ["Net Change", (row) => formatAmount(row.presentation_amount ?? row.net_change)],
            ["Ending", (row) => formatAmount(row.ending_balance)]
          ]}
        />
      </CardContent>
    </Card>
  );
}

export function VariancesView({ output }: { output: DashboardOutput }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Largest Variances</CardTitle>
      </CardHeader>
      <CardContent>
        <SimpleTable
          empty="No variance rows are available for this calculation."
          rows={output.variances}
          columns={[
            ["Object", (row) => row.object_code ?? row.variance_key],
            ["Type", (row) => titleize(row.variance_type ?? "variance")],
            ["Current", (row) => formatAmount(row.current_amount)],
            ["Comparison", (row) => formatAmount(row.comparison_amount)],
            ["Variance", (row) => formatAmount(row.variance_amount)],
            ["Percent", (row) => formatPercent(row.variance_percent)],
            ["Severity", (row) => row.severity ?? "Not classified"]
          ]}
        />
      </CardContent>
    </Card>
  );
}

export function ExceptionsView({ output }: { output: DashboardOutput }) {
  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Exceptions</CardTitle>
        </CardHeader>
        <CardContent>
          <SimpleTable
            empty="No exception rows are available for this calculation."
            rows={output.exceptions}
            columns={[
              ["Severity", (row) => row.severity_level ?? "Not classified"],
              ["Category", (row) => titleize(row.exception_category ?? "exception")],
              ["Type", (row) => titleize(row.exception_type ?? "review")],
              ["Message", (row) => row.message ?? "No message"],
              ["Action", (row) => row.recommended_review_action ?? "Review calculation output"]
            ]}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Mapping Coverage</CardTitle>
        </CardHeader>
        <CardContent>
          <SimpleTable
            empty="No mapping coverage issues are available for this calculation."
            rows={output.mappingCoverage}
            columns={[
              ["Severity", (row) => row.severity],
              ["Segment", (row) => `${row.segment_type}: ${row.segment_code ?? "Not provided"}`],
              ["Reference", (row) => row.reference_table],
              ["Issue", (row) => titleize(row.coverage_issue_type)],
              ["Rows", (row) => row.affected_row_count],
              ["Amount", (row) => formatAmount(row.affected_amount)],
              [
                "Action",
                (row) => (
                  <ReferenceLink referenceTable={row.reference_table} segmentCode={row.segment_code} />
                )
              ]
            ]}
          />
        </CardContent>
      </Card>
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

function findSummary(output: DashboardOutput, keys: string[]) {
  const normalizedKeys = new Set(keys.map((key) => key.toLowerCase()));
  return output.financialSummaries.find((row) =>
    normalizedKeys.has(String(row.summary_key ?? "").toLowerCase())
  );
}

function formatActiveFilters(selection: DashboardSelection) {
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

function formatReportingScope(value: string) {
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
