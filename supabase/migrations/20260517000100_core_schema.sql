create extension if not exists "pgcrypto";

create table public.organizations (
  organization_id uuid primary key default gen_random_uuid(),
  organization_name text not null,
  organization_type text,
  active_status text not null default 'active' check (active_status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.app_users (
  user_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(organization_id),
  auth_user_id uuid,
  email text not null,
  first_name text,
  last_name text,
  display_name text,
  active_status text not null default 'active' check (active_status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_login_at timestamptz,
  unique (organization_id, email),
  unique (auth_user_id)
);

create table public.roles (
  role_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(organization_id),
  role_name text not null,
  role_description text,
  active_status text not null default 'active' check (active_status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, role_name)
);

create table public.user_roles (
  user_role_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(user_id),
  role_id uuid not null references public.roles(role_id),
  assigned_by uuid references public.app_users(user_id),
  assigned_at timestamptz not null default now(),
  active_status text not null default 'active' check (active_status in ('active', 'inactive')),
  unique (user_id, role_id)
);

create table public.fiscal_years (
  fiscal_year_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(organization_id),
  fiscal_year integer not null,
  fiscal_year_label text not null,
  start_date date not null,
  end_date date not null,
  close_status text not null default 'open' check (close_status in ('open', 'closed', 'locked')),
  active_status text not null default 'active' check (active_status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, fiscal_year)
);

create table public.fiscal_periods (
  fiscal_period_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(organization_id),
  fiscal_year_id uuid not null references public.fiscal_years(fiscal_year_id),
  fiscal_year integer not null,
  period integer not null check (period between 1 and 13),
  period_name text not null,
  start_date date not null,
  end_date date not null,
  close_status text not null default 'open' check (close_status in ('open', 'closed', 'locked')),
  active_status text not null default 'active' check (active_status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, fiscal_year, period),
  unique (fiscal_year_id, period)
);

create table public.account_structures (
  account_structure_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(organization_id),
  structure_name text not null,
  structure_description text,
  delimiter text,
  segment_count integer not null check (segment_count > 0),
  trim_spaces boolean not null default true,
  remove_trailing_delimiters boolean not null default true,
  preserve_leading_zeros boolean not null default true,
  version_number integer not null default 1,
  active_status text not null default 'active' check (active_status in ('active', 'inactive')),
  effective_start_date date,
  effective_end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, structure_name, version_number)
);

create table public.account_segment_definitions (
  account_segment_definition_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(organization_id),
  account_structure_id uuid not null references public.account_structures(account_structure_id),
  segment_number integer not null check (segment_number > 0),
  segment_name text not null,
  segment_key text not null,
  min_length integer,
  max_length integer,
  active_status text not null default 'active' check (active_status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_structure_id, segment_number),
  unique (account_structure_id, segment_key)
);

create table public.import_types (
  import_type_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(organization_id),
  import_type_code text not null,
  import_type_name text not null,
  import_type_description text,
  active_status text not null default 'active' check (active_status in ('active', 'inactive', 'deferred')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, import_type_code)
);

create table public.import_templates (
  import_template_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(organization_id),
  import_type_id uuid not null references public.import_types(import_type_id),
  account_structure_id uuid references public.account_structures(account_structure_id),
  template_name text not null,
  template_description text,
  active_status text not null default 'active' check (active_status in ('active', 'inactive')),
  created_by uuid references public.app_users(user_id),
  created_at timestamptz not null default now(),
  updated_by uuid references public.app_users(user_id),
  updated_at timestamptz not null default now(),
  unique (organization_id, import_type_id, template_name)
);

create table public.import_template_versions (
  template_version_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(organization_id),
  import_template_id uuid not null references public.import_templates(import_template_id),
  version_number integer not null check (version_number > 0),
  version_status text not null default 'draft' check (version_status in ('draft', 'active', 'inactive', 'superseded')),
  account_structure_id uuid references public.account_structures(account_structure_id),
  configuration jsonb not null default '{}'::jsonb,
  created_by uuid references public.app_users(user_id),
  created_at timestamptz not null default now(),
  updated_by uuid references public.app_users(user_id),
  updated_at timestamptz not null default now(),
  unique (import_template_id, version_number)
);

create table public.sheet_mappings (
  sheet_mapping_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(organization_id),
  template_version_id uuid not null references public.import_template_versions(template_version_id),
  sheet_name text,
  sheet_index integer,
  header_row_number integer,
  data_start_row_number integer,
  active_status text not null default 'active' check (active_status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.field_mappings (
  field_mapping_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(organization_id),
  template_version_id uuid not null references public.import_template_versions(template_version_id),
  sheet_mapping_id uuid references public.sheet_mappings(sheet_mapping_id),
  source_field_name text not null,
  target_field_name text not null,
  target_field_required boolean not null default false,
  active_status text not null default 'active' check (active_status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.transformation_rules (
  transformation_rule_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(organization_id),
  template_version_id uuid not null references public.import_template_versions(template_version_id),
  rule_name text not null,
  rule_order integer not null default 0,
  rule_config jsonb not null default '{}'::jsonb,
  active_status text not null default 'active' check (active_status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.validation_rules (
  validation_rule_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(organization_id),
  template_version_id uuid references public.import_template_versions(template_version_id),
  import_type_id uuid references public.import_types(import_type_id),
  rule_name text not null,
  severity text not null default 'error' check (severity in ('info', 'warning', 'error')),
  rule_config jsonb not null default '{}'::jsonb,
  active_status text not null default 'active' check (active_status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.source_files (
  source_file_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(organization_id),
  storage_bucket text not null,
  storage_path text not null,
  original_file_name text not null,
  content_type text,
  byte_size bigint,
  checksum_sha256 text,
  uploaded_by uuid references public.app_users(user_id),
  uploaded_at timestamptz not null default now(),
  retained_unchanged boolean not null default true,
  active_status text not null default 'active' check (active_status in ('active', 'inactive')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, storage_bucket, storage_path)
);

create table public.import_batches (
  import_batch_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(organization_id),
  import_type_id uuid not null references public.import_types(import_type_id),
  import_template_id uuid references public.import_templates(import_template_id),
  template_version_id uuid references public.import_template_versions(template_version_id),
  account_structure_id uuid references public.account_structures(account_structure_id),
  source_file_id uuid references public.source_files(source_file_id),
  fiscal_year_id uuid references public.fiscal_years(fiscal_year_id),
  fiscal_period_id uuid references public.fiscal_periods(fiscal_period_id),
  fiscal_year integer,
  period integer,
  batch_name text,
  batch_status text not null default 'draft' check (
    batch_status in ('draft', 'uploaded', 'validated', 'approved', 'posted', 'failed', 'superseded', 'archived')
  ),
  reporting_status text not null default 'excluded' check (reporting_status in ('included', 'excluded')),
  active_status text not null default 'active' check (active_status in ('active', 'inactive')),
  is_active_for_reporting boolean not null default false,
  supersedes_import_batch_id uuid references public.import_batches(import_batch_id),
  superseded_by_import_batch_id uuid references public.import_batches(import_batch_id),
  rows_processed integer not null default 0,
  rows_accepted integer not null default 0,
  rows_rejected integer not null default 0,
  warning_count integer not null default 0,
  error_count integer not null default 0,
  created_by uuid references public.app_users(user_id),
  created_at timestamptz not null default now(),
  updated_by uuid references public.app_users(user_id),
  updated_at timestamptz not null default now(),
  posted_by uuid references public.app_users(user_id),
  posted_at timestamptz,
  inactive_at timestamptz,
  reactivated_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table public.import_exceptions (
  import_exception_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(organization_id),
  import_batch_id uuid not null references public.import_batches(import_batch_id),
  source_file_id uuid references public.source_files(source_file_id),
  source_row_number integer,
  exception_code text not null,
  exception_message text not null,
  severity text not null default 'error' check (severity in ('info', 'warning', 'error')),
  exception_status text not null default 'open' check (exception_status in ('open', 'acknowledged', 'resolved', 'waived')),
  resolved_by uuid references public.app_users(user_id),
  resolved_at timestamptz,
  resolution_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.mapping_versions (
  mapping_version_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(organization_id),
  mapping_scope text not null check (mapping_scope in ('fund', 'acfr', 'department', 'function', 'object', 'account_structure')),
  mapping_version integer not null,
  version_name text,
  effective_start_date date,
  effective_end_date date,
  active_status text not null default 'active' check (active_status in ('active', 'inactive', 'superseded')),
  created_by uuid references public.app_users(user_id),
  created_at timestamptz not null default now(),
  updated_by uuid references public.app_users(user_id),
  updated_at timestamptz not null default now(),
  unique (organization_id, mapping_scope, mapping_version)
);

create table public.funds (
  fund_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(organization_id),
  fund_code text not null,
  fund_name text not null,
  fund_type text,
  reporting_model text check (reporting_model in ('governmental', 'proprietary', 'fiduciary', 'component_unit', 'other')),
  effective_start_date date,
  effective_end_date date,
  active_status text not null default 'active' check (active_status in ('active', 'inactive')),
  mapping_version_id uuid references public.mapping_versions(mapping_version_id),
  mapping_version integer not null default 1,
  created_by uuid references public.app_users(user_id),
  created_at timestamptz not null default now(),
  updated_by uuid references public.app_users(user_id),
  updated_at timestamptz not null default now(),
  unique (organization_id, fund_code, mapping_version)
);

create table public.acfr_mappings (
  acfr_mapping_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(organization_id),
  acfr_code text not null,
  acfr_name text not null,
  acfr_category text,
  effective_start_date date,
  effective_end_date date,
  active_status text not null default 'active' check (active_status in ('active', 'inactive')),
  mapping_version_id uuid references public.mapping_versions(mapping_version_id),
  mapping_version integer not null default 1,
  created_by uuid references public.app_users(user_id),
  created_at timestamptz not null default now(),
  updated_by uuid references public.app_users(user_id),
  updated_at timestamptz not null default now(),
  unique (organization_id, acfr_code, mapping_version)
);

create table public.departments (
  department_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(organization_id),
  department_code text not null,
  department_name text not null,
  department_group text,
  effective_start_date date,
  effective_end_date date,
  active_status text not null default 'active' check (active_status in ('active', 'inactive')),
  mapping_version_id uuid references public.mapping_versions(mapping_version_id),
  mapping_version integer not null default 1,
  created_by uuid references public.app_users(user_id),
  created_at timestamptz not null default now(),
  updated_by uuid references public.app_users(user_id),
  updated_at timestamptz not null default now(),
  unique (organization_id, department_code, mapping_version)
);

create table public.functions (
  function_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(organization_id),
  function_code text not null,
  function_name text not null,
  function_group text,
  effective_start_date date,
  effective_end_date date,
  active_status text not null default 'active' check (active_status in ('active', 'inactive')),
  mapping_version_id uuid references public.mapping_versions(mapping_version_id),
  mapping_version integer not null default 1,
  created_by uuid references public.app_users(user_id),
  created_at timestamptz not null default now(),
  updated_by uuid references public.app_users(user_id),
  updated_at timestamptz not null default now(),
  unique (organization_id, function_code, mapping_version)
);

create table public.objects (
  object_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(organization_id),
  object_code text not null,
  object_name text not null,
  account_type text,
  statement_category text,
  cash_flow_category text,
  detailed_account_type text,
  effective_start_date date,
  effective_end_date date,
  active_status text not null default 'active' check (active_status in ('active', 'inactive')),
  mapping_version_id uuid references public.mapping_versions(mapping_version_id),
  mapping_version integer not null default 1,
  created_by uuid references public.app_users(user_id),
  created_at timestamptz not null default now(),
  updated_by uuid references public.app_users(user_id),
  updated_at timestamptz not null default now(),
  unique (organization_id, object_code, mapping_version)
);

create table public.trial_balance_lines (
  trial_balance_line_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(organization_id),
  fiscal_year integer not null,
  period integer not null,
  fiscal_year_id uuid references public.fiscal_years(fiscal_year_id),
  fiscal_period_id uuid references public.fiscal_periods(fiscal_period_id),
  full_account_number text not null,
  fund_code text,
  acfr_code text,
  department_code text,
  function_code text,
  object_code text,
  account_name text,
  beginning_balance numeric(18, 2) not null default 0,
  debits numeric(18, 2) not null default 0,
  credits numeric(18, 2) not null default 0,
  net_change numeric(18, 2) not null default 0,
  ending_balance numeric(18, 2) not null default 0,
  import_batch_id uuid not null references public.import_batches(import_batch_id),
  source_file_id uuid not null references public.source_files(source_file_id),
  template_version_id uuid references public.import_template_versions(template_version_id),
  account_structure_id uuid references public.account_structures(account_structure_id),
  source_row_number integer,
  is_active_for_reporting boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.trial_balance_line_segments (
  trial_balance_line_segment_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(organization_id),
  trial_balance_line_id uuid not null references public.trial_balance_lines(trial_balance_line_id) on delete cascade,
  account_structure_id uuid references public.account_structures(account_structure_id),
  segment_definition_id uuid references public.account_segment_definitions(account_segment_definition_id),
  segment_number integer not null check (segment_number > 0),
  segment_key text not null,
  segment_value text,
  created_at timestamptz not null default now(),
  unique (trial_balance_line_id, segment_number)
);

create table public.threshold_configs (
  threshold_config_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(organization_id),
  threshold_name text not null,
  threshold_scope text not null default 'organization',
  dollar_threshold numeric(18, 2),
  percentage_threshold numeric(12, 4),
  config_payload jsonb not null default '{}'::jsonb,
  active_status text not null default 'active' check (active_status in ('active', 'inactive')),
  created_by uuid references public.app_users(user_id),
  created_at timestamptz not null default now(),
  updated_by uuid references public.app_users(user_id),
  updated_at timestamptz not null default now(),
  unique (organization_id, threshold_name)
);

create table public.calculation_runs (
  calculation_run_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(organization_id),
  fiscal_year_id uuid references public.fiscal_years(fiscal_year_id),
  fiscal_period_id uuid references public.fiscal_periods(fiscal_period_id),
  fiscal_year integer,
  period integer,
  run_type text not null,
  run_status text not null default 'pending' check (run_status in ('pending', 'running', 'completed', 'failed', 'superseded')),
  account_structure_id uuid references public.account_structures(account_structure_id),
  threshold_config_id uuid references public.threshold_configs(threshold_config_id),
  parameters jsonb not null default '{}'::jsonb,
  source_import_batch_ids uuid[] not null default '{}',
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid references public.app_users(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.financial_summary_results (
  financial_summary_result_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(organization_id),
  calculation_run_id uuid not null references public.calculation_runs(calculation_run_id),
  fiscal_year integer,
  period integer,
  summary_scope text not null,
  summary_key text not null,
  beginning_balance numeric(18, 2),
  debits numeric(18, 2),
  credits numeric(18, 2),
  net_change numeric(18, 2),
  ending_balance numeric(18, 2),
  result_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.statement_summary_results (
  statement_summary_result_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(organization_id),
  calculation_run_id uuid not null references public.calculation_runs(calculation_run_id),
  statement_type text not null,
  line_code text,
  line_name text not null,
  line_order integer not null default 0,
  amount numeric(18, 2),
  result_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.variance_results (
  variance_result_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(organization_id),
  calculation_run_id uuid not null references public.calculation_runs(calculation_run_id),
  variance_scope text not null,
  variance_key text not null,
  comparison_type text not null,
  current_amount numeric(18, 2),
  comparison_amount numeric(18, 2),
  variance_amount numeric(18, 2),
  variance_percent numeric(12, 4),
  result_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.trend_results (
  trend_result_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(organization_id),
  calculation_run_id uuid not null references public.calculation_runs(calculation_run_id),
  trend_scope text not null,
  trend_key text not null,
  period_start integer,
  period_end integer,
  trend_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.exception_results (
  exception_result_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(organization_id),
  calculation_run_id uuid references public.calculation_runs(calculation_run_id),
  import_exception_id uuid references public.import_exceptions(import_exception_id),
  exception_scope text not null,
  exception_key text,
  severity text not null default 'warning' check (severity in ('info', 'warning', 'critical')),
  exception_status text not null default 'open' check (exception_status in ('open', 'assigned', 'resolved', 'waived')),
  dollar_impact numeric(18, 2),
  percentage_impact numeric(12, 4),
  result_payload jsonb not null default '{}'::jsonb,
  assigned_to uuid references public.app_users(user_id),
  resolved_by uuid references public.app_users(user_id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.report_templates (
  report_template_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(organization_id),
  template_name text not null,
  template_description text,
  report_type text not null default 'monthly_finance_report',
  active_status text not null default 'active' check (active_status in ('active', 'inactive')),
  created_by uuid references public.app_users(user_id),
  created_at timestamptz not null default now(),
  updated_by uuid references public.app_users(user_id),
  updated_at timestamptz not null default now(),
  unique (organization_id, template_name)
);

create table public.report_template_versions (
  report_template_version_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(organization_id),
  report_template_id uuid not null references public.report_templates(report_template_id),
  version_number integer not null check (version_number > 0),
  version_status text not null default 'draft' check (version_status in ('draft', 'active', 'inactive', 'superseded')),
  template_payload jsonb not null default '{}'::jsonb,
  created_by uuid references public.app_users(user_id),
  created_at timestamptz not null default now(),
  updated_by uuid references public.app_users(user_id),
  updated_at timestamptz not null default now(),
  unique (report_template_id, version_number)
);

create table public.report_instances (
  report_instance_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(organization_id),
  report_template_id uuid references public.report_templates(report_template_id),
  report_template_version_id uuid references public.report_template_versions(report_template_version_id),
  calculation_run_id uuid references public.calculation_runs(calculation_run_id),
  account_structure_id uuid references public.account_structures(account_structure_id),
  fiscal_year_id uuid references public.fiscal_years(fiscal_year_id),
  fiscal_period_id uuid references public.fiscal_periods(fiscal_period_id),
  fiscal_year integer,
  period integer,
  report_title text not null,
  report_status text not null default 'draft' check (report_status in ('draft', 'under_review', 'approved', 'finalized', 'published', 'superseded')),
  parameters_snapshot jsonb not null default '{}'::jsonb,
  comments_snapshot jsonb not null default '[]'::jsonb,
  source_metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.app_users(user_id),
  created_at timestamptz not null default now(),
  updated_by uuid references public.app_users(user_id),
  updated_at timestamptz not null default now(),
  finalized_by uuid references public.app_users(user_id),
  finalized_at timestamptz,
  superseded_by_report_instance_id uuid references public.report_instances(report_instance_id)
);

create table public.report_parameters (
  report_parameter_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(organization_id),
  report_instance_id uuid not null references public.report_instances(report_instance_id) on delete cascade,
  parameter_name text not null,
  parameter_value jsonb not null default 'null'::jsonb,
  created_at timestamptz not null default now(),
  unique (report_instance_id, parameter_name)
);

create table public.report_comments (
  report_comment_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(organization_id),
  report_instance_id uuid not null references public.report_instances(report_instance_id) on delete cascade,
  parent_report_comment_id uuid references public.report_comments(report_comment_id),
  comment_body text not null,
  comment_status text not null default 'open' check (comment_status in ('open', 'resolved', 'archived')),
  created_by uuid references public.app_users(user_id),
  created_at timestamptz not null default now(),
  updated_by uuid references public.app_users(user_id),
  updated_at timestamptz not null default now()
);

create table public.report_exports (
  report_export_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(organization_id),
  report_instance_id uuid not null references public.report_instances(report_instance_id),
  export_format text not null check (export_format in ('pdf', 'docx', 'xlsx', 'html')),
  storage_bucket text,
  storage_path text,
  export_status text not null default 'pending' check (export_status in ('pending', 'completed', 'failed')),
  exported_by uuid references public.app_users(user_id),
  exported_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.report_import_batches (
  report_import_batch_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(organization_id),
  report_instance_id uuid not null references public.report_instances(report_instance_id) on delete cascade,
  import_batch_id uuid not null references public.import_batches(import_batch_id),
  included_at timestamptz not null default now(),
  unique (report_instance_id, import_batch_id)
);

create table public.report_mapping_versions (
  report_mapping_version_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(organization_id),
  report_instance_id uuid not null references public.report_instances(report_instance_id) on delete cascade,
  mapping_version_id uuid not null references public.mapping_versions(mapping_version_id),
  included_at timestamptz not null default now(),
  unique (report_instance_id, mapping_version_id)
);

create table public.audit_logs (
  audit_log_id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(organization_id),
  actor_user_id uuid references public.app_users(user_id),
  action_type text not null,
  entity_table text,
  entity_id uuid,
  before_payload jsonb,
  after_payload jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.inactivation_requests (
  inactivation_request_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(organization_id),
  target_entity_table text not null,
  target_entity_id uuid not null,
  request_reason text not null,
  request_status text not null default 'requested' check (request_status in ('requested', 'approved', 'rejected', 'cancelled', 'completed')),
  requested_by uuid references public.app_users(user_id),
  requested_at timestamptz not null default now(),
  reviewed_by uuid references public.app_users(user_id),
  reviewed_at timestamptz,
  completed_by uuid references public.app_users(user_id),
  completed_at timestamptz,
  audit_log_id uuid references public.audit_logs(audit_log_id)
);

create table public.reactivation_requests (
  reactivation_request_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(organization_id),
  target_entity_table text not null,
  target_entity_id uuid not null,
  request_reason text not null,
  request_status text not null default 'requested' check (request_status in ('requested', 'approved', 'rejected', 'cancelled', 'completed')),
  requested_by uuid references public.app_users(user_id),
  requested_at timestamptz not null default now(),
  reviewed_by uuid references public.app_users(user_id),
  reviewed_at timestamptz,
  completed_by uuid references public.app_users(user_id),
  completed_at timestamptz,
  audit_log_id uuid references public.audit_logs(audit_log_id)
);

create or replace view public.active_trial_balance_lines
with (security_invoker = true)
as
select tbl.*
from public.trial_balance_lines tbl
join public.import_batches ib
  on ib.import_batch_id = tbl.import_batch_id
where tbl.is_active_for_reporting = true
  and ib.is_active_for_reporting = true
  and ib.reporting_status = 'included'
  and ib.active_status = 'active'
  and ib.batch_status = 'posted'
  and ib.superseded_by_import_batch_id is null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'organizations',
    'app_users',
    'roles',
    'fiscal_years',
    'fiscal_periods',
    'account_structures',
    'account_segment_definitions',
    'import_types',
    'import_templates',
    'import_template_versions',
    'sheet_mappings',
    'field_mappings',
    'transformation_rules',
    'validation_rules',
    'source_files',
    'import_batches',
    'import_exceptions',
    'mapping_versions',
    'funds',
    'acfr_mappings',
    'departments',
    'functions',
    'objects',
    'trial_balance_lines',
    'threshold_configs',
    'calculation_runs',
    'exception_results',
    'report_templates',
    'report_template_versions',
    'report_instances',
    'report_comments'
  ]
  loop
    execute format(
      'create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      table_name,
      table_name
    );
  end loop;
end $$;

create index idx_app_users_organization_id on public.app_users (organization_id);
create index idx_roles_organization_id on public.roles (organization_id);
create index idx_user_roles_user_id on public.user_roles (user_id);
create index idx_user_roles_role_id on public.user_roles (role_id);
create index idx_fiscal_years_org_year on public.fiscal_years (organization_id, fiscal_year);
create index idx_fiscal_periods_org_year_period on public.fiscal_periods (organization_id, fiscal_year, period);
create index idx_account_structures_org_active on public.account_structures (organization_id, active_status);
create index idx_account_segment_definitions_structure on public.account_segment_definitions (account_structure_id, segment_number);
create index idx_import_types_org_code on public.import_types (organization_id, import_type_code);
create index idx_import_templates_org_type on public.import_templates (organization_id, import_type_id);
create index idx_import_template_versions_template on public.import_template_versions (import_template_id, version_number);
create index idx_sheet_mappings_template_version on public.sheet_mappings (template_version_id);
create index idx_field_mappings_template_version on public.field_mappings (template_version_id);
create index idx_transformation_rules_template_version on public.transformation_rules (template_version_id);
create index idx_validation_rules_template_version on public.validation_rules (template_version_id);
create index idx_source_files_org_path on public.source_files (organization_id, storage_bucket, storage_path);
create index idx_import_batches_org_period on public.import_batches (organization_id, fiscal_year, period);
create index idx_import_batches_source_file on public.import_batches (source_file_id);
create index idx_import_batches_template_version on public.import_batches (template_version_id);
create index idx_import_batches_reporting on public.import_batches (organization_id, is_active_for_reporting, reporting_status, batch_status);
create index idx_import_exceptions_batch on public.import_exceptions (import_batch_id, severity, exception_status);
create index idx_mapping_versions_org_scope on public.mapping_versions (organization_id, mapping_scope, mapping_version);
create index idx_funds_org_code_active on public.funds (organization_id, fund_code, active_status);
create index idx_acfr_mappings_org_code_active on public.acfr_mappings (organization_id, acfr_code, active_status);
create index idx_departments_org_code_active on public.departments (organization_id, department_code, active_status);
create index idx_functions_org_code_active on public.functions (organization_id, function_code, active_status);
create index idx_objects_org_code_active on public.objects (organization_id, object_code, active_status);
create index idx_trial_balance_lines_org_period on public.trial_balance_lines (organization_id, fiscal_year, period);
create index idx_trial_balance_lines_batch on public.trial_balance_lines (import_batch_id);
create index idx_trial_balance_lines_source_file on public.trial_balance_lines (source_file_id);
create index idx_trial_balance_lines_template_version on public.trial_balance_lines (template_version_id);
create index idx_trial_balance_lines_segments on public.trial_balance_lines (organization_id, fund_code, acfr_code, department_code, function_code, object_code);
create index idx_trial_balance_lines_reporting on public.trial_balance_lines (organization_id, is_active_for_reporting);
create index idx_trial_balance_line_segments_line on public.trial_balance_line_segments (trial_balance_line_id);
create index idx_calculation_runs_org_period on public.calculation_runs (organization_id, fiscal_year, period);
create index idx_calculation_runs_status on public.calculation_runs (organization_id, run_status);
create index idx_financial_summary_results_run on public.financial_summary_results (calculation_run_id, summary_scope, summary_key);
create index idx_statement_summary_results_run on public.statement_summary_results (calculation_run_id, statement_type);
create index idx_variance_results_run on public.variance_results (calculation_run_id, variance_scope, variance_key);
create index idx_trend_results_run on public.trend_results (calculation_run_id, trend_scope, trend_key);
create index idx_exception_results_run on public.exception_results (calculation_run_id, exception_status);
create index idx_threshold_configs_org_active on public.threshold_configs (organization_id, active_status);
create index idx_report_templates_org_active on public.report_templates (organization_id, active_status);
create index idx_report_template_versions_template on public.report_template_versions (report_template_id, version_number);
create index idx_report_instances_org_period on public.report_instances (organization_id, fiscal_year, period);
create index idx_report_instances_calc_run on public.report_instances (calculation_run_id);
create index idx_report_instances_template_version on public.report_instances (report_template_version_id);
create index idx_report_parameters_report on public.report_parameters (report_instance_id);
create index idx_report_comments_report on public.report_comments (report_instance_id, comment_status);
create index idx_report_exports_report on public.report_exports (report_instance_id, export_status);
create index idx_report_import_batches_report on public.report_import_batches (report_instance_id);
create index idx_report_import_batches_batch on public.report_import_batches (import_batch_id);
create index idx_report_mapping_versions_report on public.report_mapping_versions (report_instance_id);
create index idx_audit_logs_org_created on public.audit_logs (organization_id, created_at desc);
create index idx_audit_logs_entity on public.audit_logs (entity_table, entity_id);
create index idx_inactivation_requests_target on public.inactivation_requests (target_entity_table, target_entity_id, request_status);
create index idx_reactivation_requests_target on public.reactivation_requests (target_entity_table, target_entity_id, request_status);

do $$
declare
  default_organization_id uuid;
  city_account_structure_id uuid;
  default_report_template_id uuid;
begin
  insert into public.organizations (
    organization_name,
    organization_type
  )
  values (
    'Default Municipal Organization',
    'municipality'
  )
  returning organization_id into default_organization_id;

  insert into public.roles (
    organization_id,
    role_name,
    role_description
  )
  values
    (default_organization_id, 'System Admin', 'Administers system configuration and organization setup.'),
    (default_organization_id, 'Finance Admin', 'Configures finance imports, mappings, reporting settings, and review workflows.'),
    (default_organization_id, 'Uploader', 'Uploads source files and starts import batches.'),
    (default_organization_id, 'Reviewer', 'Reviews import exceptions, variances, and report draft details.'),
    (default_organization_id, 'Approver', 'Approves posted data and finalized report outputs.'),
    (default_organization_id, 'Executive Viewer', 'Views executive summaries and approved reporting surfaces.'),
    (default_organization_id, 'Auditor', 'Views source traceability, audit history, and finalized reports.');

  insert into public.import_types (
    organization_id,
    import_type_code,
    import_type_name,
    import_type_description
  )
  values
    (default_organization_id, 'trial_balance', 'Trial Balance', 'Monthly trial balance actuals import.'),
    (default_organization_id, 'fund_mapping', 'Fund Mapping', 'Fund reference and classification mapping import.'),
    (default_organization_id, 'object_mapping', 'Object Mapping', 'Object code and account classification mapping import.'),
    (default_organization_id, 'acfr_mapping', 'ACFR Mapping', 'ACFR/function reporting classification import.'),
    (default_organization_id, 'department_mapping', 'Department Mapping', 'Department reference mapping import.'),
    (default_organization_id, 'function_mapping', 'Function Mapping', 'Function reference mapping import.');

  insert into public.account_structures (
    organization_id,
    structure_name,
    structure_description,
    delimiter,
    segment_count,
    trim_spaces,
    remove_trailing_delimiters,
    preserve_leading_zeros,
    version_number,
    active_status
  )
  values (
    default_organization_id,
    'City Standard Account Structure',
    'Seed account structure for configurable municipal account parsing.',
    '-',
    5,
    true,
    true,
    true,
    1,
    'active'
  )
  returning account_structure_id into city_account_structure_id;

  insert into public.account_segment_definitions (
    organization_id,
    account_structure_id,
    segment_number,
    segment_name,
    segment_key
  )
  values
    (default_organization_id, city_account_structure_id, 1, 'Fund', 'fund'),
    (default_organization_id, city_account_structure_id, 2, 'ACFR', 'acfr'),
    (default_organization_id, city_account_structure_id, 3, 'Department', 'department'),
    (default_organization_id, city_account_structure_id, 4, 'Function', 'function'),
    (default_organization_id, city_account_structure_id, 5, 'Object', 'object');

  insert into public.mapping_versions (
    organization_id,
    mapping_scope,
    mapping_version,
    version_name,
    active_status
  )
  values
    (default_organization_id, 'fund', 1, 'Initial fund mapping version', 'active'),
    (default_organization_id, 'acfr', 1, 'Initial ACFR mapping version', 'active'),
    (default_organization_id, 'department', 1, 'Initial department mapping version', 'active'),
    (default_organization_id, 'function', 1, 'Initial function mapping version', 'active'),
    (default_organization_id, 'object', 1, 'Initial object mapping version', 'active'),
    (default_organization_id, 'account_structure', 1, 'Initial account structure version', 'active');

  insert into public.threshold_configs (
    organization_id,
    threshold_name,
    threshold_scope,
    dollar_threshold,
    percentage_threshold,
    config_payload
  )
  values (
    default_organization_id,
    'Default Materiality Threshold Shell',
    'organization',
    null,
    null,
    '{"note": "Configuration shell only. Calculation logic is implemented in a later slice."}'::jsonb
  );

  insert into public.report_templates (
    organization_id,
    template_name,
    template_description,
    report_type
  )
  values (
    default_organization_id,
    'Monthly Finance Report Shell',
    'Baseline shell for future reproducible monthly finance reports.',
    'monthly_finance_report'
  )
  returning report_template_id into default_report_template_id;

  insert into public.report_template_versions (
    organization_id,
    report_template_id,
    version_number,
    version_status,
    template_payload
  )
  values (
    default_organization_id,
    default_report_template_id,
    1,
    'active',
    '{"sections": ["cover", "executive_summary", "financial_position", "revenues", "expenditures", "fund_summary", "exceptions", "appendix"], "note": "Shell only. Report generation is implemented in a later slice."}'::jsonb
  );
end $$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'organizations',
    'app_users',
    'roles',
    'user_roles',
    'fiscal_years',
    'fiscal_periods',
    'account_structures',
    'account_segment_definitions',
    'import_types',
    'import_templates',
    'import_template_versions',
    'sheet_mappings',
    'field_mappings',
    'transformation_rules',
    'validation_rules',
    'source_files',
    'import_batches',
    'import_exceptions',
    'mapping_versions',
    'funds',
    'acfr_mappings',
    'departments',
    'functions',
    'objects',
    'trial_balance_lines',
    'trial_balance_line_segments',
    'threshold_configs',
    'calculation_runs',
    'financial_summary_results',
    'statement_summary_results',
    'variance_results',
    'trend_results',
    'exception_results',
    'report_templates',
    'report_template_versions',
    'report_instances',
    'report_parameters',
    'report_comments',
    'report_exports',
    'report_import_batches',
    'report_mapping_versions',
    'audit_logs',
    'inactivation_requests',
    'reactivation_requests'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end $$;

