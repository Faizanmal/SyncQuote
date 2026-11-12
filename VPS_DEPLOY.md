# Deploy SyncQuote on a VPS — `faizanmalik.me`

Production URL: **https://syncquote.faizanmalik.me**

Stack: Docker Compose → Caddy (HTTPS) → Next.js + NestJS + Postgres + Redis.

---

## 1. DNS (Cloudflare / registrar)

Create an **A** record (and AAAA if you have IPv6):

| Type | Name | Value |
|------|------|--------|
| A | `syncquote` | your VPS public IPv4 |

Result: `syncquote.faizanmalik.me` → VPS.

Open ports **80** and **443** on the firewall (Caddy needs 80 for ACME).

```bash
# ufw example
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

---

## 2. Server prerequisites

- Ubuntu 22.04+ (or similar)
- Docker Engine + Compose plugin: https://docs.docker.com/engine/install/
- Git

```bash
sudo apt update && sudo apt install -y git
# install Docker per docs, then:
sudo usermod -aG docker "$USER"   # re-login after
```

---

## 3. Clone & configure

```bash
git clone <your-repo-url> SyncQuote
cd SyncQuote

cp .env.production.example .env.production
nano .env.production   # set ALL secrets — especially JWT_* and POSTGRES_PASSWORD
```

Generate secrets:

```bash
openssl rand -hex 32   # JWT_ACCESS_SECRET
openssl rand -hex 32   # JWT_REFRESH_SECRET
openssl rand -hex 24   # POSTGRES_PASSWORD  (use the same value in DATABASE_URL)
```

Set `DATABASE_URL` to the **Docker network** host (not localhost):

```env
DATABASE_URL=postgresql://syncquote:YOUR_PASSWORD@postgres:5432/syncquote?schema=public
```

If the backend container is unhealthy, inspect logs first:

```bash
docker logs syncquote-backend --tail 200
```

Domain defaults already use `syncquote.faizanmalik.me`. Keep:

- `FRONTEND_URL=https://syncquote.faizanmalik.me`
- `NEXT_PUBLIC_API_URL=https://syncquote.faizanmalik.me/api/v1`
- `NEXT_PUBLIC_WS_URL=https://syncquote.faizanmalik.me`

---

## 4. Deploy

```bash
chmod +x deploy/deploy.sh
./deploy/deploy.sh
```

Or manually:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

First boot runs Prisma migrations automatically.

### Recovery: entrypoint permission denied / frontend interrupted

If `docker compose up -d --build frontend` reports
`exec: "./docker-entrypoint.sh": permission denied`, it selected the local
development file. Its backend source bind mount hides the entrypoint that was
made executable during the image build. The frontend is then interrupted by
the backend failure; its build may have succeeded.

After updating the server checkout with the entrypoint fix, use the production
file explicitly for every VPS command:

```bash
# Keep the existing database password in .env.production and DATABASE_URL.
# Changing POSTGRES_PASSWORD does not change an initialized database password.
docker compose -f docker-compose.prod.yml --env-file .env.production config --quiet
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
docker compose -f docker-compose.prod.yml --env-file .env.production ps
docker compose -f docker-compose.prod.yml --env-file .env.production logs --tail=100 backend frontend
```

The image entrypoint now lives outside `/app`, normalizes Windows line endings,
and runs through `/bin/sh`. Development command overrides run the requested
watch command. The production file uses the standalone frontend image without
source bind mounts. Do not use `down -v` during recovery: it deletes database
volumes. The missing buildx warning did not cause this startup failure; both
builds completed using the classic builder.

---

## 5. Verify

```bash
curl -fsS https://syncquote.faizanmalik.me/api/v1/health/ping
# open https://syncquote.faizanmalik.me → sign up → create proposal
```

Stripe webhook (Dashboard → Webhooks):

`https://syncquote.faizanmalik.me/api/v1/webhooks/stripe`

Events: `checkout.session.completed`, `payment_intent.succeeded`, subscription events you use.

If using Google OAuth, set authorized redirect URI to:

`https://syncquote.faizanmalik.me/api/v1/auth/google/callback`

---

## 6. Ops cheatsheet

```bash
# logs
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f caddy backend frontend

# rebuild after git pull
git pull
./deploy/deploy.sh

# DB backup
docker exec syncquote-postgres pg_dump -U syncquote syncquote > backup-$(date +%F).sql
```

---

## Architecture

```
Internet
   │
   ▼
Caddy (:80/:443) ── Let's Encrypt for syncquote.faizanmalik.me
   ├─ /api/*, /socket.io/*  → backend:3001
   └─ /*                    → frontend:3000
         │
         ├─ postgres (internal)
         └─ redis (internal)
```

Same-origin `/api` keeps refresh-token cookies working (`Secure` + `SameSite=Strict`).

---

## Notes

- Dev compose (`docker-compose.yml`) stays for local; use **`docker-compose.prod.yml`** on the VPS.
- Heavy AWS/Terraform path remains in `DEPLOYMENT.md` (optional).
- Email: set `RESEND_API_KEY` in `.env.production` with `EMAIL_FROM=noreply@faizanmalik.me` (domain already verified in Resend).
- Support: `support@faizanmalik.me` in product stubs.
