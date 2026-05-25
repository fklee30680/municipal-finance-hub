import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type DashboardView =
  | "cfo_overview"
  | "exceptions"
  | "financial_statements"
  | "funds"
  | "variances";

export type DashboardSearchParams = {
  acfr?: string;
  accountType?: string;
  department?: string;
  exceptionSeverity?: string;
  fiscalYear?: string;
  fund?: string;
  fundGroup?: string;
  functionCode?: string;
  periodFrom?: string;
  periodTo?: string;
  reportingScope?: string;
  sort?: string;
  statementLine?: string;
  timeView?: string;
  topN?: string;
};

export type DashboardSelection = {
  acfr: string;
  accountType: string;
  department: string;
  exceptionSeverity: string;
  fiscalYear: number;
  fund: string;
  fundGroup: string;
  functionCode: string;
  periodFrom: number;
  periodTo: number;
  reportingScope: "all_active" | "cash_reconciliation" | "standard";
  sort: string;
  statementLine: string;
  timeView: "current_period" | "selected_range" | "ytd";
  topN: number;
};

export type CalculationRun = {
  calculation_run_id: string;
  calculation_version: string | null;
  completed_at: string | null;
  dependency_manifest: Record<string, unknown> | null;
  error_message: string | null;
  fiscal_year: number | null;
  is_current: boolean;
  is_stale: boolean;
  mapping_coverage_status: string | null;
  parameters: Record<string, unknown> | null;
  parameters_snapshot: Record<string, unknown> | null;
  period: number | null;
  period_from: number | null;
  period_to: number | null;
  posting_run_ids: string[] | null;
  run_status: string;
  source_import_batch_ids: string[] | null;
  time_view: string | null;
  triggered_at: string | null;
  validation_run_ids: string[] | null;
};

export type FinancialSummaryRow = {
  financial_summary_result_id: string;
  summary_type: string | null;
  summary_scope: string;
  summary_key: string;
  amount_type: string | null;
  amount_value: number | string | null;
  presentation_amount: number | string | null;
  beginning_balance: number | string | null;
  ending_balance: number | string | null;
  net_change: number | string | null;
  fund_code: string | null;
  acfr_code: string | null;
  department_code: string | null;
  function_code: string | null;
  object_code: string | null;
  account_type: string | null;
  balance_sheet_line: string | null;
  activity_statement_line: string | null;
  reporting_model: string | null;
  result_payload: Record<string, unknown> | null;
};

export type StatementSummaryRow = {
  statement_summary_result_id: string;
  statement_type: string;
  line_item_code: string | null;
  line_item_name: string | null;
  line_name: string;
  amount_value: number | string | null;
  presentation_amount: number | string | null;
  reporting_model: string | null;
  sort_order: number | null;
};

export type VarianceRow = {
  variance_result_id: string;
  variance_type: string | null;
  variance_scope: string;
  variance_key: string;
  current_amount: number | string | null;
  comparison_amount: number | string | null;
  variance_amount: number | string | null;
  variance_percent: number | string | null;
  absolute_variance_amount: number | string | null;
  severity: string | null;
  fund_code: string | null;
  acfr_code: string | null;
  department_code: string | null;
  function_code: string | null;
  object_code: string | null;
  account_type: string | null;
  reporting_model: string | null;
};

export type TrendRow = {
  trend_result_id: string;
  trend_type: string | null;
  trend_scope: string;
  trend_key: string;
  period: number | null;
  amount_type: string | null;
  amount_value: number | string | null;
  presentation_amount: number | string | null;
  account_type: string | null;
  reporting_model: string | null;
};

export type ExceptionRow = {
  exception_result_id: string;
  exception_category: string | null;
  exception_type: string | null;
  severity_level: string | null;
  message: string | null;
  recommended_review_action: string | null;
  current_amount: number | string | null;
  fund_code: string | null;
  acfr_code: string | null;
  department_code: string | null;
  function_code: string | null;
  object_code: string | null;
  account_type: string | null;
};

export type MappingCoverageRow = {
  mapping_coverage_result_id: string;
  segment_type: string;
  segment_code: string | null;
  segment_name: string | null;
  reference_table: string;
  reference_status: string;
  coverage_issue_type: string;
  severity: string;
  affected_row_count: number;
  affected_amount: number | string;
  message: string;
  recommended_action: string | null;
};

type FiscalPeriodOption = {
  active_status: string;
  close_status: string;
  end_date: string;
  fiscal_year: number;
  period: number;
  period_name: string;
  start_date: string;
};

type FundOption = {
  active_status: string;
  fund_code: string;
  fund_group: string | null;
  fund_name: string;
  include_in_cash_reconciliation: boolean | null;
  include_in_standard_reporting: boolean | null;
  reporting_treatment: string | null;
};

