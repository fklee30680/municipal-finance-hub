import "server-only";

import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { loadSourceFileRows, type SourceFileForParsing } from "@/lib/imports/file-parsers";
import {
  applyCellTransformations,
  isBlankPreviewRow,
  looksLikeRepeatedHeader,
  stringifyValue,
  type PreviewIssueDraft
} from "@/lib/imports/transformations";
import { getRequiredTargetFieldNames } from "@/lib/templates/target-fields";

const MAX_MAPPING_PREVIEW_ROWS = 1000;

export const supportedMappingImportTypes = [
  "fund_mapping",
  "object_mapping",
  "acfr_mapping",
  "department_mapping",
  "function_mapping"
] as const;

export type SupportedMappingImportType = (typeof supportedMappingImportTypes)[number];

type MappingConfig = {
  codeField: string;
  nameField: string;
  mappingScope: "fund" | "object" | "acfr" | "department" | "function";
  targetTable: "funds" | "objects" | "acfr_mappings" | "departments" | "functions";
  tableIdField: string;
  tableFields: Record<string, string>;
};

const mappingConfigs: Record<SupportedMappingImportType, MappingConfig> = {
  fund_mapping: {
    codeField: "fund_code",
    mappingScope: "fund",
    nameField: "fund_name",
    tableFields: {
      active_status: "active_status",
      effective_end_date: "effective_end_date",
      effective_start_date: "effective_start_date",
      fund_code: "fund_code",
      fund_group: "fund_group",
      fund_name: "fund_name",
      fund_type: "fund_type",
      major_fund_flag: "major_fund_flag"
    },
    tableIdField: "fund_id",
    targetTable: "funds"
  },
  object_mapping: {
    codeField: "object_code",
    mappingScope: "object",
    nameField: "account_name",
    tableFields: {
      account_name: "object_name",
      account_type: "account_type",
      account_type_detailed: "account_type_detailed",
      active_status: "active_status",
      balance_sheet_category: "balance_sheet_category",
      cash_flow_category: "cash_flow_category",
      effective_end_date: "effective_end_date",
      effective_start_date: "effective_start_date",
      object_code: "object_code"
    },
    tableIdField: "object_id",
    targetTable: "objects"
  },
  acfr_mapping: {
    codeField: "acfr_code",
    mappingScope: "acfr",
    nameField: "acfr_name",
    tableFields: {
      acfr_code: "acfr_code",
      acfr_description: "acfr_description",
      acfr_name: "acfr_name",
      active_status: "active_status",
      effective_end_date: "effective_end_date",
      effective_start_date: "effective_start_date"
    },
    tableIdField: "acfr_mapping_id",
    targetTable: "acfr_mappings"
  },
  department_mapping: {
    codeField: "department_code",
    mappingScope: "department",
    nameField: "department_name",
    tableFields: {
      active_status: "active_status",
      department_code: "department_code",
      department_group: "department_group",
      department_name: "department_name",
      effective_end_date: "effective_end_date",
      effective_start_date: "effective_start_date"
    },
    tableIdField: "department_id",
    targetTable: "departments"
  },
  function_mapping: {
    codeField: "function_code",
    mappingScope: "function",
    nameField: "function_name",
    tableFields: {
      active_status: "active_status",
      effective_end_date: "effective_end_date",
      effective_start_date: "effective_start_date",
      function_code: "function_code",
      function_description: "function_description",
      function_name: "function_name"
    },
    tableIdField: "function_id",
    targetTable: "functions"
  }
};

type ImportBatchRecord = {
  import_batch_id: string;
  import_type_id: string;
  source_file_id: string | null;
  import_template_id: string | null;
  template_version_id: string | null;
  metadata: Record<string, unknown> | null;
};

type ImportTypeRecord = {
  import_type_code: string;
  import_type_name: string;
};

type TemplateVersionRecord = {
  template_version_id: string;
  import_template_id: string;
  version_number: number;
};

type TemplateRecord = {
  template_name: string;
};

type SheetMappingRecord = {
  sheet_mapping_id: string;
  sheet_name: string | null;
  sheet_index: number | null;
  header_row_number: number | null;
  data_start_row_number: number | null;
  target_entity: string | null;
};

type FieldMappingRecord = {
  source_field_name: string;
  source_column_index: number | null;
  target_field_name: string;
  default_value: string | null;
};

type ExistingMappingRow = Record<string, string | number | null>;

