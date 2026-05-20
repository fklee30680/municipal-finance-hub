import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { ArchiveImportAction } from "@/components/archive-import-action";
import { RequestReactivationAction } from "@/components/trial-balance-posting-actions";
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
  reporting_status: string;
  active_status: string;
  is_active_for_reporting: boolean;
  rows_processed: number;
  rows_rejected: number;
  warning_count: number;
  error_count: number;
  posted_by: string | null;
  posted_at: string | null;
  inactive_at: string | null;
  reactivated_at: string | null;
  supersedes_import_batch_id: string | null;
  superseded_by_import_batch_id: string | null;
  metadata: Record<string, unknown> | null;
  import_types: Related<{
    import_type_code: string;
    import_type_name: string;
  }>;
  source_files: Related<{
    source_file_id: string;
    original_file_name: string;
    checksum_sha256: string | null;
  }>;
  import_template_versions: Related<{
    template_version_id: string;
    version_number: number;
    import_templates: Related<{
      template_name: string;
    }>;
    account_structures: Related<{
      structure_name: string;
    }>;
  }>;
};

type ValidationRunRow = {
  validation_run_id: string;
  status: string;
  eligible_to_post: boolean;
  warnings_acknowledged: boolean;
  critical_error_count: number;
  warning_count: number;
  information_count: number;
  rows_validated: number;
  rows_rejected: number;
  created_at: string;
};

type PostingRunRow = {
  posting_run_id: string;
  status: string;
  posting_mode: string;
  posted_row_count: number;
  rejected_row_count: number;
  posted_at: string | null;
  error_message: string | null;
  created_at: string;
};

type MappingVersionLinkRow = {
  mapping_type: string;
  mapping_versions: Related<{
    mapping_version_id: string;
    mapping_version: number;
    version_name: string | null;
    mapping_scope: string;
  }>;
};

type WarningAcknowledgementRow = {
  warning_acknowledgement_id: string;
  acknowledged_at: string;
  acknowledgement_note: string | null;
  warning_count_acknowledged: number;
};

type AuditLogRow = {
  audit_log_id: string;
  action_type: string;
  entity_table: string | null;
  entity_id: string | null;
  created_at: string;
};