export type DashboardOptions = {
  accountTypes: string[];
  acfr: Array<{ code: string; name: string }>;
  departments: Array<{ code: string; name: string }>;
  fiscalPeriods: FiscalPeriodOption[];
  funds: FundOption[];
  functions: Array<{ code: string; name: string }>;
  statementLines: string[];
};

export type DashboardOutput = {
  exceptions: ExceptionRow[];
  financialSummaries: FinancialSummaryRow[];
  mappingCoverage: MappingCoverageRow[];
  statementSummaries: StatementSummaryRow[];
  trends: TrendRow[];
  variances: VarianceRow[];
};

export async function loadDashboardModel({
  adminClient,
  organizationId,
  searchParams
}: {
  adminClient: SupabaseClient;
  organizationId: string;
  searchParams: DashboardSearchParams;
}) {
  const options = await loadDashboardOptions({ adminClient, organizationId });
  const selection = buildSelection({ options, searchParams });
  const [calculationRun, failedRun] = await Promise.all([
    resolveCalculationRun({ adminClient, organizationId, selection }),
    resolveCalculationRun({
      adminClient,
      organizationId,
      runStatuses: ["failed"],
      selection
    })
  ]);
  const output = calculationRun
    ? await loadDashboardOutput({
        adminClient,
        calculationRunId: calculationRun.calculation_run_id,
        organizationId,
        selection
      })
    : emptyOutput();

  return {
    calculationRun,
    failedRun,
    options,
    output,
    selection
  };
}

export async function loadDashboardOptions({
  adminClient,
  organizationId
}: {
  adminClient: SupabaseClient;
  organizationId: string;
}): Promise<DashboardOptions> {
  const [periods, funds, objects, acfr, departments, functions] = await Promise.all([
    adminClient
      .from("fiscal_periods")
      .select("fiscal_year, period, period_name, start_date, end_date, close_status, active_status")
      .eq("organization_id", organizationId)
      .order("fiscal_year", { ascending: false })
      .order("period", { ascending: false })
      .limit(200)
      .returns<FiscalPeriodOption[]>(),
    adminClient
      .from("funds")
      .select("fund_code, fund_name, fund_group, active_status, include_in_standard_reporting, include_in_cash_reconciliation, reporting_treatment")
      .eq("organization_id", organizationId)
      .order("fund_code", { ascending: true })
      .limit(500)
      .returns<FundOption[]>(),
    adminClient
      .from("objects")
      .select("account_type, balance_sheet_line, activity_statement_line")
      .eq("organization_id", organizationId)
      .order("object_code", { ascending: true })
      .limit(1000)
      .returns<
        Array<{
          account_type: string | null;
          activity_statement_line: string | null;
          balance_sheet_line: string | null;
        }>
      >(),
    adminClient
      .from("acfr_mappings")
      .select("acfr_code, acfr_name")
      .eq("organization_id", organizationId)
      .order("acfr_code", { ascending: true })
      .limit(500)
      .returns<Array<{ acfr_code: string; acfr_name: string }>>(),
    adminClient
      .from("departments")
      .select("department_code, department_name")
      .eq("organization_id", organizationId)
      .order("department_code", { ascending: true })
      .limit(500)
      .returns<Array<{ department_code: string; department_name: string }>>(),
    adminClient
      .from("functions")
      .select("function_code, function_name")
      .eq("organization_id", organizationId)
      .order("function_code", { ascending: true })
      .limit(500)
      .returns<Array<{ function_code: string; function_name: string }>>()
  ]);

  return {
    accountTypes: uniqueText((objects.data ?? []).map((row) => row.account_type)),
    acfr: (acfr.data ?? []).map((row) => ({
      code: row.acfr_code,
      name: row.acfr_name
    })),
    departments: (departments.data ?? []).map((row) => ({
      code: row.department_code,
      name: row.department_name
    })),
    fiscalPeriods: periods.data ?? [],
    funds: funds.data ?? [],
    functions: (functions.data ?? []).map((row) => ({
      code: row.function_code,
      name: row.function_name
    })),
    statementLines: uniqueText(
      (objects.data ?? []).flatMap((row) => [
        row.activity_statement_line,
        row.balance_sheet_line
      ])
    )
  };
}

