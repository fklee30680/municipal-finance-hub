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
  calculation_run_id?: string;
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
  fund_code: string | null;
  acfr_code: string | null;
  department_code: string | null;
  function_code: string | null;
  object_code: string | null;
  account_type: string | null;
  reporting_model: string | null;
};

export type ExceptionRow = {
  exception_result_id: string;
  exception_category: string | null;
  exception_key: string | null;
  exception_scope: string | null;
  exception_type: string | null;
  severity_level: string | null;
  message: string | null;
  recommended_review_action: string | null;
  comparison_amount: number | string | null;
  current_amount: number | string | null;
  variance_amount: number | string | null;
  variance_percent: number | string | null;
  fund_code: string | null;
  full_account_number: string | null;
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

export type DashboardFinancialFactRow = {
  dashboard_financial_fact_id: string;
  summary_type: string;
  summary_key: string;
  summary_label: string | null;
  beginning_balance: number | string | null;
  debits: number | string | null;
  credits: number | string | null;
  net_change: number | string | null;
  ending_balance: number | string | null;
  presentation_amount: number | string | null;
  row_count: number;
  fund_code: string | null;
  fund_group: string | null;
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
  dashboardFactCounts: DashboardFactCounts;
  dashboardFacts: DashboardFinancialFactRow[];
  dashboardRawFacts: DashboardFinancialFactRow[];
  exceptions: ExceptionRow[];
  filterNotes: string[];
  financialSummaries: FinancialSummaryRow[];
  mappingCoverage: MappingCoverageRow[];
  statementSummaries: StatementSummaryRow[];
  trends: TrendRow[];
  variances: VarianceRow[];
};

export type DashboardFactCounts = {
  bySummaryType: Record<string, number>;
  filteredTotal: number;
  rawTotal: number;
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
        options,
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
  const timeView = "selected_range";
  const periodFrom = integer(searchParams.periodFrom) ?? periodTo;

  return {
    acfr: searchParams.acfr ?? "",
    accountType: searchParams.accountType ?? "",
    department: searchParams.department ?? "",
    exceptionSeverity: "",
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
    statementLine: "",
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
  options,
  selection
}: {
  adminClient: SupabaseClient;
  calculationRunId: string;
  organizationId: string;
  options: DashboardOptions;
  selection: DashboardSelection;
}): Promise<DashboardOutput> {
  const [
    dashboardFacts,
    financialSummaries,
    statementSummaries,
    variances,
    trends,
    exceptions,
    mappingCoverage
  ] = await Promise.all([
    loadDashboardFacts({
      adminClient,
      calculationRunId,
      organizationId
    }),
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
      .select("trend_result_id, trend_type, trend_scope, trend_key, period, amount_type, amount_value, presentation_amount, fund_code, acfr_code, department_code, function_code, object_code, account_type, reporting_model")
      .eq("organization_id", organizationId)
      .eq("calculation_run_id", calculationRunId)
      .order("period", { ascending: true })
      .limit(500)
      .returns<TrendRow[]>(),
    loadExceptionRows({
      adminClient,
      calculationRunId,
      organizationId
    }),
    adminClient
      .from("mapping_coverage_results")
      .select("mapping_coverage_result_id, segment_type, segment_code, segment_name, reference_table, reference_status, coverage_issue_type, severity, affected_row_count, affected_amount, message, recommended_action")
      .eq("organization_id", organizationId)
      .eq("calculation_run_id", calculationRunId)
      .limit(500)
      .returns<MappingCoverageRow[]>()
  ]);

  const facts = dashboardFacts;
  const rawOutput: DashboardOutput = {
    dashboardFactCounts: buildDashboardFactCounts({
      filteredFacts: facts,
      rawFacts: facts
    }),
    dashboardFacts: facts,
    dashboardRawFacts: facts,
    exceptions,
    filterNotes: [],
    financialSummaries: [],
    mappingCoverage: mappingCoverage.data ?? [],
    statementSummaries: [],
    trends: trends.data ?? [],
    variances: variances.data ?? []
  };
  const filteredOutput = applyDashboardSelectionFilters(rawOutput, selection, options);

  if (facts.length > 0) {
    const filteredFacts = filterDashboardFacts(facts, selection);
    const factFilterNotes =
      filteredFacts.length === 0 && hasDimensionSelection(selection)
        ? [
            "No dashboard financial facts matched the selected reference filters for this calculation run. Rerun calculation if this selection should have posted activity."
          ]
        : [];

    return {
      ...filteredOutput,
      dashboardFactCounts: buildDashboardFactCounts({
        filteredFacts,
        rawFacts: facts
      }),
      dashboardFacts: filteredFacts,
      dashboardRawFacts: facts,
      filterNotes: uniqueText([
        ...filteredOutput.filterNotes.filter(
          (note) => !note.startsWith("Statement summary rows can only be filtered")
        ),
        ...factFilterNotes
      ]),
      financialSummaries: buildFinancialSummariesFromFacts({
        calculationRunId,
        facts: filteredFacts
      }),
      statementSummaries: buildStatementSummariesFromFacts({
        facts: filteredFacts
      })
    };
  }

  const legacyOutput = applyDashboardSelectionFilters(
    {
      dashboardFacts: [],
      dashboardRawFacts: [],
      dashboardFactCounts: buildDashboardFactCounts({
        filteredFacts: [],
        rawFacts: []
      }),
      exceptions,
      filterNotes: [
        "This calculation run does not include dashboard financial facts. Rerun calculation after applying the dashboard-ready output migration to make dashboard filters fully effective."
      ],
      financialSummaries: financialSummaries.data ?? [],
      mappingCoverage: mappingCoverage.data ?? [],
      statementSummaries: statementSummaries.data ?? [],
      trends: trends.data ?? [],
      variances: variances.data ?? []
    },
    selection,
    options
  );

  return legacyOutput;
}

function filterDashboardFacts(
  facts: DashboardFinancialFactRow[],
  selection: DashboardSelection
) {
  return facts
    .filter((fact) => fact.summary_type === "dashboard_detail")
    .filter((fact) => {
      if (selection.fund && fact.fund_code !== selection.fund) return false;
      if (selection.fundGroup && fact.fund_group !== selection.fundGroup) return false;
      if (selection.department && fact.department_code !== selection.department) return false;
      if (selection.functionCode && fact.function_code !== selection.functionCode) return false;
      if (selection.acfr && fact.acfr_code !== selection.acfr) return false;
      if (selection.accountType && fact.account_type !== selection.accountType) return false;
      return true;
    });
}

async function loadDashboardFacts({
  adminClient,
  calculationRunId,
  organizationId
}: {
  adminClient: SupabaseClient;
  calculationRunId: string;
  organizationId: string;
}) {
  const pageSize = 1000;
  const rows: DashboardFinancialFactRow[] = [];

  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const result = await adminClient
      .from("dashboard_financial_facts")
      .select("dashboard_financial_fact_id, summary_type, summary_key, summary_label, beginning_balance, debits, credits, net_change, ending_balance, presentation_amount, row_count, fund_code, fund_group, acfr_code, department_code, function_code, object_code, account_type, balance_sheet_line, activity_statement_line, reporting_model, result_payload")
      .eq("organization_id", organizationId)
      .eq("calculation_run_id", calculationRunId)
      .order("summary_type", { ascending: true })
      .order("summary_key", { ascending: true })
      .range(from, to)
      .returns<DashboardFinancialFactRow[]>();

    if (result.error) {
      throw new Error(
        `Dashboard financial facts could not be loaded. Apply the dashboard_financial_facts migration before testing dashboard filters. ${result.error.message}`
      );
    }

    rows.push(...(result.data ?? []));

    if ((result.data ?? []).length < pageSize) {
      return rows;
    }
  }
}

