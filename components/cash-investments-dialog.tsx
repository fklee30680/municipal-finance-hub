"use client";

import { useMemo, useRef } from "react";

import type { DashboardFinancialFactRow } from "@/lib/dashboards/governed-dashboard";

type CashInvestmentRow = {
  endingBalance: number;
  fund: string;
  objectCode: string;
  objectName: string;
};

export function CashInvestmentsDialog({
  facts,
  objectNames,
  total
}: {
  facts: DashboardFinancialFactRow[];
  objectNames: Array<{ code: string; name: string }>;
  total: number;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const rows = useMemo(
    () => buildRows({ facts, objectNames }),
    [facts, objectNames]
  );

  if (rows.length === 0) {
    return <span>{formatAmount(total)}</span>;
  }

  return (
    <>
      <button
        className="text-left text-2xl font-semibold text-primary underline-offset-4 hover:underline focus:outline-none focus:ring-2 focus:ring-ring"
        onClick={() => dialogRef.current?.showModal()}
        type="button"
      >
        {formatAmount(total)}
      </button>
      <dialog
        className="w-[min(860px,calc(100vw-2rem))] rounded-lg border border-border bg-card p-0 text-foreground shadow-xl backdrop:bg-black/40"
        ref={dialogRef}
      >
        <div className="border-b border-border p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-medium text-primary">Cash / Investments</p>
              <h3 className="mt-1 text-lg font-semibold">Fund and Object Detail</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Ending balances from governed dashboard facts classified as cash or investments.
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
              {formatAmount(total)}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="py-3 pr-4 font-medium">Fund</th>
                  <th className="py-3 pr-4 font-medium">Object</th>
                  <th className="py-3 pr-4 font-medium">Object Name</th>
                  <th className="py-3 pr-4 text-right font-medium">Ending Balance</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr className="border-b border-border align-top" key={`${row.fund}|${row.objectCode}`}>
                    <td className="py-3 pr-4 font-medium text-foreground">{row.fund}</td>
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
                  <td className="py-3 pr-4" colSpan={3}>Total</td>
                  <td className="py-3 pr-4 text-right tabular-nums">
                    {formatAmount(total)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </dialog>
    </>
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

  for (const fact of facts) {
    const fund = fact.fund_code?.trim() || "Not provided";
    const objectCode = fact.object_code?.trim() || "Not provided";
    const key = `${fund}|${objectCode}`;
    const row = rows.get(key) ?? {
      endingBalance: 0,
      fund,
      objectCode,
      objectName: names.get(objectCode) ?? "Not provided"
    };

    row.endingBalance += numericAmount(fact.ending_balance);
    rows.set(key, row);
  }

  return [...rows.values()].sort(
    (a, b) =>
      a.fund.localeCompare(b.fund) ||
      a.objectCode.localeCompare(b.objectCode)
  );
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
