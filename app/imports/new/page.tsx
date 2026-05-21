import Link from "next/link";

import { uploadSourceFile } from "@/app/imports/actions";
import { createImportTemplate } from "@/app/imports/templates/actions";
import { AppShell } from "@/components/app-shell";
import {
  ImportStepCard,
  InfoItem,
  NextActionPanel
} from "@/components/import-workspace-panels";
import { ImportUploadForm } from "@/components/import-upload-form";
import {
  MappingCommitAction,
  MappingPreviewAction
} from "@/components/mapping-import-actions";
import { TemplateBuilderForm } from "@/components/template-builder-form";
import { PostValidatedTrialBalanceAction } from "@/components/trial-balance-posting-actions";
import { TrialBalancePreviewAction } from "@/components/trial-balance-preview-action";
import {
  AcknowledgeValidationWarningsAction,
  RunTrialBalanceValidationAction
} from "@/components/trial-balance-validation-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ensureAppUserForAuthUser } from "@/lib/auth/app-user";
import { requireUser } from "@/lib/auth/session";
import { isSupportedMappingImportType } from "@/lib/imports/mapping-import";
import {
  getNextImportWorkflowAction,
  type ImportWorkflowSnapshot
} from "@/lib/imports/workflow-state";
import { createAdminClient } from "@/lib/supabase/admin";
import { inspectSourceFileForTemplate } from "@/lib/templates/file-inspection";
import {
  formatFileSize,
  SUPPORTED_IMPORT_TYPE_CODES
} from "@/lib/uploads/config";

type Related<T> = T | T[] | null;

