"use client";

import type { ReactNode } from "react";
import { useActionState } from "react";

import {
  createFiscalYearAction,
  generateFiscalYearRangeAction,
  saveFiscalDefaultsAction
} from "@/app/setup/fiscal-years/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { initialFiscalSetupActionState } from "@/lib/setup/fiscal-setup-state";

type FiscalDefaults = {
  currentFiscalYear: string;
  fiscalYearStartMonth: number;
  fiscalYearStartDay: number;
  fiscalYearEndMonth: number;
  fiscalYearEndDay: number;
  includePeriod0: boolean;
  includePeriod13: boolean;
  period0Label: string;
  period13Label: string;
  organizationDisplayName: string;
};

export function FiscalDefaultsForm({ defaults }: { defaults: FiscalDefaults }) {
  const [state, formAction, isPending] = useActionState(
    saveFiscalDefaultsAction,
    initialFiscalSetupActionState
  );

  return (
    <form action={formAction} className="space-y-4">
      <input
        name="organizationDisplayName"
        type="hidden"
        value={defaults.organizationDisplayName}
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Field label="Current Fiscal Year">
          <Input
            defaultValue={defaults.currentFiscalYear}
            name="currentFiscalYear"
            placeholder="2026"
            type="number"
          />
        </Field>
        <Field label="Fiscal Year Start Month">
          <Input
            defaultValue={defaults.fiscalYearStartMonth}
            max={12}
            min={1}
            name="fiscalYearStartMonth"
            type="number"
          />
        </Field>
        <Field label="Fiscal Year Start Day">
          <Input
            defaultValue={defaults.fiscalYearStartDay}
            max={31}
            min={1}
            name="fiscalYearStartDay"
            type="number"
          />
        </Field>
        <Field label="Fiscal Year End Month">
          <Input
            defaultValue={defaults.fiscalYearEndMonth}
            max={12}
            min={1}
            name="fiscalYearEndMonth"
            type="number"
          />
        </Field>
        <Field label="Fiscal Year End Day">
          <Input
            defaultValue={defaults.fiscalYearEndDay}
            max={31}
            min={1}
            name="fiscalYearEndDay"
            type="number"
          />
        </Field>
        <Field label="Default Period 0 Label">
          <Input defaultValue={defaults.period0Label} name="period0Label" />
        </Field>
        <Field label="Default Period 13 Label">
          <Input defaultValue={defaults.period13Label} name="period13Label" />
        </Field>
      </div>
      <CheckboxRow
        items={[
          {
            defaultChecked: defaults.includePeriod0,
            label: "Allow Period 0",
            name: "includePeriod0"
          },
          {
            defaultChecked: defaults.includePeriod13,
            label: "Allow Period 13",
            name: "includePeriod13"
          }
        ]}
      />
      <Button disabled={isPending} type="submit">
        {isPending ? "Saving..." : "Save Fiscal Defaults"}
      </Button>
      <ActionMessage state={state} />
    </form>
  );
}

export function CreateFiscalYearForm({
  defaults,
  nextFiscalYear
}: {
  defaults: FiscalDefaults;
  nextFiscalYear: number;
}) {
  const [state, formAction, isPending] = useActionState(
    createFiscalYearAction,
    initialFiscalSetupActionState
  );
  const startYear =
    defaults.fiscalYearStartMonth > defaults.fiscalYearEndMonth
      ? nextFiscalYear - 1
      : nextFiscalYear;
  const startDate = makeDateString(
    startYear,
    defaults.fiscalYearStartMonth,
    defaults.fiscalYearStartDay
  );
  const endDate = makeDateString(
    nextFiscalYear,
    defaults.fiscalYearEndMonth,
    defaults.fiscalYearEndDay
  );

  return (
    <form action={formAction} className="space-y-4">
      <input name="fiscalYearStartMonth" type="hidden" value={defaults.fiscalYearStartMonth} />
      <input name="fiscalYearStartDay" type="hidden" value={defaults.fiscalYearStartDay} />
      <input name="fiscalYearEndMonth" type="hidden" value={defaults.fiscalYearEndMonth} />
      <input name="fiscalYearEndDay" type="hidden" value={defaults.fiscalYearEndDay} />
      <input name="period0Label" type="hidden" value={defaults.period0Label} />
      <input name="period13Label" type="hidden" value={defaults.period13Label} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Field label="Fiscal Year">
          <Input defaultValue={nextFiscalYear} name="fiscalYear" type="number" />
        </Field>
        <Field label="Fiscal Year Label">
          <Input defaultValue={`FY ${nextFiscalYear}`} name="fiscalYearLabel" />
        </Field>
        <Field label="Start Date">
          <Input defaultValue={startDate} name="startDate" type="date" />
        </Field>
        <Field label="End Date">
          <Input defaultValue={endDate} name="endDate" type="date" />
        </Field>
        <Field label="Close Status">
          <StatusSelect name="closeStatus" options={["open", "soft_closed", "closed"]} />
        </Field>
        <Field label="Active Status">
          <StatusSelect name="activeStatus" options={["active", "inactive"]} />
        </Field>
      </div>
      <CheckboxRow
        items={[
          {
            defaultChecked: defaults.includePeriod0,
            label: "Include Period 0",
            name: "includePeriod0"
          },
          {
            defaultChecked: defaults.includePeriod13,
            label: "Include Period 13",
            name: "includePeriod13"
          }
        ]}
      />
      <Button disabled={isPending} type="submit">
        {isPending ? "Creating..." : "Create Fiscal Year"}
      </Button>
      <ActionMessage state={state} />
    </form>
  );
}

