"use server";

import { revalidatePath } from "next/cache";

import { ensureAppUserForAuthUser } from "@/lib/auth/app-user";
import { requireUser } from "@/lib/auth/session";
import {
  buildFundImportPreview,
  commitFundImportRows,
  type FundImportMapping
} from "@/lib/imports/fund-import";
import {
  initialFundImportCommitState,
  initialFundImportPreviewState,
  type FundImportCommitState,
  type FundImportOptions,
  type FundImportPreviewRow,
  type FundImportPreviewState
} from "@/lib/imports/fund-import-state";
import { createAdminClient } from "@/lib/supabase/admin";

export type FundManualUpdateState = {
  message: string | null;
  status: "idle" | "success" | "error";
};

export async function previewFundImportAction(
  _previousState: FundImportPreviewState,
  formData: FormData
): Promise<FundImportPreviewState> {
  try {
    const authUser = await requireUser();
    const adminClient = createAdminClient();
    const appUser = await ensureAppUserForAuthUser(adminClient, authUser);
    const file = formData.get("fundFile");

    if (!(file instanceof File) || file.size === 0) {
      return previewError("Choose a CSV or Excel file before importing funds.");
    }

    const headerRow = Math.max(
      Number.parseInt(getStringValue(formData.get("headerRow")), 10) || 1,
      1
    );
    const options = getOptions(formData);
    const preview = await buildFundImportPreview({
      adminClient,
      file,
      headerRow,
      mapping: getMapping(formData),
      options,
      organizationId: appUser.organization_id,
      sheetReference: getStringValue(formData.get("sheetReference"))
    });

    await adminClient.from("audit_logs").insert({
      action_type: "fund_import_preview_generated",
      actor_user_id: appUser.user_id,
      after_payload: {
        row_count: preview.rows.length,
        selected_sheet_name: preview.selectedSheetName,
        issue_count: preview.issues.length
      },
      entity_table: "funds",
      metadata: {
        route: "/imports/funds",
        temporary_preview_only: true
      },
      organization_id: appUser.organization_id
    });

    return {
      ...initialFundImportPreviewState,
      message:
        "Preview generated. Review the staged rows before committing. Edits here do not update saved funds until commit.",
      options,
      preview: {
        deletedFromPreview: 0,
        ...preview
      },
      status: "success"
    };
  } catch (error) {
    return previewError(
      error instanceof Error ? error.message : "Fund import preview failed."
    );
  }
}

export async function commitFundImportAction(
  _previousState: FundImportCommitState,
  formData: FormData
): Promise<FundImportCommitState> {
  try {
    const authUser = await requireUser();
    const adminClient = createAdminClient();
    const appUser = await ensureAppUserForAuthUser(adminClient, authUser);
    const rowsJson = getStringValue(formData.get("rowsJson"));

    if (!rowsJson) {
      return commitError("No staged fund rows were provided for commit.");
    }

    const rows = JSON.parse(rowsJson) as FundImportPreviewRow[];
    const result = await commitFundImportRows({
      adminClient,
      changeDescription:
        getStringValue(formData.get("changeDescription")) ||
        "Fund import from /imports/funds",
      organizationId: appUser.organization_id,
      options: getOptions(formData),
      rows,
      userId: appUser.user_id
    });

    revalidatePath("/imports/funds");
    revalidatePath("/imports/reference");
    revalidatePath("/imports/reference/funds");

    return {
      ...initialFundImportCommitState,
      message: `Fund import committed. Inserted ${result.inserted}, updated ${result.updated}, filled missing ${result.filledMissing}, skipped ${result.skipped}, rejected ${result.rejected}, deleted from preview ${result.deletedFromPreview}.`,
      result,
      status: "success"
    };
  } catch (error) {
    return commitError(
      error instanceof Error ? error.message : "Fund import commit failed."
    );
  }
}

