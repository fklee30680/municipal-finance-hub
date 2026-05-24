import "server-only";

import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { postingRoleNames, userHasAnyRole } from "@/lib/auth/permissions";

type ImportBatchRecord = {
  import_batch_id: string;
  organization_id: string;
  import_type_id: string;
  source_file_id: string | null;
  template_version_id: string | null;
  account_structure_id: string | null;
  fiscal_year: number | null;
  period: number | null;
  batch_status: string;
  is_active_for_reporting: boolean;
  reporting_status: string;
  active_status: string;
  warning_count: number;
  supersedes_import_batch_id: string | null;
  superseded_by_import_batch_id: string | null;
  metadata: Record<string, unknown> | null;
};

type ImportTypeRecord = {
  import_type_code: string;
};

type ValidationRunRecord = {
  validation_run_id: string;
  import_batch_id: string;
  source_file_id: string;
  import_template_version_id: string;
  account_structure_id: string;
  preview_run_id: string;
  status: string;
  eligible_to_post: boolean;
  warnings_acknowledged: boolean;
  critical_error_count: number;
  warning_count: number;
  information_count: number;
  rows_validated: number;
  rows_rejected: number;
};

type PreviewRowRecord = {
  preview_row_id: string;
  source_row_number: number;
  full_account_number: string | null;
  fund_code: string | null;
  acfr_code: string | null;
  department_code: string | null;
  function_code: string | null;
  object_code: string | null;
  account_name: string | null;
  beginning_balance: number | string | null;
  debits: number | string | null;
  credits: number | string | null;
  net_change: number | string | null;
  ending_balance: number | string | null;
};

type CriticalExceptionRecord = {
  exception_code: string;
  preview_row_id: string | null;
};

type MappingVersionLinkRecord = {
  mapping_version_id: string;
  mapping_type: "fund" | "object" | "acfr" | "department" | "function";
};

type SegmentDefinitionRecord = {
  account_segment_definition_id: string;
  segment_number: number;
  segment_name: string;
  segment_key: string;
};

type ActivePeriodImport = {
  import_batch_id: string;
  fiscal_year: number | null;
  period: number | null;
  batch_status: string;
  posted_at: string | null;
  rows_processed: number;
  source_files: { original_file_name: string } | Array<{ original_file_name: string }> | null;
};

type WorkflowRequestRecord = {
  inactivation_request_id: string;
  organization_id: string;
  existing_import_batch_id: string | null;
  replacement_import_batch_id: string | null;
  request_status: string;
  approval_status: string | null;
  request_reason: string;
};

export async function findActivePeriodImport({
  adminClient,
  excludeImportBatchId,
  fiscalYear,
  organizationId,
  period
}: {
  adminClient: SupabaseClient;
  excludeImportBatchId?: string;
  fiscalYear: number | null;
  organizationId: string;
  period: number | null;
}) {
  if (!fiscalYear || period === null || period === undefined) {
    return null;
  }

  let query = adminClient
    .from("import_batches")
    .select(
      `
      import_batch_id,
      fiscal_year,
      period,
      batch_status,
      posted_at,
      rows_processed,
      source_files (
        original_file_name
      )
    `
    )
    .eq("organization_id", organizationId)
    .eq("fiscal_year", fiscalYear)
    .eq("period", period)
    .eq("is_active_for_reporting", true)
    .eq("reporting_status", "included")
    .eq("active_status", "active")
    .in("batch_status", ["posted", "posted_with_exceptions"])
    .order("posted_at", { ascending: false })
    .limit(1);

  if (excludeImportBatchId) {
    query = query.neq("import_batch_id", excludeImportBatchId);
  }

  const result = await query.maybeSingle<ActivePeriodImport>();

  if (result.error) {
    throw new Error(result.error.message);
  }

  return result.data ?? null;
}

