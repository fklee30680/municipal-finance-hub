import Link from "next/link";

import {
  deactivateFiscalPeriodFormAction,
  deactivateFiscalYearFormAction,
  generateMissingPeriodsFormAction,
  updateFiscalPeriodFormAction,
  updateFiscalYearFormAction
} from "@/app/setup/fiscal-years/actions";
import { AppShell } from "@/components/app-shell";
import {
  CreateFiscalYearForm,
  FiscalDefaultsForm,
  GenerateFiscalYearRangeForm
} from "@/components/fiscal-setup-forms";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ensureAppUserForAuthUser } from "@/lib/auth/app-user";
import { requireUser } from "@/lib/auth/session";
import { defaultFiscalCalendarDefaults } from "@/lib/setup/fiscal-calendar";
import { createAdminClient } from "@/lib/supabase/admin";

type Related<T> = T | T[] | null;

type OrganizationRow = {
  organization_id: string;
  organization_name: string;
};

type OrganizationSettingsRow = {
  organization_display_name: string | null;
  current_fiscal_year: string | null;
  fiscal_year_start_month: number | null;
  fiscal_year_start_day: number | null;
  fiscal_year_end_month: number | null;
  fiscal_year_end_day: number | null;
  enable_period_0: boolean | null;
  enable_period_13: boolean | null;
  period_0_label: string | null;
  period_13_label: string | null;
};

type FiscalYearRow = {
  fiscal_year_id: string;
  fiscal_year: number;
  fiscal_year_label: string;
  start_date: string;
  end_date: string;
  close_status: string;
  active_status: string;
  fiscal_periods: Related<Array<{ count: number }>>;
};

type FiscalPeriodRow = {
  fiscal_period_id: string;
  fiscal_year_id: string;
  fiscal_year: number;
  period: number;
  period_name: string;
  start_date: string;
  end_date: string;
  close_status: string;
  active_status: string;
};