export async function updateFundManualAction(
  _previousState: FundManualUpdateState,
  formData: FormData
): Promise<FundManualUpdateState> {
  try {
    const authUser = await requireUser();
    const adminClient = createAdminClient();
    const appUser = await ensureAppUserForAuthUser(adminClient, authUser);
    const fundId = getStringValue(formData.get("fundId"));

    if (!fundId) {
      return manualUpdateError("Fund ID was not provided.");
    }

    const beforeResult = await adminClient
      .from("funds")
      .select(
        "fund_id, fund_code, fund_name, reporting_model, fund_group, major_fund_flag, reporting_treatment, include_in_standard_reporting, include_in_cash_reconciliation, reporting_exclusion_reason, active_status, effective_start_date, effective_end_date"
      )
      .eq("organization_id", appUser.organization_id)
      .eq("fund_id", fundId)
      .maybeSingle<{
        active_status: string;
        effective_end_date: string | null;
        effective_start_date: string | null;
        fund_code: string;
        fund_group: string | null;
        fund_id: string;
        fund_name: string;
        include_in_cash_reconciliation: boolean;
        include_in_standard_reporting: boolean;
        major_fund_flag: string | null;
        reporting_exclusion_reason: string | null;
        reporting_model: string | null;
        reporting_treatment: string;
      }>();

    if (beforeResult.error) {
      return manualUpdateError(beforeResult.error.message);
    }

    if (!beforeResult.data) {
      return manualUpdateError("Fund could not be found.");
    }

    const updatePayload = {
      active_status: getAllowedValue({
        allowedValues: ["active", "inactive"],
        fieldLabel: "Active Status",
        value: getStringValue(formData.get("activeStatus"))
      }),
      effective_end_date: getDateOrNull(formData.get("effectiveEndDate"), "Effective End"),
      effective_start_date: getDateOrNull(
        formData.get("effectiveStartDate"),
        "Effective Start"
      ),
      fund_group: getNullableString(formData.get("fundGroup")),
      include_in_cash_reconciliation: getBooleanSelectValue(
        formData.get("includeInCashReconciliation"),
        "Include In Cash Reconciliation"
      ),
      include_in_standard_reporting: getBooleanSelectValue(
        formData.get("includeInStandardReporting"),
        "Include In Standard Reporting"
      ),
      major_fund_flag: getAllowedNullableValue({
        allowedValues: ["yes", "no"],
        fieldLabel: "Major Fund",
        value: getStringValue(formData.get("majorFundFlag"))
      }),
      reporting_exclusion_reason: getNullableString(
        formData.get("reportingExclusionReason")
      ),
      reporting_model: getAllowedNullableValue({
        allowedValues: [
          "governmental",
          "proprietary",
          "fiduciary",
          "component_unit",
          "other"
        ],
        fieldLabel: "Reporting Model",
        value: getStringValue(formData.get("reportingModel"))
      }),
      reporting_treatment: getAllowedValue({
        allowedValues: [
          "reportable",
          "pooled_cash",
          "reconciliation_only",
          "clearing",
          "elimination",
          "internal_service",
          "fiduciary_excluded",
          "other_excluded"
        ],
        fieldLabel: "Reporting Treatment",
        value: getStringValue(formData.get("reportingTreatment")) || "reportable"
      }),
      source_method: "manual",
      updated_at: new Date().toISOString(),
      updated_by: appUser.user_id
    };

    if (
      updatePayload.effective_start_date &&
      updatePayload.effective_end_date &&
      updatePayload.effective_end_date < updatePayload.effective_start_date
    ) {
      return manualUpdateError("Effective End cannot be before Effective Start.");
    }

    const updateResult = await adminClient
      .from("funds")
      .update(updatePayload)
      .eq("organization_id", appUser.organization_id)
      .eq("fund_id", fundId)
      .select(
        "fund_id, fund_code, fund_name, reporting_model, fund_group, major_fund_flag, reporting_treatment, include_in_standard_reporting, include_in_cash_reconciliation, reporting_exclusion_reason, active_status, effective_start_date, effective_end_date"
      )
      .single();

    if (updateResult.error) {
      return manualUpdateError(updateResult.error.message);
    }

    await adminClient.from("audit_logs").insert({
      action_type: "fund_manual_update",
      actor_user_id: appUser.user_id,
      after_payload: updateResult.data,
      before_payload: beforeResult.data,
      entity_id: fundId,
      entity_table: "funds",
      metadata: {
        route: "/imports/funds",
        updated_fields: [
          "reporting_model",
          "fund_group",
          "major_fund_flag",
          "reporting_treatment",
          "include_in_standard_reporting",
          "include_in_cash_reconciliation",
          "reporting_exclusion_reason",
          "active_status",
          "effective_start_date",
          "effective_end_date"
        ]
      },
      organization_id: appUser.organization_id
    });

    revalidatePath("/imports/funds");
    revalidatePath("/analysis/calculation-runs");

    return {
      message: `Fund ${beforeResult.data.fund_code} updated.`,
      status: "success"
    };
  } catch (error) {
    return manualUpdateError(
      error instanceof Error ? error.message : "Fund update failed."
    );
  }
}