export async function postValidatedTrialBalance({
  adminClient,
  importBatchId,
  organizationId,
  postingMode = "normal",
  replacementRequestId,
  userId
}: {
  adminClient: SupabaseClient;
  importBatchId: string;
  organizationId: string;
  postingMode?: "normal" | "replacement";
  replacementRequestId?: string;
  userId: string;
}) {
  await requirePostingPermission({ adminClient, organizationId, userId });

  const context = await loadPostingContext({
    adminClient,
    importBatchId,
    organizationId
  });
  const {
    batch,
    criticalExceptions,
    mappingVersionLinks,
    previewRows,
    segmentDefinitions,
    validationRun
  } = context;

  if (
    ["posted", "posted_with_exceptions"].includes(batch.batch_status) ||
    batch.is_active_for_reporting
  ) {
    throw new Error("This import batch has already been posted.");
  }

  validatePostingEligibility({
    criticalExceptions,
    postingMode,
    validationRun
  });

  const activeConflict = await findActivePeriodImport({
    adminClient,
    excludeImportBatchId: importBatchId,
    fiscalYear: batch.fiscal_year,
    organizationId,
    period: batch.period
  });

  let replacementRequest: WorkflowRequestRecord | null = null;
  if (activeConflict && postingMode === "normal") {
    throw new Error("Active posted data already exists for this fiscal year and period. Request replacement before posting.");
  }

  if (postingMode === "replacement") {
    if (!replacementRequestId) {
      throw new Error("Approved replacement request is required for replacement posting.");
    }

    replacementRequest = await loadApprovedReplacementRequest({
      adminClient,
      organizationId,
      replacementRequestId
    });

    if (replacementRequest.replacement_import_batch_id !== importBatchId) {
      throw new Error("Replacement request does not belong to this import batch.");
    }
  }

  if (!batch.fiscal_year || batch.period === null || batch.period === undefined) {
    throw new Error("Fiscal year and period are required before posting.");
  }

  const postingRunId = randomUUID();
  const now = new Date().toISOString();

  const postingRunResult = await adminClient.from("posting_runs").insert({
    posting_run_id: postingRunId,
    organization_id: organizationId,
    import_batch_id: importBatchId,
    source_file_id: validationRun.source_file_id,
    import_template_version_id: validationRun.import_template_version_id,
    account_structure_id: validationRun.account_structure_id,
    validation_run_id: validationRun.validation_run_id,
    status: "running",
    posting_mode: postingMode,
    posted_by: userId,
    created_at: now,
    metadata: {
      replacement_request_id: replacementRequestId ?? null
    }
  });

  if (postingRunResult.error) {
    throw new Error(postingRunResult.error.message);
  }

  try {
    if (postingMode === "replacement" && replacementRequest?.existing_import_batch_id) {
      await supersedeExistingImport({
        adminClient,
        existingImportBatchId: replacementRequest.existing_import_batch_id,
        organizationId,
        replacementImportBatchId: importBatchId,
        userId
      });
    }

    const postedRows = await insertTrialBalanceLines({
      adminClient,
      batch,
      organizationId,
      postingRunId,
      previewRows,
      validationRun
    });

    await insertTrialBalanceSegments({
      accountStructureId: validationRun.account_structure_id,
      adminClient,
      organizationId,
      postedRows,
      segmentDefinitions
    });

    if (mappingVersionLinks.length > 0) {
      const linkResult = await adminClient
        .from("posting_run_mapping_versions")
        .insert(
          mappingVersionLinks.map((link) => ({
            organization_id: organizationId,
            posting_run_id: postingRunId,
            mapping_version_id: link.mapping_version_id,
            mapping_type: link.mapping_type
          }))
        );

      if (linkResult.error) {
        throw new Error(linkResult.error.message);
      }
    }

    const postedStatus =
      validationRun.warning_count > 0 || validationRun.information_count > 0
        ? "posted_with_exceptions"
        : "posted";

    const batchResult = await adminClient
      .from("import_batches")
      .update({
        batch_status: postedStatus,
        reporting_status: "included",
        active_status: "active",
        is_active_for_reporting: true,
        rows_processed: postedRows.length,
        rows_accepted: postedRows.length,
        rows_rejected: validationRun.rows_rejected,
        warning_count: validationRun.warning_count,
        error_count: 0,
        posted_by: userId,
        posted_at: now,
        updated_by: userId,
        supersedes_import_batch_id:
          replacementRequest?.existing_import_batch_id ?? batch.supersedes_import_batch_id,
        metadata: {
          ...(batch.metadata ?? {}),
          latest_posting_run_id: postingRunId,
          posting_mode: postingMode,
          validation_run_id: validationRun.validation_run_id
        }
      })
      .eq("organization_id", organizationId)
      .eq("import_batch_id", importBatchId);

    if (batchResult.error) {
      throw new Error(batchResult.error.message);
    }

    const postingRunUpdate = await adminClient
      .from("posting_runs")
      .update({
        status: "posted",
        posted_row_count: postedRows.length,
        rejected_row_count: validationRun.rows_rejected,
        posted_at: now,
        updated_at: now
      })
      .eq("organization_id", organizationId)
      .eq("posting_run_id", postingRunId);

    if (postingRunUpdate.error) {
      throw new Error(postingRunUpdate.error.message);
    }

    if (replacementRequest) {
      await adminClient
        .from("inactivation_requests")
        .update({
          request_status: "completed",
          approval_status: "completed",
          completed_by: userId,
          completed_at: now
        })
        .eq("organization_id", organizationId)
        .eq("inactivation_request_id", replacementRequest.inactivation_request_id);
    }

    await writeAuditLog({
      actionType: postingMode === "replacement" ? "replacement_approved" : "import_posted",
      adminClient,
      entityId: postingRunId,
      entityTable: "posting_runs",
      organizationId,
      payload: {
        import_batch_id: importBatchId,
        posting_mode: postingMode,
        posted_row_count: postedRows.length,
        validation_run_id: validationRun.validation_run_id
      },
      userId
    });

    return {
      postingRunId,
      postedRowCount: postedRows.length,
      status: postedStatus
    };
  } catch (error) {
    await adminClient
      .from("posting_runs")
      .update({
        status: "failed",
        error_message: error instanceof Error ? error.message : "Posting failed.",
        updated_at: new Date().toISOString()
      })
      .eq("organization_id", organizationId)
      .eq("posting_run_id", postingRunId);

    await writeAuditLog({
      actionType: "import_posting_failed",
      adminClient,
      entityId: postingRunId,
      entityTable: "posting_runs",
      organizationId,
      payload: {
        import_batch_id: importBatchId,
        error_message: error instanceof Error ? error.message : "Posting failed."
      },
      userId
    });

    throw error;
  }
}

