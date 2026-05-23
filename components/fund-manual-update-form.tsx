"use client";

import { useActionState } from "react";

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
  const [state, formAction, pending] = useActionState(
    updateFundManualAction,
    initialState
  );
  const fundGroupListId = `fund-groups-${fund.fund_id}`;

  return (
    <details className="min-w-[320px] rounded-md border border-border bg-card">
      <summary className="cursor-pointer px-3 py-2 text-xs font-semibold uppercase text-primary">
        Edit
      </summary>
      <form action={formAction} className="space-y-3 border-t border-border p-3">
        <input name="fundId" type="hidden" value={fund.fund_id} />
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-xs font-medium text-foreground">
            Reporting Model
            <select
              className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              defaultValue={fund.reporting_model ?? ""}
              name="reportingModel"
            >
              {reportingModels.map(([value, label]) => (
                <option key={value || "empty"} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium text-foreground">
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
          <label className="space-y-1 text-xs font-medium text-foreground">
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
          <label className="space-y-1 text-xs font-medium text-foreground">
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
          <label className="space-y-1 text-xs font-medium text-foreground">
            Effective Start
            <Input
              defaultValue={fund.effective_start_date ?? ""}
              name="effectiveStartDate"
              type="date"
            />
          </label>
          <label className="space-y-1 text-xs font-medium text-foreground">
            Effective End
            <Input
              defaultValue={fund.effective_end_date ?? ""}
              name="effectiveEndDate"
              type="date"
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button disabled={pending} size="sm" type="submit">
            {pending ? "Saving..." : "Save"}
          </Button>
          <span className="text-xs text-muted-foreground">
            Updates saved fund setup only.
          </span>
        </div>
        {state.message ? (
          <p
            className={
              state.status === "error"
                ? "rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1 text-xs text-destructive"
                : "rounded-md border border-border bg-muted px-2 py-1 text-xs text-foreground"
            }
          >
            {state.message}
          </p>
        ) : null}
      </form>
    </details>
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
