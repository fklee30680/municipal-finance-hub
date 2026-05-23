alter table public.threshold_configs
  add column if not exists global_dollar_threshold numeric(18, 2),
  add column if not exists global_percentage_threshold numeric(12, 4),
  add column if not exists minimum_base_amount_for_percentage_variance numeric(18, 2),
  add column if not exists account_type_thresholds jsonb not null default '{}'::jsonb;

update public.threshold_configs
set global_dollar_threshold = coalesce(global_dollar_threshold, dollar_threshold, 100000),
    global_percentage_threshold = coalesce(global_percentage_threshold, percentage_threshold, 0.1),
    minimum_base_amount_for_percentage_variance = coalesce(minimum_base_amount_for_percentage_variance, 1000),
    config_payload = case
      when config_payload = '{}'::jsonb
        then '{"default_source": "slice_9_mvp_defaults"}'::jsonb
      else config_payload
    end
where active_status = 'active';

create table if not exists public.sign_convention_configs (
  sign_convention_config_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(organization_id),
  config_name text not null,
  config_scope text not null default 'organization',
  config_payload jsonb not null default '{}'::jsonb,
  active_status text not null default 'active' check (active_status in ('active', 'inactive')),
  created_by uuid references public.app_users(user_id),
  created_at timestamptz not null default now(),
  updated_by uuid references public.app_users(user_id),
  updated_at timestamptz not null default now(),
  unique (organization_id, config_name)
);

alter table public.calculation_runs
  add column if not exists calculation_type text,
  add column if not exists period_from integer,
  add column if not exists period_to integer,
  add column if not exists time_view text,
  add column if not exists calculation_version text not null default 'mvp_actuals_v1',
  add column if not exists posting_run_ids uuid[] not null default '{}',
  add column if not exists validation_run_ids uuid[] not null default '{}',
  add column if not exists sign_convention_config_id uuid references public.sign_convention_configs(sign_convention_config_id),
  add column if not exists mapping_coverage_status text,
  add column if not exists mapping_coverage_run_id uuid,
  add column if not exists dependency_manifest jsonb not null default '{}'::jsonb,
  add column if not exists parameters_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists triggered_by uuid references public.app_users(user_id),
  add column if not exists triggered_at timestamptz,
  add column if not exists error_message text,
  add column if not exists is_current boolean not null default true,
  add column if not exists is_stale boolean not null default false,
  add column if not exists superseded_by_calculation_run_id uuid references public.calculation_runs(calculation_run_id);

alter table public.calculation_runs
  drop constraint if exists calculation_runs_run_status_check;

alter table public.calculation_runs
  add constraint calculation_runs_run_status_check check (
    run_status in (
      'pending',
      'running',
      'completed',
      'completed_with_warnings',
      'failed',
      'stale',
      'superseded'
    )
  );

create table if not exists public.mapping_coverage_results (
  mapping_coverage_result_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(organization_id),
  calculation_run_id uuid not null references public.calculation_runs(calculation_run_id),
  fiscal_year integer,
  period integer,
  segment_type text not null,
  segment_code text,
  segment_name text,
  reference_table text not null,
  reference_status text not null,
  coverage_issue_type text not null,
  severity text not null check (severity in ('Info', 'Warning', 'High', 'Critical')),
  affected_row_count integer not null default 0,
  affected_amount numeric(18, 2) not null default 0,
  message text not null,
  recommended_action text,
  created_at timestamptz not null default now()
);

alter table public.financial_summary_results
  add column if not exists period_from integer,
  add column if not exists period_to integer,
  add column if not exists summary_type text,
  add column if not exists fund_code text,
  add column if not exists acfr_code text,
  add column if not exists department_code text,
  add column if not exists function_code text,
  add column if not exists object_code text,
  add column if not exists account_type text,
  add column if not exists balance_sheet_category text,
  add column if not exists account_type_detailed text,
  add column if not exists detailed_account_type text,
  add column if not exists fund_type text,
  add column if not exists reporting_model text,
  add column if not exists amount_type text,
  add column if not exists amount_value numeric(18, 2),
  add column if not exists presentation_amount numeric(18, 2),
  add column if not exists trial_balance_import_batch_ids uuid[] not null default '{}';

alter table public.statement_summary_results
  add column if not exists fund_type text,
  add column if not exists reporting_model text,
  add column if not exists fiscal_year integer,
  add column if not exists period_from integer,
  add column if not exists period_to integer,
  add column if not exists line_item_code text,
  add column if not exists line_item_name text,
  add column if not exists line_item_category text,
  add column if not exists amount_value numeric(18, 2),
  add column if not exists presentation_amount numeric(18, 2),
  add column if not exists sort_order integer,
  add column if not exists trial_balance_import_batch_ids uuid[] not null default '{}';

alter table public.variance_results
  add column if not exists variance_type text,
  add column if not exists fiscal_year integer,
  add column if not exists period integer,
  add column if not exists comparison_fiscal_year integer,
  add column if not exists comparison_period integer,
  add column if not exists fund_code text,
  add column if not exists acfr_code text,
  add column if not exists department_code text,
  add column if not exists function_code text,
  add column if not exists object_code text,
  add column if not exists account_type text,
  add column if not exists fund_type text,
  add column if not exists reporting_model text,
  add column if not exists absolute_variance_amount numeric(18, 2),
  add column if not exists severity text,
  add column if not exists trial_balance_import_batch_ids uuid[] not null default '{}';

