import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { TrialBalancePreviewAction } from "@/components/trial-balance-preview-action";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ensureAppUserForAuthUser } from "@/lib/auth/app-user";
import { requireUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

type Related<T> = T | T[] | null;

type ImportBatchDetail = {
  import_batch_id: string;
  fiscal_year: number | null;
  period: number | null;
  batch_status: string;
  template_version_id: string | null;
  account_structure_id: string | null;
  import_types: Related<{
    import_type_code: string;
    import_type_name: string;
  }>;
  source_files: Related<{
    original_file_name: string;
    content_type: string | null;
  }>;
  import_template_versions: Related<{
    template_version_id: string;
    version_number: number;
    account_structure_id: string | null;
    import_templates: Related<{
      template_name: string;
    }>;
    account_structures: Related<{
      structure_name: string;
    }>;
  }>;
};

type PreviewRunRow = {
  preview_run_id: string;
  preview_status: string;
  row_count: number;
  previewed_row_count: number;
  rows_with_preview_issues: number;
  total_beginning_balance: number | string;
  total_debits: number | string;
  total_credits: number | string;
  total_net_change: number | string;
  total_ending_balance: number | string;
  created_at: string;
  completed_at: string | null;
};

type PreviewRow = {
  preview_row_id: string;
  source_row_number: number;
  full_account_number: string | null;
  fund_code: string | null;
  acfr_code: string | null;
  department_code: string | null;
  function_code: string | null;
  object_code: string | null;
  account_name: string | null;
  beginning_balance: number | string | null;
  debits: number | string | null;
  credits: number | string | null;
  net_change: number | string | null;
  ending_balance: number | string | null;
  has_issue: boolean;
};

type PreviewIssue = {
  preview_row_id: string | null;
  source_row_number: number | null;
  issue_code: string;
  issue_message: string;
  issue_severity: string;
};

export default async function TrialBalancePreviewPage({
  params
}: {
  params: Promise<{ importBatchId: string }>;
}) {
  const { importBatchId } = await params;
  const authUser = await requireUser();
  const adminClient = createAdminClient();
  const appUser = await ensureAppUserForAuthUser(adminClient, authUser);

  const batchResult = await adminClient
    .from("import_batches")
    .select(
      `
      import_batch_id,
      fiscal_year,
      period,
      batch_status,
      template_version_id,
      account_structure_id,
      import_types (
        import_type_code,
        import_type_name
      ),
      source_files (
        original_file_name,
        content_type
      ),
      import_template_versions (
        template_version_id,
        version_number,
        account_structure_id,
        import_templates (
          template_name
        ),
        account_structures (
          structure_name
        )
      )
    `
    )
    .eq("organization_id", appUser.organization_id)
    .eq("import_batch_id", importBatchId)
    .maybeSingle<ImportBatchDetail>();

  if (batchResult.error || !batchResult.data) {
    notFound();
  }

  const latestRunResult = await adminClient
    .from("import_preview_runs")
    .select(
      "preview_run_id, preview_status, row_count, previewed_row_count, rows_with_preview_issues, total_beginning_balance, total_debits, total_credits, total_net_change, total_ending_balance, created_at, completed_at"
    )
    .eq("organization_id", appUser.organization_id)
    .eq("import_batch_id", importBatchId)
    .eq("preview_status", "completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<PreviewRunRow>();
  const latestRun = latestRunResult.data ?? null;

  const rowsResult = latestRun
    ? await adminClient
        .from("import_preview_rows")
        .select(
          "preview_row_id, source_row_number, full_account_number, fund_code, acfr_code, department_code, function_code, object_code, account_name, beginning_balance, debits, credits, net_change, ending_balance, has_issue"
        )
        .eq("organization_id", appUser.organization_id)
        .eq("preview_run_id", latestRun.preview_run_id)
        .order("source_row_number", { ascending: true })
        .limit(100)
        .returns<PreviewRow[]>()
    : null;
  const issuesResult = latestRun
    ? await adminClient
        .from("import_preview_issues")
        .select(
          "preview_row_id, source_row_number, issue_code, issue_message, issue_severity"
        )
        .eq("organization_id", appUser.organization_id)
        .eq("preview_run_id", latestRun.preview_run_id)
        .order("source_row_number", { ascending: true })
        .returns<PreviewIssue[]>()
    : null;

  const batch = batchResult.data;
  const importType = getRelatedRecord(batch.import_types);
  const sourceFile = getRelatedRecord(batch.source_files);
  const templateVersion = getRelatedRecord(batch.import_template_versions);
  const template = getRelatedRecord(templateVersion?.import_templates);
  const accountStructure = getRelatedRecord(templateVersion?.account_structures);
  const rows = rowsResult?.data ?? [];
  const issuesByRowId = new Map(
    (issuesResult?.data ?? [])
      .filter((issue) => issue.preview_row_id)
      .map((issue) => [issue.preview_row_id, issue])
  );
  const isTrialBalance = importType?.import_type_code === "trial_balance";
  const canPreview =
    isTrialBalance &&
    Boolean(batch.template_version_id) &&
    Boolean(templateVersion?.account_structure_id ?? batch.account_structure_id);
  const setupMessage = getSetupMessage({
    accountStructureId:
      templateVersion?.account_structure_id ?? batch.account_structure_id,
    isTrialBalance,
    templateVersionId: batch.template_version_id
  });

  return (
    <AppShell>
      <section className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-primary">Imports</p>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Trial Balance Preview
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              Preview only. This file has not been validated or posted.
              Previewed rows are not active for dashboards or reports.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {latestRun ? (
              <Link
                className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring"
                href={`/imports/${batch.import_batch_id}/validation`}
              >
                Run Validation
              </Link>
            ) : null}
            <Link
              className="inline-flex items-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
              href="/imports"
            >
              Back to Imports
            </Link>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Preview context</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm md:grid-cols-3">
            <InfoItem label="Original filename" value={sourceFile?.original_file_name} />
            <InfoItem label="Import type" value={importType?.import_type_name} />
            <InfoItem label="Fiscal year" value={batch.fiscal_year ?? "Not provided"} />
            <InfoItem label="Period" value={batch.period ?? "Not provided"} />
            <InfoItem
              label="Template"
              value={
                template
                  ? `${template.template_name} v${templateVersion?.version_number}`
                  : "Not selected"
              }
            />
            <InfoItem
              label="Account structure"
              value={accountStructure?.structure_name ?? "Not selected"}
            />
            <InfoItem label="Import batch status" value={batch.batch_status} />
            <InfoItem
              label="Preview status"
              value={latestRun?.preview_status ?? "Not generated"}
            />
            <InfoItem
              label="Last previewed"
              value={
                latestRun?.completed_at
                  ? formatDate(latestRun.completed_at)
                  : "Not generated"
              }
            />
          </CardContent>
        </Card>

        <Card className="border-border bg-muted">
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-foreground">
              Preview only. This file has not been validated or posted.
              Previewed rows are not active for dashboards or reports.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Generate preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {setupMessage ? (
              <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
                {setupMessage}
              </p>
            ) : null}
            <TrialBalancePreviewAction
              disabled={!canPreview}
              importBatchId={batch.import_batch_id}
            />
          </CardContent>
        </Card>

        {latestRunResult.error ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">
                Preview history could not be loaded. Apply the Slice 5 migration
                before using preview in this environment. Details:{" "}
                {latestRunResult.error.message}
              </p>
            </CardContent>
          </Card>
        ) : null}

        {latestRun ? (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Preview summary</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 text-sm md:grid-cols-4">
                <InfoItem label="Rows detected" value={latestRun.row_count} />
                <InfoItem label="Rows previewed" value={latestRun.previewed_row_count} />
                <InfoItem
                  label="Rows with preview issues"
                  value={latestRun.rows_with_preview_issues}
                />
                <InfoItem
                  label="Total beginning balance"
                  value={formatAmount(latestRun.total_beginning_balance)}
                />
                <InfoItem label="Total debits" value={formatAmount(latestRun.total_debits)} />
                <InfoItem label="Total credits" value={formatAmount(latestRun.total_credits)} />
                <InfoItem
                  label="Total net change"
                  value={formatAmount(latestRun.total_net_change)}
                />
                <InfoItem
                  label="Total ending balance"
                  value={formatAmount(latestRun.total_ending_balance)}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Preview rows</CardTitle>
              </CardHeader>
              <CardContent>
                {rowsResult?.error ? (
                  <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
                    Preview rows could not be loaded: {rowsResult.error.message}
                  </p>
                ) : null}
                {!rowsResult?.error && rows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No preview rows have been saved for this run.
                  </p>
                ) : null}
                {rows.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1200px] border-collapse text-left text-sm">
                      <thead>
                        <tr className="border-b border-border text-muted-foreground">
                          <th className="py-3 pr-4 font-medium">Source row</th>
                          <th className="py-3 pr-4 font-medium">Full account number</th>
                          <th className="py-3 pr-4 font-medium">Fund</th>
                          <th className="py-3 pr-4 font-medium">ACFR</th>
                          <th className="py-3 pr-4 font-medium">Department</th>
                          <th className="py-3 pr-4 font-medium">Function</th>
                          <th className="py-3 pr-4 font-medium">Object</th>
                          <th className="py-3 pr-4 font-medium">Account name</th>
                          <th className="py-3 pr-4 font-medium">Beginning balance</th>
                          <th className="py-3 pr-4 font-medium">Debits</th>
                          <th className="py-3 pr-4 font-medium">Credits</th>
                          <th className="py-3 pr-4 font-medium">Net change</th>
                          <th className="py-3 pr-4 font-medium">Ending balance</th>
                          <th className="py-3 pr-4 font-medium">Issue status</th>
                          <th className="py-3 font-medium">Issue message</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row) => {
                          const issue = issuesByRowId.get(row.preview_row_id);

                          return (
                            <tr
                              className="border-b border-border align-top"
                              key={row.preview_row_id}
                            >
                              <td className="py-3 pr-4 text-muted-foreground">
                                {row.source_row_number}
                              </td>
                              <td className="py-3 pr-4 font-medium text-foreground">
                                {row.full_account_number ?? ""}
                              </td>
                              <td className="py-3 pr-4 text-muted-foreground">{row.fund_code}</td>
                              <td className="py-3 pr-4 text-muted-foreground">{row.acfr_code}</td>
                              <td className="py-3 pr-4 text-muted-foreground">{row.department_code}</td>
                              <td className="py-3 pr-4 text-muted-foreground">{row.function_code}</td>
                              <td className="py-3 pr-4 text-muted-foreground">{row.object_code}</td>
                              <td className="py-3 pr-4 text-muted-foreground">{row.account_name}</td>
                              <td className="py-3 pr-4 text-muted-foreground">
                                {formatAmount(row.beginning_balance)}
                              </td>
                              <td className="py-3 pr-4 text-muted-foreground">
                                {formatAmount(row.debits)}
                              </td>
                              <td className="py-3 pr-4 text-muted-foreground">
                                {formatAmount(row.credits)}
                              </td>
                              <td className="py-3 pr-4 text-muted-foreground">
                                {formatAmount(row.net_change)}
                              </td>
                              <td className="py-3 pr-4 text-muted-foreground">
                                {formatAmount(row.ending_balance)}
                              </td>
                              <td className="py-3 pr-4 text-muted-foreground">
                                {row.has_issue ? "Parse issue" : "No issue"}
                              </td>
                              <td className="py-3 text-muted-foreground">
                                {issue
                                  ? `${issue.issue_severity}: ${issue.issue_message}`
                                  : ""}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <p className="mt-3 text-sm text-muted-foreground">
                      Showing up to 100 preview rows from the latest preview run.
                    </p>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </>
        ) : null}
      </section>
    </AppShell>
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
    <div>
      <p className="font-medium text-foreground">{label}</p>
      <p className="text-muted-foreground">{value ?? "Not available"}</p>
    </div>
  );
}

function getRelatedRecord<T>(value: Related<T> | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function getSetupMessage({
  accountStructureId,
  isTrialBalance,
  templateVersionId
}: {
  accountStructureId: string | null | undefined;
  isTrialBalance: boolean;
  templateVersionId: string | null;
}) {
  if (!isTrialBalance) {
    return "Trial balance preview is only available for trial_balance import batches.";
  }

  if (!templateVersionId) {
    return "Select or create a trial balance template before generating preview.";
  }

  if (!accountStructureId) {
    return "This trial balance template needs an account structure before preview can run.";
  }

  return null;
}

function formatAmount(value: number | string | null | undefined) {
  const numericValue =
    typeof value === "number" ? value : Number.parseFloat(value ?? "0");

  if (Number.isNaN(numericValue)) {
    return "0.00";
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  }).format(numericValue);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
