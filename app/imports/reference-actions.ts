"use server";

import { revalidatePath } from "next/cache";

import { ensureAppUserForAuthUser } from "@/lib/auth/app-user";
import { requireUser } from "@/lib/auth/session";
import {
  commitSimpleReferenceRows,
  buildSimpleReferencePreview
} from "@/lib/imports/simple-reference-import";
import {
  getSimpleReferenceImportConfig,
  type SimpleReferenceEditableField
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

export type SimpleReferenceManualUpdateState = {
  message: string | null;
  status: "idle" | "success" | "error";
};

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

export async function updateSimpleReferenceManualAction(
  _previousState: SimpleReferenceManualUpdateState,
  formData: FormData
): Promise<SimpleReferenceManualUpdateState> {
  const route = getStringValue(formData.get("route"));
  const config = getSimpleReferenceImportConfig(route);

  if (!config) {
    return manualUpdateError("This reference type is not supported.");
  }

  try {
    const authUser = await requireUser();
    const adminClient = createAdminClient();
    const appUser = await ensureAppUserForAuthUser(adminClient, authUser);
    const rowId = getStringValue(formData.get("rowId"));

    if (!rowId) {
      return manualUpdateError("Reference row ID was not provided.");
    }

    const selectedFields = getManualUpdateSelectFields(config);
    const beforeResult = await adminClient
      .from(config.targetTable)
      .select(selectedFields)
      .eq("organization_id", appUser.organization_id)
      .eq(config.idField, rowId)
      .maybeSingle<Record<string, unknown>>();

    if (beforeResult.error) {
      return manualUpdateError(beforeResult.error.message);
    }

    if (!beforeResult.data) {
      return manualUpdateError(`${config.tableTitle} row could not be found.`);
    }

    const updatePayload = buildManualUpdatePayload({
      beforeRow: beforeResult.data,
      fields: config.manualEditableFields,
      formData,
      userId: appUser.user_id
    });

    const effectiveStart = String(updatePayload.effective_start_date ?? "");
    const effectiveEnd = String(updatePayload.effective_end_date ?? "");

    if (effectiveStart && effectiveEnd && effectiveEnd < effectiveStart) {
      return manualUpdateError("Effective End cannot be before Effective Start.");
    }

    const updateResult = await adminClient
      .from(config.targetTable)
      .update(updatePayload)
      .eq("organization_id", appUser.organization_id)
      .eq(config.idField, rowId)
      .select(selectedFields)
      .single<Record<string, unknown>>();

    if (updateResult.error) {
      return manualUpdateError(updateResult.error.message);
    }

    await adminClient.from("audit_logs").insert({
      action_type: `${config.auditPrefix}_manual_update`,
      actor_user_id: appUser.user_id,
      after_payload: updateResult.data,
      before_payload: beforeResult.data,
      entity_id: rowId,
      entity_table: config.targetTable,
      metadata: {
        route: `/imports/${config.route}`,
        updated_fields: config.manualEditableFields.map((field) => field.dbField)
      },
      organization_id: appUser.organization_id
    });

    revalidatePath(`/imports/${config.route}`);
    revalidatePath(`/reference-data/${config.route}`);
    revalidatePath("/reference-data");
    revalidatePath("/imports/reference");
    revalidatePath("/analysis/calculation-runs");

    return {
      message: `${config.tableTitle} ${beforeResult.data[config.codeField] ?? ""} updated.`,
      status: "success"
    };
  } catch (error) {
    return manualUpdateError(
      error instanceof Error
        ? error.message
        : `${config.tableTitle} manual update failed.`
    );
  }
}

export async function createSimpleReferenceManualAction(
  _previousState: SimpleReferenceManualUpdateState,
  formData: FormData
): Promise<SimpleReferenceManualUpdateState> {
  const route = getStringValue(formData.get("route"));
  const config = getSimpleReferenceImportConfig(route);

  if (!config) {
    return manualUpdateError("This reference type is not supported.");
  }

  try {
    const authUser = await requireUser();
    const adminClient = createAdminClient();
    const appUser = await ensureAppUserForAuthUser(adminClient, authUser);
    const code = getStringValue(formData.get("code"));
    const name = getStringValue(formData.get("name"));

    if (!code) {
      return manualUpdateError(`${config.codeLabel} is required.`);
    }

    if (!name) {
      return manualUpdateError("Name is required.");
    }

    const existingResult = await adminClient
      .from(config.targetTable)
      .select(`${config.idField}, active_status`)
      .eq("organization_id", appUser.organization_id)
      .eq(config.codeField, code)
      .limit(1)
      .maybeSingle<Record<string, unknown>>();

    if (existingResult.error) {
      return manualUpdateError(existingResult.error.message);
    }

    if (existingResult.data) {
      return manualUpdateError(
        `${config.codeLabel} ${code} already exists. Edit or reactivate the existing row instead.`
      );
    }

    const createPayload = buildManualCreatePayload({
      code,
      config,
      formData,
      name,
      userId: appUser.user_id,
      organizationId: appUser.organization_id
    });
    const effectiveStart = String(createPayload.effective_start_date ?? "");
    const effectiveEnd = String(createPayload.effective_end_date ?? "");

    if (effectiveStart && effectiveEnd && effectiveEnd < effectiveStart) {
      return manualUpdateError("Effective End cannot be before Effective Start.");
    }

    const selectedFields = getManualUpdateSelectFields(config);
    const createResult = await adminClient
      .from(config.targetTable)
      .insert(createPayload)
      .select(selectedFields)
      .single<Record<string, unknown>>();

    if (createResult.error) {
      return manualUpdateError(createResult.error.message);
    }

    await adminClient.from("audit_logs").insert({
      action_type: `${config.auditPrefix}_manual_create`,
      actor_user_id: appUser.user_id,
      after_payload: createResult.data,
      entity_id: String(createResult.data[config.idField] ?? ""),
      entity_table: config.targetTable,
      metadata: {
        route: `/reference-data/${config.route}`,
        created_fields: Object.keys(createPayload)
      },
      organization_id: appUser.organization_id
    });

    revalidatePath(`/reference-data/${config.route}`);
    revalidatePath("/reference-data");
    revalidatePath(`/imports/${config.route}`);
    revalidatePath("/analysis/calculation-runs");

    return {
      message: `${config.tableTitle} ${code} created.`,
      status: "success"
    };
  } catch (error) {
    return manualUpdateError(
      error instanceof Error
        ? error.message
        : `${config.tableTitle} manual create failed.`
    );
  }
}

export async function setSimpleReferenceManualStatusAction(
  _previousState: SimpleReferenceManualUpdateState,
  formData: FormData
): Promise<SimpleReferenceManualUpdateState> {
  const route = getStringValue(formData.get("route"));
  const config = getSimpleReferenceImportConfig(route);

  if (!config) {
    return manualUpdateError("This reference type is not supported.");
  }

  try {
    const authUser = await requireUser();
    const adminClient = createAdminClient();
    const appUser = await ensureAppUserForAuthUser(adminClient, authUser);
    const rowId = getStringValue(formData.get("rowId"));
    const targetStatus = getStringValue(formData.get("targetStatus"));

    if (!rowId) {
      return manualUpdateError("Reference row ID was not provided.");
    }

    if (!["active", "inactive"].includes(targetStatus)) {
      return manualUpdateError("Target status is not valid.");
    }

    const selectedFields = getManualUpdateSelectFields(config);
    const beforeResult = await adminClient
      .from(config.targetTable)
      .select(selectedFields)
      .eq("organization_id", appUser.organization_id)
      .eq(config.idField, rowId)
      .maybeSingle<Record<string, unknown>>();

    if (beforeResult.error) {
      return manualUpdateError(beforeResult.error.message);
    }

    if (!beforeResult.data) {
      return manualUpdateError(`${config.tableTitle} row could not be found.`);
    }

    const changeReason = getStringValue(formData.get("changeReason"));
    const updatePayload: Record<string, unknown> = {
      active_status: targetStatus,
      source_method: "manual",
      updated_at: new Date().toISOString(),
      updated_by: appUser.user_id
    };

    if (
      changeReason &&
      config.manualEditableFields.some((field) => field.dbField === "change_reason")
    ) {
      updatePayload.change_reason = changeReason;
    }

    const updateResult = await adminClient
      .from(config.targetTable)
      .update(updatePayload)
      .eq("organization_id", appUser.organization_id)
      .eq(config.idField, rowId)
      .select(selectedFields)
      .single<Record<string, unknown>>();

    if (updateResult.error) {
      return manualUpdateError(updateResult.error.message);
    }

    const action = targetStatus === "active" ? "reactivate" : "deactivate";

    await adminClient.from("audit_logs").insert({
      action_type: `${config.auditPrefix}_manual_${action}`,
      actor_user_id: appUser.user_id,
      after_payload: updateResult.data,
      before_payload: beforeResult.data,
      entity_id: rowId,
      entity_table: config.targetTable,
      metadata: {
        route: `/reference-data/${config.route}`,
        target_status: targetStatus
      },
      organization_id: appUser.organization_id
    });

    revalidatePath(`/reference-data/${config.route}`);
    revalidatePath("/reference-data");
    revalidatePath(`/imports/${config.route}`);
    revalidatePath("/analysis/calculation-runs");

    return {
      message: `${config.tableTitle} ${beforeResult.data[config.codeField] ?? ""} ${targetStatus === "active" ? "reactivated" : "deactivated"}.`,
      status: "success"
    };
  } catch (error) {
    return manualUpdateError(
      error instanceof Error
        ? error.message
        : `${config.tableTitle} status update failed.`
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

function buildManualUpdatePayload({
  beforeRow,
  fields,
  formData,
  userId
}: {
  beforeRow: Record<string, unknown>;
  fields: SimpleReferenceEditableField[];
  formData: FormData;
  userId: string;
}) {
  const payload: Record<string, unknown> = {
    source_method: "manual",
    updated_at: new Date().toISOString(),
    updated_by: userId
  };

  for (const field of fields) {
    const value = getStringValue(formData.get(field.formKey));

    if (field.inputType === "select") {
      const existingValue =
        beforeRow[field.dbField] === null || beforeRow[field.dbField] === undefined
          ? ""
          : String(beforeRow[field.dbField]);
      const allowedValues = new Set([
        ...(field.options?.map((option) => option.value) ?? []),
        existingValue
      ]);
      if (!allowedValues.has(value)) {
        throw new Error(`${field.label} is not valid.`);
      }

      payload[field.dbField] = value;
      continue;
    }

    if (field.inputType === "date") {
      payload[field.dbField] = getDateOrNull(value, field.label);
      continue;
    }

    payload[field.dbField] = value || (field.nullable === false ? "" : null);
  }

  return payload;
}

function buildManualCreatePayload({
  code,
  config,
  formData,
  name,
  organizationId,
  userId
}: {
  code: string;
  config: NonNullable<ReturnType<typeof getSimpleReferenceImportConfig>>;
  formData: FormData;
  name: string;
  organizationId: string;
  userId: string;
}): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    [config.codeField]: code,
    [config.nameField]: name,
    active_status: "active",
    created_by: userId,
    organization_id: organizationId,
    source_method: "manual",
    updated_at: new Date().toISOString(),
    updated_by: userId
  };

  const manualPayload = buildManualUpdatePayload({
    beforeRow: {},
    fields: config.manualEditableFields,
    formData,
    userId
  });

  return {
    ...payload,
    ...manualPayload,
    active_status: String(manualPayload.active_status ?? "active") || "active"
  };
}

function getDateOrNull(value: string, fieldLabel: string) {
  if (!value) return null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${fieldLabel} must be a valid date.`);
  }

  return value;
}

function getManualUpdateSelectFields(
  config: NonNullable<ReturnType<typeof getSimpleReferenceImportConfig>>
) {
  return Array.from(
    new Set([
      config.idField,
      config.codeField,
      config.nameField,
      ...config.manualEditableFields.map((field) => field.dbField),
      "source_method",
      "updated_at",
      "updated_by"
    ])
  ).join(", ");
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

function manualUpdateError(message: string): SimpleReferenceManualUpdateState {
  return {
    message,
    status: "error"
  };
}
