"use server";

import { revalidatePath } from "next/cache";

import { ensureAppUserForAuthUser } from "@/lib/auth/app-user";
import { requireUser } from "@/lib/auth/session";
import {
  commitMappingImport,
  generateMappingImportPreview
} from "@/lib/imports/mapping-import";
import {
  initialMappingImportState,
  type MappingImportState
} from "@/lib/imports/mapping-import-state";
import { createAdminClient } from "@/lib/supabase/admin";

export async function generateMappingImportPreviewAction(
  _previousState: MappingImportState,
  formData: FormData
): Promise<MappingImportState> {
  try {
    const importBatchId = getStringValue(formData.get("importBatchId"));

    if (!importBatchId) {
      return errorState("Import batch is required for mapping preview.");
    }

    const authUser = await requireUser();
    const adminClient = createAdminClient();
    const appUser = await ensureAppUserForAuthUser(adminClient, authUser);
    const result = await generateMappingImportPreview({
      adminClient,
      importBatchId,
      organizationId: appUser.organization_id,
      userId: appUser.user_id
    });

    revalidatePath("/imports");
    revalidatePath(`/imports/${importBatchId}/mapping-preview`);

    return {
      ...initialMappingImportState,
      status: "success",
      message: `Mapping preview generated for ${result.summary.rowCount} rows. Accepted rows are staged only until you confirm commit.`
    };
  } catch (error) {
    return errorState(
      error instanceof Error
        ? error.message
        : "Mapping import preview could not be generated."
    );
  }
}

export async function commitMappingImportAction(
  _previousState: MappingImportState,
  formData: FormData
): Promise<MappingImportState> {
  try {
    const importBatchId = getStringValue(formData.get("importBatchId"));
    const mappingImportRunId = getStringValue(formData.get("mappingImportRunId"));
    const defaultEffectiveStartDate = getStringValue(
      formData.get("defaultEffectiveStartDate")
    );
    const changeDescription = getStringValue(formData.get("changeDescription"));
    const confirmed = formData.get("confirmCommit") === "on";

    if (!confirmed) {
      return errorState("Confirm the mapping import before committing accepted rows.");
    }

    if (!importBatchId || !mappingImportRunId) {
      return errorState("A preview run is required before commit.");
    }

    const authUser = await requireUser();
    const adminClient = createAdminClient();
    const appUser = await ensureAppUserForAuthUser(adminClient, authUser);
    const result = await commitMappingImport({
      adminClient,
      changeDescription,
      defaultEffectiveStartDate,
      importBatchId,
      mappingImportRunId,
      organizationId: appUser.organization_id,
      userId: appUser.user_id
    });

    revalidatePath("/imports");
    revalidatePath(`/imports/${importBatchId}/mapping-preview`);

    return {
      status: "success",
      message: `Committed ${result.rowsCommitted} accepted mapping rows. Mapping version ${result.mappingVersionId} was created.`
    };
  } catch (error) {
    return errorState(
      error instanceof Error
        ? error.message
        : "Accepted mapping rows could not be committed."
    );
  }
}

function getStringValue(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function errorState(message: string): MappingImportState {
  return {
    status: "error",
    message
  };
}
