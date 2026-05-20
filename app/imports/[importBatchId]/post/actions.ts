"use server";

import { revalidatePath } from "next/cache";

import { ensureAppUserForAuthUser } from "@/lib/auth/app-user";
import { requireUser } from "@/lib/auth/session";
import {
  postValidatedTrialBalance,
  requestReactivation,
  requestReplacement
} from "@/lib/imports/trial-balance-posting";
import {
  initialTrialBalancePostingState,
  type TrialBalancePostingState
} from "@/lib/imports/posting-state";
import { createAdminClient } from "@/lib/supabase/admin";

export async function postValidatedTrialBalanceAction(
  _previousState: TrialBalancePostingState,
  formData: FormData
): Promise<TrialBalancePostingState> {
  try {
    const importBatchId = getStringValue(formData.get("importBatchId"));

    if (!importBatchId) {
      return errorState("Import batch is required for posting.");
    }

    const authUser = await requireUser();
    const adminClient = createAdminClient();
    const appUser = await ensureAppUserForAuthUser(adminClient, authUser);
    const result = await postValidatedTrialBalance({
      adminClient,
      importBatchId,
      organizationId: appUser.organization_id,
      userId: appUser.user_id
    });

    revalidateImportPaths(importBatchId);

    return {
      ...initialTrialBalancePostingState,
      status: "success",
      message: `Posted ${result.postedRowCount} trial balance rows. Status: ${result.status}.`
    };
  } catch (error) {
    return errorState(
      error instanceof Error
        ? error.message
        : "Validated trial balance could not be posted."
    );
  }
}

export async function requestReplacementAction(
  _previousState: TrialBalancePostingState,
  formData: FormData
): Promise<TrialBalancePostingState> {
  try {
    const importBatchId = getStringValue(formData.get("importBatchId"));
    const reason = getStringValue(formData.get("reason"));

    if (!importBatchId || !reason) {
      return errorState("Import batch and replacement reason are required.");
    }

    const authUser = await requireUser();
    const adminClient = createAdminClient();
    const appUser = await ensureAppUserForAuthUser(adminClient, authUser);
    const requestId = await requestReplacement({
      adminClient,
      importBatchId,
      organizationId: appUser.organization_id,
      reason,
      userId: appUser.user_id
    });

    revalidateImportPaths(importBatchId);
    revalidatePath("/imports/replacement-requests");

    return {
      ...initialTrialBalancePostingState,
      status: "success",
      message: `Replacement request created: ${requestId}.`
    };
  } catch (error) {
    return errorState(
      error instanceof Error
        ? error.message
        : "Replacement request could not be created."
    );
  }
}

export async function requestReactivationAction(
  _previousState: TrialBalancePostingState,
  formData: FormData
): Promise<TrialBalancePostingState> {
  try {
    const importBatchId = getStringValue(formData.get("importBatchId"));
    const reason = getStringValue(formData.get("reason"));

    if (!importBatchId || !reason) {
      return errorState("Import batch and reactivation reason are required.");
    }

    const authUser = await requireUser();
    const adminClient = createAdminClient();
    const appUser = await ensureAppUserForAuthUser(adminClient, authUser);
    const requestId = await requestReactivation({
      adminClient,
      importBatchId,
      organizationId: appUser.organization_id,
      reason,
      userId: appUser.user_id
    });

    revalidateImportPaths(importBatchId);
    revalidatePath("/imports/reactivation-requests");

    return {
      ...initialTrialBalancePostingState,
      status: "success",
      message: `Reactivation request created: ${requestId}.`
    };
  } catch (error) {
    return errorState(
      error instanceof Error
        ? error.message
        : "Reactivation request could not be created."
    );
  }
}

function revalidateImportPaths(importBatchId: string) {
  revalidatePath("/imports");
  revalidatePath("/imports/periods");
  revalidatePath(`/imports/${importBatchId}/post`);
  revalidatePath(`/imports/${importBatchId}/review`);
  revalidatePath(`/imports/${importBatchId}/validation`);
}

function getStringValue(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function errorState(message: string): TrialBalancePostingState {
  return {
    status: "error",
    message
  };
}