async function loadExceptionRows({
  adminClient,
  calculationRunId,
  organizationId
}: {
  adminClient: SupabaseClient;
  calculationRunId: string;
  organizationId: string;
}) {
  const pageSize = 1000;
  const rows: ExceptionRow[] = [];

  for (let from = 0; ; from += pageSize) {
    const result = await adminClient
      .from("exception_results")
      .select("exception_result_id, exception_category, exception_key, exception_scope, exception_type, severity_level, message, recommended_review_action, comparison_amount, current_amount, variance_amount, variance_percent, fund_code, full_account_number, acfr_code, department_code, function_code, object_code, account_type")
      .eq("organization_id", organizationId)
      .eq("calculation_run_id", calculationRunId)
      .order("created_at", { ascending: false })
      .order("exception_result_id", { ascending: true })
      .range(from, from + pageSize - 1)
      .returns<ExceptionRow[]>();

    if (result.error) {
      throw new Error(`Dashboard exceptions could not be loaded. ${result.error.message}`);
    }

    rows.push(...(result.data ?? []));

    if ((result.data ?? []).length < pageSize) {
      return rows;
    }
  }
}

function buildDashboardFactCounts({
  filteredFacts,
  rawFacts
}: {
  filteredFacts: DashboardFinancialFactRow[];
  rawFacts: DashboardFinancialFactRow[];
}): DashboardFactCounts {
  return {
    bySummaryType: rawFacts.reduce<Record<string, number>>((counts, fact) => {
      counts[fact.summary_type] = (counts[fact.summary_type] ?? 0) + 1;
      return counts;
    }, {}),
    filteredTotal: filteredFacts.length,
    rawTotal: rawFacts.length
  };
}

