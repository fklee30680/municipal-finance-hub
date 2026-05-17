export const RAW_UPLOADS_BUCKET = "source-files";

export function sanitizeFileName(fileName: string) {
  const normalizedName = fileName.trim().replace(/[/\\]/g, "_");
  const safeFileName = normalizedName.replace(/[^a-zA-Z0-9._-]/g, "_");

  return safeFileName || "source-file";
}

export function buildRawUploadPath({
  organizationId,
  importBatchId,
  fileName
}: {
  organizationId: string;
  importBatchId: string;
  fileName: string;
}) {
  return `organizations/${organizationId}/imports/${importBatchId}/${sanitizeFileName(fileName)}`;
}
