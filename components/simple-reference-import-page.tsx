import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { SimpleReferenceImportForm } from "@/components/simple-reference-import-form";
import { SimpleReferenceManualUpdateForm } from "@/components/simple-reference-manual-update-form";
import { Card, CardContent } from "@/components/ui/card";
import { ensureAppUserForAuthUser } from "@/lib/auth/app-user";
import { requireUser } from "@/lib/auth/session";
import type { SimpleReferenceImportConfig } from "@/lib/imports/simple-reference-import-config";
import { createAdminClient } from "@/lib/supabase/admin";

type ReferenceRow = Record<string, string | number | null>;

export async function SimpleReferenceImportPage({
  config,
  search
}: {
  config: SimpleReferenceImportConfig;
  search: string;
}) {
  const authUser = await requireUser();
  const adminClient = createAdminClient();
  const appUser = await ensureAppUserForAuthUser(adminClient, authUser);
  const [rowsResult, referenceCount] = await Promise.all([
    loadReferenceRows({
      adminClient,
      config,
      organizationId: appUser.organization_id,
      search
    }),
    loadReferenceCount({
      adminClient,
      config,
      organizationId: appUser.organization_id
    })
  ]);
  const rows = rowsResult.data ?? [];

  return (
    <AppShell>
      <section className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-primary">Reference Imports</p>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              {config.pageTitle}
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              {config.description} This does not post trial balance data, update
              dashboards, generate reports, import budgets, or do any other
              big-finance sorcery.
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

        <SimpleReferenceImportForm config={config} />

        <section className="space-y-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              {config.tableTitle}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {referenceCount} {config.pluralLabel} available.
            </p>
          </div>

          <details
            className="rounded-md border border-border bg-card"
            open={Boolean(search)}
          >
            <summary className="flex cursor-pointer items-center justify-between px-6 py-4 text-sm font-semibold text-foreground">
              <span>{config.searchTitle}</span>
              <span className="text-xs font-normal uppercase text-muted-foreground">
                Expand / Collapse
              </span>
            </summary>
            <form className="flex max-w-xl gap-2 border-t border-border p-6" method="get">
              <input
                className="min-h-10 flex-1 rounded-none border border-input bg-background px-3 text-sm"
                defaultValue={search}
                name="search"
                placeholder={config.searchPlaceholder}
              />
              <button className="rounded-md border border-border bg-card px-4 py-2 text-sm font-semibold hover:bg-muted">
                Search
              </button>
            </form>
          </details>

          <Card>
            <CardContent className="pt-6">
              {rowsResult.error ? (
                <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
                  {config.tableTitle} could not be loaded: {rowsResult.error.message}
                </p>
              ) : null}
              {!rowsResult.error && rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {search ? `No ${config.pluralLabel} match the current search.` : config.emptyText}
                </p>
              ) : null}
              {rows.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        {config.tableColumns.map((column) => (
                          <th className="py-3 pr-4 font-medium" key={column.dbField}>
                            {column.label}
                          </th>
                        ))}
                        {config.manualEditableFields.length > 0 ? (
                          <th className="py-3 font-medium">Actions</th>
                        ) : null}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr
                          className={
                            row.active_status === "inactive"
                              ? "border-b border-border align-top opacity-75"
                              : "border-b border-border align-top"
                          }
                          key={String(row[config.idField])}
                        >
                          {config.tableColumns.map((column, index) => (
                            <td
                              className={
                                index === 0
                                  ? "py-3 pr-4 font-mono text-xs font-medium text-foreground"
                                  : "py-3 pr-4 text-muted-foreground"
                              }
                              key={column.dbField}
                            >
                              {formatTableValue(row[column.dbField], column.dbField)}
                            </td>
                          ))}
                          {config.manualEditableFields.length > 0 ? (
                            <td className="py-3">
                              <SimpleReferenceManualUpdateForm
                                config={config}
                                row={row}
                              />
                            </td>
                          ) : null}
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

async function loadReferenceRows({
  adminClient,
  config,
  organizationId,
  search
}: {
  adminClient: ReturnType<typeof createAdminClient>;
  config: SimpleReferenceImportConfig;
  organizationId: string;
  search: string;
}) {
  const selectedFields = Array.from(
    new Set([
      config.idField,
      config.codeField,
      config.nameField,
      ...config.tableColumns.map((column) => column.dbField),
      ...config.manualEditableFields.map((field) => field.dbField)
    ])
  ).join(", ");
  let query = adminClient
    .from(config.targetTable)
    .select(selectedFields)
    .eq("organization_id", organizationId)
    .order(config.codeField, { ascending: true })
    .limit(250);

  if (search.trim()) {
    const pattern = `%${search.trim()}%`;
    query = query.or(
      config.searchableFields
        .map((field) => `${field}.ilike.${pattern}`)
        .join(",")
    );
  }

  return query.returns<ReferenceRow[]>();
}

async function loadReferenceCount({
  adminClient,
  config,
  organizationId
}: {
  adminClient: ReturnType<typeof createAdminClient>;
  config: SimpleReferenceImportConfig;
  organizationId: string;
}) {
  const result = await adminClient
    .from(config.targetTable)
    .select("*", { count: "exact", head: true })
    .eq("organization_id", organizationId);

  return result.count ?? 0;
}

function formatTableValue(value: unknown, field: string) {
  if (value === null || value === undefined || value === "") {
    if (field === "effective_start_date" || field === "effective_end_date") {
      return "Open";
    }

    return "Not set";
  }

  if (field === "updated_at") {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium"
    }).format(new Date(String(value)));
  }

  if (field === "active_status") {
    return titleize(String(value));
  }

  return String(value);
}

function titleize(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
