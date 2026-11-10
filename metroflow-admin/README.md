# MetroFlow LGU Portal

Next.js portal for the LGU operations centre: login, triage and moderation,
dispatch radar, live network map, fleet, hazard authoring, sensors, users and
export. It talks only to the MetroFlow API; it has no Supabase client and no
database credentials (ADR-021 in `../docs/TSD.md`).

## Run it locally

```bash
cd metroflow-admin
bun install
cp .env.example .env.local     # NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
bun run dev
```

`NEXT_PUBLIC_API_BASE_URL` is read at build time, so it must be set before
`bun run build` in any non-local environment. Start the API first
(`../backend/README.md`).

## Tests

```bash
cd metroflow-admin
bun test lib components   # unit tests over lib/ (pure helpers, colour tokens) and
                           # component tests over components/ (jsdom via happy-dom)
bun run test:e2e    # Playwright portal suite; builds and serves on :3100, API stubbed
```

## Deploy

Hosted at https://metroflow-web-lgu.vercel.app through Vercel Git integration with
root directory `metroflow-admin`; merging to `main` deploys production and a branch
push produces a preview.
