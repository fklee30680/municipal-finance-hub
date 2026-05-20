"use server";

import { revalidatePath } from "next/cache";

import { ensureAppUserForAuthUser } from "@/lib/auth/app-user";
import { requireUser } from "@/lib/auth/session";
import {
  approveReplacementRequest,
  rejectReplacementRequest
} from "@/lib/imports/trial-balance-posting";
import {
  initialTrialBalancePostingState,
  type TrialBalancePostingState
} from "@/lib/imports/posting-state";
import { createAdminClient } from "@/lib/supabase/admin";

export async function approveReplacementRequestAction(
  _previousState: TrialBalancePostingState,
  formData: FormData
): Promise<TrialBalancePostingState> {
  try {
    const replacementRequestId = getStringValue(formData.get("replacementRequestId"));
    const reason = getStringValue(formData.get("reason"));

    if (!replacementRequestId) {
      return errorState("Replacement request is required.");
    }

    const authUser = await requireUser();
    const adminClient = createAdminClient();
    const appUser = await ensureAppUserForAuthUser(adminClient, authUser);
    const result = await approveReplacementRequest({
      adminClient,
      organizationId: appUser.organization_id,
      reason,
      replacementRequestId,
      userId: appUser.user_id
    });

    revalidatePath("/imports");
    revalidatePath("/imports/periods");
    revalidatePath("/imports/replacement-requests");

    return {
      ...initialTrialBalancePostingState,
      status: "success",
      message: `Replacement approved and posted ${result.postedRowCount} rows.`
    };
  } catch (error) {
    return errorState(
      error instanceof Error ? error.message : "Replacement could not be approved."
    );
  }
}

export async function rejectReplacementRequestAction(
  _previousState: TrialBalancePostingState,
  formData: FormData
): Promise<TrialBalancePostingState> {
  try {
    const replacementRequestId = getStringValue(formData.get("replacementRequestId"));
    const reason = getStringValue(formData.get("reason"));

    if (!replacementRequestId) {
      return errorState("Replacement request is required.");
    }

    const authUser = await requireUser();
    const adminClient = createAdminClient();
    const appUser = await ensureAppUserForAuthUser(adminClient, authUser);
    await rejectReplacementRequest({
      adminClient,
      organizationId: appUser.organization_id,
      reason,
      replacementRequestId,
      userId: appUser.user_id
    });

    revalidatePath("/imports/replacement-requests");

    return {
      ...initialTrialBalancePostingState,
      status: "success",
      message: "Replacement request rejected."
    };
  } catch (error) {
    return errorState(
      error instanceof Error ? error.message : "Replacement could not be rejected."
    );
  }
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