export async function requestReplacement({
  adminClient,
  importBatchId,
  organizationId,
  reason,
  userId
}: {
  adminClient: SupabaseClient;
  importBatchId: string;
  organizationId: string;
  reason: string;
  userId: string;
}) {
  const { batch, criticalExceptions, validationRun } = await loadPostingContext({
    adminClient,
    importBatchId,
    organizationId
  });

  validatePostingEligibility({
    criticalExceptions,
    postingMode: "replacement",
    validationRun
  });

  const hasPeriodConflict = criticalExceptions.some(
    (exception) => exception.exception_code === "period_conflict_active_data_exists"
  );

  if (!hasPeriodConflict) {
    throw new Error("Replacement requests require a validated period conflict.");
  }

  const activeConflict = await findActivePeriodImport({
    adminClient,
    excludeImportBatchId: importBatchId,
    fiscalYear: batch.fiscal_year,
    organizationId,
    period: batch.period
  });

  if (!activeConflict) {
    throw new Error("No active period data exists to replace.");
  }

  const result = await adminClient
    .from("inactivation_requests")
    .insert({
      organization_id: organizationId,
      target_entity_table: "import_batches",
      target_entity_id: activeConflict.import_batch_id,
      entity_type: "trial_balance_period",
      entity_id: activeConflict.import_batch_id,
      existing_import_batch_id: activeConflict.import_batch_id,
      replacement_import_batch_id: importBatchId,
      requested_action: "replacement",
      request_reason: reason,
      request_status: "requested",
      approval_status: "requested",
      requested_by: userId
    })
    .select("inactivation_request_id")
    .single<{ inactivation_request_id: string }>();

  if (result.error) {
    throw new Error(result.error.message);
  }

  await writeAuditLog({
    actionType: "replacement_requested",
    adminClient,
    entityId: result.data.inactivation_request_id,
    entityTable: "inactivation_requests",
    organizationId,
    payload: {
      existing_import_batch_id: activeConflict.import_batch_id,
      replacement_import_batch_id: importBatchId
    },
    userId
  });

  return result.data.inactivation_request_id;
}

export async function approveReplacementRequest({
  adminClient,
  organizationId,
  reason,
  replacementRequestId,
  userId
}: {
  adminClient: SupabaseClient;
  organizationId: string;
  reason: string;
  replacementRequestId: string;
  userId: string;
}) {
  await requirePostingPermission({ adminClient, organizationId, userId });
  const request = await loadReplacementRequest({
    adminClient,
    organizationId,
    replacementRequestId
  });

  if (!request.replacement_import_batch_id) {
    throw new Error("Replacement request is missing a replacement import batch.");
  }

  const updateResult = await adminClient
    .from("inactivation_requests")
    .update({
      request_status: "approved",
      approval_status: "approved",
      approval_reason: reason || null,
      approved_by: userId,
      approved_at: new Date().toISOString(),
      reviewed_by: userId,
      reviewed_at: new Date().toISOString()
    })
    .eq("organization_id", organizationId)
    .eq("inactivation_request_id", replacementRequestId);

  if (updateResult.error) {
    throw new Error(updateResult.error.message);
  }

  return postValidatedTrialBalance({
    adminClient,
    importBatchId: request.replacement_import_batch_id,
    organizationId,
    postingMode: "replacement",
    replacementRequestId,
    userId
  });
}

