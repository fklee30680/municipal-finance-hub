export const RAW_UPLOADS_BUCKET = "raw-finance-uploads";

export function buildRawUploadPath({
  organizationId,
  fileName
}: {
  organizationId: string;
  fileName: string;
}) {
  const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${organizationId}/raw/${Date.now()}-${safeFileName}`;
}

