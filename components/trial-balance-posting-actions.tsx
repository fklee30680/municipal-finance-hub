"use client";

import { useActionState } from "react";

import {
  postValidatedTrialBalanceAction,
  requestReactivationAction,
  requestReplacementAction
} from "@/app/imports/[importBatchId]/post/actions";
import {
  approveReplacementRequestAction,
  rejectReplacementRequestAction
} from "@/app/imports/replacement-requests/actions";
import {
  approveReactivationRequestAction,
  rejectReactivationRequestAction
} from "@/app/imports/reactivation-requests/actions";
import { Button } from "@/components/ui/button";
import { initialTrialBalancePostingState } from "@/lib/imports/posting-state";

export function PostValidatedTrialBalanceAction({
  disabled,
  importBatchId
}: {
  disabled?: boolean;
  importBatchId: string;
}) {
  const [state, formAction, isPending] = useActionState(
    postValidatedTrialBalanceAction,
    initialTrialBalancePostingState
  );

  return (
    <form action={formAction} className="space-y-3">
      <input name="importBatchId" type="hidden" value={importBatchId} />
      <Button disabled={disabled || isPending} type="submit">
        {isPending ? "Posting..." : "Post Validated Trial Balance"}
      </Button>
      <ActionMessage message={state.message} status={state.status} />
    </form>
  );
}

export function RequestReplacementAction({
  disabled,
  importBatchId
}: {
  disabled?: boolean;
  importBatchId: string;
}) {
  const [state, formAction, isPending] = useActionState(
    requestReplacementAction,
    initialTrialBalancePostingState
  );

  return (
    <form action={formAction} className="space-y-3">
      <input name="importBatchId" type="hidden" value={importBatchId} />
      <ReasonField
        name="reason"
        placeholder="Explain why this replacement should supersede the active period data."
      />
      <Button disabled={disabled || isPending} type="submit">
        {isPending ? "Requesting replacement..." : "Request Replacement"}
      </Button>
      <ActionMessage message={state.message} status={state.status} />
    </form>
  );
}

export function RequestReactivationAction({
  disabled,
  importBatchId
}: {
  disabled?: boolean;
  importBatchId: string;
}) {
  const [state, formAction, isPending] = useActionState(
    requestReactivationAction,
    initialTrialBalancePostingState
  );

  return (
    <form action={formAction} className="space-y-3">
      <input name="importBatchId" type="hidden" value={importBatchId} />
      <ReasonField
        name="reason"
        placeholder="Explain why this inactive or superseded import should be reactivated."
      />
      <Button disabled={disabled || isPending} type="submit">
        {isPending ? "Requesting reactivation..." : "Request Reactivation"}
      </Button>
      <ActionMessage message={state.message} status={state.status} />
    </form>
  );
}

export function ReplacementRequestDecisionActions({
  replacementRequestId
}: {
  replacementRequestId: string;
}) {
  const [approveState, approveAction, approving] = useActionState(
    approveReplacementRequestAction,
    initialTrialBalancePostingState
  );
  const [rejectState, rejectAction, rejecting] = useActionState(
    rejectReplacementRequestAction,
    initialTrialBalancePostingState
  );

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <form action={approveAction} className="space-y-3">
        <input
          name="replacementRequestId"
          type="hidden"
          value={replacementRequestId}
        />
        <ReasonField
          label="Approval note"
          name="reason"
          placeholder="Document the approval reason."
        />
        <Button disabled={approving} type="submit">
          {approving ? "Approving..." : "Approve Replacement"}
        </Button>
        <ActionMessage message={approveState.message} status={approveState.status} />
      </form>

      <form action={rejectAction} className="space-y-3">
        <input
          name="replacementRequestId"
          type="hidden"
          value={replacementRequestId}
        />
        <ReasonField
          label="Rejection note"
          name="reason"
          placeholder="Document why the replacement was rejected."
        />
        <Button disabled={rejecting} type="submit" variant="outline">
          {rejecting ? "Rejecting..." : "Reject Replacement"}
        </Button>
        <ActionMessage message={rejectState.message} status={rejectState.status} />
      </form>
    </div>
  );
}

export function ReactivationRequestDecisionActions({
  reactivationRequestId
}: {
  reactivationRequestId: string;
}) {
  const [approveState, approveAction, approving] = useActionState(
    approveReactivationRequestAction,
    initialTrialBalancePostingState
  );
  const [rejectState, rejectAction, rejecting] = useActionState(
    rejectReactivationRequestAction,
    initialTrialBalancePostingState
  );

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <form action={approveAction} className="space-y-3">
        <input
          name="reactivationRequestId"
          type="hidden"
          value={reactivationRequestId}
        />
        <ReasonField
          label="Approval note"
          name="reason"
          placeholder="Document the reactivation approval reason."
        />
        <Button disabled={approving} type="submit">
          {approving ? "Approving..." : "Approve Reactivation"}
        </Button>
        <ActionMessage message={approveState.message} status={approveState.status} />
      </form>

      <form action={rejectAction} className="space-y-3">
        <input
          name="reactivationRequestId"
          type="hidden"
          value={reactivationRequestId}
        />
        <ReasonField
          label="Rejection note"
          name="reason"
          placeholder="Document why reactivation was rejected."
        />
        <Button disabled={rejecting} type="submit" variant="outline">
          {rejecting ? "Rejecting..." : "Reject Reactivation"}
        </Button>
        <ActionMessage message={rejectState.message} status={rejectState.status} />
      </form>
    </div>
  );
}

function ReasonField({
  label = "Reason",
  name,
  placeholder
}: {
  label?: string;
  name: string;
  placeholder: string;
}) {
  return (
    <label className="block space-y-2 text-sm">
      <span className="font-medium text-foreground">{label}</span>
      <textarea
        className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
        name={name}
        placeholder={placeholder}
        required
      />
    </label>
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
