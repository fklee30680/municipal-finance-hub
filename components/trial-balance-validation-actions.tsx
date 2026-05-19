"use client";

import { useActionState } from "react";

import {
  acknowledgeValidationWarningsAction,
  runTrialBalanceValidationAction
} from "@/app/imports/[importBatchId]/validation/actions";
import { Button } from "@/components/ui/button";
import { initialTrialBalanceValidationState } from "@/lib/imports/validation-state";

export function RunTrialBalanceValidationAction({
  disabled,
  importBatchId
}: {
  disabled?: boolean;
  importBatchId: string;
}) {
  const [state, formAction, isPending] = useActionState(
    runTrialBalanceValidationAction,
    initialTrialBalanceValidationState
  );

  return (
    <form action={formAction} className="space-y-3">
      <input name="importBatchId" type="hidden" value={importBatchId} />
      <Button disabled={disabled || isPending} type="submit">
        {isPending ? "Running validation..." : "Run Validation"}
      </Button>
      <ActionMessage message={state.message} status={state.status} />
    </form>
  );
}

export function AcknowledgeValidationWarningsAction({
  disabled,
  importBatchId,
  validationRunId
}: {
  disabled?: boolean;
  importBatchId: string;
  validationRunId: string;
}) {
  const [state, formAction, isPending] = useActionState(
    acknowledgeValidationWarningsAction,
    initialTrialBalanceValidationState
  );

  return (
    <form action={formAction} className="space-y-3">
      <input name="importBatchId" type="hidden" value={importBatchId} />
      <input name="validationRunId" type="hidden" value={validationRunId} />
      <label className="block space-y-2 text-sm">
        <span className="font-medium text-foreground">Acknowledgement note</span>
        <textarea
          className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
          name="acknowledgementNote"
          placeholder="Document why these warnings can proceed to posting."
        />
      </label>
      <Button disabled={disabled || isPending} type="submit">
        {isPending ? "Acknowledging warnings..." : "Acknowledge Warnings"}
      </Button>
      <ActionMessage message={state.message} status={state.status} />
    </form>
  );
}

function ActionMessage({
  message,
  status
}: {
  message?: string;
  status: "idle" | "success" | "error";
}) {
  if (!message) {
    return null;
  }

  return (
    <p
      className={
        status === "error"
          ? "rounded-md border border-border bg-muted px-3 py-2 text-sm text-destructive"
          : "rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground"
      }
    >
      {message}
    </p>
  );
}
