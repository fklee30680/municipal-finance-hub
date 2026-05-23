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
    majorFundFlagColumn:
      getStringValue(formData.get("majorFundFlagColumn")) || "Major Fund Flag",
    reportingModelColumn:
      getStringValue(formData.get("reportingModelColumn")) || "Reporting Model"
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
