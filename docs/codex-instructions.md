# Codex Instructions

## Source of Truth

Use `docs/product-spec.md`, `docs/build-plan.md`, `docs/architecture-decisions.md`, and `TASKS.md` as the local source of truth before implementing future slices.

## Slice Discipline

- Do only the current slice.
- Preserve raw uploaded files in later import work.
- Use configurable imports and account structures.
- Do not hardcode file layouts.
- Do not implement imported-data features before the required data model exists.
- Do not introduce budget or AI work before those features are explicitly unlocked.
- Do not physically store secrets in committed files.
- Do not use the Supabase service role key in browser-exposed code.

## Checks

For future implementation work, run:

```bash
npm run lint
npm run typecheck
npm run build
```

If a check cannot run, report the reason clearly.

