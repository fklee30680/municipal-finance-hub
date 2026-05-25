import "server-only";

import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  CALCULATION_VERSION,
  normalizeClassification,
  presentationAmount
} from "@/lib/calculations/sign-conventions";
import {
  classifyVarianceSeverity,
  loadThresholdConfig,
  type ThresholdConfig
} from "@/lib/calculations/thresholds";

const BALANCE_TOLERANCE = 0.01;

type TimeView = "current_period" | "ytd" | "selected_range";
type ReportingScope = "standard" | "cash_reconciliation" | "all_active";

export type RunCalculationRequest = {
  fiscalYear: number;
  organizationId: string;
  periodFrom: number;
  periodTo: number;
  reportingScope?: ReportingScope;
  timeView: TimeView;
  userId: string;
};

type ActiveTrialBalanceLine = {
  trial_balance_line_id: string;
  organization_id: string;
  fiscal_year: number;
  period: number;
  full_account_number: string;
  fund_code: string | null;
  acfr_code: string | null;
  department_code: string | null;
  function_code: string | null;
  object_code: string | null;
  account_name: string | null;
  beginning_balance: number | string;
  debits: number | string;
  credits: number | string;
  net_change: number | string;
  ending_balance: number | string;
  import_batch_id: string;
  template_version_id: string | null;
  account_structure_id: string | null;
  validation_run_id: string | null;
  posting_run_id: string | null;
};

type ReferenceRow = Record<string, boolean | string | number | null>;

type EnrichedLine = ActiveTrialBalanceLine & {
  activity_statement_line: string | null;
  account_type: string | null;
  balance_sheet_line: string | null;
  fund_group: string | null;
  fund_type: string | null;
  include_in_cash_reconciliation: boolean;
  include_in_standard_reporting: boolean;
  reporting_model: string | null;
  reporting_treatment: string;
  reporting_exclusion_reason: string | null;
};

type ComparisonSet<T extends ActiveTrialBalanceLine> = {
  priorPeriod: {
    availability: "available" | "unavailable";
    lines: T[];
  };
  priorYear: {
    availability: "available" | "partial" | "unavailable";
    lines: T[];
  };
};

type CoverageIssue = {
  affectedAmount: number;
  affectedRowCount: number;
  coverageIssueType: string;
  message: string;
  recommendedAction: string;
  referenceStatus: string;
  referenceTable: string;
  segmentCode: string;
  segmentName: string | null;
  segmentType: "fund" | "object" | "acfr" | "department" | "function";
  severity: "Info" | "Warning" | "High" | "Critical";
};

type ResultRows = {
  dashboardFacts: Record<string, unknown>[];
  exceptions: Record<string, unknown>[];
  financialSummaries: Record<string, unknown>[];
  mappingCoverage: Record<string, unknown>[];
  statementSummaries: Record<string, unknown>[];
  trends: Record<string, unknown>[];
  variances: Record<string, unknown>[];
};

