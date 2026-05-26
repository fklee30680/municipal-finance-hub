"use client";

import { useId, useMemo, useRef } from "react";

import { Button } from "@/components/ui/button";
import type { ExceptionRow } from "@/lib/dashboards/governed-dashboard";

type AccountTypeGroup = {
  accountType: string;
  highCount: number;
  label: string;
  rows: ExceptionRow[];
  warningCount: number;
};

function numericAmount(value: number | string | null | undefined) {
  const numeric = typeof value === "number" ? value : Number.parseFloat(value ?? "0");
  return Number.isNaN(numeric) ? null : numeric;
}

function formatAmount(value: number | string | null | undefined) {
  const numeric = numericAmount(value);
  if (numeric === null) return "Not available";
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency"
  }).format(numeric);
}

function formatPercent(value: number | string | null | undefined) {
  const numeric = numericAmount(value);
  if (numeric === null) return "Not available";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "percent"
  }).format(numeric);
}

function titleize(value: string | null | undefined) {
  if (!value) return "Not classified";
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeKey(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, "_");
}

function fieldValue(value: string | null | undefined, fallback = "Not provided") {
  return value?.trim() || fallback;
}

function exceptionIdentity(row: ExceptionRow) {
  return [
    row.exception_scope,
    row.exception_key,
    row.severity_level,
    row.exception_category,
    row.exception_type,
    row.fund_code,
    row.full_account_number,
    row.object_code,
    row.department_code,
    row.function_code,
    row.acfr_code,
    row.account_type,
    row.current_amount,
    row.comparison_amount,
    row.variance_amount,
    row.variance_percent,
    row.message
  ]
    .map((value) => String(value ?? ""))
    .join("|");
}

function dedupeExceptions(rows: ExceptionRow[]) {
  const seen = new Set<string>();
  const deduped: ExceptionRow[] = [];

  for (const row of rows) {
    const key = exceptionIdentity(row);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(row);
  }

  return deduped;
}

function sortExceptions(rows: ExceptionRow[]) {
  const severityRank: Record<string, number> = {
    critical: 0,
    high: 1,
    warning: 2,
    info: 3
  };

  return [...rows].sort((a, b) => {
    const severityDiff =
      (severityRank[normalizeKey(a.severity_level)] ?? 9) -
      (severityRank[normalizeKey(b.severity_level)] ?? 9);
    if (severityDiff !== 0) return severityDiff;

    const amountA = Math.abs(numericAmount(a.variance_amount) ?? numericAmount(a.current_amount) ?? 0);
    const amountB = Math.abs(numericAmount(b.variance_amount) ?? numericAmount(b.current_amount) ?? 0);
    return amountB - amountA;
  });
}

