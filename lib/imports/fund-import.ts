import "server-only";

import * as XLSX from "xlsx";
import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  FundImportIssue,
  FundImportOptions,
  FundImportPreviewRow
} from "@/lib/imports/fund-import-state";

const allowedReportingModels = new Set([
  "governmental",
  "proprietary",
  "fiduciary",
  "component_unit",
  "other"
]);
const allowedActiveStatuses = new Set(["active", "inactive"]);
const allowedReportingTreatments = new Set([
  "reportable",
  "pooled_cash",
  "reconciliation_only",
  "clearing",
  "elimination",
  "internal_service",
  "fiduciary_excluded",
  "other_excluded"
]);

export type FundImportMapping = {
  activeStatusColumn: string;
  changeReasonColumn: string;
  effectiveEndDateColumn: string;
  effectiveStartDateColumn: string;
  fundCodeColumn: string;
  fundGroupColumn: string;
  fundNameColumn: string;
  fundTypeColumn: string;
  includeInCashReconciliationColumn: string;
  includeInStandardReportingColumn: string;
  majorFundFlagColumn: string;
  reportingExclusionReasonColumn: string;
  reportingModelColumn: string;
  reportingTreatmentColumn: string;
};

type ExistingFund = {
  active_status: string;
  change_reason: string | null;
  effective_end_date: string | null;
  effective_start_date: string | null;
  fund_code: string;
  fund_group: string | null;
  fund_id: string;
  fund_name: string;
  fund_type: string | null;
  include_in_cash_reconciliation: boolean | null;
  include_in_standard_reporting: boolean | null;
  major_fund_flag: string | null;
  reporting_exclusion_reason: string | null;
  reporting_model: string | null;
  reporting_treatment: string | null;
};

type ParsedSheet = {
  rows: string[][];
  selectedSheetName: string;
  sheetNames: string[];
};

export async function buildFundImportPreview({
  adminClient,
  file,
  headerRow,
  mapping,
  options,
  organizationId,
  sheetReference
}: {
  adminClient: SupabaseClient;
  file: File;
  headerRow: number;
  mapping: FundImportMapping;
  options: FundImportOptions;
  organizationId: string;
  sheetReference: string;
}) {
  const parsedSheet = await parseWorkbookFile({ file, sheetReference });
  const headerIndex = Math.max(headerRow, 1) - 1;
  const headers = (parsedSheet.rows[headerIndex] ?? []).map(normalizeCell);
  const dataRows = parsedSheet.rows.slice(headerIndex + 1);
  const resolvedColumns = resolveFundColumns({ headers, mapping });
  const existingFunds = await loadExistingFunds({
    adminClient,
    organizationId
  });
  const existingByCode = new Map(
    existingFunds.map((fund) => [fund.fund_code, fund])
  );
  const seenCodes = new Map<string, number>();
  const rows: FundImportPreviewRow[] = [];
  const issues: FundImportIssue[] = [];

  for (const [index, row] of dataRows.entries()) {
    const sourceRowNumber = headerIndex + index + 2;

    if (row.every((cell) => !normalizeCell(cell))) {
      continue;
    }

    const rowDraft = buildRowDraft({
      resolvedColumns,
      row,
      sourceRowNumber
    });
    const rowIssues = validateRow({
      existingFund: existingByCode.get(rowDraft.fundCode),
      options,
      row: rowDraft,
      seenCodes
    });
    const issueMessage = rowIssues.map((issue) => issue.issueMessage).join(" ");
    rowDraft.issueMessage = issueMessage;

    if (rowIssues.some((issue) => issue.issueSeverity === "error")) {
      rowDraft.rowStatus = rowIssues.some(
        (issue) => issue.issueType === "duplicate_fund_code"
      )
        ? "duplicate"
        : "rejected";
    } else {
      rowDraft.rowStatus = classifyRow({
        existingFund: existingByCode.get(rowDraft.fundCode),
        options,
        row: rowDraft
      });
    }

    issues.push(...rowIssues);
    rows.push(rowDraft);
  }

  return {
    issues,
    rows,
    selectedSheetName: parsedSheet.selectedSheetName,
    sheetNames: parsedSheet.sheetNames,
    summary: summarizePreviewRows(rows)
  };
}

