# Municipal Finance Reporting Hub

Municipal Finance Reporting Hub is a web-based reporting and analysis layer for municipal finance teams. It is intended to support configurable imports, raw file preservation, normalized financial storage, account parsing, mapping and classification, trend and variance analysis, dashboards, and recurring Monthly Finance Reports.

The app is not an ERP replacement, accounting system of record, journal-entry system, audited financial statement generator, budget module, or AI commentary system in Slice 0.
Budget import, budget-to-actual reporting, and AI commentary remain deferred beyond the current build slices.

## Technology Baseline

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn-compatible component organization
- Supabase PostgreSQL, Auth, Storage, and SQL migrations
- Vercel hosting target

## Local Setup

Install dependencies:

```bash
npm install
```

Create `.env.local` from the example:

```bash
cp .env.example .env.local
```

Populate the Supabase values when the project exists:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_NAME`

Run the development server:

```bash
npm run dev
```

## Checks

```bash
npm run lint
npm run typecheck
npm run build
```

## Current Scope

Slice 0 creates only the technical foundation:

- App Router pages for Home, Login, Imports, Dashboard, Reports, and Settings.
- A simple conservative app shell.
- Supabase client/server/admin helper structure.
- Migration and fixtures folders.
- Documentation and task tracking.

Slice 2 adds a setup configuration foundation for organization and fiscal calendar settings. The setup page is read-only until later slices add safe editing workflows.

Slice 3 adds raw file upload and source storage. Uploaded files are preserved in Supabase Storage and linked to import batch shells, but they are not parsed, validated, posted, or used for dashboards and reports yet.

Slice 4 adds import template management. Templates describe how to read uploaded file layouts, but they still do not validate, post, calculate, dashboard, or report financial data.

Slice 5 adds trial balance preview parsing for CSV and Excel source files using saved template versions. Preview rows, parsed account segments, preview issues, and summary totals are non-posted and are not active for reporting.

Slice 6 adds one-mapping-type-at-a-time reference imports for funds, objects, ACFR mappings, departments, and functions. Mapping imports preview bad data before commit, create mapping versions, and do not post trial balance activity.

Slice 7 adds trial balance validation and exception review. Validation determines posting eligibility, carries forward preview issues, checks committed mappings, and stores warning acknowledgements, but it does not post data.

Slice 8 adds governed posting and data review for validated trial balance imports. Posted rows become active for future reporting only after successful posting; replacement and reactivation require request/approval workflows and conflict checks.

Slice 9 adds governed analysis outputs for posted active trial balance rows. Calculation runs generate financial summaries, statement summaries, variances, trends, exceptions, and mapping coverage results while preserving trial balance lineage to import batches, posting runs, validation runs, account structure, thresholds, sign convention settings, and parameters. Reference imports remain lightweight setup data; mapping coverage reports missing or incomplete reference classifications.

The Import Workspace improves the user path across the completed import slices. Users can upload or resume a source file, inspect headers/sheets, map columns with detected or manual column references, save templates, preview, validate/review, and commit/post from one guided workspace while the governed backend records remain intact.

Trial balance imports also have a focused `/imports/trial-balance` workflow for
monthly and historical operating loads. It fixes the import type to trial
balance, uses configured fiscal periods, reuses the latest active saved trial
balance layout by default, and guides users through upload, preview,
validation, and post/replace without requiring the generic Import Workspace for
normal recurring loads.

Reference imports also have focused `/imports/funds`, `/imports/objects`, `/imports/acfr`, `/imports/departments`, and `/imports/functions` pages patterned after the invoice-management PO List Update flow. These pages use temporary preview rows, let users edit or exclude staged rows before commit, create mapping versions for committed inserts/updates, and show read-only reference tables.

Funds support separate reporting treatment controls so an active, valid fund can
be excluded from normal statement/dashboard rollups while remaining available
for cash or reconciliation workflows. This is intended for pooled cash,
clearing, elimination, and similar operational funds that should not be marked
inactive just to keep them out of standard reporting.

Current slices still intentionally do not implement dashboards, report generation, budget functionality, or AI commentary.

## Documentation

- `docs/product-spec.md`
- `docs/build-plan.md`
- `docs/codex-instructions.md`
- `docs/architecture-decisions.md`
- `docs/database-schema.md`
- `docs/fiscal-calendar.md`
- `docs/raw-file-upload.md`
- `docs/template-builder.md`
- `docs/trial-balance-preview.md`
- `docs/mapping-imports.md`
- `docs/trial-balance-validation.md`
- `docs/posting-and-data-review.md`
- `docs/import-workspace.md`
- `docs/analysis-outputs.md`
- `TASKS.md`

## Deployment Target

The project is intended for Vercel. Deployment should wait until the GitHub repository, Supabase project, and required environment variables are ready.
