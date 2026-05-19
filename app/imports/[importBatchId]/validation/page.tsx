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
      "validation_run_id, preview_run_id, status, eligible_to_post, warnings_acknowledged, critical_error_count, warning_count, information_count, rows_detected, rows_validated, rows_rejected, validated_at, created_at"
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

  const [exceptionsResult, mappingVersionsResult, acknowledgementsResult, canAcknowledge] =
    await Promise.all([
      exceptionQuery.returns<ValidationExceptionRow[]>(),
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