function buildFinancialSummariesFromFacts({
  calculationRunId,
  facts
}: {
  calculationRunId: string;
  facts: DashboardFinancialFactRow[];
}): FinancialSummaryRow[] {
  if (facts.length === 0) return [];

  const rows: FinancialSummaryRow[] = [
    buildFinancialRowFromFacts({
      calculationRunId,
      facts,
      key: "all",
      type: "all"
    })
  ];

  for (const type of [
    "fund",
    "department",
    "function",
    "acfr",
    "object",
    "account_type",
    "balance_sheet_line",
    "activity_statement_line",
    "reporting_model"
  ]) {
    for (const [key, groupedFacts] of groupFactsBySummaryType(facts, type)) {
      rows.push(
        buildFinancialRowFromFacts({
          calculationRunId,
          facts: groupedFacts,
          key,
          type
        })
      );
    }
  }

  return rows;
}

function buildFinancialRowFromFacts({
  calculationRunId,
  facts,
  key,
  type
}: {
  calculationRunId: string;
  facts: DashboardFinancialFactRow[];
  key: string;
  type: string;
}): FinancialSummaryRow {
  const sample = facts[0];

  return {
    account_type: type === "account_type" ? key : sample?.account_type ?? null,
    acfr_code: type === "acfr" ? key : sample?.acfr_code ?? null,
    activity_statement_line:
      type === "activity_statement_line" ? key : sample?.activity_statement_line ?? null,
    amount_type: "dashboard_filtered_activity",
    amount_value: sumAmounts(facts, "net_change"),
    balance_sheet_line: type === "balance_sheet_line" ? key : sample?.balance_sheet_line ?? null,
    beginning_balance: sumAmounts(facts, "beginning_balance"),
    calculation_run_id: calculationRunId,
    department_code: type === "department" ? key : sample?.department_code ?? null,
    ending_balance: sumAmounts(facts, "ending_balance"),
    financial_summary_result_id: `dashboard:${calculationRunId}:${type}:${key}`,
    function_code: type === "function" ? key : sample?.function_code ?? null,
    fund_code: type === "fund" ? key : sample?.fund_code ?? null,
    net_change: sumAmounts(facts, "net_change"),
    object_code: type === "object" ? key : sample?.object_code ?? null,
    presentation_amount: sumAmounts(facts, "presentation_amount"),
    reporting_model: type === "reporting_model" ? key : sample?.reporting_model ?? null,
    result_payload: {
      dashboard_fact_count: facts.length,
      dimension_field: getDimensionFieldForSummaryType(type),
      generated_from_dashboard_facts: true
    },
    summary_key: key,
    summary_scope: type,
    summary_type: type
  };
}

