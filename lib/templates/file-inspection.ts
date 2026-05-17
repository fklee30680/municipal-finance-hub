import "server-only";

import * as XLSX from "xlsx";

import { RAW_UPLOADS_BUCKET } from "@/lib/supabase/storage";
import { getFileExtension } from "@/lib/uploads/config";
import type { SupabaseClient } from "@supabase/supabase-js";

const SAMPLE_ROW_LIMIT = 15;
const MAX_COLUMN_COUNT = 60;

export type SourceColumnPreview = {
  index: number;
  name: string;
  sampleValues: string[];
};

export type SheetPreview = {
  sheetName: string;
  sheetIndex: number;
  headerRow: number;
  dataStartRow: number;
  columns: SourceColumnPreview[];
  sampleRows: string[][];
};

export type SourceFilePreview = {
  sourceFileId: string;
  fileType: "csv" | "xlsx" | "xls" | "unknown";
  originalFileName: string;
  sheets: SheetPreview[];
  warning?: string;
};

type SourceFileRecord = {
  source_file_id: string;
  storage_bucket: string;
  storage_path: string;
  original_file_name: string;
  content_type: string | null;
};

export async function inspectSourceFileForTemplate({
  adminClient,
  organizationId,
  sourceFileId
}: {
  adminClient: SupabaseClient;
  organizationId: string;
  sourceFileId: string;
}) {
  const sourceFileResult = await adminClient
    .from("source_files")
    .select(
      "source_file_id, storage_bucket, storage_path, original_file_name, content_type"
    )
    .eq("organization_id", organizationId)
    .eq("source_file_id", sourceFileId)
    .maybeSingle<SourceFileRecord>();

  if (sourceFileResult.error) {
    throw new Error(sourceFileResult.error.message);
  }

  if (!sourceFileResult.data) {
    throw new Error("Selected source file was not found.");
  }

  const sourceFile = sourceFileResult.data;
  const bucketName = sourceFile.storage_bucket || RAW_UPLOADS_BUCKET;
  const downloadResult = await adminClient.storage
    .from(bucketName)
    .download(sourceFile.storage_path);

  if (downloadResult.error) {
    throw new Error(downloadResult.error.message);
  }

  const buffer = Buffer.from(await downloadResult.data.arrayBuffer());
  const fileType = getPreviewFileType(sourceFile.original_file_name);

  if (fileType === "csv") {
    return {
      sourceFileId,
      fileType,
      originalFileName: sourceFile.original_file_name,
      sheets: [inspectCsv(buffer.toString("utf8"))]
    } satisfies SourceFilePreview;
  }

  if (fileType === "xlsx" || fileType === "xls") {
    return {
      sourceFileId,
      fileType,
      originalFileName: sourceFile.original_file_name,
      sheets: inspectWorkbook(buffer)
    } satisfies SourceFilePreview;
  }

  return {
    sourceFileId,
    fileType,
    originalFileName: sourceFile.original_file_name,
    sheets: [],
    warning: "Unsupported file type for template preview."
  } satisfies SourceFilePreview;
}

function inspectCsv(csvText: string): SheetPreview {
  const rows = XLSX.utils.sheet_to_json<string[]>(
    XLSX.read(csvText, { type: "string", raw: true }).Sheets.Sheet1,
    {
      blankrows: false,
      defval: "",
      header: 1,
      raw: false
    }
  );

  return buildSheetPreview("CSV", 0, rows);
}

function inspectWorkbook(buffer: Buffer): SheetPreview[] {
  const workbook = XLSX.read(buffer, {
    cellDates: false,
    raw: true,
    type: "buffer"
  });

  return workbook.SheetNames.map((sheetName, sheetIndex) => {
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<string[]>(worksheet, {
      blankrows: false,
      defval: "",
      header: 1,
      raw: false
    });

    return buildSheetPreview(sheetName, sheetIndex, rows);
  });
}

function buildSheetPreview(
  sheetName: string,
  sheetIndex: number,
  rows: string[][]
): SheetPreview {
  const previewRows = rows.slice(0, SAMPLE_ROW_LIMIT);
  const headerRowIndex = detectHeaderRowIndex(previewRows);
  const headerRow = previewRows[headerRowIndex] ?? [];
  const normalizedHeaders = normalizeHeaders(headerRow);
  const sampleRows = previewRows.slice(headerRowIndex + 1, headerRowIndex + 6);

  const columns = normalizedHeaders.slice(0, MAX_COLUMN_COUNT).map((name, index) => ({
    index,
    name,
    sampleValues: sampleRows
      .map((row) => stringifyCell(row[index]))
      .filter((value) => value.length > 0)
      .slice(0, 3)
  }));

  return {
    sheetName,
    sheetIndex,
    headerRow: headerRowIndex + 1,
    dataStartRow: headerRowIndex + 2,
    columns,
    sampleRows
  };
}

function detectHeaderRowIndex(rows: string[][]) {
  let bestIndex = 0;
  let bestScore = -1;

  rows.slice(0, 10).forEach((row, index) => {
    const nonBlankCount = row.filter((cell) => stringifyCell(cell)).length;

    if (nonBlankCount > bestScore) {
      bestScore = nonBlankCount;
      bestIndex = index;
    }
  });

  return bestIndex;
}

function normalizeHeaders(row: string[]) {
  return row.map((cell, index) => {
    const value = stringifyCell(cell).trim();
    return value || `Column ${index + 1}`;
  });
}

function stringifyCell(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}

function getPreviewFileType(fileName: string): SourceFilePreview["fileType"] {
  const extension = getFileExtension(fileName);

  if (extension === ".csv") {
    return "csv";
  }

  if (extension === ".xlsx") {
    return "xlsx";
  }

  if (extension === ".xls") {
    return "xls";
  }

  return "unknown";
}