export async function rejectReplacementRequest({
  adminClient,
  organizationId,
  reason,
  replacementRequestId,
  userId
}: {
  adminClient: SupabaseClient;
  organizationId: string;
  reason: string;
  replacementRequestId: string;
  userId: string;
}) {
  await requirePostingPermission({ adminClient, organizationId, userId });

  const result = await adminClient
    .from("inactivation_requests")
    .update({
      request_status: "rejected",
      approval_status: "rejected",
      approval_reason: reason || null,
      rejected_by: userId,
      rejected_at: new Date().toISOString(),
      reviewed_by: userId,
      reviewed_at: new Date().toISOString()
    })
    .eq("organization_id", organizationId)
    .eq("inactivation_request_id", replacementRequestId);

  if (result.error) {
    throw new Error(result.error.message);
  }

  await writeAuditLog({
    actionType: "replacement_rejected",
    adminClient,
    entityId: replacementRequestId,
    entityTable: "inactivation_requests",
    organizationId,
    payload: { reason },
    userId
  });
}

export async function requestReactivation({
  adminClient,
  importBatchId,
  organizationId,
  reason,
  userId
}: {
  adminClient: SupabaseClient;
  importBatchId: string;
  organizationId: string;
  reason: string;
  userId: string;
}) {
  const result = await adminClient
    .from("reactivation_requests")
    .insert({
      organization_id: organizationId,
      target_entity_table: "import_batches",
      target_entity_id: importBatchId,
      entity_type: "import_batch",
      entity_id: importBatchId,
      request_reason: reason,
      request_status: "requested",
      approval_status: "requested",
      requested_by: userId,
      conflict_status: "pending"
    })
    .select("reactivation_request_id")
    .single<{ reactivation_request_id: string }>();

  if (result.error) {
    throw new Error(result.error.message);
  }

  await writeAuditLog({
    actionType: "reactivation_requested",
    adminClient,
    entityId: result.data.reactivation_request_id,
    entityTable: "reactivation_requests",
    organizationId,
    payload: { import_batch_id: importBatchId },
    userId
  });

  return result.data.reactivation_request_id;
}

export async function approveReactivationRequest({
  adminClient,
  organizationId,
  reason,
  reactivationRequestId,
  userId
}: {
  adminClient: SupabaseClient;
  organizationId: string;
  reason: string;
  reactivationRequestId: string;
  userId: string;
}) {
  await requirePostingPermission({ adminClient, organizationId, userId });
  const request = await loadReactivationRequest({
    adminClient,
    organizationId,
    reactivationRequestId
  });
  const importBatchId = request.entity_id ?? request.target_entity_id;
  const batch = await loadImportBatch({ adminClient, importBatchId, organizationId });
  const conflict = await findActivePeriodImport({
    adminClient,
    excludeImportBatchId: importBatchId,
    fiscalYear: batch.fiscal_year,
    organizationId,
    period: batch.period
  });

  if (conflict) {
    const updateResult = await adminClient
      .from("reactivation_requests")
      .update({
        conflict_status: "blocked",
        approval_status: "rejected",
        request_status: "rejected",
        approval_reason:
          reason ||
          "Reactivation would create more than one active import for this period.",
        rejected_by: userId,
        rejected_at: new Date().toISOString(),
        reviewed_by: userId,
        reviewed_at: new Date().toISOString()
      })
      .eq("organization_id", organizationId)
      .eq("reactivation_request_id", reactivationRequestId);

    if (updateResult.error) {
      throw new Error(updateResult.error.message);
    }

    throw new Error("Reactivation blocked because active data already exists for this fiscal year and period.");
  }

  const batchStatus =
    batch.warning_count > 0 ? "posted_with_exceptions" : "posted";
  const now = new Date().toISOString();

  const [batchResult, rowsResult, requestResult] = await Promise.all([
    adminClient
      .from("import_batches")
      .update({
        batch_status: batchStatus,
        active_status: "active",
        reporting_status: "included",
        is_active_for_reporting: true,
        reactivated_at: now,
        updated_by: userId,
        superseded_by_import_batch_id: null
      })
      .eq("organization_id", organizationId)
      .eq("import_batch_id", importBatchId),
    adminClient
      .from("trial_balance_lines")
      .update({
        active_status: "active",
        is_active_for_reporting: true,
        updated_at: now
      })
      .eq("organization_id", organizationId)
      .eq("import_batch_id", importBatchId),
    adminClient
      .from("reactivation_requests")
      .update({
        request_status: "completed",
        approval_status: "approved",
        approval_reason: reason || null,
        approved_by: userId,
        approved_at: now,
        reviewed_by: userId,
        reviewed_at: now,
        completed_by: userId,
        completed_at: now,
        conflict_status: "clear"
      })
      .eq("organization_id", organizationId)
      .eq("reactivation_request_id", reactivationRequestId)
  ]);

  if (batchResult.error) throw new Error(batchResult.error.message);
  if (rowsResult.error) throw new Error(rowsResult.error.message);
  if (requestResult.error) throw new Error(requestResult.error.message);

  await writeAuditLog({
    actionType: "import_reactivated",
    adminClient,
    entityId: importBatchId,
    entityTable: "import_batches",
    organizationId,
    payload: { reactivation_request_id: reactivationRequestId },
    userId
  });
}