function buildStatementSummariesFromFacts({
  facts
}: {
  facts: DashboardFinancialFactRow[];
}): StatementSummaryRow[] {
  const activityRows = [...groupFactsBySummaryType(facts, "activity_statement_line").entries()]
    .map(([key, groupedFacts], index) =>
      buildStatementRowFromFacts({
        amountField: "presentation_amount",
        groupedFacts,
        index,
        key,
        statementType: "activity_statement"
      })
    );
  const balanceRows = [...groupFactsBySummaryType(facts, "balance_sheet_line").entries()]
    .map(([key, groupedFacts], index) =>
      buildStatementRowFromFacts({
        amountField: "ending_balance",
        groupedFacts,
        index: activityRows.length + index,
        key,
        statementType: "balance_sheet"
      })
    );

  return [...activityRows, ...balanceRows];
}

function buildStatementRowFromFacts({
  amountField,
  groupedFacts,
  index,
  key,
  statementType
}: {
  amountField: "ending_balance" | "presentation_amount";
  groupedFacts: DashboardFinancialFactRow[];
  index: number;
  key: string;
  statementType: string;
}): StatementSummaryRow {
  return {
    amount_value: sumAmounts(groupedFacts, amountField),
    line_item_code: key,
    line_item_name: titleize(key),
    line_name: titleize(key),
    presentation_amount: sumAmounts(groupedFacts, amountField),
    reporting_model: groupedFacts[0]?.reporting_model ?? null,
    sort_order: index + 1,
    statement_summary_result_id: `dashboard:${statementType}:${key}`,
    statement_type: statementType
  };
}

function groupFactsBySummaryType(
  facts: DashboardFinancialFactRow[],
  type: string
) {
  const groups = new Map<string, DashboardFinancialFactRow[]>();
  for (const fact of facts) {
    const key = getFactSummaryValue(fact, type);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), fact]);
  }
  return groups;
}

function getFactSummaryValue(fact: DashboardFinancialFactRow, type: string) {
  if (type === "fund") return fact.fund_code ?? "";
  if (type === "department") return fact.department_code ?? "";
  if (type === "function") return fact.function_code ?? "";
  if (type === "acfr") return fact.acfr_code ?? "";
  if (type === "object") return fact.object_code ?? "";
  if (type === "account_type") return fact.account_type ?? "";
  if (type === "balance_sheet_line") return fact.balance_sheet_line ?? "";
  if (type === "activity_statement_line") return fact.activity_statement_line ?? "";
  if (type === "reporting_model") return fact.reporting_model ?? "";
  return "";
}

function getDimensionFieldForSummaryType(type: string) {
  const fields: Record<string, string | null> = {
    account_type: "account_type",
    acfr: "acfr_code",
    activity_statement_line: "activity_statement_line",
    balance_sheet_line: "balance_sheet_line",
    department: "department_code",
    function: "function_code",
    fund: "fund_code",
    object: "object_code",
    reporting_model: "reporting_model"
  };
  return fields[type] ?? null;
}

function sumAmounts<T extends Record<string, unknown>>(rows: T[], field: keyof T) {
  return rows.reduce((total, row) => total + amount(row[field] as number | string | null), 0);
}

