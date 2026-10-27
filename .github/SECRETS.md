# GitHub Secrets Required

Add the following secrets under Settings > Secrets and variables > Actions:

## Backend & Database
| Secret | Required | Description |
| --- | --- | --- |
| `SUPABASE_DB_URL` | Yes (for migrations) | Session pooler connection string for Supabase Postgres with `?sslmode=require`. Format: `postgresql://postgres.<ref>:<password>@<region>.pooler.supabase.com:5432/postgres` |
| `DATABASE_URL` | Yes | Database URL used by backend in production |
| `JWT_SECRET` | Yes | Signs the HS256 session tokens the API issues; the code fallback is public and development-only |
| `SUPABASE_SERVICE_ROLE_KEY` | No | Reserved for evidence storage; no code path reads it yet. Keep it server-side whenever it is added |

## Web (Vercel)
No secret is required. The `metroflow-web-lgu` Vercel project is linked to this
GitHub repository with `metroflow-admin` as its root directory, so Vercel's Git
integration builds every push itself: previews for branches and pull requests,
production from `main`. There is no GitHub Actions deploy job to authenticate,
and the portal reads no secret at build time (see `metroflow-admin/.env.example`).

## Backend Deployment (Optional)
| Secret | Required | Description |
| --- | --- | --- |
| `RAILWAY_TOKEN` | No | For Railway deployment |
| `RENDER_API_KEY` | No | For Render deployment |
| `RENDER_SERVICE_ID` | No | Render service ID |
| `FLY_API_TOKEN` | No | For Fly.io deployment |
| `GOOGLE_APPLICATION_CREDENTIALS` | No | For Google Cloud Run (use JSON as secret) |

## Mobile (Optional)
| Secret | Required | Description |
| --- | --- | --- |
| `EXPO_TOKEN` | No | For EAS Build/Submit from CI |
