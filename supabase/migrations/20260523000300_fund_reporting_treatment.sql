-- Add fund reporting treatment controls.
-- active_status remains the valid/usable-code flag. These fields control
-- whether active funds participate in normal reporting or reconciliation flows.

alter table public.funds
  add column if not exists reporting_treatment text not null default 'reportable',
  add column if not exists include_in_standard_reporting boolean not null default true,
  add column if not exists include_in_cash_reconciliation boolean not null default false,
  add column if not exists reporting_exclusion_reason text;

alter table public.funds
  drop constraint if exists funds_reporting_treatment_check;

alter table public.funds
  add constraint funds_reporting_treatment_check
  check (
    reporting_treatment in (
      'reportable',
      'pooled_cash',
      'reconciliation_only',
      'clearing',
      'elimination',
      'internal_service',
      'fiduciary_excluded',
      'other_excluded'
    )
  );

create index if not exists idx_funds_reporting_treatment
  on public.funds (
    organization_id,
    active_status,
    include_in_standard_reporting,
    include_in_cash_reconciliation,
    reporting_treatment
  );

comment on column public.funds.active_status is
  'Whether the fund code is valid and usable.';

comment on column public.funds.reporting_treatment is
  'How the fund participates in reporting or reconciliation, such as reportable, pooled_cash, clearing, or other_excluded.';

comment on column public.funds.include_in_standard_reporting is
  'Whether the active fund is included in normal financial statement/dashboard rollups.';

comment on column public.funds.include_in_cash_reconciliation is
  'Whether the active fund is included in cash or consolidated reconciliation workflows.';

comment on column public.funds.reporting_exclusion_reason is
  'User-readable reason explaining why a fund is excluded from standard reporting or otherwise specially treated.';
