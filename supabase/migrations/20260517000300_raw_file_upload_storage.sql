insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'source-files',
  'source-files',
  false,
  26214400,
  array[
    'text/csv',
    'application/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types,
  updated_at = now();

alter table public.source_files
  add column if not exists fiscal_year integer,
  add column if not exists period integer,
  add column if not exists duplicate_source_file_id uuid references public.source_files(source_file_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'source_files_period_check'
  ) then
    alter table public.source_files
      add constraint source_files_period_check check (period is null or period between 0 and 13);
  end if;
end $$;

create index if not exists idx_source_files_org_checksum
  on public.source_files (organization_id, checksum_sha256);

create index if not exists idx_source_files_org_period
  on public.source_files (organization_id, fiscal_year, period);

create index if not exists idx_source_files_duplicate
  on public.source_files (duplicate_source_file_id);
