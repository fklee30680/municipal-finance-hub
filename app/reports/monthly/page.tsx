import type { SupabaseClient } from "@supabase/supabase-js";
import Link from "next/link";
import type { ReactNode } from "react";

import { AppShell } from "@/components/app-shell";
import { formatReportingScope } from "@/components/governed-dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ensureAppUserForAuthUser } from "@/lib/auth/app-user";
import { requireUser } from "@/lib/auth/session";
import {
  type CalculationRun,
  formatDate,
  getRunReportingScope
} from "@/lib/dashboards/governed-dashboard";
import { createAdminClient } from "@/lib/supabase/admin";

type MonthlyReportSearchParams = {
  calculationRunId?: string;
  fiscalYear?: string;
  periodFrom?: string;
  periodTo?: string;
  reportingScope?: string;
};

type FiscalPeriodRow = {
  fiscal_year: number;
  period: number;
  period_name: string;
};

type ReportSelection = {
  calculationRunId: string;
  fiscalYear: number;
  periodFrom: number;
  periodTo: number;
  reportingScope: "all_active" | "cash_reconciliation" | "standard";
  timeView: "selected_range";
};

type ReadinessCounts = {
  critical: number;
  warning: number;
};

const eligibleRunStatuses = ["completed", "completed_with_warnings"];

const reportSections = [
  {
    note: "Will use dashboard_financial_facts and statement_summary_results for the selected calculation run after report drafting is built.",
    purpose: "Frame the month for CFO and governing-body review.",
    title: "Executive Summary"
  },
  {
    note: "Will use statement_summary_results and dashboard_financial_facts for the selected calculation run.",
    purpose: "Present activity and position statements for the selected period range.",
    title: "Financial Statements"
  },
  {
    note: "Will use dashboard_financial_facts at fund grains for the selected calculation run.",
    purpose: "Explain fund-level performance and liquidity considerations.",
    title: "Fund Highlights"
  },
  {
    note: "Will use dashboard_financial_facts at department, fund, and function grains for the selected calculation run.",
    purpose: "Summarize operating-area activity by department and function.",
    title: "Department / Function Highlights"
  },
  {
    note: "Will use variance_results and governed dashboard facts for the selected calculation run.",
    purpose: "Identify material changes that should be reviewed before drafting.",
    title: "Material Changes"
  },
  {
    note: "Will use exception_results and mapping_coverage_results for the selected calculation run.",
    purpose: "Surface issues that affect confidence in the monthly report.",
    title: "Exceptions and Data Readiness"
  },
  {
    note: "Will use calculation_runs lineage fields and dependency metadata for the selected calculation run.",
    purpose: "Show the calculation run, source batches, posting runs, and validation runs behind the report.",
    title: "Traceability"
  }
];

export default async function MonthlyReportPage({
  searchParams
}: {
  searchParams: Promise<MonthlyReportSearchParams>;
}) {
  const params = await searchParams;
  const authUser = await requireUser();
  const adminClient = createAdminClient();
  const appUser = await ensureAppUserForAuthUser(adminClient, authUser);
  const fiscalPeriods = await loadFiscalPeriods({
    adminClient,
    organizationId: appUser.organization_id
  });
  const selection = buildReportSelection({ fiscalPeriods, searchParams: params });
  const [eligibleRuns, failedRun] = await Promise.all([
    loadEligibleCalculationRuns({
      adminClient,
      organizationId: appUser.organization_id,
      selection
    }),
    loadLatestFailedRun({
      adminClient,
      organizationId: appUser.organization_id,
      selection
    })
  ]);
  const selectedRun = resolveSelectedRun({
    calculationRunId: selection.calculationRunId,
    eligibleRuns
  });
  const invalidCalculationRunId = Boolean(
    selection.calculationRunId && !eligibleRuns.some(
      (run) => run.calculation_run_id === selection.calculationRunId
    )
  );
  const issueCounts = selectedRun
    ? await loadReadinessCounts({
        adminClient,
        calculationRunId: selectedRun.calculation_run_id,
        organizationId: appUser.organization_id
      })
    : { critical: 0, warning: 0 };

  return (
    <AppShell>
      <section className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-primary">Reports</p>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Monthly Report
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              Select the governed calculation run that will feed this monthly
              report workspace. Report sections remain placeholders in Slice 11B.
            </p>
          </div>
          <Link
            className="inline-flex rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
            href="/reports"
          >
            Reports Home
          </Link>
        </div>

        <ReportSourceSelection
          eligibleRuns={eligibleRuns}
          fiscalPeriods={fiscalPeriods}
          invalidCalculationRunId={invalidCalculationRunId}
          selectedRun={selectedRun}
          selection={selection}
        />

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <ReportContextCard
            calculationRun={selectedRun}
            failedRun={failedRun}
            invalidCalculationRunId={invalidCalculationRunId}
            selection={selection}
          />
          <ReadinessCard
            calculationRun={selectedRun}
            issueCounts={issueCounts}
          />
        </div>

        <TraceabilityCard calculationRun={selectedRun} />

        <ReportOutline available={Boolean(selectedRun)} />
      </section>
    </AppShell>
  );
}

