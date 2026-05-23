"use server";

import { revalidatePath } from "next/cache";

import { ensureAppUserForAuthUser } from "@/lib/auth/app-user";
import { requireUser } from "@/lib/auth/session";
import {
  commitSimpleReferenceRows,
  buildSimpleReferencePreview
} from "@/lib/imports/simple-reference-import";
import {
  getSimpleReferenceImportConfig
} from "@/lib/imports/simple-reference-import-config";
import {
  initialSimpleReferenceCommitState,
  initialSimpleReferencePreviewState,
  type SimpleReferenceCommitState,
  type SimpleReferenceImportOptions,
  type SimpleReferencePreviewRow,
  type SimpleReferencePreviewState
} from "@/lib/imports/simple-reference-import-state";
import { createAdminClient } from "@/lib/supabase/admin";

export async function previewSimpleReferenceImportAction(
  _previousState: SimpleReferencePreviewState,
  formData: FormData
): Promise<SimpleReferencePreviewState> {
  const route = getStringValue(formData.get("route"));
  const config = getSimpleReferenceImportConfig(route);

  if (!config) {
    return previewError("This reference import type is not supported.");
  }

  try {
    const authUser = await requireUser();
    const adminClient = createAdminClient();
    const appUser = await ensureAppUserForAuthUser(adminClient, authUser);
    const file = formData.get("referenceFile");

    if (!(file instanceof File) || file.size === 0) {
      return previewError(`Choose a CSV or Excel file before importing ${config.tableTitle}.`);
    }

    const headerRow = Math.max(
      Number.parseInt(getStringValue(formData.get("headerRow")), 10) || 1,
      1
    );
    const options = getOptions(formData);
    const preview = await buildSimpleReferencePreview({
      adminClient,
      config,
      file,
      headerRow,
      mapping: getMapping(formData, config.fields.map((field) => field.key)),
      options,
      organizationId: appUser.organization_id,
      sheetReference: getStringValue(formData.get("sheetReference"))
    });

    await adminClient.from("audit_logs").insert({
      action_type: `${config.auditPrefix}_import_preview_generated`,
      actor_user_id: appUser.user_id,
      after_payload: {
        issue_count: preview.issues.length,
        row_count: preview.rows.length,
        selected_sheet_name: preview.selectedSheetName
      },
      entity_table: config.targetTable,
      metadata: {
        route: `/imports/${config.route}`,
        temporary_preview_only: true
      },
      organization_id: appUser.organization_id
    });

    return {
      ...initialSimpleReferencePreviewState,
      message:
        "Preview generated. Review the staged rows before committing. Edits here do not update the saved table until commit.",
      options,
      preview: {
        deletedFromPreview: 0,
        route: config.route,
        ...preview
      },
      status: "success"
    };
  } catch (error) {
    return previewError(
      error instanceof Error
        ? error.message
        : `${config.tableTitle} import preview failed.`
    );
  }
}

export async function commitSimpleReferenceImportAction(
  _previousState: SimpleReferenceCommitState,
  formData: FormData
): Promise<SimpleReferenceCommitState> {
  const route = getStringValue(formData.get("route"));
  const config = getSimpleReferenceImportConfig(route);

  if (!config) {
    return commitError("This reference import type is not supported.");
  }

  try {
    const authUser = await requireUser();
    const adminClient = createAdminClient();
    const appUser = await ensureAppUserForAuthUser(adminClient, authUser);
    const rowsJson = getStringValue(formData.get("rowsJson"));

    if (!rowsJson) {
      return commitError("No staged rows were provided for commit.");
    }

    const rows = JSON.parse(rowsJson) as SimpleReferencePreviewRow[];
    const result = await commitSimpleReferenceRows({
      adminClient,
      changeDescription:
        getStringValue(formData.get("changeDescription")) ||
        `${config.tableTitle} import from /imports/${config.route}`,
      config,
      organizationId: appUser.organization_id,
      options: getOptions(formData),
      rows,
      userId: appUser.user_id
    });

    revalidatePath(`/imports/${config.route}`);
    revalidatePath("/imports/reference");

    return {
      ...initialSimpleReferenceCommitState,
      message: `${config.tableTitle} import committed. Inserted ${result.inserted}, updated ${result.updated}, filled missing ${result.filledMissing}, skipped ${result.skipped}, rejected ${result.rejected}, deleted from preview ${result.deletedFromPreview}.`,
      result,
      status: "success"
    };
  } catch (error) {
    return commitError(
      error instanceof Error ? error.message : `${config.tableTitle} import commit failed.`
    );
  }
}

function getMapping(formData: FormData, fieldKeys: string[]) {
  return Object.fromEntries(
    fieldKeys.map((fieldKey) => [fieldKey, getStringValue(formData.get(fieldKey))])
  );
}

function getOptions(formData: FormData): SimpleReferenceImportOptions {
  return {
    fillMissingData: formData.get("fillMissingData") === "on",
    updateExisting: formData.get("updateExisting") === "on"
  };
}

function getStringValue(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function previewError(message: string): SimpleReferencePreviewState {
  return {
    ...initialSimpleReferencePreviewState,
    message,
    status: "error"
  };
}

function commitError(message: string): SimpleReferenceCommitState {
  return {
    ...initialSimpleReferenceCommitState,
    message,
    status: "error"
  };
}
