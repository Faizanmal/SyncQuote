# SyncQuote: Interactive Proposals & Quotes

**Static PDF quotes become trackable web proposals that clients can view, comment on, sign and pay a deposit on, with templates and view analytics for your team.**

<!-- TODO: add live demo link -->

<!-- SCREENSHOT/GIF PLACEHOLDER 1: building a proposal from a template in the editor -->
<!-- SCREENSHOT PLACEHOLDER 2: client view at /p/<slug> with comments + "Approve & sign" -->
<!-- SCREENSHOT PLACEHOLDER 3: analytics dashboard (views, engagement) -->

---

## What it does

SyncQuote replaces emailed PDF quotes with a shareable link. Your team builds the proposal from templates in a block editor. The client opens it at a public link, leaves comments, approves and signs it, and can pay a deposit through Stripe. Every view and action is tracked.

## Features

- **Proposal builder:** a block-based editor (Tiptap) with reusable templates and snippets.
- **Public client link** (`/p/<slug>`): clients view the proposal and approve and sign it there. Their name, email and timestamp are stored with the signature, and an audit certificate is generated.
- **Interactive pricing,** plus Stripe payment intents for deposits, milestones and final payments.
- **Collaboration:** threaded comments and real-time notifications (Socket.io) and email (SendGrid).
- **View analytics:** who opened the proposal, when, and how they engaged with it.
- **AI drafting helpers** (OpenAI): generate, improve, summarise or translate proposal content, or draft from a website URL.
- **Audit trail** of proposal activity, plus a branded client portal.
- **API:** NestJS with URI versioning (`/api/v1`) and Swagger docs at `/api/docs`.

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS + shadcn/ui, TanStack Query, React Hook Form + Zod, Tiptap |
| Backend | NestJS 11, Prisma, PostgreSQL 16, Redis, Socket.io, JWT + Google OAuth, Swagger |
| Integrations | Stripe, SendGrid, AWS S3 / Cloudflare R2, OpenAI |
| Infra | Docker Compose (local), Terraform (AWS), GitHub Actions CI |

## Quick start (local)

**You'll need:** Node.js 20+ and Docker.

```bash
git clone https://github.com/Faizanmal/SyncQuote.git
cd SyncQuote

# Option A: everything in Docker (Postgres, Redis, backend, frontend)
docker compose up -d
# Frontend: http://localhost:3000 · API: http://localhost:3001/api/v1 · Docs: http://localhost:3001/api/docs

# Option B: run the apps yourself
docker compose up -d postgres redis

cd backend-nestjs
cp .env.example .env          # set DATABASE_URL, JWT secrets, and optional Stripe/SendGrid/S3 keys
npm install
npx prisma generate
npx prisma migrate dev
npm run start:dev             # http://localhost:3001

# in a second terminal
cd frontend
echo "NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1" > .env.local
echo "NEXT_PUBLIC_WS_URL=ws://localhost:3001" >> .env.local
npm install
npm run dev                   # http://localhost:3000
```

Backend tests: run `npm test` in `backend-nestjs/`.

## Project layout

```
frontend/         # Next.js app (dashboard, client proposal view /p/[slug], invoices, contracts)
backend-nestjs/   # NestJS API (proposals, templates, comments, payments, analytics, ai, ...)
backend/          # earlier Django prototype, kept for reference (not used by the frontend)
mobile/           # React Native companion app (early stage)
terraform/        # AWS infrastructure
```

---

## 💼 Hire me

I build quote and order automation: incoming requests become structured quotes and offers, with a person approving each one before it goes out. I can also build a client-facing proposal flow like this one, tailored to your sales process.

**Faizan Malik**, Freelance AI & Automation Engineer (Python, Next.js, LLM/RAG), based in Delhi (IST, UTC+5:30)
→ [Contra](https://contra.com/faizan_malik_u76kw1s7) · [LinkedIn](https://www.linkedin.com/in/faizanmalikdelhi) · [GitHub](https://github.com/Faizanmal)

<!-- TODO: add a LICENSE file (no license chosen yet) -->