type MappingRowDraft = {
  mappingImportRowId: string;
  sourceRowNumber: number;
  mappingCode: string | null;
  mappingName: string | null;
  rowStatus: "new" | "changed" | "unchanged" | "rejected" | "warning" | "conflict" | "duplicate";
  acceptedForCommit: boolean;
  effectiveStartDate: string | null;
  effectiveEndDate: string | null;
  activeStatus: string | null;
  incomingRow: Record<string, string | null>;
  currentRow: ExistingMappingRow | null;
  changedFields: Record<string, { current: unknown; incoming: unknown }>;
  rawRow: Record<string, string>;
  transformedRow: Record<string, string | null>;
  issues: PreviewIssueDraft[];
};

export function isSupportedMappingImportType(
  importTypeCode: string
): importTypeCode is SupportedMappingImportType {
  return supportedMappingImportTypes.includes(
    importTypeCode as SupportedMappingImportType
  );
}

export function getMappingConfig(importTypeCode: SupportedMappingImportType) {
  return mappingConfigs[importTypeCode];
}

export async function generateMappingImportPreview({
  adminClient,
  importBatchId,
  organizationId,
  userId
}: {
  adminClient: SupabaseClient;
  importBatchId: string;
  organizationId: string;
  userId: string;
}) {
  const context = await loadMappingContext({ adminClient, importBatchId, organizationId });
  const { batch, config, importType, sourceFile, template, templateVersion } = context;
  const importTypeCode = importType.import_type_code as SupportedMappingImportType;
  const sheetMapping = await loadSingleSheetMapping({
    adminClient,
    importTypeCode,
    organizationId,
    templateVersionId: templateVersion.template_version_id
  });
  const fieldMappings = await loadFieldMappings({
    adminClient,
    organizationId,
    sheetMappingId: sheetMapping.sheet_mapping_id,
    templateVersionId: templateVersion.template_version_id
  });
  const missingRequiredFields = getRequiredTargetFieldNames(importTypeCode).filter(
    (fieldName) => !fieldMappings.some((mapping) => mapping.target_field_name === fieldName)
  );

  if (missingRequiredFields.length > 0) {
    throw new Error(`This template is missing required mappings: ${missingRequiredFields.join(", ")}.`);
  }

  const transformationRules = await loadTransformationRules({
    adminClient,
    organizationId,
    templateVersionId: templateVersion.template_version_id
  });
  const rows = await loadSourceFileRows({
    adminClient,
    sheetIndex: sheetMapping.sheet_index ?? 0,
    sourceFile
  });
  const headerRowIndex = Math.max((sheetMapping.header_row_number ?? 1) - 1, 0);
  const dataStartRowIndex = Math.max(
    (sheetMapping.data_start_row_number ?? headerRowIndex + 2) - 1,
    headerRowIndex + 1
  );
  const headerValues = (rows[headerRowIndex] ?? []).map(stringifyValue);
  const dataRows = rows.slice(dataStartRowIndex);

  if (dataRows.length === 0) {
    throw new Error("The configured data start row has no rows to preview.");
  }

  const existingRows = await loadExistingMappings({
    adminClient,
    config,
    organizationId
  });
  const parsedRows = buildMappingRows({
    config,
    dataRows,
    dataStartRowIndex,
    existingRows,
    fieldMappings,
    headerValues,
    importTypeCode,
    rules: new Set(transformationRules)
  });

  if (parsedRows.length === 0) {
    throw new Error("No mapping rows were detected after applying template rules.");
  }

  const summary = summarizeRows(parsedRows, dataRows.length);
  const mappingImportRunId = randomUUID();

  await adminClient
    .from("mapping_import_runs")
    .update({
      run_status: "superseded",
      superseded_at: new Date().toISOString()
    })
    .eq("organization_id", organizationId)
    .eq("import_batch_id", importBatchId)
    .eq("run_status", "previewed");

  const runResult = await adminClient.from("mapping_import_runs").insert({
    mapping_import_run_id: mappingImportRunId,
    organization_id: organizationId,
    import_batch_id: importBatchId,
    source_file_id: sourceFile.source_file_id,
    import_template_version_id: templateVersion.template_version_id,
    mapping_type: importTypeCode,
    target_table: config.targetTable,
    selected_sheet_name: sheetMapping.sheet_name,
    selected_sheet_index: sheetMapping.sheet_index,
    run_status: "previewed",
    row_count: summary.rowCount,
    rows_accepted: summary.rowsAccepted,
    rows_rejected: summary.rowsRejected,
    rows_with_warnings: summary.rowsWithWarnings,
    new_mappings: summary.newMappings,
    changed_mappings: summary.changedMappings,
    unchanged_mappings: summary.unchangedMappings,
    duplicate_rows: summary.duplicateRows,
    conflicting_rows: summary.conflictingRows,
    created_by: userId,
    metadata: {
      no_multi_sheet_import: true,
      template_name: template.template_name,
      template_version: templateVersion.version_number,
      max_preview_rows: MAX_MAPPING_PREVIEW_ROWS
    }
  });

  if (runResult.error) {
    throw new Error(runResult.error.message);
  }

  const rowResult = await adminClient.from("mapping_import_rows").insert(
    parsedRows.map((row) => ({
      mapping_import_row_id: row.mappingImportRowId,
      organization_id: organizationId,
      mapping_import_run_id: mappingImportRunId,
      import_batch_id: importBatchId,
      source_file_id: sourceFile.source_file_id,
      import_template_version_id: templateVersion.template_version_id,
      mapping_type: importTypeCode,
      target_table: config.targetTable,
      source_row_number: row.sourceRowNumber,
      mapping_code: row.mappingCode,
      mapping_name: row.mappingName,
      row_status: row.rowStatus,
      accepted_for_commit: row.acceptedForCommit,
      effective_start_date: row.effectiveStartDate,
      effective_end_date: row.effectiveEndDate,
      active_status: row.activeStatus,
      incoming_row_json: row.incomingRow,
      current_row_json: row.currentRow ?? {},
      changed_fields_json: row.changedFields,
      raw_row_json: row.rawRow,
      transformed_row_json: row.transformedRow
    }))
  );

  if (rowResult.error) {
    throw new Error(rowResult.error.message);
  }

  const issueRows = parsedRows.flatMap((row) =>
    row.issues.map((issue) => ({
      organization_id: organizationId,
      mapping_import_run_id: mappingImportRunId,
      mapping_import_row_id: row.mappingImportRowId,
      import_batch_id: importBatchId,
      source_row_number: row.sourceRowNumber,
      source_column_name: issue.sourceColumnName ?? null,
      target_field_name: issue.targetFieldName ?? null,
      raw_value: issue.rawValue ?? null,
      transformed_value: issue.transformedValue ?? null,
      issue_type: issue.issueCode,
      issue_severity: issue.issueSeverity,
      issue_message: issue.issueMessage,
      suggested_fix: getSuggestedFix(issue.issueCode)
    }))
  );

  if (issueRows.length > 0) {
    const issueResult = await adminClient.from("mapping_import_issues").insert(issueRows);

    if (issueResult.error) {
      throw new Error(issueResult.error.message);
    }
  }

  await adminClient
    .from("import_batches")
    .update({
      batch_status: "previewed",
      rows_processed: summary.rowCount,
      rows_accepted: summary.rowsAccepted,
      rows_rejected: summary.rowsRejected,
      warning_count: summary.rowsWithWarnings,
      error_count: summary.rowsRejected + summary.conflictingRows,
      is_active_for_reporting: false,
      reporting_status: "excluded",
      updated_by: userId,
      metadata: {
        ...(batch.metadata ?? {}),
        latest_mapping_import_run_id: mappingImportRunId,
        mapping_preview_only: true
      }
    })
    .eq("organization_id", organizationId)
    .eq("import_batch_id", importBatchId);

  await insertAuditLog({
    actionType: "mapping_import_preview_generated",
    adminClient,
    entityId: mappingImportRunId,
    metadata: {
      import_batch_id: importBatchId,
      mapping_type: importTypeCode,
      rows_accepted: summary.rowsAccepted,
      rows_rejected: summary.rowsRejected
    },
    organizationId,
    userId
  });

  return {
    mappingImportRunId,
    summary
  };
}

