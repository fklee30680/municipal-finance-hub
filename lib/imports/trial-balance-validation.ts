import "server-only";

import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  getValidationRule,
  type ValidationSeverity
} from "@/lib/imports/validation-rules";

const BALANCE_TOLERANCE = 0.01;

export const trialBalanceValidationSignConvention = {
  balanceFormula: "beginning_balance + net_change = ending_balance",
  netChangeFormula: "debits - credits = net_change"
} as const;

type ImportBatchRecord = {
  import_batch_id: string;
  organization_id: string;
  import_type_id: string;
  source_file_id: string | null;
  template_version_id: string | null;
  account_structure_id: string | null;
  fiscal_year_id: string | null;
  fiscal_period_id: string | null;
  fiscal_year: number | null;
  period: number | null;
  metadata: Record<string, unknown> | null;
};

type ImportTypeRecord = {
  import_type_code: string;
  import_type_name: string;
};

type PreviewRunRecord = {
  preview_run_id: string;
  organization_id: string;
  import_batch_id: string;
  source_file_id: string;
  import_template_version_id: string;
  account_structure_id: string;
  row_count: number;
  previewed_row_count: number;
  metadata: Record<string, unknown> | null;
};

type PreviewRowRecord = {
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
  raw_row_json: Record<string, unknown>;
  transformed_row_json: Record<string, unknown>;
  has_issue: boolean;
};

type PreviewIssueRecord = {
  preview_issue_id: string;
  preview_row_id: string | null;
  source_row_number: number | null;
  issue_code: string;
  issue_message: string;
  issue_severity: "info" | "warning" | "error";
  source_column_name: string | null;
  target_field_name: string | null;
  raw_value: string | null;
  transformed_value: string | null;
};

type TemplateVersionRecord = {
  template_version_id: string;
  import_template_id: string;
  account_structure_id: string | null;
};

type AccountStructureRecord = {
  account_structure_id: string;
  segment_count: number;
  active_status: string;
};

type FieldMappingRecord = {
  target_field_name: string;
};

type OrganizationSettingsRecord = {
  current_fiscal_year: string | null;
  standard_period_count: number;
  enable_period_0: boolean;
  enable_period_13: boolean;
  enable_accrual_reporting: boolean;
};

type FiscalYearRecord = {
  fiscal_year_id: string;
  fiscal_year: number;
  active_status: string;
};

type FiscalPeriodRecord = {
  fiscal_period_id: string;
  fiscal_year_id: string;
  fiscal_year: number;
  period: number;
  active_status: string;
};

type ReferenceRecord = {
  code: string;
  mappingVersionId: string | null;
};

type MappingVersionRecord = {
  mapping_version_id: string;
  mapping_scope: "fund" | "object" | "acfr" | "department" | "function";
};

type ValidationExceptionDraft = {
  previewRowId?: string | null;
  rowNumber?: number | null;
  sourceColumnName?: string | null;
  targetFieldName?: string | null;
  rawValue?: string | null;
  transformedValue?: string | null;
  exceptionCode: string;
  exceptionMessage: string;
  severity: ValidationSeverity;
  suggestedFix: string;
};

type ValidationSummary = {
  validationRunId: string;
  eligibleToPost: boolean;
  criticalErrorCount: number;
  warningCount: number;
  informationCount: number;
  rowsDetected: number;
  rowsValidated: number;
  rowsRejected: number;
};

const requiredTrialBalanceFields = [
  "full_account_number",
  "account_name",
  "beginning_balance",
  "debits",
  "credits",
  "net_change",
  "ending_balance"
] as const;

const numericTrialBalanceFields = [
  "beginning_balance",
  "debits",
  "credits",
  "net_change",
  "ending_balance"
] as const;

