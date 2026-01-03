# SyncQuote - Production-Ready SaaS Platform

Transform static proposals into interactive, collaborative, and trackable web links to help service businesses close deals faster.

## ✨ **NEW FEATURES** (v2.0.0)

🎉 **Major Update**: 6 powerful new features have been added!

- 📄 **Proposal Templates** - Create proposals 70% faster with reusable templates
- 🔔 **Real-Time Notifications** - Instant alerts via WebSocket and email
- 💬 **Advanced Collaboration** - Threaded comments, @mentions, and resolution tracking
- 📊 **Analytics Dashboard** - Track engagement, conversion rates, and performance
- 📝 **Audit Trail System** - Complete activity logging for compliance
- 🎨 **White-labeling** - Custom branding with logos and colors

👉 **[See Implementation Guide →](./FEATURES_GUIDE.md)** | **[Quick Start →](./IMPLEMENTATION_CHECKLIST.md)**

## 🚀 Tech Stack

### Backend
- **Framework**: NestJS (Node.js + TypeScript)
- **Database**: PostgreSQL 16 with Prisma ORM
- **Caching**: Redis
- **Authentication**: JWT + Google OAuth
- **Payments**: Stripe (Billing + Connect)
- **Real-time**: Socket.io
- **Email**: SendGrid
- **Storage**: AWS S3 / Cloudflare R2
- **Monitoring**: Sentry + Pino logging
- **API Docs**: Swagger/OpenAPI

### Frontend
- **Framework**: Next.js 14 (React 19)
- **Styling**: Tailwind CSS + shadcn/ui
- **State**: TanStack Query
- **Forms**: React Hook Form + Zod
- **Editor**: Tiptap (Block-based proposal editor)

### Infrastructure
- **Backend**: AWS ECS Fargate (Docker)
- **Frontend**: Vercel
- **Database**: AWS RDS PostgreSQL
- **Cache**: AWS ElastiCache Redis
- **Storage**: AWS S3
- **IaC**: Terraform
- **CI/CD**: GitHub Actions

## 📋 Prerequisites

- Node.js 20+
- PostgreSQL 16+
- Redis 7+
- Docker (for containerization)
- AWS Account (for production deployment)
- Terraform (for infrastructure)

## 🏗️ Project Structure

```
SyncQuote/
├── backend-nestjs/         # NestJS backend API
│   ├── src/
│   │   ├── modules/        # Feature modules
│   │   │   ├── auth/       # Authentication & authorization
│   │   │   ├── users/      # User management
│   │   │   ├── proposals/  # Proposal CRUD
│   │   │   ├── comments/   # Comments system
│   │   │   ├── webhooks/   # Stripe webhooks
│   │   │   ├── storage/    # S3/R2 file storage
│   │   │   ├── email/      # Email notifications
│   │   │   ├── events/     # WebSocket events
│   │   │   ├── prisma/     # Database service
│   │   │   └── health/     # Health checks
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── prisma/
│   │   └── schema.prisma   # Database schema
│   ├── Dockerfile
│   └── package.json
├── frontend/               # Next.js frontend
│   ├── src/
│   │   ├── app/            # App router pages
│   │   ├── components/     # React components
│   │   │   └── ui/         # shadcn/ui components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── lib/            # Utilities
│   │   └── constants/      # Constants & configs
│   └── package.json
├── terraform/              # Infrastructure as Code
│   └── main.tf             # AWS resources
└── .github/
    └── workflows/          # CI/CD pipelines
        ├── backend-ci.yml
        └── frontend-ci.yml
```

## 🛠️ Development Setup

### 1. Clone & Install

```bash
# Clone repository
git clone https://github.com/yourusername/syncquote.git
cd syncquote

# Backend setup
cd backend-nestjs
npm install
cp .env.example .env

# Frontend setup
cd ../frontend
npm install
cp .env.local.example .env.local
```

### 2. Configure Environment Variables

**Backend** (`.env`):
```env
DATABASE_URL="postgresql://user:password@localhost:5432/syncquote"
JWT_ACCESS_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
STRIPE_SECRET_KEY=sk_test_...
SENDGRID_API_KEY=SG...
AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret
S3_BUCKET=syncquote-assets
```

**Frontend** (`.env.local`):
```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
NEXT_PUBLIC_WS_URL=ws://localhost:3001
```

### 3. Database Setup

