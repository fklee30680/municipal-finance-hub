"use server";

import { revalidatePath } from "next/cache";

import { ensureAppUserForAuthUser } from "@/lib/auth/app-user";
import { requireUser } from "@/lib/auth/session";
import {
  buildFiscalYearDraft,
  buildMonthlyFiscalPeriods,
  defaultFiscalCalendarDefaults,
  parseActiveStatus,
  parseCheckbox,
  parseCloseStatus,
  parseInteger,
  parseString,
  type FiscalActiveStatus,
  type FiscalCalendarDefaults,
  type FiscalCloseStatus,
  type FiscalPeriodDraft,
  type FiscalYearDraft
} from "@/lib/setup/fiscal-calendar";
import {
  initialFiscalSetupActionState,
  type FiscalSetupActionState
} from "@/lib/setup/fiscal-setup-state";
import { createAdminClient } from "@/lib/supabase/admin";

type FiscalYearRecord = {
  fiscal_year_id: string;
  fiscal_year: number;
};

export async function saveFiscalDefaultsAction(
  _previousState: FiscalSetupActionState,
  formData: FormData
): Promise<FiscalSetupActionState> {
  try {
    const { adminClient, appUser } = await getActionContext();
    const currentFiscalYear = parseString(formData.get("currentFiscalYear"));
    const defaults = parseDefaults(formData);

    const result = await adminClient
      .from("organization_settings")
      .upsert(
        {
          organization_id: appUser.organization_id,
          organization_display_name:
            parseString(formData.get("organizationDisplayName")) || "Municipal Finance Organization",
          current_fiscal_year: currentFiscalYear || null,
          fiscal_year_start_month: defaults.fiscalYearStartMonth,
          fiscal_year_start_day: defaults.fiscalYearStartDay,
          fiscal_year_end_month: defaults.fiscalYearEndMonth,
          fiscal_year_end_day: defaults.fiscalYearEndDay,
          enable_period_0: defaults.includePeriod0,
          enable_period_13: defaults.includePeriod13,
          period_0_label: defaults.period0Label,
          period_13_label: defaults.period13Label,
          standard_period_count: 12,
          updated_at: new Date().toISOString()
        },
        {
          onConflict: "organization_id"
        }
      );

    if (result.error) {
      throw new Error(result.error.message);
    }

    revalidateFiscalSetup();

    return {
      ...initialFiscalSetupActionState,
      message: "Fiscal defaults saved.",
      status: "success"
    };
  } catch (error) {
    return errorState(error, "Fiscal defaults could not be saved.");
  }
}

export async function createFiscalYearAction(
  _previousState: FiscalSetupActionState,
  formData: FormData
): Promise<FiscalSetupActionState> {
  try {
    const { adminClient, appUser } = await getActionContext();
    const fiscalYear = parseInteger(formData.get("fiscalYear"));

    if (!fiscalYear) {
      return errorMessage("Fiscal year is required.");
    }

    const yearDraft: FiscalYearDraft = {
      activeStatus: parseActiveStatus(formData.get("activeStatus")),
      closeStatus: parseCloseStatus(formData.get("closeStatus")),
      endDate: parseString(formData.get("endDate")),
      fiscalYear,
      fiscalYearLabel: parseString(formData.get("fiscalYearLabel")) || `FY ${fiscalYear}`,
      startDate: parseString(formData.get("startDate"))
    };

    if (!yearDraft.startDate || !yearDraft.endDate) {
      return errorMessage("Start date and end date are required.");
    }

    const summary = await createYearAndMissingPeriods({
      activeStatus: yearDraft.activeStatus,
      adminClient,
      closeStatus: yearDraft.closeStatus,
      defaults: {
        ...defaultFiscalCalendarDefaults,
        fiscalYearEndDay: getUtcDay(yearDraft.endDate),
        fiscalYearEndMonth: getUtcMonth(yearDraft.endDate),
        fiscalYearStartDay: getUtcDay(yearDraft.startDate),
        fiscalYearStartMonth: getUtcMonth(yearDraft.startDate),
        includePeriod0: parseCheckbox(formData.get("includePeriod0")),
        includePeriod13: parseCheckbox(formData.get("includePeriod13")),
        period0Label:
          parseString(formData.get("period0Label")) ||
          defaultFiscalCalendarDefaults.period0Label,
        period13Label:
          parseString(formData.get("period13Label")) ||
          defaultFiscalCalendarDefaults.period13Label
      },
      fiscalYear,
      fiscalYearLabel: yearDraft.fiscalYearLabel,
      organizationId: appUser.organization_id,
      yearDraft
    });

    revalidateFiscalSetup();

    return {
      ...initialFiscalSetupActionState,
      message: `Fiscal year ${fiscalYear} processed.`,
      status: "success",
      summary
    };
  } catch (error) {
    return errorState(error, "Fiscal year could not be created.");
  }
}