export async function commitMappingImport({
  adminClient,
  changeDescription,
  defaultEffectiveStartDate,
  importBatchId,
  mappingImportRunId,
  organizationId,
  userId
}: {
  adminClient: SupabaseClient;
  changeDescription: string;
  defaultEffectiveStartDate: string;
  importBatchId: string;
  mappingImportRunId: string;
  organizationId: string;
  userId: string;
}) {
  const runResult = await adminClient
    .from("mapping_import_runs")
    .select(
      "mapping_import_run_id, import_batch_id, source_file_id, import_template_version_id, mapping_type, target_table, run_status, rows_accepted"
    )
    .eq("organization_id", organizationId)
    .eq("import_batch_id", importBatchId)
    .eq("mapping_import_run_id", mappingImportRunId)
    .maybeSingle<{
      mapping_import_run_id: string;
      import_batch_id: string;
      source_file_id: string;
      import_template_version_id: string;
      mapping_type: SupportedMappingImportType;
      target_table: MappingConfig["targetTable"];
      run_status: string;
      rows_accepted: number;
    }>();

  if (runResult.error || !runResult.data) {
    throw new Error(runResult.error?.message ?? "Mapping import preview was not found.");
  }

  const run = runResult.data;

  if (run.run_status !== "previewed") {
    throw new Error("Only a previewed mapping import can be committed.");
  }

  const config = mappingConfigs[run.mapping_type];
  const rowsResult = await adminClient
    .from("mapping_import_rows")
    .select("mapping_import_row_id, mapping_code, row_status, effective_start_date, incoming_row_json")
    .eq("organization_id", organizationId)
    .eq("mapping_import_run_id", mappingImportRunId)
    .eq("accepted_for_commit", true)
    .returns<
      Array<{
        mapping_import_row_id: string;
        mapping_code: string;
        row_status: "new" | "changed" | "unchanged" | "warning";
        effective_start_date: string | null;
        incoming_row_json: Record<string, string | null>;
      }>
    >();

  if (rowsResult.error) {
    throw new Error(rowsResult.error.message);
  }

  const rowsToCommit = (rowsResult.data ?? []).filter(
    (row) => row.row_status !== "unchanged"
  );

  if (rowsToCommit.length === 0) {
    throw new Error("No new or changed mapping rows are available to commit.");
  }

  if (rowsToCommit.some((row) => !row.effective_start_date) && !defaultEffectiveStartDate) {
    throw new Error("A default effective start date is required before committing rows without source effective dates.");
  }

  const nextVersion = await getNextMappingVersion({
    adminClient,
    mappingScope: config.mappingScope,
    organizationId
  });
  const mappingVersionResult = await adminClient
    .from("mapping_versions")
    .insert({
      organization_id: organizationId,
      mapping_scope: config.mappingScope,
      mapping_version: nextVersion,
      version_name: `${formatMappingType(run.mapping_type)} Import ${nextVersion}`,
      effective_start_date: defaultEffectiveStartDate || null,
      active_status: "active",
      import_batch_id: importBatchId,
      source_file_id: run.source_file_id,
      import_template_version_id: run.import_template_version_id,
      change_description: changeDescription || "Imported mapping rows",
      created_by: userId,
      updated_by: userId
    })
    .select("mapping_version_id")
    .single<{ mapping_version_id: string }>();

  if (mappingVersionResult.error) {
    throw new Error(mappingVersionResult.error.message);
  }

  const mappingVersionId = mappingVersionResult.data.mapping_version_id;
  const committedRows = rowsToCommit.map((row) => {
    const effectiveStartDate = row.effective_start_date ?? defaultEffectiveStartDate;
    const insertRow: Record<string, unknown> = {
      active_status: row.incoming_row_json.active_status || "active",
      change_reason: changeDescription || "Imported mapping row",
      created_by: userId,
      effective_end_date: row.incoming_row_json.effective_end_date || null,
      effective_start_date: effectiveStartDate,
      import_template_version_id: run.import_template_version_id,
      mapping_version: nextVersion,
      mapping_version_id: mappingVersionId,
      organization_id: organizationId,
      source_file_id: run.source_file_id,
      source_import_batch_id: importBatchId,
      source_method: "import",
      updated_by: userId
    };

    for (const [targetField, tableField] of Object.entries(config.tableFields)) {
      if (tableField.startsWith("metadata_")) {
        continue;
      }

      insertRow[tableField] = row.incoming_row_json[targetField] || null;
    }

    return insertRow;
  });

  const commitResult = await adminClient.from(config.targetTable).insert(committedRows);

  if (commitResult.error) {
    throw new Error(commitResult.error.message);
  }

  await adminClient
    .from("mapping_import_runs")
    .update({
      committed_at: new Date().toISOString(),
      committed_by: userId,
      default_effective_start_date: defaultEffectiveStartDate || null,
      mapping_version_id: mappingVersionId,
      run_status: "committed",
      metadata: {
        committed_row_count: committedRows.length,
        rejected_rows_excluded: true
      }
    })
    .eq("organization_id", organizationId)
    .eq("mapping_import_run_id", mappingImportRunId);

  await adminClient
    .from("import_batches")
    .update({
      batch_status: "mapping_imported",
      is_active_for_reporting: false,
      reporting_status: "excluded",
      updated_by: userId,
      metadata: {
        latest_mapping_import_run_id: mappingImportRunId,
        mapping_version_id: mappingVersionId,
        mapping_rows_committed: committedRows.length
      }
    })
    .eq("organization_id", organizationId)
    .eq("import_batch_id", importBatchId);

  await insertAuditLog({
    actionType: "mapping_import_committed",
    adminClient,
    entityId: mappingImportRunId,
    metadata: {
      import_batch_id: importBatchId,
      mapping_type: run.mapping_type,
      mapping_version_id: mappingVersionId,
      rows_committed: committedRows.length
    },
    organizationId,
    userId
  });

  return {
    mappingVersionId,
    rowsCommitted: committedRows.length
  };
}