function emptyOutput(): DashboardOutput {
  return {
    dashboardFactCounts: buildDashboardFactCounts({
      filteredFacts: [],
      rawFacts: []
    }),
    dashboardFacts: [],
    dashboardRawFacts: [],
    exceptions: [],
    filterNotes: [],
    financialSummaries: [],
    mappingCoverage: [],
    statementSummaries: [],
    trends: [],
    variances: []
  };
}

function applyDashboardSelectionFilters(
  output: DashboardOutput,
  selection: DashboardSelection,
  options: DashboardOptions
): DashboardOutput {
  const filterContext = buildFilterContext(selection, options);
  const filterNotes: string[] = [];
  const financialSummaries = filterFinancialRows(
    output.financialSummaries,
    selection,
    filterContext
  );
  const statementSummaries = filterStatementRows(
    output.statementSummaries,
    selection,
    filterNotes
  );
  const variances = filterVarianceRows(
    output.variances,
    selection,
    filterContext,
    filterNotes
  );
  const trends = filterTrendRows(
    output.trends,
    selection,
    filterContext,
    filterNotes
  );
  const exceptions = filterExceptionRows(
    output.exceptions,
    selection,
    filterContext,
    filterNotes
  );
  const mappingCoverage = filterMappingRows(
    output.mappingCoverage,
    selection,
    filterContext,
    filterNotes
  );

  return {
    dashboardFactCounts: output.dashboardFactCounts,
    dashboardFacts: output.dashboardFacts,
    dashboardRawFacts: output.dashboardRawFacts,
    exceptions,
    filterNotes: uniqueText(filterNotes),
    financialSummaries,
    mappingCoverage,
    statementSummaries,
    trends,
    variances
  };
}

function buildFilterContext(selection: DashboardSelection, options: DashboardOptions) {
  const fundCodesForReportingScope = new Set(
    options.funds
      .filter((fund) => fundIsInReportingScope(fund, selection.reportingScope))
      .map((fund) => fund.fund_code)
  );
  return {
    fundCodesForReportingScope,
    fundCodesForGroup: new Set(
      selection.fundGroup
        ? options.funds
            .filter(
              (fund) =>
                fund.fund_group === selection.fundGroup &&
                fundCodesForReportingScope.has(fund.fund_code)
            )
            .map((fund) => fund.fund_code)
        : []
    )
  };
}

function filterFinancialRows(
  rows: FinancialSummaryRow[],
  selection: DashboardSelection,
  filterContext: ReturnType<typeof buildFilterContext>
) {
  return rows
    .filter((row) => {
      if (!financialRowIsInReportingScope(row, filterContext)) {
        return false;
      }

      if (selection.fund && !financialRowMatchesDimension(row, "fund", selection.fund)) {
        return false;
      }

      if (
        selection.fundGroup &&
        !financialRowMatchesAnyDimension(row, "fund", filterContext.fundCodesForGroup)
      ) {
        return false;
      }

      if (
        selection.department &&
        !financialRowMatchesDimension(row, "department", selection.department)
      ) {
        return false;
      }

      if (
        selection.functionCode &&
        !financialRowMatchesDimension(row, "function", selection.functionCode)
      ) {
        return false;
      }

      if (selection.acfr && !financialRowMatchesDimension(row, "acfr", selection.acfr)) {
        return false;
      }

      if (
        selection.accountType &&
        !financialRowMatchesDimension(row, "account_type", selection.accountType)
      ) {
        return false;
      }

      if (
        selection.statementLine &&
        !financialRowMatchesDimension(row, "balance_sheet_line", selection.statementLine) &&
        !financialRowMatchesDimension(row, "activity_statement_line", selection.statementLine)
      ) {
        return false;
      }

      return true;
    })
    .map((row) => ({ ...row }));
}