export async function generateFiscalYearRangeAction(
  _previousState: FiscalSetupActionState,
  formData: FormData
): Promise<FiscalSetupActionState> {
  try {
    const { adminClient, appUser } = await getActionContext();
    const startFiscalYear = parseInteger(formData.get("startFiscalYear"));
    const endFiscalYear = parseInteger(formData.get("endFiscalYear"));

    if (!startFiscalYear || !endFiscalYear) {
      return errorMessage("Start and end fiscal years are required.");
    }

    if (startFiscalYear > endFiscalYear) {
      return errorMessage("Start fiscal year cannot be greater than end fiscal year.");
    }

    const defaults = parseDefaults(formData);
    const closeStatus = parseCloseStatus(formData.get("closeStatus"));
    const activeStatus = parseActiveStatus(formData.get("activeStatus"));
    const summary = emptySummary();

    for (let fiscalYear = startFiscalYear; fiscalYear <= endFiscalYear; fiscalYear += 1) {
      const yearSummary = await createYearAndMissingPeriods({
        activeStatus,
        adminClient,
        closeStatus,
        defaults,
        fiscalYear,
        fiscalYearLabel: `FY ${fiscalYear}`,
        organizationId: appUser.organization_id
      });
      mergeSummary(summary, yearSummary);
    }

    revalidateFiscalSetup();

    return {
      ...initialFiscalSetupActionState,
      message: `Fiscal years ${startFiscalYear} through ${endFiscalYear} processed.`,
      status: "success",
      summary
    };
  } catch (error) {
    return errorState(error, "Fiscal year range could not be generated.");
  }
}

export async function generateMissingPeriodsAction(
  _previousState: FiscalSetupActionState,
  formData: FormData
): Promise<FiscalSetupActionState> {
  try {
    const { adminClient, appUser } = await getActionContext();
    const fiscalYear = parseInteger(formData.get("fiscalYear"));

    if (!fiscalYear) {
      return errorMessage("Fiscal year is required.");
    }

    const defaults = parseDefaults(formData);
    const closeStatus = parseCloseStatus(formData.get("closeStatus"));
    const activeStatus = parseActiveStatus(formData.get("activeStatus"));
    const summary = await createYearAndMissingPeriods({
      activeStatus,
      adminClient,
      closeStatus,
      defaults,
      fiscalYear,
      fiscalYearLabel: `FY ${fiscalYear}`,
      organizationId: appUser.organization_id
    });

    revalidateFiscalSetup();

    return {
      ...initialFiscalSetupActionState,
      message: `Missing periods for FY ${fiscalYear} processed.`,
      status: "success",
      summary
    };
  } catch (error) {
    return errorState(error, "Missing periods could not be generated.");
  }
}

export async function generateMissingPeriodsFormAction(formData: FormData) {
  await generateMissingPeriodsAction(initialFiscalSetupActionState, formData);
}

export async function deactivateFiscalYearAction(
  _previousState: FiscalSetupActionState,
  formData: FormData
): Promise<FiscalSetupActionState> {
  try {
    const { adminClient, appUser } = await getActionContext();
    const fiscalYearId = parseString(formData.get("fiscalYearId"));

    if (!fiscalYearId) {
      return errorMessage("Fiscal year is required.");
    }

    await assertNoFiscalYearDependencies({
      adminClient,
      fiscalYearId,
      organizationId: appUser.organization_id
    });

    const result = await adminClient
      .from("fiscal_years")
      .update({
        active_status: "inactive",
        updated_at: new Date().toISOString()
      })
      .eq("organization_id", appUser.organization_id)
      .eq("fiscal_year_id", fiscalYearId);

    if (result.error) {
      throw new Error(result.error.message);
    }

    revalidateFiscalSetup();

    return {
      ...initialFiscalSetupActionState,
      message: "Fiscal year marked inactive.",
      status: "success"
    };
  } catch (error) {
    return errorState(error, "Fiscal year could not be deactivated.");
  }
}

