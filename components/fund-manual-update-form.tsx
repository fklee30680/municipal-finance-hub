"use client";

import { Pencil, X } from "lucide-react";
import { useActionState, useEffect, useId, useRef } from "react";
import { useRouter } from "next/navigation";

import {
  updateFundManualAction,
  type FundManualUpdateState
} from "@/app/imports/funds/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type EditableFund = {
  active_status: string;
  effective_end_date: string | null;
  effective_start_date: string | null;
  fund_code: string;
  fund_group: string | null;
  fund_id: string;
  major_fund_flag: string | null;
  reporting_model: string | null;
};

const initialState: FundManualUpdateState = {
  message: null,
  status: "idle"
};

const reportingModels = [
  ["", "Not set"],
  ["governmental", "Governmental"],
  ["proprietary", "Proprietary"],
  ["fiduciary", "Fiduciary"],
  ["component_unit", "Component Unit"],
  ["other", "Other"]
] as const;

export function FundManualUpdateForm({
  fund,
  fundGroups
}: {
  fund: EditableFund;
  fundGroups: string[];
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const reportingModelRef = useRef<HTMLSelectElement>(null);
  const router = useRouter();
  const titleId = useId();
  const [state, formAction, pending] = useActionState(
    updateFundManualAction,
    initialState
  );
  const fundGroupListId = `fund-groups-${fund.fund_id}`;

  useEffect(() => {
    if (state.status === "success") {
      dialogRef.current?.close();
      router.refresh();
    }
  }, [router, state.status]);

  return (
    <>
      <button
        className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
        onClick={() => {
          dialogRef.current?.showModal();
          window.requestAnimationFrame(() => reportingModelRef.current?.focus());
        }}
        type="button"
      >
        <Pencil aria-hidden="true" className="h-3.5 w-3.5" />
        Edit
      </button>

      <dialog
        aria-labelledby={titleId}
        className="w-[min(720px,calc(100vw-32px))] rounded-md border border-border bg-background p-0 text-foreground shadow-xl backdrop:bg-black/40"
        ref={dialogRef}
      >
        <form method="dialog">
          <button
            aria-label="Close fund editor"
            className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
            type="submit"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </form>

        <div className="border-b border-border px-6 py-5">
          <p className="text-xs font-medium uppercase tracking-wide text-primary">
            Manual Fund Update
          </p>
          <h3 className="mt-1 text-xl font-semibold text-foreground" id={titleId}>
            {fund.fund_code}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Update fund setup fields used by mapping coverage and future
            analysis outputs.
          </p>
        </div>

        <form action={formAction} className="space-y-5 px-6 py-5">
          <input name="fundId" type="hidden" value={fund.fund_id} />

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm font-medium text-foreground">
              Reporting Model
              <select
                className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                defaultValue={fund.reporting_model ?? ""}
                name="reportingModel"
                ref={reportingModelRef}
              >
                {reportingModels.map(([value, label]) => (
                  <option key={value || "empty"} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm font-medium text-foreground">
              Fund Group
              <Input
                defaultValue={fund.fund_group ?? ""}
                list={fundGroupListId}
                name="fundGroup"
                placeholder="Enter or choose a group"
              />
              <datalist id={fundGroupListId}>
                {fundGroups.map((group) => (
                  <option key={group} value={group} />
                ))}
              </datalist>
            </label>

            <label className="space-y-2 text-sm font-medium text-foreground">
              Major Fund
              <select
                className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                defaultValue={normalizeMajorFundFlag(fund.major_fund_flag)}
                name="majorFundFlag"
              >
                <option value="">Not set</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </label>

            <label className="space-y-2 text-sm font-medium text-foreground">
              Active Status
              <select
                className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                defaultValue={fund.active_status}
                name="activeStatus"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>

            <label className="space-y-2 text-sm font-medium text-foreground">
              Effective Start
              <Input
                defaultValue={fund.effective_start_date ?? ""}
                name="effectiveStartDate"
                type="date"
              />
            </label>

            <label className="space-y-2 text-sm font-medium text-foreground">
              Effective End
              <Input
                defaultValue={fund.effective_end_date ?? ""}
                name="effectiveEndDate"
                type="date"
              />
            </label>
          </div>

          <div className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
            Fund code, name, and fund type remain controlled by the import
            workflow. Manual edits here update setup/classification fields only.
          </div>

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

          <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
            <button
              className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
              onClick={() => dialogRef.current?.close()}
              type="button"
            >
              Cancel
            </button>
            <Button disabled={pending} type="submit">
              {pending ? "Saving..." : "Save and Close"}
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}

function normalizeMajorFundFlag(value: string | null) {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (["yes", "y", "true", "major", "1"].includes(normalized)) return "yes";
  if (["no", "n", "false", "non_major", "non-major", "0"].includes(normalized)) {
    return "no";
  }
  return "";
}