async function loadMappingContext({
  adminClient,
  importBatchId,
  organizationId
}: {
  adminClient: SupabaseClient;
  importBatchId: string;
  organizationId: string;
}) {
  const batch = await loadImportBatch({ adminClient, importBatchId, organizationId });

  if (!batch.source_file_id) {
    throw new Error("This import batch does not have a source file.");
  }

  if (!batch.template_version_id) {
    throw new Error("Select or create a mapping template before previewing this import.");
  }

  const importType = await loadImportType({
    adminClient,
    importTypeId: batch.import_type_id,
    organizationId
  });

  if (!isSupportedMappingImportType(importType.import_type_code)) {
    throw new Error("Mapping import review is only available for supported mapping import types.");
  }

  const [sourceFile, templateVersion] = await Promise.all([
    loadSourceFile({ adminClient, organizationId, sourceFileId: batch.source_file_id }),
    loadTemplateVersion({
      adminClient,
      organizationId,
      templateVersionId: batch.template_version_id
    })
  ]);
  const template = await loadTemplate({
    adminClient,
    organizationId,
    templateId: templateVersion.import_template_id
  });

  return {
    batch,
    config: mappingConfigs[importType.import_type_code],
    importType,
    sourceFile,
    template,
    templateVersion
  };
}

function buildMappingRows({
  config,
  dataRows,
  dataStartRowIndex,
  existingRows,
  fieldMappings,
  headerValues,
  importTypeCode,
  rules
}: {
  config: MappingConfig;
  dataRows: string[][];
  dataStartRowIndex: number;
  existingRows: Map<string, ExistingMappingRow>;
  fieldMappings: FieldMappingRecord[];
  headerValues: string[];
  importTypeCode: SupportedMappingImportType;
  rules: Set<string>;
}) {
  const rows: MappingRowDraft[] = [];
  const requiredFields = getRequiredTargetFieldNames(importTypeCode);
  const seenCodes = new Map<string, number>();

  for (const [index, row] of dataRows.entries()) {
    if (rows.length >= MAX_MAPPING_PREVIEW_ROWS) {
      break;
    }

    const rowValues = row.map(stringifyValue);

    if (rules.has("remove_blank_rows") && isBlankPreviewRow(rowValues)) {
      continue;
    }

    if (
      rules.has("ignore_repeated_header_rows") &&
      looksLikeRepeatedHeader({ headerValues, rowValues })
    ) {
      continue;
    }

    const rawRow = Object.fromEntries(
      rowValues.map((value, columnIndex) => [
        headerValues[columnIndex] || `Column ${columnIndex + 1}`,
        value
      ])
    );
    const transformedRow: Record<string, string | null> = {};
    const issues: PreviewIssueDraft[] = [];

    for (const mapping of fieldMappings) {
      const columnIndex =
        mapping.source_column_index ??
        headerValues.findIndex((header) => header === mapping.source_field_name);
      const rawValue =
        columnIndex >= 0 ? rowValues[columnIndex] ?? "" : mapping.default_value ?? "";
      const transformedValue = applyCellTransformations({
        rules,
        targetFieldName: mapping.target_field_name,
        value: rawValue
      });

      transformedRow[mapping.target_field_name] = transformedValue || null;
    }

    for (const requiredField of requiredFields) {
      if (!transformedRow[requiredField]) {
        issues.push({
          issueCode: "missing_required_field",
          issueMessage: `${requiredField} is required for this mapping import.`,
          issueSeverity: "error",
          targetFieldName: requiredField
        });
      }
    }

    const code = transformedRow[config.codeField] ?? null;
    const codeCount = code ? (seenCodes.get(code) ?? 0) + 1 : 0;

    if (code) {
      seenCodes.set(code, codeCount);

      if (codeCount > 1) {
        issues.push({
          issueCode: "duplicate_mapping_code",
          issueMessage: `${code} appears more than once in this import.`,
          issueSeverity: "error",
          targetFieldName: config.codeField,
          transformedValue: code
        });
      }
    }

    const activeStatus = normalizeActiveStatus(transformedRow.active_status);

    if (!activeStatus.ok) {
      issues.push({
        issueCode: "invalid_active_status",
        issueMessage: "Active status must be active or inactive.",
        issueSeverity: "error",
        targetFieldName: "active_status",
        transformedValue: transformedRow.active_status ?? ""
      });
    }

    const effectiveStartDate = parseDateField(transformedRow.effective_start_date);
    const effectiveEndDate = parseDateField(transformedRow.effective_end_date);

    if (effectiveStartDate.invalid) {
      issues.push(dateIssue("effective_start_date", transformedRow.effective_start_date));
    }

    if (effectiveEndDate.invalid) {
      issues.push(dateIssue("effective_end_date", transformedRow.effective_end_date));
    }

    const currentRow = code ? existingRows.get(code) ?? null : null;
    const incomingRow = buildIncomingRow({ config, transformedRow });
    const changedFields = currentRow
      ? getChangedFields({ config, currentRow, incomingRow })
      : {};
    const status = classifyRow({
      changedFields,
      currentRow,
      hasDuplicate: codeCount > 1,
      hasErrors: issues.some((issue) => issue.issueSeverity === "error")
    });

    rows.push({
      acceptedForCommit: status === "new" || status === "changed" || status === "warning",
      activeStatus: activeStatus.value,
      changedFields,
      currentRow,
      effectiveEndDate: effectiveEndDate.value,
      effectiveStartDate: effectiveStartDate.value,
      incomingRow,
      issues,
      mappingCode: code,
      mappingImportRowId: randomUUID(),
      mappingName: transformedRow[config.nameField] ?? null,
      rawRow,
      rowStatus: status,
      sourceRowNumber: dataStartRowIndex + index + 1,
      transformedRow
    });
  }

  return rows;
}

