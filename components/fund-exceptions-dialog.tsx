"use client";

import { useId, useRef } from "react";

import { Button } from "@/components/ui/button";
import type { ExceptionRow } from "@/lib/dashboards/governed-dashboard";

function formatAmount(value: number | string | null | undefined) {
  const numeric = typeof value === "number" ? value : Number.parseFloat(value ?? "0");
  if (Number.isNaN(numeric)) return "Not available";
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency"
  }).format(numeric);
}

function titleize(value: string | null | undefined) {
  if (!value) return "Not classified";
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function fieldValue(value: string | null | undefined, fallback = "Not provided") {
  return value?.trim() || fallback;
}

export function FundExceptionsDialog({
  exceptionCount,
  exceptions,
  fund
}: {
  exceptionCount: number;
  exceptions: ExceptionRow[];
  fund: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  if (exceptionCount === 0) {
    return <span>0</span>;
  }

  return (
    <>
      <Button
        aria-haspopup="dialog"
        className="h-auto px-0 py-0 text-primary underline-offset-4 hover:underline"
        onClick={() => dialogRef.current?.showModal()}
        size="sm"
        type="button"
        variant="outline"
      >
        {exceptionCount}
      </Button>
      <dialog
        aria-labelledby={titleId}
        className="max-h-[85vh] w-[min(1100px,calc(100vw-2rem))] rounded-md border border-border bg-card p-0 text-foreground shadow-xl backdrop:bg-black/40"
        ref={dialogRef}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border p-5">
          <div>
            <h2 className="text-lg font-semibold" id={titleId}>
              Exceptions for Fund {fund}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Fund-specific governed exception results for the selected calculation run.
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
        <div className="max-h-[70vh] overflow-auto p-5">
          {exceptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No fund-specific exception details are available for Fund {fund}.
            </p>
          ) : (
            <table className="w-full min-w-[900px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="py-3 pr-4 font-medium">Severity</th>
                  <th className="py-3 pr-4 font-medium">Category</th>
                  <th className="py-3 pr-4 font-medium">Type</th>
                  <th className="py-3 pr-4 font-medium">Object</th>
                  <th className="py-3 pr-4 font-medium">Department</th>
                  <th className="py-3 pr-4 font-medium">Function</th>
                  <th className="py-3 pr-4 font-medium">ACFR</th>
                  <th className="py-3 pr-4 font-medium">Account Type</th>
                  <th className="py-3 pr-4 font-medium">Amount</th>
                  <th className="py-3 pr-4 font-medium">Message</th>
                  <th className="py-3 pr-4 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {exceptions.map((exception) => (
                  <tr
                    className="border-b border-border align-top text-muted-foreground"
                    key={exception.exception_result_id}
                  >
                    <td className="py-3 pr-4">{fieldValue(exception.severity_level, "Not classified")}</td>
                    <td className="py-3 pr-4">{titleize(exception.exception_category)}</td>
                    <td className="py-3 pr-4">{titleize(exception.exception_type)}</td>
                    <td className="py-3 pr-4">{fieldValue(exception.object_code)}</td>
                    <td className="py-3 pr-4">{fieldValue(exception.department_code)}</td>
                    <td className="py-3 pr-4">{fieldValue(exception.function_code)}</td>
                    <td className="py-3 pr-4">{fieldValue(exception.acfr_code)}</td>
                    <td className="py-3 pr-4">{titleize(exception.account_type)}</td>
                    <td className="py-3 pr-4">{formatAmount(exception.current_amount)}</td>
                    <td className="min-w-[240px] py-3 pr-4">
                      {exception.message ?? "No message"}
                    </td>
                    <td className="min-w-[220px] py-3 pr-4">
                      {exception.recommended_review_action ?? "Review calculation output"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </dialog>
    </>
  );
}