export async function commitFundImportRows({
  adminClient,
  changeDescription,
  organizationId,
  options,
  rows,
  userId
}: {
  adminClient: SupabaseClient;
  changeDescription: string;
  organizationId: string;
  options: FundImportOptions;
  rows: FundImportPreviewRow[];
  userId: string;
}) {
  const rowsForCommit = rows.filter(
    (row) =>
      !row.excluded &&
      row.rowStatus !== "deleted" &&
      row.rowStatus !== "rejected" &&
      row.rowStatus !== "duplicate" &&
      row.rowStatus !== "conflict"
  );
  const existingFunds = await loadExistingFunds({
    adminClient,
    organizationId
  });
  const existingByCode = new Map(
    existingFunds.map((fund) => [fund.fund_code, fund])
  );
  const seenCodes = new Set<string>();
  const insertRows: Record<string, unknown>[] = [];
  const updateRows: Array<{
    fundId: string;
    mode: "update" | "fill";
    values: Record<string, unknown>;
  }> = [];
  let rejected = 0;
  let skipped = 0;
  const deletedFromPreview = rows.filter(
    (row) => row.excluded || row.rowStatus === "deleted"
  ).length;

  for (const row of rowsForCommit) {
    const issues = validateRowForCommit({ row, seenCodes });

    if (issues.length > 0) {
      rejected += 1;
      continue;
    }

    const existing = existingByCode.get(row.fundCode);

    if (!existing) {
      insertRows.push(toFundMutationValues({ row, userId }));
      continue;
    }

    if (options.updateExisting) {
      const values = buildUpdateValues({
        existing,
        mode: "update",
        row,
        userId
      });

      if (Object.keys(values).length > 0) {
        updateRows.push({
          fundId: existing.fund_id,
          mode: "update",
          values
        });
      } else {
        skipped += 1;
      }
      continue;
    }

    if (options.fillMissingData) {
      const values = buildUpdateValues({
        existing,
        mode: "fill",
        row,
        userId
      });

      if (Object.keys(values).length > 0) {
        updateRows.push({
          fundId: existing.fund_id,
          mode: "fill",
          values
        });
      } else {
        skipped += 1;
      }
      continue;
    }

    skipped += 1;
  }

  if (insertRows.length === 0 && updateRows.length === 0) {
    return {
      deletedFromPreview,
      filledMissing: 0,
      inserted: 0,
      mappingVersion: null,
      rejected,
      skipped,
      updated: 0
    };
  }

  const nextVersion = await getNextFundMappingVersion({
    adminClient,
    organizationId
  });
  const mappingVersionResult = await adminClient
    .from("mapping_versions")
    .insert({
      active_status: "active",
      change_description: changeDescription || "Fund import from /imports/funds",
      created_by: userId,
      effective_start_date: null,
      mapping_scope: "fund",
      mapping_version: nextVersion,
      organization_id: organizationId,
      updated_by: userId,
      version_name: `Fund Import ${nextVersion}`
    })
    .select("mapping_version_id")
    .single<{ mapping_version_id: string }>();

  if (mappingVersionResult.error) {
    throw new Error(mappingVersionResult.error.message);
  }

  const mappingVersionId = mappingVersionResult.data.mapping_version_id;
  const versionFields = {
    change_reason: changeDescription || "Fund import from /imports/funds",
    mapping_version: nextVersion,
    mapping_version_id: mappingVersionId,
    source_method: "import",
    updated_by: userId
  };

  if (insertRows.length > 0) {
    const insertResult = await adminClient.from("funds").insert(
      insertRows.map((row) => ({
        ...row,
        ...versionFields,
        created_by: userId,
        organization_id: organizationId
      }))
    );

    if (insertResult.error) {
      throw new Error(insertResult.error.message);
    }
  }

  for (const updateRow of updateRows) {
    const updateResult = await adminClient
      .from("funds")
      .update({
        ...updateRow.values,
        ...versionFields
      })
      .eq("organization_id", organizationId)
      .eq("fund_id", updateRow.fundId);

    if (updateResult.error) {
      throw new Error(updateResult.error.message);
    }
  }

  await writeFundImportAudit({
    adminClient,
    mappingVersionId,
    nextVersion,
    organizationId,
    result: {
      deletedFromPreview,
      filledMissing: updateRows.filter((row) => row.mode === "fill").length,
      inserted: insertRows.length,
      rejected,
      skipped,
      updated: updateRows.filter((row) => row.mode === "update").length
    },
    userId
  });

  return {
    deletedFromPreview,
    filledMissing: updateRows.filter((row) => row.mode === "fill").length,
    inserted: insertRows.length,
    mappingVersion: nextVersion,
    rejected,
    skipped,
    updated: updateRows.filter((row) => row.mode === "update").length
  };
}

