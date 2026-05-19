"use server";

import { revalidatePath } from "next/cache";

import { ensureAppUserForAuthUser } from "@/lib/auth/app-user";
import { requireUser } from "@/lib/auth/session";
import {
  acknowledgeValidationWarnings,
  runTrialBalanceValidation
} from "@/lib/imports/trial-balance-validation";
import {
  initialTrialBalanceValidationState,
  type TrialBalanceValidationState
} from "@/lib/imports/validation-state";
import { createAdminClient } from "@/lib/supabase/admin";

export async function runTrialBalanceValidationAction(
  _previousState: TrialBalanceValidationState,
  formData: FormData
): Promise<TrialBalanceValidationState> {
  try {
    const importBatchId = getStringValue(formData.get("importBatchId"));

    if (!importBatchId) {
      return errorState("Import batch is required for validation.");
    }

    const authUser = await requireUser();
    const adminClient = createAdminClient();
    const appUser = await ensureAppUserForAuthUser(adminClient, authUser);
    const result = await runTrialBalanceValidation({
      adminClient,
      importBatchId,
      organizationId: appUser.organization_id,
      userId: appUser.user_id
    });

    revalidatePath("/imports");
    revalidatePath(`/imports/${importBatchId}/validation`);
    revalidatePath(`/imports/${importBatchId}/preview`);

    return {
      ...initialTrialBalanceValidationState,
      status: "success",
      message: `Validation completed: ${result.criticalErrorCount} critical errors, ${result.warningCount} warnings, ${result.informationCount} information messages. This import was not posted.`
    };
  } catch (error) {
    return errorState(
      error instanceof Error
        ? error.message
        : "Trial balance validation could not be run."
    );
  }
}

export async function acknowledgeValidationWarningsAction(
  _previousState: TrialBalanceValidationState,
  formData: FormData
): Promise<TrialBalanceValidationState> {
  try {
    const importBatchId = getStringValue(formData.get("importBatchId"));
    const validationRunId = getStringValue(formData.get("validationRunId"));
    const acknowledgementNote = getStringValue(formData.get("acknowledgementNote"));

    if (!importBatchId || !validationRunId) {
      return errorState("Import batch and validation run are required.");
    }

    const authUser = await requireUser();
    const adminClient = createAdminClient();
    const appUser = await ensureAppUserForAuthUser(adminClient, authUser);

    await acknowledgeValidationWarnings({
      acknowledgementNote,
      adminClient,
      importBatchId,
      organizationId: appUser.organization_id,
      userId: appUser.user_id,
      validationRunId
    });

    revalidatePath("/imports");
    revalidatePath(`/imports/${importBatchId}/validation`);

    return {
      ...initialTrialBalanceValidationState,
      status: "success",
      message:
        "Warnings were acknowledged. Critical errors still cannot be bypassed, and this import has not been posted."
    };
  } catch (error) {
    return errorState(
      error instanceof Error
        ? error.message
        : "Warnings could not be acknowledged."
    );
  }
}

function getStringValue(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function errorState(message: string): TrialBalanceValidationState {
  return {
    status: "error",
    message
  };
}