export async function deactivateFiscalYearFormAction(formData: FormData) {
  await deactivateFiscalYearAction(initialFiscalSetupActionState, formData);
}

export async function deactivateFiscalPeriodAction(
  _previousState: FiscalSetupActionState,
  formData: FormData
): Promise<FiscalSetupActionState> {
  try {
    const { adminClient, appUser } = await getActionContext();
    const fiscalPeriodId = parseString(formData.get("fiscalPeriodId"));

    if (!fiscalPeriodId) {
      return errorMessage("Fiscal period is required.");
    }

    await assertNoFiscalPeriodDependencies({
      adminClient,
      fiscalPeriodId,
      organizationId: appUser.organization_id
    });

    const result = await adminClient
      .from("fiscal_periods")
      .update({
        active_status: "inactive",
        updated_at: new Date().toISOString()
      })
      .eq("organization_id", appUser.organization_id)
      .eq("fiscal_period_id", fiscalPeriodId);

    if (result.error) {
      throw new Error(result.error.message);
    }

    revalidateFiscalSetup();

    return {
      ...initialFiscalSetupActionState,
      message: "Fiscal period marked inactive.",
      status: "success"
    };
  } catch (error) {
    return errorState(error, "Fiscal period could not be deactivated.");
  }
}

export async function deactivateFiscalPeriodFormAction(formData: FormData) {
  await deactivateFiscalPeriodAction(initialFiscalSetupActionState, formData);
}

export async function updateFiscalYearFormAction(formData: FormData) {
  const { adminClient, appUser } = await getActionContext();
  const fiscalYearId = parseString(formData.get("fiscalYearId"));
  const fiscalYearLabel = parseString(formData.get("fiscalYearLabel"));

  if (!fiscalYearId || !fiscalYearLabel) {
    throw new Error("Fiscal year and label are required.");
  }

  const result = await adminClient
    .from("fiscal_years")
    .update({
      active_status: parseActiveStatus(formData.get("activeStatus")),
      close_status: parseCloseStatus(formData.get("closeStatus")),
      fiscal_year_label: fiscalYearLabel,
      updated_at: new Date().toISOString()
    })
    .eq("organization_id", appUser.organization_id)
    .eq("fiscal_year_id", fiscalYearId);

  if (result.error) {
    throw new Error(result.error.message);
  }

  revalidateFiscalSetup();
}

export async function updateFiscalPeriodFormAction(formData: FormData) {
  const { adminClient, appUser } = await getActionContext();
  const fiscalPeriodId = parseString(formData.get("fiscalPeriodId"));
  const periodName = parseString(formData.get("periodName"));

  if (!fiscalPeriodId || !periodName) {
    throw new Error("Fiscal period and period name are required.");
  }

  const result = await adminClient
    .from("fiscal_periods")
    .update({
      active_status: parseActiveStatus(formData.get("activeStatus")),
      close_status: parseCloseStatus(formData.get("closeStatus")),
      period_name: periodName,
      updated_at: new Date().toISOString()
    })
    .eq("organization_id", appUser.organization_id)
    .eq("fiscal_period_id", fiscalPeriodId);

  if (result.error) {
    throw new Error(result.error.message);
  }

  revalidateFiscalSetup();
}

