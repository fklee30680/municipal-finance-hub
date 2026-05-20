"use server";

import { revalidatePath } from "next/cache";

import { ensureAppUserForAuthUser } from "@/lib/auth/app-user";
import { requireUser } from "@/lib/auth/session";
import { isSupportedMappingImportType } from "@/lib/imports/mapping-import";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupportedImportTypeCode } from "@/lib/uploads/config";
import { getRequiredTargetFieldNames } from "@/lib/templates/target-fields";
import type { TemplateSaveState } from "@/lib/templates/template-state";

export async function createImportTemplate(
  _previousState: TemplateSaveState,
  formData: FormData
): Promise<TemplateSaveState> {
  return saveTemplateVersion({
    formData,
    mode: "create"
  });
}

export async function createImportTemplateVersion(
  _previousState: TemplateSaveState,
  formData: FormData
): Promise<TemplateSaveState> {
  return saveTemplateVersion({
    formData,
    mode: "edit"
  });
}

async function saveTemplateVersion({
  formData,
  mode
}: {
  formData: FormData;
  mode: "create" | "edit";
}): Promise<TemplateSaveState> {
  try {
    const authUser = await requireUser();
    const adminClient = createAdminClient();
    const appUser = await ensureAppUserForAuthUser(adminClient, authUser);

    const templateId = getStringValue(formData.get("templateId"));
    const templateName = getStringValue(formData.get("templateName"));
    const templateDescription = getStringValue(
      formData.get("templateDescription")
    );
    const importTypeId = getStringValue(formData.get("importTypeId"));
    const sourceFileId = getStringValue(formData.get("sourceFileId"));
    const fileType = getStringValue(formData.get("fileType"));
    const accountStructureId = getStringValue(formData.get("accountStructureId"));
    const sheetCount = parseInteger(getStringValue(formData.get("sheetCount")), 0);

    if (!templateName && mode === "create") {
      return errorState("Template name is required.");
    }

    if (!importTypeId) {
      return errorState("Import type is required.");
    }

    if (!sourceFileId) {
      return errorState("Sample source file is required.");
    }

    if (!fileType) {
      return errorState("File type is required.");
    }

    const importTypeResult = await adminClient
      .from("import_types")
      .select("import_type_id, import_type_code, import_type_name")
      .eq("organization_id", appUser.organization_id)
      .eq("import_type_id", importTypeId)
      .eq("active_status", "active")
      .maybeSingle<{
        import_type_id: string;
        import_type_code: string;
        import_type_name: string;
      }>();

    if (importTypeResult.error) {
      return errorState(importTypeResult.error.message);
    }

    if (!importTypeResult.data) {
      return errorState("Selected import type is not active.");
    }

    if (!isSupportedImportTypeCode(importTypeResult.data.import_type_code)) {
      return errorState("Selected import type is not supported for templates.");
    }

    const importType = importTypeResult.data;

    if (
      importType.import_type_code === "trial_balance" &&
      !accountStructureId
    ) {
      return errorState("Trial balance templates require an account structure.");
    }

    const templateRecord =
      mode === "create"
        ? await createTemplateRecord({
            adminClient,
            organizationId: appUser.organization_id,
            importTypeId,
            accountStructureId,
            templateDescription,
            templateName,
            userId: appUser.user_id
          })
        : await getTemplateRecord({
            adminClient,
            organizationId: appUser.organization_id,
            templateId
          });

    if (!templateRecord.ok) {
      return errorState(templateRecord.message);
    }

    const nextVersionNumber =
      mode === "create" && templateRecord.createdNew
        ? 1
        : await getNextVersionNumber({
            adminClient,
            templateId: templateRecord.templateId
          });

    const sheetConfigs = collectSheetConfigs({
      formData,
      importTypeCode: importType.import_type_code,
      sheetCount
    });

    if (isSupportedMappingImportType(importType.import_type_code)) {
      const activeSheetCount = sheetConfigs.filter((sheet) => !sheet.ignoreSheet).length;

      if (activeSheetCount !== 1) {
        return errorState(
          "Mapping templates must keep exactly one active selected sheet. Object, ACFR, Department, Function, and Fund imports are separate mapping imports."
        );
      }
    }

    const missingRequiredFields = getMissingRequiredFields({
      importTypeCode: importType.import_type_code,
      sheetConfigs
    });

    if (missingRequiredFields.length > 0) {
      return errorState(
        `Missing required mappings: ${missingRequiredFields.join(", ")}.`
      );
    }

    const transformationRules = formData
      .getAll("transformationRules")
      .filter((value): value is string => typeof value === "string");

    const templateVersionResult = await adminClient
      .from("import_template_versions")
      .insert({
          organization_id: appUser.organization_id,
          import_template_id: templateRecord.templateId,
        version_number: nextVersionNumber,
        version_status: "active",
        account_structure_id: accountStructureId || null,
        source_file_id: sourceFileId,
        file_type: fileType,
        header_row_default: sheetConfigs[0]?.headerRow ?? null,
        data_start_row_default: sheetConfigs[0]?.dataStartRow ?? null,
        data_end_rule: "until_blank_or_end",
        configuration: {
          import_type_code: importType.import_type_code,
          transformation_rules: transformationRules,
          template_builder_version: 1,
          note: "Template configuration only. No data is parsed or posted in Slice 4."
        },
        source_sample_payload: {
          source_file_id: sourceFileId,
          sheet_count: sheetConfigs.length,
          sheets: sheetConfigs.map((sheet) => ({
            sheet_name: sheet.sheetName,
            sheet_index: sheet.sheetIndex,
            ignored: sheet.ignoreSheet,
            header_row: sheet.headerRow,
            data_start_row: sheet.dataStartRow,
            column_count: sheet.columns.length
          }))
        },
        created_by: appUser.user_id,
        updated_by: appUser.user_id
      })
      .select("template_version_id")
      .single<{ template_version_id: string }>();

    if (templateVersionResult.error) {
      return errorState(templateVersionResult.error.message);
    }

    for (const sheet of sheetConfigs) {
      const sheetMappingResult = await adminClient
        .from("sheet_mappings")
        .insert({
          organization_id: appUser.organization_id,
          template_version_id: templateVersionResult.data.template_version_id,
          sheet_name: sheet.sheetName,
          sheet_index: sheet.sheetIndex,
          header_row_number: sheet.headerRow,
          data_start_row_number: sheet.dataStartRow,
          target_import_type_id: importTypeId,
          target_entity: importType.import_type_code,
          ignore_sheet: sheet.ignoreSheet,
          active_status: sheet.ignoreSheet ? "inactive" : "active"
        })
        .select("sheet_mapping_id")
        .single<{ sheet_mapping_id: string }>();

      if (sheetMappingResult.error) {
        return errorState(sheetMappingResult.error.message);
      }

      if (!sheet.ignoreSheet) {
        const fieldRows = sheet.columns.map((column) => ({
          organization_id: appUser.organization_id,
          template_version_id: templateVersionResult.data.template_version_id,
          sheet_mapping_id: sheetMappingResult.data.sheet_mapping_id,
          source_field_name: column.sourceColumnName,
          source_column_index: column.sourceColumnIndex,
          target_field_name: column.targetFieldName || "__ignored__",
          target_entity: importType.import_type_code,
          target_field_required: column.required,
          default_value: column.defaultValue || null,
          ignore_column: !column.targetFieldName,
          active_status: column.targetFieldName ? "active" : "inactive"
        }));

        if (fieldRows.length > 0) {
          const fieldResult = await adminClient.from("field_mappings").insert(fieldRows);

          if (fieldResult.error) {
            return errorState(fieldResult.error.message);
          }
        }
      }
    }

    const transformationRows = transformationRules.map((ruleName, index) => ({
      organization_id: appUser.organization_id,
      template_version_id: templateVersionResult.data.template_version_id,
      rule_name: ruleName,
      rule_order: index + 1,
      rule_config: {
        enabled: true
      },
      active_status: "active"
    }));

    if (transformationRows.length > 0) {
      const transformResult = await adminClient
        .from("transformation_rules")
        .insert(transformationRows);

      if (transformResult.error) {
        return errorState(transformResult.error.message);
      }
    }

    await adminClient.from("import_batches").update({
      import_template_id: templateRecord.templateId,
      template_version_id: templateVersionResult.data.template_version_id,
      account_structure_id: accountStructureId || null,
      updated_by: appUser.user_id,
      metadata: {
        template_version_selected: true,
        selected_template_version_id:
          templateVersionResult.data.template_version_id
      }
    }).eq("organization_id", appUser.organization_id).eq("source_file_id", sourceFileId);

    await adminClient.from("audit_logs").insert({
      organization_id: appUser.organization_id,
      actor_user_id: appUser.user_id,
      action_type:
        mode === "create" && templateRecord.createdNew
          ? "import_template_created"
          : "import_template_version_created",
      entity_table: "import_template_versions",
      entity_id: templateVersionResult.data.template_version_id,
      after_payload: {
        import_template_id: templateRecord.templateId,
        version_number: nextVersionNumber,
        source_file_id: sourceFileId
      },
      metadata: {
        sheet_count: sheetConfigs.length,
        transformation_count: transformationRows.length
      }
    });

    revalidatePath("/imports/templates");
    revalidatePath(`/imports/templates/${templateRecord.templateId}`);
    revalidatePath(`/imports/templates/${templateRecord.templateId}/edit`);
    revalidatePath("/imports");

    return {
      status: "success",
      message: `${
        mode === "create" && !templateRecord.createdNew
          ? "Existing template name found, so a new version was created."
          : "Template"
      } version ${nextVersionNumber} saved. This configuration has not parsed, validated, posted, or activated financial data.`
    };
  } catch (error) {
    return errorState(
      error instanceof Error
        ? error.message
        : "Template could not be saved."
    );
  }
}

