import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { CalculationRunForm } from "@/components/calculation-run-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ensureAppUserForAuthUser } from "@/lib/auth/app-user";
import { requireUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

type CalculationRunRow = {
  calculation_run_id: string;
  fiscal_year: number | null;
  period: number | null;
  period_from: number | null;
  period_to: number | null;
  time_view: string | null;
  run_status: string;
  is_current: boolean;
  is_stale: boolean;
  calculation_version: string;
  source_import_batch_ids: string[];
  posting_run_ids: string[];
  validation_run_ids: string[];
  account_structure_id: string | null;
  threshold_config_id: string | null;
  sign_convention_config_id: string | null;
  mapping_coverage_status: string | null;
  dependency_manifest: Record<string, unknown> | null;
  error_message: string | null;
  triggered_at: string | null;
  completed_at: string | null;
};

type MappingCoverageRow = {
  mapping_coverage_result_id: string;
  segment_type: string;
  segment_code: string | null;
  reference_table: string;
  coverage_issue_type: string;
  severity: string;
  affected_row_count: number;
  affected_amount: number | string;
  message: string;
  recommended_action: string | null;
};

type ExceptionRow = {
  exception_result_id: string;
  exception_category: string | null;
  exception_type: string | null;
  severity_level: string | null;
  message: string | null;
  recommended_review_action: string | null;
};

type SummaryRow = {
  financial_summary_result_id: string;
  summary_type: string | null;
  summary_scope: string;
  summary_key: string;
  amount_type: string | null;
  amount_value: number | string | null;
  presentation_amount: number | string | null;
};

type DefaultPeriodRow = {
  fiscal_year: number;
  period: number;
};

export default async function CalculationRunsPage({
  searchParams
}: {
  searchParams: Promise<{ calculationRunId?: string }>;
}) {
  const { calculationRunId } = await searchParams;
  const authUser = await requireUser();
  const adminClient = createAdminClient();
  const appUser = await ensureAppUserForAuthUser(adminClient, authUser);
  const [runsResult, defaultPeriodResult] = await Promise.all([
    adminClient
      .from("calculation_runs")
      .select(
        "calculation_run_id, fiscal_year, period, period_from, period_to, time_view, run_status, is_current, is_stale, calculation_version, source_import_batch_ids, posting_run_ids, validation_run_ids, account_structure_id, threshold_config_id, sign_convention_config_id, mapping_coverage_status, dependency_manifest, error_message, triggered_at, completed_at"
      )
      .eq("organization_id", appUser.organization_id)
      .order("created_at", { ascending: false })
      .limit(25)
      .returns<CalculationRunRow[]>(),
    adminClient
      .from("active_trial_balance_lines")
      .select("fiscal_year, period")
      .eq("organization_id", appUser.organization_id)
      .order("fiscal_year", { ascending: false })
      .order("period", { ascending: false })
      .limit(1)
      .maybeSingle<DefaultPeriodRow>()
  ]);
  const runs = runsResult.data ?? [];
  const selectedRun = calculationRunId
    ? runs.find((run) => run.calculation_run_id === calculationRunId) ?? runs[0] ?? null
    : runs[0] ?? null;
  const [coverageResult, exceptionsResult, summariesResult] = selectedRun
    ? await Promise.all([
        adminClient
          .from("mapping_coverage_results")
          .select(
            "mapping_coverage_result_id, segment_type, segment_code, reference_table, coverage_issue_type, severity, affected_row_count, affected_amount, message, recommended_action"
          )
          .eq("organization_id", appUser.organization_id)
          .eq("calculation_run_id", selectedRun.calculation_run_id)
          .order("severity", { ascending: true })
          .limit(50)
          .returns<MappingCoverageRow[]>(),
        adminClient
          .from("exception_results")
          .select(
            "exception_result_id, exception_category, exception_type, severity_level, message, recommended_review_action"
          )
          .eq("organization_id", appUser.organization_id)
          .eq("calculation_run_id", selectedRun.calculation_run_id)
          .order("created_at", { ascending: false })
          .limit(50)
          .returns<ExceptionRow[]>(),
        adminClient
          .from("financial_summary_results")
          .select(
            "financial_summary_result_id, summary_type, summary_scope, summary_key, amount_type, amount_value, presentation_amount"
          )
          .eq("organization_id", appUser.organization_id)
          .eq("calculation_run_id", selectedRun.calculation_run_id)
          .order("summary_scope", { ascending: true })
          .limit(50)
          .returns<SummaryRow[]>()
      ])
    : [null, null, null];

  const defaultFiscalYear =
    defaultPeriodResult.data?.fiscal_year ?? new Date().getFullYear();
  const defaultPeriod = defaultPeriodResult.data?.period ?? 1;
  const schemaMigrationMissing = isMissingCalculationSchemaError(
    runsResult.error?.message
  );

  return (
    <AppShell>
      <section className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-primary">Analysis</p>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Calculation Runs
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              Run and review governed calculation outputs from posted active
              trial balance data. This page is not a CFO dashboard, report
              draft, export workflow, budget module, or AI commentary machine.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              className="inline-flex items-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
              href="/imports/periods"
            >
              Period Review
            </Link>
            <Link
              className="inline-flex items-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
              href="/imports/reference"
            >
              Reference Imports
            </Link>
          </div>
        </div>

        <Card className="border-border bg-muted">
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-foreground">
              Calculation inputs are restricted to posted active trial balance
              rows. Raw uploads, previews, validation rows, unposted imports,
              inactive imports, superseded imports, dashboards, reports,
              budgets, and commentary stay out of this slice.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Run calculation</CardTitle>
          </CardHeader>
          <CardContent>
            {schemaMigrationMissing ? (
              <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                The calculation page code is deployed, but the Slice 9 Supabase
                migration is not applied yet. Supabase is missing calculation
                columns such as <code>calculation_runs.period_from</code>.
                Apply the Slice 9 analysis outputs migration, then rerun the
                calculation.
              </div>
            ) : null}
            <CalculationRunForm
              defaultFiscalYear={defaultFiscalYear}
              defaultPeriod={defaultPeriod}
              disabledReason={
                schemaMigrationMissing
                  ? "Apply the Slice 9 analysis outputs migration in Supabase before running calculations."
                  : undefined
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent calculation runs</CardTitle>
          </CardHeader>
          <CardContent>
            {runsResult.error ? (
              <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
                Calculation runs could not be loaded: {runsResult.error.message}
              </p>
            ) : null}
            {!runsResult.error && runs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No calculation runs have been created yet.
              </p>
            ) : null}
            {runs.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="py-3 pr-4 font-medium">Fiscal year</th>
                      <th className="py-3 pr-4 font-medium">Range</th>
                      <th className="py-3 pr-4 font-medium">Time view</th>
                      <th className="py-3 pr-4 font-medium">Status</th>
                      <th className="py-3 pr-4 font-medium">Current/stale</th>
                      <th className="py-3 pr-4 font-medium">Version</th>
                      <th className="py-3 pr-4 font-medium">Mapping coverage</th>
                      <th className="py-3 pr-4 font-medium">Triggered</th>
                      <th className="py-3 font-medium">Review</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map((run) => (
                      <tr
                        className="border-b border-border align-top"
                        key={run.calculation_run_id}
                      >
                        <td className="py-3 pr-4 text-muted-foreground">
                          {run.fiscal_year ?? "Not provided"}
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {run.period_from ?? run.period ?? "-"} to{" "}
                          {run.period_to ?? run.period ?? "-"}
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {run.time_view ?? "Not provided"}
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {run.run_status}
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {run.is_current ? "Current" : "Superseded"}
                          {run.is_stale ? " / stale" : ""}
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {run.calculation_version}
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {run.mapping_coverage_status ?? "Not generated"}
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {run.triggered_at ? formatDate(run.triggered_at) : "Not available"}
                        </td>
                        <td className="py-3">
                          <Link
                            className="text-sm font-medium text-primary hover:underline"
                            href={`/analysis/calculation-runs?calculationRunId=${run.calculation_run_id}`}
                          >
                            Review output
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {selectedRun ? (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Selected run context</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 text-sm md:grid-cols-4">
                <InfoItem label="Calculation run ID" value={selectedRun.calculation_run_id} />
                <InfoItem label="Status" value={selectedRun.run_status} />
                <InfoItem
                  label="Trial balance source batches"
                  value={selectedRun.source_import_batch_ids?.join(", ") || "None recorded"}
                />
                <InfoItem
                  label="Posting runs"
                  value={selectedRun.posting_run_ids?.join(", ") || "None recorded"}
                />
                <InfoItem
                  label="Validation runs"
                  value={selectedRun.validation_run_ids?.join(", ") || "None recorded"}
                />
                <InfoItem
                  label="Account structure"
                  value={selectedRun.account_structure_id ?? "Not recorded"}
                />
                <InfoItem
                  label="Threshold config"
                  value={selectedRun.threshold_config_id ?? "MVP default"}
                />
                <InfoItem
                  label="Sign convention"
                  value={selectedRun.sign_convention_config_id ?? "MVP default"}
                />
              </CardContent>
              {selectedRun.error_message ? (
                <CardContent>
                  <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {selectedRun.error_message}
                  </p>
                </CardContent>
              ) : null}
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Mapping coverage review</CardTitle>
              </CardHeader>
              <CardContent>
                {coverageResult?.error ? (
                  <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
                    Mapping coverage could not be loaded: {coverageResult.error.message}
                  </p>
                ) : null}
                {!coverageResult?.error && (coverageResult?.data ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No mapping coverage issues were recorded for this run.
                  </p>
                ) : null}
                {(coverageResult?.data ?? []).length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1000px] border-collapse text-left text-sm">
                      <thead>
                        <tr className="border-b border-border text-muted-foreground">
                          <th className="py-3 pr-4 font-medium">Segment type</th>
                          <th className="py-3 pr-4 font-medium">Code</th>
                          <th className="py-3 pr-4 font-medium">Reference table</th>
                          <th className="py-3 pr-4 font-medium">Issue</th>
                          <th className="py-3 pr-4 font-medium">Severity</th>
                          <th className="py-3 pr-4 font-medium">Rows</th>
                          <th className="py-3 pr-4 font-medium">Amount</th>
                          <th className="py-3 font-medium">Message</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(coverageResult?.data ?? []).map((row) => (
                          <tr
                            className="border-b border-border align-top"
                            key={row.mapping_coverage_result_id}
                          >
                            <td className="py-3 pr-4 text-muted-foreground">{row.segment_type}</td>
                            <td className="py-3 pr-4 text-muted-foreground">{row.segment_code}</td>
                            <td className="py-3 pr-4 text-muted-foreground">{row.reference_table}</td>
                            <td className="py-3 pr-4 text-muted-foreground">{row.coverage_issue_type}</td>
                            <td className="py-3 pr-4 text-muted-foreground">{row.severity}</td>
                            <td className="py-3 pr-4 text-muted-foreground">{row.affected_row_count}</td>
                            <td className="py-3 pr-4 text-muted-foreground">
                              {formatAmount(row.affected_amount)}
                            </td>
                            <td className="py-3 text-muted-foreground">{row.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Financial summary output</CardTitle>
              </CardHeader>
              <CardContent>
                {(summariesResult?.data ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No summary rows are available for this run.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[800px] border-collapse text-left text-sm">
                      <thead>
                        <tr className="border-b border-border text-muted-foreground">
                          <th className="py-3 pr-4 font-medium">Summary type</th>
                          <th className="py-3 pr-4 font-medium">Key</th>
                          <th className="py-3 pr-4 font-medium">Amount type</th>
                          <th className="py-3 pr-4 font-medium">Raw amount</th>
                          <th className="py-3 font-medium">Presentation amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(summariesResult?.data ?? []).map((row) => (
                          <tr
                            className="border-b border-border"
                            key={row.financial_summary_result_id}
                          >
                            <td className="py-3 pr-4 text-muted-foreground">
                              {row.summary_type ?? row.summary_scope}
                            </td>
                            <td className="py-3 pr-4 text-muted-foreground">{row.summary_key}</td>
                            <td className="py-3 pr-4 text-muted-foreground">{row.amount_type}</td>
                            <td className="py-3 pr-4 text-muted-foreground">
                              {formatAmount(row.amount_value)}
                            </td>
                            <td className="py-3 text-muted-foreground">
                              {formatAmount(row.presentation_amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Exception output</CardTitle>
              </CardHeader>
              <CardContent>
                {(exceptionsResult?.data ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No exception rows are available for this run.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px] border-collapse text-left text-sm">
                      <thead>
                        <tr className="border-b border-border text-muted-foreground">
                          <th className="py-3 pr-4 font-medium">Category</th>
                          <th className="py-3 pr-4 font-medium">Type</th>
                          <th className="py-3 pr-4 font-medium">Severity</th>
                          <th className="py-3 pr-4 font-medium">Message</th>
                          <th className="py-3 font-medium">Recommended action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(exceptionsResult?.data ?? []).map((row) => (
                          <tr
                            className="border-b border-border align-top"
                            key={row.exception_result_id}
                          >
                            <td className="py-3 pr-4 text-muted-foreground">{row.exception_category}</td>
                            <td className="py-3 pr-4 text-muted-foreground">{row.exception_type}</td>
                            <td className="py-3 pr-4 text-muted-foreground">{row.severity_level}</td>
                            <td className="py-3 pr-4 text-muted-foreground">{row.message}</td>
                            <td className="py-3 text-muted-foreground">
                              {row.recommended_review_action}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        ) : null}
      </section>
    </AppShell>
  );
}

function isMissingCalculationSchemaError(message: string | undefined) {
  const normalized = message?.toLowerCase() ?? "";
  return (
    normalized.includes("calculation_runs.period_from") ||
    normalized.includes("column calculation_runs.period_from does not exist") ||
    normalized.includes("mapping_coverage_results") ||
    normalized.includes("sign_convention_configs")
  );
}

function InfoItem({
  label,
  value
}: {
  label: string;
  value: number | string | null | undefined;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="break-words text-sm font-medium text-foreground">
        {value ?? "Not available"}
      </p>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatAmount(value: number | string | null | undefined) {
  const numeric = typeof value === "number" ? value : Number.parseFloat(value ?? "0");
  return Number.isNaN(numeric)
    ? "0.00"
    : new Intl.NumberFormat("en-US", {
        maximumFractionDigits: 2,
        minimumFractionDigits: 2
      }).format(numeric);
}