function buildIncomingRow({
  config,
  transformedRow
}: {
  config: MappingConfig;
  transformedRow: Record<string, string | null>;
}) {
  const incomingRow: Record<string, string | null> = {};

  for (const [targetField, tableField] of Object.entries(config.tableFields)) {
    if (tableField.startsWith("metadata_")) {
      incomingRow[targetField] = transformedRow[targetField] ?? null;
    } else {
      incomingRow[targetField] = transformedRow[targetField] ?? null;
    }
  }

  incomingRow.active_status = normalizeActiveStatus(transformedRow.active_status).value;
  incomingRow.effective_start_date = parseDateField(transformedRow.effective_start_date).value;
  incomingRow.effective_end_date = parseDateField(transformedRow.effective_end_date).value;

  return incomingRow;
}

function classifyRow({
  changedFields,
  currentRow,
  hasDuplicate,
  hasErrors
}: {
  changedFields: Record<string, { current: unknown; incoming: unknown }>;
  currentRow: ExistingMappingRow | null;
  hasDuplicate: boolean;
  hasErrors: boolean;
}): MappingRowDraft["rowStatus"] {
  if (hasDuplicate) {
    return "duplicate";
  }

  if (hasErrors) {
    return "rejected";
  }

  if (!currentRow) {
    return "new";
  }

  if (Object.keys(changedFields).length > 0) {
    return "changed";
  }

  return "unchanged";
}

