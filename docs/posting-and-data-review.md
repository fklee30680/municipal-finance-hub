# Posting and Data Review

Slice 8 promotes eligible, validated trial balance imports into governed reporting data.

Posting is available only for `trial_balance` import batches. The posting workflow consumes the latest completed Slice 7 validation run and its validated preview rows. It does not reread raw source files, reinterpret templates, parse files, run calculations, update dashboards, generate reports, import budgets, or add AI commentary.

## Posting Rules

An import can be posted only when:

- The import type is `trial_balance`.
- A completed validation run exists.
- The validation run is eligible to post.
- Critical errors are absent.
- Warnings are acknowledged when required.
- Fiscal year and period are present.
- No unresolved active-period conflict exists.
- The user has a conservative posting role: System Admin, Finance Admin, or Approver.

Posted rows are inserted into `trial_balance_lines` and account segment rows are inserted into `trial_balance_line_segments`. Posted rows are marked `is_active_for_reporting = true` only after posting succeeds.

Posted rows retain lineage to:

- Organization.
- Fiscal year and period.
- Import batch.
- Source file.
- Template version.
- Account structure.
- Validation run.
- Posting run.
- Mapping versions through validation/posting linkage.

## Period Conflicts

The default rule is one active posted trial balance import per organization, fiscal year, and period. If active posted data already exists for the same period, normal posting is blocked.

The user can request replacement. Replacement approval supersedes the prior active import and marks the old trial balance rows inactive/superseded before posting the replacement import active. The old source file, rows, validation, posting, and audit history remain stored.

## Inactivation and Reactivation

Inactive and superseded imports are excluded from default active views, including `active_trial_balance_lines`, but remain visible through review filters.

Reactivation requires:

- A user request.
- Approval by a posting role.
- Conflict check against active period data.
- Audit logging.

If reactivation would create more than one active posted import for the same fiscal year and period, it is blocked or rejected.

## Review Screens

Slice 8 adds:

- Posting confirmation at `/imports/{importBatchId}/post`.
- Import lineage review at `/imports/{importBatchId}/review`.
- Period review at `/imports/periods`.
- Replacement request review at `/imports/replacement-requests`.
- Reactivation request review at `/imports/reactivation-requests`.

These screens are operational review and control surfaces. They do not calculate financial metrics or feed dashboards directly.

## Migration

Slice 8 adds:

```text
supabase/migrations/20260519234331_post_validated_trial_balance.sql
```

The migration adds posting run tables, posting/mapping-version linkage, lineage columns on posted trial balance rows, segment metadata fields, replacement/reactivation metadata, and an updated active trial balance view that excludes inactive and superseded imports.

Apply this migration before using Slice 8 in Supabase/Vercel.
