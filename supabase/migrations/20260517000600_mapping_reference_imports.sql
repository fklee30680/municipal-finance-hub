create table if not exists public.mapping_import_runs (
  mapping_import_run_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(organization_id),
  import_batch_id uuid not null references public.import_batches(import_batch_id),
  source_file_id uuid not null references public.source_files(source_file_id),
  import_template_version_id uuid not null references public.import_template_versions(template_version_id),
  mapping_type text not null check (mapping_type in ('fund_mapping', 'object_mapping', 'acfr_mapping', 'department_mapping', 'function_mapping')),
  target_table text not null check (target_table in ('funds', 'objects', 'acfr_mappings', 'departments', 'functions')),
  selected_sheet_name text,
  selected_sheet_index integer,
  run_status text not null default 'previewed' check (run_status in ('previewed', 'committed', 'superseded', 'failed')),
  row_count integer not null default 0,
  rows_accepted integer not null default 0,
  rows_rejected integer not null default 0,
  rows_with_warnings integer not null default 0,
  new_mappings integer not null default 0,
  changed_mappings integer not null default 0,
  unchanged_mappings integer not null default 0,
  duplicate_rows integer not null default 0,
  conflicting_rows integer not null default 0,
  default_effective_start_date date,
  mapping_version_id uuid references public.mapping_versions(mapping_version_id),
  created_by uuid references public.app_users(user_id),
  created_at timestamptz not null default now(),
  committed_by uuid references public.app_users(user_id),
  committed_at timestamptz,
  superseded_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.mapping_import_rows (
  mapping_import_row_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(organization_id),
  mapping_import_run_id uuid not null references public.mapping_import_runs(mapping_import_run_id),
  import_batch_id uuid not null references public.import_batches(import_batch_id),
  source_file_id uuid not null references public.source_files(source_file_id),
  import_template_version_id uuid not null references public.import_template_versions(template_version_id),
  mapping_type text not null,
  target_table text not null,
  source_row_number integer not null,
  mapping_code text,
  mapping_name text,
  row_status text not null check (row_status in ('new', 'changed', 'unchanged', 'rejected', 'warning', 'conflict', 'duplicate')),
  accepted_for_commit boolean not null default false,
  effective_start_date date,
  effective_end_date date,
  active_status text,
  incoming_row_json jsonb not null default '{}'::jsonb,
  current_row_json jsonb not null default '{}'::jsonb,
  changed_fields_json jsonb not null default '{}'::jsonb,
  raw_row_json jsonb not null default '{}'::jsonb,
  transformed_row_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.mapping_import_issues (
  mapping_import_issue_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(organization_id),
  mapping_import_run_id uuid not null references public.mapping_import_runs(mapping_import_run_id),
  mapping_import_row_id uuid references public.mapping_import_rows(mapping_import_row_id),
  import_batch_id uuid not null references public.import_batches(import_batch_id),
  source_row_number integer,
  source_column_name text,
  target_field_name text,
  raw_value text,
  transformed_value text,
  issue_type text not null,
  issue_severity text not null default 'warning' check (issue_severity in ('info', 'warning', 'error')),
  issue_message text not null,
  suggested_fix text,
  created_at timestamptz not null default now()
);

alter table public.mapping_versions
  add column if not exists import_batch_id uuid references public.import_batches(import_batch_id),
  add column if not exists source_file_id uuid references public.source_files(source_file_id),
  add column if not exists import_template_version_id uuid references public.import_template_versions(template_version_id),
  add column if not exists change_description text;

alter table public.funds
  add column if not exists fund_group text,
  add column if not exists major_fund_flag text,
  add column if not exists source_method text not null default 'import' check (source_method in ('import', 'manual')),
  add column if not exists source_import_batch_id uuid references public.import_batches(import_batch_id),
  add column if not exists source_file_id uuid references public.source_files(source_file_id),
  add column if not exists import_template_version_id uuid references public.import_template_versions(template_version_id),
  add column if not exists change_reason text;

alter table public.objects
  add column if not exists balance_sheet_category text,
  add column if not exists account_type_detailed text,
  add column if not exists source_method text not null default 'import' check (source_method in ('import', 'manual')),
  add column if not exists source_import_batch_id uuid references public.import_batches(import_batch_id),
  add column if not exists source_file_id uuid references public.source_files(source_file_id),
  add column if not exists import_template_version_id uuid references public.import_template_versions(template_version_id),
  add column if not exists change_reason text;

alter table public.acfr_mappings
  add column if not exists acfr_description text,
  add column if not exists source_method text not null default 'import' check (source_method in ('import', 'manual')),
  add column if not exists source_import_batch_id uuid references public.import_batches(import_batch_id),
  add column if not exists source_file_id uuid references public.source_files(source_file_id),
  add column if not exists import_template_version_id uuid references public.import_template_versions(template_version_id),
  add column if not exists change_reason text;

alter table public.departments
  add column if not exists source_method text not null default 'import' check (source_method in ('import', 'manual')),
  add column if not exists source_import_batch_id uuid references public.import_batches(import_batch_id),
  add column if not exists source_file_id uuid references public.source_files(source_file_id),
  add column if not exists import_template_version_id uuid references public.import_template_versions(template_version_id),
  add column if not exists change_reason text;

alter table public.functions
  add column if not exists function_description text,
  add column if not exists source_method text not null default 'import' check (source_method in ('import', 'manual')),
  add column if not exists source_import_batch_id uuid references public.import_batches(import_batch_id),
  add column if not exists source_file_id uuid references public.source_files(source_file_id),
  add column if not exists import_template_version_id uuid references public.import_template_versions(template_version_id),
  add column if not exists change_reason text;

alter table public.import_batches
  drop constraint if exists import_batches_batch_status_check;

alter table public.import_batches
  add constraint import_batches_batch_status_check check (
    batch_status in ('draft', 'uploaded', 'previewed', 'mapping_imported', 'validated', 'approved', 'posted', 'failed', 'superseded', 'archived')
  );

alter table public.mapping_import_runs enable row level security;
alter table public.mapping_import_rows enable row level security;
alter table public.mapping_import_issues enable row level security;

create index if not exists idx_mapping_import_runs_batch
  on public.mapping_import_runs (organization_id, import_batch_id, created_at desc);

create index if not exists idx_mapping_import_runs_type
  on public.mapping_import_runs (organization_id, mapping_type, run_status);

create index if not exists idx_mapping_import_rows_run
  on public.mapping_import_rows (mapping_import_run_id, source_row_number);

create index if not exists idx_mapping_import_rows_status
  on public.mapping_import_rows (mapping_import_run_id, row_status, accepted_for_commit);

create index if not exists idx_mapping_import_issues_run
  on public.mapping_import_issues (mapping_import_run_id, source_row_number);

create index if not exists idx_mapping_versions_import_batch
  on public.mapping_versions (organization_id, import_batch_id);

create index if not exists idx_funds_import_source
  on public.funds (organization_id, source_import_batch_id, mapping_version_id);

create index if not exists idx_objects_import_source
  on public.objects (organization_id, source_import_batch_id, mapping_version_id);

create index if not exists idx_acfr_mappings_import_source
  on public.acfr_mappings (organization_id, source_import_batch_id, mapping_version_id);

create index if not exists idx_departments_import_source
  on public.departments (organization_id, source_import_batch_id, mapping_version_id);

create index if not exists idx_functions_import_source
  on public.functions (organization_id, source_import_batch_id, mapping_version_id);
