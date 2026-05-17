# Architecture Decisions

- Use Next.js App Router and TypeScript.
- Use Supabase for PostgreSQL, Auth, and Storage.
- Use Supabase SQL migrations.
- Target Vercel for hosting.
- Preserve raw uploaded files.
- Use configurable imports and account structures.
- Do not hardcode file layouts.
- Do not physically delete imports in normal workflows.
- Exclude AI commentary through Slice 13.
- Exclude budget import and budget-to-actual through Slice 13.
- Respect governmental and proprietary fund reporting differences later.
- Keep the Slice 0 database layer to folder structure and placeholders only.
- Keep the app shell conservative and finance-oriented.
- Use a shadcn-compatible component organization with `components/`, `components/ui/`, and `lib/utils/`.

