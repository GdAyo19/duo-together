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

1. Create a Supabase project and copy its project ref from the dashboard URL.
2. Authenticate and link this repository to that project:

   ```bash
   npx supabase login
   npx supabase link --project-ref YOUR_PROJECT_REF
   ```

3. Apply the versioned migrations in `supabase/migrations/`:

   ```bash
   npx supabase db push
   ```

   For a safe rollout, apply and verify migrations against a separate staging project before production. Add future schema changes as new timestamped migrations; do not edit migrations already applied to a project.
4. In **Authentication → URL Configuration**, set the site URL to `https://gdayo19.github.io/duo-together/` and add that URL to the redirect allow list. Add the Vite local URL (usually `http://localhost:5173/`) too if testing locally.
5. Copy the project URL and its **publishable** (or legacy `anon`) key into `config.js`. These browser values are public; never put a `service_role` or secret key in this repository.
6. In **Authentication → Providers**, enable email sign-in. Returning users sign in with their email and password; **Forgot password?** sends a password-reset link. Existing passwordless users can use the one-time email link under **First time? Email me a sign-in link**, then set a password from **Account**. Supabase's built-in email service is rate-limited, so configure custom SMTP for reliable reset and first-time sign-in emails.
7. To enable **Continue with Google**, enable the Google provider in Supabase and add its client ID and secret there. Create a Google OAuth web client, set the live site and local Vite URL as authorized JavaScript origins, and add the callback URL shown by Supabase as an authorized redirect URI in Google Cloud. Keep the OAuth client secret in Supabase; do not commit it. The sign-in dialog also includes show/hide password controls, animated form transitions, and a saved light/dark theme switch.

Until Supabase is configured, the site works in preview mode and stores practice and saved phrases only in that browser. It does not sync across devices. The app only grants access to the two accounts joined to the same invite-only space.

The shared dashboard loads progress summaries from Postgres rather than downloading a member's full practice history. Saved phrases are loaded 30 at a time. Realtime change notifications refresh an open shared space, rather than polling every 30 seconds. These changes reduce routine transfer and avoid silently treating a fixed-size history window as lifetime totals; they do not establish a 10-million-user capacity.

## GitHub

- Live site: <https://gdayo19.github.io/duo-together/>
- Repository: <https://github.com/GdAyo19/duo-together>

## Team workflow

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for pull-request, ownership, and review guidance. Before inviting a large team, configure branch protection for `main` to require pull requests, at least one independent approval, and the `check` status. Add your actual GitHub team handles to `.github/CODEOWNERS`; the repository does not guess who should own each area.
