"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { ensureAppUserForAuthUser } from "@/lib/auth/app-user";
import { getCurrentUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildRawUploadPath, RAW_UPLOADS_BUCKET } from "@/lib/supabase/storage";
import {
  getContentTypeForFile,
  importTypeRequiresPeriod,
  isAcceptedUploadFileName,
  isSupportedImportTypeCode,
  MAX_UPLOAD_BYTES
} from "@/lib/uploads/config";
import { sha256Hex } from "@/lib/uploads/file-hash";

export type UploadSourceFileState = {
  status: "idle" | "success" | "error";
  message?: string;
  duplicateWarning?: string;
  upload?: {
    originalFileName: string;
    importTypeName: string;
    fiscalYear: string;
    period: string;
    fileType: string;
    fileSize: string;
    fileHash: string;
    uploadedAt: string;
    importBatchStatus: string;
  };
};

export const initialUploadSourceFileState: UploadSourceFileState = {
  status: "idle"
};

export async function uploadSourceFile(
  _previousState: UploadSourceFileState,
  formData: FormData
): Promise<UploadSourceFileState> {
  const authUser = await getCurrentUser();

  if (!authUser) {
    redirect("/login");
  }

  const importTypeId = getStringValue(formData.get("importTypeId"));
  const fiscalYearValue = getStringValue(formData.get("fiscalYear"));
  const periodValue = getStringValue(formData.get("period"));
  const fileValue = formData.get("file");

  if (!importTypeId) {
    return errorState("Choose an import type before uploading.");
  }

  if (!(fileValue instanceof File) || fileValue.size === 0) {
    return errorState("Choose a CSV or Excel file before uploading.");
  }

  if (!isAcceptedUploadFileName(fileValue.name)) {
    return errorState("Unsupported file type. Upload CSV, XLSX, or XLS files.");
  }

  if (fileValue.size > MAX_UPLOAD_BYTES) {
    return errorState("File is larger than the 25 MB upload limit.");
  }

  const adminClient = createAdminClient();
  const appUser = await ensureAppUserForAuthUser(adminClient, authUser);

  const importTypeResult = await adminClient
    .from("import_types")
    .select("import_type_id, import_type_code, import_type_name")
    .eq("organization_id", appUser.organization_id)
    .eq("import_type_id", importTypeId)
    .eq("active_status", "active")
    .maybeSingle<{
      import_type_id: string;
      import_type_code: string;
      import_type_name: string;
    }>();

  if (importTypeResult.error) {
    return errorState(importTypeResult.error.message);
  }

  if (!importTypeResult.data) {
    return errorState("Selected import type is not active or does not exist.");
  }

  if (!isSupportedImportTypeCode(importTypeResult.data.import_type_code)) {
    return errorState("Selected import type is not supported for raw upload.");
  }

  const requiresPeriod = importTypeRequiresPeriod(
    importTypeResult.data.import_type_code
  );
  const fiscalYear = parseOptionalInteger(fiscalYearValue);
  const period = parseOptionalInteger(periodValue);

  if (requiresPeriod && fiscalYear === null) {
    return errorState("Fiscal year is required for trial balance uploads.");
  }

  if (requiresPeriod && period === null) {
    return errorState("Period is required for trial balance uploads.");
  }

  if (period !== null && (period < 0 || period > 13)) {
    return errorState("Period must be between 0 and 13.");
  }

  const fileBuffer = Buffer.from(await fileValue.arrayBuffer());
  const fileHash = sha256Hex(fileBuffer);
  const contentType = getContentTypeForFile(fileValue.name, fileValue.type);
  const importBatchId = randomUUID();
  const storagePath = buildRawUploadPath({
    organizationId: appUser.organization_id,
    importBatchId,
    fileName: fileValue.name
  });

  const duplicateResult = await adminClient
    .from("source_files")
    .select("source_file_id, original_file_name, uploaded_at")
    .eq("organization_id", appUser.organization_id)
    .eq("checksum_sha256", fileHash)
    .order("uploaded_at", { ascending: false })
    .limit(1);

  if (duplicateResult.error) {
    return errorState(duplicateResult.error.message);
  }

  const duplicateSourceFile = duplicateResult.data?.[0] ?? null;

  const storageResult = await adminClient.storage
    .from(RAW_UPLOADS_BUCKET)
    .upload(storagePath, fileBuffer, {
      contentType,
      upsert: false
    });

  if (storageResult.error) {
    return errorState(
      `Storage upload failed. Confirm the private ${RAW_UPLOADS_BUCKET} bucket exists. ${storageResult.error.message}`
    );
  }

  try {
    const sourceFileResult = await adminClient
      .from("source_files")
      .insert({
        organization_id: appUser.organization_id,
        storage_bucket: RAW_UPLOADS_BUCKET,
        storage_path: storagePath,
        original_file_name: fileValue.name,
        content_type: contentType,
        byte_size: fileValue.size,
        checksum_sha256: fileHash,
        uploaded_by: appUser.user_id,
        fiscal_year: fiscalYear,
        period,
        duplicate_source_file_id: duplicateSourceFile?.source_file_id ?? null,
        retained_unchanged: true,
        metadata: {
          duplicate_detected: Boolean(duplicateSourceFile),
          duplicate_original_file_name:
            duplicateSourceFile?.original_file_name ?? null,
          import_batch_id: importBatchId,
          uploaded_by_email: appUser.email
        }
      })
      .select("source_file_id, uploaded_at")
      .single<{ source_file_id: string; uploaded_at: string }>();

    if (sourceFileResult.error) {
      throw new Error(sourceFileResult.error.message);
    }

    const importBatchResult = await adminClient.from("import_batches").insert({
      import_batch_id: importBatchId,
      organization_id: appUser.organization_id,
      import_type_id: importTypeResult.data.import_type_id,
      source_file_id: sourceFileResult.data.source_file_id,
      fiscal_year: fiscalYear,
      period,
      batch_name: fileValue.name,
      batch_status: "uploaded",
      reporting_status: "excluded",
      is_active_for_reporting: false,
      rows_processed: 0,
      rows_accepted: 0,
      rows_rejected: 0,
      warning_count: duplicateSourceFile ? 1 : 0,
      error_count: 0,
      created_by: appUser.user_id,
      metadata: {
        raw_upload_only: true,
        storage_bucket: RAW_UPLOADS_BUCKET,
        storage_path: storagePath,
        file_hash: fileHash,
        duplicate_source_file_id: duplicateSourceFile?.source_file_id ?? null
      }
    });

    if (importBatchResult.error) {
      throw new Error(importBatchResult.error.message);
    }

    await adminClient.from("audit_logs").insert({
      organization_id: appUser.organization_id,
      actor_user_id: appUser.user_id,
      action_type: "file_uploaded",
      entity_table: "source_files",
      entity_id: sourceFileResult.data.source_file_id,
      after_payload: {
        import_batch_id: importBatchId,
        original_file_name: fileValue.name,
        checksum_sha256: fileHash,
        storage_bucket: RAW_UPLOADS_BUCKET,
        storage_path: storagePath
      },
      metadata: {
        raw_upload_only: true,
        duplicate_detected: Boolean(duplicateSourceFile)
      }
    });

    revalidatePath("/imports");
    revalidatePath("/imports/new");

    return {
      status: "success",
      message:
        "Upload complete. The file has been preserved and an import batch was created. This data has not been validated or posted.",
      duplicateWarning: duplicateSourceFile
        ? `Duplicate warning: this file matches ${duplicateSourceFile.original_file_name}.`
        : undefined,
      upload: {
        originalFileName: fileValue.name,
        importTypeName: importTypeResult.data.import_type_name,
        fiscalYear: fiscalYear?.toString() ?? "Not provided",
        period: period?.toString() ?? "Not provided",
        fileType: contentType,
        fileSize: `${fileValue.size} bytes`,
        fileHash,
        uploadedAt: sourceFileResult.data.uploaded_at,
        importBatchStatus: "uploaded"
      }
    };
  } catch (error) {
    await adminClient.storage.from(RAW_UPLOADS_BUCKET).remove([storagePath]);

    return errorState(
      error instanceof Error
        ? error.message
        : "Upload metadata could not be saved."
    );
  }
}

function getStringValue(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function parseOptionalInteger(value: string) {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function errorState(message: string): UploadSourceFileState {
  return {
    status: "error",
    message
  };
}
