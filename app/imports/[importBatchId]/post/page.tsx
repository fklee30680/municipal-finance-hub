import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import {
  PostValidatedTrialBalanceAction,
  RequestReplacementAction
} from "@/components/trial-balance-posting-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ensureAppUserForAuthUser } from "@/lib/auth/app-user";
import { requireUser } from "@/lib/auth/session";
import { findActivePeriodImport } from "@/lib/imports/trial-balance-posting";
import { createAdminClient } from "@/lib/supabase/admin";

type Related<T> = T | T[] | null;

type ImportBatchDetail = {
  import_batch_id: string;
  fiscal_year: number | null;
  period: number | null;
  batch_status: string;
  is_active_for_reporting: boolean;
  active_status: string;
  reporting_status: string;
  rows_processed: number;
  rows_rejected: number;
  warning_count: number;
  posted_at: string | null;
  import_types: Related<{
    import_type_code: string;
    import_type_name: string;
  }>;
  source_files: Related<{
    original_file_name: string;
  }>;
  import_template_versions: Related<{
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
  validated_at: string | null;
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

type ReplacementRequestRow = {
  inactivation_request_id: string;
  request_status: string;
  approval_status: string | null;
  request_reason: string;
  requested_at: string;
};

export default async function PostTrialBalancePage({
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
      is_active_for_reporting,
      active_status,
      reporting_status,
      rows_processed,
      rows_rejected,
      warning_count,
      posted_at,
      import_types (
        import_type_code,
        import_type_name
      ),
      source_files (
        original_file_name
      ),
      import_template_versions (
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

  const [validationResult, postingRunsResult, replacementRequestsResult] =
    await Promise.all([
      adminClient
        .from("validation_runs")
        .select(
          "validation_run_id, status, eligible_to_post, warnings_acknowledged, critical_error_count, warning_count, information_count, rows_validated, rows_rejected, validated_at, created_at"
        )
        .eq("organization_id", appUser.organization_id)
        .eq("import_batch_id", importBatchId)
        .eq("status", "completed")
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
        .from("inactivation_requests")
        .select(
          "inactivation_request_id, request_status, approval_status, request_reason, requested_at"
        )
        .eq("organization_id", appUser.organization_id)
        .eq("replacement_import_batch_id", importBatchId)
        .eq("requested_action", "replacement")
        .order("requested_at", { ascending: false })
        .returns<ReplacementRequestRow[]>()
    ]);

  const batch = batchResult.data;
  const importType = getRelatedRecord(batch.import_types);
  const sourceFile = getRelatedRecord(batch.source_files);
  const templateVersion = getRelatedRecord(batch.import_template_versions);
  const template = getRelatedRecord(templateVersion?.import_templates);
  const accountStructure = getRelatedRecord(templateVersion?.account_structures);
  const latestValidation = validationResult.data ?? null;
  const latestPostingRun = postingRunsResult.data?.[0] ?? null;
  const replacementRequests = replacementRequestsResult.data ?? [];
  const activeConflict = await findActivePeriodImport({
    adminClient,
    excludeImportBatchId: importBatchId,
    fiscalYear: batch.fiscal_year,
    organizationId: appUser.organization_id,
    period: batch.period
  });
  const alreadyPosted =
    ["posted", "posted_with_exceptions"].includes(batch.batch_status) ||
    batch.is_active_for_reporting;
  const canPostNormally =
    importType?.import_type_code === "trial_balance" &&
    Boolean(latestValidation?.eligible_to_post) &&
    latestValidation?.critical_error_count === 0 &&
    (!latestValidation.warning_count || latestValidation.warnings_acknowledged) &&
    !activeConflict &&
    !alreadyPosted;
  const blockingReason = getPostingBlockReason({
    activeConflict: Boolean(activeConflict),
    alreadyPosted,
    importTypeCode: importType?.import_type_code,
    latestValidation
  });

  return (
    <AppShell>
      <section className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-primary">Imports</p>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Post Validated Trial Balance
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              Posting makes validated trial balance rows active for future
              calculations, dashboards, and reports. This action does not
              delete raw files or prior audit history.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              className="inline-flex items-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
              href={`/imports/${batch.import_batch_id}/validation`}
            >
              Back to Validation
            </Link>
            <Link
              className="inline-flex items-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
              href={`/imports/${batch.import_batch_id}/review`}
            >
              Import Review
            </Link>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Posting context</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm md:grid-cols-3">
            <InfoItem label="Original filename" value={sourceFile?.original_file_name} />
            <InfoItem label="Import type" value={importType?.import_type_name} />
            <InfoItem label="Fiscal year" value={batch.fiscal_year ?? "Not provided"} />
            <InfoItem label="Period" value={batch.period ?? "Not provided"} />
            <InfoItem
              label="Template version"
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
            <InfoItem
              label="Validation run"
              value={latestValidation?.validation_run_id ?? "Not run"}
            />
            <InfoItem
              label="Rows to post"
              value={latestValidation?.rows_validated ?? "Not available"}
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
            <InfoItem label="Import status" value={batch.batch_status} />
            <InfoItem
              label="Active reporting status"
              value={batch.is_active_for_reporting ? "Active" : "Not active"}
            />
            <InfoItem
              label="Latest posting run"
              value={latestPostingRun?.posting_run_id ?? "Not posted"}
            />
          </CardContent>
        </Card>

        <Card className="border-border bg-muted">
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-foreground">
              Posting consumes validated preview rows. It does not reread the
              raw source file, re-run template parsing, run calculations, update
              dashboards, generate reports, or import budget data.
            </p>
          </CardContent>
        </Card>

        {blockingReason ? (
          <Card>
            <CardHeader>
              <CardTitle>Posting availability</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
                {blockingReason}
              </p>
            </CardContent>
          </Card>
        ) : null}

        {activeConflict ? (
          <Card>
            <CardHeader>
              <CardTitle>Period conflict</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 text-sm md:grid-cols-2">
                <InfoItem label="Existing active import" value={activeConflict.import_batch_id} />
                <InfoItem
                  label="Existing source file"
                  value={getActiveConflictFileName(activeConflict.source_files)}
                />
                <InfoItem label="Existing posted at" value={formatOptionalDate(activeConflict.posted_at)} />
                <InfoItem label="Rows currently active" value={activeConflict.rows_processed} />
              </div>
              <p className="text-sm text-muted-foreground">
                Normal posting is blocked because an active import already
                exists for this fiscal year and period. Request replacement if
                this import should supersede the existing active data.
              </p>
              <RequestReplacementAction
                disabled={alreadyPosted || importType?.import_type_code !== "trial_balance"}
                importBatchId={batch.import_batch_id}
              />
            </CardContent>
          </Card>
        ) : null}

        {!activeConflict ? (
          <Card>
            <CardHeader>
              <CardTitle>Posting confirmation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Posting will make these validated trial balance rows active for
                future calculations, dashboards, and reports. This action will
                not delete raw files, preview rows, validation results, or audit
                history.
              </p>
              <PostValidatedTrialBalanceAction
                disabled={!canPostNormally}
                importBatchId={batch.import_batch_id}
              />
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Replacement requests</CardTitle>
          </CardHeader>
          <CardContent>
            {replacementRequestsResult.error ? (
              <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
                Replacement requests could not be loaded:{" "}
                {replacementRequestsResult.error.message}
              </p>
            ) : null}
            {!replacementRequestsResult.error && replacementRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No replacement requests have been created for this import.
              </p>
            ) : null}
            {replacementRequests.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="py-3 pr-4 font-medium">Request</th>
                      <th className="py-3 pr-4 font-medium">Status</th>
                      <th className="py-3 pr-4 font-medium">Reason</th>
                      <th className="py-3 font-medium">Requested at</th>
                    </tr>
                  </thead>
                  <tbody>
                    {replacementRequests.map((request) => (
                      <tr
                        className="border-b border-border align-top"
                        key={request.inactivation_request_id}
                      >
                        <td className="py-3 pr-4 text-muted-foreground">
                          {request.inactivation_request_id}
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {request.approval_status ?? request.request_status}
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {request.request_reason}
                        </td>
                        <td className="py-3 text-muted-foreground">
                          {formatDate(request.requested_at)}
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

function getPostingBlockReason({
  activeConflict,
  alreadyPosted,
  importTypeCode,
  latestValidation
}: {
  activeConflict: boolean;
  alreadyPosted: boolean;
  importTypeCode: string | undefined;
  latestValidation: ValidationRunRow | null;
}) {
  if (importTypeCode !== "trial_balance") {
    return "Posting is available only for trial_balance import batches.";
  }

  if (alreadyPosted) {
    return "This import is already posted or active for reporting.";
  }

  if (!latestValidation) {
    return "Run Slice 7 validation before posting.";
  }

  if (latestValidation.status !== "completed") {
    return "The latest validation run is not complete.";
  }

  if (latestValidation.critical_error_count > 0 && !activeConflict) {
    return "Critical validation errors block posting.";
  }

  if (latestValidation.warning_count > 0 && !latestValidation.warnings_acknowledged) {
    return "Warnings must be acknowledged before posting.";
  }

  if (!latestValidation.eligible_to_post && !activeConflict) {
    return "The latest validation run is not eligible for posting.";
  }

  return null;
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

function getActiveConflictFileName(
  value:
    | { original_file_name: string }
    | Array<{ original_file_name: string }>
    | null
    | undefined
) {
  const sourceFile = getRelatedRecord(value);
  return sourceFile?.original_file_name ?? "Not available";
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
