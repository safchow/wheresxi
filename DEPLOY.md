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
   - Source: this repo, root directory `backend`
   - Builder: Dockerfile (`backend/Dockerfile`)
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
     ```
   - `prisma migrate deploy` runs automatically on startup (see `Dockerfile`
     `CMD`), so the DB schema stays in sync with each release.

3. **Create the web service** (`wheresxi-web`)
   - Source: this repo, root directory `frontend`
   - Builder: Dockerfile (`frontend/Dockerfile`)
   - Build arg: `VITE_API_BASE_URL = https://<api-domain>` — must be set as
     a **Docker build arg**, not a runtime env, because Vite bakes it into
     the bundle at build time.
   - Public domain: `https://wheresxi.example`

4. **Bootstrap the first admin user**
   Once deployed, exec into the API container and mint an admin-grant
   invite. The `--admin` flag means whoever signs up with the link is
   created as an ADMIN — no separate promote step needed.
   ```bash
   railway run --service=wheresxi-api node ace make:invite \
     --admin \
     --frontend=https://wheresxi.example
   ```
   The command prints a `https://wheresxi.example/signup?inviteToken=…`
   URL. Visit it, create your account, and you're in as admin.

   On a brand-new DB the bootstrap invite has no creator — it's the only
   row in the schema where `InviteToken.createdById` is null. Every
   subsequent invite minted via the admin UI carries the minting admin's
   id automatically.

   To later promote an existing regular user (e.g. a teammate who already
   signed up with a USER invite), use:
   ```bash
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
cd backend  && docker build -t wheresxi-api .
cd ../frontend && docker build -t wheresxi-web --build-arg VITE_API_BASE_URL=http://localhost:3333 .
```
