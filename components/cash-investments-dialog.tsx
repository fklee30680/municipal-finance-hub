"use client";

import { useMemo, useRef, useState } from "react";

import { Card, CardContent } from "@/components/ui/card";
import type { DashboardFinancialFactRow } from "@/lib/dashboards/governed-dashboard";

type LiquidityCategory = "cash" | "investments" | "total" | "unsplit";

type CashInvestmentRow = {
  category: Exclude<LiquidityCategory, "total">;
  endingBalance: number;
  fund: string;
  objectCode: string;
  objectName: string;
};

type LiquiditySummary = {
  cash: number;
  investments: number;
  total: number;
  unsplit: number;
};

const CATEGORY_LABELS: Record<LiquidityCategory, string> = {
  cash: "Cash",
  investments: "Investments",
  total: "Total cash & investments",
  unsplit: "Unsplit cash/investments"
};

export function CashInvestmentsSummaryCard({
  facts,
  objectNames
}: {
  facts: DashboardFinancialFactRow[];
  objectNames: Array<{ code: string; name: string }>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [dialogCategory, setDialogCategory] = useState<LiquidityCategory>("total");
  const detail = useMemo(
    () => buildRows({ facts, objectNames }),
    [facts, objectNames]
  );

  function openDialog(category: LiquidityCategory) {
    setDialogCategory(category);
    dialogRef.current?.showModal();
  }

  const dialogRows =
    dialogCategory === "total"
      ? detail.rows
      : detail.rows.filter((row) => row.category === dialogCategory);
  const dialogTotal =
    dialogCategory === "total"
      ? detail.summary.total
      : detail.summary[dialogCategory];

  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Cash & investments
        </p>
        <div className="divide-y divide-border rounded-md border border-border">
          <LiquiditySummaryRow
            amount={detail.summary.cash}
            label={CATEGORY_LABELS.cash}
            onClick={() => openDialog("cash")}
          />
          <LiquiditySummaryRow
            amount={detail.summary.investments}
            label={CATEGORY_LABELS.investments}
            onClick={() => openDialog("investments")}
          />
          {detail.summary.unsplit !== 0 ? (
            <LiquiditySummaryRow
              amount={detail.summary.unsplit}
              label={CATEGORY_LABELS.unsplit}
              onClick={() => openDialog("unsplit")}
            />
          ) : null}
          <LiquiditySummaryRow
            amount={detail.summary.total}
            emphasized
            label={CATEGORY_LABELS.total}
            onClick={() => openDialog("total")}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Ending balances from governed dashboard facts.
        </p>

        <dialog
          className="w-[min(900px,calc(100vw-2rem))] rounded-lg border border-border bg-card p-0 text-foreground shadow-xl backdrop:bg-black/40"
          ref={dialogRef}
        >
          <div className="border-b border-border p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-medium text-primary">Cash & Investments</p>
                <h3 className="mt-1 text-lg font-semibold">
                  {CATEGORY_LABELS[dialogCategory]} Detail
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Fund and object ending balances from governed dashboard facts.
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
            <div className="mb-4 rounded-md border border-border bg-background p-3">
              <p className="text-xs font-medium uppercase text-muted-foreground">
                Ending balance total
              </p>
              <p className="mt-1 text-lg font-semibold text-foreground">
                {formatAmount(dialogTotal)}
              </p>
            </div>

            {dialogRows.length === 0 ? (
              <p className="rounded-md border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                No fund/object detail exists for this liquidity category.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="py-3 pr-4 font-medium">Category</th>
                      <th className="py-3 pr-4 font-medium">Fund</th>
                      <th className="py-3 pr-4 font-medium">Object</th>
                      <th className="py-3 pr-4 font-medium">Object Name</th>
                      <th className="py-3 pr-4 text-right font-medium">Ending Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dialogRows.map((row) => (
                      <tr
                        className="border-b border-border align-top"
                        key={`${row.category}|${row.fund}|${row.objectCode}`}
                      >
                        <td className="py-3 pr-4 font-medium text-foreground">
                          {CATEGORY_LABELS[row.category]}
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">{row.fund}</td>
                        <td className="py-3 pr-4 text-muted-foreground">{row.objectCode}</td>
                        <td className="py-3 pr-4 text-muted-foreground">{row.objectName}</td>
                        <td className="py-3 pr-4 text-right tabular-nums text-muted-foreground">
                          {formatAmount(row.endingBalance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border font-semibold text-foreground">
                      <td className="py-3 pr-4" colSpan={4}>Total</td>
                      <td className="py-3 pr-4 text-right tabular-nums">
                        {formatAmount(dialogTotal)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </dialog>
      </CardContent>
    </Card>
  );
}

function LiquiditySummaryRow({
  amount,
  emphasized = false,
  label,
  onClick
}: {
  amount: number;
  emphasized?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <div className={`grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-3 py-2 ${emphasized ? "bg-muted/20 font-semibold" : ""}`}>
      <span className="text-sm text-muted-foreground">{label}</span>
      <button
        className="text-right text-sm font-semibold tabular-nums text-primary underline-offset-4 hover:underline focus:outline-none focus:ring-2 focus:ring-ring"
        onClick={onClick}
        type="button"
      >
        {formatAmount(amount)}
      </button>
    </div>
  );
}

function buildRows({
  facts,
  objectNames
}: {
  facts: DashboardFinancialFactRow[];
  objectNames: Array<{ code: string; name: string }>;
}) {
  const names = new Map(objectNames.map((row) => [row.code, row.name]));
  const rows = new Map<string, CashInvestmentRow>();
  const summary: LiquiditySummary = {
    cash: 0,
    investments: 0,
    total: 0,
    unsplit: 0
  };

  for (const fact of facts) {
    const category = getLiquidityCategory(fact);
    if (!category) continue;

    const amount = numericAmount(fact.ending_balance);
    const fund = fact.fund_code?.trim() || "Not provided";
    const objectCode = fact.object_code?.trim() || "Not provided";
    const key = `${category}|${fund}|${objectCode}`;
    const row = rows.get(key) ?? {
      category,
      endingBalance: 0,
      fund,
      objectCode,
      objectName: names.get(objectCode) ?? "Not provided"
    };

    row.endingBalance += amount;
    rows.set(key, row);
    summary[category] += amount;
    summary.total += amount;
  }

  return {
    rows: [...rows.values()].sort(
      (a, b) =>
        categoryRank(a.category) - categoryRank(b.category) ||
        a.fund.localeCompare(b.fund) ||
        a.objectCode.localeCompare(b.objectCode)
    ),
    summary
  };
}

function getLiquidityCategory(fact: DashboardFinancialFactRow): Exclude<LiquidityCategory, "total"> | null {
  const accountType = normalizeKey(fact.account_type);
  const activityLine = normalizeKey(fact.activity_statement_line);
  const balanceLine = normalizeKey(fact.balance_sheet_line);
  const isInvestment =
    accountType === "investment" ||
    accountType === "investments" ||
    balanceLine.includes("investment") ||
    activityLine.includes("investment");
  const isCash =
    accountType === "cash" ||
    balanceLine.includes("cash") ||
    activityLine.includes("cash");

  if (isInvestment && !isCash) return "investments";
  if (isCash && !isInvestment) return "cash";
  if (isCash || isInvestment || accountType === "cash_and_investments") return "unsplit";
  return null;
}

function categoryRank(category: Exclude<LiquidityCategory, "total">) {
  if (category === "cash") return 0;
  if (category === "investments") return 1;
  return 2;
}

function numericAmount(value: number | string | null | undefined) {
  const numeric = typeof value === "number" ? value : Number.parseFloat(value ?? "0");
  return Number.isFinite(numeric) ? numeric : 0;
}

function normalizeKey(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replaceAll(" ", "_")
    .replaceAll("-", "_");
}

function formatAmount(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency"
  }).format(value);
}
