import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatReportingScope } from "@/components/governed-dashboard";
import { ensureAppUserForAuthUser } from "@/lib/auth/app-user";
import { requireUser } from "@/lib/auth/session";
import {
  type CalculationRun,
  type DashboardOutput,
  type DashboardSearchParams,
  type DashboardSelection,
  formatDate,
  loadDashboardModel
} from "@/lib/dashboards/governed-dashboard";
import { createAdminClient } from "@/lib/supabase/admin";

const reportSections = [
  {
    note: "Will use dashboard_financial_facts and statement_summary_results after report drafting is built.",
    purpose: "Frame the month for CFO and governing-body review.",
    title: "Executive Summary"
  },
  {
    note: "Will use statement_summary_results and dashboard_financial_facts.",
    purpose: "Present activity and position statements for the selected period range.",
    title: "Financial Statements"
  },
  {
    note: "Will use dashboard_financial_facts at fund grains.",
    purpose: "Explain fund-level performance and liquidity considerations.",
    title: "Fund Highlights"
  },
  {
    note: "Will use dashboard_financial_facts at department, fund, and function grains.",
    purpose: "Summarize operating-area activity by department and function.",
    title: "Department / Function Highlights"
  },
  {
    note: "Will use variance_results and governed dashboard facts.",
    purpose: "Identify material changes that should be reviewed before drafting.",
    title: "Material Changes"
  },
  {
    note: "Will use exception_results and mapping_coverage_results.",
    purpose: "Surface issues that affect confidence in the monthly report.",
    title: "Exceptions and Data Readiness"
  },
  {
    note: "Will use calculation_runs lineage fields and dependency metadata.",
    purpose: "Show the calculation run, source batches, posting runs, and validation runs behind the report.",
    title: "Traceability"
  }
];

export default async function MonthlyReportPage({
  searchParams
}: {
  searchParams: Promise<DashboardSearchParams>;
}) {
  const authUser = await requireUser();
  const adminClient = createAdminClient();
  const appUser = await ensureAppUserForAuthUser(adminClient, authUser);
  const model = await loadDashboardModel({
    adminClient,
    organizationId: appUser.organization_id,
    searchParams: await searchParams
  });
  const issueCounts = getIssueCounts(model.output);

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
              Workspace shell for preparing monthly financial reporting from
              governed calculation output. This slice shows report context,
              readiness, traceability, and the planned report outline only.
            </p>
          </div>
          <Link
            className="inline-flex rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
            href="/reports"
          >
            Reports Home
          </Link>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <ReportContextCard
            calculationRun={model.calculationRun}
            failedRun={model.failedRun}
            selection={model.selection}
          />
          <ReadinessCard
            calculationRun={model.calculationRun}
            issueCounts={issueCounts}
          />
        </div>

        <TraceabilityCard calculationRun={model.calculationRun} />

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
                      Placeholder
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {section.purpose}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    {section.note}
                  </p>
                  <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Not built in Slice 11A
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}

function ReportContextCard({
  calculationRun,
  failedRun,
  selection
}: {
  calculationRun: CalculationRun | null;
  failedRun: CalculationRun | null;
  selection: DashboardSelection;
}) {
  return (
    <Card>
      <CardHeader>
        <p className="text-sm font-medium text-primary">Report Selection</p>
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
          <div className="rounded-md border border-border bg-muted/20 p-4 text-sm">
            <p className="font-medium text-foreground">
              Calculation run {calculationRun.calculation_run_id.slice(0, 8)}
            </p>
            <p className="mt-1 text-muted-foreground">
              This run is the governed source for the monthly report workspace.
            </p>
          </div>
        ) : (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
            <p className="font-medium">
              No governed calculation output exists for this report selection.
            </p>
            <p className="mt-1">
              Run calculation before drafting this monthly report.
            </p>
            {failedRun ? (
              <p className="mt-2">
                Latest failed run: {failedRun.calculation_run_id.slice(0, 8)}.
                Failed runs are not used as report sources.
              </p>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ReadinessCard({
  calculationRun,
  issueCounts
}: {
  calculationRun: CalculationRun | null;
  issueCounts: ReturnType<typeof getIssueCounts>;
}) {
  const hasWarnings =
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
            This calculation run exists, but warnings or mapping coverage issues
            may affect monthly report drafting.
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
            Traceability is available after a governed calculation run exists.
          </p>
        )}
      </CardContent>
    </Card>
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

function getIssueCounts(output: DashboardOutput) {
  return {
    critical:
      output.exceptions.filter((row) => row.severity_level === "Critical").length +
      output.mappingCoverage.filter((row) => row.severity === "Critical").length,
    warning:
      output.exceptions.filter((row) => row.severity_level === "High").length +
      output.exceptions.filter((row) => row.severity_level === "Warning").length +
      output.mappingCoverage.filter((row) => row.severity === "High").length +
      output.mappingCoverage.filter((row) => row.severity === "Warning").length
  };
}

function titleize(value: string) {
  return value
    .replaceAll("_", " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
