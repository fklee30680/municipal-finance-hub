import Link from "next/link";

import { uploadSourceFile } from "@/app/imports/actions";
import { createImportTemplate } from "@/app/imports/templates/actions";
import { AppShell } from "@/components/app-shell";
import { ImportStepCard, InfoItem } from "@/components/import-workspace-panels";
import { TemplateBuilderForm } from "@/components/template-builder-form";
import { PostValidatedTrialBalanceAction } from "@/components/trial-balance-posting-actions";
import { RequestReplacementAction } from "@/components/trial-balance-posting-actions";
import { TrialBalancePreviewAction } from "@/components/trial-balance-preview-action";
import { TrialBalanceUploadForm } from "@/components/trial-balance-upload-form";
import {
  AcknowledgeValidationWarningsAction,
  RunTrialBalanceValidationAction
} from "@/components/trial-balance-validation-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ensureAppUserForAuthUser } from "@/lib/auth/app-user";
import { requireUser } from "@/lib/auth/session";
import {
  getNextImportWorkflowAction,
  type ImportWorkflowSnapshot
} from "@/lib/imports/workflow-state";
import { createAdminClient } from "@/lib/supabase/admin";
import { inspectSourceFileForTemplate } from "@/lib/templates/file-inspection";

type Related<T> = T | T[] | null;

type FiscalPeriodOption = {
  activeImportBatchId: string | null;
  activePostedCount: number;
  close_status: string;
  end_date: string;
  fiscal_period_id: string;
  fiscal_year: number;
  fiscal_year_id: string;
  importStatus: "available" | "in_progress" | "posted";
  importStatusLabel: string;
  inProgressImportBatchId: string | null;
  inProgressImportCount: number;
  period: number;
  period_name: string;
  start_date: string;
};

type ImportTypeOption = {
  import_type_code: string;
  import_type_id: string;
  import_type_name: string;
};

type AccountStructureOption = {
  account_structure_id: string;
  structure_name: string;
  version_number: number;
};

type SourceFileOption = {
  byte_size?: number | null;
  source_file_id: string;
  original_file_name: string;
  uploaded_at: string;
};

type TrialBalanceLayout = {
  account_structure_id: string | null;
  account_structures: Related<{
    structure_name: string;
    version_number: number;
  }>;
  created_at: string;
  header_row_default: number | null;
  import_template_id: string;
  import_templates: Related<{
    template_name: string;
  }>;
  template_version_id: string;
  version_number: number;
};

type TrialBalanceBatch = {
  batch_status: string;
  created_at: string;
  fiscal_year: number | null;
  import_batch_id: string;
  is_active_for_reporting: boolean;
  period: number | null;
  rows_accepted: number;
  rows_processed: number;
  rows_rejected: number;
  template_version_id: string | null;
  warning_count: number;
  import_template_versions: Related<{
    account_structure_id: string | null;
    version_number: number;
    account_structures: Related<{
      structure_name: string;
    }>;
    import_templates: Related<{
      template_name: string;
    }>;
  }>;
  source_files: Related<{
    byte_size: number | null;
    original_file_name: string;
    source_file_id: string;
    uploaded_at: string;
  }>;
};

type PreviewRunRow = {
  created_at: string;
  preview_status: string;
  row_count: number;
  rows_with_preview_issues: number;
  total_beginning_balance: number | string;
  total_credits: number | string;
  total_debits: number | string;
  total_ending_balance: number | string;
  total_net_change: number | string;
  previewed_row_count: number;
};

type ValidationRunRow = {
  critical_error_count: number;
  eligible_to_post: boolean;
  information_count: number;
  rows_detected: number;
  rows_rejected: number;
  rows_validated: number;
  status: string;
  validation_run_id: string;
  warning_count: number;
  warnings_acknowledged: boolean;
};