function getMapping(formData: FormData): FundImportMapping {
  return {
    activeStatusColumn: getStringValue(formData.get("activeStatusColumn")) || "Active Status",
    changeReasonColumn: getStringValue(formData.get("changeReasonColumn")) || "Change Reason",
    effectiveEndDateColumn:
      getStringValue(formData.get("effectiveEndDateColumn")) || "Effective End Date",
    effectiveStartDateColumn:
      getStringValue(formData.get("effectiveStartDateColumn")) || "Effective Start Date",
    fundCodeColumn: getStringValue(formData.get("fundCodeColumn")) || "Fund Code",
    fundGroupColumn: getStringValue(formData.get("fundGroupColumn")) || "Fund Group",
    fundNameColumn: getStringValue(formData.get("fundNameColumn")) || "Fund Name",
    fundTypeColumn: getStringValue(formData.get("fundTypeColumn")) || "Fund Type",
    includeInCashReconciliationColumn:
      getStringValue(formData.get("includeInCashReconciliationColumn")) ||
      "Include In Cash Reconciliation",
    includeInStandardReportingColumn:
      getStringValue(formData.get("includeInStandardReportingColumn")) ||
      "Include In Standard Reporting",
    majorFundFlagColumn:
      getStringValue(formData.get("majorFundFlagColumn")) || "Major Fund Flag",
    reportingExclusionReasonColumn:
      getStringValue(formData.get("reportingExclusionReasonColumn")) ||
      "Reporting Exclusion Reason",
    reportingModelColumn:
      getStringValue(formData.get("reportingModelColumn")) || "Reporting Model",
    reportingTreatmentColumn:
      getStringValue(formData.get("reportingTreatmentColumn")) ||
      "Reporting Treatment"
  };
}

function getOptions(formData: FormData): FundImportOptions {
  return {
    fillMissingData: formData.get("fillMissingData") === "on",
    updateExisting: formData.get("updateExisting") === "on"
  };
}

function getStringValue(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function getNullableString(value: FormDataEntryValue | null) {
  const stringValue = getStringValue(value);
  return stringValue || null;
}

function getDateOrNull(value: FormDataEntryValue | null, fieldLabel: string) {
  const stringValue = getStringValue(value);
  if (!stringValue) return null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(stringValue)) {
    throw new Error(`${fieldLabel} must be a valid date.`);
  }

  return stringValue;
}

function getAllowedValue({
  allowedValues,
  fieldLabel,
  value
}: {
  allowedValues: string[];
  fieldLabel: string;
  value: string;
}) {
  if (!allowedValues.includes(value)) {
    throw new Error(`${fieldLabel} is not valid.`);
  }

  return value;
}

function getAllowedNullableValue({
  allowedValues,
  fieldLabel,
  value
}: {
  allowedValues: string[];
  fieldLabel: string;
  value: string;
}) {
  if (!value) return null;

  if (!allowedValues.includes(value)) {
    throw new Error(`${fieldLabel} is not valid.`);
  }

  return value;
}

function getBooleanSelectValue(
  value: FormDataEntryValue | null,
  fieldLabel: string
) {
  const stringValue = getStringValue(value);
  if (stringValue === "true") return true;
  if (stringValue === "false") return false;

  throw new Error(`${fieldLabel} is not valid.`);
}

function previewError(message: string): FundImportPreviewState {
  return {
    ...initialFundImportPreviewState,
    message,
    status: "error"
  };
}

function commitError(message: string): FundImportCommitState {
  return {
    ...initialFundImportCommitState,
    message,
    status: "error"
  };
}

function manualUpdateError(message: string): FundManualUpdateState {
  return {
    message,
    status: "error"
  };
}