function buildRowDraft({
  resolvedColumns,
  row,
  sourceRowNumber
}: {
  resolvedColumns: ReturnType<typeof resolveFundColumns>;
  row: string[];
  sourceRowNumber: number;
}): FundImportPreviewRow {
  const reportingTreatment = normalizeReportingTreatment(
    readColumn(row, resolvedColumns.reportingTreatment)
  );
  const explicitStandardReporting = normalizeBooleanText(
    readColumn(row, resolvedColumns.includeInStandardReporting)
  );
  const explicitCashReconciliation = normalizeBooleanText(
    readColumn(row, resolvedColumns.includeInCashReconciliation)
  );
  const defaults = getReportingTreatmentDefaults(reportingTreatment);

  return {
    activeStatus: normalizeActiveStatus(readColumn(row, resolvedColumns.activeStatus)),
    changeReason: readColumn(row, resolvedColumns.changeReason),
    effectiveEndDate: normalizeDate(readColumn(row, resolvedColumns.effectiveEndDate)),
    effectiveStartDate: normalizeDate(readColumn(row, resolvedColumns.effectiveStartDate)),
    fundCode: readColumn(row, resolvedColumns.fundCode),
    fundGroup: readColumn(row, resolvedColumns.fundGroup),
    fundName: readColumn(row, resolvedColumns.fundName),
    fundType: readColumn(row, resolvedColumns.fundType),
    includeInCashReconciliation:
      explicitCashReconciliation || defaults.includeInCashReconciliation,
    includeInStandardReporting:
      explicitStandardReporting || defaults.includeInStandardReporting,
    issueMessage: "",
    majorFundFlag: readColumn(row, resolvedColumns.majorFundFlag),
    reportingExclusionReason: readColumn(
      row,
      resolvedColumns.reportingExclusionReason
    ),
    reportingModel: normalizeReportingModel(readColumn(row, resolvedColumns.reportingModel)),
    reportingTreatment,
    rowStatus: "new",
    sourceRowNumber
  };
}

function validateRow({
  existingFund,
  options,
  row,
  seenCodes
}: {
  existingFund: ExistingFund | undefined;
  options: FundImportOptions;
  row: FundImportPreviewRow;
  seenCodes: Map<string, number>;
}) {
  const issues = validateFundFields(row);

  if (row.fundCode) {
    const seenCount = (seenCodes.get(row.fundCode) ?? 0) + 1;
    seenCodes.set(row.fundCode, seenCount);

    if (seenCount > 1) {
      issues.push(issue({
        issueMessage: `${row.fundCode} appears more than once in this import.`,
        issueSeverity: "error",
        issueType: "duplicate_fund_code",
        sourceRowNumber: row.sourceRowNumber,
        targetFieldName: "fund_code",
        transformedValue: row.fundCode
      }));
    }
  }

  if (existingFund && !options.updateExisting && !options.fillMissingData) {
    issues.push(issue({
      issueMessage:
        "Fund already exists and update options were not selected. This row will be skipped.",
      issueSeverity: "info",
      issueType: "existing_fund_skipped",
      sourceRowNumber: row.sourceRowNumber,
      suggestedFix:
        "Select Update existing funds or Fill missing data on existing funds if this row should change the saved fund.",
      targetFieldName: "fund_code",
      transformedValue: row.fundCode
    }));
  }

  return issues;
}

