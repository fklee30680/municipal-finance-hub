"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { ensureAppUserForAuthUser } from "@/lib/auth/app-user";
import { getCurrentUser } from "@/lib/auth/session";
import {
  initialArchiveImportState,
  type ArchiveImportState
} from "@/lib/imports/archive-state";
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
import type { UploadSourceFileState } from "@/lib/uploads/upload-state";

export async function uploadSourceFile(
  _previousState: UploadSourceFileState,
  formData: FormData
): Promise<UploadSourceFileState> {
  try {
    return await uploadSourceFileInternal(formData);
  } catch (error) {
    return errorState(
      error instanceof Error
        ? error.message
        : "Upload failed before it could be saved."
    );
  }
}

export async function archiveUploadedImportAction(
  _previousState: ArchiveImportState,
  formData: FormData
): Promise<ArchiveImportState> {
  try {
    const authUser = await getCurrentUser();

    if (!authUser) {
      redirect("/login");
    }

    const importBatchId = getStringValue(formData.get("importBatchId"));
    const reason = getStringValue(formData.get("reason"));

    if (!importBatchId) {
      return archiveErrorState("Import batch is required.");
    }

    const adminClient = createAdminClient();
    const appUser = await ensureAppUserForAuthUser(adminClient, authUser);
    const batchResult = await adminClient
      .from("import_batches")
      .select(
        "import_batch_id, source_file_id, batch_status, is_active_for_reporting, metadata"
      )
      .eq("organization_id", appUser.organization_id)
      .eq("import_batch_id", importBatchId)
      .maybeSingle<{
        batch_status: string;
        import_batch_id: string;
        is_active_for_reporting: boolean;
        metadata: Record<string, unknown> | null;
        source_file_id: string | null;
      }>();

    if (batchResult.error) {
      return archiveErrorState(batchResult.error.message);
    }

    if (!batchResult.data) {
      return archiveErrorState("Import batch was not found.");
    }

    if (
      batchResult.data.is_active_for_reporting ||
      ["posted", "posted_with_exceptions"].includes(batchResult.data.batch_status)
    ) {
      return archiveErrorState(
        "Posted imports cannot be archived from upload history. Use the replacement or reactivation workflow instead."
      );
    }

    const now = new Date().toISOString();
    const batchUpdate = await adminClient
      .from("import_batches")
      .update({
        active_status: "inactive",
        batch_status: "archived",
        is_active_for_reporting: false,
        reporting_status: "excluded",
        updated_at: now,
        updated_by: appUser.user_id,
        metadata: {
          ...(batchResult.data.metadata ?? {}),
          archived_at: now,
          archived_by: appUser.user_id,
          archive_reason: reason || null,
          raw_file_retained: true
        }
      })
      .eq("organization_id", appUser.organization_id)
      .eq("import_batch_id", importBatchId);

    if (batchUpdate.error) {
      return archiveErrorState(batchUpdate.error.message);
    }

    if (batchResult.data.source_file_id) {
      const sourceFileResult = await adminClient
        .from("source_files")
        .select("metadata")
        .eq("organization_id", appUser.organization_id)
        .eq("source_file_id", batchResult.data.source_file_id)
        .maybeSingle<{ metadata: Record<string, unknown> | null }>();

      if (sourceFileResult.error) {
        return archiveErrorState(sourceFileResult.error.message);
      }

      const sourceFileUpdate = await adminClient
        .from("source_files")
        .update({
          active_status: "inactive",
          updated_at: now,
          metadata: {
            ...(sourceFileResult.data?.metadata ?? {}),
            archived_at: now,
            archived_by: appUser.user_id,
            archive_reason: reason || null,
            retained_unchanged: true
          }
        })
        .eq("organization_id", appUser.organization_id)
        .eq("source_file_id", batchResult.data.source_file_id);

      if (sourceFileUpdate.error) {
        return archiveErrorState(sourceFileUpdate.error.message);
      }
    }

    await adminClient.from("audit_logs").insert({
      organization_id: appUser.organization_id,
      actor_user_id: appUser.user_id,
      action_type: "upload_archived",
      entity_table: "import_batches",
      entity_id: importBatchId,
      after_payload: {
        archive_reason: reason || null,
        source_file_id: batchResult.data.source_file_id,
        raw_file_retained: true
      },
      metadata: {
        slice: "upload_archive",
        physical_delete: false
      }
    });

    revalidatePath("/imports");
    revalidatePath(`/imports/${importBatchId}/review`);
    revalidatePath("/imports/templates/new");

    return {
      ...initialArchiveImportState,
      message:
        "Upload archived. The raw file was retained, but the upload is now inactive and hidden from default import workflows.",
      status: "success"
    };
  } catch (error) {
    return archiveErrorState(
      error instanceof Error ? error.message : "Upload could not be archived."
    );
  }
}