async function createYearAndMissingPeriods({
  activeStatus,
  adminClient,
  closeStatus,
  defaults,
  fiscalYear,
  fiscalYearLabel,
  organizationId,
  yearDraft
}: {
  activeStatus: FiscalActiveStatus;
  adminClient: ReturnType<typeof createAdminClient>;
  closeStatus: FiscalCloseStatus;
  defaults: FiscalCalendarDefaults;
  fiscalYear: number;
  fiscalYearLabel: string;
  organizationId: string;
  yearDraft?: FiscalYearDraft;
}) {
  const summary = emptySummary();
  const existingYear = await loadFiscalYear({
    adminClient,
    fiscalYear,
    organizationId
  });
  let fiscalYearRecord = existingYear;

  if (!fiscalYearRecord) {
    const generatedYear =
      yearDraft ??
      buildFiscalYearDraft({
        ...defaults,
        activeStatus,
        closeStatus,
        fiscalYear,
        fiscalYearLabel
      });
    const insertResult = await adminClient
      .from("fiscal_years")
      .insert({
        active_status: generatedYear.activeStatus,
        close_status: generatedYear.closeStatus,
        end_date: generatedYear.endDate,
        fiscal_year: generatedYear.fiscalYear,
        fiscal_year_label: generatedYear.fiscalYearLabel,
        organization_id: organizationId,
        start_date: generatedYear.startDate
      })
      .select("fiscal_year_id, fiscal_year")
      .single<FiscalYearRecord>();

    if (insertResult.error) {
      throw new Error(insertResult.error.message);
    }

    fiscalYearRecord = insertResult.data;
    summary.fiscalYearsCreated += 1;
  } else {
    summary.fiscalYearsSkipped += 1;
  }

  const periodDrafts = buildMonthlyFiscalPeriods({
    ...defaults,
    activeStatus,
    closeStatus,
    fiscalYear
  });

  for (const periodDraft of periodDrafts) {
    const existingPeriod = await loadFiscalPeriod({
      adminClient,
      fiscalYear,
      organizationId,
      period: periodDraft.period
    });

    if (existingPeriod) {
      summary.periodsSkipped += 1;
      continue;
    }

    await insertFiscalPeriod({
      adminClient,
      fiscalPeriod: periodDraft,
      fiscalYearId: fiscalYearRecord.fiscal_year_id,
      organizationId
    });
    summary.periodsCreated += 1;
  }

  return summary;
}

async function insertFiscalPeriod({
  adminClient,
  fiscalPeriod,
  fiscalYearId,
  organizationId
}: {
  adminClient: ReturnType<typeof createAdminClient>;
  fiscalPeriod: FiscalPeriodDraft;
  fiscalYearId: string;
  organizationId: string;
}) {
  const result = await adminClient.from("fiscal_periods").insert({
    active_status: fiscalPeriod.activeStatus,
    close_status: fiscalPeriod.closeStatus,
    end_date: fiscalPeriod.endDate,
    fiscal_year: fiscalPeriod.fiscalYear,
    fiscal_year_id: fiscalYearId,
    organization_id: organizationId,
    period: fiscalPeriod.period,
    period_name: fiscalPeriod.periodName,
    start_date: fiscalPeriod.startDate
  });

  if (result.error) {
    throw new Error(result.error.message);
  }
}

async function loadFiscalYear({
  adminClient,
  fiscalYear,
  organizationId
}: {
  adminClient: ReturnType<typeof createAdminClient>;
  fiscalYear: number;
  organizationId: string;
}) {
  const result = await adminClient
    .from("fiscal_years")
    .select("fiscal_year_id, fiscal_year")
    .eq("organization_id", organizationId)
    .eq("fiscal_year", fiscalYear)
    .maybeSingle<FiscalYearRecord>();

  if (result.error) {
    throw new Error(result.error.message);
  }

  return result.data ?? null;
}

async function loadFiscalPeriod({
  adminClient,
  fiscalYear,
  organizationId,
  period
}: {
  adminClient: ReturnType<typeof createAdminClient>;
  fiscalYear: number;
  organizationId: string;
  period: number;
}) {
  const result = await adminClient
    .from("fiscal_periods")
    .select("fiscal_period_id")
    .eq("organization_id", organizationId)
    .eq("fiscal_year", fiscalYear)
    .eq("period", period)
    .maybeSingle<{ fiscal_period_id: string }>();

  if (result.error) {
    throw new Error(result.error.message);
  }

  return result.data ?? null;
}

