create table if not exists public.organization_settings (
  organization_settings_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(organization_id),
  organization_display_name text not null,
  current_fiscal_year text,
  fiscal_year_start_date date,
  fiscal_year_end_date date,
  standard_period_count integer not null default 12 check (standard_period_count > 0),
  enable_period_0 boolean not null default false,
  enable_period_13 boolean not null default false,
  enable_accrual_reporting boolean not null default false,
  period_0_label text not null default 'Period 0',
  period_13_label text not null default 'Period 13',
  default_report_period_mode text not null default 'standard',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id),
  constraint organization_settings_report_period_mode_check
    check (default_report_period_mode in ('standard', 'include_period_0', 'include_period_13', 'accrual', 'year_end')),
  constraint organization_settings_fiscal_dates_check
    check (
      fiscal_year_start_date is null
      or fiscal_year_end_date is null
      or fiscal_year_start_date < fiscal_year_end_date
    )
);

alter table public.fiscal_periods
  drop constraint if exists fiscal_periods_period_check;

alter table public.fiscal_periods
  add constraint fiscal_periods_period_check check (period between 0 and 13);

create index if not exists idx_organization_settings_org
  on public.organization_settings (organization_id);

create index if not exists idx_organization_settings_report_mode
  on public.organization_settings (default_report_period_mode);

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'set_organization_settings_updated_at'
  ) then
    create trigger set_organization_settings_updated_at
      before update on public.organization_settings
      for each row
      execute function public.set_updated_at();
  end if;
end $$;

alter table public.organization_settings enable row level security;

do $$
declare
  default_organization_id uuid;
  city_account_structure_id uuid;
  monthly_report_template_id uuid;
begin
  insert into public.organizations (
    organization_name,
    organization_type
  )
  select
    'Default Municipal Organization',
    'municipality'
  where not exists (
    select 1
    from public.organizations
    where organization_name = 'Default Municipal Organization'
  );

  select organization_id
  into default_organization_id
  from public.organizations
  where organization_name = 'Default Municipal Organization'
  order by created_at
  limit 1;

  insert into public.organization_settings (
    organization_id,
    organization_display_name,
    current_fiscal_year,
    fiscal_year_start_date,
    fiscal_year_end_date,
    standard_period_count,
    enable_period_0,
    enable_period_13,
    enable_accrual_reporting,
    period_0_label,
    period_13_label,
    default_report_period_mode
  )
  values (
    default_organization_id,
    'Default Municipal Organization',
    null,
    null,
    null,
    12,
    false,
    false,
    false,
    'Period 0',
    'Period 13',
    'standard'
  )
  on conflict (organization_id) do nothing;

  insert into public.roles (
    organization_id,
    role_name,
    role_description,
    active_status
  )
  values
    (default_organization_id, 'System Admin', 'Administers system configuration and organization setup.', 'active'),
    (default_organization_id, 'Finance Admin', 'Configures finance imports, mappings, reporting settings, and review workflows.', 'active'),
    (default_organization_id, 'Importer', 'Uploads source files and prepares configurable imports.', 'active'),
    (default_organization_id, 'Reviewer', 'Reviews import exceptions, variances, and report draft details.', 'active'),
    (default_organization_id, 'Approver', 'Approves posted data and finalized report outputs.', 'active'),
    (default_organization_id, 'Viewer', 'Views approved reporting surfaces and finalized outputs.', 'active')
  on conflict (organization_id, role_name) do update set
    role_description = excluded.role_description,
    active_status = excluded.active_status,
    updated_at = now();

  insert into public.import_types (
    organization_id,
    import_type_code,
    import_type_name,
    import_type_description,
    active_status
  )
  values
    (default_organization_id, 'trial_balance', 'Trial Balance', 'Monthly trial balance actuals import.', 'active'),
    (default_organization_id, 'fund_mapping', 'Fund Mapping', 'Fund reference and classification mapping import.', 'active'),
    (default_organization_id, 'object_mapping', 'Object Mapping', 'Object code and account classification mapping import.', 'active'),
    (default_organization_id, 'acfr_mapping', 'ACFR Mapping', 'ACFR/function reporting classification import.', 'active'),
    (default_organization_id, 'department_mapping', 'Department Mapping', 'Department reference mapping import.', 'active'),
    (default_organization_id, 'function_mapping', 'Function Mapping', 'Function reference mapping import.', 'active')
  on conflict (organization_id, import_type_code) do update set
    import_type_name = excluded.import_type_name,
    import_type_description = excluded.import_type_description,
    active_status = excluded.active_status,
    updated_at = now();

  select account_structure_id
  into city_account_structure_id
  from public.account_structures
  where organization_id = default_organization_id
    and structure_name = 'City Standard Account Structure'
    and version_number = 1
  limit 1;

  if city_account_structure_id is null then
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
  else
    update public.account_structures
    set
      delimiter = '-',
      segment_count = 5,
      trim_spaces = true,
      remove_trailing_delimiters = true,
      preserve_leading_zeros = true,
      active_status = 'active',
      updated_at = now()
    where account_structure_id = city_account_structure_id;
  end if;

  insert into public.account_segment_definitions (
    organization_id,
    account_structure_id,
    segment_number,
    segment_name,
    segment_key,
    active_status
  )
  values
    (default_organization_id, city_account_structure_id, 1, 'Fund', 'fund', 'active'),
    (default_organization_id, city_account_structure_id, 2, 'ACFR', 'acfr', 'active'),
    (default_organization_id, city_account_structure_id, 3, 'Department', 'department', 'active'),
    (default_organization_id, city_account_structure_id, 4, 'Function', 'function', 'active'),
    (default_organization_id, city_account_structure_id, 5, 'Object', 'object', 'active')
  on conflict (account_structure_id, segment_number) do update set
    segment_name = excluded.segment_name,
    segment_key = excluded.segment_key,
    active_status = excluded.active_status,
    updated_at = now();

  insert into public.report_templates (
    organization_id,
    template_name,
    template_description,
    report_type,
    active_status
  )
  values (
    default_organization_id,
    'Monthly Finance Report',
    'Configuration shell for future reproducible Monthly Finance Reports.',
    'monthly_finance_report',
    'active'
  )
  on conflict (organization_id, template_name) do update set
    template_description = excluded.template_description,
    report_type = excluded.report_type,
    active_status = excluded.active_status,
    updated_at = now();

  select report_template_id
  into monthly_report_template_id
  from public.report_templates
  where organization_id = default_organization_id
    and template_name = 'Monthly Finance Report'
  limit 1;

  insert into public.report_template_versions (
    organization_id,
    report_template_id,
    version_number,
    version_status,
    template_payload
  )
  values (
    default_organization_id,
    monthly_report_template_id,
    1,
    'active',
    '{"sections": ["cover", "executive_summary", "financial_position", "revenues", "expenditures", "fund_summary", "exceptions", "appendix"], "note": "Shell only. Report generation is implemented in a later slice."}'::jsonb
  )
  on conflict (report_template_id, version_number) do update set
    version_status = excluded.version_status,
    template_payload = excluded.template_payload,
    updated_at = now();
end $$;
