import type { ReactNode } from "react";

import { AppShell } from "@/components/app-shell";
import { DashboardContainer } from "@/components/dashboard-container";
import { DepartmentFunctionHierarchyView } from "@/components/department-function-dashboard-view";
import {
  DashboardFilterBar,
  DashboardFilterNotes,
  DashboardNav,
  DataReadinessBanner,
  ExceptionsView,
  FinancialStatementsView,
  formatActiveFilters,
  formatReportingScope,
  FundsView,
  MaterialChangesView,
  ExecutiveFinancialPositionView,
  TraceabilityCard,
} from "@/components/governed-dashboard";
import { ensureAppUserForAuthUser } from "@/lib/auth/app-user";
import { requireUser } from "@/lib/auth/session";
import {
  type DashboardOutput,
  type DashboardSearchParams,
  type DashboardSelection,
  type DashboardView,
  formatAmount,
  formatDate,
  loadDashboardModel
} from "@/lib/dashboards/governed-dashboard";
import { createAdminClient } from "@/lib/supabase/admin";

const viewCopy: Record<
  DashboardView,
  {
    description: string;
    title: string;
  }
> = {
  cfo_overview: {
    description:
      "Review governed Slice 9 calculation outputs, data readiness, key totals, and exceptions for the selected period range.",
    title: "CFO Overview"
  },
  exceptions: {
    description:
      "Review exceptions, mapping coverage, missing reference data, inactive mappings, and calculation readiness items.",
    title: "Exceptions and Data Readiness"
  },
  financial_statements: {
    description:
      "Review governed balance sheet and activity statement rollups from calculation output tables.",
    title: "Financial Statements"
  },
  funds: {
    description:
      "Review fund-level governed outputs while respecting fund reporting scope controls.",
    title: "Funds Dashboard"
  },
  variances: {
    description:
      "Review largest dollar and percentage variances plus trends from governed calculation outputs.",
    title: "Variances Dashboard"
  }
};

export async function GovernedDashboardPage({
  searchParams,
  view
}: {
  searchParams: DashboardSearchParams;
  view: DashboardView;
}) {
  const authUser = await requireUser();
  const adminClient = createAdminClient();
  const appUser = await ensureAppUserForAuthUser(adminClient, authUser);
  const model = await loadDashboardModel({
    adminClient,
    organizationId: appUser.organization_id,
    searchParams
  });
  const copy = viewCopy[view];
  const issueCounts = getIssueCounts(model.output);
  const hasIssues = issueCounts.critical > 0 || issueCounts.warning > 0;

  return (
    <AppShell>
      <section className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-primary">Analysis</p>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              {copy.title}
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              {copy.description} Dashboard values come from governed calculation
              output tables, not direct untracked trial balance aggregation.
            </p>
          </div>
          <DashboardNav />
        </div>

        <DashboardContainer
          defaultExpanded
          description="Select the fiscal period, reporting scope, and reference dimensions used for dashboard output."
          summary={formatFilterSummary(model.selection)}
          title="Dashboard Filters"
        >
          <DashboardFilterBar
            options={model.options}
            selection={model.selection}
            view={view}
          />
        </DashboardContainer>

        <DashboardContainer
          defaultExpanded
          description="Shows whether governed calculation output exists for the current dashboard selection and whether data quality issues affect interpretation."
          status={model.calculationRun ? model.calculationRun.run_status : "Run required"}
          statusTone={getReadinessTone(model.calculationRun?.run_status, issueCounts)}
          summary={formatReadinessSummary(model.calculationRun, issueCounts)}
          title="Calculation Run / Data Readiness"
        >
          <DataReadinessBanner
            calculationRun={model.calculationRun}
            failedRun={model.failedRun}
            output={model.output}
            selection={model.selection}
          />
          <DashboardFilterNotes notes={model.output.filterNotes} />
        </DashboardContainer>

        <DashboardContainer
          defaultExpanded
          description="Shows the highest-level financial position for the selected dashboard output."
          status={model.calculationRun ? "Available" : "No output"}
          statusTone={model.calculationRun ? "success" : "warning"}
          summary={
            model.calculationRun
              ? formatExecutiveSummary(model.output)
              : "No governed output available."
          }
          title="Executive Financial Position"
        >
          {model.calculationRun ? (
            <>
              <ExecutiveFinancialPositionView
                options={model.options}
                output={model.output}
                selection={model.selection}
              />
              {view === "financial_statements" ? (
                <div className="mt-6">
                  <FinancialStatementsView output={model.output} />
                </div>
              ) : null}
            </>
          ) : (
            <Placeholder>No governed output available.</Placeholder>
          )}
        </DashboardContainer>

        <DashboardContainer
          defaultExpanded={view === "exceptions"}
          description="Shows critical issues, warnings, mapping coverage problems, and data quality items that affect confidence in the dashboard."
          metric={`${issueCounts.critical} critical / ${issueCounts.warning} warning`}
          status={hasIssues ? "Needs review" : "No issues"}
          statusTone={
            issueCounts.critical > 0
              ? "error"
              : issueCounts.warning > 0
                ? "warning"
                : "success"
          }
          summary={formatExceptionSummary(issueCounts)}
          title="Exceptions and Data Quality"
        >
          {model.calculationRun ? (
            <ExceptionsView
              compact={view === "cfo_overview"}
              output={model.output}
            />
          ) : (
            <Placeholder>
              This section will show critical exceptions, warnings, mapping coverage issues,
              missing reference data, inactive mappings, and trial balance integrity items.
            </Placeholder>
          )}
        </DashboardContainer>

        <DashboardContainer
          defaultExpanded={view === "variances"}
          description="Shows the largest dollar and percentage changes for the selected dashboard output."
          summary="Top dollar variances, top percent variances, revenue changes, expenditure changes, and fund-level changes."
          title="Material Changes"
        >
          {model.calculationRun ? (
            <MaterialChangesView output={model.output} selection={model.selection} />
          ) : (
            <Placeholder>
              This section will show top dollar variances, top percent variances,
              revenue changes, expenditure changes, and fund-level changes.
            </Placeholder>
          )}
        </DashboardContainer>

        <DashboardContainer
          defaultExpanded={view === "funds"}
          description="Shows fund-level results and helps identify which funds are driving changes."
          summary="Fund-level beginning balance, net change, ending balance, exceptions, and mapping coverage."
          title="Fund Performance"
        >
          {model.calculationRun ? (
            <FundsView output={model.output} selection={model.selection} />
          ) : (
            <Placeholder>
              This section will show fund-level beginning balance, revenues,
              expenditures, net change, ending balance, exceptions, and mapping coverage.
            </Placeholder>
          )}
        </DashboardContainer>

        <DashboardContainer
          description="Shows operating-area performance by department and function."
          summary="Department, fund, and function revenues and expenses."
          title="Department / Function View"
        >
          {model.calculationRun ? (
            <DepartmentFunctionHierarchyView
              key={getDepartmentFunctionViewKey(model.selection)}
              options={model.options}
              output={model.output}
              selection={model.selection}
            />
          ) : (
            <Placeholder>
              Department / Function data is available after a governed calculation run exists.
            </Placeholder>
          )}
        </DashboardContainer>

        <DashboardContainer
          description="Shows the calculation run, source batches, posting runs, validation runs, calculation version, and dependency manifest behind the dashboard."
          summary={
            model.calculationRun
              ? `Calculation ${model.calculationRun.calculation_run_id.slice(0, 8)} / ${
                  model.calculationRun.calculation_version ?? "version not available"
                }`
              : "Traceability is available after a governed calculation run exists."
          }
          title="Traceability"
        >
          {model.calculationRun ? (
            <TraceabilityCard calculationRun={model.calculationRun} />
          ) : (
            <Placeholder>
              Traceability is available after a governed calculation run exists.
            </Placeholder>
          )}
        </DashboardContainer>
      </section>
    </AppShell>
  );
}

