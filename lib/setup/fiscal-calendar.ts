export type FiscalCloseStatus = "open" | "soft_closed" | "closed";
export type FiscalActiveStatus = "active" | "inactive";

export type FiscalCalendarDefaults = {
  fiscalYearStartMonth: number;
  fiscalYearStartDay: number;
  fiscalYearEndMonth: number;
  fiscalYearEndDay: number;
  includePeriod0: boolean;
  includePeriod13: boolean;
  period0Label: string;
  period13Label: string;
};

export type FiscalYearDraft = {
  fiscalYear: number;
  fiscalYearLabel: string;
  startDate: string;
  endDate: string;
  closeStatus: FiscalCloseStatus;
  activeStatus: FiscalActiveStatus;
};

export type FiscalPeriodDraft = {
  fiscalYear: number;
  period: number;
  periodName: string;
  startDate: string;
  endDate: string;
  closeStatus: FiscalCloseStatus;
  activeStatus: FiscalActiveStatus;
};

const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  timeZone: "UTC",
  year: "numeric"
});

export const defaultFiscalCalendarDefaults: FiscalCalendarDefaults = {
  fiscalYearStartMonth: 7,
  fiscalYearStartDay: 1,
  fiscalYearEndMonth: 6,
  fiscalYearEndDay: 30,
  includePeriod0: true,
  includePeriod13: true,
  period0Label: "Opening / Beginning Balance",
  period13Label: "Year-End / Accrual Adjustments"
};

export function calculateFiscalYearDateRange({
  fiscalYear,
  fiscalYearEndDay,
  fiscalYearEndMonth,
  fiscalYearStartDay,
  fiscalYearStartMonth
}: {
  fiscalYear: number;
  fiscalYearEndDay: number;
  fiscalYearEndMonth: number;
  fiscalYearStartDay: number;
  fiscalYearStartMonth: number;
}) {
  assertValidMonthDay(fiscalYearStartMonth, fiscalYearStartDay, "Fiscal year start");
  assertValidMonthDay(fiscalYearEndMonth, fiscalYearEndDay, "Fiscal year end");

  const startYear =
    fiscalYearStartMonth > fiscalYearEndMonth ||
    (fiscalYearStartMonth === fiscalYearEndMonth &&
      fiscalYearStartDay > fiscalYearEndDay)
      ? fiscalYear - 1
      : fiscalYear;
  const endYear = startYear === fiscalYear ? fiscalYear : fiscalYear;
  const startDate = makeUtcDate(startYear, fiscalYearStartMonth, fiscalYearStartDay);
  const endDate = makeUtcDate(endYear, fiscalYearEndMonth, fiscalYearEndDay);

  if (startDate >= endDate) {
    throw new Error("Fiscal year start date must be before the fiscal year end date.");
  }

  return {
    endDate: toDateString(endDate),
    startDate: toDateString(startDate)
  };
}

export function buildFiscalYearDraft({
  activeStatus = "active",
  closeStatus = "open",
  fiscalYear,
  fiscalYearLabel,
  ...defaults
}: FiscalCalendarDefaults & {
  activeStatus?: FiscalActiveStatus;
  closeStatus?: FiscalCloseStatus;
  fiscalYear: number;
  fiscalYearLabel?: string;
}): FiscalYearDraft {
  const range = calculateFiscalYearDateRange({
    fiscalYear,
    fiscalYearEndDay: defaults.fiscalYearEndDay,
    fiscalYearEndMonth: defaults.fiscalYearEndMonth,
    fiscalYearStartDay: defaults.fiscalYearStartDay,
    fiscalYearStartMonth: defaults.fiscalYearStartMonth
  });

  return {
    activeStatus,
    closeStatus,
    endDate: range.endDate,
    fiscalYear,
    fiscalYearLabel: fiscalYearLabel || `FY ${fiscalYear}`,
    startDate: range.startDate
  };
}

export function buildMonthlyFiscalPeriods({
  activeStatus = "active",
  closeStatus = "open",
  fiscalYear,
  fiscalYearEndDay,
  fiscalYearEndMonth,
  fiscalYearStartDay,
  fiscalYearStartMonth,
  includePeriod0,
  includePeriod13,
  period0Label,
  period13Label
}: FiscalCalendarDefaults & {
  activeStatus?: FiscalActiveStatus;
  closeStatus?: FiscalCloseStatus;
  fiscalYear: number;
}) {
  const range = calculateFiscalYearDateRange({
    fiscalYear,
    fiscalYearEndDay,
    fiscalYearEndMonth,
    fiscalYearStartDay,
    fiscalYearStartMonth
  });
  const fiscalStartDate = parseDate(range.startDate);
  const fiscalEndDate = parseDate(range.endDate);
  const periods: FiscalPeriodDraft[] = [];

  if (includePeriod0) {
    periods.push({
      activeStatus,
      closeStatus,
      endDate: toDateString(fiscalStartDate),
      fiscalYear,
      period: 0,
      periodName: `Period 0 - ${period0Label}`,
      startDate: toDateString(fiscalStartDate)
    });
  }

  for (let period = 1; period <= 12; period += 1) {
    const periodStart = addMonths(fiscalStartDate, period - 1);
    const nextPeriodStart = addMonths(fiscalStartDate, period);
    const periodEnd =
      period === 12 ? fiscalEndDate : addDays(nextPeriodStart, -1);

    periods.push({
      activeStatus,
      closeStatus,
      endDate: toDateString(periodEnd),
      fiscalYear,
      period,
      periodName: `Period ${period} - ${monthFormatter.format(periodStart)}`,
      startDate: toDateString(periodStart)
    });
  }

  if (includePeriod13) {
    periods.push({
      activeStatus,
      closeStatus,
      endDate: toDateString(fiscalEndDate),
      fiscalYear,
      period: 13,
      periodName: `Period 13 - ${period13Label}`,
      startDate: toDateString(fiscalEndDate)
    });
  }

  return periods;
}

export function parseInteger(value: FormDataEntryValue | null, fallback = 0) {
  if (typeof value !== "string") {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export function parseString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

export function parseCheckbox(value: FormDataEntryValue | null) {
  return value === "on" || value === "true";
}

export function parseCloseStatus(value: FormDataEntryValue | null): FiscalCloseStatus {
  const stringValue = parseString(value);
  return stringValue === "soft_closed" || stringValue === "closed"
    ? stringValue
    : "open";
}

export function parseActiveStatus(value: FormDataEntryValue | null): FiscalActiveStatus {
  return parseString(value) === "inactive" ? "inactive" : "active";
}

function assertValidMonthDay(month: number, day: number, label: string) {
  if (month < 1 || month > 12) {
    throw new Error(`${label} month must be between 1 and 12.`);
  }

  if (day < 1 || day > 31) {
    throw new Error(`${label} day must be between 1 and 31.`);
  }

  const testDate = makeUtcDate(2024, month, day);
  if (testDate.getUTCMonth() !== month - 1 || testDate.getUTCDate() !== day) {
    throw new Error(`${label} month/day is not a valid date.`);
  }
}

function makeUtcDate(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day));
}

function parseDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function addMonths(date: Date, months: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, date.getUTCDate()));
}

function addDays(date: Date, days: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));
}

function toDateString(date: Date) {
  return date.toISOString().slice(0, 10);
}