function getChangedFields({
  config,
  currentRow,
  incomingRow
}: {
  config: MappingConfig;
  currentRow: ExistingMappingRow;
  incomingRow: Record<string, string | null>;
}) {
  const changedFields: Record<string, { current: unknown; incoming: unknown }> = {};

  for (const [targetField, tableField] of Object.entries(config.tableFields)) {
    if (tableField.startsWith("metadata_") || targetField.startsWith("effective_")) {
      continue;
    }

    const current = normalizeComparable(currentRow[tableField]);
    const incoming = normalizeComparable(incomingRow[targetField]);

    if (current !== incoming) {
      changedFields[targetField] = {
        current: currentRow[tableField],
        incoming: incomingRow[targetField]
      };
    }
  }

  return changedFields;
}

function summarizeRows(rows: MappingRowDraft[], rowCount: number) {
  return {
    changedMappings: countRows(rows, "changed"),
    conflictingRows: countRows(rows, "conflict"),
    duplicateRows: countRows(rows, "duplicate"),
    newMappings: countRows(rows, "new"),
    rowCount,
    rowsAccepted: rows.filter((row) => row.acceptedForCommit).length,
    rowsRejected: rows.filter((row) => !row.acceptedForCommit && row.rowStatus !== "unchanged").length,
    rowsWithWarnings: rows.filter((row) =>
      row.issues.some((issue) => issue.issueSeverity === "warning")
    ).length,
    unchangedMappings: countRows(rows, "unchanged")
  };
}