function ReportSourceSelection({
  eligibleRuns,
  fiscalPeriods,
  invalidCalculationRunId,
  selectedRun,
  selection
}: {
  eligibleRuns: CalculationRun[];
  fiscalPeriods: FiscalPeriodRow[];
  invalidCalculationRunId: boolean;
  selectedRun: CalculationRun | null;
  selection: ReportSelection;
}) {
  const fiscalYears = uniqueNumbers(fiscalPeriods.map((period) => period.fiscal_year));
  const periods = fiscalPeriods
    .filter((period) => period.fiscal_year === selection.fiscalYear)
    .sort((a, b) => a.period - b.period);

  return (
    <Card>
      <CardHeader>
        <p className="text-sm font-medium text-primary">Report Source</p>
        <CardTitle>Data-Source Selection</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-[repeat(5,minmax(0,1fr))_auto]" method="get">
          <Select label="Fiscal year" name="fiscalYear" value={String(selection.fiscalYear)}>
            {fiscalYears.map((year) => (
              <option key={year} value={year}>
                FY {year}
              </option>
            ))}
          </Select>
          <Select label="Period from" name="periodFrom" value={String(selection.periodFrom)}>
            {periods.map((period) => (
              <option key={period.period} value={period.period}>
                P{period.period} - {period.period_name}
              </option>
            ))}
          </Select>
          <Select label="Period to" name="periodTo" value={String(selection.periodTo)}>
            {periods.map((period) => (
              <option key={period.period} value={period.period}>
                P{period.period} - {period.period_name}
              </option>
            ))}
          </Select>
          <Select label="Reporting scope" name="reportingScope" value={selection.reportingScope}>
            <option value="standard">Standard Reporting</option>
            <option value="cash_reconciliation">Include Pooled Cash / Reconciliation</option>
            <option value="all_active">All Active Funds</option>
          </Select>
          <Select
            disabled={eligibleRuns.length === 0}
            label="Calculation run"
            name="calculationRunId"
            value={selectedRun?.calculation_run_id ?? ""}
          >
            {eligibleRuns.length === 0 ? (
              <option value="">No eligible runs</option>
            ) : (
              eligibleRuns.map((run) => (
                <option key={run.calculation_run_id} value={run.calculation_run_id}>
                  {formatRunOption(run)}
                </option>
              ))
            )}
          </Select>
          <div className="flex items-end">
            <button className="h-10 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring">
              Apply
            </button>
          </div>
        </form>

        <div className="rounded-md border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
          {eligibleRuns.length > 0 ? (
            <>
              {eligibleRuns.length} eligible governed calculation run
              {eligibleRuns.length === 1 ? "" : "s"} available for this selection.
              Failed, running, queued, cancelled, draft, and unknown-status runs are not selectable.
            </>
          ) : (
            "No governed calculation run exists for this report selection. Run calculation before drafting this monthly report."
          )}
        </div>

        {invalidCalculationRunId ? (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
            The requested calculation run is not eligible for this report selection.
            It may belong to a different period, reporting scope, organization, or status.
            The workspace fell back to the default eligible run when available.
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ReportContextCard({
  calculationRun,
  failedRun,
  invalidCalculationRunId,
  selection
}: {
  calculationRun: CalculationRun | null;
  failedRun: CalculationRun | null;
  invalidCalculationRunId: boolean;
  selection: ReportSelection;
}) {
  return (
    <Card>
      <CardHeader>
        <p className="text-sm font-medium text-primary">Selected Source</p>
        <CardTitle>Governed Calculation Context</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <InfoGrid
          items={[
            ["Fiscal year", `FY ${selection.fiscalYear}`],
            ["Period range", `P${selection.periodFrom}-P${selection.periodTo}`],
            ["Reporting scope", formatReportingScope(selection.reportingScope)],
            ["Time view", titleize(selection.timeView)]
          ]}
        />

        {calculationRun ? (
          <InfoGrid
            items={[
              ["Selected calculation run", calculationRun.calculation_run_id],
              ["Short ID", calculationRun.calculation_run_id.slice(0, 8)],
              ["Run status", calculationRun.run_status],
              ["Completed at", formatDate(calculationRun.completed_at)],
              ["Calculation version", calculationRun.calculation_version ?? "Not available"],
              ["Mapping coverage", calculationRun.mapping_coverage_status ?? "Not available"],
              ["Source import batches", calculationRun.source_import_batch_ids?.length ?? 0],
              ["Posting runs", calculationRun.posting_run_ids?.length ?? 0],
              ["Validation runs", calculationRun.validation_run_ids?.length ?? 0]
            ]}
          />
        ) : (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
            <p className="font-medium">
              No governed calculation run exists for this report selection.
            </p>
            <p className="mt-1">
              Run calculation before drafting this monthly report.
            </p>
          </div>
        )}

        {failedRun ? (
          <div className="rounded-md border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
            Latest failed matching run: {failedRun.calculation_run_id.slice(0, 8)}.
            Failed runs are shown for context only and are not selectable as report sources.
          </div>
        ) : null}

        {invalidCalculationRunId ? (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
            Invalid calculationRunId query parameter ignored.
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ReadinessCard({
  calculationRun,
  issueCounts
}: {
  calculationRun: CalculationRun | null;
  issueCounts: ReadinessCounts;
}) {
  const hasWarnings =
    calculationRun?.run_status === "completed_with_warnings" ||
    issueCounts.critical > 0 ||
    issueCounts.warning > 0 ||
    calculationRun?.mapping_coverage_status === "Incomplete";

  return (
    <Card>
      <CardHeader>
        <p className="text-sm font-medium text-primary">Data Readiness</p>
        <CardTitle>{calculationRun ? "Calculation Available" : "Run Required"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <InfoGrid
          items={[
            ["Calculation status", calculationRun?.run_status ?? "Missing"],
            ["Mapping coverage", calculationRun?.mapping_coverage_status ?? "Not available"],
            ["Critical exceptions", issueCounts.critical],
            ["Warnings", issueCounts.warning],
            ["Last calculated", formatDate(calculationRun?.completed_at)]
          ]}
        />
        {calculationRun && hasWarnings ? (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
            This calculation run is available, but warnings, critical exceptions,
            or mapping coverage issues may affect monthly report drafting.
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function TraceabilityCard({
  calculationRun
}: {
  calculationRun: CalculationRun | null;
}) {
  return (
    <Card>
      <CardHeader>
        <p className="text-sm font-medium text-primary">Traceability</p>
        <CardTitle>Report Source Lineage</CardTitle>
      </CardHeader>
      <CardContent>
        {calculationRun ? (
          <InfoGrid
            items={[
              ["Calculation run ID", calculationRun.calculation_run_id],
              ["Calculation version", calculationRun.calculation_version ?? "Not available"],
              ["Source import batches", calculationRun.source_import_batch_ids?.length ?? 0],
              ["Posting runs", calculationRun.posting_run_ids?.length ?? 0],
              ["Validation runs", calculationRun.validation_run_ids?.length ?? 0],
              [
                "Dependency manifest",
                calculationRun.dependency_manifest ? "Recorded" : "Not recorded"
              ]
            ]}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Traceability is available after an eligible governed calculation run is selected.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ReportOutline({ available }: { available: boolean }) {
  return (
    <Card>
      <CardHeader>
        <p className="text-sm font-medium text-primary">Report Outline</p>
        <CardTitle>Placeholder Monthly Report Sections</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          {reportSections.map((section) => (
            <div
              className="rounded-md border border-dashed border-border bg-muted/20 p-4"
              key={section.title}
            >
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold text-foreground">
                  {section.title}
                </h2>
                <span className="rounded-full border border-border bg-card px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {available ? "Placeholder" : "Unavailable"}
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {section.purpose}
              </p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                {section.note}
              </p>
              <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {available
                  ? "Not built in Slice 11B"
                  : "Requires an eligible governed calculation run"}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function Select({
  children,
  disabled,
  label,
  name,
  value
}: {
  children: ReactNode;
  disabled?: boolean;
  label: string;
  name: string;
  value: string;
}) {
  return (
    <label className="space-y-1 text-sm font-medium text-foreground">
      <span>{label}</span>
      <select
        className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
        disabled={disabled}
        name={name}
        value={value}
      >
        {children}
      </select>
    </label>
  );
}

function InfoGrid({ items }: { items: Array<[string, string | number]> }) {
  return (
    <div className="grid gap-3 text-sm md:grid-cols-2">
      {items.map(([label, value]) => (
        <div className="rounded-md border border-border bg-background p-3" key={label}>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-1 break-words font-medium text-foreground">{value}</p>
        </div>
      ))}
    </div>
  );
}

async function loadFiscalPeriods({
  adminClient,
  organizationId
}: {
  adminClient: SupabaseClient;
  organizationId: string;
}) {
  const result = await adminClient
    .from("fiscal_periods")
    .select("fiscal_year, period, period_name")
    .eq("organization_id", organizationId)
    .order("fiscal_year", { ascending: false })
    .order("period", { ascending: false })
    .limit(200)
    .returns<FiscalPeriodRow[]>();

  if (result.error) {
    throw new Error(result.error.message);
  }

  return result.data ?? [];
}

async function loadEligibleCalculationRuns({
  adminClient,
  organizationId,
  selection
}: {
  adminClient: SupabaseClient;
  organizationId: string;
  selection: ReportSelection;
}) {
  const result = await adminClient
    .from("calculation_runs")
    .select(calculationRunSelect)
    .eq("organization_id", organizationId)
    .eq("fiscal_year", selection.fiscalYear)
    .eq("period_from", selection.periodFrom)
    .eq("period_to", selection.periodTo)
    .eq("time_view", selection.timeView)
    .in("run_status", eligibleRunStatuses)
    .order("is_current", { ascending: false })
    .order("completed_at", { ascending: false, nullsFirst: false })
    .limit(25)
    .returns<CalculationRun[]>();

  if (result.error) {
    throw new Error(result.error.message);
  }

  return (result.data ?? []).filter(
    (run) => getRunReportingScope(run) === selection.reportingScope
  );
}

async function loadLatestFailedRun({
  adminClient,
  organizationId,
  selection
}: {
  adminClient: SupabaseClient;
  organizationId: string;
  selection: ReportSelection;
}) {
  const result = await adminClient
    .from("calculation_runs")
    .select(calculationRunSelect)
    .eq("organization_id", organizationId)
    .eq("fiscal_year", selection.fiscalYear)
    .eq("period_from", selection.periodFrom)
    .eq("period_to", selection.periodTo)
    .eq("time_view", selection.timeView)
    .eq("run_status", "failed")
    .order("completed_at", { ascending: false, nullsFirst: false })
    .order("triggered_at", { ascending: false, nullsFirst: false })
    .limit(10)
    .returns<CalculationRun[]>();

  if (result.error) {
    throw new Error(result.error.message);
  }

  return (
    (result.data ?? []).find(
      (run) => getRunReportingScope(run) === selection.reportingScope
    ) ?? null
  );
}

async function loadReadinessCounts({
  adminClient,
  calculationRunId,
  organizationId
}: {
  adminClient: SupabaseClient;
  calculationRunId: string;
  organizationId: string;
}): Promise<ReadinessCounts> {
  const [
    criticalExceptions,
    warningExceptions,
    criticalMapping,
    warningMapping
  ] = await Promise.all([
    countRows(
      adminClient
        .from("exception_results")
        .select("exception_result_id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("calculation_run_id", calculationRunId)
        .eq("severity_level", "Critical")
    ),
    countRows(
      adminClient
        .from("exception_results")
        .select("exception_result_id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("calculation_run_id", calculationRunId)
        .in("severity_level", ["High", "Warning"])
    ),
    countRows(
      adminClient
        .from("mapping_coverage_results")
        .select("mapping_coverage_result_id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("calculation_run_id", calculationRunId)
        .eq("severity", "Critical")
    ),
    countRows(
      adminClient
        .from("mapping_coverage_results")
        .select("mapping_coverage_result_id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("calculation_run_id", calculationRunId)
        .in("severity", ["High", "Warning"])
    )
  ]);

  return {
    critical: criticalExceptions + criticalMapping,
    warning: warningExceptions + warningMapping
  };
}

async function countRows(query: PromiseLike<{ count: number | null; error: { message: string } | null }>) {
  const result = await query;
  if (result.error) {
    throw new Error(result.error.message);
  }
  return result.count ?? 0;
}

function buildReportSelection({
  fiscalPeriods,
  searchParams
}: {
  fiscalPeriods: FiscalPeriodRow[];
  searchParams: MonthlyReportSearchParams;
}): ReportSelection {
  const defaultPeriod = fiscalPeriods[0];
  const fiscalYear =
    integer(searchParams.fiscalYear) ??
    defaultPeriod?.fiscal_year ??
    new Date().getFullYear();
  const periodTo = integer(searchParams.periodTo) ?? defaultPeriod?.period ?? 1;
  const periodFrom = integer(searchParams.periodFrom) ?? periodTo;

  return {
    calculationRunId: searchParams.calculationRunId ?? "",
    fiscalYear,
    periodFrom,
    periodTo,
    reportingScope: getAllowed(
      searchParams.reportingScope,
      ["all_active", "cash_reconciliation", "standard"],
      "standard"
    ),
    timeView: "selected_range"
  };
}

function resolveSelectedRun({
  calculationRunId,
  eligibleRuns
}: {
  calculationRunId: string;
  eligibleRuns: CalculationRun[];
}) {
  if (calculationRunId) {
    const requested = eligibleRuns.find(
      (run) => run.calculation_run_id === calculationRunId
    );
    if (requested) return requested;
  }

  return eligibleRuns[0] ?? null;
}

function formatRunOption(run: CalculationRun) {
  return [
    run.calculation_run_id.slice(0, 8),
    run.run_status,
    formatDate(run.completed_at),
    run.calculation_version ?? "version not available",
    run.mapping_coverage_status ?? "mapping not available",
    run.is_current ? "current" : "not current"
  ].join(" / ");
}

function uniqueNumbers(values: number[]) {
  return Array.from(new Set(values)).sort((a, b) => b - a);
}

function getAllowed<T extends string>(
  value: string | undefined,
  allowed: T[],
  fallback: T
) {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function integer(value: string | undefined) {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function titleize(value: string) {
  return value
    .replaceAll("_", " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

const calculationRunSelect =
  "calculation_run_id, fiscal_year, period, period_from, period_to, time_view, run_status, is_current, is_stale, calculation_version, source_import_batch_ids, posting_run_ids, validation_run_ids, mapping_coverage_status, dependency_manifest, parameters, parameters_snapshot, error_message, triggered_at, completed_at";