alter table public.trend_results
  add column if not exists trend_type text,
  add column if not exists fiscal_year integer,
  add column if not exists period integer,
  add column if not exists fund_code text,
  add column if not exists acfr_code text,
  add column if not exists department_code text,
  add column if not exists function_code text,
  add column if not exists object_code text,
  add column if not exists account_type text,
  add column if not exists fund_type text,
  add column if not exists reporting_model text,
  add column if not exists amount_type text,
  add column if not exists amount_value numeric(18, 2),
  add column if not exists presentation_amount numeric(18, 2),
  add column if not exists trial_balance_import_batch_ids uuid[] not null default '{}';

alter table public.exception_results
  add column if not exists exception_category text,
  add column if not exists exception_type text,
  add column if not exists severity_level text check (severity_level in ('Info', 'Warning', 'High', 'Critical')),
  add column if not exists fiscal_year integer,
  add column if not exists period integer,
  add column if not exists fund_code text,
  add column if not exists acfr_code text,
  add column if not exists department_code text,
  add column if not exists function_code text,
  add column if not exists object_code text,
  add column if not exists full_account_number text,
  add column if not exists fund_type text,
  add column if not exists reporting_model text,
  add column if not exists current_amount numeric(18, 2),
  add column if not exists comparison_amount numeric(18, 2),
  add column if not exists variance_amount numeric(18, 2),
  add column if not exists variance_percent numeric(12, 4),
  add column if not exists message text,
  add column if not exists recommended_review_action text,
  add column if not exists trial_balance_import_batch_ids uuid[] not null default '{}';

alter table public.sign_convention_configs enable row level security;
alter table public.mapping_coverage_results enable row level security;

create index if not exists idx_sign_convention_configs_org_active
  on public.sign_convention_configs (organization_id, active_status);

create index if not exists idx_calculation_runs_current
  on public.calculation_runs (organization_id, fiscal_year, period_from, period_to, time_view, is_current);

create index if not exists idx_calculation_runs_stale
  on public.calculation_runs (organization_id, is_stale, run_status);

create index if not exists idx_mapping_coverage_results_run
  on public.mapping_coverage_results (calculation_run_id, severity, segment_type);

create index if not exists idx_financial_summary_results_dimensions
  on public.financial_summary_results (calculation_run_id, summary_type, amount_type);

create index if not exists idx_statement_summary_results_period
  on public.statement_summary_results (calculation_run_id, statement_type, reporting_model);

create index if not exists idx_variance_results_type
  on public.variance_results (calculation_run_id, variance_type, severity);

create index if not exists idx_trend_results_type
  on public.trend_results (calculation_run_id, trend_type, amount_type);

create index if not exists idx_exception_results_category
  on public.exception_results (calculation_run_id, exception_category, severity_level);

do $$
declare
  org_record record;
begin
  for org_record in select organization_id from public.organizations loop
    insert into public.sign_convention_configs (
      organization_id,
      config_name,
      config_scope,
      config_payload
    )
    values (
      org_record.organization_id,
      'MVP Actuals Sign Convention',
      'organization',
      '{
        "calculation_version": "mvp_actuals_v1",
        "defaults": {
          "asset": {"natural_balance_type": "debit", "activity_sign_multiplier": 1, "ending_balance_sign_multiplier": 1, "statement_sign_multiplier": 1, "variance_favorable_direction": "contextual"},
          "liability": {"natural_balance_type": "credit", "activity_sign_multiplier": -1, "ending_balance_sign_multiplier": -1, "statement_sign_multiplier": 1, "variance_favorable_direction": "contextual"},
          "fund_balance": {"natural_balance_type": "credit", "activity_sign_multiplier": -1, "ending_balance_sign_multiplier": -1, "statement_sign_multiplier": 1, "variance_favorable_direction": "contextual"},
          "net_position": {"natural_balance_type": "credit", "activity_sign_multiplier": -1, "ending_balance_sign_multiplier": -1, "statement_sign_multiplier": 1, "variance_favorable_direction": "contextual"},
          "revenue": {"natural_balance_type": "credit", "activity_sign_multiplier": -1, "ending_balance_sign_multiplier": -1, "statement_sign_multiplier": 1, "variance_favorable_direction": "contextual"},
          "expenditure": {"natural_balance_type": "debit", "activity_sign_multiplier": 1, "ending_balance_sign_multiplier": 1, "statement_sign_multiplier": 1, "variance_favorable_direction": "contextual"},
          "expense": {"natural_balance_type": "debit", "activity_sign_multiplier": 1, "ending_balance_sign_multiplier": 1, "statement_sign_multiplier": 1, "variance_favorable_direction": "contextual"}
        }
      }'::jsonb
    )
    on conflict (organization_id, config_name) do nothing;

    insert into public.threshold_configs (
      organization_id,
      threshold_name,
      threshold_scope,
      dollar_threshold,
      percentage_threshold,
      global_dollar_threshold,
      global_percentage_threshold,
      minimum_base_amount_for_percentage_variance,
      account_type_thresholds,
      config_payload
    )
    values (
      org_record.organization_id,
      'MVP Calculation Thresholds',
      'organization',
      100000,
      0.1,
      100000,
      0.1,
      1000,
      '{}'::jsonb,
      '{"default_source": "slice_9_mvp_defaults"}'::jsonb
    )
    on conflict (organization_id, threshold_name) do nothing;
  end loop;
end $$;