function filterStatementRows(
  rows: StatementSummaryRow[],
  selection: DashboardSelection,
  filterNotes: string[]
) {
  if (hasDimensionSelection(selection)) {
    filterNotes.push(
      "Statement summary rows can only be filtered by Statement Line because this calculation output does not include fund, department, function, ACFR, or account-type detail."
    );
  }

  return rows
    .filter((row) => {
      if (!selection.statementLine) return true;
      return (
        row.line_item_code === selection.statementLine ||
        row.line_item_name === selection.statementLine ||
        row.line_name === selection.statementLine
      );
    })
    .map((row) => ({ ...row }));
}

function filterVarianceRows(
  rows: VarianceRow[],
  selection: DashboardSelection,
  filterContext: ReturnType<typeof buildFilterContext>,
  filterNotes: string[]
) {
  const filtered = filterDimensionRows({
    filterContext,
    filterNotes,
    label: "Variance",
    rows,
    selection
  });

  return filtered
    .sort((a, b) => {
      if (selection.sort === "largest_percent") {
        return Math.abs(amount(b.variance_percent)) - Math.abs(amount(a.variance_percent));
      }
      return amount(b.absolute_variance_amount) - amount(a.absolute_variance_amount);
    })
    .slice(0, selection.topN);
}

function filterTrendRows(
  rows: TrendRow[],
  selection: DashboardSelection,
  filterContext: ReturnType<typeof buildFilterContext>,
  filterNotes: string[]
) {
  const filtered = filterDimensionRows({
    filterContext,
    filterNotes,
    label: "Trend",
    rows,
    selection
  });

  return filtered
    .sort(
      (a, b) =>
        Math.abs(amount(b.presentation_amount ?? b.amount_value)) -
        Math.abs(amount(a.presentation_amount ?? a.amount_value))
    )
    .slice(0, selection.topN);
}

function filterExceptionRows(
  rows: ExceptionRow[],
  selection: DashboardSelection,
  filterContext: ReturnType<typeof buildFilterContext>,
  filterNotes: string[]
) {
  return filterDimensionRows({
    filterContext,
    filterNotes,
    keepGlobalRows: true,
    label: "Exception",
    rows,
    selection
  }).filter((row) => {
    if (selection.exceptionSeverity && row.severity_level !== selection.exceptionSeverity) {
      return false;
    }
    return true;
  });
}

function filterMappingRows(
  rows: MappingCoverageRow[],
  selection: DashboardSelection,
  filterContext: ReturnType<typeof buildFilterContext>,
  filterNotes: string[]
) {
  return rows.filter((row) => {
    if (
      row.segment_type === "fund" &&
      row.segment_code &&
      !filterContext.fundCodesForReportingScope.has(row.segment_code)
    ) {
      return false;
    }

    if (selection.exceptionSeverity && row.severity !== selection.exceptionSeverity) {
      return false;
    }

    if (selection.fund) {
      if (row.segment_type === "fund") return row.segment_code === selection.fund;
      if (isHighPriorityMappingIssue(row)) {
        filterNotes.push(
          "Global or non-fund mapping coverage issues remain visible because they may still affect the selected fund."
        );
        return true;
      }
      return false;
    }

    if (selection.fundGroup) {
      if (row.segment_type === "fund") {
        return Boolean(row.segment_code && filterContext.fundCodesForGroup.has(row.segment_code));
      }
      if (isHighPriorityMappingIssue(row)) {
        filterNotes.push(
          "Global or non-fund mapping coverage issues remain visible because they may still affect the selected fund group."
        );
        return true;
      }
      return false;
    }

    if (selection.department && row.segment_type === "department") {
      return row.segment_code === selection.department;
    }

    if (selection.department) {
      if (isHighPriorityMappingIssue(row)) {
        filterNotes.push(
          "Global or non-department mapping coverage issues remain visible because they may still affect the selected department."
        );
        return true;
      }
      return false;
    }

    if (selection.functionCode && row.segment_type === "function") {
      return row.segment_code === selection.functionCode;
    }

    if (selection.functionCode) {
      if (isHighPriorityMappingIssue(row)) {
        filterNotes.push(
          "Global or non-function mapping coverage issues remain visible because they may still affect the selected function."
        );
        return true;
      }
      return false;
    }

    if (selection.acfr && row.segment_type === "acfr") {
      return row.segment_code === selection.acfr;
    }

    if (selection.acfr) {
      if (isHighPriorityMappingIssue(row)) {
        filterNotes.push(
          "Global or non-ACFR mapping coverage issues remain visible because they may still affect the selected ACFR filter."
        );
        return true;
      }
      return false;
    }

    if (selection.accountType || selection.statementLine) {
      filterNotes.push(
        "Mapping coverage rows cannot be filtered by Account Type or Statement Line because mapping coverage is stored by reference segment."
      );
    }

    return true;
  });
}