async function createTemplateRecord({
  adminClient,
  organizationId,
  importTypeId,
  accountStructureId,
  templateDescription,
  templateName,
  userId
}: {
  adminClient: ReturnType<typeof createAdminClient>;
  organizationId: string;
  importTypeId: string;
  accountStructureId: string;
  templateDescription: string;
  templateName: string;
  userId: string;
}) {
  const existingTemplate = await adminClient
    .from("import_templates")
    .select("import_template_id")
    .eq("organization_id", organizationId)
    .eq("import_type_id", importTypeId)
    .eq("template_name", templateName)
    .maybeSingle<{ import_template_id: string }>();

  if (existingTemplate.error) {
    return {
      ok: false as const,
      message: existingTemplate.error.message
    };
  }

  if (existingTemplate.data) {
    return {
      createdNew: false,
      ok: true as const,
      templateId: existingTemplate.data.import_template_id
    };
  }

  const insertResult = await adminClient
    .from("import_templates")
    .insert({
      organization_id: organizationId,
      import_type_id: importTypeId,
      account_structure_id: accountStructureId || null,
      template_name: templateName,
      template_description: templateDescription || null,
      active_status: "active",
      created_by: userId,
      updated_by: userId
    })
    .select("import_template_id")
    .single<{ import_template_id: string }>();

  if (insertResult.error) {
    if (insertResult.error.code === "23505") {
      const duplicateTemplate = await adminClient
        .from("import_templates")
        .select("import_template_id")
        .eq("organization_id", organizationId)
        .eq("import_type_id", importTypeId)
        .eq("template_name", templateName)
        .maybeSingle<{ import_template_id: string }>();

      if (!duplicateTemplate.error && duplicateTemplate.data) {
        return {
          createdNew: false,
          ok: true as const,
          templateId: duplicateTemplate.data.import_template_id
        };
      }
    }

    return {
      ok: false as const,
      message: insertResult.error.message
    };
  }

  return {
    createdNew: true,
    ok: true as const,
    templateId: insertResult.data.import_template_id
  };
}