async function assertNoFiscalYearDependencies({
  adminClient,
  fiscalYearId,
  organizationId
}: {
  adminClient: ReturnType<typeof createAdminClient>;
  fiscalYearId: string;
  organizationId: string;
}) {
  const [importBatches, postedLines] = await Promise.all([
    adminClient
      .from("import_batches")
      .select("import_batch_id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("fiscal_year_id", fiscalYearId),
    adminClient
      .from("trial_balance_lines")
      .select("trial_balance_line_id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("is_active_for_reporting", true)
      .eq("fiscal_year_id", fiscalYearId)
  ]);

  if (importBatches.error) {
    throw new Error(importBatches.error.message);
  }

  if (postedLines.error) {
    throw new Error(postedLines.error.message);
  }

  if ((importBatches.count ?? 0) > 0 || (postedLines.count ?? 0) > 0) {
    throw new Error("Fiscal year has dependent imports or posted trial balance rows and cannot be deactivated.");
  }
}

async function assertNoFiscalPeriodDependencies({
  adminClient,
  fiscalPeriodId,
  organizationId
}: {
  adminClient: ReturnType<typeof createAdminClient>;
  fiscalPeriodId: string;
  organizationId: string;
}) {
  const [importBatches, postedLines] = await Promise.all([
    adminClient
      .from("import_batches")
      .select("import_batch_id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("fiscal_period_id", fiscalPeriodId),
    adminClient
      .from("trial_balance_lines")
      .select("trial_balance_line_id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("is_active_for_reporting", true)
      .eq("fiscal_period_id", fiscalPeriodId)
  ]);

  if (importBatches.error) {
    throw new Error(importBatches.error.message);
  }

  if (postedLines.error) {
    throw new Error(postedLines.error.message);
  }

  if ((importBatches.count ?? 0) > 0 || (postedLines.count ?? 0) > 0) {
    throw new Error("Fiscal period has dependent imports or posted trial balance rows and cannot be deactivated.");
  }
}

function parseDefaults(formData: FormData): FiscalCalendarDefaults {
  return {
    fiscalYearEndDay: parseInteger(
      formData.get("fiscalYearEndDay"),
      defaultFiscalCalendarDefaults.fiscalYearEndDay
    ),
    fiscalYearEndMonth: parseInteger(
      formData.get("fiscalYearEndMonth"),
      defaultFiscalCalendarDefaults.fiscalYearEndMonth
    ),
    fiscalYearStartDay: parseInteger(
      formData.get("fiscalYearStartDay"),
      defaultFiscalCalendarDefaults.fiscalYearStartDay
    ),
    fiscalYearStartMonth: parseInteger(
      formData.get("fiscalYearStartMonth"),
      defaultFiscalCalendarDefaults.fiscalYearStartMonth
    ),
    includePeriod0: parseCheckbox(formData.get("includePeriod0")),
    includePeriod13: parseCheckbox(formData.get("includePeriod13")),
    period0Label:
      parseString(formData.get("period0Label")) ||
      defaultFiscalCalendarDefaults.period0Label,
    period13Label:
      parseString(formData.get("period13Label")) ||
      defaultFiscalCalendarDefaults.period13Label
  };
}

async function getActionContext() {
  const authUser = await requireUser();
  const adminClient = createAdminClient();
  const appUser = await ensureAppUserForAuthUser(adminClient, authUser);

  return {
    adminClient,
    appUser
  };
}

function revalidateFiscalSetup() {
  revalidatePath("/setup/fiscal-years");
  revalidatePath("/settings");
  revalidatePath("/settings/setup");
}

function emptySummary() {
  return {
    errors: [] as string[],
    fiscalYearsCreated: 0,
    fiscalYearsSkipped: 0,
    periodsCreated: 0,
    periodsSkipped: 0
  };
}

function mergeSummary(target: ReturnType<typeof emptySummary>, source: ReturnType<typeof emptySummary>) {
  target.fiscalYearsCreated += source.fiscalYearsCreated;
  target.fiscalYearsSkipped += source.fiscalYearsSkipped;
  target.periodsCreated += source.periodsCreated;
  target.periodsSkipped += source.periodsSkipped;
  target.errors.push(...source.errors);
}

function getUtcMonth(value: string) {
  return new Date(`${value}T00:00:00.000Z`).getUTCMonth() + 1;
}

function getUtcDay(value: string) {
  return new Date(`${value}T00:00:00.000Z`).getUTCDate();
}

function errorState(error: unknown, fallbackMessage: string): FiscalSetupActionState {
  return errorMessage(error instanceof Error ? error.message : fallbackMessage);
}

function errorMessage(message: string): FiscalSetupActionState {
  return {
    status: "error",
    message
  };
}
