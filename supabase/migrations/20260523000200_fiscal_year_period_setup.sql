alter table public.organization_settings
  add column if not exists fiscal_year_start_month integer,
  add column if not exists fiscal_year_start_day integer,
  add column if not exists fiscal_year_end_month integer,
  add column if not exists fiscal_year_end_day integer;

alter table public.organization_settings
  drop constraint if exists organization_settings_fiscal_month_day_check;

alter table public.organization_settings
  add constraint organization_settings_fiscal_month_day_check check (
    (fiscal_year_start_month is null or fiscal_year_start_month between 1 and 12)
    and (fiscal_year_end_month is null or fiscal_year_end_month between 1 and 12)
    and (fiscal_year_start_day is null or fiscal_year_start_day between 1 and 31)
    and (fiscal_year_end_day is null or fiscal_year_end_day between 1 and 31)
  );

alter table public.fiscal_years
  drop constraint if exists fiscal_years_close_status_check;

alter table public.fiscal_years
  add constraint fiscal_years_close_status_check check (
    close_status in ('open', 'soft_closed', 'closed', 'locked')
  );

alter table public.fiscal_periods
  drop constraint if exists fiscal_periods_close_status_check;

alter table public.fiscal_periods
  add constraint fiscal_periods_close_status_check check (
    close_status in ('open', 'soft_closed', 'closed', 'locked')
  );

update public.organization_settings
set
  fiscal_year_start_month = coalesce(fiscal_year_start_month, 7),
  fiscal_year_start_day = coalesce(fiscal_year_start_day, 1),
  fiscal_year_end_month = coalesce(fiscal_year_end_month, 6),
  fiscal_year_end_day = coalesce(fiscal_year_end_day, 30),
  enable_period_0 = true,
  enable_period_13 = true,
  period_0_label = coalesce(nullif(period_0_label, ''), 'Opening / Beginning Balance'),
  period_13_label = coalesce(nullif(period_13_label, ''), 'Year-End / Accrual Adjustments'),
  updated_at = now();

create index if not exists idx_fiscal_periods_year_id_period
  on public.fiscal_periods (organization_id, fiscal_year_id, period);