function countRows(rows: MappingRowDraft[], status: MappingRowDraft["rowStatus"]) {
  return rows.filter((row) => row.rowStatus === status).length;
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
    .select("import_batch_id, import_type_id, source_file_id, import_template_id, template_version_id, metadata")
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

async function loadSourceFile({
  adminClient,
  organizationId,
  sourceFileId
}: {
  adminClient: SupabaseClient;
  organizationId: string;
  sourceFileId: string;
}) {
  const result = await adminClient
    .from("source_files")
    .select("source_file_id, storage_bucket, storage_path, original_file_name")
    .eq("organization_id", organizationId)
    .eq("source_file_id", sourceFileId)
    .maybeSingle<SourceFileForParsing>();

  if (result.error || !result.data) {
    throw new Error(result.error?.message ?? "Source file was not found.");
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
    .select("template_version_id, import_template_id, version_number")
    .eq("organization_id", organizationId)
    .eq("template_version_id", templateVersionId)
    .maybeSingle<TemplateVersionRecord>();

  if (result.error || !result.data) {
    throw new Error(result.error?.message ?? "Template version was not found.");
  }

  return result.data;
}

async function loadTemplate({
  adminClient,
  organizationId,
  templateId
}: {
  adminClient: SupabaseClient;
  organizationId: string;
  templateId: string;
}) {
  const result = await adminClient
    .from("import_templates")
    .select("template_name")
    .eq("organization_id", organizationId)
    .eq("import_template_id", templateId)
    .maybeSingle<TemplateRecord>();

  if (result.error || !result.data) {
    throw new Error(result.error?.message ?? "Template was not found.");
  }

  return result.data;
}

async function loadSingleSheetMapping({
  adminClient,
  importTypeCode,
  organizationId,
  templateVersionId
}: {
  adminClient: SupabaseClient;
  importTypeCode: SupportedMappingImportType;
  organizationId: string;
  templateVersionId: string;
}) {
  const result = await adminClient
    .from("sheet_mappings")
    .select("sheet_mapping_id, sheet_name, sheet_index, header_row_number, data_start_row_number, target_entity")
    .eq("organization_id", organizationId)
    .eq("template_version_id", templateVersionId)
    .eq("active_status", "active")
    .eq("ignore_sheet", false)
    .order("sheet_index", { ascending: true })
    .returns<SheetMappingRecord[]>();

  if (result.error) {
    throw new Error(result.error.message);
  }

  const sheets = result.data ?? [];
  const matchingSheets = sheets.filter((sheet) => sheet.target_entity === importTypeCode);
  const candidates = matchingSheets.length > 0 ? matchingSheets : sheets;

  if (candidates.length !== 1) {
    throw new Error("Mapping import templates must have exactly one active selected sheet for one mapping type.");
  }

  return candidates[0];
}

async function loadFieldMappings({
  adminClient,
  organizationId,
  sheetMappingId,
  templateVersionId
}: {
  adminClient: SupabaseClient;
  organizationId: string;
  sheetMappingId: string;
  templateVersionId: string;
}) {
  const result = await adminClient
    .from("field_mappings")
    .select("source_field_name, source_column_index, target_field_name, default_value")
    .eq("organization_id", organizationId)
    .eq("template_version_id", templateVersionId)
    .eq("sheet_mapping_id", sheetMappingId)
    .eq("active_status", "active")
    .eq("ignore_column", false)
    .returns<FieldMappingRecord[]>();

  if (result.error) {
    throw new Error(result.error.message);
  }

  return result.data ?? [];
}

async function loadTransformationRules({
  adminClient,
  organizationId,
  templateVersionId
}: {
  adminClient: SupabaseClient;
  organizationId: string;
  templateVersionId: string;
}) {
  const result = await adminClient
    .from("transformation_rules")
    .select("rule_name")
    .eq("organization_id", organizationId)
    .eq("template_version_id", templateVersionId)
    .eq("active_status", "active")
    .order("rule_order", { ascending: true })
    .returns<Array<{ rule_name: string }>>();

  if (result.error) {
    throw new Error(result.error.message);
  }

  return (result.data ?? []).map((rule) => rule.rule_name);
}

async function loadExistingMappings({
  adminClient,
  config,
  organizationId
}: {
  adminClient: SupabaseClient;
  config: MappingConfig;
  organizationId: string;
}) {
  const fields = Array.from(
    new Set([
      config.tableIdField,
      ...Object.values(config.tableFields).filter((field) => !field.startsWith("metadata_")),
      "mapping_version"
    ])
  ).join(", ");
  const result = await adminClient
    .from(config.targetTable)
    .select(fields)
    .eq("organization_id", organizationId)
    .eq("active_status", "active")
    .order("mapping_version", { ascending: false })
    .returns<ExistingMappingRow[]>();

  if (result.error) {
    throw new Error(result.error.message);
  }

  const rowsByCode = new Map<string, ExistingMappingRow>();

  for (const row of result.data ?? []) {
    const code = String(row[config.tableFields[config.codeField]] ?? "");
    if (code && !rowsByCode.has(code)) {
      rowsByCode.set(code, row);
    }
  }

  return rowsByCode;
}

async function getNextMappingVersion({
  adminClient,
  mappingScope,
  organizationId
}: {
  adminClient: SupabaseClient;
  mappingScope: MappingConfig["mappingScope"];
  organizationId: string;
}) {
  const result = await adminClient
    .from("mapping_versions")
    .select("mapping_version")
    .eq("organization_id", organizationId)
    .eq("mapping_scope", mappingScope)
    .order("mapping_version", { ascending: false })
    .limit(1)
    .maybeSingle<{ mapping_version: number }>();

  if (result.error) {
    throw new Error(result.error.message);
  }

  return (result.data?.mapping_version ?? 0) + 1;
}

async function insertAuditLog({
  actionType,
  adminClient,
  entityId,
  metadata,
  organizationId,
  userId
}: {
  actionType: string;
  adminClient: SupabaseClient;
  entityId: string;
  metadata: Record<string, unknown>;
  organizationId: string;
  userId: string;
}) {
  await adminClient.from("audit_logs").insert({
    action_type: actionType,
    actor_user_id: userId,
    entity_id: entityId,
    entity_table: "mapping_import_runs",
    metadata,
    organization_id: organizationId
  });
}

function normalizeActiveStatus(value: string | null | undefined) {
  const normalized = (value ?? "active").trim().toLowerCase();

  if (!normalized) {
    return { ok: true, value: "active" };
  }

  if (["active", "inactive"].includes(normalized)) {
    return { ok: true, value: normalized };
  }

  return { ok: false, value: normalized };
}

function parseDateField(value: string | null | undefined) {
  const trimmed = (value ?? "").trim();

  if (!trimmed) {
    return { invalid: false, value: null };
  }

  const parsed = new Date(trimmed);

  if (Number.isNaN(parsed.getTime())) {
    return { invalid: true, value: null };
  }

  return { invalid: false, value: parsed.toISOString().slice(0, 10) };
}

function dateIssue(targetFieldName: string, rawValue: string | null | undefined): PreviewIssueDraft {
  return {
    issueCode: "invalid_effective_date",
    issueMessage: `${targetFieldName} must be a valid date.`,
    issueSeverity: "error",
    rawValue: rawValue ?? "",
    targetFieldName,
    transformedValue: rawValue ?? ""
  };
}

function normalizeComparable(value: unknown) {
  return String(value ?? "").trim();
}

function getSuggestedFix(issueCode: string) {
  if (issueCode === "missing_required_field") {
    return "Add the required value to the source file and reupload.";
  }

  if (issueCode === "duplicate_mapping_code") {
    return "Keep one row per mapping code in this import file or selected sheet.";
  }

  if (issueCode === "invalid_effective_date") {
    return "Use a valid date such as YYYY-MM-DD.";
  }

  if (issueCode === "invalid_active_status") {
    return "Use active or inactive.";
  }

  return "Fix the source file and reupload, or use a future manual mapping maintenance workflow.";
}

function formatMappingType(importTypeCode: SupportedMappingImportType) {
  return importTypeCode
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}
