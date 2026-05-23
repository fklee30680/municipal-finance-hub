"use server";

import { revalidatePath } from "next/cache";

import { ensureAppUserForAuthUser } from "@/lib/auth/app-user";
import { requireUser } from "@/lib/auth/session";
import { runAnalysisCalculation } from "@/lib/calculations/run-calculation";
import { createAdminClient } from "@/lib/supabase/admin";

export type CalculationRunActionState = {
  calculationRunId?: string;
  message: string | null;
  status: "idle" | "success" | "error";
};

export const initialCalculationRunActionState: CalculationRunActionState = {
  message: null,
  status: "idle"
};

export async function runCalculationAction(
  _previousState: CalculationRunActionState,
  formData: FormData
): Promise<CalculationRunActionState> {
  try {
    const authUser = await requireUser();
    const adminClient = createAdminClient();
    const appUser = await ensureAppUserForAuthUser(adminClient, authUser);
    const fiscalYear = getInteger(formData.get("fiscalYear"));
    const periodFrom = getInteger(formData.get("periodFrom"));
    const periodTo = getInteger(formData.get("periodTo"));
    const timeView = getString(formData.get("timeView"));

    if (!["current_period", "ytd", "selected_range"].includes(timeView)) {
      return errorState("Choose a valid time view.");
    }

    const result = await runAnalysisCalculation({
      adminClient,
      request: {
        fiscalYear,
        organizationId: appUser.organization_id,
        periodFrom,
        periodTo,
        timeView: timeView as "current_period" | "ytd" | "selected_range",
        userId: appUser.user_id
      }
    });

    revalidatePath("/analysis/calculation-runs");

    return {
      calculationRunId: result.calculationRunId,
      message: `Calculation completed with status ${result.runStatus}. Mapping coverage: ${result.mappingCoverageStatus}.`,
      status: "success"
    };
  } catch (error) {
    return errorState(formatCalculationError(error));
  }
}

function errorState(message: string): CalculationRunActionState {
  return {
    message,
    status: "error"
  };
}

function getInteger(value: FormDataEntryValue | null) {
  const parsed = Number.parseInt(getString(value), 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function getString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function formatCalculationError(error: unknown) {
  const message = error instanceof Error ? error.message : "Calculation run failed.";

  if (isMissingCalculationSchemaError(message)) {
    return "Calculation schema is not installed in Supabase yet. Apply the Slice 9 analysis outputs migration, then rerun the calculation.";
  }

  return message;
}

function isMissingCalculationSchemaError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("calculation_runs.period_from") ||
    normalized.includes("column calculation_runs.period_from does not exist") ||
    normalized.includes("mapping_coverage_results") ||
    normalized.includes("sign_convention_configs")
  );
}
