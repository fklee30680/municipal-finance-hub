create table if not exists public.posting_runs (
  posting_run_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(organization_id),
  import_batch_id uuid not null references public.import_batches(import_batch_id),
  source_file_id uuid not null references public.source_files(source_file_id),
  import_template_version_id uuid references public.import_template_versions(template_version_id),
  account_structure_id uuid references public.account_structures(account_structure_id),
  validation_run_id uuid not null references public.validation_runs(validation_run_id),
  status text not null default 'running' check (status in ('running', 'posted', 'failed', 'superseded', 'reactivated')),
  posted_row_count integer not null default 0,
  rejected_row_count integer not null default 0,
  posting_mode text not null default 'normal' check (posting_mode in ('normal', 'replacement', 'reactivation')),
  posted_by uuid references public.app_users(user_id),
  posted_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.posting_run_mapping_versions (
  posting_run_mapping_version_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(organization_id),
  posting_run_id uuid not null references public.posting_runs(posting_run_id),
  mapping_version_id uuid not null references public.mapping_versions(mapping_version_id),
  mapping_type text not null check (mapping_type in ('fund', 'object', 'acfr', 'department', 'function')),
  created_at timestamptz not null default now(),
  unique (posting_run_id, mapping_version_id)
);

alter table public.trial_balance_lines
  add column if not exists validation_run_id uuid references public.validation_runs(validation_run_id),
  add column if not exists posting_run_id uuid references public.posting_runs(posting_run_id),
  add column if not exists active_status text not null default 'active' check (active_status in ('active', 'inactive', 'superseded', 'archived'));

alter table public.trial_balance_line_segments
  add column if not exists segment_position integer,
  add column if not exists segment_name text,
  add column if not exists segment_type text;

update public.trial_balance_line_segments
set segment_position = coalesce(segment_position, segment_number),
    segment_name = coalesce(segment_name, segment_key),
    segment_type = coalesce(segment_type, segment_key)
where segment_position is null
   or segment_name is null
   or segment_type is null;

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
      'posted_with_exceptions',
      'inactive',
      'rejected',
      'failed',
      'superseded',
      'archived'
    )
  );

alter table public.inactivation_requests
  add column if not exists entity_type text,
  add column if not exists entity_id uuid,
  add column if not exists existing_import_batch_id uuid references public.import_batches(import_batch_id),
  add column if not exists replacement_import_batch_id uuid references public.import_batches(import_batch_id),
  add column if not exists requested_action text,
  add column if not exists approval_status text,
  add column if not exists approval_reason text,
  add column if not exists approved_by uuid references public.app_users(user_id),
  add column if not exists approved_at timestamptz,
  add column if not exists rejected_by uuid references public.app_users(user_id),
  add column if not exists rejected_at timestamptz;

update public.inactivation_requests
set entity_type = coalesce(entity_type, target_entity_table),
    entity_id = coalesce(entity_id, target_entity_id),
    approval_status = coalesce(approval_status, request_status)
where entity_type is null
   or entity_id is null
   or approval_status is null;

alter table public.reactivation_requests
  add column if not exists entity_type text,
  add column if not exists entity_id uuid,
  add column if not exists approval_status text,
  add column if not exists approval_reason text,
  add column if not exists approved_by uuid references public.app_users(user_id),
  add column if not exists approved_at timestamptz,
  add column if not exists rejected_by uuid references public.app_users(user_id),
  add column if not exists rejected_at timestamptz,
  add column if not exists conflict_status text;

update public.reactivation_requests
set entity_type = coalesce(entity_type, target_entity_table),
    entity_id = coalesce(entity_id, target_entity_id),
    approval_status = coalesce(approval_status, request_status)
where entity_type is null
   or entity_id is null
   or approval_status is null;

create or replace view public.active_trial_balance_lines
with (security_invoker = true)
as
select tbl.*
from public.trial_balance_lines tbl
join public.import_batches ib
  on ib.import_batch_id = tbl.import_batch_id
where tbl.is_active_for_reporting = true
  and tbl.active_status = 'active'
  and ib.is_active_for_reporting = true
  and ib.reporting_status = 'included'
  and ib.active_status = 'active'
  and ib.batch_status in ('posted', 'posted_with_exceptions')
  and ib.superseded_by_import_batch_id is null;

alter table public.posting_runs enable row level security;
alter table public.posting_run_mapping_versions enable row level security;

create index if not exists idx_posting_runs_batch
  on public.posting_runs (organization_id, import_batch_id, created_at desc);

create index if not exists idx_posting_runs_validation
  on public.posting_runs (validation_run_id, status);

create index if not exists idx_posting_runs_period
  on public.posting_runs (organization_id, status, posting_mode);

create index if not exists idx_posting_run_mapping_versions_run
  on public.posting_run_mapping_versions (posting_run_id, mapping_type);

create index if not exists idx_trial_balance_lines_validation
  on public.trial_balance_lines (validation_run_id);

create index if not exists idx_trial_balance_lines_posting
  on public.trial_balance_lines (posting_run_id);

create index if not exists idx_trial_balance_lines_active_period
  on public.trial_balance_lines (organization_id, fiscal_year, period, is_active_for_reporting, active_status);

create index if not exists idx_inactivation_requests_replacement
  on public.inactivation_requests (organization_id, requested_action, approval_status, replacement_import_batch_id);

create index if not exists idx_reactivation_requests_entity
  on public.reactivation_requests (organization_id, entity_type, entity_id, approval_status);