function filterDimensionRows<
  T extends {
    acfr_code: string | null;
    account_type: string | null;
    department_code: string | null;
    function_code: string | null;
    fund_code: string | null;
  }
>({
  filterContext,
  filterNotes,
  keepGlobalRows = false,
  label,
  rows,
  selection
}: {
  filterContext: ReturnType<typeof buildFilterContext>;
  filterNotes: string[];
  keepGlobalRows?: boolean;
  label: string;
  rows: T[];
  selection: DashboardSelection;
}) {
  const selectedDimensions = getSelectedRowDimensions(selection);

  for (const dimension of selectedDimensions) {
    if (!rows.some((row) => hasRowDimension(row, dimension.field))) {
      filterNotes.push(
        `${label} rows cannot be filtered by ${dimension.label} because this calculation output does not include ${dimension.label.toLowerCase()} detail for those rows.`
      );
    }
  }

  return rows
    .filter((row) => {
      const rowFund = text(row.fund_code);
      if (rowFund && !filterContext.fundCodesForReportingScope.has(rowFund)) {
        return false;
      }

      if (selection.fund && !matchesRowDimension(row, "fund_code", selection.fund, keepGlobalRows)) {
        return false;
      }

      if (
        selection.fundGroup &&
        !matchesAnyRowDimension(
          row,
          "fund_code",
          filterContext.fundCodesForGroup,
          keepGlobalRows
        )
      ) {
        return false;
      }

      if (
        selection.department &&
        !matchesRowDimension(row, "department_code", selection.department, keepGlobalRows)
      ) {
        return false;
      }

      if (
        selection.functionCode &&
        !matchesRowDimension(row, "function_code", selection.functionCode, keepGlobalRows)
      ) {
        return false;
      }

      if (selection.acfr && !matchesRowDimension(row, "acfr_code", selection.acfr, keepGlobalRows)) {
        return false;
      }

      if (
        selection.accountType &&
        !matchesRowDimension(row, "account_type", selection.accountType, keepGlobalRows)
      ) {
        return false;
      }

      return true;
    })
    .map((row) => ({ ...row }));
}

function financialRowMatchesDimension(
  row: FinancialSummaryRow,
  dimension: string,
  value: string
) {
  const dimensionField = getFinancialDimensionField(row);
  if (dimensionField !== getFinancialFieldForDimension(dimension)) return false;
  return getFinancialDimensionValue(row, dimension) === value;
}

function financialRowIsInReportingScope(
  row: FinancialSummaryRow,
  filterContext: ReturnType<typeof buildFilterContext>
) {
  const rowFund = text(row.fund_code);
  return !rowFund || filterContext.fundCodesForReportingScope.has(rowFund);
}

function fundIsInReportingScope(
  fund: DashboardOptions["funds"][number],
  reportingScope: DashboardSelection["reportingScope"]
) {
  if (reportingScope === "standard") {
    return booleanValue(fund.include_in_standard_reporting, true);
  }

  if (text(fund.active_status) === "inactive") {
    return false;
  }

  if (reportingScope === "all_active") {
    return true;
  }

  const treatment = text(fund.reporting_treatment);
  return (
    booleanValue(fund.include_in_standard_reporting, true) ||
    booleanValue(fund.include_in_cash_reconciliation, false) ||
    treatment === "pooled_cash" ||
    treatment === "reconciliation_only"
  );
}

