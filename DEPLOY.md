# Deployment (Vercel + Railway)

Goal: private demo with Vercel frontend, Railway API + Postgres, DB not public.

## 1) Railway (API + Postgres)
1. Create a Railway project.
2. Add **PostgreSQL** to the project.
3. Add a new **Service** from this repo.
4. Ensure Postgres is **not publicly exposed** (default). Do not enable public access.

### Railway env vars (Service)
Set these in Railway → Service → Variables:
- `DATABASE_URL` = injected by Railway Postgres (auto when linked)
- `NODE_ENV` = `production`
- `JWT_SECRET` = strong random string
- `DEMO_TOKEN` = strong random string (demo gate for all API routes)
- `CORS_ORIGINS` = comma-separated allowlist, e.g.
  - `https://poliverso.vercel.app`
  - `https://pos.poliverso.com`
  - Optional regex: `regex:^https://.*\\.poliverso\\.(com|co)$`

### First deploy + seed
After deploy succeeds, open Railway shell and run:
```
npm run prisma:seed
```

Seeded supervisor credentials (demo only):
- Email: `supervisor@poliverse.local`
- Password: `Supervisor123!`
- Auth code: `222222`

## 2) Vercel (Frontend)
1. Import this repo in Vercel.
2. Build command: `npm run build`
3. Output: `dist` (already configured in `vercel.json`)

### Vercel env vars
Set for **Production** and **Preview**:
- `VITE_API_URL` = `https://<your-railway-service>.up.railway.app/api/v1`
- `VITE_DEMO_TOKEN` = same value as Railway `DEMO_TOKEN`

## 3) Verification checklist
- Railway deploy succeeds and migrations run.
- API `/health` returns `{ ok: true }`.
- Postgres has **no public endpoint**.
- Vercel build succeeds and app loads.
- Frontend requests succeed (no 401 from missing demo token).
- Supervisor login works and protected actions are available.
- CORS only allows POLIVERSO domains.