export default async function FiscalYearsSetupPage({
  searchParams
}: {
  searchParams: Promise<{ fiscalYear?: string }>;
}) {
  const filters = await searchParams;
  const authUser = await requireUser();
  const adminClient = createAdminClient();
  const appUser = await ensureAppUserForAuthUser(adminClient, authUser);
  const [organizationResult, settingsResult, fiscalYearsResult] = await Promise.all([
    adminClient
      .from("organizations")
      .select("organization_id, organization_name")
      .eq("organization_id", appUser.organization_id)
      .maybeSingle<OrganizationRow>(),
    adminClient
      .from("organization_settings")
      .select(
        "organization_display_name, current_fiscal_year, fiscal_year_start_month, fiscal_year_start_day, fiscal_year_end_month, fiscal_year_end_day, enable_period_0, enable_period_13, period_0_label, period_13_label"
      )
      .eq("organization_id", appUser.organization_id)
      .maybeSingle<OrganizationSettingsRow>(),
    adminClient
      .from("fiscal_years")
      .select(
        "fiscal_year_id, fiscal_year, fiscal_year_label, start_date, end_date, close_status, active_status, fiscal_periods(count)"
      )
      .eq("organization_id", appUser.organization_id)
      .order("fiscal_year", { ascending: false })
      .returns<FiscalYearRow[]>()
  ]);

  if (organizationResult.error) {
    throw new Error(organizationResult.error.message);
  }

  if (settingsResult.error) {
    throw new Error(settingsResult.error.message);
  }

  if (fiscalYearsResult.error) {
    throw new Error(fiscalYearsResult.error.message);
  }

  const organization = organizationResult.data;
  const settings = settingsResult.data;
  const fiscalYears = fiscalYearsResult.data ?? [];
  const selectedFiscalYear =
    Number.parseInt(filters.fiscalYear ?? "", 10) ||
    fiscalYears[0]?.fiscal_year ||
    Number.parseInt(settings?.current_fiscal_year ?? "", 10) ||
    new Date().getFullYear();
  const fiscalPeriodsResult = await adminClient
    .from("fiscal_periods")
    .select(
      "fiscal_period_id, fiscal_year_id, fiscal_year, period, period_name, start_date, end_date, close_status, active_status"
    )
    .eq("organization_id", appUser.organization_id)
    .eq("fiscal_year", selectedFiscalYear)
    .order("period", { ascending: true })
    .returns<FiscalPeriodRow[]>();

  if (fiscalPeriodsResult.error) {
    throw new Error(fiscalPeriodsResult.error.message);
  }

  const defaults = {
    currentFiscalYear: settings?.current_fiscal_year ?? "",
    fiscalYearEndDay:
      settings?.fiscal_year_end_day ??
      defaultFiscalCalendarDefaults.fiscalYearEndDay,
    fiscalYearEndMonth:
      settings?.fiscal_year_end_month ??
      defaultFiscalCalendarDefaults.fiscalYearEndMonth,
    fiscalYearStartDay:
      settings?.fiscal_year_start_day ??
      defaultFiscalCalendarDefaults.fiscalYearStartDay,
    fiscalYearStartMonth:
      settings?.fiscal_year_start_month ??
      defaultFiscalCalendarDefaults.fiscalYearStartMonth,
    includePeriod0:
      settings?.enable_period_0 ??
      defaultFiscalCalendarDefaults.includePeriod0,
    includePeriod13:
      settings?.enable_period_13 ??
      defaultFiscalCalendarDefaults.includePeriod13,
    organizationDisplayName:
      settings?.organization_display_name ??
      organization?.organization_name ??
      "Municipal Finance Organization",
    period0Label:
      settings?.period_0_label ??
      defaultFiscalCalendarDefaults.period0Label,
    period13Label:
      settings?.period_13_label ??
      defaultFiscalCalendarDefaults.period13Label
  };
  const nextFiscalYear =
    fiscalYears.length > 0
      ? Math.max(...fiscalYears.map((year) => year.fiscal_year)) + 1
      : Number.parseInt(defaults.currentFiscalYear, 10) || new Date().getFullYear();
  const fiscalPeriods = fiscalPeriodsResult.data ?? [];

  return (
    <AppShell>
      <section className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-primary">Setup</p>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Fiscal Year Setup
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              Configure fiscal defaults, create years, and generate periods for
              historical, current, and future trial balance imports. Validation
              uses these records before posting is even allowed to think about
              getting cute.
            </p>
          </div>
          <Link
            className="inline-flex items-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
            href="/settings"
          >
            Back to Settings
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Organization Fiscal Defaults</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              These defaults are used when generating fiscal years and periods.
              They can be changed for future generated years.
            </p>
            <FiscalDefaultsForm defaults={defaults} />
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Create Fiscal Year</CardTitle>
            </CardHeader>
            <CardContent>
              <CreateFiscalYearForm
                defaults={defaults}
                nextFiscalYear={nextFiscalYear}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Generate Fiscal Year Range</CardTitle>
            </CardHeader>
            <CardContent>
              <GenerateFiscalYearRangeForm
                defaults={defaults}
                startFiscalYear={
                  Number.parseInt(defaults.currentFiscalYear, 10) ||
                  selectedFiscalYear
                }
              />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Fiscal Years</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {fiscalYears.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No fiscal years have been configured yet. Generate FY 2026 and
                then the validator can stop having a calendar meltdown.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="py-3 pr-4 font-medium">Fiscal Year</th>
                      <th className="py-3 pr-4 font-medium">Label</th>
                      <th className="py-3 pr-4 font-medium">Start Date</th>
                      <th className="py-3 pr-4 font-medium">End Date</th>
                      <th className="py-3 pr-4 font-medium">Close Status</th>
                      <th className="py-3 pr-4 font-medium">Active Status</th>
                      <th className="py-3 pr-4 font-medium">Periods</th>
                      <th className="py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fiscalYears.map((year) => (
                      <tr className="border-b border-border align-top" key={year.fiscal_year_id}>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {year.fiscal_year}
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {year.fiscal_year_label}
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {year.start_date}
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {year.end_date}
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {year.close_status}
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {year.active_status}
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {getPeriodCount(year.fiscal_periods)}
                        </td>
                        <td className="space-y-2 py-3">
                          <Link
                            className="inline-flex rounded-md border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-muted"
                            href={`/setup/fiscal-years?fiscalYear=${year.fiscal_year}`}
                          >
                            View periods
                          </Link>
                          <form action={generateMissingPeriodsFormAction} className="inline-block pl-2">
                            <HiddenDefaults defaults={defaults} />
                            <input name="fiscalYear" type="hidden" value={year.fiscal_year} />
                            <input name="closeStatus" type="hidden" value="open" />
                            <input name="activeStatus" type="hidden" value="active" />
                            <Button size="sm" type="submit" variant="outline">
                              Generate Missing Periods
                            </Button>
                          </form>
                          <form action={deactivateFiscalYearFormAction}>
                            <input
                              name="fiscalYearId"
                              type="hidden"
                              value={year.fiscal_year_id}
                            />
                            <Button size="sm" type="submit" variant="outline">
                              Deactivate Fiscal Year
                            </Button>
                          </form>
                          <form action={updateFiscalYearFormAction} className="space-y-2 rounded-md border border-border p-2">
                            <input
                              name="fiscalYearId"
                              type="hidden"
                              value={year.fiscal_year_id}
                            />
                            <input
                              className="h-9 w-full rounded-md border border-border bg-card px-2 text-xs"
                              defaultValue={year.fiscal_year_label}
                              name="fiscalYearLabel"
                            />
                            <div className="grid gap-2 md:grid-cols-2">
                              <MiniSelect
                                defaultValue={year.close_status}
                                name="closeStatus"
                                options={["open", "soft_closed", "closed"]}
                              />
                              <MiniSelect
                                defaultValue={year.active_status}
                                name="activeStatus"
                                options={["active", "inactive"]}
                              />
                            </div>
                            <Button size="sm" type="submit" variant="outline">
                              Edit Fiscal Year
                            </Button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Selected Fiscal Year Periods</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Showing FY {selectedFiscalYear}. Normal monthly activity is
              Periods 1 through 12. Period 0 and Period 13 are special setup and
              adjustment periods for later workflows.
            </p>
            {fiscalPeriods.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No periods exist for FY {selectedFiscalYear}.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="py-3 pr-4 font-medium">Period</th>
                      <th className="py-3 pr-4 font-medium">Period Name</th>
                      <th className="py-3 pr-4 font-medium">Start Date</th>
                      <th className="py-3 pr-4 font-medium">End Date</th>
                      <th className="py-3 pr-4 font-medium">Close Status</th>
                      <th className="py-3 pr-4 font-medium">Active Status</th>
                      <th className="py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fiscalPeriods.map((period) => (
                      <tr className="border-b border-border align-top" key={period.fiscal_period_id}>
                        <td className="py-3 pr-4 text-muted-foreground">{period.period}</td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {period.period_name}
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {period.start_date}
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {period.end_date}
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {period.close_status}
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {period.active_status}
                        </td>
                        <td className="py-3">
                          <form action={deactivateFiscalPeriodFormAction}>
                            <input
                              name="fiscalPeriodId"
                              type="hidden"
                              value={period.fiscal_period_id}
                            />
                            <Button size="sm" type="submit" variant="outline">
                              Deactivate Period
                            </Button>
                          </form>
                          <form action={updateFiscalPeriodFormAction} className="mt-2 space-y-2 rounded-md border border-border p-2">
                            <input
                              name="fiscalPeriodId"
                              type="hidden"
                              value={period.fiscal_period_id}
                            />
                            <input
                              className="h-9 w-full rounded-md border border-border bg-card px-2 text-xs"
                              defaultValue={period.period_name}
                              name="periodName"
                            />
                            <div className="grid gap-2 md:grid-cols-2">
                              <MiniSelect
                                defaultValue={period.close_status}
                                name="closeStatus"
                                options={["open", "soft_closed", "closed"]}
                              />
                              <MiniSelect
                                defaultValue={period.active_status}
                                name="activeStatus"
                                options={["active", "inactive"]}
                              />
                            </div>
                            <Button size="sm" type="submit" variant="outline">
                              Edit Period
                            </Button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}

function HiddenDefaults({
  defaults
}: {
  defaults: {
    fiscalYearEndDay: number;
    fiscalYearEndMonth: number;
    fiscalYearStartDay: number;
    fiscalYearStartMonth: number;
    includePeriod0: boolean;
    includePeriod13: boolean;
    period0Label: string;
    period13Label: string;
  };
}) {
  return (
    <>
      <input name="fiscalYearStartMonth" type="hidden" value={defaults.fiscalYearStartMonth} />
      <input name="fiscalYearStartDay" type="hidden" value={defaults.fiscalYearStartDay} />
      <input name="fiscalYearEndMonth" type="hidden" value={defaults.fiscalYearEndMonth} />
      <input name="fiscalYearEndDay" type="hidden" value={defaults.fiscalYearEndDay} />
      <input name="period0Label" type="hidden" value={defaults.period0Label} />
      <input name="period13Label" type="hidden" value={defaults.period13Label} />
      {defaults.includePeriod0 ? <input name="includePeriod0" type="hidden" value="true" /> : null}
      {defaults.includePeriod13 ? <input name="includePeriod13" type="hidden" value="true" /> : null}
    </>
  );
}

function getPeriodCount(value: FiscalYearRow["fiscal_periods"]) {
  const record = Array.isArray(value) ? value[0] : value;
  return record && "count" in record ? record.count : 0;
}

function MiniSelect({
  defaultValue,
  name,
  options
}: {
  defaultValue: string;
  name: string;
  options: string[];
}) {
  return (
    <select
      className="h-9 w-full rounded-md border border-border bg-card px-2 text-xs text-foreground"
      defaultValue={defaultValue}
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
