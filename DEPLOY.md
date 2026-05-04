# Deploying wheresxi to Railway

Two services + two managed plugins:

```
                ┌─────────────────────────────┐
                │  Postgres (Railway plugin)  │
                └──────────────▲──────────────┘
                               │ DATABASE_URL
                               │
┌──────────────┐   HTTPS    ┌──┴──────────────┐    ┌─────────────────────────┐
│ wheresxi-web │ ──────────▶│  wheresxi-api   │ ──▶│ Redis (Railway plugin)  │
│  (nginx)     │            │  (AdonisJS 6)   │    └─────────────────────────┘
└──────────────┘            └─────────────────┘
```

## Steps

1. **Create the project**, then add the **PostgreSQL** and **Redis**
   plugins.

2. **Create the API service** (`wheresxi-api`)
   - Source: this repo, root directory `api`
   - Builder: Dockerfile (`api/Dockerfile`)
   - Generated public domain: `https://wheresxi-api-production.up.railway.app`
     (or your own domain)
   - Env vars (Railway auto-fills the first two from the plugins):
     ```
     DATABASE_URL                ${{ Postgres.DATABASE_URL }}
     REDIS_URL                   ${{ Redis.REDIS_URL }}
     APP_KEY                     <32+ random chars>
     NODE_ENV                    production
     HOST                        0.0.0.0
     PORT                        3333
     LOG_LEVEL                   info
     OFFICE_TIMEZONE             America/Toronto
     ALLOWED_ORIGINS             https://wheresxi.example     # web service URL
     ACCESS_TOKEN_TTL_DAYS       30
     USER_STARTING_CREDITS       500
     BANKRUPTCY_RESET_CREDITS    100
     ```
   - `prisma migrate deploy` runs automatically on startup (see `Dockerfile`
     `CMD`), so the DB schema stays in sync with each release.

3. **Create the web service** (`wheresxi-web`)
   - Source: this repo, root directory `.`
   - Builder: Dockerfile (root `Dockerfile`)
   - Build arg: `VITE_API_BASE_URL = https://<api-domain>` — must be set as
     a **Docker build arg**, not a runtime env, because Vite bakes it into
     the bundle at build time.
   - Public domain: `https://wheresxi.example`

4. **Bootstrap the first admin user**
   Once deployed, exec into the API container and create an invite + your
   user:
   ```bash
   railway run --service=wheresxi-api node ace make:invite
   # Visit the printed signup URL, create your user.
   railway run --service=wheresxi-api node ace promote:admin <username>
   ```

## CORS / origin

`ALLOWED_ORIGINS` is a CSV list. The simplest setup:
```
ALLOWED_ORIGINS=https://wheresxi.example
```
For previews, append the preview origin:
```
ALLOWED_ORIGINS=https://wheresxi.example,https://wheresxi-preview.up.railway.app
```

## Local docker

Both Dockerfiles also work locally:
```bash
docker compose up -d                       # postgres
cd api && docker build -t wheresxi-api .
cd ..  && docker build -t wheresxi-web --build-arg VITE_API_BASE_URL=http://localhost:3333 .
```