function buildSelection({
  options,
  searchParams
}: {
  options: DashboardOptions;
  searchParams: DashboardSearchParams;
}): DashboardSelection {
  const defaultPeriod = options.fiscalPeriods[0];
  const fiscalYear =
    integer(searchParams.fiscalYear) ??
    defaultPeriod?.fiscal_year ??
    new Date().getFullYear();
  const periodTo = integer(searchParams.periodTo) ?? defaultPeriod?.period ?? 1;
  const timeView = getAllowed(
    searchParams.timeView,
    ["current_period", "selected_range", "ytd"],
    "current_period"
  );
  const periodFrom =
    integer(searchParams.periodFrom) ??
    (timeView === "ytd" ? 1 : periodTo);

  return {
    acfr: searchParams.acfr ?? "",
    accountType: searchParams.accountType ?? "",
    department: searchParams.department ?? "",
    exceptionSeverity: searchParams.exceptionSeverity ?? "",
    fiscalYear,
    fund: searchParams.fund ?? "",
    fundGroup: searchParams.fundGroup ?? "",
    functionCode: searchParams.functionCode ?? "",
    periodFrom,
    periodTo,
    reportingScope: getAllowed(
      searchParams.reportingScope,
      ["all_active", "cash_reconciliation", "standard"],
      "standard"
    ),
    sort: searchParams.sort ?? "largest_amount",
    statementLine: searchParams.statementLine ?? "",
    timeView,
    topN: Math.min(Math.max(integer(searchParams.topN) ?? 10, 5), 50)
  };
}

async function resolveCalculationRun({
  adminClient,
  organizationId,
  runStatuses = ["completed", "completed_with_warnings"],
  selection
}: {
  adminClient: SupabaseClient;
  organizationId: string;
  runStatuses?: string[];
  selection: DashboardSelection;
}) {
  const result = await adminClient
    .from("calculation_runs")
    .select(
      "calculation_run_id, fiscal_year, period, period_from, period_to, time_view, run_status, is_current, is_stale, calculation_version, source_import_batch_ids, posting_run_ids, validation_run_ids, mapping_coverage_status, dependency_manifest, parameters, parameters_snapshot, error_message, triggered_at, completed_at"
    )
    .eq("organization_id", organizationId)
    .eq("fiscal_year", selection.fiscalYear)
    .eq("period_from", selection.periodFrom)
    .eq("period_to", selection.periodTo)
    .eq("time_view", selection.timeView)
    .eq("is_current", true)
    .in("run_status", runStatuses)
    .order("completed_at", { ascending: false, nullsFirst: false })
    .limit(10)
    .returns<CalculationRun[]>();

  if (result.error) {
    throw new Error(result.error.message);
  }

  return (
    (result.data ?? []).find(
      (run) => getRunReportingScope(run) === selection.reportingScope
    ) ?? null
  );
}

async function loadDashboardOutput({
  adminClient,
  calculationRunId,
  organizationId,
  selection
}: {
  adminClient: SupabaseClient;
  calculationRunId: string;
  organizationId: string;
  selection: DashboardSelection;
}): Promise<DashboardOutput> {
  const [
    financialSummaries,
    statementSummaries,
    variances,
    trends,
    exceptions,
    mappingCoverage
  ] = await Promise.all([
    adminClient
      .from("financial_summary_results")
      .select("financial_summary_result_id, summary_type, summary_scope, summary_key, amount_type, amount_value, presentation_amount, beginning_balance, ending_balance, net_change, fund_code, acfr_code, department_code, function_code, object_code, account_type, balance_sheet_line, activity_statement_line, reporting_model, result_payload")
      .eq("organization_id", organizationId)
      .eq("calculation_run_id", calculationRunId)
      .limit(1000)
      .returns<FinancialSummaryRow[]>(),
    adminClient
      .from("statement_summary_results")
      .select("statement_summary_result_id, statement_type, line_item_code, line_item_name, line_name, amount_value, presentation_amount, reporting_model, sort_order")
      .eq("organization_id", organizationId)
      .eq("calculation_run_id", calculationRunId)
      .order("sort_order", { ascending: true })
      .limit(500)
      .returns<StatementSummaryRow[]>(),
    adminClient
      .from("variance_results")
      .select("variance_result_id, variance_type, variance_scope, variance_key, current_amount, comparison_amount, variance_amount, variance_percent, absolute_variance_amount, severity, fund_code, acfr_code, department_code, function_code, object_code, account_type, reporting_model")
      .eq("organization_id", organizationId)
      .eq("calculation_run_id", calculationRunId)
      .limit(1000)
      .returns<VarianceRow[]>(),
    adminClient
      .from("trend_results")
      .select("trend_result_id, trend_type, trend_scope, trend_key, period, amount_type, amount_value, presentation_amount, account_type, reporting_model")
      .eq("organization_id", organizationId)
      .eq("calculation_run_id", calculationRunId)
      .order("period", { ascending: true })
      .limit(500)
      .returns<TrendRow[]>(),
    adminClient
      .from("exception_results")
      .select("exception_result_id, exception_category, exception_type, severity_level, message, recommended_review_action, current_amount, fund_code, acfr_code, department_code, function_code, object_code, account_type")
      .eq("organization_id", organizationId)
      .eq("calculation_run_id", calculationRunId)
      .order("created_at", { ascending: false })
      .limit(500)
      .returns<ExceptionRow[]>(),
    adminClient
      .from("mapping_coverage_results")
      .select("mapping_coverage_result_id, segment_type, segment_code, segment_name, reference_table, reference_status, coverage_issue_type, severity, affected_row_count, affected_amount, message, recommended_action")
      .eq("organization_id", organizationId)
      .eq("calculation_run_id", calculationRunId)
      .limit(500)
      .returns<MappingCoverageRow[]>()
  ]);

  return {
    exceptions: filterExceptionRows(exceptions.data ?? [], selection),
    financialSummaries: filterFinancialRows(financialSummaries.data ?? [], selection),
    mappingCoverage: filterMappingRows(mappingCoverage.data ?? [], selection),
    statementSummaries: filterStatementRows(statementSummaries.data ?? [], selection),
    trends: trends.data ?? [],
    variances: filterVarianceRows(variances.data ?? [], selection)
  };
}