function validateFundFields(row: FundImportPreviewRow) {
  const issues: FundImportIssue[] = [];

  if (!row.fundCode) {
    issues.push(issue({
      issueMessage: "Fund code is required.",
      issueSeverity: "error",
      issueType: "missing_required_field",
      sourceRowNumber: row.sourceRowNumber,
      suggestedFix: "Map or enter a fund code.",
      targetFieldName: "fund_code"
    }));
  }

  if (!row.fundName) {
    issues.push(issue({
      issueMessage: "Fund name is required.",
      issueSeverity: "error",
      issueType: "missing_required_field",
      sourceRowNumber: row.sourceRowNumber,
      suggestedFix: "Map or enter a fund name.",
      targetFieldName: "fund_name"
    }));
  }

  if (row.activeStatus && !allowedActiveStatuses.has(row.activeStatus)) {
    issues.push(issue({
      issueMessage: "Active status must be active or inactive.",
      issueSeverity: "error",
      issueType: "invalid_active_status",
      rawValue: row.activeStatus,
      sourceRowNumber: row.sourceRowNumber,
      suggestedFix: "Use active or inactive.",
      targetFieldName: "active_status",
      transformedValue: row.activeStatus
    }));
  }

  if (row.reportingModel && !allowedReportingModels.has(row.reportingModel)) {
    issues.push(issue({
      issueMessage:
        "Reporting model must be governmental, proprietary, fiduciary, component_unit, or other.",
      issueSeverity: "error",
      issueType: "invalid_reporting_model",
      rawValue: row.reportingModel,
      sourceRowNumber: row.sourceRowNumber,
      suggestedFix: "Use one of the allowed reporting model values.",
      targetFieldName: "reporting_model",
      transformedValue: row.reportingModel
    }));
  }

  if (
    row.reportingTreatment &&
    !allowedReportingTreatments.has(row.reportingTreatment)
  ) {
    issues.push(issue({
      issueMessage:
        "Reporting treatment must be reportable, pooled_cash, reconciliation_only, clearing, elimination, internal_service, fiduciary_excluded, or other_excluded.",
      issueSeverity: "error",
      issueType: "invalid_reporting_treatment",
      rawValue: row.reportingTreatment,
      sourceRowNumber: row.sourceRowNumber,
      suggestedFix: "Use one of the allowed reporting treatment values.",
      targetFieldName: "reporting_treatment",
      transformedValue: row.reportingTreatment
    }));
  }

  if (
    row.includeInStandardReporting &&
    !["true", "false"].includes(row.includeInStandardReporting)
  ) {
    issues.push(issue({
      issueMessage: "Include in standard reporting must be yes/no or true/false.",
      issueSeverity: "error",
      issueType: "invalid_standard_reporting_flag",
      rawValue: row.includeInStandardReporting,
      sourceRowNumber: row.sourceRowNumber,
      suggestedFix: "Use yes, no, true, false, included, or excluded.",
      targetFieldName: "include_in_standard_reporting",
      transformedValue: row.includeInStandardReporting
    }));
  }

  if (
    row.includeInCashReconciliation &&
    !["true", "false"].includes(row.includeInCashReconciliation)
  ) {
    issues.push(issue({
      issueMessage: "Include in cash reconciliation must be yes/no or true/false.",
      issueSeverity: "error",
      issueType: "invalid_cash_reconciliation_flag",
      rawValue: row.includeInCashReconciliation,
      sourceRowNumber: row.sourceRowNumber,
      suggestedFix: "Use yes, no, true, false, included, or excluded.",
      targetFieldName: "include_in_cash_reconciliation",
      transformedValue: row.includeInCashReconciliation
    }));
  }

  if (
    row.includeInStandardReporting === "false" &&
    !row.reportingExclusionReason
  ) {
    issues.push(issue({
      issueMessage:
        "Fund is excluded from standard reporting without an exclusion reason.",
      issueSeverity: "warning",
      issueType: "missing_reporting_exclusion_reason",
      sourceRowNumber: row.sourceRowNumber,
      suggestedFix:
        "Add a short reason, such as pooled cash fund used for reconciliation only.",
      targetFieldName: "reporting_exclusion_reason",
      transformedValue: row.reportingExclusionReason
    }));
  }

  if (row.effectiveStartDate === "invalid") {
    issues.push(issue({
      issueMessage: "Effective start date is invalid.",
      issueSeverity: "error",
      issueType: "invalid_effective_start_date",
      sourceRowNumber: row.sourceRowNumber,
      targetFieldName: "effective_start_date"
    }));
  }

  if (row.effectiveEndDate === "invalid") {
    issues.push(issue({
      issueMessage: "Effective end date is invalid.",
      issueSeverity: "error",
      issueType: "invalid_effective_end_date",
      sourceRowNumber: row.sourceRowNumber,
      targetFieldName: "effective_end_date"
    }));
  }

  if (
    row.effectiveStartDate &&
    row.effectiveEndDate &&
    row.effectiveStartDate !== "invalid" &&
    row.effectiveEndDate !== "invalid" &&
    row.effectiveEndDate < row.effectiveStartDate
  ) {
    issues.push(issue({
      issueMessage: "Effective end date cannot be before effective start date.",
      issueSeverity: "error",
      issueType: "effective_date_conflict",
      sourceRowNumber: row.sourceRowNumber,
      targetFieldName: "effective_end_date"
    }));
  }

  return issues;
}

