# Tandem

A couples language-learning MVP for Okomi and Ifemi: short phrase games, pronunciation, saved moments, and shared progress. Tandem is an independent project and does not connect to Duolingo.

## Run locally

Serve this directory over HTTP (ES modules and browser storage work best from a local server):

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000`.

## Enable shared cloud sync

The GitHub Pages site is static, so shared accounts and progress use a separate Supabase project.

1. Create a Supabase project and open its SQL Editor.
2. Run [`supabase/schema.sql`](supabase/schema.sql) to create the couple space, practice, and saved-phrase tables with row-level security.
3. In **Authentication → URL Configuration**, set the site URL to `https://gdayo19.github.io/duo-together/` and add that URL to the redirect allow list. Add `http://localhost:8000/` too if testing locally.
4. Copy the project URL and its **publishable** (or legacy `anon`) key into `config.js`. These browser values are public; never put a `service_role` or secret key in this repository.
5. In **Authentication → Providers**, enable email sign-in. Okomi and Ifemi can then sign in with one-time email links, and one can create a space and share its invite code with the other.

Until Supabase is configured, the site works in preview mode and stores practice and saved phrases only in that browser. It does not sync across devices. The app only grants access to the two accounts joined to the same invite-only space.

## GitHub

- Live site: <https://gdayo19.github.io/duo-together/>
- Repository: <https://github.com/GdAyo19/duo-together>