export async function rejectReactivationRequest({
  adminClient,
  organizationId,
  reason,
  reactivationRequestId,
  userId
}: {
  adminClient: SupabaseClient;
  organizationId: string;
  reason: string;
  reactivationRequestId: string;
  userId: string;
}) {
  await requirePostingPermission({ adminClient, organizationId, userId });

  const result = await adminClient
    .from("reactivation_requests")
    .update({
      request_status: "rejected",
      approval_status: "rejected",
      approval_reason: reason || null,
      rejected_by: userId,
      rejected_at: new Date().toISOString(),
      reviewed_by: userId,
      reviewed_at: new Date().toISOString()
    })
    .eq("organization_id", organizationId)
    .eq("reactivation_request_id", reactivationRequestId);

  if (result.error) {
    throw new Error(result.error.message);
  }

  await writeAuditLog({
    actionType: "reactivation_rejected",
    adminClient,
    entityId: reactivationRequestId,
    entityTable: "reactivation_requests",
    organizationId,
    payload: { reason },
    userId
  });
}

async function loadPostingContext({
  adminClient,
  importBatchId,
  organizationId
}: {
  adminClient: SupabaseClient;
  importBatchId: string;
  organizationId: string;
}) {
  const batch = await loadImportBatch({ adminClient, importBatchId, organizationId });
  const importType = await loadImportType({
    adminClient,
    importTypeId: batch.import_type_id,
    organizationId
  });

  if (importType.import_type_code !== "trial_balance") {
    throw new Error("Posting is available only for trial_balance import batches.");
  }

  const validationRun = await loadLatestValidationRun({
    adminClient,
    importBatchId,
    organizationId
  });
  const [previewRows, criticalExceptions, mappingVersionLinks, segmentDefinitions] =
    await Promise.all([
      loadPreviewRows({
        adminClient,
        organizationId,
        previewRunId: validationRun.preview_run_id
      }),
      loadCriticalExceptions({
        adminClient,
        organizationId,
        validationRunId: validationRun.validation_run_id
      }),
      loadValidationMappingVersions({
        adminClient,
        organizationId,
        validationRunId: validationRun.validation_run_id
      }),
      loadSegmentDefinitions({
        accountStructureId: validationRun.account_structure_id,
        adminClient,
        organizationId
      })
    ]);

  if (previewRows.length === 0) {
    throw new Error("No validated preview rows are available to post.");
  }

  return {
    batch,
    criticalExceptions,
    mappingVersionLinks,
    previewRows,
    segmentDefinitions,
    validationRun
  };
}

function validatePostingEligibility({
  criticalExceptions,
  postingMode,
  validationRun
}: {
  criticalExceptions: CriticalExceptionRecord[];
  postingMode: "normal" | "replacement";
  validationRun: ValidationRunRecord;
}) {
  if (validationRun.status !== "completed") {
    throw new Error("Latest validation run is not complete.");
  }

  if (validationRun.warning_count > 0 && !validationRun.warnings_acknowledged) {
    throw new Error("Warnings must be acknowledged before posting.");
  }

  const nonPeriodCriticalErrors = criticalExceptions.filter(
    (exception) =>
      exception.exception_code !== "period_conflict_active_data_exists"
  );

  if (postingMode === "normal") {
    if (!validationRun.eligible_to_post || criticalExceptions.length > 0) {
      throw new Error("Validation is not eligible for normal posting.");
    }
    return;
  }

  if (nonPeriodCriticalErrors.length > 0) {
    throw new Error("Replacement posting can only proceed when the only critical validation issue is the period conflict.");
  }
}