export default async function TrialBalanceImportPage({
  searchParams
}: {
  searchParams: Promise<{
    changeLayout?: string;
    importBatchId?: string;
    sourceFileId?: string;
  }>;
}) {
  const params = await searchParams;
  const authUser = await requireUser();
  const adminClient = createAdminClient();
  const appUser = await ensureAppUserForAuthUser(adminClient, authUser);
  const data = await loadTrialBalanceData({
    adminClient,
    organizationId: appUser.organization_id
  });
  const trialBalanceImportType = data.importType;
  const selectedBatch =
    (params.importBatchId
      ? data.recentBatches.find(
          (batch) => batch.import_batch_id === params.importBatchId
        )
      : null) ?? null;
  const selectedSourceFile =
    getRelatedRecord(selectedBatch?.source_files) ??
    (params.sourceFileId
      ? data.sourceFiles.find(
          (sourceFile) => sourceFile.source_file_id === params.sourceFileId
        )
      : null) ??
    null;
  const defaultLayoutTemplate = getRelatedRecord(data.defaultLayout?.import_templates);
  const defaultLayoutAccountStructure = getRelatedRecord(
    data.defaultLayout?.account_structures
  );
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
  const activeConflict = selectedBatch
    ? await loadActivePeriodConflict({
        adminClient,
        excludeImportBatchId: selectedBatch.import_batch_id,
        fiscalYear: selectedBatch.fiscal_year,
        organizationId: appUser.organization_id,
        period: selectedBatch.period
      })
    : null;
  const templateBuilderPreview = selectedSourceFile
    ? await safelyInspectSourceFile({
        adminClient,
        organizationId: appUser.organization_id,
        sourceFileId: selectedSourceFile.source_file_id
      })
    : null;
  const workflowSnapshot: ImportWorkflowSnapshot = {
    activeConflict: Boolean(activeConflict),
    batchStatus: selectedBatch?.batch_status,
    criticalErrorCount: latestValidation?.critical_error_count,
    eligibleToPost: latestValidation?.eligible_to_post,
    hasSourceFile: Boolean(selectedSourceFile),
    hasTemplateVersion: Boolean(selectedBatch?.template_version_id),
    importTypeCode: "trial_balance",
    latestPreviewStatus: latestPreview?.preview_status,
    latestValidationStatus: latestValidation?.status,
    warningCount: latestValidation?.warning_count,
    warningsAcknowledged: latestValidation?.warnings_acknowledged
  };
  const nextAction = getNextImportWorkflowAction(workflowSnapshot);
  const defaultPeriod = getDefaultTrialBalancePeriod(data.periods);
  const showLayoutSetup =
    params.changeLayout === "true" || !data.defaultLayout || Boolean(
      selectedSourceFile && !selectedBatch?.template_version_id
    );
  const canPreview = Boolean(selectedBatch?.template_version_id);
  const canValidate = Boolean(latestPreview);
  const canPost =
    Boolean(latestValidation?.eligible_to_post) &&
    latestValidation?.critical_error_count === 0 &&
    (!latestValidation.warning_count || latestValidation.warnings_acknowledged) &&
    !activeConflict;
  const canRequestReplacement =
    Boolean(activeConflict) &&
    latestValidation?.status === "completed" &&
    latestValidation.critical_error_count === 1 &&
    latestValidation.eligible_to_post === false &&
    (!latestValidation.warning_count || latestValidation.warnings_acknowledged);

  return (
    <AppShell>
      <section className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-primary">Imports</p>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Trial Balance Import
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              Use this workflow to load monthly or historical trial balances.
              The app reuses the saved trial balance layout unless the file
              format changes.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              className="inline-flex items-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
              href="/imports"
            >
              Import History
            </Link>
            <Link
              className="inline-flex items-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
              href="/imports/new?importTypeCode=trial_balance"
            >
              Advanced Workspace
            </Link>
          </div>
        </div>

        <Card className="border-primary/40 bg-primary/5">
          <CardHeader>
            <CardTitle>Next action</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-base font-semibold text-foreground">
              {nextAction.label}
            </p>
            <p className="text-sm leading-6 text-muted-foreground">
              {nextAction.description}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Current trial balance setup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.defaultLayout ? (
              <>
                <div className="grid gap-4 text-sm md:grid-cols-4">
                  <InfoItem
                    label="Saved layout"
                    value={`${defaultLayoutTemplate?.template_name ?? "Trial Balance Layout"} v${data.defaultLayout.version_number}`}
                  />
                  <InfoItem
                    label="Account structure"
                    value={
                      defaultLayoutAccountStructure
                        ? `${defaultLayoutAccountStructure.structure_name} v${defaultLayoutAccountStructure.version_number}`
                        : "Not set"
                    }
                  />
                  <InfoItem
                    label="Header row"
                    value={data.defaultLayout.header_row_default ?? "Template default"}
                  />
                  <InfoItem
                    label="Last template update"
                    value={formatDateTime(data.defaultLayout.created_at)}
                  />
                </div>
                <Link
                  className="inline-flex items-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
                  href={buildTrialBalanceHref({
                    changeLayout: true,
                    importBatchId: selectedBatch?.import_batch_id,
                    sourceFileId: selectedSourceFile?.source_file_id
                  })}
                >
                  Change Layout
                </Link>
              </>
            ) : (
              <div className="space-y-3">
                <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-950">
                  No saved trial balance layout exists yet. Upload a sample
                  trial balance file, then set up the layout once. Future trial
                  balance imports can reuse it.
                </p>
                <Link
                  className="text-sm font-medium text-primary hover:underline"
                  href="/imports/templates"
                >
                  View template history
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        <ImportStepCard
          description="Choose a configured fiscal period and upload the source file. The import type is fixed to trial balance."
          step={1}
          title="Select Period and Upload"
        >
          {data.periods.length === 0 ? (
            <div className="space-y-3">
              <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
                Fiscal periods must be configured before importing trial
                balances.
              </p>
              <Link
                className="text-sm font-medium text-primary hover:underline"
                href="/setup/fiscal-years"
              >
                Open Fiscal Year Setup
              </Link>
            </div>
          ) : trialBalanceImportType ? (
            <TrialBalanceUploadForm
              accountStructureId={data.defaultLayout?.account_structure_id}
              action={uploadSourceFile}
              defaultFiscalPeriodId={defaultPeriod?.fiscal_period_id}
              importTypeId={trialBalanceImportType.import_type_id}
              periods={data.periods.map((period) => ({
                fiscalPeriodId: period.fiscal_period_id,
                fiscalYear: period.fiscal_year,
                fiscalYearId: period.fiscal_year_id,
                importStatus: period.importStatus,
                importStatusLabel: period.importStatusLabel,
                label: formatPeriodLabel(period),
                period: period.period
              }))}
              templateVersionId={data.defaultLayout?.template_version_id}
            />
          ) : (
            <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
              Trial balance import type is not configured for this organization.
            </p>
          )}
        </ImportStepCard>

        <ImportStepCard
          description="The saved layout is reused for recurring imports. Use Change Layout only for the first import or when the file format changes."
          step={2}
          title="Layout"
        >
          {showLayoutSetup ? (
            selectedSourceFile && trialBalanceImportType ? (
              <div className="space-y-4">
                <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm leading-6 text-muted-foreground">
                  This setup is locked to Trial Balance. Saving creates a new
                  active trial balance template version. The newest active
                  version becomes the saved layout for future uploads.
                </p>
                <TemplateBuilderForm
                  accountStructures={data.accountStructures}
                  action={createImportTemplate}
                  defaultImportTypeId={trialBalanceImportType.import_type_id}
                  defaultTemplateName="Default Trial Balance Layout"
                  hideImportTypeSelector
                  importTypes={[trialBalanceImportType]}
                  mode="create"
                  preview={templateBuilderPreview?.preview ?? null}
                  sourceFiles={data.sourceFiles}
                />
                {templateBuilderPreview?.error ? (
                  <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
                    File layout could not be inspected: {templateBuilderPreview.error}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Upload a trial balance file before setting up the first layout.
              </p>
            )
          ) : data.defaultLayout ? (
            <div className="grid gap-4 text-sm md:grid-cols-3">
              <InfoItem
                label="Using saved layout"
                value={`${defaultLayoutTemplate?.template_name ?? "Trial Balance Layout"} v${data.defaultLayout.version_number}`}
              />
              <InfoItem
                label="Account structure"
                value={defaultLayoutAccountStructure?.structure_name}
              />
              <InfoItem
                label="Ready to preview"
                value={selectedBatch?.template_version_id ? "Yes" : "Upload a file first"}
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No saved layout exists yet. Upload a file and complete setup here.
            </p>
          )}
        </ImportStepCard>

        <ImportStepCard
          description="Preview reads the source file through the saved layout. It does not validate or post data."
          step={3}
          title="Preview"
        >
          {selectedBatch ? (
            <div className="space-y-4">
              <TrialBalancePreviewAction
                disabled={!canPreview}
                importBatchId={selectedBatch.import_batch_id}
              />
              {!canPreview ? (
                <p className="text-sm text-muted-foreground">
                  Save or apply a trial balance layout before previewing.
                </p>
              ) : null}
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
          ) : (
            <p className="text-sm text-muted-foreground">
              Upload or continue a trial balance import before previewing.
            </p>
          )}
        </ImportStepCard>

        <ImportStepCard
          description="Validation checks fiscal setup, required mapped fields, numbers, account structure, formulas, and reference mappings before posting."
          step={4}
          title="Validate"
        >
          {selectedBatch ? (
            <div className="space-y-4">
              <RunTrialBalanceValidationAction
                disabled={!canValidate}
                importBatchId={selectedBatch.import_batch_id}
              />
              {!canValidate ? (
                <p className="text-sm text-muted-foreground">
                  Generate preview before validation.
                </p>
              ) : null}
              {latestValidation ? (
                <>
                  <div className="grid gap-4 text-sm md:grid-cols-4">
                    <InfoItem label="Rows detected" value={latestValidation.rows_detected} />
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
          ) : (
            <p className="text-sm text-muted-foreground">
              Upload or continue a trial balance import before validation.
            </p>
          )}
        </ImportStepCard>

        <ImportStepCard
          description="Posting remains governed. Existing active period data must go through the replacement request workflow."
          step={5}
          title="Post / Replace"
        >
          {selectedBatch ? (
            <div className="space-y-4">
              {activeConflict ? (
                <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                  Active posted trial balance data already exists for FY{" "}
                  {selectedBatch.fiscal_year}, Period {selectedBatch.period}.
                  Use replacement if this import should supersede it.
                </div>
              ) : null}
              {activeConflict ? (
                <RequestReplacementAction
                  disabled={!canRequestReplacement}
                  importBatchId={selectedBatch.import_batch_id}
                />
              ) : (
                <PostValidatedTrialBalanceAction
                  disabled={!canPost}
                  importBatchId={selectedBatch.import_batch_id}
                />
              )}
              <div className="flex flex-wrap gap-3 text-sm">
                <Link
                  className="font-medium text-primary hover:underline"
                  href={`/imports/${selectedBatch.import_batch_id}/review`}
                >
                  Review import details
                </Link>
                <Link
                  className="font-medium text-primary hover:underline"
                  href={`/imports/${selectedBatch.import_batch_id}/preview`}
                >
                  Full preview
                </Link>
                <Link
                  className="font-medium text-primary hover:underline"
                  href={`/imports/${selectedBatch.import_batch_id}/validation`}
                >
                  Full validation
                </Link>
                <Link
                  className="font-medium text-primary hover:underline"
                  href={`/imports/${selectedBatch.import_batch_id}/post`}
                >
                  Posting and replacement page
                </Link>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Posting actions appear after upload, preview, and validation.
            </p>
          )}
        </ImportStepCard>

        <Card>
          <CardHeader>
            <CardTitle>Recent trial balance imports</CardTitle>
          </CardHeader>
          <CardContent>
            {data.recentBatches.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No trial balance imports are available yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1000px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="py-3 pr-4 font-medium">Fiscal Year</th>
                      <th className="py-3 pr-4 font-medium">Period</th>
                      <th className="py-3 pr-4 font-medium">File</th>
                      <th className="py-3 pr-4 font-medium">Status</th>
                      <th className="py-3 pr-4 font-medium">Uploaded At</th>
                      <th className="py-3 pr-4 font-medium">Rows</th>
                      <th className="py-3 font-medium">Continue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentBatches.map((batch) => {
                      const sourceFile = getRelatedRecord(batch.source_files);
                      return (
                        <tr
                          className="border-b border-border align-top"
                          key={batch.import_batch_id}
                        >
                          <td className="py-3 pr-4 text-muted-foreground">
                            {batch.fiscal_year ?? "Not set"}
                          </td>
                          <td className="py-3 pr-4 text-muted-foreground">
                            {batch.period ?? "Not set"}
                          </td>
                          <td className="py-3 pr-4 font-medium text-foreground">
                            {sourceFile?.original_file_name ?? "Unknown file"}
                          </td>
                          <td className="py-3 pr-4 text-muted-foreground">
                            {batch.batch_status}
                          </td>
                          <td className="py-3 pr-4 text-muted-foreground">
                            {formatDateTime(batch.created_at)}
                          </td>
                          <td className="py-3 pr-4 text-muted-foreground">
                            {batch.rows_processed || batch.rows_accepted || 0}
                          </td>
                          <td className="py-3">
                            <Link
                              className="text-sm font-medium text-primary hover:underline"
                              href={`/imports/trial-balance?importBatchId=${batch.import_batch_id}&sourceFileId=${sourceFile?.source_file_id ?? ""}`}
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Configured period status</CardTitle>
          </CardHeader>
          <CardContent>
            {data.periods.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Configure fiscal years and periods before importing.
              </p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {data.periods.slice(0, 12).map((period) => (
                  <div
                    className="rounded-md border border-border bg-card px-3 py-2 text-sm"
                    key={period.fiscal_period_id}
                  >
                    <p className="font-medium text-foreground">
                      FY {period.fiscal_year} Period {period.period}
                    </p>
                    <p className="text-muted-foreground">{period.period_name}</p>
                    <p className="text-muted-foreground">
                      {period.importStatusLabel} - {period.close_status}
                    </p>
                    {period.inProgressImportCount > 0 ? (
                      <p className="text-xs text-muted-foreground">
                        {period.inProgressImportCount} import
                        {period.inProgressImportCount === 1 ? "" : "s"} in progress
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}

async function loadTrialBalanceData({
  adminClient,
  organizationId
}: {
  adminClient: ReturnType<typeof createAdminClient>;
  organizationId: string;
}) {
  const importTypeResult = await adminClient
    .from("import_types")
    .select("import_type_id, import_type_code, import_type_name")
    .eq("organization_id", organizationId)
    .eq("import_type_code", "trial_balance")
    .eq("active_status", "active")
    .maybeSingle<ImportTypeOption>();
  const importType = importTypeResult.data ?? null;

  const [
    periodsResult,
    periodBatchesResult,
    accountStructuresResult,
    recentBatchesResult,
    defaultLayoutResult
  ] = await Promise.all([
    adminClient
      .from("fiscal_periods")
      .select(
        "fiscal_period_id, fiscal_year_id, fiscal_year, period, period_name, start_date, end_date, close_status, active_status"
      )
      .eq("organization_id", organizationId)
      .eq("active_status", "active")
      .order("fiscal_year", { ascending: false })
      .order("period", { ascending: false })
      .returns<
        Array<{
          active_status: string;
          close_status: string;
          end_date: string;
          fiscal_period_id: string;
          fiscal_year: number;
          fiscal_year_id: string;
          period: number;
          period_name: string;
          start_date: string;
        }>
      >(),
    adminClient
      .from("import_batches")
      .select("import_batch_id, fiscal_year, period, batch_status, is_active_for_reporting, reporting_status")
      .eq("organization_id", organizationId)
      .eq("import_type_id", importType?.import_type_id ?? "00000000-0000-0000-0000-000000000000")
      .not("batch_status", "in", "(inactive,superseded,archived,rejected)")
      .returns<
        Array<{
          batch_status: string;
          fiscal_year: number | null;
          import_batch_id: string;
          is_active_for_reporting: boolean;
          period: number | null;
          reporting_status: string | null;
        }>
      >(),
    adminClient
      .from("account_structures")
      .select("account_structure_id, structure_name, version_number")
      .eq("organization_id", organizationId)
      .eq("active_status", "active")
      .order("structure_name", { ascending: true })
      .returns<AccountStructureOption[]>(),
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
        rows_processed,
        rows_accepted,
        rows_rejected,
        is_active_for_reporting,
        created_at,
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
      .eq("import_type_id", importType?.import_type_id ?? "00000000-0000-0000-0000-000000000000")
      .neq("active_status", "inactive")
      .not("batch_status", "in", "(inactive,superseded,archived,rejected)")
      .order("created_at", { ascending: false })
      .limit(25)
      .returns<TrialBalanceBatch[]>(),
    importType
      ? adminClient
          .from("import_template_versions")
          .select(
            `
            template_version_id,
            import_template_id,
            version_number,
            account_structure_id,
            header_row_default,
            created_at,
            import_templates!inner (
              template_name,
              import_type_id
            ),
            account_structures (
              structure_name,
              version_number
            )
          `
          )
          .eq("organization_id", organizationId)
          .eq("version_status", "active")
          .eq("import_templates.import_type_id", importType.import_type_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle<TrialBalanceLayout>()
      : Promise.resolve({ data: null })
  ]);

  const statusByPeriod = new Map<
    string,
    {
      activeImportBatchId: string | null;
      inProgressImportBatchId: string | null;
      inProgressImportCount: number;
      importStatus: FiscalPeriodOption["importStatus"];
    }
  >();
  for (const batch of periodBatchesResult.data ?? []) {
    if (batch.fiscal_year !== null && batch.period !== null) {
      const key = `${batch.fiscal_year}:${batch.period}`;
      const current = statusByPeriod.get(key) ?? {
        activeImportBatchId: null,
        importStatus: "available" as const,
        inProgressImportBatchId: null,
        inProgressImportCount: 0
      };

      if (
        batch.is_active_for_reporting &&
        batch.reporting_status === "included" &&
        ["posted", "posted_with_exceptions"].includes(batch.batch_status)
      ) {
        current.activeImportBatchId = batch.import_batch_id;
        current.importStatus = "posted";
      } else if (current.importStatus !== "posted") {
        current.inProgressImportBatchId ??= batch.import_batch_id;
        current.inProgressImportCount += 1;
        current.importStatus = "in_progress";
      }

      statusByPeriod.set(key, current);
    }
  }

  const recentBatches = recentBatchesResult.data ?? [];
  const sourceFilesById = new Map<string, SourceFileOption>();
  for (const batch of recentBatches) {
    const sourceFile = getRelatedRecord(batch.source_files);
    if (sourceFile?.source_file_id) {
      sourceFilesById.set(sourceFile.source_file_id, sourceFile);
    }
  }
  const sourceFiles = Array.from(sourceFilesById.values());

  return {
    accountStructures: accountStructuresResult.data ?? [],
    defaultLayout: defaultLayoutResult.data ?? null,
    importType,
    periods: (periodsResult.data ?? []).map((period) => {
      const status = statusByPeriod.get(`${period.fiscal_year}:${period.period}`) ?? {
        activeImportBatchId: null,
        importStatus: "available" as const,
        inProgressImportBatchId: null,
        inProgressImportCount: 0
      };

      return {
        ...period,
        activeImportBatchId: status.activeImportBatchId,
        activePostedCount: status.activeImportBatchId ? 1 : 0,
        importStatus: status.importStatus,
        importStatusLabel: getPeriodImportStatusLabel(status.importStatus),
        inProgressImportBatchId: status.inProgressImportBatchId,
        inProgressImportCount: status.inProgressImportCount
      };
    }) satisfies FiscalPeriodOption[],
    recentBatches,
    sourceFiles
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
      "preview_status, row_count, previewed_row_count, rows_with_preview_issues, total_beginning_balance, total_debits, total_credits, total_net_change, total_ending_balance, created_at"
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
      "validation_run_id, status, eligible_to_post, warnings_acknowledged, critical_error_count, warning_count, information_count, rows_detected, rows_validated, rows_rejected"
    )
    .eq("organization_id", organizationId)
    .eq("import_batch_id", importBatchId)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<ValidationRunRow>();

  return result.data ?? null;
}

async function loadActivePeriodConflict({
  adminClient,
  excludeImportBatchId,
  fiscalYear,
  organizationId,
  period
}: {
  adminClient: ReturnType<typeof createAdminClient>;
  excludeImportBatchId: string;
  fiscalYear: number | null;
  organizationId: string;
  period: number | null;
}) {
  if (fiscalYear === null || period === null) {
    return null;
  }

  const result = await adminClient
    .from("import_batches")
    .select("import_batch_id")
    .eq("organization_id", organizationId)
    .eq("fiscal_year", fiscalYear)
    .eq("period", period)
    .eq("is_active_for_reporting", true)
    .eq("reporting_status", "included")
    .in("batch_status", ["posted", "posted_with_exceptions"])
    .neq("import_batch_id", excludeImportBatchId)
    .limit(1)
    .maybeSingle<{ import_batch_id: string }>();

  return result.data ?? null;
}

function getRelatedRecord<T>(value: Related<T> | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function buildTrialBalanceHref({
  changeLayout,
  importBatchId,
  sourceFileId
}: {
  changeLayout?: boolean;
  importBatchId?: string;
  sourceFileId?: string;
}) {
  const params = new URLSearchParams();
  if (changeLayout) params.set("changeLayout", "true");
  if (importBatchId) params.set("importBatchId", importBatchId);
  if (sourceFileId) params.set("sourceFileId", sourceFileId);
  const query = params.toString();
  return query ? `/imports/trial-balance?${query}` : "/imports/trial-balance";
}

function formatPeriodLabel(period: FiscalPeriodOption) {
  return `FY ${period.fiscal_year} - Period ${period.period} - ${period.period_name} - ${period.importStatusLabel} (${formatDate(period.start_date)} to ${formatDate(period.end_date)})`;
}

function getDefaultTrialBalancePeriod(periods: FiscalPeriodOption[]) {
  const chronologicalPeriods = [...periods].sort(
    (left, right) =>
      left.fiscal_year - right.fiscal_year ||
      left.period - right.period
  );

  return (
    chronologicalPeriods.find(
      (period) =>
        period.close_status === "open" &&
        period.importStatus === "available" &&
        period.period >= 0
    ) ??
    chronologicalPeriods.find(
      (period) =>
        period.importStatus === "available" &&
        period.period >= 0
    ) ??
    chronologicalPeriods.find((period) => period.close_status === "open") ??
    chronologicalPeriods[0] ??
    null
  );
}

function getPeriodImportStatusLabel(status: FiscalPeriodOption["importStatus"]) {
  if (status === "posted") return "Posted";
  if (status === "in_progress") return "In Progress";
  return "Available";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(`${value}T00:00:00`));
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
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