function groupByAccountType(rows: ExceptionRow[]) {
  const groups = new Map<string, ExceptionRow[]>();

  for (const row of rows) {
    const key = normalizeKey(row.account_type) || "not_classified";
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  const preferredOrder = [
    "asset",
    "liability",
    "fund_balance",
    "net_position",
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
    "not_classified"
  ];

  return [...groups.entries()]
    .map(([accountType, accountRows]): AccountTypeGroup => ({
      accountType,
      highCount: accountRows.filter((row) => normalizeKey(row.severity_level) === "high").length,
      label: titleize(accountRows[0]?.account_type ?? accountType),
      rows: sortExceptions(accountRows),
      warningCount: accountRows.filter((row) => normalizeKey(row.severity_level) === "warning").length
    }))
    .sort((a, b) => {
      const aIndex = preferredOrder.indexOf(a.accountType);
      const bIndex = preferredOrder.indexOf(b.accountType);
      const rankA = aIndex === -1 ? preferredOrder.length : aIndex;
      const rankB = bIndex === -1 ? preferredOrder.length : bIndex;
      return rankA - rankB || a.label.localeCompare(b.label);
    });
}

function getTriggerLabel(row: ExceptionRow) {
  const type = normalizeKey(row.exception_type);
  if (type.includes("dollar") && type.includes("percentage")) return "Dollar and percentage";
  if (type.includes("dollar")) return "Dollar";
  if (type.includes("percentage")) return "Percentage";
  return titleize(row.exception_type ?? "Review");
}

function getLevelLabel(row: ExceptionRow) {
  const scope = normalizeKey(row.exception_scope);
  const labels: Record<string, string> = {
    account_type: "Account type level",
    acfr: "ACFR level",
    acfr_object: "ACFR + account level",
    activity_statement_line: "Statement line level",
    balance_sheet_line: "Balance sheet line level",
    department: "Department level",
    department_object: "Department + account level",
    fund: "Fund level",
    fund_account_type: "Fund + account type level",
    fund_object: "Fund + account level",
    function: "Function level",
    function_object: "Function + account level",
    object: "Account level",
    object_code: "Account level",
    trial_balance_integrity: "Trial balance level",
    variance: "Variance level"
  };

  if (labels[scope]) return labels[scope];
  if (row.full_account_number || row.object_code) return "Account level";
  if (row.account_type) return "Account type level";
  if (row.acfr_code) return "ACFR level";
  if (row.function_code) return "Function level";
  if (row.department_code) return "Department level";
  if (row.fund_code) return "Fund level";
  return "Calculation level";
}

function getAccountDisplay(row: ExceptionRow) {
  if (row.full_account_number) return row.full_account_number;

  if (row.object_code) {
    const parts = [
      row.fund_code,
      row.department_code,
      row.function_code,
      row.acfr_code,
      row.object_code
    ].filter((value): value is string => Boolean(value?.trim()));

    return parts.length > 1 ? parts.join("-") : `Object ${row.object_code}`;
  }

  const scope = normalizeKey(row.exception_scope);
  if (scope.includes("account_type") && row.account_type) {
    return `Account type: ${titleize(row.account_type)}`;
  }
  if (scope.includes("department") && row.department_code) {
    return `Department ${row.department_code}`;
  }
  if (scope.includes("function") && row.function_code) {
    return `Function ${row.function_code}`;
  }
  if (scope.includes("acfr") && row.acfr_code) {
    return `ACFR ${row.acfr_code}`;
  }
  if (scope.includes("fund") && row.fund_code) {
    return `Fund ${row.fund_code}`;
  }
  if (row.account_type) return `Account type: ${titleize(row.account_type)}`;
  if (row.fund_code) return `Fund ${row.fund_code}`;
  return "Calculation-level warning";
}

function getPrimaryAmount(row: ExceptionRow) {
  return row.variance_amount ?? row.current_amount;
}

function MetricCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}

