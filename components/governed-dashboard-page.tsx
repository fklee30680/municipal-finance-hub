import { AppShell } from "@/components/app-shell";
import {
  DashboardFilterBar,
  DashboardFilterNotes,
  DashboardNav,
  DataReadinessBanner,
  ExceptionsView,
  FinancialStatementsView,
  FundsView,
  SummaryCards,
  TraceabilityCard,
  VariancesView
} from "@/components/governed-dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ensureAppUserForAuthUser } from "@/lib/auth/app-user";
import { requireUser } from "@/lib/auth/session";
import {
  type DashboardSearchParams,
  type DashboardView,
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

        <DashboardFilterBar
          options={model.options}
          selection={model.selection}
          view={view}
        />
        <DataReadinessBanner
          calculationRun={model.calculationRun}
          failedRun={model.failedRun}
          output={model.output}
          selection={model.selection}
        />
        <DashboardFilterNotes notes={model.output.filterNotes} />

        {model.calculationRun ? (
          <>
            {view === "cfo_overview" ? (
              <>
                <SummaryCards output={model.output} selection={model.selection} />
                <ExceptionsView
                  output={{
                    ...model.output,
                    exceptions: model.output.exceptions.slice(0, 10),
                    mappingCoverage: model.output.mappingCoverage.slice(0, 10)
                  }}
                />
              </>
            ) : null}
            {view === "financial_statements" ? (
              <FinancialStatementsView output={model.output} />
            ) : null}
            {view === "funds" ? <FundsView output={model.output} /> : null}
            {view === "variances" ? <VariancesView output={model.output} /> : null}
            {view === "exceptions" ? <ExceptionsView output={model.output} /> : null}
            <TraceabilityCard calculationRun={model.calculationRun} />
          </>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>No Governed Output</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                No dashboard widgets are shown until a matching governed
                calculation run exists. Use the action in the readiness banner
                to generate output from posted active trial balance data.
              </p>
            </CardContent>
          </Card>
        )}
      </section>
    </AppShell>
  );
}
