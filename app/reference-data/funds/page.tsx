import Link from "next/link";
import type { ReactNode } from "react";

import { AppShell } from "@/components/app-shell";
import { FundImportForm } from "@/components/fund-import-form";
import {
  FundManualCreateForm,
  FundManualUpdateForm,
  FundStatusAction
} from "@/components/fund-manual-update-form";
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
  include_in_cash_reconciliation: boolean;
  include_in_standard_reporting: boolean;
  major_fund_flag: string | null;
  reporting_exclusion_reason: string | null;
  reporting_model: string | null;
  reporting_treatment: string;
  updated_at: string | null;
};

export default async function FundsReferenceDataPage({
  searchParams
}: {
  searchParams: Promise<{ add?: string; fundCode?: string; search?: string }>;
}) {
  const { add = "", fundCode = "", search = "" } = await searchParams;
  const authUser = await requireUser();
  const adminClient = createAdminClient();
  const appUser = await ensureAppUserForAuthUser(adminClient, authUser);
  const [fundsResult, fundCount] = await Promise.all([
    loadFunds({
      adminClient,
      organizationId: appUser.organization_id,
      search
    }),
    loadFundCount({
      adminClient,
      organizationId: appUser.organization_id
    })
  ]);
  const funds = fundsResult.data ?? [];
  const fundGroups = Array.from(
    new Set(
      funds
        .map((fund) => fund.fund_group?.trim())
        .filter((group): group is string => Boolean(group))
    )
  ).sort((a, b) => a.localeCompare(b));

  return (
    <AppShell>
      <section className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-primary">Reference Data</p>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Funds
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              Maintain fund classifications, reporting treatment, major fund
              flags, and cash/reconciliation inclusion. Add one-row fixes here;
              use import-from-file for bulk updates.
            </p>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              Trial balance data is not editable here. After changing reference
              data, rerun validation or calculation so new results use the
              updated setup.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              className="inline-flex items-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
              href="/reference-data"
            >
              Reference Data
            </Link>
            <Link
              className="inline-flex items-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
              href="/imports/funds"
            >
              Fund Import Page
            </Link>
          </div>
        </div>

        <section className="space-y-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">Funds</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {fundCount} funds available.
              </p>
            </div>
            <FundManualCreateForm
              defaultFundCode={fundCode}
              fundGroups={fundGroups}
              initialOpen={add === "1"}
            />
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
                placeholder="Search fund code, name, type, group, status, or reporting model"
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
                <div className="divide-y divide-border rounded-md border border-border">
                  <div className="hidden grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.35fr)_minmax(0,1fr)_auto] gap-4 bg-muted/50 px-4 py-3 text-xs font-semibold uppercase text-muted-foreground lg:grid">
                    <span>Fund</span>
                    <span>Classification</span>
                    <span>Reporting Treatment</span>
                    <span>Status / Dates</span>
                    <span className="text-right">Actions</span>
                  </div>
                  <div className="divide-y divide-border">
                    {funds.map((fund) => (
                      <article
                        className={
                          fund.active_status === "inactive"
                            ? "grid gap-4 px-4 py-4 opacity-75 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.35fr)_minmax(0,1fr)_auto]"
                            : "grid gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.35fr)_minmax(0,1fr)_auto]"
                        }
                        key={fund.fund_id}
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs font-semibold text-foreground">
                              {fund.fund_code}
                            </span>
                            <StatusPill
                              tone={
                                fund.active_status === "inactive"
                                  ? "muted"
                                  : "default"
                              }
                              value={titleize(fund.active_status)}
                            />
                          </div>
                          <p className="break-words text-sm font-semibold text-foreground">
                            {fund.fund_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Type: {fund.fund_type ?? "Not set"}
                          </p>
                        </div>

                        <div className="min-w-0 space-y-2 text-sm text-muted-foreground">
                          <dl className="grid gap-1">
                            <Detail label="Model">
                              <StatusPill
                                value={formatReportingModel(fund.reporting_model)}
                              />
                            </Detail>
                            <Detail label="Group">
                              {fund.fund_group ?? "Not set"}
                            </Detail>
                            <Detail label="Major">
                              {formatMajorFund(fund.major_fund_flag)}
                            </Detail>
                          </dl>
                        </div>

                        <div className="min-w-0 space-y-2">
                          <div className="flex flex-wrap gap-2">
                            <StatusPill
                              value={formatReportingTreatment(
                                fund.reporting_treatment
                              )}
                            />
                            <StatusPill
                              tone={
                                fund.include_in_standard_reporting
                                  ? "default"
                                  : "muted"
                              }
                              value={
                                fund.include_in_standard_reporting
                                  ? "Standard: Included"
                                  : "Standard: Excluded"
                              }
                            />
                            <StatusPill
                              tone={
                                fund.include_in_cash_reconciliation
                                  ? "default"
                                  : "muted"
                              }
                              value={
                                fund.include_in_cash_reconciliation
                                  ? "Cash: Yes"
                                  : "Cash: No"
                              }
                            />
                          </div>
                          <p className="break-words text-xs leading-5 text-muted-foreground">
                            {fund.reporting_exclusion_reason ??
                              "No exclusion reason set."}
                          </p>
                        </div>

                        <div className="min-w-0 space-y-2 text-sm text-muted-foreground">
                          <dl className="grid gap-1">
                            <Detail label="Effective">
                              {fund.effective_start_date ?? "Open"} to{" "}
                              {fund.effective_end_date ?? "Open"}
                            </Detail>
                            <Detail label="Updated">
                              {fund.updated_at
                                ? formatDate(fund.updated_at)
                                : "Not set"}
                            </Detail>
                          </dl>
                        </div>

                        <div className="flex flex-wrap items-start justify-start gap-2 lg:justify-end">
                          <FundManualUpdateForm
                            fund={fund}
                            fundGroups={fundGroups}
                          />
                          <FundStatusAction fund={fund} />
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </section>

        <details className="rounded-md border border-border bg-card">
          <summary className="flex cursor-pointer items-center justify-between px-6 py-4 text-sm font-semibold text-foreground">
            <span>Import from File</span>
            <span className="text-xs font-normal uppercase text-muted-foreground">
              Secondary bulk tool
            </span>
          </summary>
          <div className="border-t border-border p-6">
            <FundImportForm />
          </div>
        </details>
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
      "fund_id, fund_code, fund_name, fund_type, reporting_model, fund_group, major_fund_flag, reporting_treatment, include_in_standard_reporting, include_in_cash_reconciliation, reporting_exclusion_reason, active_status, effective_start_date, effective_end_date, updated_at"
    )
    .eq("organization_id", organizationId)
    .order("fund_code", { ascending: true })
    .limit(250);

  if (search.trim()) {
    const pattern = `%${search.trim()}%`;
    query = query.or(
      `fund_code.ilike.${pattern},fund_name.ilike.${pattern},fund_type.ilike.${pattern},reporting_model.ilike.${pattern},fund_group.ilike.${pattern},reporting_treatment.ilike.${pattern},reporting_exclusion_reason.ilike.${pattern},active_status.ilike.${pattern}`
    );
  }

  return query.returns<FundRow[]>();
}

async function loadFundCount({
  adminClient,
  organizationId
}: {
  adminClient: ReturnType<typeof createAdminClient>;
  organizationId: string;
}) {
  const result = await adminClient
    .from("funds")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", organizationId);

  return result.count ?? 0;
}

function StatusPill({
  tone = "default",
  value
}: {
  tone?: "default" | "muted";
  value: string;
}) {
  return (
    <span
      className={
        tone === "muted"
          ? "inline-flex rounded-md border border-border bg-muted px-2 py-1 text-xs font-medium text-muted-foreground"
          : "inline-flex rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-foreground"
      }
    >
      {value}
    </span>
  );
}

function Detail({
  children,
  label
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-start gap-2">
      <dt className="text-xs font-medium uppercase text-muted-foreground">
        {label}
      </dt>
      <dd className="min-w-0 break-words text-sm text-foreground">{children}</dd>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium"
  }).format(new Date(value));
}

function formatMajorFund(value: string | null) {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (["yes", "y", "true", "major", "1"].includes(normalized)) return "Yes";
  if (["no", "n", "false", "non_major", "non-major", "0"].includes(normalized)) {
    return "No";
  }
  return "Not set";
}

function formatReportingModel(value: string | null) {
  return value ? titleize(value.replaceAll("_", " ")) : "Not set";
}

function formatReportingTreatment(value: string | null) {
  return value ? titleize(value.replaceAll("_", " ")) : "Reportable";
}

function titleize(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
