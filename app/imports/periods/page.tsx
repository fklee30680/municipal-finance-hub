import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ensureAppUserForAuthUser } from "@/lib/auth/app-user";
import { requireUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

type Related<T> = T | T[] | null;

type PeriodImportRow = {
  import_batch_id: string;
  fiscal_year: number | null;
  period: number | null;
  batch_status: string;
  active_status: string;
  reporting_status: string;
  is_active_for_reporting: boolean;
  rows_processed: number;
  rows_rejected: number;
  warning_count: number;
  posted_by: string | null;
  posted_at: string | null;
  supersedes_import_batch_id: string | null;
  superseded_by_import_batch_id: string | null;
  source_files: Related<{
    original_file_name: string;
  }>;
};

export default async function PostedPeriodsPage({
  searchParams
}: {
  searchParams: Promise<{ includeInactive?: string }>;
}) {
  const filters = await searchParams;
  const includeInactive = filters.includeInactive === "true";
  const authUser = await requireUser();
  const adminClient = createAdminClient();
  const appUser = await ensureAppUserForAuthUser(adminClient, authUser);

  let query = adminClient
    .from("import_batches")
    .select(
      `
      import_batch_id,
      fiscal_year,
      period,
      batch_status,
      active_status,
      reporting_status,
      is_active_for_reporting,
      rows_processed,
      rows_rejected,
      warning_count,
      posted_by,
      posted_at,
      supersedes_import_batch_id,
      superseded_by_import_batch_id,
      source_files (
        original_file_name
      )
    `
    )
    .eq("organization_id", appUser.organization_id)
    .in("batch_status", [
      "posted",
      "posted_with_exceptions",
      "superseded",
      "inactive"
    ])
    .order("fiscal_year", { ascending: false })
    .order("period", { ascending: false })
    .order("posted_at", { ascending: false });

  if (!includeInactive) {
    query = query
      .eq("is_active_for_reporting", true)
      .eq("active_status", "active")
      .eq("reporting_status", "included")
      .is("superseded_by_import_batch_id", null);
  }

  const importsResult = await query.returns<PeriodImportRow[]>();
  const imports = importsResult.data ?? [];

  return (
    <AppShell>
      <section className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-primary">Imports</p>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Period Review
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              Review posted trial balance imports by fiscal year and period.
              Inactive and superseded imports are excluded by default but remain
              available through filters.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              className="inline-flex items-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
              href={includeInactive ? "/imports/periods" : "/imports/periods?includeInactive=true"}
            >
              {includeInactive ? "Show Active Only" : "Include Inactive"}
            </Link>
            <Link
              className="inline-flex items-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
              href="/imports"
            >
              Back to Imports
            </Link>
          </div>
        </div>

        <Card className="border-border bg-muted">
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-foreground">
              Period review is a governed data review view. It does not run
              calculations, update dashboards, generate reports, or physically
              delete old import history.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Posted imports</CardTitle>
          </CardHeader>
          <CardContent>
            {importsResult.error ? (
              <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
                Posted imports could not be loaded: {importsResult.error.message}
              </p>
            ) : null}
            {!importsResult.error && imports.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No posted trial balance imports are available for this filter.
              </p>
            ) : null}
            {imports.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="py-3 pr-4 font-medium">Fiscal year</th>
                      <th className="py-3 pr-4 font-medium">Period</th>
                      <th className="py-3 pr-4 font-medium">Active import batch</th>
                      <th className="py-3 pr-4 font-medium">Source file</th>
                      <th className="py-3 pr-4 font-medium">Status</th>
                      <th className="py-3 pr-4 font-medium">Active</th>
                      <th className="py-3 pr-4 font-medium">Posted by</th>
                      <th className="py-3 pr-4 font-medium">Posted at</th>
                      <th className="py-3 pr-4 font-medium">Rows active</th>
                      <th className="py-3 pr-4 font-medium">Rows rejected</th>
                      <th className="py-3 font-medium">Review</th>
                    </tr>
                  </thead>
                  <tbody>
                    {imports.map((row) => {
                      const sourceFile = getRelatedRecord(row.source_files);
                      return (
                        <tr className="border-b border-border align-top" key={row.import_batch_id}>
                          <td className="py-3 pr-4 text-muted-foreground">
                            {row.fiscal_year ?? "Not provided"}
                          </td>
                          <td className="py-3 pr-4 text-muted-foreground">
                            {row.period ?? "Not provided"}
                          </td>
                          <td className="py-3 pr-4 text-muted-foreground">
                            {row.import_batch_id}
                          </td>
                          <td className="py-3 pr-4 text-muted-foreground">
                            {sourceFile?.original_file_name ?? "Not available"}
                          </td>
                          <td className="py-3 pr-4 text-muted-foreground">
                            {row.batch_status}
                          </td>
                          <td className="py-3 pr-4 text-muted-foreground">
                            {row.is_active_for_reporting ? "Active" : "Inactive"}
                          </td>
                          <td className="py-3 pr-4 text-muted-foreground">
                            {row.posted_by ?? "Not available"}
                          </td>
                          <td className="py-3 pr-4 text-muted-foreground">
                            {row.posted_at ? formatDate(row.posted_at) : "Not available"}
                          </td>
                          <td className="py-3 pr-4 text-muted-foreground">
                            {row.is_active_for_reporting ? row.rows_processed : 0}
                          </td>
                          <td className="py-3 pr-4 text-muted-foreground">
                            {row.rows_rejected}
                          </td>
                          <td className="py-3">
                            <Link
                              className="text-sm font-medium text-primary hover:underline"
                              href={`/imports/${row.import_batch_id}/review`}
                            >
                              Open Review
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}

function getRelatedRecord<T>(value: Related<T>) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
