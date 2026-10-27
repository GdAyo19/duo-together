# Tandem

A couples language-learning MVP for Okomi and Ifemi: short phrase games, pronunciation, saved moments, and shared progress. Tandem is an independent project and does not connect to Duolingo.

## Run locally

Install the pinned dependencies and start the local development server:

```bash
npm ci
npm run dev
```

Vite prints the local URL, usually `http://localhost:5173`.

## Checks

```bash
npm run check
```

This runs the strict TypeScript check for the shared domain modules, focused unit tests, and production build. Pull requests and pushes to `main` run the same checks in GitHub Actions. Dependabot checks for npm and GitHub Actions updates weekly.

## Enable shared cloud sync

The GitHub Pages site is static, so shared accounts and progress use a separate Supabase project.

1. Create a Supabase project and open its SQL Editor.
2. Apply the SQL migrations in `supabase/migrations/` in filename order, first to a separate staging project and then to production. They can be run in the Supabase SQL Editor. Keep schema changes as new timestamped migration files; do not edit an already-applied migration.
3. In **Authentication → URL Configuration**, set the site URL to `https://gdayo19.github.io/duo-together/` and add that URL to the redirect allow list. Add the Vite local URL (usually `http://localhost:5173/`) too if testing locally.
4. Copy the project URL and its **publishable** (or legacy `anon`) key into `config.js`. These browser values are public; never put a `service_role` or secret key in this repository.
5. In **Authentication → Providers**, enable email sign-in. Okomi and Ifemi can then sign in with one-time email links, and one can create a space and share its invite code with the other.

Until Supabase is configured, the site works in preview mode and stores practice and saved phrases only in that browser. It does not sync across devices. The app only grants access to the two accounts joined to the same invite-only space.

The shared dashboard loads progress summaries from Postgres rather than downloading a member's full practice history. Saved phrases are loaded 30 at a time. Realtime change notifications refresh an open shared space, rather than polling every 30 seconds. These changes reduce routine transfer and avoid silently treating a fixed-size history window as lifetime totals; they do not establish a 10-million-user capacity.

## GitHub

- Live site: <https://gdayo19.github.io/duo-together/>
- Repository: <https://github.com/GdAyo19/duo-together>

## Team workflow

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for pull-request, ownership, and review guidance. Before inviting a large team, configure branch protection for `main` to require pull requests, at least one independent approval, and the `check` status. Add your actual GitHub team handles to `.github/CODEOWNERS`; the repository does not guess who should own each area.