function validateRowForCommit({
  row,
  seenCodes
}: {
  row: FundImportPreviewRow;
  seenCodes: Set<string>;
}) {
  const issues = validateFundFields(row);

  if (row.fundCode) {
    if (seenCodes.has(row.fundCode)) {
      issues.push(issue({
        issueMessage: `${row.fundCode} appears more than once in this commit.`,
        issueSeverity: "error",
        issueType: "duplicate_fund_code",
        sourceRowNumber: row.sourceRowNumber,
        targetFieldName: "fund_code"
      }));
    }
    seenCodes.add(row.fundCode);
  }

  return issues;
}

function classifyRow({
  existingFund,
  options,
  row
}: {
  existingFund: ExistingFund | undefined;
  options: FundImportOptions;
  row: FundImportPreviewRow;
}) {
  if (!existingFund) {
    return "new";
  }

  if (options.updateExisting) {
    return hasIncomingChange({ existingFund, mode: "update", row })
      ? "changed"
      : "unchanged";
  }

  if (options.fillMissingData) {
    return hasIncomingChange({ existingFund, mode: "fill", row })
      ? "fill_missing"
      : "unchanged";
  }

  return "skipped_existing";
}

function hasIncomingChange({
  existingFund,
  mode,
  row
}: {
  existingFund: ExistingFund;
  mode: "fill" | "update";
  row: FundImportPreviewRow;
}) {
  return Object.keys(
    buildUpdateValues({
      existing: existingFund,
      mode,
      row,
      userId: ""
    })
  ).some((key) => key !== "updated_by");
}

function buildUpdateValues({
  existing,
  mode,
  row,
  userId
}: {
  existing: ExistingFund;
  mode: "fill" | "update";
  row: FundImportPreviewRow;
  userId: string;
}) {
  const values: Record<string, unknown> = {};
  const candidateValues = toFundMutationValues({ row, userId });

  for (const [field, incoming] of Object.entries(candidateValues)) {
    if (["fund_code", "created_by"].includes(field)) {
      continue;
    }

    if (incoming === null || incoming === undefined || incoming === "") {
      continue;
    }

    const current = existing[field as keyof ExistingFund];

    if (mode === "fill" && current !== null && current !== undefined && current !== "") {
      continue;
    }

    if (current !== incoming) {
      values[field] = incoming;
    }
  }

  if (Object.keys(values).length > 0 && userId) {
    values.updated_by = userId;
  }

  return values;
}

function toFundMutationValues({
  row,
  userId
}: {
  row: FundImportPreviewRow;
  userId: string;
}) {
  return {
    active_status: row.activeStatus || "active",
    change_reason: row.changeReason || null,
    created_by: userId || undefined,
    effective_end_date: row.effectiveEndDate || null,
    effective_start_date: row.effectiveStartDate || null,
    fund_code: row.fundCode,
    fund_group: row.fundGroup || null,
    fund_name: row.fundName,
    fund_type: row.fundType || null,
    include_in_cash_reconciliation:
      row.includeInCashReconciliation === "true",
    include_in_standard_reporting:
      row.includeInStandardReporting !== "false",
    major_fund_flag: row.majorFundFlag || null,
    reporting_exclusion_reason: row.reportingExclusionReason || null,
    reporting_model: row.reportingModel || null,
    reporting_treatment: row.reportingTreatment || "reportable",
    updated_by: userId || undefined
  };
}

