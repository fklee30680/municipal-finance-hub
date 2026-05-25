"use client";

import { useActionState } from "react";

import { runCalculationAction } from "@/app/analysis/calculation-runs/actions";
import { Button } from "@/components/ui/button";

const initialState = {
  message: null,
  status: "idle" as const
};

export function DashboardRunCalculationForm({
  fiscalYear,
  periodFrom,
  periodTo,
  reportingScope,
  timeView
}: {
  fiscalYear: number;
  periodFrom: number;
  periodTo: number;
  reportingScope: string;
  timeView: string;
}) {
  const [state, formAction, pending] = useActionState(
    runCalculationAction,
    initialState
  );

  return (
    <form action={formAction} className="space-y-3">
      <input name="fiscalYear" type="hidden" value={fiscalYear} />
      <input name="periodFrom" type="hidden" value={periodFrom} />
      <input name="periodTo" type="hidden" value={periodTo} />
      <input name="timeView" type="hidden" value={timeView} />
      <input name="reportingScope" type="hidden" value={reportingScope} />
      <Button disabled={pending} type="submit">
        {pending ? "Running..." : "Run calculation for this dashboard"}
      </Button>
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