function SeverityPill({ severity }: { severity: string | null }) {
  const normalized = normalizeKey(severity);
  const className =
    normalized === "high" || normalized === "critical"
      ? "border-red-200 bg-red-50 text-red-700"
      : normalized === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-border bg-muted text-muted-foreground";

  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${className}`}>
      {fieldValue(severity, "Not classified")}
    </span>
  );
}

function ExceptionReviewCard({ row }: { row: ExceptionRow }) {
  const levelLabel = getLevelLabel(row);
  const accountDisplay = getAccountDisplay(row);

  return (
    <details className="rounded-md border border-border bg-card p-3">
      <summary className="cursor-pointer list-none">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <SeverityPill severity={row.severity_level} />
              <span className="rounded-full border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground">
                {getTriggerLabel(row)}
              </span>
              <span className="rounded-full border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground">
                {levelLabel}
              </span>
            </div>
            <p className="text-sm font-semibold text-foreground">
              {accountDisplay}
            </p>
            <p className="text-sm font-medium text-foreground">
              {row.message ?? "Exception requires review."}
            </p>
            <p className="text-xs text-muted-foreground">
              Department {fieldValue(row.department_code)} / Function {fieldValue(row.function_code)} / ACFR {fieldValue(row.acfr_code)}
            </p>
          </div>
          <div className="text-left md:text-right">
            <p className="text-sm font-semibold text-foreground">
              {formatAmount(getPrimaryAmount(row))}
            </p>
            <p className="text-xs text-muted-foreground">
              Variance {formatPercent(row.variance_percent)}
            </p>
          </div>
        </div>
      </summary>
      <div className="mt-3 grid gap-3 border-t border-border pt-3 text-sm md:grid-cols-2 xl:grid-cols-4">
        <Detail label="Current amount" value={formatAmount(row.current_amount)} />
        <Detail label="Comparison amount" value={formatAmount(row.comparison_amount)} />
        <Detail label="Variance amount" value={formatAmount(row.variance_amount)} />
        <Detail label="Variance percent" value={formatPercent(row.variance_percent)} />
        <Detail label="Category" value={titleize(row.exception_category)} />
        <Detail label="Type" value={titleize(row.exception_type)} />
        <Detail label="Warning level" value={levelLabel} />
        <Detail label="Account / dimension" value={accountDisplay} />
        <Detail label="Account type" value={titleize(row.account_type)} />
        <Detail label="Object" value={fieldValue(row.object_code)} />
        <div className="md:col-span-2 xl:col-span-4">
          <p className="text-xs font-medium uppercase text-muted-foreground">Recommended action</p>
          <p className="mt-1 text-sm text-foreground">
            {row.recommended_review_action ?? "Review calculation output."}
          </p>
        </div>
      </div>
    </details>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm text-foreground">{value}</p>
    </div>
  );
}

export function FundExceptionsDialog({
  exceptions,
  fund
}: {
  exceptions: ExceptionRow[];
  fund: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const reviewRows = useMemo(() => dedupeExceptions(exceptions), [exceptions]);
  const groups = useMemo(() => groupByAccountType(reviewRows), [reviewRows]);
  const highCount = reviewRows.filter((row) => normalizeKey(row.severity_level) === "high").length;
  const warningCount = reviewRows.filter((row) => normalizeKey(row.severity_level) === "warning").length;
  const dollarCount = reviewRows.filter((row) => normalizeKey(row.exception_type).includes("dollar")).length;
  const percentageCount = reviewRows.filter((row) =>
    normalizeKey(row.exception_type).includes("percentage")
  ).length;
  const unmappedCount = reviewRows.filter((row) => !row.object_code).length;

  if (exceptions.length === 0) {
    return <span>0</span>;
  }

  return (
    <>
      <Button
        aria-haspopup="dialog"
        className="h-auto border-0 bg-transparent px-0 py-0 text-primary underline-offset-4 hover:bg-transparent hover:underline"
        onClick={() => dialogRef.current?.showModal()}
        size="sm"
        type="button"
        variant="outline"
      >
        {reviewRows.length}
      </Button>
      <dialog
        aria-labelledby={titleId}
        className="max-h-[88vh] w-[min(1050px,calc(100vw-2rem))] rounded-md border border-border bg-card p-0 text-foreground shadow-xl backdrop:bg-black/40"
        ref={dialogRef}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border p-5">
          <div>
            <h2 className="text-lg font-semibold" id={titleId}>
              Exceptions for Fund {fund}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Account-type review containers for governed exception results.
            </p>
          </div>
          <Button
            onClick={() => dialogRef.current?.close()}
            size="sm"
            type="button"
            variant="outline"
          >
            Close
          </Button>
        </div>
        <div className="max-h-[74vh] space-y-5 overflow-y-auto p-5">
          {reviewRows.length < exceptions.length ? (
            <p className="rounded-md border border-border bg-background p-3 text-sm text-muted-foreground">
              Showing {reviewRows.length} unique review rows from {exceptions.length} source rows. Exact duplicate rows were collapsed for readability.
            </p>
          ) : null}

          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <MetricCard label="Total" value={reviewRows.length} />
            <MetricCard label="High" value={highCount} />
            <MetricCard label="Warning" value={warningCount} />
            <MetricCard label="Dollar" value={dollarCount} />
            <MetricCard label="Percentage" value={percentageCount} />
          </section>

          {unmappedCount > 0 ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              {unmappedCount} row{unmappedCount === 1 ? "" : "s"} do not have an object code. Review unmapped or incomplete account structure details before treating these as normal variance items.
            </p>
          ) : null}

          {groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No fund-specific exception details are available for Fund {fund}.
            </p>
          ) : (
            <div className="space-y-3">
              {groups.map((group, index) => (
                <details
                  className="rounded-md border border-border bg-background"
                  key={group.accountType}
                  open={index === 0 || group.highCount > 0}
                >
                  <summary className="cursor-pointer list-none px-4 py-3">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">{group.label}</h3>
                        <p className="text-xs text-muted-foreground">
                          {group.rows.length} exception{group.rows.length === 1 ? "" : "s"} / {group.highCount} high / {group.warningCount} warning
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground">Expand for details</span>
                    </div>
                  </summary>
                  <div className="space-y-3 border-t border-border p-4">
                    {group.rows.map((row) => (
                      <ExceptionReviewCard key={row.exception_result_id} row={row} />
                    ))}
                  </div>
                </details>
              ))}
            </div>
          )}
        </div>
      </dialog>
    </>
  );
}
