import "server-only";

import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  parseAccountNumber,
  type AccountStructureConfig
} from "@/lib/imports/account-parser";
import { loadSourceFileRows, type SourceFileForParsing } from "@/lib/imports/file-parsers";
import {
  applyCellTransformations,
  isBlankPreviewRow,
  looksLikeRepeatedHeader,
  parsePreviewNumber,
  stringifyValue,
  type PreviewIssueDraft
} from "@/lib/imports/transformations";
import { getRequiredTargetFieldNames } from "@/lib/templates/target-fields";

const amountFields = [
  "beginning_balance",
  "debits",
  "credits",
  "net_change",
  "ending_balance"
] as const;

type ImportBatchRecord = {
  import_batch_id: string;
  organization_id: string;
  import_type_id: string;
  source_file_id: string | null;
  import_template_id: string | null;
  template_version_id: string | null;
  account_structure_id: string | null;
  metadata: Record<string, unknown> | null;
};

type ImportTypeRecord = {
  import_type_code: string;
  import_type_name: string;
};

type TemplateVersionRecord = {
  template_version_id: string;
  import_template_id: string;
  account_structure_id: string | null;
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
  target_field_required: boolean;
  default_value: string | null;
};

type AccountStructureRecord = {
  account_structure_id: string;
  delimiter: string | null;
  segment_count: number;
  trim_spaces: boolean;
  remove_trailing_delimiters: boolean;
  preserve_leading_zeros: boolean;
};

type AccountSegmentRecord = {
  segment_number: number;
  segment_name: string;
  segment_key: string;
};

type PreviewRowDraft = {
  preview_row_id: string;
  source_row_number: number;
  full_account_number: string | null;
  fund_code: string | null;
  acfr_code: string | null;
  department_code: string | null;
  function_code: string | null;
  object_code: string | null;
  account_name: string | null;
  beginning_balance: number | null;
  debits: number | null;
  credits: number | null;
  net_change: number | null;
  ending_balance: number | null;
  raw_row_json: Record<string, string>;
  transformed_row_json: Record<string, string | number | null>;
  has_issue: boolean;
  issues: PreviewIssueDraft[];
};

