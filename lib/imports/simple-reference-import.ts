import "server-only";

import * as XLSX from "xlsx";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { SimpleReferenceImportConfig } from "@/lib/imports/simple-reference-import-config";
import type {
  SimpleReferenceImportIssue,
  SimpleReferenceImportOptions,
  SimpleReferencePreviewRow
} from "@/lib/imports/simple-reference-import-state";

const allowedActiveStatuses = new Set(["active", "inactive"]);

type ParsedSheet = {
  rows: string[][];
  selectedSheetName: string;
  sheetNames: string[];
};

type ExistingReferenceRow = Record<string, string | number | null>;

export async function buildSimpleReferencePreview({
  adminClient,
  config,
  file,
  headerRow,
  mapping,
  options,
  organizationId,
  sheetReference
}: {
  adminClient: SupabaseClient;
  config: SimpleReferenceImportConfig;
  file: File;
  headerRow: number;
  mapping: Record<string, string>;
  options: SimpleReferenceImportOptions;
  organizationId: string;
  sheetReference: string;
}) {
  const parsedSheet = await parseWorkbookFile({ file, sheetReference });
  const headerIndex = Math.max(headerRow, 1) - 1;
  const headers = (parsedSheet.rows[headerIndex] ?? []).map(normalizeCell);
  const dataRows = parsedSheet.rows.slice(headerIndex + 1);
  const resolvedColumns = resolveColumns({ config, headers, mapping });
  const existingRows = await loadExistingRows({
    adminClient,
    config,
    organizationId
  });
  const existingByCode = new Map(
    existingRows.map((row) => [String(row[config.codeField] ?? ""), row])
  );
  const seenCodes = new Map<string, number>();
  const rows: SimpleReferencePreviewRow[] = [];
  const issues: SimpleReferenceImportIssue[] = [];

  for (const [index, row] of dataRows.entries()) {
    const sourceRowNumber = headerIndex + index + 2;

    if (row.every((cell) => !normalizeCell(cell))) {
      continue;
    }

    const rowDraft = buildRowDraft({
      config,
      resolvedColumns,
      row,
      sourceRowNumber
    });
    const code = rowDraft.values[config.codeField] ?? "";
    const rowIssues = validateRow({
      config,
      existingRow: existingByCode.get(code),
      options,
      row: rowDraft,
      seenCodes
    });
    rowDraft.issueMessage = rowIssues.map((issue) => issue.issueMessage).join(" ");

    if (rowIssues.some((issue) => issue.issueSeverity === "error")) {
      rowDraft.rowStatus = rowIssues.some((issue) => issue.issueType === "duplicate_code")
        ? "duplicate"
        : "rejected";
    } else {
      rowDraft.rowStatus = classifyRow({
        config,
        existingRow: existingByCode.get(code),
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

export async function commitSimpleReferenceRows({
  adminClient,
  changeDescription,
  config,
  organizationId,
  options,
  rows,
  userId
}: {
  adminClient: SupabaseClient;
  changeDescription: string;
  config: SimpleReferenceImportConfig;
  organizationId: string;
  options: SimpleReferenceImportOptions;
  rows: SimpleReferencePreviewRow[];
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
  const existingRows = await loadExistingRows({
    adminClient,
    config,
    organizationId
  });
  const existingByCode = new Map(
    existingRows.map((row) => [String(row[config.codeField] ?? ""), row])
  );
  const seenCodes = new Set<string>();
  const insertRows: Record<string, unknown>[] = [];
  const updateRows: Array<{
    mode: "fill" | "update";
    rowId: string;
    values: Record<string, unknown>;
  }> = [];
  let rejected = 0;
  let skipped = 0;
  const deletedFromPreview = rows.filter(
    (row) => row.excluded || row.rowStatus === "deleted"
  ).length;

  for (const row of rowsForCommit) {
    const issues = validateRowForCommit({ config, row, seenCodes });

    if (issues.length > 0) {
      rejected += 1;
      continue;
    }

    const code = row.values[config.codeField] ?? "";
    const existing = existingByCode.get(code);

    if (!existing) {
      insertRows.push(toMutationValues({ config, row, userId }));
      continue;
    }

    if (options.updateExisting) {
      const values = buildUpdateValues({
        config,
        existing,
        mode: "update",
        row,
        userId
      });

      if (Object.keys(values).length > 0) {
        updateRows.push({
          mode: "update",
          rowId: String(existing[config.idField]),
          values
        });
      } else {
        skipped += 1;
      }
      continue;
    }

    if (options.fillMissingData) {
      const values = buildUpdateValues({
        config,
        existing,
        mode: "fill",
        row,
        userId
      });

      if (Object.keys(values).length > 0) {
        updateRows.push({
          mode: "fill",
          rowId: String(existing[config.idField]),
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

  const nextVersion = await getNextMappingVersion({
    adminClient,
    config,
    organizationId
  });
  const description =
    changeDescription || `${config.tableTitle.replace(/s$/, "")} import from /imports/${config.route}`;
  const mappingVersionResult = await adminClient
    .from("mapping_versions")
    .insert({
      active_status: "active",
      change_description: description,
      created_by: userId,
      effective_start_date: null,
      mapping_scope: config.mappingScope,
      mapping_version: nextVersion,
      organization_id: organizationId,
      updated_by: userId,
      version_name: `${config.tableTitle} Import ${nextVersion}`
    })
    .select("mapping_version_id")
    .single<{ mapping_version_id: string }>();

  if (mappingVersionResult.error) {
    throw new Error(mappingVersionResult.error.message);
  }

  const mappingVersionId = mappingVersionResult.data.mapping_version_id;
  const versionFields = {
    mapping_version: nextVersion,
    mapping_version_id: mappingVersionId,
    source_method: "import",
    updated_by: userId
  };

  if (insertRows.length > 0) {
    const insertResult = await adminClient.from(config.targetTable).insert(
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
      .from(config.targetTable)
      .update({
        ...updateRow.values,
        ...versionFields
      })
      .eq("organization_id", organizationId)
      .eq(config.idField, updateRow.rowId);

    if (updateResult.error) {
      throw new Error(updateResult.error.message);
    }
  }

  await writeSimpleReferenceAudit({
    adminClient,
    config,
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
  config,
  resolvedColumns,
  row,
  sourceRowNumber
}: {
  config: SimpleReferenceImportConfig;
  resolvedColumns: Record<string, number | null>;
  row: string[];
  sourceRowNumber: number;
}): SimpleReferencePreviewRow {
  const values = Object.fromEntries(
    config.fields.map((field) => {
      const rawValue = readColumn(row, resolvedColumns[field.key]);
      return [field.dbField, normalizeFieldValue({ field: field.dbField, value: rawValue })];
    })
  );

  return {
    issueMessage: "",
    rowStatus: "new",
    sourceRowNumber,
    values
  };
}

function validateRow({
  config,
  existingRow,
  options,
  row,
  seenCodes
}: {
  config: SimpleReferenceImportConfig;
  existingRow: ExistingReferenceRow | undefined;
  options: SimpleReferenceImportOptions;
  row: SimpleReferencePreviewRow;
  seenCodes: Map<string, number>;
}) {
  const issues = validateFields({ config, row });
  const code = row.values[config.codeField] ?? "";

  if (code) {
    const seenCount = (seenCodes.get(code) ?? 0) + 1;
    seenCodes.set(code, seenCount);

    if (seenCount > 1) {
      issues.push(issue({
        issueMessage: `${code} appears more than once in this import.`,
        issueSeverity: "error",
        issueType: "duplicate_code",
        sourceRowNumber: row.sourceRowNumber,
        targetFieldName: config.codeField,
        transformedValue: code
      }));
    }
  }

  if (existingRow && !options.updateExisting && !options.fillMissingData) {
    issues.push(issue({
      issueMessage:
        "Record already exists and update options were not selected. This row will be skipped.",
      issueSeverity: "info",
      issueType: "existing_record_skipped",
      sourceRowNumber: row.sourceRowNumber,
      suggestedFix:
        "Select update existing or fill missing data if this row should change the saved record.",
      targetFieldName: config.codeField,
      transformedValue: code
    }));
  }

  return issues;
}

function validateFields({
  config,
  row
}: {
  config: SimpleReferenceImportConfig;
  row: SimpleReferencePreviewRow;
}) {
  const issues: SimpleReferenceImportIssue[] = [];

  for (const field of config.fields.filter((item) => item.required)) {
    if (!row.values[field.dbField]) {
      issues.push(issue({
        issueMessage: `${field.label.replace(" Column", "")} is required.`,
        issueSeverity: "error",
        issueType: "missing_required_field",
        sourceRowNumber: row.sourceRowNumber,
        suggestedFix: `Map or enter a ${field.label.toLowerCase().replace(" column", "")}.`,
        targetFieldName: field.dbField
      }));
    }
  }

  if (
    row.values.active_status &&
    !allowedActiveStatuses.has(row.values.active_status)
  ) {
    issues.push(issue({
      issueMessage: "Active status must be active or inactive.",
      issueSeverity: "error",
      issueType: "invalid_active_status",
      rawValue: row.values.active_status,
      sourceRowNumber: row.sourceRowNumber,
      suggestedFix: "Use active or inactive.",
      targetFieldName: "active_status",
      transformedValue: row.values.active_status
    }));
  }

  if (row.values.effective_start_date === "invalid") {
    issues.push(issue({
      issueMessage: "Effective start date is invalid.",
      issueSeverity: "error",
      issueType: "invalid_effective_start_date",
      sourceRowNumber: row.sourceRowNumber,
      suggestedFix: "Use a valid date such as YYYY-MM-DD.",
      targetFieldName: "effective_start_date"
    }));
  }

  if (row.values.effective_end_date === "invalid") {
    issues.push(issue({
      issueMessage: "Effective end date is invalid.",
      issueSeverity: "error",
      issueType: "invalid_effective_end_date",
      sourceRowNumber: row.sourceRowNumber,
      suggestedFix: "Use a valid date such as YYYY-MM-DD.",
      targetFieldName: "effective_end_date"
    }));
  }

  if (
    row.values.effective_start_date &&
    row.values.effective_end_date &&
    row.values.effective_start_date !== "invalid" &&
    row.values.effective_end_date !== "invalid" &&
    row.values.effective_end_date < row.values.effective_start_date
  ) {
    issues.push(issue({
      issueMessage: "Effective end date cannot be before effective start date.",
      issueSeverity: "error",
      issueType: "effective_date_conflict",
      sourceRowNumber: row.sourceRowNumber,
      suggestedFix: "Use an end date on or after the start date.",
      targetFieldName: "effective_end_date"
    }));
  }

  return issues;
}

function validateRowForCommit({
  config,
  row,
  seenCodes
}: {
  config: SimpleReferenceImportConfig;
  row: SimpleReferencePreviewRow;
  seenCodes: Set<string>;
}) {
  const issues = validateFields({ config, row });
  const code = row.values[config.codeField] ?? "";

  if (code) {
    if (seenCodes.has(code)) {
      issues.push(issue({
        issueMessage: `${code} appears more than once in this commit.`,
        issueSeverity: "error",
        issueType: "duplicate_code",
        sourceRowNumber: row.sourceRowNumber,
        targetFieldName: config.codeField
      }));
    }
    seenCodes.add(code);
  }

  return issues;
}

function classifyRow({
  config,
  existingRow,
  options,
  row
}: {
  config: SimpleReferenceImportConfig;
  existingRow: ExistingReferenceRow | undefined;
  options: SimpleReferenceImportOptions;
  row: SimpleReferencePreviewRow;
}) {
  if (!existingRow) {
    return "new";
  }

  if (options.updateExisting) {
    return hasIncomingChange({ config, existingRow, mode: "update", row })
      ? "changed"
      : "unchanged";
  }

  if (options.fillMissingData) {
    return hasIncomingChange({ config, existingRow, mode: "fill", row })
      ? "fill_missing"
      : "unchanged";
  }

  return "skipped_existing";
}

function hasIncomingChange({
  config,
  existingRow,
  mode,
  row
}: {
  config: SimpleReferenceImportConfig;
  existingRow: ExistingReferenceRow;
  mode: "fill" | "update";
  row: SimpleReferencePreviewRow;
}) {
  return Object.keys(
    buildUpdateValues({
      config,
      existing: existingRow,
      mode,
      row,
      userId: ""
    })
  ).some((key) => key !== "updated_by");
}

function buildUpdateValues({
  config,
  existing,
  mode,
  row,
  userId
}: {
  config: SimpleReferenceImportConfig;
  existing: ExistingReferenceRow;
  mode: "fill" | "update";
  row: SimpleReferencePreviewRow;
  userId: string;
}) {
  const values: Record<string, unknown> = {};
  const candidateValues = toMutationValues({ config, row, userId });

  for (const [field, incoming] of Object.entries(candidateValues)) {
    if ([config.codeField, "created_by"].includes(field)) {
      continue;
    }

    if (incoming === null || incoming === undefined || incoming === "") {
      continue;
    }

    const current = existing[field];

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

function toMutationValues({
  config,
  row,
  userId
}: {
  config: SimpleReferenceImportConfig;
  row: SimpleReferencePreviewRow;
  userId: string;
}) {
  const values: Record<string, unknown> = {
    active_status: row.values.active_status || "active",
    created_by: userId || undefined,
    updated_by: userId || undefined
  };

  for (const field of config.fields) {
    values[field.dbField] = normalizeNullable(row.values[field.dbField]);
  }

  return values;
}

function resolveColumns({
  config,
  headers,
  mapping
}: {
  config: SimpleReferenceImportConfig;
  headers: string[];
  mapping: Record<string, string>;
}) {
  return Object.fromEntries(
    config.fields.map((field) => [
      field.key,
      resolveColumnReference(mapping[field.key] ?? field.defaultColumn, headers)
    ])
  );
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

async function loadExistingRows({
  adminClient,
  config,
  organizationId
}: {
  adminClient: SupabaseClient;
  config: SimpleReferenceImportConfig;
  organizationId: string;
}) {
  const selectedFields = Array.from(
    new Set([
      config.idField,
      ...config.fields.map((field) => field.dbField),
      "mapping_version"
    ])
  ).join(", ");
  const result = await adminClient
    .from(config.targetTable)
    .select(selectedFields)
    .eq("organization_id", organizationId)
    .eq("active_status", "active")
    .order("mapping_version", { ascending: false })
    .returns<ExistingReferenceRow[]>();

  if (result.error) {
    throw new Error(result.error.message);
  }

  const rowsByCode = new Map<string, ExistingReferenceRow>();

  for (const row of result.data ?? []) {
    const code = String(row[config.codeField] ?? "");
    if (code && !rowsByCode.has(code)) {
      rowsByCode.set(code, row);
    }
  }

  return [...rowsByCode.values()];
}

async function getNextMappingVersion({
  adminClient,
  config,
  organizationId
}: {
  adminClient: SupabaseClient;
  config: SimpleReferenceImportConfig;
  organizationId: string;
}) {
  const result = await adminClient
    .from("mapping_versions")
    .select("mapping_version")
    .eq("organization_id", organizationId)
    .eq("mapping_scope", config.mappingScope)
    .order("mapping_version", { ascending: false })
    .limit(1)
    .maybeSingle<{ mapping_version: number }>();

  if (result.error) {
    throw new Error(result.error.message);
  }

  return (result.data?.mapping_version ?? 0) + 1;
}

async function writeSimpleReferenceAudit({
  adminClient,
  config,
  mappingVersionId,
  nextVersion,
  organizationId,
  result,
  userId
}: {
  adminClient: SupabaseClient;
  config: SimpleReferenceImportConfig;
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
        mapping_scope: config.mappingScope,
        mapping_version: nextVersion
      },
      entity_id: mappingVersionId,
      entity_table: "mapping_versions",
      metadata: {
        route: `/imports/${config.route}`
      },
      organization_id: organizationId
    },
    {
      action_type: `${config.auditPrefix}_import_committed`,
      actor_user_id: userId,
      after_payload: result,
      entity_id: mappingVersionId,
      entity_table: config.targetTable,
      metadata: {
        mapping_version: nextVersion,
        route: `/imports/${config.route}`
      },
      organization_id: organizationId
    }
  ]);
}

function summarizePreviewRows(rows: SimpleReferencePreviewRow[]) {
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

function issue(issueRecord: SimpleReferenceImportIssue): SimpleReferenceImportIssue {
  return issueRecord;
}

function readColumn(row: string[], index: number | null) {
  if (index === null || index < 0) {
    return "";
  }

  return normalizeCell(row[index]);
}

function normalizeFieldValue({ field, value }: { field: string; value: string }) {
  if (field === "active_status") {
    return normalizeActiveStatus(value);
  }

  if (field === "effective_start_date" || field === "effective_end_date") {
    return normalizeDate(value);
  }

  return normalizeCell(value);
}

function normalizeActiveStatus(value: string) {
  const normalized = value.trim().toLowerCase();

  if (!normalized) {
    return "active";
  }

  return normalized;
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

function normalizeNullable(value: string | undefined) {
  if (value === undefined || value === "") {
    return null;
  }

  return value;
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

function columnLetterToIndex(value: string) {
  const normalized = value.trim().toUpperCase().replace(/[^A-Z]/g, "");

  if (!normalized) {
    return 0;
  }

  return normalized.split("").reduce((index, character) => {
    return index * 26 + character.charCodeAt(0) - 64;
  }, 0) - 1;
}
