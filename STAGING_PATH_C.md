# SyncQuote — Thin staging path (Hybrid Path C)

> **VPS on faizanmalik.me:** use [`VPS_DEPLOY.md`](./VPS_DEPLOY.md) + `docker-compose.prod.yml`.
> Prefer that over full AWS/Terraform. See `DEPLOYMENT.md` only if you intentionally run ECS.

## Local

```bash
docker compose up -d   # Postgres + Redis (and optional API/FE services)
# or run API + FE on the host against Compose DB
```

1. Copy `backend-nestjs/.env.example` → `.env` (set strong JWT secrets, `DATABASE_URL`, Stripe test keys).
2. Copy `frontend/.env.local.example` → `.env.local`.
3. `cd backend-nestjs && npx prisma migrate deploy && npm run start:dev`
4. `cd frontend && npm run dev`
5. Stripe CLI: `stripe listen --forward-to localhost:3001/api/v1/webhooks/stripe`

Env checklist: `demo-script-private.md`.

## Suggested cloud (design partners)

| Piece | Suggested host |
|-------|----------------|
| Frontend | Vercel (Next.js) |
| API | Railway / Render / Fly (Nest Docker or Node) |
| DB | Managed Postgres on the same host |
| Redis | Optional for core create→send→view |
| Stripe | Test mode webhook → `https://<api>/api/v1/webhooks/stripe` |

Set at least:

- API: `DATABASE_URL`, `JWT_*`, `FRONTEND_URL`, `STRIPE_*`, `SENDGRID_*` (optional), `SENTRY_DSN` (optional)
- FE: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

## Health

- API: `GET /api/v1/health` (see Health module)
- Sentry: set `SENTRY_DSN` on the API for staging error capture

## Billing note (v1)

Path C is **user-billed** (Stripe customer on `User`). No Organization model yet. Team nav is hidden until proposals are team-scoped.
