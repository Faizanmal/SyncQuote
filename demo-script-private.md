# SyncQuote — Private Demo Script

> Internal only. Honest “what works today” for screen recordings and design-partner walks.

## What works today

1. **Auth** — Sign up / sign in (JWT).
2. **Create proposal** — Title, client, TipTap content, pricing table, optional deposit %.
3. **Edit / save** — Loads by id or slug; content + pricing persist.
4. **Send** — Marks SENT, emails client when SendGrid is set; otherwise toast + copy public link.
5. **Public link** `/p/{slug}` — View tracking (once per session), comments, accept with canvas signature (acceptance ≠ certified eSign).
6. **Seller feedback** — View count on list/edit; in-app + email notify on accept/payment when configured.
7. **Pay (test)** — If deposit enabled, client Checkout for deposit / remaining after accept.
8. **PDF** — Downloads proposal content + pricing (certificate appendix when accepted); errors clearly if Puppeteer/Chromium missing.
9. **Plans** — Free monthly create limit enforced; Billing shows usage.

## Live demo env checklist

| Var | Where | Required for |
|-----|--------|----------------|
| `DATABASE_URL` | backend-nestjs | Everything |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | backend-nestjs | Auth |
| `FRONTEND_URL` | backend-nestjs | Email links, CORS |
| `NEXT_PUBLIC_API_URL` | frontend | API calls |
| `NEXT_PUBLIC_WS_URL` | frontend | Realtime (optional but recommended) |
| `STRIPE_SECRET_KEY` | backend-nestjs | Checkout / billing |
| `STRIPE_WEBHOOK_SECRET` | backend-nestjs | Webhook → `/api/v1/webhooks/stripe` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | frontend | Stripe.js / Checkout |
| `SENDGRID_API_KEY` + `EMAIL_FROM` | backend-nestjs | Client send + seller emails (skips cleanly if unset) |
| `REDIS_*` | backend-nestjs | Caching / queues if enabled — not required for create→send→view |

Redis is optional for the core demo loop. Puppeteer/Chromium must be available for PDF download.

## 5-minute happy path

1. Sign up → New Proposal → add content + one pricing row → enable 50% deposit → Send.
2. Copy public URL → open incognito → Accept → Pay deposit (Stripe test card `4242…`).
3. Back in seller app: views/status updated; notification if SendGrid set.
4. Optional: Download PDF from public page.

## Do not demo as finished

- Mock enterprise pages (invoices/contracts marketplace UI if still linked).
- Django `backend/` folder.
- Legal eSign / SSO / white-label as production-ready.
