# Contributing

## Before opening a pull request

1. Use a short-lived branch from `main`; don't push feature work directly to `main`.
2. Install the exact locked dependencies with `npm ci`.
3. Run `npm run check` and include the relevant context, behavior, and test coverage in the pull request.
4. For database changes, add a new timestamped SQL file under `supabase/migrations/`. Never rewrite a migration that has already been applied.
5. Keep changes focused. Ask the relevant code owner to review changes to their area.

## Repository setup for maintainers

- Protect `main`: require a pull request, at least one approval, and the `check` status before merge. Dismiss stale approvals when new commits are pushed.
- Add the actual GitHub team handles to `.github/CODEOWNERS`, then require code-owner review for sensitive areas such as authentication and database migrations.
- Use separate Supabase projects for development/staging and production. Apply each migration to staging first, test sign-in, pairing, privacy/RLS, and saved-phrase pagination, then apply the same migration to production.
- Keep project credentials and backend secrets out of the repository. The frontend may contain only the Supabase project URL and publishable/anon key; never put a `service_role` or secret key in client code.
- Monitor query latency, database connections, API errors, and Realtime usage before increasing production traffic. The current MVP has not been load-tested and makes no 10-million-user capacity claim.

## Ownership

The team is not preassigned in `.github/CODEOWNERS`. A repository maintainer should add the team's real GitHub handles before making code-owner review mandatory.