export function GenerateFiscalYearRangeForm({
  defaults,
  startFiscalYear
}: {
  defaults: FiscalDefaults;
  startFiscalYear: number;
}) {
  const [state, formAction, isPending] = useActionState(
    generateFiscalYearRangeAction,
    initialFiscalSetupActionState
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Field label="Start Fiscal Year">
          <Input defaultValue={startFiscalYear} name="startFiscalYear" type="number" />
        </Field>
        <Field label="End Fiscal Year">
          <Input defaultValue={startFiscalYear} name="endFiscalYear" type="number" />
        </Field>
        <Field label="Fiscal Year Start Month">
          <Input defaultValue={defaults.fiscalYearStartMonth} name="fiscalYearStartMonth" type="number" />
        </Field>
        <Field label="Fiscal Year Start Day">
          <Input defaultValue={defaults.fiscalYearStartDay} name="fiscalYearStartDay" type="number" />
        </Field>
        <Field label="Fiscal Year End Month">
          <Input defaultValue={defaults.fiscalYearEndMonth} name="fiscalYearEndMonth" type="number" />
        </Field>
        <Field label="Fiscal Year End Day">
          <Input defaultValue={defaults.fiscalYearEndDay} name="fiscalYearEndDay" type="number" />
        </Field>
        <Field label="Default Close Status">
          <StatusSelect name="closeStatus" options={["open", "soft_closed", "closed"]} />
        </Field>
        <Field label="Default Active Status">
          <StatusSelect name="activeStatus" options={["active", "inactive"]} />
        </Field>
        <Field label="Period 0 Label">
          <Input defaultValue={defaults.period0Label} name="period0Label" />
        </Field>
        <Field label="Period 13 Label">
          <Input defaultValue={defaults.period13Label} name="period13Label" />
        </Field>
      </div>
      <CheckboxRow
        items={[
          {
            defaultChecked: defaults.includePeriod0,
            label: "Include Period 0",
            name: "includePeriod0"
          },
          {
            defaultChecked: defaults.includePeriod13,
            label: "Include Period 13",
            name: "includePeriod13"
          }
        ]}
      />
      <Button disabled={isPending} type="submit">
        {isPending ? "Generating..." : "Generate Fiscal Years"}
      </Button>
      <ActionMessage state={state} />
    </form>
  );
}

function Field({
  children,
  label
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <label className="block space-y-2 text-sm">
      <span className="font-medium text-foreground">{label}</span>
      {children}
    </label>
  );
}

function CheckboxRow({
  items
}: {
  items: Array<{
    defaultChecked: boolean;
    label: string;
    name: string;
  }>;
}) {
  return (
    <div className="grid gap-3 text-sm md:grid-cols-2">
      {items.map((item) => (
        <label className="flex items-center gap-2" key={item.name}>
          <input
            className="h-4 w-4 rounded border-border"
            defaultChecked={item.defaultChecked}
            name={item.name}
            type="checkbox"
          />
          <span className="text-muted-foreground">{item.label}</span>
        </label>
      ))}
    </div>
  );
}

function StatusSelect({
  name,
  options
}: {
  name: string;
  options: string[];
}) {
  return (
    <select
      className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      defaultValue={options[0]}
      name={name}
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

function ActionMessage({
  state
}: {
  state: typeof initialFiscalSetupActionState;
}) {
  if (!state.message) {
    return null;
  }

  return (
    <div
      className={
        state.status === "error"
          ? "rounded-md border border-border bg-muted px-3 py-2 text-sm text-destructive"
          : "rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground"
      }
    >
      <p>{state.message}</p>
      {state.summary ? (
        <p className="mt-1">
          Years created: {state.summary.fiscalYearsCreated ?? 0}. Years skipped:{" "}
          {state.summary.fiscalYearsSkipped ?? 0}. Periods created:{" "}
          {state.summary.periodsCreated ?? 0}. Periods skipped:{" "}
          {state.summary.periodsSkipped ?? 0}.
        </p>
      ) : null}
    </div>
  );
}

function makeDateString(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