```bash
cd backend-nestjs

# Generate Prisma Client
npx prisma generate

# Run migrations
npx prisma migrate dev

# (Optional) Seed database
npm run seed

# (Optional) Open Prisma Studio
npx prisma studio
```

### 4. Start Development Servers

**Terminal 1 - Backend**:
```bash
cd backend-nestjs
npm run start:dev
# API: http://localhost:3001/api/v1
# Docs: http://localhost:3001/api/docs
```

**Terminal 2 - Frontend**:
```bash
cd frontend
npm run dev
# App: http://localhost:3000
```

## 🧪 Testing

### Backend
```bash
cd backend-nestjs

# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Coverage
npm run test:cov
```

### Frontend
```bash
cd frontend

# Run tests (when implemented)
npm run test
```

## 🚢 Deployment

### Prerequisites
1. AWS Account with CLI configured
2. Terraform installed
3. GitHub repository secrets configured
4. Vercel account linked

### 1. Infrastructure Setup (Terraform)

```bash
cd terraform

# Initialize Terraform
terraform init

# Plan infrastructure
terraform plan -var-file="production.tfvars"

# Apply infrastructure
terraform apply -var-file="production.tfvars"
```

### 2. Deploy Backend

The backend deploys automatically via GitHub Actions when you push to `main` branch.

Manual deployment:
```bash
cd backend-nestjs

# Build Docker image
docker build -t syncquote-backend .

# Tag for ECR
docker tag syncquote-backend:latest <AWS_ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/syncquote-backend:latest

# Push to ECR
docker push <AWS_ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/syncquote-backend:latest
```

### 3. Deploy Frontend

```bash
cd frontend

# Install Vercel CLI
npm i -g vercel

# Deploy to production
vercel --prod
```

## 📚 API Documentation

Once the backend is running, access the Swagger docs at:
- **Local**: http://localhost:3001/api/docs
- **Production**: https://api.syncquote.com/api/docs

## 🔒 Security Checklist

- ✅ HTTPS enforced everywhere
- ✅ JWT access tokens (15min) + httpOnly refresh tokens (7 days)
- ✅ Bcrypt password hashing (12 rounds)
- ✅ Input validation with class-validator
- ✅ Rate limiting on all endpoints
- ✅ CORS configured
- ✅ Helmet security headers
- ✅ SQL injection protection (Prisma ORM)
- ✅ XSS protection
- ✅ CSRF protection via SameSite cookies
- ✅ Secrets in AWS Secrets Manager
- ✅ Database connection over SSL

## 📊 Monitoring & Logging

- **Error Tracking**: Sentry (backend & frontend)
- **Logging**: Pino → CloudWatch Logs
- **Uptime**: UptimeRobot pinging `/health`
- **Metrics**: AWS CloudWatch + ECS Container Insights

## 🎯 Milestones

### ✅ Milestone 1: Core (Internal Alpha)
- [x] Authentication (Email/Password + Google OAuth)
- [x] Dashboard with proposal list
- [x] Basic proposal editor
- [x] Public proposal view
- [x] DevOps setup (Docker, CI/CD, Terraform)

### 🚧 Milestone 2: Magic Loop (Closed Beta)
- [ ] Interactive pricing table with real-time calculations
- [ ] E-signature capture
- [ ] PDF generation (Puppeteer)
- [ ] Comment sidebar
- [ ] Document locking after approval

### 🔜 Milestone 3: Monetization (Go-Live)
- [ ] Stripe subscription billing
- [ ] 14-day trial logic
- [ ] Stripe Connect for client deposits
- [ ] Payment flows
- [ ] "Powered by SyncQuote" branding

### 📅 Milestone 4: Analytics & Polish (Post-Launch)
- [ ] Real-time notifications (Socket.io)
- [ ] Email notifications
- [ ] Proposal view tracking
- [ ] Activity feed
- [ ] Full monitoring/alerting

## 🤝 Contributing

This is a private SaaS project. For team members:

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Commit changes: `git commit -m 'Add my feature'`
3. Push branch: `git push origin feature/my-feature`
4. Open a Pull Request

## 📄 License

Proprietary - All rights reserved

## 🆘 Support

For issues or questions:
- Backend: Check logs in CloudWatch
- Frontend: Check Vercel deployment logs
- Database: Check RDS metrics in AWS Console
- Contact: dev@syncquote.com
