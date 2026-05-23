import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { FundImportForm } from "@/components/fund-import-form";
import { Card, CardContent } from "@/components/ui/card";
import { ensureAppUserForAuthUser } from "@/lib/auth/app-user";
import { requireUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

type FundRow = {
  active_status: string;
  effective_end_date: string | null;
  effective_start_date: string | null;
  fund_code: string;
  fund_group: string | null;
  fund_id: string;
  fund_name: string;
  fund_type: string | null;
  major_fund_flag: string | null;
  reporting_model: string | null;
  updated_at: string | null;
};

export default async function FundImportPage({
  searchParams
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const { search = "" } = await searchParams;
  const authUser = await requireUser();
  const adminClient = createAdminClient();
  const appUser = await ensureAppUserForAuthUser(adminClient, authUser);
  const [fundsResult, activeCount] = await Promise.all([
    loadFunds({
      adminClient,
      organizationId: appUser.organization_id,
      search
    }),
    loadActiveFundCount({
      adminClient,
      organizationId: appUser.organization_id
    })
  ]);
  const funds = fundsResult.data ?? [];

  return (
    <AppShell>
      <section className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-primary">Imports</p>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Fund List Update
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              Import fund setup/reference data with a lightweight preview,
              edit, exclude, and commit workflow. This does not post trial
              balance data, update dashboards, or generate reports.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              className="inline-flex items-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
              href="/imports/reference"
            >
              Reference Imports
            </Link>
            <Link
              className="inline-flex items-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
              href="/imports"
            >
              Import History
            </Link>
          </div>
        </div>

        <FundImportForm />

        <section className="space-y-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Funds</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {activeCount} funds available.
            </p>
          </div>

          <details
            className="rounded-md border border-border bg-card"
            open={Boolean(search)}
          >
            <summary className="flex cursor-pointer items-center justify-between px-6 py-4 text-sm font-semibold text-foreground">
              <span>Search Funds</span>
              <span className="text-xs font-normal uppercase text-muted-foreground">
                Expand / Collapse
              </span>
            </summary>
            <form className="flex max-w-xl gap-2 border-t border-border p-6" method="get">
              <input
                className="min-h-10 flex-1 rounded-none border border-input bg-background px-3 text-sm"
                defaultValue={search}
                name="search"
                placeholder="Search fund code, name, type, group, or reporting model"
              />
              <button className="rounded-md border border-border bg-card px-4 py-2 text-sm font-semibold hover:bg-muted">
                Search
              </button>
            </form>
          </details>

          <Card>
            <CardContent className="pt-6">
              {fundsResult.error ? (
                <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
                  Funds could not be loaded: {fundsResult.error.message}
                </p>
              ) : null}
              {!fundsResult.error && funds.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {search
                    ? "No funds match the current search."
                    : "No funds have been committed yet."}
                </p>
              ) : null}
              {funds.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="py-3 pr-4 font-medium">Fund Code</th>
                        <th className="py-3 pr-4 font-medium">Fund Name</th>
                        <th className="py-3 pr-4 font-medium">Fund Type</th>
                        <th className="py-3 pr-4 font-medium">Reporting Model</th>
                        <th className="py-3 pr-4 font-medium">Fund Group</th>
                        <th className="py-3 pr-4 font-medium">Major Fund</th>
                        <th className="py-3 pr-4 font-medium">Active Status</th>
                        <th className="py-3 pr-4 font-medium">Effective Start</th>
                        <th className="py-3 pr-4 font-medium">Effective End</th>
                        <th className="py-3 font-medium">Last Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {funds.map((fund) => (
                        <tr className="border-b border-border align-top" key={fund.fund_id}>
                          <td className="py-3 pr-4 font-mono text-xs font-medium text-foreground">
                            {fund.fund_code}
                          </td>
                          <td className="py-3 pr-4 font-medium text-foreground">
                            {fund.fund_name}
                          </td>
                          <td className="py-3 pr-4 text-muted-foreground">
                            {fund.fund_type ?? "Not set"}
                          </td>
                          <td className="py-3 pr-4 text-muted-foreground">
                            {fund.reporting_model ?? "Not set"}
                          </td>
                          <td className="py-3 pr-4 text-muted-foreground">
                            {fund.fund_group ?? "Not set"}
                          </td>
                          <td className="py-3 pr-4 text-muted-foreground">
                            {fund.major_fund_flag ?? "Not set"}
                          </td>
                          <td className="py-3 pr-4 text-muted-foreground">
                            {fund.active_status}
                          </td>
                          <td className="py-3 pr-4 text-muted-foreground">
                            {fund.effective_start_date ?? "Open"}
                          </td>
                          <td className="py-3 pr-4 text-muted-foreground">
                            {fund.effective_end_date ?? "Open"}
                          </td>
                          <td className="py-3 text-muted-foreground">
                            {fund.updated_at ? formatDate(fund.updated_at) : "Not set"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </section>
      </section>
    </AppShell>
  );
}

async function loadFunds({
  adminClient,
  organizationId,
  search
}: {
  adminClient: ReturnType<typeof createAdminClient>;
  organizationId: string;
  search: string;
}) {
  let query = adminClient
    .from("funds")
    .select(
      "fund_id, fund_code, fund_name, fund_type, reporting_model, fund_group, major_fund_flag, active_status, effective_start_date, effective_end_date, updated_at"
    )
    .eq("organization_id", organizationId)
    .eq("active_status", "active")
    .order("fund_code", { ascending: true })
    .limit(250);

  if (search.trim()) {
    const pattern = `%${search.trim()}%`;
    query = query.or(
      `fund_code.ilike.${pattern},fund_name.ilike.${pattern},fund_type.ilike.${pattern},reporting_model.ilike.${pattern},fund_group.ilike.${pattern}`
    );
  }

  return query.returns<FundRow[]>();
}

async function loadActiveFundCount({
  adminClient,
  organizationId
}: {
  adminClient: ReturnType<typeof createAdminClient>;
  organizationId: string;
}) {
  const result = await adminClient
    .from("funds")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("active_status", "active");

  return result.count ?? 0;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium"
  }).format(new Date(value));
}