export default async function ImportReviewPage({
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
      reporting_status,
      active_status,
      is_active_for_reporting,
      rows_processed,
      rows_rejected,
      warning_count,
      error_count,
      posted_by,
      posted_at,
      inactive_at,
      reactivated_at,
      supersedes_import_batch_id,
      superseded_by_import_batch_id,
      metadata,
      import_types (
        import_type_code,
        import_type_name
      ),
      source_files (
        source_file_id,
        original_file_name,
        checksum_sha256
      ),
      import_template_versions (
        template_version_id,
        version_number,
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

  const [validationResult, postingRunsResult, auditResult] = await Promise.all([
    adminClient
      .from("validation_runs")
      .select(
        "validation_run_id, status, eligible_to_post, warnings_acknowledged, critical_error_count, warning_count, information_count, rows_validated, rows_rejected, created_at"
      )
      .eq("organization_id", appUser.organization_id)
      .eq("import_batch_id", importBatchId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<ValidationRunRow>(),
    adminClient
      .from("posting_runs")
      .select(
        "posting_run_id, status, posting_mode, posted_row_count, rejected_row_count, posted_at, error_message, created_at"
      )
      .eq("organization_id", appUser.organization_id)
      .eq("import_batch_id", importBatchId)
      .order("created_at", { ascending: false })
      .limit(5)
      .returns<PostingRunRow[]>(),
    adminClient
      .from("audit_logs")
      .select("audit_log_id, action_type, entity_table, entity_id, created_at")
      .eq("organization_id", appUser.organization_id)
      .or(`entity_id.eq.${importBatchId},after_payload->>import_batch_id.eq.${importBatchId}`)
      .order("created_at", { ascending: false })
      .limit(10)
      .returns<AuditLogRow[]>()
  ]);

  const latestValidation = validationResult.data ?? null;
  const postingRuns = postingRunsResult.data ?? [];
  const latestPostingRun = postingRuns[0] ?? null;
  const [mappingLinksResult, acknowledgementsResult] = await Promise.all([
    latestPostingRun
      ? adminClient
          .from("posting_run_mapping_versions")
          .select(
            `
            mapping_type,
            mapping_versions (
              mapping_version_id,
              mapping_version,
              version_name,
              mapping_scope
            )
          `
          )
          .eq("organization_id", appUser.organization_id)
          .eq("posting_run_id", latestPostingRun.posting_run_id)
          .returns<MappingVersionLinkRow[]>()
      : null,
    latestValidation
      ? adminClient
          .from("warning_acknowledgements")
          .select(
            "warning_acknowledgement_id, acknowledged_at, acknowledgement_note, warning_count_acknowledged"
          )
          .eq("organization_id", appUser.organization_id)
          .eq("validation_run_id", latestValidation.validation_run_id)
          .order("acknowledged_at", { ascending: false })
          .returns<WarningAcknowledgementRow[]>()
      : null
  ]);

  const batch = batchResult.data;
  const importType = getRelatedRecord(batch.import_types);
  const sourceFile = getRelatedRecord(batch.source_files);
  const templateVersion = getRelatedRecord(batch.import_template_versions);
  const template = getRelatedRecord(templateVersion?.import_templates);
  const accountStructure = getRelatedRecord(templateVersion?.account_structures);
  const mappingLinks = mappingLinksResult?.data ?? [];
  const acknowledgements = acknowledgementsResult?.data ?? [];
  const canRequestReactivation =
    ["inactive", "superseded"].includes(batch.batch_status) ||
    batch.active_status === "inactive" ||
    !batch.is_active_for_reporting;
  const canArchive =
    !batch.is_active_for_reporting &&
    !["archived", "posted", "posted_with_exceptions", "superseded"].includes(
      batch.batch_status
    );

  return (
    <AppShell>
      <section className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-primary">Imports</p>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Import Review
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              Review source, template, validation, posting, supersession, and
              audit lineage for this import batch. Inactive and superseded
              imports are retained for audit history.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              className="inline-flex items-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
              href={`/imports/${batch.import_batch_id}/post`}
            >
              Posting
            </Link>
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
            <CardTitle>Import lineage</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm md:grid-cols-3">
            <InfoItem label="Import batch" value={batch.import_batch_id} />
            <InfoItem label="Source file" value={sourceFile?.original_file_name} />
            <InfoItem label="Source file hash" value={sourceFile?.checksum_sha256} />
            <InfoItem label="Import type" value={importType?.import_type_name} />
            <InfoItem label="Fiscal year" value={batch.fiscal_year ?? "Not provided"} />
            <InfoItem label="Period" value={batch.period ?? "Not provided"} />
            <InfoItem label="Import status" value={batch.batch_status} />
            <InfoItem label="Active status" value={batch.active_status} />
            <InfoItem label="Reporting status" value={batch.reporting_status} />
            <InfoItem
              label="Active for reporting"
              value={batch.is_active_for_reporting ? "Yes" : "No"}
            />
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
            <InfoItem label="Posted by" value={batch.posted_by} />
            <InfoItem label="Posted at" value={formatOptionalDate(batch.posted_at)} />
            <InfoItem label="Rows posted" value={batch.rows_processed} />
            <InfoItem label="Rows rejected" value={batch.rows_rejected} />
            <InfoItem
              label="Supersedes batch"
              value={batch.supersedes_import_batch_id}
            />
            <InfoItem
              label="Superseded by batch"
              value={batch.superseded_by_import_batch_id}
            />
          </CardContent>
        </Card>

        <Card className="border-border bg-muted">
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-foreground">
              Superseded and inactive imports are excluded from active reporting
              by default but remain available through review and period filters.
              Raw files, preview rows, validation results, and audit history are
              not physically deleted by this workflow.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Archive bad upload</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Archive a bad or accidental upload without deleting the raw file.
              Archived uploads are inactive and hidden from default import
              workflows, but they remain available when inactive records are
              included.
            </p>
            <ArchiveImportAction
              disabled={!canArchive}
              importBatchId={batch.import_batch_id}
            />
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Validation summary</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 text-sm md:grid-cols-2">
              <InfoItem
                label="Validation run"
                value={latestValidation?.validation_run_id ?? "Not run"}
              />
              <InfoItem label="Validation status" value={latestValidation?.status} />
              <InfoItem
                label="Eligible to post"
                value={
                  latestValidation
                    ? latestValidation.eligible_to_post
                      ? "Yes"
                      : "No"
                    : "Not evaluated"
                }
              />
              <InfoItem
                label="Warnings acknowledged"
                value={
                  latestValidation
                    ? latestValidation.warnings_acknowledged
                      ? "Yes"
                      : "No"
                    : "Not applicable"
                }
              />
              <InfoItem
                label="Critical errors"
                value={latestValidation?.critical_error_count}
              />
              <InfoItem label="Warnings" value={latestValidation?.warning_count} />
              <InfoItem
                label="Information"
                value={latestValidation?.information_count}
              />
              <InfoItem
                label="Rows validated"
                value={latestValidation?.rows_validated}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Posting summary</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 text-sm md:grid-cols-2">
              <InfoItem
                label="Posting run"
                value={latestPostingRun?.posting_run_id ?? "Not posted"}
              />
              <InfoItem label="Posting status" value={latestPostingRun?.status} />
              <InfoItem label="Posting mode" value={latestPostingRun?.posting_mode} />
              <InfoItem
                label="Posted rows"
                value={latestPostingRun?.posted_row_count}
              />
              <InfoItem
                label="Rejected rows"
                value={latestPostingRun?.rejected_row_count}
              />
              <InfoItem
                label="Posting timestamp"
                value={formatOptionalDate(latestPostingRun?.posted_at)}
              />
              <InfoItem
                label="Posting error"
                value={latestPostingRun?.error_message}
              />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Mapping versions</CardTitle>
          </CardHeader>
          <CardContent>
            {mappingLinksResult?.error ? (
              <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
                Mapping links could not be loaded: {mappingLinksResult.error.message}
              </p>
            ) : null}
            {!mappingLinksResult?.error && mappingLinks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No posting mapping-version links are recorded yet.
              </p>
            ) : null}
            {mappingLinks.length > 0 ? (
              <div className="grid gap-3 text-sm md:grid-cols-2">
                {mappingLinks.map((link) => {
                  const mappingVersion = getRelatedRecord(link.mapping_versions);
                  return (
                    <InfoItem
                      key={`${link.mapping_type}-${mappingVersion?.mapping_version_id}`}
                      label={link.mapping_type}
                      value={
                        mappingVersion
                          ? `${mappingVersion.version_name ?? mappingVersion.mapping_scope} v${mappingVersion.mapping_version}`
                          : "Unavailable"
                      }
                    />
                  );
                })}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Warning acknowledgement trail</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {acknowledgementsResult?.error ? (
              <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
                Warning acknowledgement records could not be loaded:{" "}
                {acknowledgementsResult.error.message}
              </p>
            ) : null}
            {!acknowledgementsResult?.error && acknowledgements.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No warning acknowledgements are recorded for this import.
              </p>
            ) : null}
            {acknowledgements.map((acknowledgement) => (
              <p
                className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground"
                key={acknowledgement.warning_acknowledgement_id}
              >
                {acknowledgement.warning_count_acknowledged} warnings acknowledged
                on {formatDate(acknowledgement.acknowledged_at)}
                {acknowledgement.acknowledgement_note
                  ? `: ${acknowledgement.acknowledgement_note}`
                  : "."}
              </p>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Reactivation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Reactivation requires a request, approval, audit trail, and
              conflict check. It is blocked when another active import already
              exists for the same fiscal year and period.
            </p>
            <RequestReactivationAction
              disabled={!canRequestReactivation}
              importBatchId={batch.import_batch_id}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Audit summary</CardTitle>
          </CardHeader>
          <CardContent>
            {auditResult.error ? (
              <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
                Audit history could not be loaded: {auditResult.error.message}
              </p>
            ) : null}
            {!auditResult.error && (auditResult.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No audit entries were found for this import.
              </p>
            ) : null}
            {(auditResult.data ?? []).length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="py-3 pr-4 font-medium">Action</th>
                      <th className="py-3 pr-4 font-medium">Entity</th>
                      <th className="py-3 font-medium">Created at</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(auditResult.data ?? []).map((entry) => (
                      <tr className="border-b border-border" key={entry.audit_log_id}>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {entry.action_type}
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {entry.entity_table ?? "Unknown"} / {entry.entity_id ?? "n/a"}
                        </td>
                        <td className="py-3 text-muted-foreground">
                          {formatDate(entry.created_at)}
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
      <p className="break-words text-muted-foreground">{value ?? "Not available"}</p>
    </div>
  );
}

function getRelatedRecord<T>(value: Related<T> | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function formatOptionalDate(value: string | null | undefined) {
  return value ? formatDate(value) : "Not available";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
