"use client";

import { useActionState } from "react";

import { runCalculationAction } from "@/app/analysis/calculation-runs/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initialCalculationRunActionState = {
  message: null,
  status: "idle" as const
};

export function CalculationRunForm({
  defaultFiscalYear,
  defaultPeriod,
  disabledReason
}: {
  defaultFiscalYear: number;
  defaultPeriod: number;
  disabledReason?: string;
}) {
  const [state, formAction, pending] = useActionState(
    runCalculationAction,
    initialCalculationRunActionState
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <label className="space-y-2 text-sm font-medium text-foreground">
          Fiscal year
          <Input
            defaultValue={defaultFiscalYear || new Date().getFullYear()}
            min={1900}
            name="fiscalYear"
            required
            type="number"
          />
        </label>
        <label className="space-y-2 text-sm font-medium text-foreground">
          Period from
          <Input
            defaultValue={defaultPeriod || 1}
            max={13}
            min={0}
            name="periodFrom"
            required
            type="number"
          />
        </label>
        <label className="space-y-2 text-sm font-medium text-foreground">
          Period to
          <Input
            defaultValue={defaultPeriod || 1}
            max={13}
            min={0}
            name="periodTo"
            required
            type="number"
          />
        </label>
        <label className="space-y-2 text-sm font-medium text-foreground">
          Time view
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            defaultValue="current_period"
            name="timeView"
          >
            <option value="current_period">Current period</option>
            <option value="ytd">YTD</option>
            <option value="selected_range">Selected range</option>
          </select>
        </label>
        <label className="space-y-2 text-sm font-medium text-foreground">
          Reporting scope
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            defaultValue="standard"
            name="reportingScope"
          >
            <option value="standard">Standard Reporting</option>
            <option value="cash_reconciliation">
              Include Pooled Cash / Reconciliation
            </option>
            <option value="all_active">All Active Funds</option>
          </select>
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={pending || Boolean(disabledReason)} type="submit">
          {pending ? "Running..." : "Run Calculation"}
        </Button>
        <p className="text-sm text-muted-foreground">
          Uses posted active trial balance rows only. It does not build
          dashboards or generate reports.
        </p>
      </div>
      {disabledReason ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {disabledReason}
        </p>
      ) : null}
      {state.message ? (
        <p
          className={
            state.status === "error"
              ? "rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              : "rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground"
          }
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