function emptyOutput(): DashboardOutput {
  return {
    exceptions: [],
    financialSummaries: [],
    mappingCoverage: [],
    statementSummaries: [],
    trends: [],
    variances: []
  };
}

function filterFinancialRows(rows: FinancialSummaryRow[], selection: DashboardSelection) {
  return rows.filter((row) => {
    if (selection.fund && row.fund_code !== selection.fund) return false;
    if (selection.department && row.department_code !== selection.department) return false;
    if (selection.functionCode && row.function_code !== selection.functionCode) return false;
    if (selection.acfr && row.acfr_code !== selection.acfr) return false;
    if (selection.accountType && row.account_type !== selection.accountType) return false;
    if (
      selection.statementLine &&
      row.activity_statement_line !== selection.statementLine &&
      row.balance_sheet_line !== selection.statementLine
    ) {
      return false;
    }
    return true;
  });
}

function filterStatementRows(rows: StatementSummaryRow[], selection: DashboardSelection) {
  return rows.filter((row) => {
    if (!selection.statementLine) return true;
    return (
      row.line_item_code === selection.statementLine ||
      row.line_item_name === selection.statementLine ||
      row.line_name === selection.statementLine
    );
  });
}

function filterVarianceRows(rows: VarianceRow[], selection: DashboardSelection) {
  return rows
    .filter((row) => {
      if (selection.fund && row.fund_code !== selection.fund) return false;
      if (selection.department && row.department_code !== selection.department) return false;
      if (selection.functionCode && row.function_code !== selection.functionCode) return false;
      if (selection.acfr && row.acfr_code !== selection.acfr) return false;
      if (selection.accountType && row.account_type !== selection.accountType) return false;
      return true;
    })
    .sort((a, b) => {
      if (selection.sort === "largest_percent") {
        return Math.abs(amount(b.variance_percent)) - Math.abs(amount(a.variance_percent));
      }
      return amount(b.absolute_variance_amount) - amount(a.absolute_variance_amount);
    })
    .slice(0, selection.topN);
}

function filterExceptionRows(rows: ExceptionRow[], selection: DashboardSelection) {
  return rows.filter((row) => {
    if (selection.exceptionSeverity && row.severity_level !== selection.exceptionSeverity) {
      return false;
    }
    if (selection.fund && row.fund_code !== selection.fund) return false;
    if (selection.department && row.department_code !== selection.department) return false;
    if (selection.functionCode && row.function_code !== selection.functionCode) return false;
    if (selection.acfr && row.acfr_code !== selection.acfr) return false;
    if (selection.accountType && row.account_type !== selection.accountType) return false;
    return true;
  });
}

function filterMappingRows(rows: MappingCoverageRow[], selection: DashboardSelection) {
  return rows.filter((row) => {
    if (!selection.exceptionSeverity) return true;
    return row.severity === selection.exceptionSeverity;
  });
}

export function amount(value: number | string | null | undefined) {
  const numeric = typeof value === "number" ? value : Number.parseFloat(value ?? "0");
  return Number.isFinite(numeric) ? numeric : 0;
}

export function formatAmount(value: number | string | null | undefined) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  }).format(amount(value));
}

export function formatPercent(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "Not available";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
    style: "percent"
  }).format(amount(value));
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function getRunReportingScope(run: {
  parameters: Record<string, unknown> | null;
  parameters_snapshot: Record<string, unknown> | null;
}) {
  return (
    text(run.parameters_snapshot?.reporting_scope) ||
    text(run.parameters?.reporting_scope) ||
    "standard"
  );
}

function getAllowed<T extends string>(
  value: string | undefined,
  allowed: T[],
  fallback: T
) {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function integer(value: string | undefined) {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function uniqueText(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))
  ).sort((a, b) => a.localeCompare(b));
}
