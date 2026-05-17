import "server-only";

import * as XLSX from "xlsx";

import { RAW_UPLOADS_BUCKET } from "@/lib/supabase/storage";
import { getFileExtension } from "@/lib/uploads/config";
import type { SupabaseClient } from "@supabase/supabase-js";

export type SourceFileForParsing = {
  source_file_id: string;
  storage_bucket: string;
  storage_path: string;
  original_file_name: string;
};

export async function loadSourceFileRows({
  adminClient,
  sheetIndex,
  sourceFile
}: {
  adminClient: SupabaseClient;
  sheetIndex: number;
  sourceFile: SourceFileForParsing;
}) {
  const downloadResult = await adminClient.storage
    .from(sourceFile.storage_bucket || RAW_UPLOADS_BUCKET)
    .download(sourceFile.storage_path);

  if (downloadResult.error) {
    throw new Error(downloadResult.error.message);
  }

  const buffer = Buffer.from(await downloadResult.data.arrayBuffer());
  const extension = getFileExtension(sourceFile.original_file_name);

  if (extension === ".csv") {
    const workbook = XLSX.read(buffer.toString("utf8"), {
      raw: true,
      type: "string"
    });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    return sheetToRows(worksheet);
  }

  if (extension === ".xlsx" || extension === ".xls") {
    const workbook = XLSX.read(buffer, {
      cellDates: false,
      raw: true,
      type: "buffer"
    });
    const sheetName = workbook.SheetNames[sheetIndex] ?? workbook.SheetNames[0];
    return sheetToRows(workbook.Sheets[sheetName]);
  }

  throw new Error("Unsupported file type for trial balance preview.");
}

function sheetToRows(worksheet: XLSX.WorkSheet) {
  return XLSX.utils.sheet_to_json<string[]>(worksheet, {
    blankrows: false,
    defval: "",
    header: 1,
    raw: false
  });
}
