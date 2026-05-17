create table if not exists public.import_preview_runs (
  preview_run_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(organization_id),
  import_batch_id uuid not null references public.import_batches(import_batch_id),
  source_file_id uuid not null references public.source_files(source_file_id),
  import_template_version_id uuid not null references public.import_template_versions(template_version_id),
  account_structure_id uuid not null references public.account_structures(account_structure_id),
  preview_status text not null default 'completed' check (preview_status in ('completed', 'failed', 'superseded')),
  row_count integer not null default 0,
  previewed_row_count integer not null default 0,
  rows_with_preview_issues integer not null default 0,
  total_beginning_balance numeric(18,2) not null default 0,
  total_debits numeric(18,2) not null default 0,
  total_credits numeric(18,2) not null default 0,
  total_net_change numeric(18,2) not null default 0,
  total_ending_balance numeric(18,2) not null default 0,
  created_by uuid references public.app_users(user_id),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  superseded_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.import_preview_rows (
  preview_row_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(organization_id),
  preview_run_id uuid not null references public.import_preview_runs(preview_run_id),
  import_batch_id uuid not null references public.import_batches(import_batch_id),
  source_file_id uuid not null references public.source_files(source_file_id),
  import_template_version_id uuid not null references public.import_template_versions(template_version_id),
  account_structure_id uuid not null references public.account_structures(account_structure_id),
  source_row_number integer not null,
  full_account_number text,
  fund_code text,
  acfr_code text,
  department_code text,
  function_code text,
  object_code text,
  account_name text,
  beginning_balance numeric(18,2),
  debits numeric(18,2),
  credits numeric(18,2),
  net_change numeric(18,2),
  ending_balance numeric(18,2),
  raw_row_json jsonb not null default '{}'::jsonb,
  transformed_row_json jsonb not null default '{}'::jsonb,
  has_issue boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.import_preview_issues (
  preview_issue_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(organization_id),
  preview_run_id uuid not null references public.import_preview_runs(preview_run_id),
  preview_row_id uuid references public.import_preview_rows(preview_row_id),
  import_batch_id uuid not null references public.import_batches(import_batch_id),
  source_row_number integer,
  issue_code text not null,
  issue_message text not null,
  issue_severity text not null default 'warning' check (issue_severity in ('info', 'warning', 'error')),
  source_column_name text,
  target_field_name text,
  raw_value text,
  transformed_value text,
  created_at timestamptz not null default now()
);

alter table public.import_batches
  drop constraint if exists import_batches_batch_status_check;

alter table public.import_batches
  add constraint import_batches_batch_status_check check (
    batch_status in ('draft', 'uploaded', 'previewed', 'validated', 'approved', 'posted', 'failed', 'superseded', 'archived')
  );

alter table public.import_preview_runs enable row level security;
alter table public.import_preview_rows enable row level security;
alter table public.import_preview_issues enable row level security;

create index if not exists idx_import_preview_runs_batch
  on public.import_preview_runs (organization_id, import_batch_id, created_at desc);

create index if not exists idx_import_preview_runs_status
  on public.import_preview_runs (organization_id, preview_status);

create index if not exists idx_import_preview_rows_run
  on public.import_preview_rows (preview_run_id, source_row_number);

create index if not exists idx_import_preview_rows_issue
  on public.import_preview_rows (preview_run_id, has_issue);

create index if not exists idx_import_preview_issues_run
  on public.import_preview_issues (preview_run_id, source_row_number);