function financialRowMatchesAnyDimension(
  row: FinancialSummaryRow,
  dimension: string,
  values: Set<string>
) {
  const dimensionField = getFinancialDimensionField(row);
  const value = getFinancialDimensionValue(row, dimension);
  return dimensionField === getFinancialFieldForDimension(dimension) &&
    Boolean(value && values.has(value));
}

function getFinancialDimensionField(row: FinancialSummaryRow) {
  const dimensionField = row.result_payload?.dimension_field;
  return typeof dimensionField === "string" ? dimensionField : null;
}

function getFinancialFieldForDimension(dimension: string) {
  const fields: Record<string, string> = {
    account_type: "account_type",
    acfr: "acfr_code",
    activity_statement_line: "activity_statement_line",
    balance_sheet_line: "balance_sheet_line",
    department: "department_code",
    fund: "fund_code",
    function: "function_code"
  };
  return fields[dimension] ?? dimension;
}

function getFinancialDimensionValue(row: FinancialSummaryRow, dimension: string) {
  if (dimension === "fund") return row.fund_code ?? row.summary_key;
  if (dimension === "department") return row.department_code ?? row.summary_key;
  if (dimension === "function") return row.function_code ?? row.summary_key;
  if (dimension === "acfr") return row.acfr_code ?? row.summary_key;
  if (dimension === "account_type") return row.account_type ?? row.summary_key;
  if (dimension === "balance_sheet_line") return row.balance_sheet_line ?? row.summary_key;
  if (dimension === "activity_statement_line") return row.activity_statement_line ?? row.summary_key;
  return row.summary_key;
}

function getSelectedRowDimensions(selection: DashboardSelection) {
  return [
    selection.fund ? { field: "fund_code" as const, label: "Fund" } : null,
    selection.fundGroup ? { field: "fund_code" as const, label: "Fund Group" } : null,
    selection.department ? { field: "department_code" as const, label: "Department" } : null,
    selection.functionCode ? { field: "function_code" as const, label: "Function" } : null,
    selection.acfr ? { field: "acfr_code" as const, label: "ACFR" } : null,
    selection.accountType ? { field: "account_type" as const, label: "Account Type" } : null
  ].filter((dimension): dimension is NonNullable<typeof dimension> => Boolean(dimension));
}

function hasDimensionSelection(selection: DashboardSelection) {
  return Boolean(
    selection.fund ||
      selection.fundGroup ||
      selection.department ||
      selection.functionCode ||
      selection.acfr ||
      selection.accountType
  );
}

function hasRowDimension<T extends Record<string, unknown>>(
  row: T,
  field: keyof T
) {
  return Boolean(text(row[field]));
}

function matchesRowDimension<T extends Record<string, unknown>>(
  row: T,
  field: keyof T,
  value: string,
  keepGlobalRows: boolean
) {
  const rowValue = text(row[field]);
  if (!rowValue) return keepGlobalRows;
  return rowValue === value;
}

function matchesAnyRowDimension<T extends Record<string, unknown>>(
  row: T,
  field: keyof T,
  values: Set<string>,
  keepGlobalRows: boolean
) {
  const rowValue = text(row[field]);
  if (!rowValue) return keepGlobalRows;
  return values.has(rowValue);
}

function isHighPriorityMappingIssue(row: MappingCoverageRow) {
  return row.severity === "Critical" || row.severity === "High";
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

function booleanValue(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "t", "yes", "y", "1"].includes(normalized)) return true;
    if (["false", "f", "no", "n", "0"].includes(normalized)) return false;
  }
  return fallback;
}

function uniqueText(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))
  ).sort((a, b) => a.localeCompare(b));
}

function titleize(value: string) {
  return value
    .replaceAll("_", " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
