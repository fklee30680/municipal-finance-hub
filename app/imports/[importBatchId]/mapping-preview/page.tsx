import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import {
  MappingCommitAction,
  MappingPreviewAction
} from "@/components/mapping-import-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ensureAppUserForAuthUser } from "@/lib/auth/app-user";
import { isSupportedMappingImportType } from "@/lib/imports/mapping-import";
import { requireUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

type Related<T> = T | T[] | null;

type ImportBatchDetail = {
  import_batch_id: string;
  batch_status: string;
  template_version_id: string | null;
  import_types: Related<{
    import_type_code: string;
    import_type_name: string;
  }>;
  source_files: Related<{
    original_file_name: string;
    content_type: string | null;
  }>;
  import_template_versions: Related<{
    version_number: number;
    import_templates: Related<{
      template_name: string;
    }>;
  }>;
};

type MappingRun = {
  mapping_import_run_id: string;
  mapping_type: string;
  target_table: string;
  selected_sheet_name: string | null;
  selected_sheet_index: number | null;
  run_status: string;
  row_count: number;
  rows_accepted: number;
  rows_rejected: number;
  rows_with_warnings: number;
  new_mappings: number;
  changed_mappings: number;
  unchanged_mappings: number;
  duplicate_rows: number;
  conflicting_rows: number;
  mapping_version_id: string | null;
  created_at: string;
  committed_at: string | null;
};

type MappingRow = {
  mapping_import_row_id: string;
  source_row_number: number;
  mapping_code: string | null;
  mapping_name: string | null;
  row_status: string;
  accepted_for_commit: boolean;
  effective_start_date: string | null;
  changed_fields_json: Record<string, { current: unknown; incoming: unknown }>;
};

type MappingIssue = {
  mapping_import_issue_id: string;
  source_row_number: number | null;
  source_column_name: string | null;
  target_field_name: string | null;
  raw_value: string | null;
  transformed_value: string | null;
  issue_type: string;
  issue_severity: string;
  issue_message: string;
  suggested_fix: string | null;
};

export default async function MappingImportReviewPage({
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
      batch_status,
      template_version_id,
      import_types (
        import_type_code,
        import_type_name
      ),
      source_files (
        original_file_name,
        content_type
      ),
      import_template_versions (
        version_number,
        import_templates (
          template_name
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
    .from("mapping_import_runs")
    .select(
      "mapping_import_run_id, mapping_type, target_table, selected_sheet_name, selected_sheet_index, run_status, row_count, rows_accepted, rows_rejected, rows_with_warnings, new_mappings, changed_mappings, unchanged_mappings, duplicate_rows, conflicting_rows, mapping_version_id, created_at, committed_at"
    )
    .eq("organization_id", appUser.organization_id)
    .eq("import_batch_id", importBatchId)
    .in("run_status", ["previewed", "committed"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<MappingRun>();
  const latestRun = latestRunResult.data ?? null;

  const rowsResult = latestRun
    ? await adminClient
        .from("mapping_import_rows")
        .select(
          "mapping_import_row_id, source_row_number, mapping_code, mapping_name, row_status, accepted_for_commit, effective_start_date, changed_fields_json"
        )
        .eq("organization_id", appUser.organization_id)
        .eq("mapping_import_run_id", latestRun.mapping_import_run_id)
        .order("source_row_number", { ascending: true })
        .limit(100)
        .returns<MappingRow[]>()
    : null;
  const issuesResult = latestRun
    ? await adminClient
        .from("mapping_import_issues")
        .select(
          "mapping_import_issue_id, source_row_number, source_column_name, target_field_name, raw_value, transformed_value, issue_type, issue_severity, issue_message, suggested_fix"
        )
        .eq("organization_id", appUser.organization_id)
        .eq("mapping_import_run_id", latestRun.mapping_import_run_id)
        .order("source_row_number", { ascending: true })
        .limit(100)
        .returns<MappingIssue[]>()
    : null;

  const batch = batchResult.data;
  const importType = getRelatedRecord(batch.import_types);
  const sourceFile = getRelatedRecord(batch.source_files);
  const templateVersion = getRelatedRecord(batch.import_template_versions);
  const template = getRelatedRecord(templateVersion?.import_templates);
  const supported =
    importType?.import_type_code &&
    isSupportedMappingImportType(importType.import_type_code);
  const canPreview = Boolean(supported && batch.template_version_id);
  const canCommit = Boolean(
    latestRun && latestRun.run_status === "previewed" && latestRun.rows_accepted > 0
  );

  return (
    <AppShell>
      <section className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-primary">Imports</p>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Mapping Import Review
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              This review updates reference mappings only after confirmation.
              It does not post trial balance activity, run calculations, update
              dashboards, or generate reports.
            </p>
          </div>
          <Link
            className="inline-flex items-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
            href="/imports"
          >
            Back to Imports
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Import context</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm md:grid-cols-3">
            <InfoItem label="Original filename" value={sourceFile?.original_file_name} />
            <InfoItem label="Import type" value={importType?.import_type_name} />
            <InfoItem label="Mapping target table" value={latestRun?.target_table ?? "Not previewed"} />
            <InfoItem
              label="Selected sheet"
              value={
                latestRun?.selected_sheet_name ??
                (latestRun?.selected_sheet_index === 0 ? "CSV" : "Not previewed")
              }
            />
            <InfoItem
              label="Template"
              value={
                template
                  ? `${template.template_name} v${templateVersion?.version_number}`
                  : "Not selected"
              }
            />
            <InfoItem label="Preview status" value={latestRun?.run_status ?? "Not generated"} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Generate review</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!supported ? (
              <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
                Mapping review is available only for fund, object, ACFR,
                department, and function mapping imports.
              </p>
            ) : null}
            {supported && !batch.template_version_id ? (
              <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
                Select or create a single-mapping-type template before previewing this import.
              </p>
            ) : null}
            <MappingPreviewAction
              disabled={!canPreview}
              importBatchId={batch.import_batch_id}
            />
          </CardContent>
        </Card>

        {latestRunResult.error ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">
                Mapping preview history could not be loaded. Apply the Slice 6
                migration before using this workflow. Details:{" "}
                {latestRunResult.error.message}
              </p>
            </CardContent>
          </Card>
        ) : null}

        {latestRun ? (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 text-sm md:grid-cols-5">
                <InfoItem label="Rows detected" value={latestRun.row_count} />
                <InfoItem label="Rows accepted" value={latestRun.rows_accepted} />
                <InfoItem label="Rows rejected" value={latestRun.rows_rejected} />
                <InfoItem label="Rows with warnings" value={latestRun.rows_with_warnings} />
                <InfoItem label="New mappings" value={latestRun.new_mappings} />
                <InfoItem label="Changed mappings" value={latestRun.changed_mappings} />
                <InfoItem label="Unchanged mappings" value={latestRun.unchanged_mappings} />
                <InfoItem label="Duplicate rows" value={latestRun.duplicate_rows} />
                <InfoItem label="Conflicting rows" value={latestRun.conflicting_rows} />
                <InfoItem
                  label="Mapping version"
                  value={latestRun.mapping_version_id ?? "Not committed"}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Bad-data report</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">
                    Rejected or problem rows must be fixed in the source file and reuploaded.
                  </p>
                  <Link
                    className="inline-flex items-center rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
                    href={`/imports/${batch.import_batch_id}/mapping-preview/bad-data.csv`}
                  >
                    Export CSV
                  </Link>
                </div>
                {issuesResult?.error ? (
                  <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
                    Bad-data report could not be loaded: {issuesResult.error.message}
                  </p>
                ) : null}
                {(issuesResult?.data ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No bad-data issues were detected in the latest preview.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1000px] border-collapse text-left text-sm">
                      <thead>
                        <tr className="border-b border-border text-muted-foreground">
                          <th className="py-3 pr-4 font-medium">Source row</th>
                          <th className="py-3 pr-4 font-medium">Source column</th>
                          <th className="py-3 pr-4 font-medium">Target field</th>
                          <th className="py-3 pr-4 font-medium">Raw value</th>
                          <th className="py-3 pr-4 font-medium">Transformed value</th>
                          <th className="py-3 pr-4 font-medium">Issue type</th>
                          <th className="py-3 pr-4 font-medium">Severity</th>
                          <th className="py-3 pr-4 font-medium">Issue message</th>
                          <th className="py-3 font-medium">Suggested fix</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(issuesResult?.data ?? []).map((issue) => (
                          <tr
                            className="border-b border-border align-top"
                            key={issue.mapping_import_issue_id}
                          >
                            <td className="py-3 pr-4 text-muted-foreground">{issue.source_row_number}</td>
                            <td className="py-3 pr-4 text-muted-foreground">{issue.source_column_name}</td>
                            <td className="py-3 pr-4 text-muted-foreground">{issue.target_field_name}</td>
                            <td className="py-3 pr-4 text-muted-foreground">{issue.raw_value}</td>
                            <td className="py-3 pr-4 text-muted-foreground">{issue.transformed_value}</td>
                            <td className="py-3 pr-4 text-muted-foreground">{issue.issue_type}</td>
                            <td className="py-3 pr-4 text-muted-foreground">{issue.issue_severity}</td>
                            <td className="py-3 pr-4 text-muted-foreground">{issue.issue_message}</td>
                            <td className="py-3 text-muted-foreground">{issue.suggested_fix}</td>
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
                <CardTitle>Mapping change review</CardTitle>
              </CardHeader>
              <CardContent>
                {rowsResult?.error ? (
                  <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
                    Mapping rows could not be loaded: {rowsResult.error.message}
                  </p>
                ) : null}
                {(rowsResult?.data ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No preview rows have been saved for this run.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px] border-collapse text-left text-sm">
                      <thead>
                        <tr className="border-b border-border text-muted-foreground">
                          <th className="py-3 pr-4 font-medium">Source row</th>
                          <th className="py-3 pr-4 font-medium">Mapping code</th>
                          <th className="py-3 pr-4 font-medium">Mapping name</th>
                          <th className="py-3 pr-4 font-medium">Effective start date</th>
                          <th className="py-3 pr-4 font-medium">Change status</th>
                          <th className="py-3 font-medium">Changed fields</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(rowsResult?.data ?? []).map((row) => (
                          <tr className="border-b border-border align-top" key={row.mapping_import_row_id}>
                            <td className="py-3 pr-4 text-muted-foreground">{row.source_row_number}</td>
                            <td className="py-3 pr-4 font-medium text-foreground">{row.mapping_code}</td>
                            <td className="py-3 pr-4 text-muted-foreground">{row.mapping_name}</td>
                            <td className="py-3 pr-4 text-muted-foreground">
                              {row.effective_start_date ?? "Default required before commit"}
                            </td>
                            <td className="py-3 pr-4 text-muted-foreground">{row.row_status}</td>
                            <td className="py-3 text-muted-foreground">
                              {Object.keys(row.changed_fields_json ?? {}).join(", ") || "None"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="mt-3 text-sm text-muted-foreground">
                      Showing up to 100 preview rows from the latest mapping review.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Commit action</CardTitle>
              </CardHeader>
              <CardContent>
                <MappingCommitAction
                  disabled={!canCommit}
                  importBatchId={batch.import_batch_id}
                  mappingImportRunId={latestRun.mapping_import_run_id}
                />
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
