"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { type ReactNode, useMemo, useRef, useState } from "react";

import type {
  DashboardFinancialFactRow,
  DashboardOptions,
  DashboardOutput,
  DashboardSelection
} from "@/lib/dashboards/governed-dashboard";

type AmountPair = {
  expenses: number;
  revenues: number;
};

type FunctionNode = AmountPair & {
  code: string;
  label: string;
};

type AccountDetailRow = AmountPair & {
  accountType: string;
  objectCode: string;
  objectName: string;
};

type FundNode = AmountPair & {
  code: string;
  functions: Map<string, FunctionNode>;
  label: string;
};

type DepartmentNode = AmountPair & {
  code: string;
  funds: Map<string, FundNode>;
  label: string;
};

type DepartmentFunctionHierarchy = {
  departments: DepartmentNode[];
  defaultOpenDepartments: Set<string>;
  defaultOpenFunds: Set<string>;
  sourceFactCount: number;
};

export function DepartmentFunctionHierarchyView({
  options,
  output,
  selection
}: {
  options: DashboardOptions;
  output: DashboardOutput;
  selection: DashboardSelection;
}) {
  const hierarchy = useMemo(
    () => buildHierarchy({ options, output, selection }),
    [options, output, selection]
  );
  const objectNames = useMemo(
    () => new Map(options.objects.map((row) => [row.code, row.name])),
    [options.objects]
  );
  const [openDepartments, setOpenDepartments] = useState(
    () => new Set(hierarchy.defaultOpenDepartments)
  );
  const [openFunds, setOpenFunds] = useState(
    () => new Set(hierarchy.defaultOpenFunds)
  );

  if (output.dashboardFactCounts.rawTotal === 0) {
    return (
      <EmptyState>
        Department / Function data is not available because this calculation run
        does not have dashboard-ready facts.
      </EmptyState>
    );
  }

  if (hierarchy.sourceFactCount === 0 && hasReferenceFilter(selection)) {
    return <EmptyState>No department/function facts match the selected filters.</EmptyState>;
  }

  if (hierarchy.sourceFactCount === 0) {
    return (
      <EmptyState>
        Department / Function data is not available for this calculation run.
        Rerun calculation after dashboard facts are enabled.
      </EmptyState>
    );
  }

  if (hierarchy.departments.length === 0) {
    return (
      <EmptyState>
        No department/function revenue or expense facts are available for this
        calculation run.
      </EmptyState>
    );
  }

  function toggleDepartment(code: string) {
    setOpenDepartments((current) => toggleSetValue(current, code));
  }

  function toggleFund(key: string) {
    setOpenFunds((current) => toggleSetValue(current, key));
  }

  return (
    <div className="overflow-hidden rounded-md border border-border">
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(120px,160px)_minmax(120px,160px)] gap-3 border-b border-border bg-muted/30 px-4 py-3 text-sm font-medium text-muted-foreground">
        <div>Department / Fund / Function</div>
        <div className="text-right">Revenues</div>
        <div className="text-right">Expenses</div>
      </div>
      <div className="divide-y divide-border">
        {hierarchy.departments.map((department) => {
          const departmentOpen = openDepartments.has(department.code);
          const departmentId = `department-function-${cleanId(department.code)}`;
          const funds = [...department.funds.values()].sort(sortNodes);

          return (
            <div key={department.code}>
              <HierarchyRow
                ariaControls={departmentId}
                expanded={departmentOpen}
                expenses={department.expenses}
                label={department.label}
                level="department"
                onToggle={() => toggleDepartment(department.code)}
                revenues={department.revenues}
              />
              {departmentOpen ? (
                <div id={departmentId}>
                  {funds.map((fund) => {
                    const fundKey = `${department.code}|${fund.code}`;
                    const fundOpen = openFunds.has(fundKey);
                    const fundId = `department-function-${cleanId(department.code)}-${cleanId(fund.code)}`;
                    const functions = [...fund.functions.values()].sort(sortNodes);

                    return (
                      <div key={fundKey}>
                        <HierarchyRow
                          ariaControls={fundId}
                          expanded={fundOpen}
                          expenses={fund.expenses}
                          label={fund.label}
                          level="fund"
                          onToggle={() => toggleFund(fundKey)}
                          revenues={fund.revenues}
                        />
                        {fundOpen ? (
                          <div id={fundId}>
                            {functions.map((functionNode) => (
                              <HierarchyRow
                                expenses={functionNode.expenses}
                                key={`${fundKey}|${functionNode.code}`}
                                label={functionNode.label}
                                labelContent={
                                  <FunctionAccountDetailDialog
                                    department={department}
                                    facts={output.dashboardFacts}
                                    fund={fund}
                                    functionNode={functionNode}
                                    objectNames={objectNames}
                                  />
                                }
                                level="function"
                                revenues={functionNode.revenues}
                              />
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HierarchyRow({
  ariaControls,
  expanded,
  expenses,
  label,
  labelContent,
  level,
  onToggle,
  revenues
}: {
  ariaControls?: string;
  expanded?: boolean;
  expenses: number;
  label: string;
  labelContent?: ReactNode;
  level: "department" | "fund" | "function";
  onToggle?: () => void;
  revenues: number;
}) {
  const isExpandable = Boolean(onToggle);
  const rowClass =
    level === "department"
      ? "bg-card text-foreground"
      : level === "fund"
        ? "bg-background text-foreground"
        : "bg-muted/10 text-muted-foreground";
  const labelClass =
    level === "department"
      ? "font-semibold"
      : level === "fund"
        ? "pl-8 font-medium"
        : "pl-16 text-sm";

  return (
    <div
      className={`grid grid-cols-[minmax(0,1fr)_minmax(120px,160px)_minmax(120px,160px)] gap-3 px-4 py-3 text-sm ${rowClass}`}
    >
      <div className={`flex min-w-0 items-center gap-2 ${labelClass}`}>
        {isExpandable ? (
          <button
            aria-controls={ariaControls}
            aria-expanded={expanded}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
            onClick={onToggle}
            type="button"
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <span className="sr-only">{expanded ? "Collapse" : "Expand"} {label}</span>
          </button>
        ) : (
          <span className="h-7 w-7 shrink-0" />
        )}
        {labelContent ?? <span className="truncate">{label}</span>}
      </div>
      <div className="text-right tabular-nums text-muted-foreground">
        {formatAmount(revenues)}
      </div>
      <div className="text-right tabular-nums text-muted-foreground">
        {formatAmount(expenses)}
      </div>
    </div>
  );
}

function FunctionAccountDetailDialog({
  department,
  facts,
  fund,
  functionNode,
  objectNames
}: {
  department: DepartmentNode;
  facts: DashboardFinancialFactRow[];
  fund: FundNode;
  functionNode: FunctionNode;
  objectNames: Map<string, string>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const detail = useMemo(
    () =>
      buildAccountDetailRows({
        departmentCode: department.code,
        facts,
        fundCode: fund.code,
        functionCode: functionNode.code,
        objectNames
      }),
    [department.code, facts, fund.code, functionNode.code, objectNames]
  );

  return (
    <>
      <button
        className="truncate text-left text-sm text-primary underline-offset-4 hover:underline focus:outline-none focus:ring-2 focus:ring-ring"
        onClick={() => dialogRef.current?.showModal()}
        type="button"
      >
        {functionNode.label}
      </button>
      <dialog
        className="w-[min(960px,calc(100vw-2rem))] rounded-lg border border-border bg-card p-0 text-foreground shadow-xl backdrop:bg-black/40"
        ref={dialogRef}
      >
        <div className="border-b border-border p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-medium text-primary">Account Detail</p>
              <h3 className="mt-1 text-lg font-semibold">
                {functionNode.label}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {department.label} / {fund.label}
              </p>
            </div>
            <button
              className="rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
              onClick={() => dialogRef.current?.close()}
              type="button"
            >
              Close
            </button>
          </div>
        </div>

        <div className="max-h-[70vh] overflow-auto p-5">
          <div className="mb-4 grid gap-3 text-sm md:grid-cols-3">
            <MiniMetric label="Revenue total" value={formatAmount(detail.revenueTotal)} />
            <MiniMetric label="Expense total" value={formatAmount(detail.expenseTotal)} />
            <MiniMetric label="Objects" value={detail.rows.length} />
          </div>

          {detail.rows.length === 0 ? (
            <EmptyState>
              No revenue or expense object facts are available for this fund and function.
            </EmptyState>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="py-3 pr-4 font-medium">Object</th>
                    <th className="py-3 pr-4 font-medium">Object Name</th>
                    <th className="py-3 pr-4 font-medium">Account Type</th>
                    <th className="py-3 pr-4 text-right font-medium">Revenue</th>
                    <th className="py-3 pr-4 text-right font-medium">Expense</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.rows.map((row) => (
                    <tr className="border-b border-border align-top" key={`${row.objectCode}|${row.accountType}`}>
                      <td className="py-3 pr-4 font-medium text-foreground">{row.objectCode}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{row.objectName}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{titleize(row.accountType)}</td>
                      <td className="py-3 pr-4 text-right tabular-nums text-muted-foreground">
                        {formatAmount(row.revenues)}
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums text-muted-foreground">
                        {formatAmount(row.expenses)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border font-semibold text-foreground">
                    <td className="py-3 pr-4" colSpan={3}>Total</td>
                    <td className="py-3 pr-4 text-right tabular-nums">
                      {formatAmount(detail.revenueTotal)}
                    </td>
                    <td className="py-3 pr-4 text-right tabular-nums">
                      {formatAmount(detail.expenseTotal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {detail.excludedFactCount > 0 ? (
            <p className="mt-4 rounded-md border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
              {detail.excludedFactCount} governed fact row(s) for this fund/function are not
              shown because they are not classified as revenue or expense.
            </p>
          ) : null}
        </div>
      </dialog>
    </>
  );
}

function MiniMetric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}

function EmptyState({ children }: { children: string }) {
  return (
    <div className="rounded-md border border-dashed border-border bg-muted/20 p-4 text-sm leading-6 text-muted-foreground">
      {children}
    </div>
  );
}

function buildHierarchy({
  options,
  output,
  selection
}: {
  options: DashboardOptions;
  output: DashboardOutput;
  selection: DashboardSelection;
}): DepartmentFunctionHierarchy {
  const sourceFacts = output.dashboardFacts.filter(
    (fact) => fact.summary_type === "dashboard_detail"
  );
  const departments = new Map<string, DepartmentNode>();
  const defaultOpenDepartments = new Set<string>();
  const defaultOpenFunds = new Set<string>();
  const departmentNames = new Map(options.departments.map((row) => [row.code, row.name]));
  const fundNames = new Map(options.funds.map((row) => [row.fund_code, row.fund_name]));
  const functionNames = new Map(options.functions.map((row) => [row.code, row.name]));

  for (const fact of sourceFacts) {
    const amount = factAmount(fact);
    const accountType = normalizeKey(fact.account_type);
    const amountField = isRevenueType(accountType)
      ? "revenues"
      : isExpenseType(accountType)
        ? "expenses"
        : null;

    if (!amountField) continue;

    const departmentCode = codeValue(fact.department_code);
    const fundCode = codeValue(fact.fund_code);
    const functionCode = codeValue(fact.function_code);
    const department = getOrCreateDepartment(departments, departmentCode, departmentNames);
    const fund = getOrCreateFund(department, fundCode, fundNames);
    const functionNode = getOrCreateFunction(fund, functionCode, functionNames);

    department[amountField] += amount;
    fund[amountField] += amount;
    functionNode[amountField] += amount;
  }

  for (const department of departments.values()) {
    if (
      selection.department === department.code ||
      (selection.fund && departmentHasFund(department, selection.fund)) ||
      (selection.functionCode && departmentHasFunction(department, selection.functionCode))
    ) {
      defaultOpenDepartments.add(department.code);
    }

    for (const fund of department.funds.values()) {
      const fundKey = `${department.code}|${fund.code}`;
      if (
        selection.fund === fund.code ||
        (selection.functionCode && fund.functions.has(selection.functionCode))
      ) {
        defaultOpenFunds.add(fundKey);
      }
    }
  }

  return {
    defaultOpenDepartments,
    defaultOpenFunds,
    departments: [...departments.values()].sort(sortNodes),
    sourceFactCount: sourceFacts.length
  };
}

function buildAccountDetailRows({
  departmentCode,
  facts,
  fundCode,
  functionCode,
  objectNames
}: {
  departmentCode: string;
  facts: DashboardFinancialFactRow[];
  fundCode: string;
  functionCode: string;
  objectNames: Map<string, string>;
}) {
  const contextFacts = facts.filter(
    (fact) =>
      fact.summary_type === "dashboard_detail" &&
      codeValue(fact.department_code) === departmentCode &&
      codeValue(fact.fund_code) === fundCode &&
      codeValue(fact.function_code) === functionCode
  );
  const rows = new Map<string, AccountDetailRow>();
  let excludedFactCount = 0;

  for (const fact of contextFacts) {
    const accountType = normalizeKey(fact.account_type);
    const amountField = isRevenueType(accountType)
      ? "revenues"
      : isExpenseType(accountType)
        ? "expenses"
        : null;

    if (!amountField) {
      excludedFactCount += 1;
      continue;
    }

    const objectCode = codeValue(fact.object_code);
    const key = `${objectCode}|${accountType || "not_classified"}`;
    const row = rows.get(key) ?? {
      accountType: accountType || "not_classified",
      expenses: 0,
      objectCode: objectCode === "not_provided" ? "Not provided" : objectCode,
      objectName: objectNames.get(objectCode) ?? "Not provided",
      revenues: 0
    };

    row[amountField] += factAmount(fact);
    rows.set(key, row);
  }

  const sortedRows = [...rows.values()].sort(
    (a, b) =>
      a.objectCode.localeCompare(b.objectCode) ||
      a.accountType.localeCompare(b.accountType)
  );

  return {
    excludedFactCount,
    expenseTotal: sortedRows.reduce((total, row) => total + row.expenses, 0),
    revenueTotal: sortedRows.reduce((total, row) => total + row.revenues, 0),
    rows: sortedRows
  };
}

function getOrCreateDepartment(
  departments: Map<string, DepartmentNode>,
  code: string,
  names: Map<string, string>
) {
  const existing = departments.get(code);
  if (existing) return existing;
  const department = {
    code,
    expenses: 0,
    funds: new Map<string, FundNode>(),
    label: formatLabel(code, names.get(code)),
    revenues: 0
  };
  departments.set(code, department);
  return department;
}

function getOrCreateFund(
  department: DepartmentNode,
  code: string,
  names: Map<string, string>
) {
  const existing = department.funds.get(code);
  if (existing) return existing;
  const fund = {
    code,
    expenses: 0,
    functions: new Map<string, FunctionNode>(),
    label: `Fund ${formatLabel(code, names.get(code))}`,
    revenues: 0
  };
  department.funds.set(code, fund);
  return fund;
}

function getOrCreateFunction(
  fund: FundNode,
  code: string,
  names: Map<string, string>
) {
  const existing = fund.functions.get(code);
  if (existing) return existing;
  const functionNode = {
    code,
    expenses: 0,
    label: `Function ${formatLabel(code, names.get(code))}`,
    revenues: 0
  };
  fund.functions.set(code, functionNode);
  return functionNode;
}

function departmentHasFund(department: DepartmentNode, fund: string) {
  return department.funds.has(fund);
}

function departmentHasFunction(department: DepartmentNode, functionCode: string) {
  return [...department.funds.values()].some((fund) => fund.functions.has(functionCode));
}

function hasReferenceFilter(selection: DashboardSelection) {
  return Boolean(
    selection.fund ||
      selection.fundGroup ||
      selection.department ||
      selection.functionCode ||
      selection.acfr ||
      selection.accountType
  );
}

function toggleSetValue(current: Set<string>, value: string) {
  const next = new Set(current);
  if (next.has(value)) {
    next.delete(value);
  } else {
    next.add(value);
  }
  return next;
}

function factAmount(fact: DashboardFinancialFactRow) {
  return numericAmount(fact.presentation_amount ?? fact.net_change);
}

function numericAmount(value: number | string | null | undefined) {
  const numeric = typeof value === "number" ? value : Number.parseFloat(value ?? "0");
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatAmount(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency"
  }).format(value);
}

function codeValue(value: string | null | undefined) {
  return value?.trim() || "not_provided";
}

function formatLabel(code: string, name: string | null | undefined) {
  if (code === "not_provided") return "Not provided";
  return name ? `${code} - ${name}` : code;
}

function normalizeKey(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replaceAll(" ", "_")
    .replaceAll("-", "_");
}

function isRevenueType(value: string) {
  return value === "revenue" || value === "revenues";
}

function isExpenseType(value: string) {
  return (
    value === "expense" ||
    value === "expenses" ||
    value === "expenditure" ||
    value === "expenditures"
  );
}

function sortNodes<T extends { code: string; label: string }>(a: T, b: T) {
  return a.code.localeCompare(b.code) || a.label.localeCompare(b.label);
}

function cleanId(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function titleize(value: string) {
  return value
    .replaceAll("_", " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