function resolveFundColumns({
  headers,
  mapping
}: {
  headers: string[];
  mapping: FundImportMapping;
}) {
  return {
    activeStatus: resolveColumnReference(mapping.activeStatusColumn, headers),
    changeReason: resolveColumnReference(mapping.changeReasonColumn, headers),
    effectiveEndDate: resolveColumnReference(mapping.effectiveEndDateColumn, headers),
    effectiveStartDate: resolveColumnReference(mapping.effectiveStartDateColumn, headers),
    fundCode: resolveColumnReference(mapping.fundCodeColumn, headers),
    fundGroup: resolveColumnReference(mapping.fundGroupColumn, headers),
    fundName: resolveColumnReference(mapping.fundNameColumn, headers),
    fundType: resolveColumnReference(mapping.fundTypeColumn, headers),
    includeInCashReconciliation: resolveColumnReference(
      mapping.includeInCashReconciliationColumn,
      headers
    ),
    includeInStandardReporting: resolveColumnReference(
      mapping.includeInStandardReportingColumn,
      headers
    ),
    majorFundFlag: resolveColumnReference(mapping.majorFundFlagColumn, headers),
    reportingExclusionReason: resolveColumnReference(
      mapping.reportingExclusionReasonColumn,
      headers
    ),
    reportingModel: resolveColumnReference(mapping.reportingModelColumn, headers),
    reportingTreatment: resolveColumnReference(mapping.reportingTreatmentColumn, headers)
  };
}

function resolveColumnReference(reference: string, headers: string[]) {
  const value = reference.trim();

  if (!value) {
    return null;
  }

  if (/^\d+$/.test(value)) {
    return Math.max(Number.parseInt(value, 10) - 1, 0);
  }

  if (/^[a-z]+$/i.test(value)) {
    return columnLetterToIndex(value);
  }

  const normalizedReference = normalizeHeader(value);
  const headerIndex = headers.findIndex(
    (header) => normalizeHeader(header) === normalizedReference
  );

  return headerIndex >= 0 ? headerIndex : null;
}

async function parseWorkbookFile({
  file,
  sheetReference
}: {
  file: File;
  sheetReference: string;
}): Promise<ParsedSheet> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, {
    cellDates: false,
    raw: false,
    type: "buffer"
  });

  if (workbook.SheetNames.length === 0) {
    throw new Error("The selected file does not contain any sheets or rows.");
  }

  const selectedSheetName = getSelectedSheetName({
    sheetNames: workbook.SheetNames,
    sheetReference
  });
  const worksheet = workbook.Sheets[selectedSheetName];
  const rows = XLSX.utils.sheet_to_json<string[]>(worksheet, {
    blankrows: false,
    defval: "",
    header: 1,
    raw: false
  });

  return {
    rows: rows.map((row) => row.map(normalizeCell)),
    selectedSheetName,
    sheetNames: workbook.SheetNames
  };
}

function getSelectedSheetName({
  sheetNames,
  sheetReference
}: {
  sheetNames: string[];
  sheetReference: string;
}) {
  const reference = sheetReference.trim();

  if (!reference) {
    return sheetNames[0];
  }

  if (/^\d+$/.test(reference)) {
    const index = Number.parseInt(reference, 10) - 1;
    return sheetNames[index] ?? sheetNames[0];
  }

  return (
    sheetNames.find(
      (sheetName) => sheetName.toLowerCase() === reference.toLowerCase()
    ) ?? sheetNames[0]
  );
}

async function loadExistingFunds({
  adminClient,
  organizationId
}: {
  adminClient: SupabaseClient;
  organizationId: string;
}) {
  const result = await adminClient
    .from("funds")
    .select(
      "fund_id, fund_code, fund_name, fund_type, reporting_model, fund_group, major_fund_flag, reporting_treatment, include_in_standard_reporting, include_in_cash_reconciliation, reporting_exclusion_reason, active_status, effective_start_date, effective_end_date, change_reason"
    )
    .eq("organization_id", organizationId)
    .returns<ExistingFund[]>();

  if (result.error) {
    throw new Error(result.error.message);
  }

  return result.data ?? [];
}

