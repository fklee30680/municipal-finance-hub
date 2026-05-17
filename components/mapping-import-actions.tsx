"use client";

import { useActionState } from "react";

import {
  commitMappingImportAction,
  generateMappingImportPreviewAction
} from "@/app/imports/[importBatchId]/mapping-preview/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { initialMappingImportState } from "@/lib/imports/mapping-import-state";

export function MappingPreviewAction({
  disabled,
  importBatchId
}: {
  disabled?: boolean;
  importBatchId: string;
}) {
  const [state, formAction, isPending] = useActionState(
    generateMappingImportPreviewAction,
    initialMappingImportState
  );

  return (
    <form action={formAction} className="space-y-3">
      <input name="importBatchId" type="hidden" value={importBatchId} />
      <Button disabled={disabled || isPending} type="submit">
        {isPending ? "Generating preview..." : "Generate mapping preview"}
      </Button>
      <StateMessage message={state.message} status={state.status} />
    </form>
  );
}

export function MappingCommitAction({
  disabled,
  importBatchId,
  mappingImportRunId
}: {
  disabled?: boolean;
  importBatchId: string;
  mappingImportRunId: string;
}) {
  const [state, formAction, isPending] = useActionState(
    commitMappingImportAction,
    initialMappingImportState
  );

  return (
    <form action={formAction} className="space-y-4">
      <input name="importBatchId" type="hidden" value={importBatchId} />
      <input name="mappingImportRunId" type="hidden" value={mappingImportRunId} />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="defaultEffectiveStartDate">
            Default effective start date
          </label>
          <Input id="defaultEffectiveStartDate" name="defaultEffectiveStartDate" type="date" />
          <p className="text-xs leading-5 text-muted-foreground">
            Required when accepted rows do not include source effective dates.
          </p>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="changeDescription">
            Change reason
          </label>
          <Input
            id="changeDescription"
            name="changeDescription"
            placeholder="Imported reviewed mapping file"
          />
        </div>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input className="mt-1" name="confirmCommit" type="checkbox" />
        <span>
          Accepted rows will update reference mappings. Rejected rows will not
          be committed. This will not post trial balance data or update
          dashboards/reports.
        </span>
      </label>
      <Button disabled={disabled || isPending} type="submit">
        {isPending ? "Committing..." : "Commit Accepted Mappings"}
      </Button>
      <StateMessage message={state.message} status={state.status} />
    </form>
  );
}

function StateMessage({
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
