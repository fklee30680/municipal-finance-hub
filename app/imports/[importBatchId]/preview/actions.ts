"use server";

import { revalidatePath } from "next/cache";

import { ensureAppUserForAuthUser } from "@/lib/auth/app-user";
import { requireUser } from "@/lib/auth/session";
import {
  initialTrialBalancePreviewState,
  type TrialBalancePreviewState
} from "@/lib/imports/preview-state";
import { generateTrialBalancePreview } from "@/lib/imports/trial-balance-preview";
import { createAdminClient } from "@/lib/supabase/admin";

export async function generateTrialBalancePreviewAction(
  _previousState: TrialBalancePreviewState,
  formData: FormData
): Promise<TrialBalancePreviewState> {
  try {
    const importBatchId = getStringValue(formData.get("importBatchId"));

    if (!importBatchId) {
      return errorState("Import batch is required for preview.");
    }

    const authUser = await requireUser();
    const adminClient = createAdminClient();
    const appUser = await ensureAppUserForAuthUser(adminClient, authUser);
    const result = await generateTrialBalancePreview({
      adminClient,
      importBatchId,
      organizationId: appUser.organization_id,
      userId: appUser.user_id
    });

    revalidatePath("/imports");
    revalidatePath(`/imports/${importBatchId}/preview`);

    return {
      ...initialTrialBalancePreviewState,
      status: "success",
      message: `Preview generated for ${result.summary.previewedRowCount} rows. Preview rows are not validated, posted, or active for reporting.`
    };
  } catch (error) {
    return errorState(
      error instanceof Error
        ? error.message
        : "Trial balance preview could not be generated."
    );
  }
}

function getStringValue(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function errorState(message: string): TrialBalancePreviewState {
  return {
    status: "error",
    message
  };
}