type ImportBatchOption = {
  import_batch_id: string;
  fiscal_year: number | null;
  period: number | null;
  batch_status: string;
  template_version_id: string | null;
  warning_count: number;
  rows_accepted: number;
  rows_rejected: number;
  is_active_for_reporting: boolean;
  import_types: Related<{
    import_type_code: string;
    import_type_name: string;
  }>;
  source_files: Related<{
    source_file_id: string;
    original_file_name: string;
    byte_size: number | null;
    uploaded_at: string;
  }>;
  import_template_versions: Related<{
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
};

type ValidationRunRow = {
  validation_run_id: string;
  status: string;
  eligible_to_post: boolean;
  warnings_acknowledged: boolean;
  critical_error_count: number;
  warning_count: number;
  information_count: number;
  rows_detected: number;
  rows_validated: number;
  rows_rejected: number;
  created_at: string;
};

type MappingRunRow = {
  mapping_import_run_id: string;
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
  committed_at: string | null;
  created_at: string;
};

export default async function NewImportPage({
  searchParams
}: {
  searchParams: Promise<{
    importBatchId?: string;
    importTypeCode?: string;
    sourceFileId?: string;
  }>;
}) {
  const { importBatchId, importTypeCode, sourceFileId } = await searchParams;
  const authUser = await requireUser();
  const adminClient = createAdminClient();
  const appUser = await ensureAppUserForAuthUser(adminClient, authUser);

  const data = await loadWorkspaceData({
    adminClient,
    organizationId: appUser.organization_id
  });
  const selectedBatch =
    (importBatchId
      ? data.importBatches.find((batch) => batch.import_batch_id === importBatchId)
      : null) ??
    (sourceFileId
      ? data.importBatches.find(
          (batch) => getRelatedRecord(batch.source_files)?.source_file_id === sourceFileId
        )
      : null) ??
    null;
  const selectedSourceFile =
    getRelatedRecord(selectedBatch?.source_files) ??
    (sourceFileId
      ? data.sourceFiles.find((sourceFile) => sourceFile.source_file_id === sourceFileId)
      : null) ??
    null;
  const selectedImportType =
    getRelatedRecord(selectedBatch?.import_types) ??
    data.importTypes.find(
      (type) => type.import_type_code === (importTypeCode ?? "")
    ) ??
    null;
  const selectedImportTypeId = selectedImportType
    ? data.importTypes.find(
        (type) => type.import_type_code === selectedImportType.import_type_code
      )?.import_type_id
    : undefined;
  const selectedTemplateVersion = getRelatedRecord(
    selectedBatch?.import_template_versions
  );
  const selectedTemplate = getRelatedRecord(
    selectedTemplateVersion?.import_templates
  );
  const selectedAccountStructure = getRelatedRecord(
    selectedTemplateVersion?.account_structures
  );
  const templateBuilderPreview = selectedSourceFile
    ? await safelyInspectSourceFile({
        adminClient,
        organizationId: appUser.organization_id,
        sourceFileId: selectedSourceFile.source_file_id
      })
    : null;
  const latestPreview = selectedBatch
    ? await loadLatestTrialBalancePreview({
        adminClient,
        importBatchId: selectedBatch.import_batch_id,
        organizationId: appUser.organization_id
      })
    : null;
  const latestValidation = selectedBatch
    ? await loadLatestValidation({
        adminClient,
        importBatchId: selectedBatch.import_batch_id,
        organizationId: appUser.organization_id
      })
    : null;
  const latestMappingRun = selectedBatch
    ? await loadLatestMappingRun({
        adminClient,
        importBatchId: selectedBatch.import_batch_id,
        organizationId: appUser.organization_id
      })
    : null;
  const workflowSnapshot: ImportWorkflowSnapshot = {
    batchStatus: selectedBatch?.batch_status,
    criticalErrorCount: latestValidation?.critical_error_count,
    eligibleToPost: latestValidation?.eligible_to_post,
    hasSourceFile: Boolean(selectedSourceFile),
    hasTemplateVersion: Boolean(selectedBatch?.template_version_id),
    importTypeCode: selectedImportType?.import_type_code,
    latestMappingRunStatus: latestMappingRun?.run_status,
    latestPreviewStatus: latestPreview?.preview_status,
    latestValidationStatus: latestValidation?.status,
    mappingRowsAccepted: latestMappingRun?.rows_accepted,
    warningCount: latestValidation?.warning_count,
    warningsAcknowledged: latestValidation?.warnings_acknowledged
  };
  const nextAction = getNextImportWorkflowAction(workflowSnapshot);
  const isTrialBalance = selectedImportType?.import_type_code === "trial_balance";
  const isMappingImport = Boolean(
    selectedImportType?.import_type_code &&
      isSupportedMappingImportType(selectedImportType.import_type_code)
  );

  return (
    <AppShell>
      <section className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-primary">Imports</p>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Import Workspace
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              Pick a file, select the header row, map columns, preview, review,
              and commit from one workspace. The app still preserves the raw
              file, template version, preview, validation, posting, and audit
              records behind the scenes.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              className="inline-flex items-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
              href="/imports"
            >
              Import history
            </Link>
            <Link
              className="inline-flex items-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
              href="/imports/templates"
            >
              Manage templates
            </Link>
          </div>
        </div>

        <NextActionPanel action={nextAction} />

        <Card>
          <CardHeader>
            <CardTitle>Import status</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm md:grid-cols-4">
            <InfoItem label="Import type" value={selectedImportType?.import_type_name} />
            <InfoItem label="Source file" value={selectedSourceFile?.original_file_name} />
            <InfoItem label="Fiscal year" value={selectedBatch?.fiscal_year ?? "Not provided"} />
            <InfoItem label="Period" value={selectedBatch?.period ?? "Not provided"} />
            <InfoItem label="Current status" value={selectedBatch?.batch_status ?? "Not started"} />
            <InfoItem
              label="Template/version"
              value={
                selectedTemplate
                  ? `${selectedTemplate.template_name} v${selectedTemplateVersion?.version_number}`
                  : "Not selected"
              }
            />
            <InfoItem
              label="Account structure"
              value={selectedAccountStructure?.structure_name}
            />
            <InfoItem
              label="Issues/warnings"
              value={[
                latestPreview
                  ? `${latestPreview.rows_with_preview_issues} preview issues`
                  : null,
                latestValidation
                  ? `${latestValidation.critical_error_count} critical / ${latestValidation.warning_count} warnings`
                  : null,
                latestMappingRun
                  ? `${latestMappingRun.rows_rejected} rejected / ${latestMappingRun.rows_with_warnings} warnings`
                  : null
              ]
                .filter(Boolean)
                .join(", ") || "None yet"}
            />
          </CardContent>
        </Card>

        <ImportStepCard
          description="Choose the import lane first so the workspace shows the right target fields and options."
          step={1}
          title="Select Import Type"
        >
          <div className="grid gap-3 text-sm md:grid-cols-3">
            {data.importTypes.map((type) => (
              <Link
                className={
                  selectedImportType?.import_type_code === type.import_type_code
                    ? "rounded-md border border-primary bg-primary/10 px-4 py-3 font-medium text-foreground"
                    : "rounded-md border border-border bg-card px-4 py-3 font-medium text-foreground hover:bg-muted"
                }
                href={`/imports/new?importTypeCode=${type.import_type_code}`}
                key={type.import_type_id}
              >
                {type.import_type_name}
              </Link>
            ))}
          </div>
        </ImportStepCard>

        <ImportStepCard
          description="Upload a new source file or resume a recent upload without leaving the workspace."
          step={2}
          title="Upload or Select Source File"
        >
          <div className="space-y-6">
            <ImportUploadForm
              action={uploadSourceFile}
              defaultImportTypeCode={selectedImportType?.import_type_code ?? importTypeCode}
              importTypes={data.importTypes}
            />
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-foreground">
                Resume a recent upload
              </h3>
              {data.importBatches.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No recent uploads are available yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="py-3 pr-4 font-medium">File</th>
                        <th className="py-3 pr-4 font-medium">Import type</th>
                        <th className="py-3 pr-4 font-medium">Status</th>
                        <th className="py-3 pr-4 font-medium">Size</th>
                        <th className="py-3 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.importBatches.slice(0, 8).map((batch) => {
                        const sourceFile = getRelatedRecord(batch.source_files);
                        const importType = getRelatedRecord(batch.import_types);

                        return (
                          <tr
                            className="border-b border-border align-top"
                            key={batch.import_batch_id}
                          >
                            <td className="py-3 pr-4 font-medium text-foreground">
                              {sourceFile?.original_file_name ?? "Unknown file"}
                            </td>
                            <td className="py-3 pr-4 text-muted-foreground">
                              {importType?.import_type_name ?? "Unknown type"}
                            </td>
                            <td className="py-3 pr-4 text-muted-foreground">
                              {batch.batch_status}
                            </td>
                            <td className="py-3 pr-4 text-muted-foreground">
                              {formatFileSize(sourceFile?.byte_size)}
                            </td>
                            <td className="py-3">
                              <Link
                                className="text-sm font-medium text-primary hover:underline"
                                href={`/imports/new?importBatchId=${batch.import_batch_id}&sourceFileId=${sourceFile?.source_file_id ?? ""}&importTypeCode=${importType?.import_type_code ?? ""}`}
                              >
                                Continue
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </ImportStepCard>

        <ImportStepCard
          description="Select the header row, choose one Excel sheet where applicable, map detected columns, or enter a manual header/letter/number override."
          step={3}
          title="File Layout and Column Mapping"
        >
          {selectedSourceFile ? (
            <TemplateBuilderForm
              accountStructures={data.accountStructures}
              action={createImportTemplate}
              defaultImportTypeId={selectedImportTypeId}
              defaultTemplateName={
                selectedImportType
                  ? `${selectedImportType.import_type_name} Import`
                  : undefined
              }
              importTypes={data.importTypes}
              mode="create"
              preview={templateBuilderPreview?.preview ?? null}
              sourceFiles={data.sourceFiles}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Upload or select a source file before mapping columns.
            </p>
          )}
          {templateBuilderPreview?.error ? (
            <p className="mt-4 rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
              File layout could not be inspected: {templateBuilderPreview.error}
            </p>
          ) : null}
        </ImportStepCard>

        <ImportStepCard
          description="Preview reads only through the saved template. It still does not validate, post, or activate data."
          step={5}
          title="Preview"
        >
          {!selectedBatch ? (
            <p className="text-sm text-muted-foreground">
              Create or select an upload before previewing.
            </p>
          ) : !selectedBatch.template_version_id ? (
            <p className="text-sm text-muted-foreground">
              Save a template version before previewing this import.
            </p>
          ) : isTrialBalance ? (
            <div className="space-y-4">
              <TrialBalancePreviewAction
                importBatchId={selectedBatch.import_batch_id}
              />
              {latestPreview ? (
                <div className="grid gap-4 text-sm md:grid-cols-4">
                  <InfoItem label="Rows detected" value={latestPreview.row_count} />
                  <InfoItem label="Rows previewed" value={latestPreview.previewed_row_count} />
                  <InfoItem
                    label="Preview issues"
                    value={latestPreview.rows_with_preview_issues}
                  />
                  <InfoItem
                    label="Ending balance total"
                    value={formatAmount(latestPreview.total_ending_balance)}
                  />
                  <InfoItem
                    label="Beginning balance total"
                    value={formatAmount(latestPreview.total_beginning_balance)}
                  />
                  <InfoItem label="Debit total" value={formatAmount(latestPreview.total_debits)} />
                  <InfoItem label="Credit total" value={formatAmount(latestPreview.total_credits)} />
                  <InfoItem
                    label="Net change total"
                    value={formatAmount(latestPreview.total_net_change)}
                  />
                </div>
              ) : null}
            </div>
          ) : isMappingImport ? (
            <div className="space-y-4">
              <MappingPreviewAction importBatchId={selectedBatch.import_batch_id} />
              {latestMappingRun ? (
                <div className="grid gap-4 text-sm md:grid-cols-5">
                  <InfoItem label="Rows detected" value={latestMappingRun.row_count} />
                  <InfoItem label="Rows accepted" value={latestMappingRun.rows_accepted} />
                  <InfoItem label="Rows rejected" value={latestMappingRun.rows_rejected} />
                  <InfoItem label="Warnings" value={latestMappingRun.rows_with_warnings} />
                  <InfoItem label="New mappings" value={latestMappingRun.new_mappings} />
                  <InfoItem label="Changed mappings" value={latestMappingRun.changed_mappings} />
                  <InfoItem label="Unchanged" value={latestMappingRun.unchanged_mappings} />
                  <InfoItem label="Duplicates" value={latestMappingRun.duplicate_rows} />
                  <InfoItem label="Conflicts" value={latestMappingRun.conflicting_rows} />
                  <InfoItem
                    label="Mapping version"
                    value={latestMappingRun.mapping_version_id ?? "Not committed"}
                  />
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Preview is not available for this import type.
            </p>
          )}
        </ImportStepCard>

        <ImportStepCard
          description="Trial balances validate before posting. Mapping imports review bad rows before commit."
          step={6}
          title="Validate or Review"
        >
          {selectedBatch && isTrialBalance ? (
            <div className="space-y-4">
              <RunTrialBalanceValidationAction
                disabled={!latestPreview}
                importBatchId={selectedBatch.import_batch_id}
              />
              {latestValidation ? (
                <>
                  <div className="grid gap-4 text-sm md:grid-cols-4">
                    <InfoItem label="Rows validated" value={latestValidation.rows_validated} />
                    <InfoItem label="Rows rejected" value={latestValidation.rows_rejected} />
                    <InfoItem
                      label="Critical errors"
                      value={latestValidation.critical_error_count}
                    />
                    <InfoItem label="Warnings" value={latestValidation.warning_count} />
                    <InfoItem
                      label="Posting eligibility"
                      value={latestValidation.eligible_to_post ? "Eligible" : "Blocked"}
                    />
                    <InfoItem
                      label="Warnings acknowledged"
                      value={latestValidation.warnings_acknowledged ? "Yes" : "No"}
                    />
                  </div>
                  {latestValidation.warning_count > 0 &&
                  latestValidation.critical_error_count === 0 &&
                  !latestValidation.warnings_acknowledged ? (
                    <AcknowledgeValidationWarningsAction
                      importBatchId={selectedBatch.import_batch_id}
                      validationRunId={latestValidation.validation_run_id}
                    />
                  ) : null}
                </>
              ) : null}
            </div>
          ) : selectedBatch && isMappingImport ? (
            <p className="text-sm leading-6 text-muted-foreground">
              Mapping review happens in the preview step: bad rows are reported,
              duplicates are flagged, and accepted rows can be committed below.
              Bad source data is fixed in the file and reuploaded.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Select a supported import type and generate preview before this step.
            </p>
          )}
        </ImportStepCard>

        <ImportStepCard
          description="This final action reuses the governed backend workflow. Trial balances still require validation; mapping imports still commit one mapping table at a time."
          step={7}
          title="Commit or Post"
        >
          {selectedBatch && isMappingImport && latestMappingRun ? (
            <MappingCommitAction
              disabled={
                latestMappingRun.run_status !== "previewed" ||
                latestMappingRun.rows_accepted === 0
              }
              importBatchId={selectedBatch.import_batch_id}
              mappingImportRunId={latestMappingRun.mapping_import_run_id}
            />
          ) : selectedBatch && isTrialBalance ? (
            <div className="space-y-3">
              <PostValidatedTrialBalanceAction
                disabled={
                  !latestValidation?.eligible_to_post ||
                  latestValidation.critical_error_count > 0 ||
                  (latestValidation.warning_count > 0 &&
                    !latestValidation.warnings_acknowledged)
                }
                importBatchId={selectedBatch.import_batch_id}
              />
              <p className="text-sm leading-6 text-muted-foreground">
                Period conflicts, replacement approvals, warning acknowledgement,
                and posting permissions are still enforced by the existing
                posting workflow.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Commit or posting actions appear after preview and review are ready.
            </p>
          )}
        </ImportStepCard>

        {selectedBatch ? (
          <Card>
            <CardHeader>
              <CardTitle>Advanced links</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3 text-sm">
              <Link className="font-medium text-primary hover:underline" href={`/imports/${selectedBatch.import_batch_id}/review`}>
                View details
              </Link>
              {isTrialBalance ? (
                <>
                  <Link className="font-medium text-primary hover:underline" href={`/imports/${selectedBatch.import_batch_id}/preview`}>
                    Full preview
                  </Link>
                  <Link className="font-medium text-primary hover:underline" href={`/imports/${selectedBatch.import_batch_id}/validation`}>
                    Full validation
                  </Link>
                  <Link className="font-medium text-primary hover:underline" href={`/imports/${selectedBatch.import_batch_id}/post`}>
                    Posting and replacement
                  </Link>
                </>
              ) : null}
              {isMappingImport ? (
                <Link className="font-medium text-primary hover:underline" href={`/imports/${selectedBatch.import_batch_id}/mapping-preview`}>
                  Full mapping review
                </Link>
              ) : null}
            </CardContent>
          </Card>
        ) : null}
      </section>
    </AppShell>
  );
}

async function loadWorkspaceData({
  adminClient,
  organizationId
}: {
  adminClient: ReturnType<typeof createAdminClient>;
  organizationId: string;
}) {
  const [importTypesResult, sourceFilesResult, accountStructuresResult, batchesResult] =
    await Promise.all([
      adminClient
        .from("import_types")
        .select("import_type_id, import_type_code, import_type_name")
        .eq("organization_id", organizationId)
        .eq("active_status", "active")
        .in("import_type_code", [...SUPPORTED_IMPORT_TYPE_CODES])
        .order("import_type_name", { ascending: true }),
      adminClient
        .from("source_files")
        .select("source_file_id, original_file_name, uploaded_at")
        .eq("organization_id", organizationId)
        .eq("active_status", "active")
        .order("uploaded_at", { ascending: false })
        .limit(50),
      adminClient
        .from("account_structures")
        .select("account_structure_id, structure_name, version_number")
        .eq("organization_id", organizationId)
        .eq("active_status", "active")
        .order("structure_name", { ascending: true }),
      adminClient
        .from("import_batches")
        .select(
          `
          import_batch_id,
          fiscal_year,
          period,
          batch_status,
          template_version_id,
          warning_count,
          rows_accepted,
          rows_rejected,
          is_active_for_reporting,
          import_types (
            import_type_code,
            import_type_name
          ),
          source_files (
            source_file_id,
            original_file_name,
            byte_size,
            uploaded_at
          ),
          import_template_versions (
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
        .eq("organization_id", organizationId)
        .neq("active_status", "inactive")
        .not("batch_status", "in", "(inactive,superseded,archived,rejected)")
        .order("created_at", { ascending: false })
        .limit(50)
        .returns<ImportBatchOption[]>()
    ]);

  return {
    accountStructures: accountStructuresResult.data ?? [],
    importBatches: batchesResult.data ?? [],
    importTypes: importTypesResult.data ?? [],
    sourceFiles: sourceFilesResult.data ?? []
  };
}

async function safelyInspectSourceFile({
  adminClient,
  organizationId,
  sourceFileId
}: {
  adminClient: ReturnType<typeof createAdminClient>;
  organizationId: string;
  sourceFileId: string;
}) {
  try {
    return {
      error: null,
      preview: await inspectSourceFileForTemplate({
        adminClient,
        organizationId,
        sourceFileId
      })
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown inspection error.",
      preview: null
    };
  }
}

async function loadLatestTrialBalancePreview({
  adminClient,
  importBatchId,
  organizationId
}: {
  adminClient: ReturnType<typeof createAdminClient>;
  importBatchId: string;
  organizationId: string;
}) {
  const result = await adminClient
    .from("import_preview_runs")
    .select(
      "preview_run_id, preview_status, row_count, previewed_row_count, rows_with_preview_issues, total_beginning_balance, total_debits, total_credits, total_net_change, total_ending_balance, created_at"
    )
    .eq("organization_id", organizationId)
    .eq("import_batch_id", importBatchId)
    .eq("preview_status", "completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<PreviewRunRow>();

  return result.data ?? null;
}

async function loadLatestValidation({
  adminClient,
  importBatchId,
  organizationId
}: {
  adminClient: ReturnType<typeof createAdminClient>;
  importBatchId: string;
  organizationId: string;
}) {
  const result = await adminClient
    .from("validation_runs")
    .select(
      "validation_run_id, status, eligible_to_post, warnings_acknowledged, critical_error_count, warning_count, information_count, rows_detected, rows_validated, rows_rejected, created_at"
    )
    .eq("organization_id", organizationId)
    .eq("import_batch_id", importBatchId)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<ValidationRunRow>();

  return result.data ?? null;
}

async function loadLatestMappingRun({
  adminClient,
  importBatchId,
  organizationId
}: {
  adminClient: ReturnType<typeof createAdminClient>;
  importBatchId: string;
  organizationId: string;
}) {
  const result = await adminClient
    .from("mapping_import_runs")
    .select(
      "mapping_import_run_id, run_status, row_count, rows_accepted, rows_rejected, rows_with_warnings, new_mappings, changed_mappings, unchanged_mappings, duplicate_rows, conflicting_rows, mapping_version_id, committed_at, created_at"
    )
    .eq("organization_id", organizationId)
    .eq("import_batch_id", importBatchId)
    .in("run_status", ["previewed", "committed"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<MappingRunRow>();

  return result.data ?? null;
}

function getRelatedRecord<T>(value: Related<T> | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
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