export async function runTrialBalanceValidation({
  adminClient,
  importBatchId,
  organizationId,
  userId
}: {
  adminClient: SupabaseClient;
  importBatchId: string;
  organizationId: string;
  userId: string;
}): Promise<ValidationSummary> {
  const batch = await loadImportBatch({ adminClient, importBatchId, organizationId });
  const importType = await loadImportType({
    adminClient,
    importTypeId: batch.import_type_id,
    organizationId
  });

  if (importType.import_type_code !== "trial_balance") {
    throw new Error("Validation is available only for trial_balance import batches.");
  }

  if (!batch.source_file_id) {
    throw new Error("This import batch does not have a source file.");
  }

  if (!batch.template_version_id) {
    throw new Error("Select a trial balance template before validation.");
  }

  const templateVersion = await loadTemplateVersion({
    adminClient,
    organizationId,
    templateVersionId: batch.template_version_id
  });
  const accountStructureId =
    templateVersion.account_structure_id ?? batch.account_structure_id;

  if (!accountStructureId) {
    throw new Error("This trial balance import needs an account structure before validation.");
  }

  await loadActiveAccountStructure({
    accountStructureId,
    adminClient,
    organizationId
  });

  const previewRun = await loadLatestPreviewRun({
    adminClient,
    importBatchId,
    organizationId
  });
  const [
    previewRows,
    previewIssues,
    fieldMappings,
    settings,
    fiscalYearRecord,
    fiscalPeriodRecord
  ] =
    await Promise.all([
      loadPreviewRows({ adminClient, organizationId, previewRunId: previewRun.preview_run_id }),
      loadPreviewIssues({
        adminClient,
        organizationId,
        previewRunId: previewRun.preview_run_id
      }),
      loadFieldMappings({
        adminClient,
        organizationId,
        templateVersionId: templateVersion.template_version_id
      }),
      loadOrganizationSettings({ adminClient, organizationId }),
      loadFiscalYear({ adminClient, fiscalYear: batch.fiscal_year, organizationId }),
      loadFiscalPeriod({
        adminClient,
        fiscalYear: batch.fiscal_year,
        organizationId,
        period: batch.period
      })
    ]);

  if (previewRows.length === 0) {
    throw new Error("No preview rows were found. Generate trial balance preview before validation.");
  }

  const referenceData = await loadReferenceData({ adminClient, organizationId });
  const mappingVersions = collectMappingVersions(referenceData);
  const exceptions: ValidationExceptionDraft[] = [];

  validateFileSetup({
    accountStructureId,
    batch,
    exceptions,
    fieldMappings,
    previewRun,
    templateVersion
  });
  validateFiscalPeriod({
    batch,
    exceptions,
    fiscalPeriodRecord,
    fiscalYearRecord,
    settings
  });
  await linkImportBatchFiscalSetup({
    adminClient,
    batch,
    fiscalPeriodRecord,
    fiscalYearRecord,
    importBatchId,
    organizationId,
    userId
  });
  await validatePeriodConflict({
    adminClient,
    batch,
    exceptions,
    organizationId
  });
  carryForwardPreviewIssues({ exceptions, previewIssues });
  validatePreviewRows({
    exceptions,
    previewRows,
    referenceData
  });

  if (mappingVersions.length === 0) {
    exceptions.push(createException({
      code: "mapping_version_unavailable",
      message:
        "No committed mapping versions were available to record for this validation run.",
      severity: "warning"
    }));
  }

  const validationExceptions = dedupeValidationExceptions(exceptions);
  const validationRunId = randomUUID();
  const summary = summarizeValidation({
    exceptions: validationExceptions,
    previewRows,
    validationRunId
  });

  await adminClient
    .from("validation_runs")
    .update({
      status: "superseded",
      superseded_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("organization_id", organizationId)
    .eq("import_batch_id", importBatchId)
    .eq("status", "completed");

  const validationRunResult = await adminClient.from("validation_runs").insert({
    validation_run_id: validationRunId,
    organization_id: organizationId,
    import_batch_id: importBatchId,
    source_file_id: previewRun.source_file_id,
    import_template_version_id: previewRun.import_template_version_id,
    account_structure_id: previewRun.account_structure_id,
    preview_run_id: previewRun.preview_run_id,
    status: "completed",
    eligible_to_post: summary.eligibleToPost,
    warnings_acknowledged: false,
    critical_error_count: summary.criticalErrorCount,
    warning_count: summary.warningCount,
    information_count: summary.informationCount,
    rows_detected: summary.rowsDetected,
    rows_validated: summary.rowsValidated,
    rows_rejected: summary.rowsRejected,
    validated_by: userId,
    validated_at: new Date().toISOString(),
    metadata: {
      sign_convention: trialBalanceValidationSignConvention,
      validation_scope: "trial_balance_preview_rows"
    }
  });

  if (validationRunResult.error) {
    throw new Error(validationRunResult.error.message);
  }

  if (mappingVersions.length > 0) {
    const mappingVersionResult = await adminClient
      .from("validation_run_mapping_versions")
      .insert(
        mappingVersions.map((mappingVersion) => ({
          organization_id: organizationId,
          validation_run_id: validationRunId,
          mapping_version_id: mappingVersion.mapping_version_id,
          mapping_type: mappingVersion.mapping_scope
        }))
      );

    if (mappingVersionResult.error) {
      throw new Error(mappingVersionResult.error.message);
    }
  }

  if (validationExceptions.length > 0) {
    const exceptionResult = await adminClient.from("import_exceptions").insert(
      validationExceptions.map((exception) => ({
        organization_id: organizationId,
        import_batch_id: importBatchId,
        source_file_id: previewRun.source_file_id,
        validation_run_id: validationRunId,
        preview_run_id: previewRun.preview_run_id,
        preview_row_id: exception.previewRowId ?? null,
        sheet_name: getStringMetadataValue(previewRun.metadata, "sheet_name"),
        source_row_number: exception.rowNumber ?? null,
        row_number: exception.rowNumber ?? null,
        source_column_name: exception.sourceColumnName ?? null,
        target_field_name: exception.targetFieldName ?? null,
        raw_value: exception.rawValue ?? null,
        transformed_value: exception.transformedValue ?? null,
        exception_code: exception.exceptionCode,
        exception_message: exception.exceptionMessage,
        severity: exception.severity,
        suggested_fix: exception.suggestedFix,
        exception_status: "open",
        resolution_status: "open"
      }))
    );

    if (exceptionResult.error) {
      throw new Error(exceptionResult.error.message);
    }
  }

  const batchStatus = getBatchStatus(summary);
  const batchResult = await adminClient
    .from("import_batches")
    .update({
      batch_status: batchStatus,
      rows_processed: summary.rowsValidated,
      rows_accepted: summary.rowsValidated - summary.rowsRejected,
      rows_rejected: summary.rowsRejected,
      warning_count: summary.warningCount,
      error_count: summary.criticalErrorCount,
      is_active_for_reporting: false,
      reporting_status: "excluded",
      updated_by: userId,
      metadata: {
        ...(batch.metadata ?? {}),
        latest_validation_run_id: validationRunId,
        validation_eligible_to_post: summary.eligibleToPost,
        validation_only: true
      }
    })
    .eq("organization_id", organizationId)
    .eq("import_batch_id", importBatchId);

  if (batchResult.error) {
    throw new Error(batchResult.error.message);
  }

  await adminClient.from("audit_logs").insert({
    organization_id: organizationId,
    actor_user_id: userId,
    action_type:
      summary.criticalErrorCount > 0 ? "validation_failed" : "validation_run_completed",
    entity_table: "validation_runs",
    entity_id: validationRunId,
    after_payload: {
      import_batch_id: importBatchId,
      eligible_to_post: summary.eligibleToPost,
      critical_error_count: summary.criticalErrorCount,
      warning_count: summary.warningCount
    },
    metadata: {
      validation_only: true
    }
  });

  return summary;
}

export async function acknowledgeValidationWarnings({
  acknowledgementNote,
  adminClient,
  importBatchId,
  organizationId,
  userId,
  validationRunId
}: {
  acknowledgementNote: string;
  adminClient: SupabaseClient;
  importBatchId: string;
  organizationId: string;
  userId: string;
  validationRunId: string;
}) {
  const [validationRun, canAcknowledge] = await Promise.all([
    loadValidationRun({
      adminClient,
      organizationId,
      validationRunId
    }),
    userCanAcknowledgeWarnings({
      adminClient,
      organizationId,
      userId
    })
  ]);

  if (!canAcknowledge) {
    throw new Error("Warning acknowledgement requires System Admin, Finance Admin, Approver, or Reviewer role.");
  }

  if (validationRun.import_batch_id !== importBatchId) {
    throw new Error("Validation run does not belong to this import batch.");
  }

  if (validationRun.critical_error_count > 0) {
    throw new Error("Critical errors cannot be acknowledged into posting eligibility.");
  }

  if (validationRun.warning_count === 0) {
    throw new Error("This validation run does not have warnings to acknowledge.");
  }

  const batch = await loadImportBatch({ adminClient, importBatchId, organizationId });

  const acknowledgementResult = await adminClient
    .from("warning_acknowledgements")
    .insert({
      organization_id: organizationId,
      validation_run_id: validationRunId,
      import_batch_id: importBatchId,
      acknowledged_by: userId,
      acknowledgement_note: acknowledgementNote || null,
      warning_count_acknowledged: validationRun.warning_count
    });

  if (acknowledgementResult.error) {
    throw new Error(acknowledgementResult.error.message);
  }

  const updateRunResult = await adminClient
    .from("validation_runs")
    .update({
      eligible_to_post: true,
      warnings_acknowledged: true,
      updated_at: new Date().toISOString()
    })
    .eq("organization_id", organizationId)
    .eq("validation_run_id", validationRunId);

  if (updateRunResult.error) {
    throw new Error(updateRunResult.error.message);
  }

  const updateBatchResult = await adminClient
    .from("import_batches")
    .update({
      batch_status: "validated",
      is_active_for_reporting: false,
      reporting_status: "excluded",
      updated_by: userId,
      metadata: {
        ...(batch.metadata ?? {}),
        latest_validation_run_id: validationRunId,
        validation_eligible_to_post: true,
        warnings_acknowledged: true
      }
    })
    .eq("organization_id", organizationId)
    .eq("import_batch_id", importBatchId);

  if (updateBatchResult.error) {
    throw new Error(updateBatchResult.error.message);
  }

  await adminClient.from("audit_logs").insert({
    organization_id: organizationId,
    actor_user_id: userId,
    action_type: "validation_warning_acknowledged",
    entity_table: "validation_runs",
    entity_id: validationRunId,
    after_payload: {
      import_batch_id: importBatchId,
      warning_count_acknowledged: validationRun.warning_count
    },
    metadata: {
      validation_only: true
    }
  });
}

function validateFileSetup({
  accountStructureId,
  batch,
  exceptions,
  fieldMappings,
  previewRun,
  templateVersion
}: {
  accountStructureId: string;
  batch: ImportBatchRecord;
  exceptions: ValidationExceptionDraft[];
  fieldMappings: FieldMappingRecord[];
  previewRun: PreviewRunRecord;
  templateVersion: TemplateVersionRecord;
}) {
  if (!batch.source_file_id) {
    exceptions.push(createException({
      code: "missing_required_field",
      message: "Import batch is missing a source file.",
      targetFieldName: "source_file_id"
    }));
  }

  if (!templateVersion.template_version_id) {
    exceptions.push(createException({
      code: "missing_required_field",
      message: "Import batch is missing a template version.",
      targetFieldName: "template_version_id"
    }));
  }

  if (!accountStructureId) {
    exceptions.push(createException({
      code: "missing_required_field",
      message: "Import batch is missing an account structure.",
      targetFieldName: "account_structure_id"
    }));
  }

  if (!previewRun.preview_run_id) {
    exceptions.push(createException({
      code: "missing_preview_run",
      message: "No trial balance preview run exists for this import batch."
    }));
  }

  const mappedFields = new Set(fieldMappings.map((mapping) => mapping.target_field_name));
  for (const requiredField of requiredTrialBalanceFields) {
    if (!mappedFields.has(requiredField)) {
      exceptions.push(createException({
        code: "missing_required_field",
        message: `Template is missing required field mapping: ${requiredField}.`,
        targetFieldName: requiredField
      }));
    }
  }
}

function validateFiscalPeriod({
  batch,
  exceptions,
  fiscalPeriodRecord,
  fiscalYearRecord,
  settings
}: {
  batch: ImportBatchRecord;
  exceptions: ValidationExceptionDraft[];
  fiscalPeriodRecord: FiscalPeriodRecord | null;
  fiscalYearRecord: FiscalYearRecord | null;
  settings: OrganizationSettingsRecord | null;
}) {
  if (!batch.fiscal_year) {
    exceptions.push(createException({
      code: "invalid_fiscal_year",
      message: "Fiscal year is required before validation.",
      targetFieldName: "fiscal_year"
    }));
    return;
  }

  if (batch.period === null || batch.period === undefined) {
    exceptions.push(createException({
      code: "invalid_period",
      message: "Period is required before validation.",
      targetFieldName: "period"
    }));
    return;
  }

  if (batch.period < 0 || batch.period > 13) {
    exceptions.push(createException({
      code: "invalid_period",
      message: "Period must be between 0 and 13.",
      targetFieldName: "period",
      transformedValue: String(batch.period)
    }));
    return;
  }

  if (!fiscalYearRecord || !fiscalPeriodRecord) {
    exceptions.push(createException({
      code: "invalid_fiscal_setup",
      message: `Fiscal year ${batch.fiscal_year} and period ${batch.period} are not configured for this organization.`,
      targetFieldName: "fiscal_year / period",
      transformedValue: `${batch.fiscal_year}-${batch.period}`
    }));
    return;
  }

  if (fiscalPeriodRecord.fiscal_year_id !== fiscalYearRecord.fiscal_year_id) {
    exceptions.push(createException({
      code: "invalid_fiscal_setup",
      message: `Fiscal year ${batch.fiscal_year} and period ${batch.period} are configured but are not linked to the same fiscal setup record.`,
      targetFieldName: "fiscal_year / period",
      transformedValue: `${batch.fiscal_year}-${batch.period}`
    }));
    return;
  }

  const standardPeriodCount = settings?.standard_period_count ?? 12;

  if (batch.period === 0 && !settings?.enable_period_0) {
    exceptions.push(createException({
      code: "invalid_period",
      message: "Period 0 is not enabled for this organization.",
      targetFieldName: "period",
      transformedValue: "0"
    }));
  }

  if (batch.period === 13 && !settings?.enable_period_13) {
    exceptions.push(createException({
      code: "invalid_period",
      message: "Period 13 is not enabled for this organization.",
      targetFieldName: "period",
      transformedValue: "13"
    }));
  }

  if (batch.period > standardPeriodCount && batch.period !== 13) {
    exceptions.push(createException({
      code: "invalid_period",
      message: `Period exceeds the configured standard period count of ${standardPeriodCount}.`,
      targetFieldName: "period",
      transformedValue: String(batch.period)
    }));
  }
}

async function validatePeriodConflict({
  adminClient,
  batch,
  exceptions,
  organizationId
}: {
  adminClient: SupabaseClient;
  batch: ImportBatchRecord;
  exceptions: ValidationExceptionDraft[];
  organizationId: string;
}) {
  if (!batch.fiscal_year || batch.period === null || batch.period === undefined) {
    return;
  }

  const conflictResult = await adminClient
    .from("trial_balance_lines")
    .select("trial_balance_line_id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("fiscal_year", batch.fiscal_year)
    .eq("period", batch.period)
    .eq("is_active_for_reporting", true);

  if (conflictResult.error) {
    throw new Error(conflictResult.error.message);
  }

  if ((conflictResult.count ?? 0) > 0) {
    exceptions.push(createException({
      code: "period_conflict_active_data_exists",
      message:
        "Active posted trial balance data already exists for this fiscal year and period.",
      targetFieldName: "period",
      transformedValue: `${batch.fiscal_year}-${batch.period}`
    }));
  }
}

function carryForwardPreviewIssues({
  exceptions,
  previewIssues
}: {
  exceptions: ValidationExceptionDraft[];
  previewIssues: PreviewIssueRecord[];
}) {
  for (const issue of previewIssues) {
    const isNumericParseFailure = issue.issue_code === "numeric_parse_failed";
    const isMissingMappedField = issue.issue_code === "missing_required_mapped_field";

    if (isMissingMappedField && hasRawIssueValueForSameField(previewIssues, issue)) {
      continue;
    }

    exceptions.push(createException({
      code:
        isNumericParseFailure
          ? "invalid_numeric_value"
          : issue.issue_code === "blank_row_skipped"
          ? "blank_row_skipped"
          : "preview_issue_carried_forward",
      message: isNumericParseFailure
        ? `${issue.target_field_name ?? "Amount"} could not be parsed as a number. Raw value: ${issue.raw_value ?? "not available"}.`
        : `Preview issue carried forward: ${issue.issue_code}. ${issue.issue_message}`,
      previewRowId: issue.preview_row_id,
      rawValue: issue.raw_value,
      rowNumber: issue.source_row_number,
      severity: previewSeverityToValidationSeverity(issue.issue_severity),
      sourceColumnName: issue.source_column_name,
      targetFieldName: issue.target_field_name,
      transformedValue: issue.transformed_value
    }));
  }
}

function validatePreviewRows({
  exceptions,
  previewRows,
  referenceData
}: {
  exceptions: ValidationExceptionDraft[];
  previewRows: PreviewRowRecord[];
  referenceData: Awaited<ReturnType<typeof loadReferenceData>>;
}) {
  const accounts = new Map<string, PreviewRowRecord[]>();

  for (const row of previewRows) {
    validateRequiredFields({ exceptions, row });
    validateNumericFields({ exceptions, row });
    validateAccountSegments({ exceptions, row });
    validateReferenceMappings({ exceptions, referenceData, row });
    validateFinancialFormulas({ exceptions, row });

    const accountNumber = row.full_account_number?.trim();
    if (accountNumber) {
      accounts.set(accountNumber, [...(accounts.get(accountNumber) ?? []), row]);
    }
  }

  for (const [accountNumber, duplicateRows] of accounts) {
    if (duplicateRows.length > 1) {
      for (const row of duplicateRows) {
        exceptions.push(createException({
          code: "duplicate_full_account_number",
          message: `Full account number ${accountNumber} appears more than once in this import.`,
          previewRowId: row.preview_row_id,
          rowNumber: row.source_row_number,
          targetFieldName: "full_account_number",
          transformedValue: accountNumber
        }));
      }
    }
  }
}

function validateRequiredFields({
  exceptions,
  row
}: {
  exceptions: ValidationExceptionDraft[];
  row: PreviewRowRecord;
}) {
  for (const field of requiredTrialBalanceFields) {
    const value = row[field];
    if (value === null || value === undefined || value === "") {
      if (hasExceptionForField({
        code: "invalid_numeric_value",
        exceptions,
        field,
        row
      })) {
        continue;
      }

      exceptions.push(createException({
        code: "missing_required_field",
        message: `${field} is required.`,
        previewRowId: row.preview_row_id,
        rawValue: getRawValue(row, field),
        rowNumber: row.source_row_number,
        targetFieldName: field,
        transformedValue: value === null || value === undefined ? null : String(value)
      }));
    }
  }
}

function validateNumericFields({
  exceptions,
  row
}: {
  exceptions: ValidationExceptionDraft[];
  row: PreviewRowRecord;
}) {
  for (const field of numericTrialBalanceFields) {
    const value = row[field];
    if (value === null || value === undefined || value === "") {
      continue;
    }

    if (Number.isNaN(Number(value))) {
      if (hasExceptionForField({
        code: "invalid_numeric_value",
        exceptions,
        field,
        row
      })) {
        continue;
      }

      exceptions.push(createException({
        code: "invalid_numeric_value",
        message: `${field} must be numeric.`,
        previewRowId: row.preview_row_id,
        rawValue: getRawValue(row, field),
        rowNumber: row.source_row_number,
        targetFieldName: field,
        transformedValue: value === null || value === undefined ? null : String(value)
      }));
    }
  }
}

function validateAccountSegments({
  exceptions,
  row
}: {
  exceptions: ValidationExceptionDraft[];
  row: PreviewRowRecord;
}) {
  if (!row.full_account_number?.trim()) {
    exceptions.push(createException({
      code: "unparseable_account_number",
      message: "Full account number is missing.",
      previewRowId: row.preview_row_id,
      rowNumber: row.source_row_number,
      targetFieldName: "full_account_number"
    }));
  }

  const requiredSegments = [
    ["fund_code", row.fund_code],
    ["acfr_code", row.acfr_code],
    ["department_code", row.department_code],
    ["function_code", row.function_code],
    ["object_code", row.object_code]
  ] as const;

  for (const [field, value] of requiredSegments) {
    if (!value?.trim()) {
      exceptions.push(createException({
        code: "account_segment_count_mismatch",
        message: `${field} could not be parsed from the configured account structure.`,
        previewRowId: row.preview_row_id,
        rowNumber: row.source_row_number,
        targetFieldName: field,
        transformedValue: value
      }));
    }
  }
}

function validateReferenceMappings({
  exceptions,
  referenceData,
  row
}: {
  exceptions: ValidationExceptionDraft[];
  referenceData: Awaited<ReturnType<typeof loadReferenceData>>;
  row: PreviewRowRecord;
}) {
  const checks = [
    {
      code: "missing_fund_mapping",
      field: "fund_code",
      label: "Fund",
      records: referenceData.funds,
      value: row.fund_code
    },
    {
      code: "missing_acfr_mapping",
      field: "acfr_code",
      label: "ACFR",
      records: referenceData.acfr,
      value: row.acfr_code
    },
    {
      code: "missing_department_mapping",
      field: "department_code",
      label: "Department",
      records: referenceData.departments,
      value: row.department_code
    },
    {
      code: "missing_function_mapping",
      field: "function_code",
      label: "Function",
      records: referenceData.functions,
      value: row.function_code
    },
    {
      code: "missing_object_mapping",
      field: "object_code",
      label: "Object",
      records: referenceData.objects,
      value: row.object_code
    }
  ] as const;

  for (const check of checks) {
    const value = check.value?.trim();
    if (!value || check.records.has(value)) {
      continue;
    }

    exceptions.push(createException({
      code: check.code,
      message: `${check.label} code ${value} was not found in committed active mappings.`,
      previewRowId: row.preview_row_id,
      rowNumber: row.source_row_number,
      targetFieldName: check.field,
      transformedValue: value
    }));
  }
}

function validateFinancialFormulas({
  exceptions,
  row
}: {
  exceptions: ValidationExceptionDraft[];
  row: PreviewRowRecord;
}) {
  const beginning = getNumericValue(row.beginning_balance);
  const debits = getNumericValue(row.debits);
  const credits = getNumericValue(row.credits);
  const netChange = getNumericValue(row.net_change);
  const ending = getNumericValue(row.ending_balance);

  if (beginning !== null && netChange !== null && ending !== null) {
    const expectedEnding = beginning + netChange;
    if (!amountsTie(expectedEnding, ending)) {
      exceptions.push(createException({
        code: "balance_formula_failure",
        message:
          "Beginning balance plus net change does not tie to ending balance using the MVP sign convention.",
        previewRowId: row.preview_row_id,
        rowNumber: row.source_row_number,
        targetFieldName: "ending_balance",
        transformedValue: String(ending)
      }));
    }
  }

  if (debits !== null && credits !== null && netChange !== null) {
    const expectedNetChange = debits - credits;
    if (!amountsTie(expectedNetChange, netChange)) {
      exceptions.push(createException({
        code: "net_change_formula_failure",
        message:
          "Debits minus credits does not tie to net change using the MVP sign convention.",
        previewRowId: row.preview_row_id,
        rowNumber: row.source_row_number,
        targetFieldName: "net_change",
        transformedValue: String(netChange)
      }));
    }
  }
}

function dedupeValidationExceptions(exceptions: ValidationExceptionDraft[]) {
  const byKey = new Map<string, ValidationExceptionDraft>();

  for (const exception of exceptions) {
    const key = [
      exception.previewRowId ?? exception.rowNumber ?? "import",
      exception.targetFieldName ?? "",
      getRootCauseCode(exception)
    ].join("|");
    const existing = byKey.get(key);

    if (!existing || shouldReplaceException(existing, exception)) {
      byKey.set(key, exception);
    }
  }

  return [...byKey.values()];
}

function getRootCauseCode(exception: ValidationExceptionDraft) {
  if (exception.exceptionCode === "invalid_numeric_value") {
    return "numeric_parse";
  }

  if (
    exception.exceptionCode === "missing_required_field" ||
    (exception.exceptionCode === "preview_issue_carried_forward" &&
      exception.exceptionMessage.includes("missing_required_mapped_field"))
  ) {
    return "required_field";
  }

  if (
    exception.exceptionCode === "invalid_fiscal_setup" ||
    exception.exceptionCode === "invalid_fiscal_year" ||
    exception.exceptionCode === "invalid_period"
  ) {
    return "fiscal_setup";
  }

  return exception.exceptionCode;
}

function shouldReplaceException(
  existing: ValidationExceptionDraft,
  candidate: ValidationExceptionDraft
) {
  const existingPriority = getExceptionPriority(existing);
  const candidatePriority = getExceptionPriority(candidate);

  if (candidatePriority !== existingPriority) {
    return candidatePriority > existingPriority;
  }

  if (!existing.rawValue && candidate.rawValue) {
    return true;
  }

  if (existing.exceptionCode === "preview_issue_carried_forward" && candidate.exceptionCode !== existing.exceptionCode) {
    return true;
  }

  return false;
}

function getExceptionPriority(exception: ValidationExceptionDraft) {
  if (exception.exceptionCode === "invalid_fiscal_setup") {
    return 40;
  }

  if (exception.exceptionCode === "invalid_numeric_value") {
    return 30;
  }

  if (exception.exceptionCode === "missing_required_field") {
    return 20;
  }

  if (exception.exceptionCode === "preview_issue_carried_forward") {
    return 10;
  }

  return 15;
}

function hasExceptionForField({
  code,
  exceptions,
  field,
  row
}: {
  code: string;
  exceptions: ValidationExceptionDraft[];
  field: string;
  row: PreviewRowRecord;
}) {
  return exceptions.some(
    (exception) =>
      exception.exceptionCode === code &&
      exception.previewRowId === row.preview_row_id &&
      exception.targetFieldName === field
  );
}

function hasRawIssueValueForSameField(
  previewIssues: PreviewIssueRecord[],
  issue: PreviewIssueRecord
) {
  return previewIssues.some(
    (candidate) =>
      candidate.preview_row_id === issue.preview_row_id &&
      candidate.target_field_name === issue.target_field_name &&
      candidate.issue_code === "numeric_parse_failed" &&
      Boolean(candidate.raw_value?.trim())
  );
}

function summarizeValidation({
  exceptions,
  previewRows,
  validationRunId
}: {
  exceptions: ValidationExceptionDraft[];
  previewRows: PreviewRowRecord[];
  validationRunId: string;
}): ValidationSummary {
  const criticalErrorCount = exceptions.filter(
    (exception) => exception.severity === "critical_error"
  ).length;
  const warningCount = exceptions.filter(
    (exception) => exception.severity === "warning"
  ).length;
  const informationCount = exceptions.filter(
    (exception) => exception.severity === "information"
  ).length;
  const rejectedRows = new Set(
    exceptions
      .filter((exception) => exception.severity === "critical_error")
      .map((exception) => exception.previewRowId ?? exception.rowNumber)
      .filter(Boolean)
  );

  return {
    criticalErrorCount,
    eligibleToPost: criticalErrorCount === 0 && warningCount === 0,
    informationCount,
    rowsDetected: previewRows.length,
    rowsRejected: rejectedRows.size,
    rowsValidated: previewRows.length,
    validationRunId,
    warningCount
  };
}

function getBatchStatus(summary: ValidationSummary) {
  if (summary.criticalErrorCount > 0) {
    return "validation_failed";
  }

  if (summary.warningCount > 0) {
    return "validated_with_warnings";
  }

  return "validated";
}

function createException({
  code,
  message,
  previewRowId = null,
  rawValue = null,
  rowNumber = null,
  severity,
  sourceColumnName = null,
  targetFieldName = null,
  transformedValue = null
}: {
  code: string;
  message: string;
  previewRowId?: string | null;
  rawValue?: string | null;
  rowNumber?: number | null;
  severity?: ValidationSeverity;
  sourceColumnName?: string | null;
  targetFieldName?: string | null;
  transformedValue?: string | null;
}): ValidationExceptionDraft {
  const rule = getValidationRule(code);

  return {
    exceptionCode: code,
    exceptionMessage: message,
    previewRowId,
    rawValue,
    rowNumber,
    severity: severity ?? rule?.defaultSeverity ?? "critical_error",
    sourceColumnName,
    suggestedFix: rule?.suggestedFix ?? "Review the source data and rerun validation.",
    targetFieldName,
    transformedValue
  };
}

function previewSeverityToValidationSeverity(
  severity: PreviewIssueRecord["issue_severity"]
): ValidationSeverity {
  if (severity === "error") {
    return "critical_error";
  }

  if (severity === "info") {
    return "information";
  }

  return "warning";
}

async function loadImportBatch({
  adminClient,
  importBatchId,
  organizationId
}: {
  adminClient: SupabaseClient;
  importBatchId: string;
  organizationId: string;
}) {
  const result = await adminClient
    .from("import_batches")
    .select(
      "import_batch_id, organization_id, import_type_id, source_file_id, template_version_id, account_structure_id, fiscal_year_id, fiscal_period_id, fiscal_year, period, metadata"
    )
    .eq("organization_id", organizationId)
    .eq("import_batch_id", importBatchId)
    .maybeSingle<ImportBatchRecord>();

  if (result.error || !result.data) {
    throw new Error(result.error?.message ?? "Import batch was not found.");
  }

  return result.data;
}

async function loadImportType({
  adminClient,
  importTypeId,
  organizationId
}: {
  adminClient: SupabaseClient;
  importTypeId: string;
  organizationId: string;
}) {
  const result = await adminClient
    .from("import_types")
    .select("import_type_code, import_type_name")
    .eq("organization_id", organizationId)
    .eq("import_type_id", importTypeId)
    .maybeSingle<ImportTypeRecord>();

  if (result.error || !result.data) {
    throw new Error(result.error?.message ?? "Import type was not found.");
  }

  return result.data;
}

async function loadTemplateVersion({
  adminClient,
  organizationId,
  templateVersionId
}: {
  adminClient: SupabaseClient;
  organizationId: string;
  templateVersionId: string;
}) {
  const result = await adminClient
    .from("import_template_versions")
    .select("template_version_id, import_template_id, account_structure_id")
    .eq("organization_id", organizationId)
    .eq("template_version_id", templateVersionId)
    .maybeSingle<TemplateVersionRecord>();

  if (result.error || !result.data) {
    throw new Error(result.error?.message ?? "Template version was not found.");
  }

  return result.data;
}

async function loadActiveAccountStructure({
  accountStructureId,
  adminClient,
  organizationId
}: {
  accountStructureId: string;
  adminClient: SupabaseClient;
  organizationId: string;
}) {
  const result = await adminClient
    .from("account_structures")
    .select("account_structure_id, segment_count, active_status")
    .eq("organization_id", organizationId)
    .eq("account_structure_id", accountStructureId)
    .eq("active_status", "active")
    .maybeSingle<AccountStructureRecord>();

  if (result.error || !result.data) {
    throw new Error(result.error?.message ?? "Active account structure was not found.");
  }

  return result.data;
}

async function loadLatestPreviewRun({
  adminClient,
  importBatchId,
  organizationId
}: {
  adminClient: SupabaseClient;
  importBatchId: string;
  organizationId: string;
}) {
  const result = await adminClient
    .from("import_preview_runs")
    .select(
      "preview_run_id, organization_id, import_batch_id, source_file_id, import_template_version_id, account_structure_id, row_count, previewed_row_count, metadata"
    )
    .eq("organization_id", organizationId)
    .eq("import_batch_id", importBatchId)
    .eq("preview_status", "completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<PreviewRunRecord>();

  if (result.error || !result.data) {
    throw new Error(
      result.error?.message ??
        "Generate a trial balance preview before running validation."
    );
  }

  return result.data;
}

async function loadPreviewRows({
  adminClient,
  organizationId,
  previewRunId
}: {
  adminClient: SupabaseClient;
  organizationId: string;
  previewRunId: string;
}) {
  const result = await adminClient
    .from("import_preview_rows")
    .select(
      "preview_row_id, source_row_number, full_account_number, fund_code, acfr_code, department_code, function_code, object_code, account_name, beginning_balance, debits, credits, net_change, ending_balance, raw_row_json, transformed_row_json, has_issue"
    )
    .eq("organization_id", organizationId)
    .eq("preview_run_id", previewRunId)
    .order("source_row_number", { ascending: true })
    .returns<PreviewRowRecord[]>();

  if (result.error) {
    throw new Error(result.error.message);
  }

  return result.data ?? [];
}

async function loadPreviewIssues({
  adminClient,
  organizationId,
  previewRunId
}: {
  adminClient: SupabaseClient;
  organizationId: string;
  previewRunId: string;
}) {
  const result = await adminClient
    .from("import_preview_issues")
    .select(
      "preview_issue_id, preview_row_id, source_row_number, issue_code, issue_message, issue_severity, source_column_name, target_field_name, raw_value, transformed_value"
    )
    .eq("organization_id", organizationId)
    .eq("preview_run_id", previewRunId)
    .returns<PreviewIssueRecord[]>();

  if (result.error) {
    throw new Error(result.error.message);
  }

  return result.data ?? [];
}

async function loadFieldMappings({
  adminClient,
  organizationId,
  templateVersionId
}: {
  adminClient: SupabaseClient;
  organizationId: string;
  templateVersionId: string;
}) {
  const result = await adminClient
    .from("field_mappings")
    .select("target_field_name")
    .eq("organization_id", organizationId)
    .eq("template_version_id", templateVersionId)
    .eq("active_status", "active")
    .eq("ignore_column", false)
    .returns<FieldMappingRecord[]>();

  if (result.error) {
    throw new Error(result.error.message);
  }

  return result.data ?? [];
}

async function loadOrganizationSettings({
  adminClient,
  organizationId
}: {
  adminClient: SupabaseClient;
  organizationId: string;
}) {
  const result = await adminClient
    .from("organization_settings")
    .select(
      "current_fiscal_year, standard_period_count, enable_period_0, enable_period_13, enable_accrual_reporting"
    )
    .eq("organization_id", organizationId)
    .maybeSingle<OrganizationSettingsRecord>();

  if (result.error) {
    throw new Error(result.error.message);
  }

  return result.data ?? null;
}

async function loadFiscalYear({
  adminClient,
  fiscalYear,
  organizationId
}: {
  adminClient: SupabaseClient;
  fiscalYear: number | null;
  organizationId: string;
}) {
  if (!fiscalYear) {
    return null;
  }

  const result = await adminClient
    .from("fiscal_years")
    .select("fiscal_year_id, fiscal_year, active_status")
    .eq("organization_id", organizationId)
    .eq("fiscal_year", fiscalYear)
    .eq("active_status", "active")
    .maybeSingle<FiscalYearRecord>();

  if (result.error) {
    throw new Error(result.error.message);
  }

  return result.data ?? null;
}

async function loadFiscalPeriod({
  adminClient,
  fiscalYear,
  organizationId,
  period
}: {
  adminClient: SupabaseClient;
  fiscalYear: number | null;
  organizationId: string;
  period: number | null;
}) {
  if (!fiscalYear || period === null || period === undefined) {
    return null;
  }

  const result = await adminClient
    .from("fiscal_periods")
    .select("fiscal_period_id, fiscal_year_id, fiscal_year, period, active_status")
    .eq("organization_id", organizationId)
    .eq("fiscal_year", fiscalYear)
    .eq("period", period)
    .eq("active_status", "active")
    .maybeSingle<FiscalPeriodRecord>();

  if (result.error) {
    throw new Error(result.error.message);
  }

  return result.data ?? null;
}

async function linkImportBatchFiscalSetup({
  adminClient,
  batch,
  fiscalPeriodRecord,
  fiscalYearRecord,
  importBatchId,
  organizationId,
  userId
}: {
  adminClient: SupabaseClient;
  batch: ImportBatchRecord;
  fiscalPeriodRecord: FiscalPeriodRecord | null;
  fiscalYearRecord: FiscalYearRecord | null;
  importBatchId: string;
  organizationId: string;
  userId: string;
}) {
  if (!fiscalYearRecord || !fiscalPeriodRecord) {
    return;
  }

  if (fiscalPeriodRecord.fiscal_year_id !== fiscalYearRecord.fiscal_year_id) {
    return;
  }

  if (
    batch.fiscal_year_id === fiscalYearRecord.fiscal_year_id &&
    batch.fiscal_period_id === fiscalPeriodRecord.fiscal_period_id
  ) {
    return;
  }

  const result = await adminClient
    .from("import_batches")
    .update({
      fiscal_year_id: fiscalYearRecord.fiscal_year_id,
      fiscal_period_id: fiscalPeriodRecord.fiscal_period_id,
      updated_by: userId
    })
    .eq("organization_id", organizationId)
    .eq("import_batch_id", importBatchId);

  if (result.error) {
    throw new Error(result.error.message);
  }
}

async function loadReferenceData({
  adminClient,
  organizationId
}: {
  adminClient: SupabaseClient;
  organizationId: string;
}) {
  const [funds, acfr, departments, functions, objects] = await Promise.all([
    loadReferenceTable({
      adminClient,
      codeField: "fund_code",
      organizationId,
      tableName: "funds"
    }),
    loadReferenceTable({
      adminClient,
      codeField: "acfr_code",
      organizationId,
      tableName: "acfr_mappings"
    }),
    loadReferenceTable({
      adminClient,
      codeField: "department_code",
      organizationId,
      tableName: "departments"
    }),
    loadReferenceTable({
      adminClient,
      codeField: "function_code",
      organizationId,
      tableName: "functions"
    }),
    loadReferenceTable({
      adminClient,
      codeField: "object_code",
      organizationId,
      tableName: "objects"
    })
  ]);

  return {
    acfr,
    departments,
    functions,
    funds,
    objects
  };
}

async function loadReferenceTable({
  adminClient,
  codeField,
  organizationId,
  tableName
}: {
  adminClient: SupabaseClient;
  codeField: string;
  organizationId: string;
  tableName: string;
}) {
  const result = await adminClient
    .from(tableName)
    .select(`${codeField}, mapping_version_id`)
    .eq("organization_id", organizationId)
    .eq("active_status", "active")
    .returns<Array<Record<string, string | null>>>();

  if (result.error) {
    throw new Error(result.error.message);
  }

  return new Map(
    (result.data ?? [])
      .map((row): ReferenceRecord | null => {
        const code = row[codeField];
        return typeof code === "string"
          ? {
              code,
              mappingVersionId:
                typeof row.mapping_version_id === "string"
                  ? row.mapping_version_id
                  : null
            }
          : null;
      })
      .filter((row): row is ReferenceRecord => Boolean(row))
      .map((row) => [row.code, row])
  );
}

function collectMappingVersions(
  referenceData: Awaited<ReturnType<typeof loadReferenceData>>
): MappingVersionRecord[] {
  const scopeMap = [
    ["fund", referenceData.funds],
    ["acfr", referenceData.acfr],
    ["department", referenceData.departments],
    ["function", referenceData.functions],
    ["object", referenceData.objects]
  ] as const;
  const mappingVersions = new Map<string, MappingVersionRecord>();

  for (const [scope, records] of scopeMap) {
    for (const record of records.values()) {
      if (record.mappingVersionId) {
        mappingVersions.set(record.mappingVersionId, {
          mapping_scope: scope,
          mapping_version_id: record.mappingVersionId
        });
      }
    }
  }

  return [...mappingVersions.values()];
}

async function loadValidationRun({
  adminClient,
  organizationId,
  validationRunId
}: {
  adminClient: SupabaseClient;
  organizationId: string;
  validationRunId: string;
}) {
  const result = await adminClient
    .from("validation_runs")
    .select(
      "validation_run_id, import_batch_id, critical_error_count, warning_count, metadata"
    )
    .eq("organization_id", organizationId)
    .eq("validation_run_id", validationRunId)
    .maybeSingle<{
      validation_run_id: string;
      import_batch_id: string;
      critical_error_count: number;
      warning_count: number;
      metadata: Record<string, unknown> | null;
    }>();

  if (result.error || !result.data) {
    throw new Error(result.error?.message ?? "Validation run was not found.");
  }

  return result.data;
}

async function userCanAcknowledgeWarnings({
  adminClient,
  organizationId,
  userId
}: {
  adminClient: SupabaseClient;
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
    throw new Error(result.error.message);
  }

  const allowedRoles = new Set(["System Admin", "Finance Admin", "Approver", "Reviewer"]);
  return (result.data ?? []).some((row) => {
    const role = Array.isArray(row.roles) ? row.roles[0] : row.roles;
    return role ? allowedRoles.has(role.role_name) : false;
  });
}

function getRawValue(row: PreviewRowRecord, field: string) {
  const rawValue = row.raw_row_json?.[field] ?? row.transformed_row_json?.[field];
  if (rawValue === null || rawValue === undefined) {
    return null;
  }

  return String(rawValue);
}

function getNumericValue(value: number | string | null) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numberValue = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isNaN(numberValue) ? null : numberValue;
}

function amountsTie(left: number, right: number) {
  return Math.abs(left - right) <= BALANCE_TOLERANCE;
}

function getStringMetadataValue(
  metadata: Record<string, unknown> | null,
  key: string
) {
  const value = metadata?.[key];
  return typeof value === "string" ? value : null;
}
