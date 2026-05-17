export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export const SUPPORTED_IMPORT_TYPE_CODES = [
  "trial_balance",
  "fund_mapping",
  "object_mapping",
  "acfr_mapping",
  "department_mapping",
  "function_mapping"
] as const;

export const ACCEPTED_UPLOAD_EXTENSIONS = [".csv", ".xlsx", ".xls"] as const;

export type SupportedImportTypeCode =
  (typeof SUPPORTED_IMPORT_TYPE_CODES)[number];

export function isSupportedImportTypeCode(
  value: string
): value is SupportedImportTypeCode {
  return SUPPORTED_IMPORT_TYPE_CODES.includes(value as SupportedImportTypeCode);
}

export function getFileExtension(fileName: string) {
  const dotIndex = fileName.lastIndexOf(".");

  if (dotIndex === -1) {
    return "";
  }

  return fileName.slice(dotIndex).toLowerCase();
}

export function isAcceptedUploadFileName(fileName: string) {
  return ACCEPTED_UPLOAD_EXTENSIONS.includes(
    getFileExtension(fileName) as (typeof ACCEPTED_UPLOAD_EXTENSIONS)[number]
  );
}

export function getContentTypeForFile(fileName: string, fallbackType: string) {
  const extension = getFileExtension(fileName);

  if (extension === ".csv") {
    return "text/csv";
  }

  if (extension === ".xlsx") {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }

  if (extension === ".xls") {
    return "application/vnd.ms-excel";
  }

  return fallbackType || "application/octet-stream";
}

export function formatFileSize(byteSize: number | null | undefined) {
  if (!byteSize && byteSize !== 0) {
    return "Unknown";
  }

  if (byteSize < 1024) {
    return `${byteSize} B`;
  }

  const units = ["KB", "MB", "GB"];
  let size = byteSize / 1024;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 ? 1 : 2)} ${units[unitIndex]}`;
}

export function importTypeRequiresPeriod(importTypeCode: string) {
  return importTypeCode === "trial_balance";
}