async function insertTrialBalanceLines({
  adminClient,
  batch,
  organizationId,
  postingRunId,
  previewRows,
  validationRun
}: {
  adminClient: SupabaseClient;
  batch: ImportBatchRecord;
  organizationId: string;
  postingRunId: string;
  previewRows: PreviewRowRecord[];
  validationRun: ValidationRunRecord;
}) {
  const lineRows = previewRows.map((row) => ({
    trial_balance_line_id: randomUUID(),
    organization_id: organizationId,
    fiscal_year: batch.fiscal_year,
    period: batch.period,
    full_account_number: row.full_account_number ?? "",
    fund_code: row.fund_code,
    acfr_code: row.acfr_code,
    department_code: row.department_code,
    function_code: row.function_code,
    object_code: row.object_code,
    account_name: row.account_name,
    beginning_balance: toMoney(row.beginning_balance),
    debits: toMoney(row.debits),
    credits: toMoney(row.credits),
    net_change: toMoney(row.net_change),
    ending_balance: toMoney(row.ending_balance),
    import_batch_id: batch.import_batch_id,
    source_file_id: validationRun.source_file_id,
    template_version_id: validationRun.import_template_version_id,
    account_structure_id: validationRun.account_structure_id,
    validation_run_id: validationRun.validation_run_id,
    posting_run_id: postingRunId,
    source_row_number: row.source_row_number,
    is_active_for_reporting: true,
    active_status: "active",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }));

  const result = await adminClient
    .from("trial_balance_lines")
    .insert(lineRows)
    .select(
      "trial_balance_line_id, full_account_number, fund_code, acfr_code, department_code, function_code, object_code"
    )
    .returns<
      Array<{
        trial_balance_line_id: string;
        full_account_number: string;
        fund_code: string | null;
        acfr_code: string | null;
        department_code: string | null;
        function_code: string | null;
        object_code: string | null;
      }>
    >();

  if (result.error) {
    throw new Error(result.error.message);
  }

  return result.data ?? [];
}

async function insertTrialBalanceSegments({
  accountStructureId,
  adminClient,
  organizationId,
  postedRows,
  segmentDefinitions
}: {
  accountStructureId: string;
  adminClient: SupabaseClient;
  organizationId: string;
  postedRows: Array<{
    trial_balance_line_id: string;
    fund_code: string | null;
    acfr_code: string | null;
    department_code: string | null;
    function_code: string | null;
    object_code: string | null;
  }>;
  segmentDefinitions: SegmentDefinitionRecord[];
}) {
  const segmentRows = postedRows.flatMap((row) =>
    segmentDefinitions.map((segment) => ({
      organization_id: organizationId,
      trial_balance_line_id: row.trial_balance_line_id,
      account_structure_id: accountStructureId,
      segment_definition_id: segment.account_segment_definition_id,
      segment_number: segment.segment_number,
      segment_key: segment.segment_key,
      segment_position: segment.segment_number,
      segment_name: segment.segment_name,
      segment_type: segment.segment_key,
      segment_value: getSegmentValue(row, segment.segment_key)
    }))
  );

  if (segmentRows.length === 0) {
    return;
  }

  const result = await adminClient.from("trial_balance_line_segments").insert(segmentRows);

  if (result.error) {
    throw new Error(result.error.message);
  }
}

async function supersedeExistingImport({
  adminClient,
  existingImportBatchId,
  organizationId,
  replacementImportBatchId,
  userId
}: {
  adminClient: SupabaseClient;
  existingImportBatchId: string;
  organizationId: string;
  replacementImportBatchId: string;
  userId: string;
}) {
  const now = new Date().toISOString();
  const [batchResult, rowsResult] = await Promise.all([
    adminClient
      .from("import_batches")
      .update({
        batch_status: "superseded",
        reporting_status: "excluded",
        active_status: "inactive",
        is_active_for_reporting: false,
        superseded_by_import_batch_id: replacementImportBatchId,
        inactive_at: now,
        updated_by: userId
      })
      .eq("organization_id", organizationId)
      .eq("import_batch_id", existingImportBatchId),
    adminClient
      .from("trial_balance_lines")
      .update({
        active_status: "superseded",
        is_active_for_reporting: false,
        updated_at: now
      })
      .eq("organization_id", organizationId)
      .eq("import_batch_id", existingImportBatchId)
  ]);

  if (batchResult.error) throw new Error(batchResult.error.message);
  if (rowsResult.error) throw new Error(rowsResult.error.message);

  await writeAuditLog({
    actionType: "import_superseded",
    adminClient,
    entityId: existingImportBatchId,
    entityTable: "import_batches",
    organizationId,
    payload: {
      replacement_import_batch_id: replacementImportBatchId
    },
    userId
  });
}