export async function runAnalysisCalculation({
  adminClient,
  request
}: {
  adminClient: SupabaseClient;
  request: RunCalculationRequest;
}) {
  validateCalculationRequest(request);

  const calculationRunId = randomUUID();
  const now = new Date().toISOString();
  const thresholdConfig = await loadThresholdConfig({
    adminClient,
    organizationId: request.organizationId
  });
  const signConventionConfigId = await loadSignConventionConfigId({
    adminClient,
    organizationId: request.organizationId
  });

  const runningRun = await adminClient.from("calculation_runs").insert({
    account_structure_id: null,
    calculation_run_id: calculationRunId,
    calculation_type: "actuals_analysis",
    calculation_version: CALCULATION_VERSION,
    fiscal_year: request.fiscalYear,
    is_current: true,
    is_stale: false,
    organization_id: request.organizationId,
    parameters: buildParametersSnapshot(request),
    parameters_snapshot: buildParametersSnapshot(request),
    period: request.periodTo,
    period_from: request.periodFrom,
    period_to: request.periodTo,
    run_status: "running",
    run_type: "actuals_analysis",
    sign_convention_config_id: signConventionConfigId,
    started_at: now,
    threshold_config_id: thresholdConfig.thresholdConfigId,
    time_view: request.timeView,
    triggered_at: now,
    triggered_by: request.userId,
    created_by: request.userId
  });

  if (runningRun.error) {
    throw new Error(runningRun.error.message);
  }

  try {
    await validateFiscalPeriods({ adminClient, request });
    const currentLines = await loadActivePostedLines({ adminClient, request });
    assertSingleActiveImportPerPeriod(currentLines);

    const comparison = await loadComparisonLines({
      adminClient,
      currentLines,
      request
    });
    const references = await loadReferenceRows({
      adminClient,
      organizationId: request.organizationId
    });
    const scopedCurrentLines = filterReportingScopeLines({
      lines: currentLines,
      reportingScope: request.reportingScope ?? "standard",
      references
    });
    const scopedComparison = filterComparisonForReportingScope({
      comparison,
      reportingScope: request.reportingScope ?? "standard",
      references
    });
    const enrichedLines = enrichLines(scopedCurrentLines, references);
    const enrichedComparison = enrichComparisonLines({
      comparison: scopedComparison,
      references
    });
    const dependencyManifest = buildDependencyManifest({
      comparison,
      currentLines,
      request,
      signConventionConfigId,
      thresholdConfig
    });
    const coverageIssues = buildMappingCoverageIssues({
      lines: currentLines,
      references
    });
    const results = buildResults({
      calculationRunId,
      comparison: enrichedComparison,
      coverageIssues,
      enrichedLines,
      request,
      thresholdConfig
    });
    const mappingCoverageStatus = getMappingCoverageStatus(coverageIssues);
    const runStatus =
      mappingCoverageStatus === "Incomplete" || results.exceptions.length > 0
        ? "completed_with_warnings"
        : "completed";

    await persistResults({
      adminClient,
      results
    });

    const updateResult = await adminClient
      .from("calculation_runs")
      .update({
        account_structure_id: dependencyManifest.account_structure_id,
        completed_at: new Date().toISOString(),
        dependency_manifest: {
          ...dependencyManifest,
          mapping_coverage_status: mappingCoverageStatus
        },
        mapping_coverage_status: mappingCoverageStatus,
        posting_run_ids: dependencyManifest.posting_run_ids,
        run_status: runStatus,
        source_import_batch_ids: dependencyManifest.trial_balance_import_batch_ids,
        validation_run_ids: dependencyManifest.validation_run_ids
      })
      .eq("organization_id", request.organizationId)
      .eq("calculation_run_id", calculationRunId);

    if (updateResult.error) {
      throw new Error(updateResult.error.message);
    }

    await markComparableRunsSuperseded({
      adminClient,
      calculationRunId,
      request
    });

    await writeAuditLog({
      actionType:
        mappingCoverageStatus === "Incomplete"
          ? "mapping_coverage_incomplete"
          : "calculation_run_completed",
      adminClient,
      calculationRunId,
      organizationId: request.organizationId,
      payload: {
        calculation_run_id: calculationRunId,
        mapping_coverage_status: mappingCoverageStatus,
        result_counts: {
          exceptions: results.exceptions.length,
          dashboard_financial_facts: results.dashboardFacts.length,
          financial_summary_results: results.financialSummaries.length,
          mapping_coverage_results: results.mappingCoverage.length,
          statement_summary_results: results.statementSummaries.length,
          trend_results: results.trends.length,
          variance_results: results.variances.length
        },
        run_status: runStatus
      },
      userId: request.userId
    });

    return {
      calculationRunId,
      mappingCoverageStatus,
      runStatus
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Calculation run failed.";
    await adminClient
      .from("calculation_runs")
      .update({
        completed_at: new Date().toISOString(),
        error_message: message,
        is_current: false,
        run_status: "failed"
      })
      .eq("organization_id", request.organizationId)
      .eq("calculation_run_id", calculationRunId);

    await writeAuditLog({
      actionType: "calculation_run_failed",
      adminClient,
      calculationRunId,
      organizationId: request.organizationId,
      payload: { error_message: message },
      userId: request.userId
    });

    throw error;
  }
}

function validateCalculationRequest(request: RunCalculationRequest) {
  if (!request.fiscalYear || request.fiscalYear < 1900) {
    throw new Error("Choose a valid fiscal year.");
  }

  if (request.periodFrom < 0 || request.periodFrom > 13) {
    throw new Error("Period from must be between 0 and 13.");
  }

  if (request.periodTo < 0 || request.periodTo > 13) {
    throw new Error("Period to must be between 0 and 13.");
  }

  if (request.periodFrom > request.periodTo) {
    throw new Error("Period from cannot be greater than period to.");
  }
}

async function validateFiscalPeriods({
  adminClient,
  request
}: {
  adminClient: SupabaseClient;
  request: RunCalculationRequest;
}) {
  const result = await adminClient
    .from("fiscal_periods")
    .select("period")
    .eq("organization_id", request.organizationId)
    .eq("fiscal_year", request.fiscalYear)
    .gte("period", request.periodFrom)
    .lte("period", request.periodTo)
    .returns<Array<{ period: number }>>();

  if (result.error) {
    throw new Error(result.error.message);
  }

  if ((result.data ?? []).length === 0) {
    throw new Error("No configured fiscal periods exist for the selected range.");
  }
}

async function loadActivePostedLines({
  adminClient,
  request
}: {
  adminClient: SupabaseClient;
  request: RunCalculationRequest;
}) {
  const lines = await loadActiveTrialBalanceLinesPage({
    adminClient,
    fiscalYear: request.fiscalYear,
    organizationId: request.organizationId,
    periodFrom: request.periodFrom,
    periodTo: request.periodTo
  });
  if (lines.length === 0) {
    throw new Error("No posted active trial balance data exists for this range.");
  }

  return lines;
}

async function loadComparisonLines({
  adminClient,
  currentLines,
  request
}: {
  adminClient: SupabaseClient;
  currentLines: ActiveTrialBalanceLine[];
  request: RunCalculationRequest;
}): Promise<ComparisonSet<ActiveTrialBalanceLine>> {
  const priorPeriod = request.periodFrom === request.periodTo ? request.periodTo - 1 : null;
  const priorPeriodLines =
    priorPeriod && priorPeriod >= 1
      ? await loadLinesForPeriod({
          adminClient,
          fiscalYear: request.fiscalYear,
          organizationId: request.organizationId,
          periodFrom: priorPeriod,
          periodTo: priorPeriod
        })
      : [];
  const priorYearLines = await loadLinesForPeriod({
    adminClient,
    fiscalYear: request.fiscalYear - 1,
    organizationId: request.organizationId,
    periodFrom: request.periodFrom,
    periodTo: request.periodTo
  });
  const currentPeriods = new Set(currentLines.map((line) => line.period));
  const priorYearPeriods = new Set(priorYearLines.map((line) => line.period));

  return {
    priorPeriod: {
      availability:
        priorPeriodLines.length > 0 ? "available" : ("unavailable" as const),
      lines: priorPeriodLines
    },
    priorYear: {
      availability:
        priorYearLines.length === 0
          ? ("unavailable" as const)
          : [...currentPeriods].every((period) => priorYearPeriods.has(period))
            ? ("available" as const)
            : ("partial" as const),
      lines: priorYearLines
    }
  };
}

async function loadLinesForPeriod({
  adminClient,
  fiscalYear,
  organizationId,
  periodFrom,
  periodTo
}: {
  adminClient: SupabaseClient;
  fiscalYear: number;
  organizationId: string;
  periodFrom: number;
  periodTo: number;
}) {
  return loadActiveTrialBalanceLinesPage({
    adminClient,
    fiscalYear,
    organizationId,
    periodFrom,
    periodTo
  });
}

async function loadActiveTrialBalanceLinesPage({
  adminClient,
  fiscalYear,
  organizationId,
  periodFrom,
  periodTo
}: {
  adminClient: SupabaseClient;
  fiscalYear: number;
  organizationId: string;
  periodFrom: number;
  periodTo: number;
}) {
  const pageSize = 1000;
  const rows: ActiveTrialBalanceLine[] = [];

  for (let from = 0; ; from += pageSize) {
    const result = await adminClient
      .from("active_trial_balance_lines")
      .select(
        "trial_balance_line_id, organization_id, fiscal_year, period, full_account_number, fund_code, acfr_code, department_code, function_code, object_code, account_name, beginning_balance, debits, credits, net_change, ending_balance, import_batch_id, template_version_id, account_structure_id, validation_run_id, posting_run_id"
      )
      .eq("organization_id", organizationId)
      .eq("fiscal_year", fiscalYear)
      .gte("period", periodFrom)
      .lte("period", periodTo)
      .order("period", { ascending: true })
      .order("fund_code", { ascending: true })
      .order("full_account_number", { ascending: true })
      .order("trial_balance_line_id", { ascending: true })
      .range(from, from + pageSize - 1)
      .returns<ActiveTrialBalanceLine[]>();

    if (result.error) {
      throw new Error(result.error.message);
    }

    rows.push(...(result.data ?? []));

    if ((result.data ?? []).length < pageSize) {
      return rows;
    }
  }
}

function assertSingleActiveImportPerPeriod(lines: ActiveTrialBalanceLine[]) {
  const importBatchesByPeriod = new Map<string, Set<string>>();

  for (const line of lines) {
    const key = `${line.fiscal_year}-${line.period}`;
    const set = importBatchesByPeriod.get(key) ?? new Set<string>();
    set.add(line.import_batch_id);
    importBatchesByPeriod.set(key, set);
  }

  const conflicts = [...importBatchesByPeriod.entries()].filter(
    ([, batchIds]) => batchIds.size > 1
  );

  if (conflicts.length > 0) {
    throw new Error(
      "Multiple active posted imports exist for at least one selected period. Calculation stopped to avoid double-counting."
    );
  }
}

async function loadReferenceRows({
  adminClient,
  organizationId
}: {
  adminClient: SupabaseClient;
  organizationId: string;
}) {
  const [funds, objects, acfr, departments, functions] = await Promise.all([
    loadReferenceTable({
      adminClient,
      codeField: "fund_code",
      organizationId,
      tableName: "funds"
    }),
    loadReferenceTable({
      adminClient,
      codeField: "object_code",
      organizationId,
      tableName: "objects"
    }),
    loadReferenceTable({
      adminClient,
      codeField: "acfr_code",
      organizationId,
      tableName: "acfr_mappings"
    }),
    loadReferenceTable({
      adminClient,
      codeField: "department_code",
      organizationId,
      tableName: "departments"
    }),
    loadReferenceTable({
      adminClient,
      codeField: "function_code",
      organizationId,
      tableName: "functions"
    })
  ]);

  return {
    acfr,
    departments,
    functions,
    funds,
    objects
  };
}

async function loadReferenceTable({
  adminClient,
  codeField,
  organizationId,
  tableName
}: {
  adminClient: SupabaseClient;
  codeField: string;
  organizationId: string;
  tableName: string;
}) {
  const result = await adminClient
    .from(tableName)
    .select("*")
    .eq("organization_id", organizationId)
    .order("mapping_version", { ascending: false })
    .returns<ReferenceRow[]>();

  if (result.error) {
    throw new Error(result.error.message);
  }

  const byCode = new Map<string, ReferenceRow>();
  for (const row of result.data ?? []) {
    const code = text(row[codeField]);
    if (code && !byCode.has(code)) {
      byCode.set(code, row);
    }
  }

  return byCode;
}

function enrichLines(
  lines: ActiveTrialBalanceLine[],
  references: Awaited<ReturnType<typeof loadReferenceRows>>
): EnrichedLine[] {
  return lines.map((line) => {
    const fund = references.funds.get(text(line.fund_code));
    const object = references.objects.get(text(line.object_code));
    return {
      ...line,
      // Legacy fallback keeps calculations working while existing object rows are backfilled.
      activity_statement_line: textOrNull(
        object?.activity_statement_line ?? object?.statement_category
      ),
      account_type: textOrNull(object?.account_type),
      balance_sheet_line: textOrNull(
        object?.balance_sheet_line ?? object?.balance_sheet_category
      ),
      fund_type: textOrNull(fund?.fund_type),
      fund_group: textOrNull(fund?.fund_group),
      include_in_cash_reconciliation:
        booleanValue(fund?.include_in_cash_reconciliation, false),
      include_in_standard_reporting:
        booleanValue(fund?.include_in_standard_reporting, true),
      reporting_model: textOrNull(fund?.reporting_model),
      reporting_exclusion_reason: textOrNull(fund?.reporting_exclusion_reason),
      reporting_treatment: text(fund?.reporting_treatment) || "reportable"
    };
  });
}

function filterStandardReportingLines({
  lines,
  references
}: {
  lines: ActiveTrialBalanceLine[];
  references: Awaited<ReturnType<typeof loadReferenceRows>>;
}) {
  return lines.filter((line) => {
    const fund = references.funds.get(text(line.fund_code));
    return booleanValue(fund?.include_in_standard_reporting, true);
  });
}

function enrichComparisonLines({
  comparison,
  references
}: {
  comparison: ComparisonSet<ActiveTrialBalanceLine>;
  references: Awaited<ReturnType<typeof loadReferenceRows>>;
}): ComparisonSet<EnrichedLine> {
  return {
    priorPeriod: {
      ...comparison.priorPeriod,
      lines: enrichLines(comparison.priorPeriod.lines, references)
    },
    priorYear: {
      ...comparison.priorYear,
      lines: enrichLines(comparison.priorYear.lines, references)
    }
  };
}

function filterReportingScopeLines({
  lines,
  references,
  reportingScope
}: {
  lines: ActiveTrialBalanceLine[];
  references: Awaited<ReturnType<typeof loadReferenceRows>>;
  reportingScope: ReportingScope;
}) {
  if (reportingScope === "standard") {
    return filterStandardReportingLines({ lines, references });
  }

  return lines.filter((line) => {
    const fund = references.funds.get(text(line.fund_code));
    if (!fund || text(fund.active_status) === "inactive") return false;

    if (reportingScope === "all_active") return true;

    const treatment = text(fund.reporting_treatment);
    return (
      booleanValue(fund.include_in_standard_reporting, true) ||
      booleanValue(fund.include_in_cash_reconciliation, false) ||
      treatment === "pooled_cash" ||
      treatment === "reconciliation_only"
    );
  });
}

function filterComparisonForReportingScope({
  comparison,
  reportingScope,
  references
}: {
  comparison: ComparisonSet<ActiveTrialBalanceLine>;
  reportingScope: ReportingScope;
  references: Awaited<ReturnType<typeof loadReferenceRows>>;
}): ComparisonSet<ActiveTrialBalanceLine> {
  return {
    priorPeriod: {
      ...comparison.priorPeriod,
      lines: filterReportingScopeLines({
        lines: comparison.priorPeriod.lines,
        reportingScope,
        references
      })
    },
    priorYear: {
      ...comparison.priorYear,
      lines: filterReportingScopeLines({
        lines: comparison.priorYear.lines,
        reportingScope,
        references
      })
    }
  };
}

function buildMappingCoverageIssues({
  lines,
  references
}: {
  lines: ActiveTrialBalanceLine[];
  references: Awaited<ReturnType<typeof loadReferenceRows>>;
}) {
  const issues: CoverageIssue[] = [];
  const dimensions = [
    {
      codeField: "fund_code",
      nameField: "fund_name",
      referenceTable: "funds",
      requiredFields: [
        ["fund_type", "missing_fund_type", "Fund exists but is missing fund type.", "Warning"],
        [
          "reporting_model",
          "missing_reporting_model",
          "Fund exists but is missing reporting model.",
          "High"
        ]
      ],
      rows: references.funds,
      segmentType: "fund"
    },
    {
      codeField: "object_code",
      nameField: "object_name",
      referenceTable: "objects",
      requiredFields: [
        ["account_type", "missing_object_account_type", "Object exists but is missing account type.", "High"]
      ],
      rows: references.objects,
      segmentType: "object"
    },
    {
      codeField: "acfr_code",
      nameField: "acfr_name",
      referenceTable: "acfr_mappings",
      requiredFields: [],
      rows: references.acfr,
      segmentType: "acfr"
    },
    {
      codeField: "department_code",
      nameField: "department_name",
      referenceTable: "departments",
      requiredFields: [],
      rows: references.departments,
      segmentType: "department"
    },
    {
      codeField: "function_code",
      nameField: "function_name",
      referenceTable: "functions",
      requiredFields: [],
      rows: references.functions,
      segmentType: "function"
    }
  ] as const;

  for (const dimension of dimensions) {
    const lineGroups = groupLinesByCode(
      lines,
      dimension.codeField as keyof ActiveTrialBalanceLine
    );

    for (const [code, groupedLines] of lineGroups.entries()) {
      if (!code) continue;

      const referenceRow = dimension.rows.get(code);
      const affectedAmount = sum(groupedLines.map((line) => money(line.ending_balance)));
      if (!referenceRow) {
        issues.push({
          affectedAmount,
          affectedRowCount: groupedLines.length,
          coverageIssueType: `missing_${dimension.segmentType}_mapping`,
          message: `${dimension.segmentType} code ${code} is used by posted trial balance rows but is missing from ${dimension.referenceTable}.`,
          recommendedAction: `Add ${code} to ${dimension.referenceTable} or correct the trial balance mapping.`,
          referenceStatus: "missing",
          referenceTable: dimension.referenceTable,
          segmentCode: code,
          segmentName: null,
          segmentType: dimension.segmentType,
          severity:
            dimension.segmentType === "fund" || dimension.segmentType === "object"
              ? "High"
              : "Warning"
        });
        continue;
      }

      if (text(referenceRow.active_status) === "inactive") {
        issues.push({
          affectedAmount,
          affectedRowCount: groupedLines.length,
          coverageIssueType: "inactive_reference_mapping",
          message: `${dimension.segmentType} code ${code} is inactive but is used by posted trial balance rows.`,
          recommendedAction: "Reactivate the reference row or correct the posted trial balance mapping.",
          referenceStatus: "inactive",
          referenceTable: dimension.referenceTable,
          segmentCode: code,
          segmentName: textOrNull(referenceRow[dimension.nameField]),
          segmentType: dimension.segmentType,
          severity: "Warning"
        });
      }

      if (
        dimension.segmentType === "fund" &&
        text(referenceRow.active_status) !== "inactive" &&
        !booleanValue(referenceRow.include_in_standard_reporting, true)
      ) {
        const reportingTreatment =
          text(referenceRow.reporting_treatment) || "reportable";
        const exclusionReason = text(referenceRow.reporting_exclusion_reason);
        const includeInCashReconciliation = booleanValue(
          referenceRow.include_in_cash_reconciliation,
          false
        );

        if (reportingTreatment === "pooled_cash") {
          if (!includeInCashReconciliation) {
            issues.push({
              affectedAmount,
              affectedRowCount: groupedLines.length,
              coverageIssueType: "pooled_cash_not_in_cash_reconciliation",
              message: `Fund code ${code} is configured as pooled cash but is not included in cash reconciliation.`,
              recommendedAction:
                "Set Include In Cash Reconciliation to Yes or choose a different reporting treatment.",
              referenceStatus: "active_pooled_cash",
              referenceTable: dimension.referenceTable,
              segmentCode: code,
              segmentName: textOrNull(referenceRow[dimension.nameField]),
              segmentType: "fund",
              severity: "Warning"
            });
          }
        } else if (reportingTreatment === "reportable") {
          issues.push({
            affectedAmount,
            affectedRowCount: groupedLines.length,
            coverageIssueType: "excluded_fund_missing_reporting_treatment",
            message: `Fund code ${code} is active and excluded from standard reporting but has reportable treatment.`,
            recommendedAction:
              "Choose a reporting treatment such as pooled_cash, clearing, elimination, reconciliation_only, or other_excluded.",
            referenceStatus: "active_excluded",
            referenceTable: dimension.referenceTable,
            segmentCode: code,
            segmentName: textOrNull(referenceRow[dimension.nameField]),
            segmentType: "fund",
            severity: "Warning"
          });
        }

        if (!exclusionReason) {
          issues.push({
            affectedAmount,
            affectedRowCount: groupedLines.length,
            coverageIssueType: "excluded_fund_missing_exclusion_reason",
            message: `Fund code ${code} is active and excluded from standard reporting without an exclusion reason.`,
            recommendedAction:
              "Add a reporting exclusion reason so reviewers understand why the fund is excluded.",
            referenceStatus:
              reportingTreatment === "pooled_cash"
                ? "active_pooled_cash"
                : "active_excluded",
            referenceTable: dimension.referenceTable,
            segmentCode: code,
            segmentName: textOrNull(referenceRow[dimension.nameField]),
            segmentType: "fund",
            severity: "Warning"
          });
        }

        continue;
      }

      for (const [field, issueType, message, severity] of dimension.requiredFields) {
        if (!text(referenceRow[field])) {
          issues.push({
            affectedAmount,
            affectedRowCount: groupedLines.length,
            coverageIssueType: issueType,
            message: `${message} Code: ${code}.`,
            recommendedAction: `Update ${field} on ${dimension.referenceTable}.`,
            referenceStatus: "incomplete",
            referenceTable: dimension.referenceTable,
            segmentCode: code,
            segmentName: textOrNull(referenceRow[dimension.nameField]),
            segmentType: dimension.segmentType,
            severity: severity as CoverageIssue["severity"]
          });
        }
      }

      if (dimension.segmentType === "object") {
        const accountType = normalizeClassification(text(referenceRow.account_type));
        const balanceSheetLine = text(
          referenceRow.balance_sheet_line ?? referenceRow.balance_sheet_category
        );
        const activityStatementLine = text(
          referenceRow.activity_statement_line ?? referenceRow.statement_category
        );

        if (isBalanceSheetAccountType(accountType) && !balanceSheetLine) {
          issues.push({
            affectedAmount,
            affectedRowCount: groupedLines.length,
            coverageIssueType: "missing_object_balance_sheet_line",
            message: `Object code ${code} is missing balance sheet line for a balance-sheet account type.`,
            recommendedAction: "Populate balance_sheet_line on the object mapping.",
            referenceStatus: "incomplete",
            referenceTable: dimension.referenceTable,
            segmentCode: code,
            segmentName: textOrNull(referenceRow[dimension.nameField]),
            segmentType: "object",
            severity: "High"
          });
        }

        if (isActivityStatementAccountType(accountType) && !activityStatementLine) {
          issues.push({
            affectedAmount,
            affectedRowCount: groupedLines.length,
            coverageIssueType: "missing_object_activity_statement_line",
            message: `Object code ${code} is missing activity statement line for an activity-statement account type.`,
            recommendedAction: "Populate activity_statement_line on the object mapping.",
            referenceStatus: "incomplete",
            referenceTable: dimension.referenceTable,
            segmentCode: code,
            segmentName: textOrNull(referenceRow[dimension.nameField]),
            segmentType: "object",
            severity: "High"
          });
        }
      }
    }
  }

  return issues;
}

function buildResults({
  calculationRunId,
  comparison,
  coverageIssues,
  enrichedLines,
  request,
  thresholdConfig
}: {
  calculationRunId: string;
  comparison: ComparisonSet<EnrichedLine>;
  coverageIssues: CoverageIssue[];
  enrichedLines: EnrichedLine[];
  request: RunCalculationRequest;
  thresholdConfig: ThresholdConfig;
}): ResultRows {
  const importBatchIds = unique(enrichedLines.map((line) => line.import_batch_id));
  const dashboardFacts = buildDashboardFinancialFacts({
    calculationRunId,
    importBatchIds,
    lines: enrichedLines,
    request
  });
  const financialSummaries = buildFinancialSummaries({
    calculationRunId,
    importBatchIds,
    lines: enrichedLines,
    request
  });
  const statementSummaries = buildStatementSummaries({
    calculationRunId,
    importBatchIds,
    lines: enrichedLines,
    request
  });
  const variances = buildVarianceRows({
    calculationRunId,
    comparison,
    currentLines: enrichedLines,
    importBatchIds,
    request,
    thresholdConfig
  });
  const trends = buildTrendRows({
    calculationRunId,
    importBatchIds,
    lines: enrichedLines,
    request
  });
  const mappingCoverage = coverageIssues.map((issue) => ({
    affected_amount: issue.affectedAmount,
    affected_row_count: issue.affectedRowCount,
    calculation_run_id: calculationRunId,
    coverage_issue_type: issue.coverageIssueType,
    fiscal_year: request.fiscalYear,
    message: issue.message,
    organization_id: request.organizationId,
    period: request.periodTo,
    recommended_action: issue.recommendedAction,
    reference_status: issue.referenceStatus,
    reference_table: issue.referenceTable,
    segment_code: issue.segmentCode,
    segment_name: issue.segmentName,
    segment_type: issue.segmentType,
    severity: issue.severity
  }));
  const exceptions = [
    ...coverageIssues.map((issue) =>
      buildExceptionRow({
        calculationRunId,
        category: "mapping_coverage",
        currentAmount: issue.affectedAmount,
        importBatchIds,
        message: issue.message,
        organizationId: request.organizationId,
        period: request.periodTo,
        recommendedAction: issue.recommendedAction,
        request,
        segmentCode: issue.segmentCode,
        segmentType: issue.segmentType,
        severity: issue.severity,
        type: issue.coverageIssueType
      })
    ),
    ...buildAvailabilityExceptions({
      calculationRunId,
      comparison,
      importBatchIds,
      request
    }),
    ...buildTrialBalanceIntegrityExceptions({
      calculationRunId,
      importBatchIds,
      lines: enrichedLines,
      request
    }),
    ...buildVarianceExceptions({
      calculationRunId,
      importBatchIds,
      request,
      variances
    }),
    ...buildCashExceptions({
      calculationRunId,
      importBatchIds,
      lines: enrichedLines,
      request
    })
  ];

  return {
    dashboardFacts,
    exceptions,
    financialSummaries,
    mappingCoverage,
    statementSummaries,
    trends,
    variances
  };
}

const DASHBOARD_FACT_GROUPS = [
  { fields: [] as const, summaryType: "all" },
  { fields: ["fund_code"] as const, summaryType: "fund" },
  { fields: ["fund_code", "account_type"] as const, summaryType: "fund_account_type" },
  {
    fields: ["fund_code", "activity_statement_line"] as const,
    summaryType: "fund_activity_statement_line"
  },
  {
    fields: ["fund_code", "balance_sheet_line"] as const,
    summaryType: "fund_balance_sheet_line"
  },
  { fields: ["fund_group"] as const, summaryType: "fund_group" },
  {
    fields: ["fund_group", "account_type"] as const,
    summaryType: "fund_group_account_type"
  },
  { fields: ["department_code"] as const, summaryType: "department" },
  {
    fields: ["department_code", "account_type"] as const,
    summaryType: "department_account_type"
  },
  {
    fields: ["department_code", "activity_statement_line"] as const,
    summaryType: "department_activity_statement_line"
  },
  {
    fields: ["department_code", "balance_sheet_line"] as const,
    summaryType: "department_balance_sheet_line"
  },
  { fields: ["function_code"] as const, summaryType: "function" },
  {
    fields: ["function_code", "account_type"] as const,
    summaryType: "function_account_type"
  },
  {
    fields: ["function_code", "activity_statement_line"] as const,
    summaryType: "function_activity_statement_line"
  },
  {
    fields: ["function_code", "balance_sheet_line"] as const,
    summaryType: "function_balance_sheet_line"
  },
  { fields: ["acfr_code"] as const, summaryType: "acfr" },
  { fields: ["acfr_code", "account_type"] as const, summaryType: "acfr_account_type" },
  {
    fields: ["acfr_code", "activity_statement_line"] as const,
    summaryType: "acfr_activity_statement_line"
  },
  {
    fields: ["acfr_code", "balance_sheet_line"] as const,
    summaryType: "acfr_balance_sheet_line"
  },
  { fields: ["object_code"] as const, summaryType: "object" },
  { fields: ["object_code", "account_type"] as const, summaryType: "object_account_type" },
  { fields: ["account_type"] as const, summaryType: "account_type" },
  { fields: ["activity_statement_line"] as const, summaryType: "activity_statement_line" },
  { fields: ["balance_sheet_line"] as const, summaryType: "balance_sheet_line" },
  {
    fields: [
      "fund_code",
      "department_code",
      "function_code",
      "acfr_code",
      "object_code",
      "account_type",
      "activity_statement_line",
      "balance_sheet_line"
    ] as const,
    summaryType: "dashboard_detail"
  }
];

type DashboardFactField = (typeof DASHBOARD_FACT_GROUPS)[number]["fields"][number];

function buildDashboardFinancialFacts({
  calculationRunId,
  importBatchIds,
  lines,
  request
}: {
  calculationRunId: string;
  importBatchIds: string[];
  lines: EnrichedLine[];
  request: RunCalculationRequest;
}) {
  const rows: Record<string, unknown>[] = [];

  for (const group of DASHBOARD_FACT_GROUPS) {
    for (const [summaryKey, groupedLines] of groupLinesByFields(lines, group.fields)) {
      if (group.summaryType !== "all" && group.summaryType !== "dashboard_detail" && !summaryKey) {
        continue;
      }

      rows.push(
        buildDashboardFinancialFactRow({
          calculationRunId,
          fields: group.fields,
          importBatchIds,
          lines: groupedLines,
          request,
          summaryKey: summaryKey || "all",
          summaryType: group.summaryType
        })
      );
    }
  }

  return rows;
}

function buildDashboardFinancialFactRow({
  calculationRunId,
  fields,
  importBatchIds,
  lines,
  request,
  summaryKey,
  summaryType
}: {
  calculationRunId: string;
  fields: readonly DashboardFactField[];
  importBatchIds: string[];
  lines: EnrichedLine[];
  request: RunCalculationRequest;
  summaryKey: string;
  summaryType: string;
}) {
  const sample = lines[0];
  const netChange = sum(lines.map((line) => money(line.net_change)));
  const accountType = sample?.account_type ?? null;
  const beginningBalance = sumPeriodAmount(lines, request.periodFrom, "beginning_balance");
  const endingBalance = sumPeriodAmount(lines, request.periodTo, "ending_balance");

  return {
    account_type: sample?.account_type ?? null,
    activity_statement_line: sample?.activity_statement_line ?? null,
    acfr_code: sample?.acfr_code ?? null,
    balance_sheet_line: sample?.balance_sheet_line ?? null,
    beginning_balance: beginningBalance,
    calculation_run_id: calculationRunId,
    credits: sum(lines.map((line) => money(line.credits))),
    debits: sum(lines.map((line) => money(line.debits))),
    department_code: sample?.department_code ?? null,
    ending_balance: endingBalance,
    fiscal_year: request.fiscalYear,
    function_code: sample?.function_code ?? null,
    fund_code: sample?.fund_code ?? null,
    fund_group: sample?.fund_group ?? null,
    net_change: netChange,
    object_code: sample?.object_code ?? null,
    organization_id: request.organizationId,
    period_from: request.periodFrom,
    period_to: request.periodTo,
    presentation_amount: presentationAmount({
      accountType,
      amount: netChange,
      amountType: "activity"
    }),
    reporting_model: sample?.reporting_model ?? null,
    reporting_scope: request.reportingScope ?? "standard",
    result_payload: {
      balance_period_from: request.periodFrom,
      balance_period_to: request.periodTo,
      group_fields: fields,
      line_count: lines.length,
      trial_balance_import_batch_ids: importBatchIds
    },
    row_count: lines.length,
    summary_key: summaryKey,
    summary_label: titleize(summaryKey),
    summary_type: summaryType,
    time_view: request.timeView
  };
}

function groupLinesByFields(
  lines: EnrichedLine[],
  fields: readonly DashboardFactField[]
) {
  const grouped = new Map<string, EnrichedLine[]>();

  if (fields.length === 0) {
    grouped.set("all", lines);
    return grouped;
  }

  for (const line of lines) {
    const key = fields
      .map((field) => text(line[field]) || "not_provided")
      .join("|");
    grouped.set(key, [...(grouped.get(key) ?? []), line]);
  }

  return grouped;
}

function aggregateLinesByFields(
  lines: EnrichedLine[],
  fields: readonly DashboardFactField[]
) {
  const grouped = new Map<string, { amount: number; sample: EnrichedLine | undefined }>();

  for (const line of lines) {
    const key = fields.map((field) => text(line[field]) || "not_provided").join("|");
    const current = grouped.get(key) ?? { amount: 0, sample: line };
    current.amount += money(line.net_change);
    current.sample ??= line;
    grouped.set(key, current);
  }

  return grouped;
}

function buildFinancialSummaries({
  calculationRunId,
  importBatchIds,
  lines,
  request
}: {
  calculationRunId: string;
  importBatchIds: string[];
  lines: EnrichedLine[];
  request: RunCalculationRequest;
}) {
  const dimensions = [
    ["fund", "fund_code"],
    ["department", "department_code"],
    ["function", "function_code"],
    ["acfr", "acfr_code"],
    ["object", "object_code"],
    ["account_type", "account_type"],
    ["balance_sheet_line", "balance_sheet_line"],
    ["activity_statement_line", "activity_statement_line"],
    ["fund_type", "fund_type"],
    ["reporting_model", "reporting_model"]
  ] as const;
  const rows: Record<string, unknown>[] = [];

  rows.push(
    buildFinancialSummaryRow({
      calculationRunId,
      importBatchIds,
      lines,
      request,
      summaryKey: "all",
      summaryType: request.timeView
    })
  );

  for (const [summaryType, field] of dimensions) {
    for (const [summaryKey, groupedLines] of groupEnrichedLines(lines, field)) {
      if (!summaryKey) continue;
      rows.push(
        buildFinancialSummaryRow({
          calculationRunId,
          dimensionField: field,
          importBatchIds,
          lines: groupedLines,
          request,
          summaryKey,
          summaryType
        })
      );
    }
  }

  return rows;
}

function buildFinancialSummaryRow({
  calculationRunId,
  dimensionField,
  importBatchIds,
  lines,
  request,
  summaryKey,
  summaryType
}: {
  calculationRunId: string;
  dimensionField?: keyof EnrichedLine;
  importBatchIds: string[];
  lines: EnrichedLine[];
  request: RunCalculationRequest;
  summaryKey: string;
  summaryType: string;
}) {
  const beginningBalance = sumPeriodAmount(lines, request.periodFrom, "beginning_balance");
  const endingBalance = sumPeriodAmount(lines, request.periodTo, "ending_balance");
  const netChange = sum(lines.map((line) => money(line.net_change)));
  const sample = lines[0];
  const accountType = sample?.account_type ?? null;
  const amountType =
    request.timeView === "current_period"
      ? "current_period_activity"
      : request.timeView === "ytd"
        ? "ytd_activity"
        : "selected_range_activity";

  return {
    account_type: sample?.account_type ?? null,
    activity_statement_line: sample?.activity_statement_line ?? null,
    acfr_code: sample?.acfr_code ?? null,
    amount_type: amountType,
    amount_value: netChange,
    balance_sheet_line: sample?.balance_sheet_line ?? null,
    beginning_balance: beginningBalance,
    calculation_run_id: calculationRunId,
    credits: sum(lines.map((line) => money(line.credits))),
    debits: sum(lines.map((line) => money(line.debits))),
    department_code: sample?.department_code ?? null,
    ending_balance: endingBalance,
    fiscal_year: request.fiscalYear,
    function_code: sample?.function_code ?? null,
    fund_code: sample?.fund_code ?? null,
    fund_type: sample?.fund_type ?? null,
    net_change: netChange,
    object_code: sample?.object_code ?? null,
    organization_id: request.organizationId,
    period: request.periodTo,
    period_from: request.periodFrom,
    period_to: request.periodTo,
    presentation_amount: presentationAmount({
      accountType,
      amount: netChange,
      amountType: "activity"
    }),
    reporting_model: sample?.reporting_model ?? null,
    result_payload: {
      dimension_field: dimensionField ?? null,
      line_count: lines.length
    },
    summary_key: summaryKey,
    summary_scope: summaryType,
    summary_type: summaryType,
    trial_balance_import_batch_ids: importBatchIds
  };
}

function buildStatementSummaries({
  calculationRunId,
  importBatchIds,
  lines,
  request
}: {
  calculationRunId: string;
  importBatchIds: string[];
  lines: EnrichedLine[];
  request: RunCalculationRequest;
}) {
  const grouped = new Map<string, EnrichedLine[]>();
  for (const line of lines) {
    const category = getStatementCategory(line);
    const reportingModel = line.reporting_model ?? "unclassified";
    const key = `${reportingModel}|${category}`;
    grouped.set(key, [...(grouped.get(key) ?? []), line]);
  }

  return [...grouped.entries()].map(([key, groupedLines], index) => {
    const [reportingModel, category] = key.split("|");
    const amount = sum(groupedLines.map((line) => money(line.net_change)));
    const sample = groupedLines[0];
    return {
      amount,
      amount_value: amount,
      calculation_run_id: calculationRunId,
      fiscal_year: request.fiscalYear,
      fund_type: sample?.fund_type ?? null,
      line_code: category,
      line_item_category: category,
      line_item_code: category,
      line_item_name: titleize(category),
      line_name: titleize(category),
      line_order: index + 1,
      organization_id: request.organizationId,
      period_from: request.periodFrom,
      period_to: request.periodTo,
      presentation_amount: presentationAmount({
        accountType: sample?.account_type,
        amount,
        amountType: "statement"
      }),
      reporting_model: reportingModel,
      result_payload: {
        line_count: groupedLines.length
      },
      sort_order: index + 1,
      statement_type: getStatementType(reportingModel),
      trial_balance_import_batch_ids: importBatchIds
    };
  });
}

function buildVarianceRows({
  calculationRunId,
  comparison,
  currentLines,
  importBatchIds,
  request,
  thresholdConfig
}: {
  calculationRunId: string;
  comparison: ComparisonSet<EnrichedLine>;
  currentLines: EnrichedLine[];
  importBatchIds: string[];
  request: RunCalculationRequest;
  thresholdConfig: ThresholdConfig;
}) {
  const rows: Record<string, unknown>[] = [];
  rows.push(
    ...buildVarianceForComparison({
      calculationRunId,
      comparisonFiscalYear: request.fiscalYear,
      comparisonLines: comparison.priorPeriod.lines,
      comparisonPeriod: request.periodFrom - 1,
      currentLines,
      importBatchIds,
      request,
      thresholdConfig,
      varianceType: "current_period_vs_prior_period"
    })
  );
  rows.push(
    ...buildVarianceForComparison({
      calculationRunId,
      comparisonFiscalYear: request.fiscalYear - 1,
      comparisonLines: comparison.priorYear.lines,
      comparisonPeriod: request.periodTo,
      currentLines,
      importBatchIds,
      request,
      thresholdConfig,
      varianceType: request.timeView === "ytd" ? "ytd_vs_prior_year_ytd" : "current_period_vs_prior_year"
    })
  );

  return rows;
}

function buildVarianceForComparison({
  calculationRunId,
  comparisonFiscalYear,
  comparisonLines,
  comparisonPeriod,
  currentLines,
  importBatchIds,
  request,
  thresholdConfig,
  varianceType
}: {
  calculationRunId: string;
  comparisonFiscalYear: number;
  comparisonLines: EnrichedLine[];
  comparisonPeriod: number;
  currentLines: EnrichedLine[];
  importBatchIds: string[];
  request: RunCalculationRequest;
  thresholdConfig: ThresholdConfig;
  varianceType: string;
}) {
  if (comparisonLines.length === 0) {
    return [];
  }

  const rows: Record<string, unknown>[] = [];
  const varianceGroups = [
    { fields: ["fund_code"] as const, scope: "fund" },
    { fields: ["fund_code", "object_code"] as const, scope: "fund_object" },
    { fields: ["fund_code", "account_type"] as const, scope: "fund_account_type" },
    { fields: ["department_code"] as const, scope: "department" },
    { fields: ["department_code", "object_code"] as const, scope: "department_object" },
    { fields: ["function_code"] as const, scope: "function" },
    { fields: ["function_code", "object_code"] as const, scope: "function_object" },
    { fields: ["acfr_code"] as const, scope: "acfr" },
    { fields: ["acfr_code", "object_code"] as const, scope: "acfr_object" },
    { fields: ["object_code"] as const, scope: "object_code" },
    { fields: ["account_type"] as const, scope: "account_type" },
    { fields: ["activity_statement_line"] as const, scope: "activity_statement_line" },
    { fields: ["balance_sheet_line"] as const, scope: "balance_sheet_line" }
  ];

  for (const group of varianceGroups) {
    const currentByKey = aggregateLinesByFields(currentLines, group.fields);
    const comparisonByKey = aggregateLinesByFields(comparisonLines, group.fields);
    const keys = unique([...currentByKey.keys(), ...comparisonByKey.keys()]);

    for (const key of keys) {
      const currentGroup = currentByKey.get(key);
      const comparisonGroup = comparisonByKey.get(key);
      const currentAmount = currentGroup?.amount ?? 0;
      const comparisonAmount = comparisonGroup?.amount ?? 0;
      const sample = currentGroup?.sample ?? comparisonGroup?.sample;
    const varianceAmount = currentAmount - comparisonAmount;
    const variancePercent =
      Math.abs(comparisonAmount) < thresholdConfig.minimumBaseAmountForPercentageVariance
        ? null
        : varianceAmount / Math.abs(comparisonAmount);
    const absoluteVarianceAmount = Math.abs(varianceAmount);

      rows.push({
      absolute_variance_amount: absoluteVarianceAmount,
      account_type: sample?.account_type ?? null,
      acfr_code: sample?.acfr_code ?? null,
      calculation_run_id: calculationRunId,
      comparison_amount: comparisonAmount,
      comparison_fiscal_year: comparisonFiscalYear,
      comparison_period: comparisonPeriod,
      comparison_type: varianceType,
      current_amount: currentAmount,
      department_code: sample?.department_code ?? null,
      fiscal_year: request.fiscalYear,
      function_code: sample?.function_code ?? null,
      fund_code: sample?.fund_code ?? null,
      fund_type: sample?.fund_type ?? null,
      object_code: (group.fields as readonly string[]).includes("object_code")
        ? sample?.object_code ?? null
        : null,
      organization_id: request.organizationId,
      period: request.periodTo,
      reporting_model: sample?.reporting_model ?? null,
      result_payload: {
        activity_statement_line: sample?.activity_statement_line ?? null,
        balance_sheet_line: sample?.balance_sheet_line ?? null,
        fund_group: sample?.fund_group ?? null,
        group_fields: group.fields,
        minimum_base_amount_applied:
          variancePercent === null &&
          Math.abs(comparisonAmount) <
            thresholdConfig.minimumBaseAmountForPercentageVariance
      },
      severity: classifyVarianceSeverity({
        absoluteVarianceAmount,
        thresholdConfig,
        variancePercent
      }),
      trial_balance_import_batch_ids: importBatchIds,
      variance_amount: varianceAmount,
      variance_key: key || "unmapped_object",
      variance_percent: variancePercent,
      variance_scope: group.scope,
      variance_type: varianceType
      });
    }
  }

  return rows;
}

function buildTrendRows({
  calculationRunId,
  importBatchIds,
  lines,
  request
}: {
  calculationRunId: string;
  importBatchIds: string[];
  lines: EnrichedLine[];
  request: RunCalculationRequest;
}) {
  const rows: Record<string, unknown>[] = [];
  const trendGroups = [
    { fields: [] as const, scope: "period" },
    { fields: ["fund_code"] as const, scope: "fund_period" },
    { fields: ["department_code"] as const, scope: "department_period" },
    { fields: ["function_code"] as const, scope: "function_period" },
    { fields: ["acfr_code"] as const, scope: "acfr_period" },
    { fields: ["account_type"] as const, scope: "account_type_period" },
    { fields: ["activity_statement_line"] as const, scope: "activity_statement_line_period" },
    { fields: ["balance_sheet_line"] as const, scope: "balance_sheet_line_period" }
  ];

  for (const group of trendGroups) {
    const grouped = new Map<string, EnrichedLine[]>();

    for (const line of lines) {
      const keyParts = [String(line.period), ...group.fields.map((field) => text(line[field]) || "not_provided")];
      const key = keyParts.join("|");
      grouped.set(key, [...(grouped.get(key) ?? []), line]);
    }

    for (const [key, groupedLines] of grouped) {
      const amount = sum(groupedLines.map((line) => money(line.net_change)));
      const sample = groupedLines[0];
      rows.push({
        account_type: sample?.account_type ?? null,
        acfr_code: sample?.acfr_code ?? null,
        amount_type: "period_activity",
        amount_value: amount,
        calculation_run_id: calculationRunId,
        department_code: sample?.department_code ?? null,
        fiscal_year: request.fiscalYear,
        function_code: sample?.function_code ?? null,
        fund_code: sample?.fund_code ?? null,
        fund_type: sample?.fund_type ?? null,
        object_code: sample?.object_code ?? null,
        organization_id: request.organizationId,
        period: Number(sample?.period ?? request.periodTo),
        period_end: request.periodTo,
        period_start: request.periodFrom,
        presentation_amount: presentationAmount({
          accountType: sample?.account_type,
          amount,
          amountType: "activity"
        }),
        reporting_model: sample?.reporting_model ?? null,
        trend_key: key,
        trend_payload: {
          activity_statement_line: sample?.activity_statement_line ?? null,
          balance_sheet_line: sample?.balance_sheet_line ?? null,
          fund_group: sample?.fund_group ?? null,
          group_fields: group.fields,
          line_count: groupedLines.length
        },
        trend_scope: group.scope,
        trend_type: request.timeView === "ytd" ? "ytd_trend" : "period_over_period",
        trial_balance_import_batch_ids: importBatchIds
      });
    }
  }

  return rows;
}

function buildAvailabilityExceptions({
  calculationRunId,
  comparison,
  importBatchIds,
  request
}: {
  calculationRunId: string;
  comparison: Awaited<ReturnType<typeof loadComparisonLines>>;
  importBatchIds: string[];
  request: RunCalculationRequest;
}) {
  const rows: Record<string, unknown>[] = [];

  if (comparison.priorYear.availability === "unavailable") {
    rows.push(
      buildExceptionRow({
        calculationRunId,
        category: "comparison_availability",
        importBatchIds,
        message: "Prior-year posted data is unavailable for the selected range.",
        organizationId: request.organizationId,
        period: request.periodTo,
        recommendedAction: "Post prior-year actuals before relying on prior-year comparison outputs.",
        request,
        severity: "Info",
        type: "missing_prior_year_comparison_data"
      })
    );
  }

  if (comparison.priorYear.availability === "partial") {
    rows.push(
      buildExceptionRow({
        calculationRunId,
        category: "comparison_availability",
        importBatchIds,
        message: "Prior-year posted data is only partially available for the selected range.",
        organizationId: request.organizationId,
        period: request.periodTo,
        recommendedAction: "Post the missing prior-year periods or limit comparison ranges.",
        request,
        severity: "Warning",
        type: "partial_prior_year_comparison_data"
      })
    );
  }

  return rows;
}

function buildVarianceExceptions({
  calculationRunId,
  importBatchIds,
  request,
  variances
}: {
  calculationRunId: string;
  importBatchIds: string[];
  request: RunCalculationRequest;
  variances: Record<string, unknown>[];
}) {
  return variances
    .filter((variance) => ["Warning", "High"].includes(String(variance.severity)))
    .map((variance) =>
      buildExceptionRow({
        calculationRunId,
        category: "variance",
        currentAmount: Number(variance.current_amount ?? 0),
        dimensions: {
          account_type: textOrNull(variance.account_type),
          acfr_code: textOrNull(variance.acfr_code),
          department_code: textOrNull(variance.department_code),
          function_code: textOrNull(variance.function_code),
          fund_code: textOrNull(variance.fund_code),
          object_code: textOrNull(variance.object_code),
          reporting_model: textOrNull(variance.reporting_model)
        },
        importBatchIds,
        message: `Object ${variance.object_code ?? "unmapped"} has a material ${variance.variance_type} change.`,
        organizationId: request.organizationId,
        period: request.periodTo,
        recommendedAction: "Review the underlying posted trial balance activity and object classification.",
        request,
        segmentCode: String(variance.object_code ?? ""),
        segmentType: "object",
        severity: variance.severity as "Warning" | "High",
        type:
          Math.abs(Number(variance.variance_percent ?? 0)) > 0
            ? "large_percentage_change"
            : "large_dollar_change",
        varianceAmount: Number(variance.variance_amount ?? 0),
        variancePercent:
          variance.variance_percent === null
            ? null
            : Number(variance.variance_percent ?? 0)
      })
    );
}

function buildCashExceptions({
  calculationRunId,
  importBatchIds,
  lines,
  request
}: {
  calculationRunId: string;
  importBatchIds: string[];
  lines: EnrichedLine[];
  request: RunCalculationRequest;
}) {
  const cashLines = lines.filter((line) => isCashLine(line));
  const cashBalance = sum(cashLines.map((line) => money(line.ending_balance)));

  if (cashLines.length === 0) {
    return [
      buildExceptionRow({
        calculationRunId,
        category: "cash_analysis",
        importBatchIds,
        message: "Cash accounts could not be identified from object classifications.",
        organizationId: request.organizationId,
        period: request.periodTo,
        recommendedAction: "Populate cash-related object classifications before relying on cash analysis.",
        request,
        severity: "Warning",
        type: "missing_mapping_classification"
      })
    ];
  }

  if (cashBalance < 0) {
    return [
      buildExceptionRow({
        calculationRunId,
        category: "cash_analysis",
        currentAmount: cashBalance,
        importBatchIds,
        message: "Cash and investments balance is negative.",
        organizationId: request.organizationId,
        period: request.periodTo,
        recommendedAction: "Review cash object mapping and posted trial balance amounts.",
        request,
        severity: "High",
        type: "negative_cash_balance"
      })
    ];
  }

  return [];
}

function buildTrialBalanceIntegrityExceptions({
  calculationRunId,
  importBatchIds,
  lines,
  request
}: {
  calculationRunId: string;
  importBatchIds: string[];
  lines: EnrichedLine[];
  request: RunCalculationRequest;
}) {
  const exceptions: Record<string, unknown>[] = [];
  const batchTotals = buildPostedBalanceTotals(lines);

  if (!amountsTie(batchTotals.endingBalance, 0)) {
    exceptions.push(
      buildExceptionRow({
        calculationRunId,
        category: "trial_balance_integrity",
        currentAmount: batchTotals.endingBalance,
        importBatchIds,
        message: "Posted active trial balance data does not balance for the selected range.",
        organizationId: request.organizationId,
        period: request.periodTo,
        recommendedAction:
          "Review active posted import for the selected fiscal year/period range.",
        request,
        severity: "Critical",
        type: "batch_out_of_balance"
      })
    );
  }

  if (hasMeaningfulDebitCreditActivity(batchTotals)) {
    const debitCreditDifference = batchTotals.debits - batchTotals.credits;
    if (!amountsTie(debitCreditDifference, 0)) {
      exceptions.push(
        buildExceptionRow({
          calculationRunId,
          category: "trial_balance_integrity",
          currentAmount: debitCreditDifference,
          importBatchIds,
          message: "Posted active trial balance debits do not equal credits for the selected range.",
          organizationId: request.organizationId,
          period: request.periodTo,
          recommendedAction:
            "Review active posted import rows and debit/credit mappings for the selected range.",
          request,
          severity: "Critical",
          type: "batch_debits_credits_out_of_balance"
        })
      );
    }
  }

  for (const [fundCode, fundTotals] of buildPostedFundBalanceTotals(lines)) {
    if (!amountsTie(fundTotals.endingBalance, 0)) {
      exceptions.push(
        buildExceptionRow({
          calculationRunId,
          category: "trial_balance_integrity",
          currentAmount: fundTotals.endingBalance,
          importBatchIds,
          message: `Fund ${fundCode} does not balance for the selected calculation range.`,
          organizationId: request.organizationId,
          period: request.periodTo,
          recommendedAction:
            "Review posted trial balance source, replacement/supersession status, and fund/account rows.",
          request,
          segmentCode: fundCode,
          segmentType: "fund",
          severity: "Critical",
          type: "fund_out_of_balance"
        })
      );
    }

    if (hasMeaningfulDebitCreditActivity(fundTotals)) {
      const debitCreditDifference = fundTotals.debits - fundTotals.credits;
      if (!amountsTie(debitCreditDifference, 0)) {
        exceptions.push(
          buildExceptionRow({
            calculationRunId,
            category: "trial_balance_integrity",
            currentAmount: debitCreditDifference,
            importBatchIds,
            message: `Fund ${fundCode} debits do not equal credits for the selected calculation range.`,
            organizationId: request.organizationId,
            period: request.periodTo,
            recommendedAction:
              "Review posted trial balance source, debit/credit mappings, and fund/account rows.",
            request,
            segmentCode: fundCode,
            segmentType: "fund",
            severity: "Critical",
            type: "fund_debits_credits_out_of_balance"
          })
        );
      }
    }
  }

  for (const line of lines) {
    const expectedEnding = money(line.beginning_balance) + money(line.net_change);
    if (!amountsTie(expectedEnding, money(line.ending_balance))) {
      exceptions.push(
        buildExceptionRow({
          calculationRunId,
          category: "trial_balance_integrity",
          currentAmount: money(line.ending_balance) - expectedEnding,
          importBatchIds,
          message: `Posted row ${line.full_account_number} does not foot. Beginning balance plus net change does not equal ending balance.`,
          organizationId: request.organizationId,
          period: request.periodTo,
          recommendedAction:
            "Review beginning balance, net change, and ending balance in the posted source row.",
          request,
          segmentCode: line.fund_code ?? undefined,
          segmentType: line.fund_code ? "fund" : undefined,
          severity: "Critical",
          type: "row_formula_mismatch"
        })
      );
    }

    const expectedNetChange = money(line.debits) - money(line.credits);
    if (!amountsTie(expectedNetChange, money(line.net_change))) {
      exceptions.push(
        buildExceptionRow({
          calculationRunId,
          category: "trial_balance_integrity",
          currentAmount: money(line.net_change) - expectedNetChange,
          importBatchIds,
          message: `Posted row ${line.full_account_number} net change does not match debit/credit activity.`,
          organizationId: request.organizationId,
          period: request.periodTo,
          recommendedAction:
            "Review debit, credit, and net change columns or confirm export sign convention.",
          request,
          segmentCode: line.fund_code ?? undefined,
          segmentType: line.fund_code ? "fund" : undefined,
          severity: "Critical",
          type: "row_net_change_mismatch"
        })
      );
    }
  }

  return exceptions;
}

function buildPostedBalanceTotals(lines: ActiveTrialBalanceLine[]) {
  return lines.reduce(
    (totals, line) => ({
      credits: totals.credits + money(line.credits),
      debits: totals.debits + money(line.debits),
      endingBalance: totals.endingBalance + money(line.ending_balance)
    }),
    { credits: 0, debits: 0, endingBalance: 0 }
  );
}

function buildPostedFundBalanceTotals(lines: ActiveTrialBalanceLine[]) {
  const totalsByFund = new Map<string, ReturnType<typeof buildPostedBalanceTotals>>();

  for (const line of lines) {
    const fundCode = text(line.fund_code);
    if (!fundCode) {
      continue;
    }

    const current = totalsByFund.get(fundCode) ?? {
      credits: 0,
      debits: 0,
      endingBalance: 0
    };
    current.credits += money(line.credits);
    current.debits += money(line.debits);
    current.endingBalance += money(line.ending_balance);
    totalsByFund.set(fundCode, current);
  }

  return totalsByFund;
}

function hasMeaningfulDebitCreditActivity(totals: { credits: number; debits: number }) {
  return Math.abs(totals.debits) > BALANCE_TOLERANCE || Math.abs(totals.credits) > BALANCE_TOLERANCE;
}

function amountsTie(left: number, right: number) {
  return Math.abs(left - right) <= BALANCE_TOLERANCE;
}

function buildExceptionRow({
  calculationRunId,
  category,
  currentAmount,
  dimensions,
  importBatchIds,
  message,
  organizationId,
  period,
  recommendedAction,
  request,
  segmentCode,
  segmentType,
  severity,
  type,
  varianceAmount,
  variancePercent
}: {
  calculationRunId: string;
  category: string;
  currentAmount?: number;
  dimensions?: {
    account_type?: string | null;
    acfr_code?: string | null;
    department_code?: string | null;
    function_code?: string | null;
    fund_code?: string | null;
    object_code?: string | null;
    reporting_model?: string | null;
  };
  importBatchIds: string[];
  message: string;
  organizationId: string;
  period: number;
  recommendedAction: string;
  request: RunCalculationRequest;
  segmentCode?: string;
  segmentType?: string;
  severity: "Info" | "Warning" | "High" | "Critical";
  type: string;
  varianceAmount?: number;
  variancePercent?: number | null;
}) {
  const legacySeverity =
    severity === "Critical" ? "critical" : severity === "Info" ? "info" : "warning";

  return {
    calculation_run_id: calculationRunId,
    current_amount: currentAmount ?? null,
    dollar_impact: currentAmount ?? varianceAmount ?? null,
    exception_category: category,
    exception_key: segmentCode ?? null,
    exception_scope: segmentType ?? category,
    exception_status: "open",
    exception_type: type,
    fiscal_year: request.fiscalYear,
    account_type: dimensions?.account_type ?? null,
    acfr_code: dimensions?.acfr_code ?? null,
    department_code: dimensions?.department_code ?? null,
    function_code: dimensions?.function_code ?? null,
    fund_code: dimensions?.fund_code ?? (segmentType === "fund" ? segmentCode ?? null : null),
    message,
    object_code: dimensions?.object_code ?? null,
    organization_id: organizationId,
    period,
    recommended_review_action: recommendedAction,
    reporting_model: dimensions?.reporting_model ?? null,
    result_payload: {
      recommended_action: recommendedAction
    },
    severity: legacySeverity,
    severity_level: severity,
    trial_balance_import_batch_ids: importBatchIds,
    variance_amount: varianceAmount ?? null,
    variance_percent: variancePercent ?? null
  };
}

async function persistResults({
  adminClient,
  results
}: {
  adminClient: SupabaseClient;
  results: ResultRows;
}) {
  await deleteExistingDashboardFacts(adminClient, results.dashboardFacts);
  await insertIfAny(adminClient, "dashboard_financial_facts", results.dashboardFacts);
  await insertIfAny(adminClient, "mapping_coverage_results", results.mappingCoverage);
  await insertIfAny(adminClient, "financial_summary_results", results.financialSummaries);
  await insertIfAny(adminClient, "statement_summary_results", results.statementSummaries);
  await insertIfAny(adminClient, "variance_results", results.variances);
  await insertIfAny(adminClient, "trend_results", results.trends);
  await insertIfAny(adminClient, "exception_results", results.exceptions);
}

async function deleteExistingDashboardFacts(
  adminClient: SupabaseClient,
  rows: Record<string, unknown>[]
) {
  const sample = rows[0];
  const organizationId = text(sample?.organization_id);
  const calculationRunId = text(sample?.calculation_run_id);
  if (!organizationId || !calculationRunId) return;

  const result = await adminClient
    .from("dashboard_financial_facts")
    .delete()
    .eq("organization_id", organizationId)
    .eq("calculation_run_id", calculationRunId);

  if (result.error) {
    throw new Error(result.error.message);
  }
}

async function insertIfAny(
  adminClient: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[]
) {
  if (rows.length === 0) return;
  const result = await adminClient.from(table).insert(rows);
  if (result.error) {
    throw new Error(result.error.message);
  }
}

async function markComparableRunsSuperseded({
  adminClient,
  calculationRunId,
  request
}: {
  adminClient: SupabaseClient;
  calculationRunId: string;
  request: RunCalculationRequest;
}) {
  const comparableResult = await adminClient
    .from("calculation_runs")
    .select("calculation_run_id, parameters_snapshot, parameters")
    .eq("organization_id", request.organizationId)
    .eq("fiscal_year", request.fiscalYear)
    .eq("period_from", request.periodFrom)
    .eq("period_to", request.periodTo)
    .eq("time_view", request.timeView)
    .neq("calculation_run_id", calculationRunId)
    .eq("is_current", true)
    .in("run_status", ["completed", "completed_with_warnings", "stale"])
    .returns<
      Array<{
        calculation_run_id: string;
        parameters: Record<string, unknown> | null;
        parameters_snapshot: Record<string, unknown> | null;
      }>
    >();

  if (comparableResult.error) {
    throw new Error(comparableResult.error.message);
  }

  const reportingScope = request.reportingScope ?? "standard";
  const comparableIds = (comparableResult.data ?? [])
    .filter((run) => getRunReportingScope(run) === reportingScope)
    .map((run) => run.calculation_run_id);

  if (comparableIds.length === 0) {
    return;
  }

  const updateResult = await adminClient
    .from("calculation_runs")
    .update({
      is_current: false,
      is_stale: true,
      run_status: "superseded",
      superseded_by_calculation_run_id: calculationRunId
    })
    .eq("organization_id", request.organizationId)
    .in("calculation_run_id", comparableIds);

  if (updateResult.error) {
    throw new Error(updateResult.error.message);
  }
}

async function loadSignConventionConfigId({
  adminClient,
  organizationId
}: {
  adminClient: SupabaseClient;
  organizationId: string;
}) {
  const result = await adminClient
    .from("sign_convention_configs")
    .select("sign_convention_config_id")
    .eq("organization_id", organizationId)
    .eq("active_status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ sign_convention_config_id: string }>();

  if (result.error) {
    return null;
  }

  return result.data?.sign_convention_config_id ?? null;
}

function buildDependencyManifest({
  comparison,
  currentLines,
  request,
  signConventionConfigId,
  thresholdConfig
}: {
  comparison: Awaited<ReturnType<typeof loadComparisonLines>>;
  currentLines: ActiveTrialBalanceLine[];
  request: RunCalculationRequest;
  signConventionConfigId: string | null;
  thresholdConfig: ThresholdConfig;
}) {
  return {
    account_structure_id: firstNonEmpty(currentLines.map((line) => line.account_structure_id)),
    calculation_parameters: buildParametersSnapshot(request),
    calculation_version: CALCULATION_VERSION,
    fiscal_year: request.fiscalYear,
    mapping_coverage_status: "Pending",
    period_from: request.periodFrom,
    period_to: request.periodTo,
    posting_run_ids: unique(currentLines.map((line) => line.posting_run_id).filter(Boolean)),
    prior_period_available: comparison.priorPeriod.availability === "available",
    prior_year_available: comparison.priorYear.availability === "available",
    prior_year_partial: comparison.priorYear.availability === "partial",
    selected_filters: {},
    sign_convention_config_id: signConventionConfigId,
    threshold_config_id: thresholdConfig.thresholdConfigId,
    time_view: request.timeView,
    trial_balance_import_batch_ids: unique(currentLines.map((line) => line.import_batch_id)),
    validation_run_ids: unique(currentLines.map((line) => line.validation_run_id).filter(Boolean))
  };
}

function buildParametersSnapshot(request: RunCalculationRequest) {
  return {
    calculation_version: CALCULATION_VERSION,
    fiscal_year: request.fiscalYear,
    period_from: request.periodFrom,
    period_to: request.periodTo,
    reporting_scope: request.reportingScope ?? "standard",
    time_view: request.timeView
  };
}

function getRunReportingScope(run: {
  parameters: Record<string, unknown> | null;
  parameters_snapshot: Record<string, unknown> | null;
}) {
  return (
    text(run.parameters_snapshot?.reporting_scope) ||
    text(run.parameters?.reporting_scope) ||
    "standard"
  );
}

function getMappingCoverageStatus(issues: CoverageIssue[]) {
  if (issues.length === 0) return "Complete";
  if (issues.some((issue) => ["High", "Critical"].includes(issue.severity))) {
    return "Incomplete";
  }
  return "Complete With Warnings";
}

function isBalanceSheetAccountType(accountType: string) {
  return new Set([
    "asset",
    "assets",
    "liability",
    "liabilities",
    "deferred_outflow",
    "deferred_outflows",
    "deferred_inflow",
    "deferred_inflows",
    "fund_balance",
    "net_position"
  ]).has(accountType);
}

function isActivityStatementAccountType(accountType: string) {
  return new Set([
    "revenue",
    "revenues",
    "expenditure",
    "expenditures",
    "expense",
    "expenses",
    "other_financing_source",
    "other_financing_sources",
    "other_financing_use",
    "other_financing_uses",
    "transfer_in",
    "transfers_in",
    "transfer_out",
    "transfers_out"
  ]).has(accountType);
}

function getStatementCategory(line: EnrichedLine) {
  const category =
    normalizeClassification(line.activity_statement_line) ||
    normalizeClassification(line.balance_sheet_line) ||
    normalizeClassification(line.account_type);

  if (category.includes("cash")) return "cash_and_investments";
  if (category.includes("current_asset")) return "current_assets";
  if (category.includes("current_liabil")) return "current_liabilities";
  if (category.includes("liabil")) return "liabilities";
  if (category.includes("asset")) return "assets";
  if (category.includes("fund_balance")) return "fund_balance";
  if (category.includes("net_position")) return "net_position";
  if (category.includes("revenue")) return "revenues";
  if (category.includes("expenditure")) return "expenditures";
  if (category.includes("expense")) return "expenses";
  if (category.includes("source")) return "other_financing_sources";
  if (category.includes("use")) return "other_financing_uses";
  return "unclassified";
}

function getStatementType(reportingModel: string) {
  if (reportingModel === "proprietary") return "proprietary_statement";
  if (reportingModel === "fiduciary") return "fiduciary_summary";
  if (reportingModel === "component_unit") return "component_unit_summary";
  return "governmental_statement";
}

function isCashLine(line: EnrichedLine) {
  return [line.balance_sheet_line, line.account_type]
    .map(normalizeClassification)
    .some((value) => value.includes("cash"));
}

function groupLinesByCode(
  lines: ActiveTrialBalanceLine[],
  field: keyof ActiveTrialBalanceLine
) {
  const groups = new Map<string, ActiveTrialBalanceLine[]>();
  for (const line of lines) {
    const key = text(line[field]);
    groups.set(key, [...(groups.get(key) ?? []), line]);
  }
  return groups;
}

function groupEnrichedLines<T extends keyof EnrichedLine>(
  lines: EnrichedLine[],
  field: T
) {
  const groups = new Map<string, EnrichedLine[]>();
  for (const line of lines) {
    const key = String(line[field] ?? "");
    groups.set(key, [...(groups.get(key) ?? []), line]);
  }
  return groups;
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function firstNonEmpty<T>(values: Array<T | null | undefined>) {
  return values.find((value) => value !== null && value !== undefined) ?? null;
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function sumPeriodAmount(
  lines: EnrichedLine[],
  period: number,
  field: "beginning_balance" | "ending_balance"
) {
  return sum(lines.filter((line) => line.period === period).map((line) => money(line[field])));
}

function money(value: number | string | null | undefined) {
  const numeric = typeof value === "number" ? value : Number.parseFloat(value ?? "0");
  return Number.isNaN(numeric) ? 0 : numeric;
}

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function textOrNull(value: unknown) {
  const normalized = text(value);
  return normalized || null;
}

function booleanValue(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "yes", "1"].includes(normalized)) return true;
    if (["false", "no", "0"].includes(normalized)) return false;
  }

  return fallback;
}

function titleize(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

async function writeAuditLog({
  actionType,
  adminClient,
  calculationRunId,
  organizationId,
  payload,
  userId
}: {
  actionType: string;
  adminClient: SupabaseClient;
  calculationRunId: string;
  organizationId: string;
  payload: Record<string, unknown>;
  userId: string;
}) {
  await adminClient.from("audit_logs").insert({
    action_type: actionType,
    actor_user_id: userId,
    after_payload: payload,
    entity_id: calculationRunId,
    entity_table: "calculation_runs",
    metadata: {
      calculation_version: CALCULATION_VERSION,
      slice: "9"
    },
    organization_id: organizationId
  });
}
