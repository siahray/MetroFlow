# GitHub Secrets Required

Add the following secrets under Settings > Secrets and variables > Actions:

## Backend & Database
| Secret | Required | Description |
| --- | --- | --- |
| `SUPABASE_DB_URL` | Yes (for migrations) | Session pooler connection string for Supabase Postgres with `?sslmode=require`. Format: `postgresql://postgres.<ref>:<password>@<region>.pooler.supabase.com:5432/postgres` |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key from Supabase (for backend API) |
| `DATABASE_URL` | Yes | Database URL used by backend in production |
| `JWT_SECRET` | Yes | Secret for JWT token signing |

## Web (Vercel)
| Secret | Required | Description |
| --- | --- | --- |
| `VERCEL_TOKEN` | Yes | Vercel CLI token from Account Settings > Tokens |
| `VERCEL_ORG_ID` | Yes | Found in `.vercel/project.json` or Vercel team settings |
| `VERCEL_PROJECT_ID` | Yes | Found in `.vercel/project.json` for web-lgu project |

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
