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
openssl rand -hex 24   # POSTGRES_PASSWORD
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
- Support email in product stubs: update to your real inbox if not using `support@syncquote.com` / `noreply@faizanmalik.me`.