async function uploadSourceFileInternal(
  formData: FormData
): Promise<UploadSourceFileState> {
  const authUser = await getCurrentUser();

  if (!authUser) {
    redirect("/login");
  }

  const importTypeId = getStringValue(formData.get("importTypeId"));
  const fiscalYearValue = getStringValue(formData.get("fiscalYear"));
  const periodValue = getStringValue(formData.get("period"));
  const period13HandlingValue = getStringValue(formData.get("period13Handling"));
  const fiscalYearId = getStringValue(formData.get("fiscalYearId"));
  const fiscalPeriodId = getStringValue(formData.get("fiscalPeriodId"));
  const templateVersionId = getStringValue(formData.get("templateVersionId"));
  const accountStructureId = getStringValue(formData.get("accountStructureId"));
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

  const period13Handling = getPeriod13Handling({
    importTypeCode: importTypeResult.data.import_type_code,
    period,
    value: period13HandlingValue
  });

  if (requiresPeriod) {
    const fiscalSetup = await loadFiscalSetupForUpload({
      adminClient,
      fiscalPeriodId,
      fiscalYear,
      fiscalYearId,
      organizationId: appUser.organization_id,
      period
    });

    if (!fiscalSetup.ok) {
      return errorState(fiscalSetup.message);
    }

    if (fiscalSetup.fiscalYearId) {
      formData.set("fiscalYearId", fiscalSetup.fiscalYearId);
    }

    if (fiscalSetup.fiscalPeriodId) {
      formData.set("fiscalPeriodId", fiscalSetup.fiscalPeriodId);
    }
  }

  const selectedTemplate = templateVersionId
    ? await loadUploadTemplateVersion({
        accountStructureId,
        adminClient,
        importTypeId: importTypeResult.data.import_type_id,
        organizationId: appUser.organization_id,
        templateVersionId
      })
    : null;

  if (selectedTemplate && !selectedTemplate.ok) {
    return errorState(selectedTemplate.message);
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
      fiscal_year_id: getStringValue(formData.get("fiscalYearId")) || null,
      fiscal_period_id: getStringValue(formData.get("fiscalPeriodId")) || null,
      import_template_id: selectedTemplate?.ok ? selectedTemplate.templateId : null,
      template_version_id: selectedTemplate?.ok
        ? selectedTemplate.templateVersionId
        : null,
      account_structure_id: selectedTemplate?.ok
        ? selectedTemplate.accountStructureId
        : null,
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
        default_template_applied: Boolean(selectedTemplate?.ok),
        period_13_handling: period13Handling,
        period_13_close_status:
          period13Handling === "pre_closing" || period13Handling === "unsure"
            ? "not_validated"
            : null,
        selected_template_version_id: selectedTemplate?.ok
          ? selectedTemplate.templateVersionId
          : null,
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
    revalidatePath("/imports/trial-balance");

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
        importBatchStatus: "uploaded",
        sourceFileId: sourceFileResult.data.source_file_id,
        importBatchId,
        importTypeCode: importTypeResult.data.import_type_code
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

async function loadFiscalSetupForUpload({
  adminClient,
  fiscalPeriodId,
  fiscalYear,
  fiscalYearId,
  organizationId,
  period
}: {
  adminClient: ReturnType<typeof createAdminClient>;
  fiscalPeriodId: string;
  fiscalYear: number | null;
  fiscalYearId: string;
  organizationId: string;
  period: number | null;
}) {
  if (fiscalYear === null || period === null) {
    return {
      ok: false as const,
      message: "Fiscal year and period are required for trial balance uploads."
    };
  }

  const result = await adminClient
    .from("fiscal_periods")
    .select("fiscal_period_id, fiscal_year_id, fiscal_year, period")
    .eq("organization_id", organizationId)
    .eq("fiscal_year", fiscalYear)
    .eq("period", period)
    .eq("active_status", "active")
    .maybeSingle<{
      fiscal_period_id: string;
      fiscal_year_id: string;
      fiscal_year: number;
      period: number;
    }>();

  if (result.error) {
    return {
      ok: false as const,
      message: result.error.message
    };
  }

  if (!result.data) {
    return {
      ok: false as const,
      message:
        "Fiscal periods must be configured before importing trial balances."
    };
  }

  if (fiscalYearId && fiscalYearId !== result.data.fiscal_year_id) {
    return {
      ok: false as const,
      message: "Selected fiscal year does not match the configured fiscal period."
    };
  }

  if (fiscalPeriodId && fiscalPeriodId !== result.data.fiscal_period_id) {
    return {
      ok: false as const,
      message: "Selected fiscal period could not be verified."
    };
  }

  return {
    fiscalPeriodId: result.data.fiscal_period_id,
    fiscalYearId: result.data.fiscal_year_id,
    ok: true as const
  };
}

async function loadUploadTemplateVersion({
  accountStructureId,
  adminClient,
  importTypeId,
  organizationId,
  templateVersionId
}: {
  accountStructureId: string;
  adminClient: ReturnType<typeof createAdminClient>;
  importTypeId: string;
  organizationId: string;
  templateVersionId: string;
}) {
  const result = await adminClient
    .from("import_template_versions")
    .select(
      `
      template_version_id,
      import_template_id,
      account_structure_id,
      version_status,
      import_templates (
        import_type_id
      )
    `
    )
    .eq("organization_id", organizationId)
    .eq("template_version_id", templateVersionId)
    .eq("version_status", "active")
    .maybeSingle<{
      account_structure_id: string | null;
      import_template_id: string;
      import_templates:
        | { import_type_id: string }
        | Array<{ import_type_id: string }>
        | null;
      template_version_id: string;
      version_status: string;
    }>();

  if (result.error) {
    return {
      ok: false as const,
      message: result.error.message
    };
  }

  if (!result.data) {
    return {
      ok: false as const,
      message: "Saved trial balance layout could not be found."
    };
  }

  const template = Array.isArray(result.data.import_templates)
    ? result.data.import_templates[0]
    : result.data.import_templates;

  if (template?.import_type_id !== importTypeId) {
    return {
      ok: false as const,
      message: "Saved layout does not belong to the trial balance import type."
    };
  }

  if (
    accountStructureId &&
    result.data.account_structure_id &&
    accountStructureId !== result.data.account_structure_id
  ) {
    return {
      ok: false as const,
      message: "Saved layout account structure could not be verified."
    };
  }

  return {
    accountStructureId: result.data.account_structure_id,
    ok: true as const,
    templateId: result.data.import_template_id,
    templateVersionId: result.data.template_version_id
  };
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

function getPeriod13Handling({
  importTypeCode,
  period,
  value
}: {
  importTypeCode: string;
  period: number | null;
  value: string;
}) {
  if (importTypeCode !== "trial_balance" || period !== 13) {
    return null;
  }

  if (!value) {
    return "post_closing";
  }

  if (["post_closing", "pre_closing", "unsure"].includes(value)) {
    return value;
  }

  throw new Error("Period 13 handling is not valid.");
}

function errorState(message: string): UploadSourceFileState {
  return {
    status: "error",
    message
  };
}

function archiveErrorState(message: string): ArchiveImportState {
  return {
    message,
    status: "error"
  };
}
