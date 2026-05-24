alter table public.objects
  add column if not exists balance_sheet_line text,
  add column if not exists activity_statement_line text;

update public.objects
set balance_sheet_line = balance_sheet_category
where balance_sheet_line is null
  and balance_sheet_category is not null;

update public.objects
set activity_statement_line = statement_category
where activity_statement_line is null
  and statement_category is not null;

alter table public.financial_summary_results
  add column if not exists balance_sheet_line text,
  add column if not exists activity_statement_line text;
