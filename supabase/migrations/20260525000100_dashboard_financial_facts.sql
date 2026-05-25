create table if not exists public.dashboard_financial_facts (
  dashboard_financial_fact_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(organization_id),
  calculation_run_id uuid not null references public.calculation_runs(calculation_run_id),
  fiscal_year integer not null,
  period_from integer not null,
  period_to integer not null,
  time_view text not null,
  reporting_scope text not null,
  summary_type text not null,
  summary_key text not null,
  summary_label text,
  fund_code text,
  fund_group text,
  department_code text,
  function_code text,
  acfr_code text,
  object_code text,
  account_type text,
  balance_sheet_line text,
  activity_statement_line text,
  reporting_model text,
  beginning_balance numeric(18, 2),
  debits numeric(18, 2),
  credits numeric(18, 2),
  net_change numeric(18, 2),
  ending_balance numeric(18, 2),
  presentation_amount numeric(18, 2),
  row_count integer not null default 0,
  result_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.dashboard_financial_facts enable row level security;

create index if not exists idx_dashboard_financial_facts_run
  on public.dashboard_financial_facts (organization_id, calculation_run_id);

create index if not exists idx_dashboard_financial_facts_fund
  on public.dashboard_financial_facts (organization_id, calculation_run_id, fund_code);

create index if not exists idx_dashboard_financial_facts_fund_group
  on public.dashboard_financial_facts (organization_id, calculation_run_id, fund_group);

create index if not exists idx_dashboard_financial_facts_department
  on public.dashboard_financial_facts (organization_id, calculation_run_id, department_code);

create index if not exists idx_dashboard_financial_facts_function
  on public.dashboard_financial_facts (organization_id, calculation_run_id, function_code);

create index if not exists idx_dashboard_financial_facts_acfr
  on public.dashboard_financial_facts (organization_id, calculation_run_id, acfr_code);

create index if not exists idx_dashboard_financial_facts_account_type
  on public.dashboard_financial_facts (organization_id, calculation_run_id, account_type);

create index if not exists idx_dashboard_financial_facts_activity_line
  on public.dashboard_financial_facts (organization_id, calculation_run_id, activity_statement_line);

create index if not exists idx_dashboard_financial_facts_balance_line
  on public.dashboard_financial_facts (organization_id, calculation_run_id, balance_sheet_line);