async function requirePostingPermission({
  adminClient,
  organizationId,
  userId
}: {
  adminClient: SupabaseClient;
  organizationId: string;
  userId: string;
}) {
  const allowed = await userHasAnyRole({
    adminClient,
    organizationId,
    roleNames: postingRoleNames,
    userId
  });

  if (!allowed) {
    throw new Error("Posting requires System Admin, Finance Admin, or Approver role.");
  }
}

async function loadImportBatch({
  adminClient,
  importBatchId,
  organizationId
}: {
  adminClient: SupabaseClient;
  importBatchId: string;
  organizationId: string;
}) {
  const result = await adminClient
    .from("import_batches")
    .select(
      "import_batch_id, organization_id, import_type_id, source_file_id, template_version_id, account_structure_id, fiscal_year, period, batch_status, is_active_for_reporting, reporting_status, active_status, warning_count, supersedes_import_batch_id, superseded_by_import_batch_id, metadata"
    )
    .eq("organization_id", organizationId)
    .eq("import_batch_id", importBatchId)
    .maybeSingle<ImportBatchRecord>();

  if (result.error || !result.data) {
    throw new Error(result.error?.message ?? "Import batch was not found.");
  }

  return result.data;
}

async function loadImportType({
  adminClient,
  importTypeId,
  organizationId
}: {
  adminClient: SupabaseClient;
  importTypeId: string;
  organizationId: string;
}) {
  const result = await adminClient
    .from("import_types")
    .select("import_type_code")
    .eq("organization_id", organizationId)
    .eq("import_type_id", importTypeId)
    .maybeSingle<ImportTypeRecord>();

  if (result.error || !result.data) {
    throw new Error(result.error?.message ?? "Import type was not found.");
  }

  return result.data;
}

async function loadLatestValidationRun({
  adminClient,
  importBatchId,
  organizationId
}: {
  adminClient: SupabaseClient;
  importBatchId: string;
  organizationId: string;
}) {
  const result = await adminClient
    .from("validation_runs")
    .select(
      "validation_run_id, import_batch_id, source_file_id, import_template_version_id, account_structure_id, preview_run_id, status, eligible_to_post, warnings_acknowledged, critical_error_count, warning_count, information_count, rows_validated, rows_rejected"
    )
    .eq("organization_id", organizationId)
    .eq("import_batch_id", importBatchId)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<ValidationRunRecord>();

  if (result.error || !result.data) {
    throw new Error(result.error?.message ?? "Run validation before posting.");
  }

  return result.data;
}

async function loadPreviewRows({
  adminClient,
  organizationId,
  previewRunId
}: {
  adminClient: SupabaseClient;
  organizationId: string;
  previewRunId: string;
}) {
  const result = await adminClient
    .from("import_preview_rows")
    .select(
      "preview_row_id, source_row_number, full_account_number, fund_code, acfr_code, department_code, function_code, object_code, account_name, beginning_balance, debits, credits, net_change, ending_balance"
    )
    .eq("organization_id", organizationId)
    .eq("preview_run_id", previewRunId)
    .order("source_row_number", { ascending: true })
    .returns<PreviewRowRecord[]>();

  if (result.error) {
    throw new Error(result.error.message);
  }

  return result.data ?? [];
}

async function loadCriticalExceptions({
  adminClient,
  organizationId,
  validationRunId
}: {
  adminClient: SupabaseClient;
  organizationId: string;
  validationRunId: string;
}) {
  const result = await adminClient
    .from("import_exceptions")
    .select("exception_code, preview_row_id")
    .eq("organization_id", organizationId)
    .eq("validation_run_id", validationRunId)
    .eq("severity", "critical_error")
    .returns<CriticalExceptionRecord[]>();

  if (result.error) {
    throw new Error(result.error.message);
  }

  return result.data ?? [];
}

