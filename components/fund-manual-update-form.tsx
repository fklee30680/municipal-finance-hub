"use client";

import { Ban, Pencil, Plus, RotateCcw, X } from "lucide-react";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  createFundManualAction,
  setFundManualStatusAction,
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
  include_in_cash_reconciliation: boolean;
  include_in_standard_reporting: boolean;
  major_fund_flag: string | null;
  reporting_exclusion_reason: string | null;
  reporting_model: string | null;
  reporting_treatment: string;
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

const defaultFundGroups = [
  "General Government",
  "Special Revenue",
  "Capital Projects",
  "Debt Service",
  "Permanent",
  "Enterprise",
  "Internal Service",
  "Fiduciary",
  "Component Unit",
  "Grant Funds",
  "Other"
] as const;

const reportingTreatments = [
  ["reportable", "Reportable"],
  ["pooled_cash", "Pooled Cash"],
  ["reconciliation_only", "Reconciliation Only"],
  ["clearing", "Clearing"],
  ["elimination", "Elimination"],
  ["internal_service", "Internal Service"],
  ["fiduciary_excluded", "Fiduciary Excluded"],
  ["other_excluded", "Other Excluded"]
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
  const fundGroupOptions = buildFundGroupOptions(fund.fund_group, fundGroups);
  const [reportingTreatment, setReportingTreatment] = useState(
    fund.reporting_treatment ?? "reportable"
  );
  const [standardReporting, setStandardReporting] = useState(
    fund.include_in_standard_reporting ? "true" : "false"
  );
  const [cashReconciliation, setCashReconciliation] = useState(
    fund.include_in_cash_reconciliation ? "true" : "false"
  );

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
              <select
                className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                defaultValue={fund.fund_group ?? ""}
                name="fundGroup"
              >
                <option value="">Not set</option>
                {fundGroupOptions.map((group) => (
                  <option key={group} value={group}>
                    {group}
                  </option>
                ))}
              </select>
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
              Reporting Treatment
              <select
                className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                name="reportingTreatment"
                onChange={(event) => {
                  const nextTreatment = event.target.value;
                  setReportingTreatment(nextTreatment);
                  const defaults = getTreatmentDefaults(nextTreatment);
                  setStandardReporting(defaults.standardReporting);
                  setCashReconciliation(defaults.cashReconciliation);
                }}
                value={reportingTreatment}
              >
                {reportingTreatments.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm font-medium text-foreground">
              Standard Reporting
              <select
                className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                name="includeInStandardReporting"
                onChange={(event) => setStandardReporting(event.target.value)}
                value={standardReporting}
              >
                <option value="true">Included</option>
                <option value="false">Excluded</option>
              </select>
            </label>

            <label className="space-y-2 text-sm font-medium text-foreground">
              Cash Reconciliation
              <select
                className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                name="includeInCashReconciliation"
                onChange={(event) => setCashReconciliation(event.target.value)}
                value={cashReconciliation}
              >
                <option value="false">No</option>
                <option value="true">Yes</option>
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

            <label className="space-y-2 text-sm font-medium text-foreground md:col-span-2">
              Reporting Exclusion Reason
              <textarea
                className="min-h-20 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                defaultValue={fund.reporting_exclusion_reason ?? ""}
                name="reportingExclusionReason"
                placeholder="Example: Pooled cash fund used for consolidated cash and reconciliation only."
              />
            </label>
          </div>

          <div className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
            Active Status means the fund code is valid and usable. Reporting
            Treatment and inclusion flags control whether it appears in normal
            reporting or cash reconciliation workflows.
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

export function FundManualCreateForm({
  defaultFundCode = "",
  fundGroups,
  initialOpen = false
}: {
  defaultFundCode?: string;
  fundGroups: string[];
  initialOpen?: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fundCodeRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const titleId = useId();
  const [state, formAction, pending] = useActionState(
    createFundManualAction,
    initialState
  );
  const fundGroupOptions = buildFundGroupOptions(null, fundGroups);
  const [reportingTreatment, setReportingTreatment] = useState("reportable");
  const [standardReporting, setStandardReporting] = useState("true");
  const [cashReconciliation, setCashReconciliation] = useState("false");

  useEffect(() => {
    if (initialOpen && dialogRef.current && !dialogRef.current.open) {
      dialogRef.current.showModal();
      window.requestAnimationFrame(() => fundCodeRef.current?.focus());
    }
  }, [initialOpen]);

  useEffect(() => {
    if (state.status === "success") {
      dialogRef.current?.close();
      router.refresh();
    }
  }, [router, state.status]);

  return (
    <>
      <button
        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring"
        onClick={() => {
          dialogRef.current?.showModal();
          window.requestAnimationFrame(() => fundCodeRef.current?.focus());
        }}
        type="button"
      >
        <Plus aria-hidden="true" className="h-4 w-4" />
        Add Fund
      </button>

      <dialog
        aria-labelledby={titleId}
        className="w-[min(760px,calc(100vw-32px))] rounded-md border border-border bg-background p-0 text-foreground shadow-xl backdrop:bg-black/40"
        ref={dialogRef}
      >
        <form method="dialog">
          <button
            aria-label="Close fund create form"
            className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
            type="submit"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </form>

        <div className="border-b border-border px-6 py-5">
          <p className="text-xs font-medium uppercase tracking-wide text-primary">
            Manual Fund Create
          </p>
          <h3 className="mt-1 text-xl font-semibold text-foreground" id={titleId}>
            Add Fund
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Create one active fund without preparing an import file. Fund codes
            are preserved as text, including leading zeros.
          </p>
        </div>

        <form action={formAction} className="space-y-5 px-6 py-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm font-medium text-foreground">
              Fund Code
              <input
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                defaultValue={defaultFundCode}
                name="fundCode"
                ref={fundCodeRef}
                required
              />
            </label>

            <label className="space-y-2 text-sm font-medium text-foreground">
              Fund Name
              <Input name="fundName" required />
            </label>

            <label className="space-y-2 text-sm font-medium text-foreground">
              Fund Type
              <Input name="fundType" />
            </label>

            <label className="space-y-2 text-sm font-medium text-foreground">
              Reporting Model
              <select
                className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                name="reportingModel"
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
              <select
                className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                name="fundGroup"
              >
                <option value="">Not set</option>
                {fundGroupOptions.map((group) => (
                  <option key={group} value={group}>
                    {group}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm font-medium text-foreground">
              Major Fund
              <select
                className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                name="majorFundFlag"
              >
                <option value="">Not set</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </label>

            <label className="space-y-2 text-sm font-medium text-foreground">
              Reporting Treatment
              <select
                className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                name="reportingTreatment"
                onChange={(event) => {
                  const nextTreatment = event.target.value;
                  setReportingTreatment(nextTreatment);
                  const defaults = getTreatmentDefaults(nextTreatment);
                  setStandardReporting(defaults.standardReporting);
                  setCashReconciliation(defaults.cashReconciliation);
                }}
                value={reportingTreatment}
              >
                {reportingTreatments.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm font-medium text-foreground">
              Standard Reporting
              <select
                className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                name="includeInStandardReporting"
                onChange={(event) => setStandardReporting(event.target.value)}
                value={standardReporting}
              >
                <option value="true">Included</option>
                <option value="false">Excluded</option>
              </select>
            </label>

            <label className="space-y-2 text-sm font-medium text-foreground">
              Cash Reconciliation
              <select
                className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                name="includeInCashReconciliation"
                onChange={(event) => setCashReconciliation(event.target.value)}
                value={cashReconciliation}
              >
                <option value="false">No</option>
                <option value="true">Yes</option>
              </select>
            </label>

            <label className="space-y-2 text-sm font-medium text-foreground">
              Active Status
              <select
                className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                defaultValue="active"
                name="activeStatus"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>

            <label className="space-y-2 text-sm font-medium text-foreground">
              Effective Start
              <Input name="effectiveStartDate" type="date" />
            </label>

            <label className="space-y-2 text-sm font-medium text-foreground">
              Effective End
              <Input name="effectiveEndDate" type="date" />
            </label>

            <label className="space-y-2 text-sm font-medium text-foreground md:col-span-2">
              Reporting Exclusion Reason
              <textarea
                className="min-h-20 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                name="reportingExclusionReason"
                placeholder="Example: Pooled cash fund used for consolidated cash and reconciliation only."
              />
            </label>
          </div>

          <div className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
            After adding reference data, rerun validation or calculation so new
            results use the updated setup data.
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

export function FundStatusAction({ fund }: { fund: EditableFund }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    setFundManualStatusAction,
    initialState
  );
  const isInactive = fund.active_status === "inactive";
  const targetStatus = isInactive ? "active" : "inactive";
  const label = isInactive ? "Reactivate" : "Deactivate";
  const Icon = isInactive ? RotateCcw : Ban;

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
    }
  }, [router, state.status]);

  return (
    <form action={formAction} className="space-y-1">
      <input name="fundId" type="hidden" value={fund.fund_id} />
      <input name="targetStatus" type="hidden" value={targetStatus} />
      <button
        className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        <Icon aria-hidden="true" className="h-3.5 w-3.5" />
        {pending ? "Saving..." : label}
      </button>
      {state.status === "error" && state.message ? (
        <p className="max-w-40 text-xs text-destructive">{state.message}</p>
      ) : null}
    </form>
  );
}

function buildFundGroupOptions(currentValue: string | null, existingGroups: string[]) {
  return Array.from(
    new Set(
      [...defaultFundGroups, currentValue, ...existingGroups]
        .map((group) => group?.trim())
        .filter((group): group is string => Boolean(group))
    )
  ).sort((a, b) => a.localeCompare(b));
}

function normalizeMajorFundFlag(value: string | null) {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (["yes", "y", "true", "major", "1"].includes(normalized)) return "yes";
  if (["no", "n", "false", "non_major", "non-major", "0"].includes(normalized)) {
    return "no";
  }
  return "";
}

function getTreatmentDefaults(reportingTreatment: string) {
  if (reportingTreatment === "pooled_cash") {
    return {
      cashReconciliation: "true",
      standardReporting: "false"
    };
  }

  if (
    [
      "reconciliation_only",
      "clearing",
      "elimination",
      "fiduciary_excluded",
      "other_excluded"
    ].includes(reportingTreatment)
  ) {
    return {
      cashReconciliation: "false",
      standardReporting: "false"
    };
  }

  return {
    cashReconciliation: "false",
    standardReporting: "true"
  };
}
