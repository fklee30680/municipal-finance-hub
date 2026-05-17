alter table public.import_template_versions
  add column if not exists source_file_id uuid references public.source_files(source_file_id),
  add column if not exists file_type text,
  add column if not exists header_row_default integer,
  add column if not exists data_start_row_default integer,
  add column if not exists data_end_rule text,
  add column if not exists source_sample_payload jsonb not null default '{}'::jsonb;

alter table public.sheet_mappings
  add column if not exists target_import_type_id uuid references public.import_types(import_type_id),
  add column if not exists target_entity text,
  add column if not exists ignore_sheet boolean not null default false;

alter table public.field_mappings
  add column if not exists source_column_index integer,
  add column if not exists target_entity text,
  add column if not exists default_value text,
  add column if not exists ignore_column boolean not null default false;

create index if not exists idx_import_template_versions_source_file
  on public.import_template_versions (source_file_id);

create index if not exists idx_import_template_versions_file_type
  on public.import_template_versions (organization_id, file_type);

create index if not exists idx_sheet_mappings_target
  on public.sheet_mappings (template_version_id, target_entity, ignore_sheet);

create index if not exists idx_field_mappings_target
  on public.field_mappings (template_version_id, target_field_name, ignore_column);
