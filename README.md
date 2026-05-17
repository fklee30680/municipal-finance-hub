# Municipal Finance Reporting Hub

Municipal Finance Reporting Hub is a web-based reporting and analysis layer for municipal finance teams. It is intended to support configurable imports, raw file preservation, normalized financial storage, account parsing, mapping and classification, trend and variance analysis, dashboards, and recurring Monthly Finance Reports.

The app is not an ERP replacement, accounting system of record, journal-entry system, audited financial statement generator, budget module, or AI commentary system in Slice 0.

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

Slice 0 intentionally does not implement imports, mappings, validation, finance calculations, dashboards, report generation, budget functionality, role workflows, or AI commentary.

## Documentation

- `docs/product-spec.md`
- `docs/build-plan.md`
- `docs/codex-instructions.md`
- `docs/architecture-decisions.md`
- `TASKS.md`

## Deployment Target

The project is intended for Vercel. Deployment should wait until the GitHub repository, Supabase project, and required environment variables are ready.
