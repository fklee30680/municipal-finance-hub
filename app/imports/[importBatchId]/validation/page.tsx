import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import {
  AcknowledgeValidationWarningsAction,
  RunTrialBalanceValidationAction
} from "@/components/trial-balance-validation-actions";
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
  previewed_row_count: number;
  created_at: string;
};

type ValidationRunRow = {
  validation_run_id: string;
  preview_run_id: string;
  status: string;
  eligible_to_post: boolean;
  warnings_acknowledged: boolean;
  critical_error_count: number;
  warning_count: number;
  information_count: number;
  rows_detected: number;
  rows_validated: number;
  rows_rejected: number;
  validated_at: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

type ValidationExceptionRow = {
  import_exception_id: string;
  severity: string;
  exception_code: string;
  row_number: number | null;
  source_column_name: string | null;
  target_field_name: string | null;
  raw_value: string | null;
  transformed_value: string | null;
  exception_message: string;
  suggested_fix: string | null;
  resolution_status: string | null;
  exception_status: string;
};

type ValidationExceptionSummaryRow = {
  severity: string;
  exception_code: string;
  exception_message: string;
  target_field_name: string | null;
  raw_value: string | null;
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

export default async function TrialBalanceValidationPage({
  params,
  searchParams
}: {
  params: Promise<{ importBatchId: string }>;
  searchParams: Promise<{
    code?: string;
    resolutionStatus?: string;
    row?: string;
    severity?: string;
  }>;
}) {
  const { importBatchId } = await params;
  const filters = await searchParams;
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

  const latestPreviewResult = await adminClient
    .from("import_preview_runs")
    .select("preview_run_id, preview_status, previewed_row_count, created_at")
    .eq("organization_id", appUser.organization_id)
    .eq("import_batch_id", importBatchId)
    .eq("preview_status", "completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<PreviewRunRow>();
  const latestPreview = latestPreviewResult.data ?? null;

  const latestValidationResult = await adminClient
    .from("validation_runs")
    .select(
      "validation_run_id, preview_run_id, status, eligible_to_post, warnings_acknowledged, critical_error_count, warning_count, information_count, rows_detected, rows_validated, rows_rejected, validated_at, created_at, metadata"
    )
    .eq("organization_id", appUser.organization_id)
    .eq("import_batch_id", importBatchId)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<ValidationRunRow>();
  const latestValidation = latestValidationResult.data ?? null;

  let exceptionQuery = adminClient
    .from("import_exceptions")
    .select(
      "import_exception_id, severity, exception_code, row_number, source_column_name, target_field_name, raw_value, transformed_value, exception_message, suggested_fix, resolution_status, exception_status"
    )
    .eq("organization_id", appUser.organization_id)
    .eq("import_batch_id", importBatchId)
    .order("severity", { ascending: true })
    .order("row_number", { ascending: true })
    .limit(200);

  if (latestValidation) {
    exceptionQuery = exceptionQuery.eq(
      "validation_run_id",
      latestValidation.validation_run_id
    );
  } else {
    exceptionQuery = exceptionQuery.eq("validation_run_id", "00000000-0000-0000-0000-000000000000");
  }

  if (filters.severity) {
    exceptionQuery = exceptionQuery.eq("severity", filters.severity);
  }

  if (filters.code) {
    exceptionQuery = exceptionQuery.ilike("exception_code", `%${filters.code}%`);
  }

  if (filters.resolutionStatus) {
    exceptionQuery = exceptionQuery.eq("resolution_status", filters.resolutionStatus);
  }

  const rowFilter = Number.parseInt(filters.row ?? "", 10);
  if (!Number.isNaN(rowFilter)) {
    exceptionQuery = exceptionQuery.eq("row_number", rowFilter);
  }

  const exceptionSummaryQuery = latestValidation
    ? adminClient
        .from("import_exceptions")
        .select("severity, exception_code, exception_message, target_field_name, raw_value")
        .eq("organization_id", appUser.organization_id)
        .eq("import_batch_id", importBatchId)
        .eq("validation_run_id", latestValidation.validation_run_id)
        .limit(5000)
        .returns<ValidationExceptionSummaryRow[]>()
    : null;

  const [
    exceptionsResult,
    exceptionSummaryResult,
    mappingVersionsResult,
    acknowledgementsResult,
    canAcknowledge
  ] =
    await Promise.all([
      exceptionQuery.returns<ValidationExceptionRow[]>(),
      exceptionSummaryQuery,
      latestValidation
        ? adminClient
            .from("validation_run_mapping_versions")
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
            .eq("validation_run_id", latestValidation.validation_run_id)
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
        : null,
      userCanAcknowledgeWarnings({
        adminClient,
        organizationId: appUser.organization_id,
        userId: appUser.user_id
      })
    ]);

  const batch = batchResult.data;
  const importType = getRelatedRecord(batch.import_types);
  const sourceFile = getRelatedRecord(batch.source_files);
  const templateVersion = getRelatedRecord(batch.import_template_versions);
  const template = getRelatedRecord(templateVersion?.import_templates);
  const accountStructure = getRelatedRecord(templateVersion?.account_structures);
  const isTrialBalance = importType?.import_type_code === "trial_balance";
  const canValidate =
    isTrialBalance &&
    Boolean(latestPreview) &&
    Boolean(batch.template_version_id) &&
    Boolean(templateVersion?.account_structure_id ?? batch.account_structure_id);
  const setupMessage = getSetupMessage({
    accountStructureId:
      templateVersion?.account_structure_id ?? batch.account_structure_id,
    isTrialBalance,
    previewRunId: latestPreview?.preview_run_id ?? null,
    templateVersionId: batch.template_version_id
  });
  const exceptions = exceptionsResult.data ?? [];
  const exceptionSummaryRows = exceptionSummaryResult?.data ?? [];
  const rootCauseSummaries = buildRootCauseSummaries(exceptionSummaryRows);
  const trialBalanceIntegritySummary =
    buildTrialBalanceIntegritySummary(exceptionSummaryRows);
  const mappingVersionLinks = mappingVersionsResult?.data ?? [];
  const acknowledgements = acknowledgementsResult?.data ?? [];
  const warningAcknowledgementAllowed = Boolean(
    latestValidation &&
      latestValidation.warning_count > 0 &&
      latestValidation.critical_error_count === 0 &&
      !latestValidation.warnings_acknowledged &&
      canAcknowledge
  );

  return (
    <AppShell>
      <section className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-primary">Imports</p>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Trial Balance Validation
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              Validation determines whether this import is eligible for posting.
              This step does not post data or make rows active for dashboards
              or reports.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              className="inline-flex items-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
              href={`/imports/${batch.import_batch_id}/post`}
            >
              Post / Replace
            </Link>
            <Link
              className="inline-flex items-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
              href={`/imports/${batch.import_batch_id}/preview`}
            >
              Back to Preview
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
            <CardTitle>Validation context</CardTitle>
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
            <InfoItem
              label="Preview run"
              value={latestPreview?.preview_run_id ?? "Not generated"}
            />
            <InfoItem
              label="Validation run"
              value={latestValidation?.validation_run_id ?? "Not run"}
            />
            <InfoItem label="Validation status" value={latestValidation?.status ?? "Not run"} />
            <InfoItem
              label="Posting eligibility"
              value={
                latestValidation
                  ? latestValidation.eligible_to_post
                    ? "Eligible for Slice 8 posting"
                    : "Not eligible"
                  : "Not evaluated"
              }
            />
            <InfoItem label="Import batch status" value={batch.batch_status} />
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
          </CardContent>
        </Card>

        <Card className="border-border bg-muted">
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-foreground">
              Validation only. Critical errors block posting eligibility.
              Warnings may be acknowledged only where allowed. Fix source data
              in the original file and reupload; the MVP does not allow editing
              source row values inside the app.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Run validation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {setupMessage ? (
              <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
                {setupMessage}
              </p>
            ) : null}
            <RunTrialBalanceValidationAction
              disabled={!canValidate}
              importBatchId={batch.import_batch_id}
            />
          </CardContent>
        </Card>

        {latestValidation ? (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Validation summary</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 text-sm md:grid-cols-4">
                <InfoItem label="Rows detected" value={latestValidation.rows_detected} />
                <InfoItem label="Rows validated" value={latestValidation.rows_validated} />
                <InfoItem label="Rows rejected" value={latestValidation.rows_rejected} />
                <InfoItem
                  label="Critical errors"
                  value={latestValidation.critical_error_count}
                />
                <InfoItem label="Warnings" value={latestValidation.warning_count} />
                <InfoItem
                  label="Information messages"
                  value={latestValidation.information_count}
                />
                <InfoItem
                  label="Posting eligibility"
                  value={latestValidation.eligible_to_post ? "Eligible" : "Blocked"}
                />
                <InfoItem
                  label="Period conflict status"
                  value={
                    exceptions.some(
                      (exception) =>
                        exception.exception_code === "period_conflict_active_data_exists"
                    )
                      ? "Conflict detected"
                      : "No active-data conflict detected"
                  }
                />
              </CardContent>
            </Card>

            {getPeriod13Handling(latestValidation.metadata) ? (
              <Card className="border-amber-200 bg-amber-50/70">
                <CardHeader>
                  <CardTitle>Period 13 year-end handling</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="grid gap-4 md:grid-cols-3">
                    <InfoItem
                      label="Trial balance type"
                      value={formatPeriod13Handling(getPeriod13Handling(latestValidation.metadata))}
                    />
                    <InfoItem
                      label="Year-end validation status"
                      value={formatPeriod13CloseStatus(getPeriod13CloseStatus(latestValidation.metadata))}
                    />
                    <InfoItem
                      label="Posting impact"
                      value={getPeriod13PostingImpact(latestValidation)}
                    />
                  </div>
                  <p className="text-muted-foreground">
                    Period 13 remains structurally validated. Pre-closing or unsure
                    files can only proceed with explainable year-end activity, and
                    warnings must be acknowledged before posting.
                  </p>
                  <Period13CloseAnalysisTable metadata={latestValidation.metadata} />
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardHeader>
                <CardTitle>Trial Balance Integrity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {trialBalanceIntegritySummary.checks.map((check) => (
                    <div
                      className="rounded-md border border-border bg-card p-4"
                      key={check.label}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-foreground">{check.label}</p>
                          <p className="mt-1 text-muted-foreground">{check.description}</p>
                        </div>
                        <span
                          className={
                            check.issueCount > 0
                              ? "rounded-md bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive"
                              : "rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary"
                          }
                        >
                          {check.issueCount > 0 ? `${check.issueCount} issue${check.issueCount === 1 ? "" : "s"}` : "Passed"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">
                  {trialBalanceIntegritySummary.issueCount > 0
                    ? "Review the Trial Balance Integrity items in the root-cause summary and exception detail before posting."
                    : "The latest validation run found no batch, fund, or row-level trial balance integrity issues."}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Root Cause Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {exceptionSummaryResult?.error ? (
                  <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
                    Root cause summary could not be loaded:{" "}
                    {exceptionSummaryResult.error.message}
                  </p>
                ) : null}
                {rootCauseSummaries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No root-cause issues were found for the latest validation run.
                  </p>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {rootCauseSummaries.map((summary) => (
                      <div
                        className="rounded-md border border-border bg-card p-4 text-sm"
                        key={summary.group}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-foreground">{summary.label}</p>
                            <p className="mt-1 text-muted-foreground">{summary.message}</p>
                          </div>
                          <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                            {summary.count}
                          </span>
                        </div>
                        <p className="mt-3 text-muted-foreground">
                          {summary.suggestedFix}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                {rootCauseSummaries.some((summary) => summary.group === "fiscal_setup") ? (
                  <Link
                    className="inline-flex items-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
                    href={`/setup/fiscal-years?fiscalYear=${batch.fiscal_year ?? ""}`}
                  >
                    Go to Fiscal Year Setup
                  </Link>
                ) : null}
                {rootCauseSummaries.some((summary) => summary.group === "reference_mapping") ? (
                  <Link
                    className="inline-flex items-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
                    href="/reference-data"
                  >
                    Open Reference Data
                  </Link>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Mapping versions used</CardTitle>
              </CardHeader>
              <CardContent>
                {mappingVersionsResult?.error ? (
                  <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
                    Mapping version links could not be loaded:{" "}
                    {mappingVersionsResult.error.message}
                  </p>
                ) : null}
                {mappingVersionLinks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No mapping versions were recorded for this validation run.
                    If committed mappings exist, rerun validation after the
                    Slice 7 migration is applied.
                  </p>
                ) : (
                  <div className="grid gap-3 text-sm md:grid-cols-2">
                    {mappingVersionLinks.map((link) => {
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
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Warning acknowledgement</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {latestValidation.critical_error_count > 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Critical errors cannot be acknowledged into posting eligibility.
                  </p>
                ) : latestValidation.warning_count === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No warnings need acknowledgement.
                  </p>
                ) : latestValidation.warnings_acknowledged ? (
                  <p className="text-sm text-muted-foreground">
                    Warnings have already been acknowledged for this validation run.
                  </p>
                ) : canAcknowledge ? (
                  <AcknowledgeValidationWarningsAction
                    disabled={!warningAcknowledgementAllowed}
                    importBatchId={batch.import_batch_id}
                    validationRunId={latestValidation.validation_run_id}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Warning acknowledgement requires System Admin, Finance Admin,
                    Approver, or Reviewer role.
                  </p>
                )}

                {acknowledgements.length > 0 ? (
                  <div className="space-y-2">
                    {acknowledgements.map((acknowledgement) => (
                      <p
                        className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground"
                        key={acknowledgement.warning_acknowledgement_id}
                      >
                        {acknowledgement.warning_count_acknowledged} warnings
                        acknowledged on {formatDate(acknowledgement.acknowledged_at)}
                        {acknowledgement.acknowledgement_note
                          ? `: ${acknowledgement.acknowledgement_note}`
                          : "."}
                      </p>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Exception detail</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form className="grid gap-3 text-sm md:grid-cols-4">
              <input
                className="rounded-md border border-input bg-background px-3 py-2"
                defaultValue={filters.severity ?? ""}
                name="severity"
                placeholder="Severity"
              />
              <input
                className="rounded-md border border-input bg-background px-3 py-2"
                defaultValue={filters.code ?? ""}
                name="code"
                placeholder="Exception code"
              />
              <input
                className="rounded-md border border-input bg-background px-3 py-2"
                defaultValue={filters.row ?? ""}
                name="row"
                placeholder="Row number"
              />
              <input
                className="rounded-md border border-input bg-background px-3 py-2"
                defaultValue={filters.resolutionStatus ?? ""}
                name="resolutionStatus"
                placeholder="Resolution status"
              />
              <div className="flex gap-2 md:col-span-4">
                <button
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                  type="submit"
                >
                  Filter
                </button>
                <Link
                  className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
                  href={`/imports/${batch.import_batch_id}/validation`}
                >
                  Clear
                </Link>
                {latestValidation ? (
                  <Link
                    className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
                    href={`/imports/${batch.import_batch_id}/validation/exceptions.csv`}
                  >
                    Export CSV
                  </Link>
                ) : null}
              </div>
            </form>

            {exceptionsResult.error ? (
              <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
                Exceptions could not be loaded. Apply the Slice 7 migration
                before using validation. Details: {exceptionsResult.error.message}
              </p>
            ) : null}

            {!exceptionsResult.error && exceptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No validation exceptions are available for the latest validation run.
              </p>
            ) : null}

            {exceptions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1200px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="py-3 pr-4 font-medium">Severity</th>
                      <th className="py-3 pr-4 font-medium">Root cause</th>
                      <th className="py-3 pr-4 font-medium">Exception code</th>
                      <th className="py-3 pr-4 font-medium">Source row</th>
                      <th className="py-3 pr-4 font-medium">Source column</th>
                      <th className="py-3 pr-4 font-medium">Target field</th>
                      <th className="py-3 pr-4 font-medium">Raw value</th>
                      <th className="py-3 pr-4 font-medium">Transformed value</th>
                      <th className="py-3 pr-4 font-medium">Message</th>
                      <th className="py-3 pr-4 font-medium">Suggested fix</th>
                      <th className="py-3 font-medium">Resolution status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exceptions.map((exception) => (
                      <tr
                        className="border-b border-border align-top"
                        key={exception.import_exception_id}
                      >
                        <td className="py-3 pr-4 text-muted-foreground">{exception.severity}</td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {getRootCauseLabel(
                            exception.exception_code,
                            exception.exception_message
                          )}
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">{exception.exception_code}</td>
                        <td className="py-3 pr-4 text-muted-foreground">{exception.row_number}</td>
                        <td className="py-3 pr-4 text-muted-foreground">{exception.source_column_name}</td>
                        <td className="py-3 pr-4 text-muted-foreground">{exception.target_field_name}</td>
                        <td className="py-3 pr-4 text-muted-foreground">{exception.raw_value}</td>
                        <td className="py-3 pr-4 text-muted-foreground">{exception.transformed_value}</td>
                        <td className="py-3 pr-4 text-muted-foreground">{exception.exception_message}</td>
                        <td className="py-3 pr-4 text-muted-foreground">{exception.suggested_fix}</td>
                        <td className="py-3 text-muted-foreground">
                          {exception.resolution_status ?? exception.exception_status}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-3 text-sm text-muted-foreground">
                  Showing up to 200 validation exceptions for the latest validation run.
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}

async function userCanAcknowledgeWarnings({
  adminClient,
  organizationId,
  userId
}: {
  adminClient: ReturnType<typeof createAdminClient>;
  organizationId: string;
  userId: string;
}) {
  const result = await adminClient
    .from("user_roles")
    .select("roles!inner(role_name)")
    .eq("user_id", userId)
    .eq("active_status", "active")
    .eq("roles.organization_id", organizationId)
    .eq("roles.active_status", "active")
    .returns<Array<{ roles: { role_name: string } | Array<{ role_name: string }> }>>();

  if (result.error) {
    return false;
  }

  const allowedRoles = new Set(["System Admin", "Finance Admin", "Approver", "Reviewer"]);
  return (result.data ?? []).some((row) => {
    const role = Array.isArray(row.roles) ? row.roles[0] : row.roles;
    return role ? allowedRoles.has(role.role_name) : false;
  });
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

function Period13CloseAnalysisTable({
  metadata
}: {
  metadata: Record<string, unknown> | null;
}) {
  const funds = getPeriod13CloseFunds(metadata);

  if (funds.length === 0) {
    return (
      <p className="rounded-md border border-amber-200 bg-background px-3 py-2 text-sm text-muted-foreground">
        No fund-level Period 13 close variance was recorded for this validation run.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-amber-200 bg-background">
      <table className="w-full min-w-[760px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            <th className="px-3 py-2 font-medium">Fund</th>
            <th className="px-3 py-2 font-medium">Ending net</th>
            <th className="px-3 py-2 font-medium">Activity total</th>
            <th className="px-3 py-2 font-medium">Balance sheet total</th>
            <th className="px-3 py-2 font-medium">Classification</th>
            <th className="px-3 py-2 font-medium">Close review</th>
          </tr>
        </thead>
        <tbody>
          {funds.slice(0, 10).map((fund) => (
            <tr className="border-b border-border last:border-0" key={String(fund.fundCode)}>
              <td className="px-3 py-2 text-foreground">
                {String(fund.fundCode)}
                {fund.fundName ? ` - ${String(fund.fundName)}` : ""}
              </td>
              <td className="px-3 py-2 text-muted-foreground">
                {formatMoney(Number(fund.totalEndingBalance ?? 0))}
              </td>
              <td className="px-3 py-2 text-muted-foreground">
                {formatMoney(Number(fund.activityAccountTotal ?? 0))}
              </td>
              <td className="px-3 py-2 text-muted-foreground">
                {formatMoney(Number(fund.balanceSheetAccountTotal ?? 0))}
              </td>
              <td className="px-3 py-2 text-muted-foreground">
                {String(fund.classificationCompletenessStatus ?? "Not available")}
              </td>
              <td className="px-3 py-2 text-muted-foreground">
                {fund.explainableByYearEndActivity
                  ? "Pending close verification"
                  : "Requires correction or review"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {funds.length > 10 ? (
        <p className="px-3 py-2 text-sm text-muted-foreground">
          Showing 10 of {funds.length} Period 13 fund close variance rows.
        </p>
      ) : null}
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
  previewRunId,
  templateVersionId
}: {
  accountStructureId: string | null | undefined;
  isTrialBalance: boolean;
  previewRunId: string | null;
  templateVersionId: string | null;
}) {
  if (!isTrialBalance) {
    return "Validation is only available for trial_balance import batches.";
  }

  if (!templateVersionId) {
    return "Select or create a trial balance template before validation.";
  }

  if (!accountStructureId) {
    return "This trial balance template needs an account structure before validation.";
  }

  if (!previewRunId) {
    return "Generate trial balance preview before validation.";
  }

  return null;
}

function buildRootCauseSummaries(exceptions: ValidationExceptionSummaryRow[]) {
  const groups = new Map<
    string,
    {
      count: number;
      fields: Set<string>;
      rawValues: number;
    }
  >();

  for (const exception of exceptions) {
    const group = getRootCauseGroup(
      exception.exception_code,
      exception.exception_message
    );
    const existing =
      groups.get(group) ??
      {
        count: 0,
        fields: new Set<string>(),
        rawValues: 0
      };

    existing.count += 1;

    if (exception.target_field_name) {
      existing.fields.add(exception.target_field_name);
    }

    if (exception.raw_value?.trim()) {
      existing.rawValues += 1;
    }

    groups.set(group, existing);
  }

  return [...groups.entries()]
    .map(([group, details]) => ({
      count: details.count,
      group,
      label: getRootCauseLabelFromGroup(group),
      message: getRootCauseMessage(group, details),
      suggestedFix: getRootCauseSuggestedFix(group)
    }))
    .sort((left, right) => getRootCauseSortOrder(left.group) - getRootCauseSortOrder(right.group));
}

function getRootCauseGroup(exceptionCode: string, exceptionMessage = "") {
  if (
    exceptionCode === "invalid_fiscal_setup" ||
    exceptionCode === "invalid_fiscal_year" ||
    exceptionCode === "invalid_period"
  ) {
    return "fiscal_setup";
  }

  if (exceptionCode === "invalid_numeric_value") {
    return "numeric_or_preview";
  }

  if (
    exceptionCode === "preview_issue_carried_forward" &&
    exceptionMessage.includes("numeric_parse_failed")
  ) {
    return "numeric_or_preview";
  }

  if (
    exceptionCode === "missing_required_field" ||
    (exceptionCode === "preview_issue_carried_forward" &&
      exceptionMessage.includes("missing_required_mapped_field"))
  ) {
    return "required_fields";
  }

  if (
    exceptionCode === "unparseable_account_number" ||
    exceptionCode === "account_segment_count_mismatch" ||
    exceptionCode === "duplicate_full_account_number"
  ) {
    return "account_parsing";
  }

  if (exceptionCode.startsWith("missing_") && exceptionCode.endsWith("_mapping")) {
    return "reference_mapping";
  }

  if (
    exceptionCode === "balance_formula_failure" ||
    exceptionCode === "net_change_formula_failure" ||
    exceptionCode === "row_formula_mismatch" ||
    exceptionCode === "row_net_change_mismatch" ||
    exceptionCode === "batch_out_of_balance" ||
    exceptionCode === "fund_out_of_balance" ||
    exceptionCode === "batch_debits_credits_out_of_balance" ||
    exceptionCode === "fund_debits_credits_out_of_balance" ||
    exceptionCode === "period_13_pending_close_verification" ||
    exceptionCode === "period_13_review_required" ||
    exceptionCode === "period_13_unexplained_imbalance"
  ) {
    return "trial_balance_integrity";
  }

  if (exceptionCode === "period_conflict_active_data_exists") {
    return "period_conflict";
  }

  return "other";
}

function buildTrialBalanceIntegritySummary(
  exceptionSummaryRows: ValidationExceptionSummaryRow[]
) {
  const countFor = (codes: string[]) =>
    exceptionSummaryRows.filter((row) => codes.includes(row.exception_code)).length;

  const checks = [
    {
      description: "The total ending balance across all preview rows nets to zero within tolerance.",
      issueCount: countFor(["batch_out_of_balance"]),
      label: "Batch ending balance"
    },
    {
      description: "Each fund's ending balances net to zero within tolerance.",
      issueCount: countFor(["fund_out_of_balance"]),
      label: "Fund ending balances"
    },
    {
      description: "Total debits equal total credits using the MVP trial balance convention.",
      issueCount: countFor(["batch_debits_credits_out_of_balance"]),
      label: "Batch debits and credits"
    },
    {
      description: "Each fund's debits equal credits using the MVP trial balance convention.",
      issueCount: countFor(["fund_debits_credits_out_of_balance"]),
      label: "Fund debits and credits"
    },
    {
      description: "Each row's beginning balance plus net change equals ending balance.",
      issueCount: countFor(["row_formula_mismatch", "balance_formula_failure"]),
      label: "Beginning/net/ending formula"
    },
    {
      description: "Each row's debits minus credits equals net change.",
      issueCount: countFor(["row_net_change_mismatch", "net_change_formula_failure"]),
      label: "Debit/credit/net formula"
    },
    {
      description: "Period 13 pre-closing or unsure handling is reviewed separately from normal monthly balancing.",
      issueCount: countFor([
        "period_13_pending_close_verification",
        "period_13_review_required",
        "period_13_unexplained_imbalance"
      ]),
      label: "Period 13 close review"
    }
  ];

  return {
    checks,
    issueCount: checks.reduce((total, check) => total + check.issueCount, 0)
  };
}

function getRootCauseLabel(exceptionCode: string, exceptionMessage = "") {
  return getRootCauseLabelFromGroup(getRootCauseGroup(exceptionCode, exceptionMessage));
}

function getRootCauseLabelFromGroup(group: string) {
  const labels: Record<string, string> = {
    account_parsing: "Account Parsing",
    fiscal_setup: "Fiscal Setup",
    numeric_or_preview: "Numeric Parsing",
    other: "Other",
    period_conflict: "Period Conflict",
    reference_mapping: "Reference Mapping",
    required_fields: "Required Fields",
    trial_balance_integrity: "Trial Balance Integrity"
  };

  return labels[group] ?? "Other";
}

function getRootCauseMessage(
  group: string,
  details: {
    count: number;
    fields: Set<string>;
    rawValues: number;
  }
) {
  if (group === "fiscal_setup") {
    return "Fiscal year or period setup is missing, inactive, or not linked to the import batch.";
  }

  if (group === "numeric_or_preview") {
    return `${details.count} amount or preview issue${details.count === 1 ? "" : "s"} across ${details.fields.size || "unknown"} field${details.fields.size === 1 ? "" : "s"}. Rows with raw values are shown in detail.`;
  }

  if (group === "required_fields") {
    return "Required mapped values are blank or absent after preview.";
  }

  if (group === "reference_mapping") {
    return "Preview-row codes are missing from committed reference mappings.";
  }

  if (group === "account_parsing") {
    return "Account numbers or parsed account segments do not match the configured structure.";
  }

  if (group === "trial_balance_integrity") {
    return "Trial balance balancing or row formula checks did not tie.";
  }

  if (group === "period_conflict") {
    return "Active posted data already exists for this fiscal year and period.";
  }

  return "Review the exception details below.";
}

function getRootCauseSuggestedFix(group: string) {
  const fixes: Record<string, string> = {
    account_parsing: "Correct the account structure or source account numbers, then regenerate preview.",
    fiscal_setup: "Configure the fiscal year and period in Setup, then rerun validation.",
    numeric_or_preview: "Regenerate preview after the parser fix. Remaining rows here usually mean a truly invalid amount or template issue.",
    other: "Review the detailed exception message and suggested fix.",
    period_conflict: "Use the replacement workflow before posting another active import for the same period.",
    reference_mapping: "Add or correct missing reference rows in Reference Data, or use a bulk reference import, then rerun validation.",
    required_fields: "Fix the source file or template mapping, regenerate preview, and rerun validation.",
    trial_balance_integrity: "Review out-of-balance funds, missing rows, signs, and beginning/net/ending formulas before posting."
  };

  return fixes[group] ?? fixes.other;
}

function getRootCauseSortOrder(group: string) {
  const order: Record<string, number> = {
    fiscal_setup: 1,
    numeric_or_preview: 2,
    required_fields: 3,
    account_parsing: 4,
    trial_balance_integrity: 5,
    reference_mapping: 6,
    period_conflict: 7,
    other: 8
  };

  return order[group] ?? 99;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function getPeriod13Handling(metadata: Record<string, unknown> | null) {
  const value = metadata?.period_13_handling;
  return typeof value === "string" ? value : null;
}

function getPeriod13CloseStatus(metadata: Record<string, unknown> | null) {
  const value = metadata?.period_13_close_status;
  return typeof value === "string" ? value : null;
}

function formatPeriod13Handling(value: string | null) {
  const labels: Record<string, string> = {
    post_closing: "Post-closing trial balance",
    pre_closing: "Pre-closing year-end trial balance",
    unsure: "Unsure, require review"
  };

  return value ? labels[value] ?? value : "Not selected";
}

function formatPeriod13CloseStatus(value: string | null) {
  const labels: Record<string, string> = {
    failed_unexplained: "Blocked - unexplained imbalance",
    normal_balanced: "Balanced",
    not_period_13: "Not Period 13",
    pending_close_verification: "Pending close verification",
    review_required: "Review required"
  };

  return value ? labels[value] ?? value : "Not evaluated";
}

function getPeriod13PostingImpact(validation: ValidationRunRow) {
  const status = getPeriod13CloseStatus(validation.metadata);

  if (validation.critical_error_count > 0) {
    return "Blocked by critical validation errors";
  }

  if (status === "pending_close_verification" || status === "review_required") {
    return validation.warnings_acknowledged
      ? "Warnings acknowledged; posting can proceed if otherwise eligible"
      : "Warning acknowledgement required before posting";
  }

  return validation.eligible_to_post ? "Eligible" : "Not eligible";
}

function getPeriod13CloseFunds(metadata: Record<string, unknown> | null) {
  const analysis = metadata?.period_13_close_analysis;
  if (!analysis || typeof analysis !== "object" || Array.isArray(analysis)) {
    return [];
  }

  const funds = (analysis as { funds?: unknown }).funds;
  return Array.isArray(funds)
    ? funds.filter(
        (fund): fund is Record<string, unknown> =>
          Boolean(fund) && typeof fund === "object" && !Array.isArray(fund)
      )
    : [];
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency"
  }).format(value);
}