async function getNextFundMappingVersion({
  adminClient,
  organizationId
}: {
  adminClient: SupabaseClient;
  organizationId: string;
}) {
  const result = await adminClient
    .from("mapping_versions")
    .select("mapping_version")
    .eq("organization_id", organizationId)
    .eq("mapping_scope", "fund")
    .order("mapping_version", { ascending: false })
    .limit(1)
    .maybeSingle<{ mapping_version: number }>();

  if (result.error) {
    throw new Error(result.error.message);
  }

  return (result.data?.mapping_version ?? 0) + 1;
}

async function writeFundImportAudit({
  adminClient,
  mappingVersionId,
  nextVersion,
  organizationId,
  result,
  userId
}: {
  adminClient: SupabaseClient;
  mappingVersionId: string;
  nextVersion: number;
  organizationId: string;
  result: {
    deletedFromPreview: number;
    filledMissing: number;
    inserted: number;
    rejected: number;
    skipped: number;
    updated: number;
  };
  userId: string;
}) {
  await adminClient.from("audit_logs").insert([
    {
      action_type: "mapping_version_created",
      actor_user_id: userId,
      after_payload: {
        mapping_scope: "fund",
        mapping_version: nextVersion
      },
      entity_id: mappingVersionId,
      entity_table: "mapping_versions",
      metadata: {
        route: "/imports/funds"
      },
      organization_id: organizationId
    },
    {
      action_type: "fund_import_committed",
      actor_user_id: userId,
      after_payload: result,
      entity_id: mappingVersionId,
      entity_table: "funds",
      metadata: {
        mapping_version: nextVersion,
        route: "/imports/funds"
      },
      organization_id: organizationId
    }
  ]);
}

function summarizePreviewRows(rows: FundImportPreviewRow[]) {
  return {
    changed: rows.filter((row) => row.rowStatus === "changed").length,
    duplicate: rows.filter((row) => row.rowStatus === "duplicate").length,
    fillMissing: rows.filter((row) => row.rowStatus === "fill_missing").length,
    newRows: rows.filter((row) => row.rowStatus === "new").length,
    rejected: rows.filter((row) => row.rowStatus === "rejected").length,
    skipped: rows.filter((row) => row.rowStatus === "skipped_existing").length,
    unchanged: rows.filter((row) => row.rowStatus === "unchanged").length,
    warning: rows.filter((row) => row.rowStatus === "warning").length
  };
}

function issue(issueRecord: FundImportIssue): FundImportIssue {
  return issueRecord;
}

function readColumn(row: string[], index: number | null) {
  if (index === null || index < 0) {
    return "";
  }

  return normalizeCell(row[index]);
}

function normalizeCell(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function columnLetterToIndex(value: string) {
  const normalized = value.trim().toUpperCase().replace(/[^A-Z]/g, "");

  if (!normalized) {
    return 0;
  }

  return normalized.split("").reduce((index, character) => {
    return index * 26 + character.charCodeAt(0) - 64;
  }, 0) - 1;
}

function normalizeActiveStatus(value: string) {
  const normalized = value.trim().toLowerCase();

  if (!normalized) {
    return "active";
  }

  return normalized;
}

function normalizeReportingModel(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");
}

function normalizeReportingTreatment(value: string) {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");
  if (!normalized) {
    return "reportable";
  }

  return normalized;
}

function normalizeBooleanText(value: string) {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");
  if (!normalized) {
    return "";
  }

  if (["yes", "y", "true", "1", "included", "include"].includes(normalized)) {
    return "true";
  }

  if (["no", "n", "false", "0", "excluded", "exclude"].includes(normalized)) {
    return "false";
  }

  return normalized;
}

function getReportingTreatmentDefaults(reportingTreatment: string) {
  if (reportingTreatment === "pooled_cash") {
    return {
      includeInCashReconciliation: "true",
      includeInStandardReporting: "false"
    };
  }

  if (
    [
      "reconciliation_only",
      "clearing",
      "elimination",
      "fiduciary_excluded",
      "other_excluded"
    ].includes(reportingTreatment)
  ) {
    return {
      includeInCashReconciliation: "false",
      includeInStandardReporting: "false"
    };
  }

  return {
    includeInCashReconciliation: "false",
    includeInStandardReporting: "true"
  };
}

function normalizeDate(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  const parsed = new Date(trimmed);

  if (Number.isNaN(parsed.getTime())) {
    return "invalid";
  }

  return parsed.toISOString().slice(0, 10);
}
