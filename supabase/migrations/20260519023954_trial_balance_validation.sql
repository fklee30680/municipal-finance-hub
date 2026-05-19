create table if not exists public.validation_runs (
  validation_run_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(organization_id),
  import_batch_id uuid not null references public.import_batches(import_batch_id),
  source_file_id uuid not null references public.source_files(source_file_id),
  import_template_version_id uuid not null references public.import_template_versions(template_version_id),
  account_structure_id uuid not null references public.account_structures(account_structure_id),
  preview_run_id uuid not null references public.import_preview_runs(preview_run_id),
  status text not null default 'completed' check (status in ('running', 'completed', 'failed', 'superseded')),
  eligible_to_post boolean not null default false,
  warnings_acknowledged boolean not null default false,
  critical_error_count integer not null default 0,
  warning_count integer not null default 0,
  information_count integer not null default 0,
  rows_detected integer not null default 0,
  rows_validated integer not null default 0,
  rows_rejected integer not null default 0,
  validated_by uuid references public.app_users(user_id),
  validated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  superseded_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.validation_run_mapping_versions (
  validation_run_mapping_version_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(organization_id),
  validation_run_id uuid not null references public.validation_runs(validation_run_id),
  mapping_version_id uuid not null references public.mapping_versions(mapping_version_id),
  mapping_type text not null check (mapping_type in ('fund', 'object', 'acfr', 'department', 'function')),
  created_at timestamptz not null default now(),
  unique (validation_run_id, mapping_version_id)
);

create table if not exists public.warning_acknowledgements (
  warning_acknowledgement_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(organization_id),
  validation_run_id uuid not null references public.validation_runs(validation_run_id),
  import_batch_id uuid not null references public.import_batches(import_batch_id),
  acknowledged_by uuid not null references public.app_users(user_id),
  acknowledged_at timestamptz not null default now(),
  acknowledgement_note text,
  warning_count_acknowledged integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.import_exceptions
  add column if not exists validation_run_id uuid references public.validation_runs(validation_run_id),
  add column if not exists preview_run_id uuid references public.import_preview_runs(preview_run_id),
  add column if not exists preview_row_id uuid references public.import_preview_rows(preview_row_id),
  add column if not exists sheet_name text,
  add column if not exists row_number integer,
  add column if not exists source_column_name text,
  add column if not exists target_field_name text,
  add column if not exists raw_value text,
  add column if not exists transformed_value text,
  add column if not exists suggested_fix text,
  add column if not exists resolution_status text;

alter table public.import_exceptions
  drop constraint if exists import_exceptions_severity_check;

alter table public.import_exceptions
  add constraint import_exceptions_severity_check check (
    severity in ('critical_error', 'warning', 'information', 'error', 'info')
  );

alter table public.import_exceptions
  drop constraint if exists import_exceptions_resolution_status_check;

alter table public.import_exceptions
  add constraint import_exceptions_resolution_status_check check (
    resolution_status is null or resolution_status in ('open', 'acknowledged', 'resolved', 'waived')
  );

alter table public.import_batches
  drop constraint if exists import_batches_batch_status_check;

alter table public.import_batches
  add constraint import_batches_batch_status_check check (
    batch_status in (
      'draft',
      'uploaded',
      'previewed',
      'mapping_imported',
      'validation_failed',
      'validated_with_warnings',
      'validated',
      'approved',
      'posted',
      'failed',
      'superseded',
      'archived'
    )
  );

alter table public.validation_runs enable row level security;
alter table public.validation_run_mapping_versions enable row level security;
alter table public.warning_acknowledgements enable row level security;

create index if not exists idx_validation_runs_batch
  on public.validation_runs (organization_id, import_batch_id, created_at desc);

create index if not exists idx_validation_runs_preview
  on public.validation_runs (preview_run_id, status);

create index if not exists idx_validation_runs_eligibility
  on public.validation_runs (organization_id, eligible_to_post, status);

create index if not exists idx_validation_run_mapping_versions_run
  on public.validation_run_mapping_versions (validation_run_id, mapping_type);

create index if not exists idx_warning_acknowledgements_run
  on public.warning_acknowledgements (validation_run_id, acknowledged_at desc);

create index if not exists idx_import_exceptions_validation_run
  on public.import_exceptions (validation_run_id, severity, exception_status);

create index if not exists idx_import_exceptions_preview_row
  on public.import_exceptions (preview_run_id, preview_row_id);
