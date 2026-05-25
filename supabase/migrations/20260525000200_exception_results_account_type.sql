alter table public.exception_results
  add column if not exists account_type text;

create index if not exists idx_exception_results_account_type
  on public.exception_results (organization_id, calculation_run_id, account_type);