async function getTemplateRecord({
  adminClient,
  organizationId,
  templateId
}: {
  adminClient: ReturnType<typeof createAdminClient>;
  organizationId: string;
  templateId: string;
}) {
  if (!templateId) {
    return {
      ok: false as const,
      message: "Template ID is required for editing."
    };
  }

  const templateResult = await adminClient
    .from("import_templates")
    .select("import_template_id")
    .eq("organization_id", organizationId)
    .eq("import_template_id", templateId)
    .maybeSingle<{ import_template_id: string }>();

  if (templateResult.error) {
    return {
      ok: false as const,
      message: templateResult.error.message
    };
  }

  if (!templateResult.data) {
    return {
      ok: false as const,
      message: "Template was not found."
    };
  }

  return {
    createdNew: false,
    ok: true as const,
    templateId: templateResult.data.import_template_id
  };
}

async function getNextVersionNumber({
  adminClient,
  templateId
}: {
  adminClient: ReturnType<typeof createAdminClient>;
  templateId: string;
}) {
  const latestVersion = await adminClient
    .from("import_template_versions")
    .select("version_number")
    .eq("import_template_id", templateId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle<{ version_number: number }>();

  if (latestVersion.error) {
    throw new Error(latestVersion.error.message);
  }

  return (latestVersion.data?.version_number ?? 0) + 1;
}

function collectSheetConfigs({
  formData,
  importTypeCode,
  sheetCount
}: {
  formData: FormData;
  importTypeCode: string;
  sheetCount: number;
}) {
  const requiredTargetFields = new Set(getRequiredTargetFieldNames(importTypeCode));

  return Array.from({ length: sheetCount }, (_, sheetIndex) => {
    const columnCount = parseInteger(
      getStringValue(formData.get(`sheet_${sheetIndex}_columnCount`)),
      0
    );

    return {
      sheetName: getStringValue(formData.get(`sheet_${sheetIndex}_name`)),
      sheetIndex: parseInteger(
        getStringValue(formData.get(`sheet_${sheetIndex}_index`)),
        sheetIndex
      ),
      ignoreSheet: formData.get(`sheet_${sheetIndex}_ignore`) === "on",
      headerRow: parseInteger(
        getStringValue(formData.get(`sheet_${sheetIndex}_headerRow`)),
        1
      ),
      dataStartRow: parseInteger(
        getStringValue(formData.get(`sheet_${sheetIndex}_dataStartRow`)),
        2
      ),
      columns: Array.from({ length: columnCount }, (_, columnIndex) => {
        const targetFieldName = getStringValue(
          formData.get(`sheet_${sheetIndex}_column_${columnIndex}_target`)
        );

        return {
          sourceColumnIndex: parseInteger(
            getStringValue(
              formData.get(`sheet_${sheetIndex}_column_${columnIndex}_index`)
            ),
            columnIndex
          ),
          sourceColumnName: getStringValue(
            formData.get(`sheet_${sheetIndex}_column_${columnIndex}_name`)
          ),
          targetFieldName,
          defaultValue: getStringValue(
            formData.get(`sheet_${sheetIndex}_column_${columnIndex}_default`)
          ),
          required: requiredTargetFields.has(targetFieldName)
        };
      })
    };
  }).filter((sheet) => sheet.sheetName);
}

function getMissingRequiredFields({
  importTypeCode,
  sheetConfigs
}: {
  importTypeCode: string;
  sheetConfigs: ReturnType<typeof collectSheetConfigs>;
}) {
  const mappedTargets = new Set(
    sheetConfigs
      .filter((sheet) => !sheet.ignoreSheet)
      .flatMap((sheet) => sheet.columns)
      .map((column) => column.targetFieldName)
      .filter(Boolean)
  );

  return getRequiredTargetFieldNames(importTypeCode).filter(
    (requiredField) => !mappedTargets.has(requiredField)
  );
}

function getStringValue(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function parseInteger(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function errorState(message: string): TemplateSaveState {
  return {
    status: "error",
    message
  };
}