async function loadValidationMappingVersions({
  adminClient,
  organizationId,
  validationRunId
}: {
  adminClient: SupabaseClient;
  organizationId: string;
  validationRunId: string;
}) {
  const result = await adminClient
    .from("validation_run_mapping_versions")
    .select("mapping_version_id, mapping_type")
    .eq("organization_id", organizationId)
    .eq("validation_run_id", validationRunId)
    .returns<MappingVersionLinkRecord[]>();

  if (result.error) {
    throw new Error(result.error.message);
  }

  return result.data ?? [];
}

async function loadSegmentDefinitions({
  accountStructureId,
  adminClient,
  organizationId
}: {
  accountStructureId: string;
  adminClient: SupabaseClient;
  organizationId: string;
}) {
  const result = await adminClient
    .from("account_segment_definitions")
    .select("account_segment_definition_id, segment_number, segment_name, segment_key")
    .eq("organization_id", organizationId)
    .eq("account_structure_id", accountStructureId)
    .eq("active_status", "active")
    .order("segment_number", { ascending: true })
    .returns<SegmentDefinitionRecord[]>();

  if (result.error) {
    throw new Error(result.error.message);
  }

  return result.data ?? [];
}

async function loadReplacementRequest({
  adminClient,
  organizationId,
  replacementRequestId
}: {
  adminClient: SupabaseClient;
  organizationId: string;
  replacementRequestId: string;
}) {
  const result = await adminClient
    .from("inactivation_requests")
    .select(
      "inactivation_request_id, organization_id, existing_import_batch_id, replacement_import_batch_id, request_status, approval_status, request_reason"
    )
    .eq("organization_id", organizationId)
    .eq("inactivation_request_id", replacementRequestId)
    .maybeSingle<WorkflowRequestRecord>();

  if (result.error || !result.data) {
    throw new Error(result.error?.message ?? "Replacement request was not found.");
  }

  return result.data;
}

async function loadApprovedReplacementRequest({
  adminClient,
  organizationId,
  replacementRequestId
}: {
  adminClient: SupabaseClient;
  organizationId: string;
  replacementRequestId: string;
}) {
  const request = await loadReplacementRequest({
    adminClient,
    organizationId,
    replacementRequestId
  });

  if (request.approval_status !== "approved" && request.request_status !== "approved") {
    throw new Error("Replacement request must be approved before replacement posting.");
  }

  return request;
}

async function loadReactivationRequest({
  adminClient,
  organizationId,
  reactivationRequestId
}: {
  adminClient: SupabaseClient;
  organizationId: string;
  reactivationRequestId: string;
}) {
  const result = await adminClient
    .from("reactivation_requests")
    .select("reactivation_request_id, target_entity_id, entity_id")
    .eq("organization_id", organizationId)
    .eq("reactivation_request_id", reactivationRequestId)
    .maybeSingle<{
      reactivation_request_id: string;
      target_entity_id: string;
      entity_id: string | null;
    }>();

  if (result.error || !result.data) {
    throw new Error(result.error?.message ?? "Reactivation request was not found.");
  }

  return result.data;
}

function getSegmentValue(
  row: {
    fund_code: string | null;
    acfr_code: string | null;
    department_code: string | null;
    function_code: string | null;
    object_code: string | null;
  },
  segmentKey: string
) {
  const key = segmentKey.toLowerCase();
  if (key.includes("fund")) return row.fund_code;
  if (key.includes("acfr")) return row.acfr_code;
  if (key.includes("department")) return row.department_code;
  if (key.includes("function")) return row.function_code;
  if (key.includes("object")) return row.object_code;
  return null;
}

function toMoney(value: number | string | null) {
  const numeric = typeof value === "number" ? value : Number.parseFloat(value ?? "0");
  return Number.isNaN(numeric) ? 0 : numeric;
}

async function writeAuditLog({
  actionType,
  adminClient,
  entityId,
  entityTable,
  organizationId,
  payload,
  userId
}: {
  actionType: string;
  adminClient: SupabaseClient;
  entityId: string;
  entityTable: string;
  organizationId: string;
  payload: Record<string, unknown>;
  userId: string;
}) {
  await adminClient.from("audit_logs").insert({
    organization_id: organizationId,
    actor_user_id: userId,
    action_type: actionType,
    entity_table: entityTable,
    entity_id: entityId,
    after_payload: payload,
    metadata: {
      slice: "8",
      posting_workflow: true
    }
  });
}
