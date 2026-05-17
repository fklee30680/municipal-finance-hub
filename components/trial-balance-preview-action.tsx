"use client";

import { useActionState } from "react";

import { generateTrialBalancePreviewAction } from "@/app/imports/[importBatchId]/preview/actions";
import { Button } from "@/components/ui/button";
import { initialTrialBalancePreviewState } from "@/lib/imports/preview-state";

export function TrialBalancePreviewAction({
  disabled,
  importBatchId
}: {
  disabled?: boolean;
  importBatchId: string;
}) {
  const [state, formAction, isPending] = useActionState(
    generateTrialBalancePreviewAction,
    initialTrialBalancePreviewState
  );

  return (
    <form action={formAction} className="space-y-3">
      <input name="importBatchId" type="hidden" value={importBatchId} />
      <Button disabled={disabled || isPending} type="submit">
        {isPending ? "Generating preview..." : "Generate preview"}
      </Button>
      {state.message ? (
        <p
          className={
            state.status === "error"
              ? "rounded-md border border-border bg-muted px-3 py-2 text-sm text-destructive"
              : "rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground"
          }
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
