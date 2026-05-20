"use client";

import { useActionState } from "react";

import { archiveUploadedImportAction } from "@/app/imports/actions";
import { Button } from "@/components/ui/button";
import { initialArchiveImportState } from "@/lib/imports/archive-state";

export function ArchiveImportAction({
  disabled,
  importBatchId
}: {
  disabled?: boolean;
  importBatchId: string;
}) {
  const [state, formAction, isPending] = useActionState(
    archiveUploadedImportAction,
    initialArchiveImportState
  );

  return (
    <form action={formAction} className="space-y-3">
      <input name="importBatchId" type="hidden" value={importBatchId} />
      <label className="block space-y-2 text-sm">
        <span className="font-medium text-foreground">Archive reason</span>
        <textarea
          className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
          name="reason"
          placeholder="Optional note, such as bad source file or wrong period."
        />
      </label>
      <Button disabled={disabled || isPending} type="submit" variant="outline">
        {isPending ? "Archiving..." : "Archive Upload"}
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
