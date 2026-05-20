"use server";

import { revalidatePath } from "next/cache";

import { ensureAppUserForAuthUser } from "@/lib/auth/app-user";
import { requireUser } from "@/lib/auth/session";
import {
  approveReactivationRequest,
  rejectReactivationRequest
} from "@/lib/imports/trial-balance-posting";
import {
  initialTrialBalancePostingState,
  type TrialBalancePostingState
} from "@/lib/imports/posting-state";
import { createAdminClient } from "@/lib/supabase/admin";

export async function approveReactivationRequestAction(
  _previousState: TrialBalancePostingState,
  formData: FormData
): Promise<TrialBalancePostingState> {
  try {
    const reactivationRequestId = getStringValue(
      formData.get("reactivationRequestId")
    );
    const reason = getStringValue(formData.get("reason"));

    if (!reactivationRequestId) {
      return errorState("Reactivation request is required.");
    }

    const authUser = await requireUser();
    const adminClient = createAdminClient();
    const appUser = await ensureAppUserForAuthUser(adminClient, authUser);
    await approveReactivationRequest({
      adminClient,
      organizationId: appUser.organization_id,
      reason,
      reactivationRequestId,
      userId: appUser.user_id
    });

    revalidatePath("/imports");
    revalidatePath("/imports/periods");
    revalidatePath("/imports/reactivation-requests");

    return {
      ...initialTrialBalancePostingState,
      status: "success",
      message: "Reactivation approved."
    };
  } catch (error) {
    return errorState(
      error instanceof Error ? error.message : "Reactivation could not be approved."
    );
  }
}

export async function rejectReactivationRequestAction(
  _previousState: TrialBalancePostingState,
  formData: FormData
): Promise<TrialBalancePostingState> {
  try {
    const reactivationRequestId = getStringValue(
      formData.get("reactivationRequestId")
    );
    const reason = getStringValue(formData.get("reason"));

    if (!reactivationRequestId) {
      return errorState("Reactivation request is required.");
    }

    const authUser = await requireUser();
    const adminClient = createAdminClient();
    const appUser = await ensureAppUserForAuthUser(adminClient, authUser);
    await rejectReactivationRequest({
      adminClient,
      organizationId: appUser.organization_id,
      reason,
      reactivationRequestId,
      userId: appUser.user_id
    });

    revalidatePath("/imports/reactivation-requests");

    return {
      ...initialTrialBalancePostingState,
      status: "success",
      message: "Reactivation request rejected."
    };
  } catch (error) {
    return errorState(
      error instanceof Error ? error.message : "Reactivation could not be rejected."
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