function Placeholder({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-border bg-muted/20 p-4 text-sm leading-6 text-muted-foreground">
      {children}
    </div>
  );
}

function getDepartmentFunctionViewKey(selection: DashboardSelection) {
  return [
    selection.fund,
    selection.fundGroup,
    selection.department,
    selection.functionCode,
    selection.acfr,
    selection.accountType
  ].join("|");
}

function getIssueCounts(output: DashboardOutput) {
  return {
    critical:
      output.exceptions.filter((row) => row.severity_level === "Critical").length +
      output.mappingCoverage.filter((row) => row.severity === "Critical").length,
    warning:
      output.exceptions.filter((row) => row.severity_level === "Warning").length +
      output.mappingCoverage.filter((row) => row.severity === "Warning").length
  };
}

function formatFilterSummary(selection: DashboardSelection) {
  const activeFilters = formatActiveFilters(selection);
  return `FY ${selection.fiscalYear}, P${selection.periodFrom}-P${selection.periodTo}, selected range, ${formatReportingScope(
    selection.reportingScope
  )}, ${activeFilters === "None" ? "no reference filters" : activeFilters}`;
}

function formatReadinessSummary(
  calculationRun: Awaited<ReturnType<typeof loadDashboardModel>>["calculationRun"],
  issueCounts: ReturnType<typeof getIssueCounts>
) {
  if (!calculationRun) {
    return "No governed output exists. Run calculation required.";
  }

  return `${calculationRun.run_status}, Mapping Coverage ${
    calculationRun.mapping_coverage_status ?? "Not available"
  }, ${issueCounts.critical} Critical, ${issueCounts.warning} Warning, Last calculated ${formatDate(
    calculationRun.completed_at
  )}`;
}

function getReadinessTone(
  runStatus: string | null | undefined,
  issueCounts: ReturnType<typeof getIssueCounts>
) {
  if (!runStatus) return "error";
  if (issueCounts.critical > 0) return "error";
  if (runStatus === "completed_with_warnings" || issueCounts.warning > 0) {
    return "warning";
  }
  return "success";
}

function formatExecutiveSummary(output: DashboardOutput) {
  const all = output.financialSummaries.find((row) => row.summary_key === "all");
  const revenue = findSummary(output, ["revenue", "revenues"]);
  const expenditures = findSummary(output, [
    "expenditure",
    "expenditures",
    "expense",
    "expenses"
  ]);

  if (!all && !revenue && !expenditures) {
    return "No governed output available.";
  }

  return `Net Change ${formatAmount(all?.presentation_amount ?? all?.net_change)}, Revenues ${
    revenue ? formatAmount(revenue.presentation_amount) : "Not available"
  }, Expenditures ${
    expenditures ? formatAmount(expenditures.presentation_amount) : "Not available"
  }`;
}

function formatExceptionSummary(issueCounts: ReturnType<typeof getIssueCounts>) {
  if (issueCounts.critical === 0 && issueCounts.warning === 0) {
    return "No critical exceptions or warnings.";
  }

  return `${issueCounts.critical} critical exceptions, ${issueCounts.warning} warnings.`;
}

function findSummary(output: DashboardOutput, keys: string[]) {
  const normalizedKeys = new Set(keys.map((key) => key.toLowerCase()));
  return output.financialSummaries.find((row) =>
    normalizedKeys.has(String(row.summary_key ?? "").toLowerCase())
  );
}