export async function generateTrialBalancePreview({
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
  const batch = await loadImportBatch({ adminClient, importBatchId, organizationId });
  const importType = await loadImportType({
    adminClient,
    importTypeId: batch.import_type_id,
    organizationId
  });

  if (importType.import_type_code !== "trial_balance") {
    throw new Error("Trial balance preview requires a trial_balance import batch.");
  }

  if (!batch.source_file_id) {
    throw new Error("This import batch does not have a source file.");
  }

  if (!batch.template_version_id) {
    throw new Error("Select or create a trial balance template before generating preview.");
  }

  const sourceFile = await loadSourceFile({
    adminClient,
    organizationId,
    sourceFileId: batch.source_file_id
  });
  const templateVersion = await loadTemplateVersion({
    adminClient,
    organizationId,
    templateVersionId: batch.template_version_id
  });
  const template = await loadTemplate({
    adminClient,
    organizationId,
    templateId: templateVersion.import_template_id
  });
  const accountStructureId =
    templateVersion.account_structure_id ?? batch.account_structure_id;

  if (!accountStructureId) {
    throw new Error("This trial balance template needs an account structure before preview can run.");
  }

  const accountStructure = await loadAccountStructure({
    accountStructureId,
    adminClient,
    organizationId
  });
  const sheetMapping = await loadTrialBalanceSheetMapping({
    adminClient,
    organizationId,
    templateVersionId: templateVersion.template_version_id
  });
  const fieldMappings = await loadFieldMappings({
    adminClient,
    organizationId,
    sheetMappingId: sheetMapping.sheet_mapping_id,
    templateVersionId: templateVersion.template_version_id
  });
  const transformationRules = await loadTransformationRules({
    adminClient,
    organizationId,
    templateVersionId: templateVersion.template_version_id
  });
  const rules = new Set(transformationRules);
  const requiredTargetFields = getRequiredTargetFieldNames("trial_balance");
  const missingRequiredFields = requiredTargetFields.filter(
    (fieldName) =>
      !fieldMappings.some((mapping) => mapping.target_field_name === fieldName)
  );

  if (missingRequiredFields.length > 0) {
    throw new Error(
      `This template is missing required trial balance mappings: ${missingRequiredFields.join(", ")}.`
    );
  }

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

  const previewRows = buildPreviewRows({
    accountStructure,
    dataRows,
    dataStartRowIndex,
    fieldMappings,
    headerValues,
    requiredTargetFields,
    rules
  });

  if (previewRows.length === 0) {
    throw new Error("No preview rows were detected after applying template rules.");
  }

  const summary = summarizePreviewRows({
    previewRows,
    rowCount: dataRows.length
  });
  const previewRunId = randomUUID();

  await adminClient
    .from("import_preview_runs")
    .update({
      preview_status: "superseded",
      superseded_at: new Date().toISOString()
    })
    .eq("organization_id", organizationId)
    .eq("import_batch_id", importBatchId)
    .eq("preview_status", "completed");

  const previewRunResult = await adminClient.from("import_preview_runs").insert({
    preview_run_id: previewRunId,
    organization_id: organizationId,
    import_batch_id: importBatchId,
    source_file_id: sourceFile.source_file_id,
    import_template_version_id: templateVersion.template_version_id,
    account_structure_id: accountStructure.account_structure_id,
    preview_status: "completed",
    row_count: summary.rowCount,
    previewed_row_count: summary.previewedRowCount,
    rows_with_preview_issues: summary.rowsWithPreviewIssues,
    total_beginning_balance: summary.totalBeginningBalance,
    total_debits: summary.totalDebits,
    total_credits: summary.totalCredits,
    total_net_change: summary.totalNetChange,
    total_ending_balance: summary.totalEndingBalance,
    created_by: userId,
    completed_at: new Date().toISOString(),
    metadata: {
      template_name: template.template_name,
      template_version: templateVersion.version_number,
      preview_only: true,
      sheet_name: sheetMapping.sheet_name
    }
  });

  if (previewRunResult.error) {
    throw new Error(previewRunResult.error.message);
  }

  const previewRowInserts = previewRows.map((row) => ({
    preview_row_id: row.preview_row_id,
    organization_id: organizationId,
    preview_run_id: previewRunId,
    import_batch_id: importBatchId,
    source_file_id: sourceFile.source_file_id,
    import_template_version_id: templateVersion.template_version_id,
    account_structure_id: accountStructure.account_structure_id,
    source_row_number: row.source_row_number,
    full_account_number: row.full_account_number,
    fund_code: row.fund_code,
    acfr_code: row.acfr_code,
    department_code: row.department_code,
    function_code: row.function_code,
    object_code: row.object_code,
    account_name: row.account_name,
    beginning_balance: row.beginning_balance,
    debits: row.debits,
    credits: row.credits,
    net_change: row.net_change,
    ending_balance: row.ending_balance,
    raw_row_json: row.raw_row_json,
    transformed_row_json: row.transformed_row_json,
    has_issue: row.has_issue
  }));

  const previewRowsResult = await adminClient
    .from("import_preview_rows")
    .insert(previewRowInserts);

  if (previewRowsResult.error) {
    throw new Error(previewRowsResult.error.message);
  }

  const issueRows = previewRows.flatMap((row) =>
    row.issues.map((issue) => ({
      organization_id: organizationId,
      preview_run_id: previewRunId,
      preview_row_id: row.preview_row_id,
      import_batch_id: importBatchId,
      source_row_number: row.source_row_number,
      issue_code: issue.issueCode,
      issue_message: issue.issueMessage,
      issue_severity: issue.issueSeverity,
      source_column_name: issue.sourceColumnName ?? null,
      target_field_name: issue.targetFieldName ?? null,
      raw_value: issue.rawValue ?? null,
      transformed_value: issue.transformedValue ?? null
    }))
  );

  if (issueRows.length > 0) {
    const issueResult = await adminClient.from("import_preview_issues").insert(issueRows);

    if (issueResult.error) {
      throw new Error(issueResult.error.message);
    }
  }

  await adminClient
    .from("import_batches")
    .update({
      batch_status: "previewed",
      rows_processed: summary.previewedRowCount,
      rows_accepted: summary.previewedRowCount - summary.rowsWithPreviewIssues,
      rows_rejected: summary.rowsWithPreviewIssues,
      warning_count: issueRows.filter((issue) => issue.issue_severity === "warning").length,
      error_count: issueRows.filter((issue) => issue.issue_severity === "error").length,
      is_active_for_reporting: false,
      reporting_status: "excluded",
      updated_by: userId,
      metadata: {
        ...(batch.metadata ?? {}),
        latest_preview_run_id: previewRunId,
        preview_only: true
      }
    })
    .eq("organization_id", organizationId)
    .eq("import_batch_id", importBatchId);

  await adminClient.from("audit_logs").insert({
    organization_id: organizationId,
    actor_user_id: userId,
    action_type: "trial_balance_preview_generated",
    entity_table: "import_preview_runs",
    entity_id: previewRunId,
    after_payload: {
      import_batch_id: importBatchId,
      previewed_row_count: summary.previewedRowCount,
      rows_with_preview_issues: summary.rowsWithPreviewIssues
    },
    metadata: {
      preview_only: true
    }
  });

  return {
    previewRunId,
    summary
  };
}

function buildPreviewRows({
  accountStructure,
  dataRows,
  dataStartRowIndex,
  fieldMappings,
  headerValues,
  requiredTargetFields,
  rules
}: {
  accountStructure: AccountStructureConfig;
  dataRows: string[][];
  dataStartRowIndex: number;
  fieldMappings: FieldMappingRecord[];
  headerValues: string[];
  requiredTargetFields: string[];
  rules: Set<string>;
}) {
  const previewRows: PreviewRowDraft[] = [];

  for (const [index, row] of dataRows.entries()) {
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

    const rawRowJson = Object.fromEntries(
      rowValues.map((value, columnIndex) => [
        headerValues[columnIndex] || `Column ${columnIndex + 1}`,
        value
      ])
    );
    const transformedRowJson: Record<string, string | number | null> = {};
    const rawValuesByTargetField: Record<string, string | undefined> = {};
    const numericParseIssueFields = new Set<string>();
    const issues: PreviewIssueDraft[] = [];

    for (const mapping of fieldMappings) {
      const columnIndex =
        mapping.source_column_index ??
        headerValues.findIndex((header) => header === mapping.source_field_name);
      const rawValue =
        columnIndex >= 0
          ? rowValues[columnIndex] ?? ""
          : mapping.default_value ?? "";
      rawValuesByTargetField[mapping.target_field_name] = rawValue;
      const transformedValue = applyCellTransformations({
        rules,
        targetFieldName: mapping.target_field_name,
        value: rawValue
      });

      if (amountFields.includes(mapping.target_field_name as (typeof amountFields)[number])) {
        const parsed = parsePreviewNumber({
          rawValue: transformedValue,
          rules,
          sourceColumnName: mapping.source_field_name,
          targetFieldName: mapping.target_field_name
        });
        transformedRowJson[mapping.target_field_name] = parsed.value;

        if (parsed.issue) {
          if (parsed.issue.issueCode === "numeric_parse_failed") {
            numericParseIssueFields.add(mapping.target_field_name);
          }
          issues.push({
            ...parsed.issue,
            rawValue
          });
        }
      } else {
        transformedRowJson[mapping.target_field_name] = transformedValue;
      }
    }

    for (const requiredTargetField of requiredTargetFields) {
      const value = transformedRowJson[requiredTargetField];
      const rawValue = rawValuesByTargetField[requiredTargetField] ?? "";
      const rawValueExists = rawValue.trim().length > 0;

      if (
        numericParseIssueFields.has(requiredTargetField) &&
        rawValueExists
      ) {
        continue;
      }

      if (value === null || value === undefined || value === "") {
        issues.push({
          issueCode: "missing_required_mapped_field",
          issueMessage: `${requiredTargetField} is missing after mapping.`,
          issueSeverity: "error",
          targetFieldName: requiredTargetField,
          rawValue: rawValueExists ? rawValue : undefined
        });
      }
    }

    const fullAccountNumber = getStringField(
      transformedRowJson.full_account_number
    );
    const accountParseResult = parseAccountNumber({
      accountNumber: fullAccountNumber,
      accountStructure
    });
    issues.push(...accountParseResult.issues);

    previewRows.push({
      preview_row_id: randomUUID(),
      source_row_number: dataStartRowIndex + index + 1,
      full_account_number: fullAccountNumber || null,
      fund_code:
        getStringField(transformedRowJson.fund_code) ||
        accountParseResult.parsedSegments.fund ||
        null,
      acfr_code:
        getStringField(transformedRowJson.acfr_code) ||
        accountParseResult.parsedSegments.acfr ||
        null,
      department_code:
        getStringField(transformedRowJson.department_code) ||
        accountParseResult.parsedSegments.department ||
        null,
      function_code:
        getStringField(transformedRowJson.function_code) ||
        accountParseResult.parsedSegments.function ||
        null,
      object_code:
        getStringField(transformedRowJson.object_code) ||
        accountParseResult.parsedSegments.object ||
        null,
      account_name: getStringField(transformedRowJson.account_name) || null,
      beginning_balance: getNumberField(transformedRowJson.beginning_balance),
      debits: getNumberField(transformedRowJson.debits),
      credits: getNumberField(transformedRowJson.credits),
      net_change: getNumberField(transformedRowJson.net_change),
      ending_balance: getNumberField(transformedRowJson.ending_balance),
      raw_row_json: rawRowJson,
      transformed_row_json: transformedRowJson,
      has_issue: issues.length > 0,
      issues
    });
  }

  return previewRows;
}

function summarizePreviewRows({
  previewRows,
  rowCount
}: {
  previewRows: PreviewRowDraft[];
  rowCount: number;
}) {
  return {
    rowCount,
    previewedRowCount: previewRows.length,
    rowsWithPreviewIssues: previewRows.filter((row) => row.has_issue).length,
    totalBeginningBalance: sumField(previewRows, "beginning_balance"),
    totalDebits: sumField(previewRows, "debits"),
    totalCredits: sumField(previewRows, "credits"),
    totalNetChange: sumField(previewRows, "net_change"),
    totalEndingBalance: sumField(previewRows, "ending_balance")
  };
}

function sumField(rows: PreviewRowDraft[], field: keyof PreviewRowDraft) {
  return rows.reduce((sum, row) => {
    const value = row[field];
    return typeof value === "number" ? sum + value : sum;
  }, 0);
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
      "import_batch_id, organization_id, import_type_id, source_file_id, import_template_id, template_version_id, account_structure_id, metadata"
    )
    .eq("organization_id", organizationId)
    .eq("import_batch_id", importBatchId)
    .maybeSingle<ImportBatchRecord>();

  if (result.error) {
    throw new Error(result.error.message);
  }

  if (!result.data) {
    throw new Error("Import batch was not found.");
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
    .select(
      "template_version_id, import_template_id, account_structure_id, version_number"
    )
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

async function loadTrialBalanceSheetMapping({
  adminClient,
  organizationId,
  templateVersionId
}: {
  adminClient: SupabaseClient;
  organizationId: string;
  templateVersionId: string;
}) {
  const result = await adminClient
    .from("sheet_mappings")
    .select(
      "sheet_mapping_id, sheet_name, sheet_index, header_row_number, data_start_row_number, target_entity"
    )
    .eq("organization_id", organizationId)
    .eq("template_version_id", templateVersionId)
    .eq("active_status", "active")
    .eq("ignore_sheet", false)
    .order("sheet_index", { ascending: true })
    .returns<SheetMappingRecord[]>();

  if (result.error) {
    throw new Error(result.error.message);
  }

  if (!result.data || result.data.length === 0) {
    throw new Error("The selected template version does not have an active trial balance sheet mapping.");
  }

  const trialBalanceSheetMappings = result.data.filter(
    (sheet) => sheet.target_entity === "trial_balance"
  );
  const candidateSheetMappings =
    trialBalanceSheetMappings.length > 0 ? trialBalanceSheetMappings : result.data;

  if (candidateSheetMappings.length > 1) {
    throw new Error("This preview supports one selected trial balance sheet at a time. Edit the template to ignore unrelated sheets or keep one trial_balance sheet active.");
  }

  return candidateSheetMappings[0];
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
    .select(
      "source_field_name, source_column_index, target_field_name, target_field_required, default_value"
    )
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

async function loadAccountStructure({
  accountStructureId,
  adminClient,
  organizationId
}: {
  accountStructureId: string;
  adminClient: SupabaseClient;
  organizationId: string;
}) {
  const [structureResult, segmentResult] = await Promise.all([
    adminClient
      .from("account_structures")
      .select(
        "account_structure_id, delimiter, segment_count, trim_spaces, remove_trailing_delimiters, preserve_leading_zeros"
      )
      .eq("organization_id", organizationId)
      .eq("account_structure_id", accountStructureId)
      .eq("active_status", "active")
      .maybeSingle<AccountStructureRecord>(),
    adminClient
      .from("account_segment_definitions")
      .select("segment_number, segment_name, segment_key")
      .eq("organization_id", organizationId)
      .eq("account_structure_id", accountStructureId)
      .eq("active_status", "active")
      .order("segment_number", { ascending: true })
      .returns<AccountSegmentRecord[]>()
  ]);

  if (structureResult.error || !structureResult.data) {
    throw new Error(
      structureResult.error?.message ??
        "This trial balance template needs an active account structure before preview can run."
    );
  }

  if (segmentResult.error) {
    throw new Error(segmentResult.error.message);
  }

  return {
    delimiter: structureResult.data.delimiter,
    segmentCount: structureResult.data.segment_count,
    trimSpaces: structureResult.data.trim_spaces,
    removeTrailingDelimiters:
      structureResult.data.remove_trailing_delimiters,
    preserveLeadingZeros: structureResult.data.preserve_leading_zeros,
    segments: (segmentResult.data ?? []).map((segment) => ({
      segmentKey: segment.segment_key,
      segmentName: segment.segment_name,
      segmentNumber: segment.segment_number
    })),
    account_structure_id: structureResult.data.account_structure_id
  };
}

function getStringField(value: unknown) {
  return typeof value === "string" ? value : "";
}

function getNumberField(value: unknown) {
  return typeof value === "number" ? value : null;
}
