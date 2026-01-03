# SyncQuote Backend - NestJS API

Production-ready REST API with WebSocket support for the SyncQuote SaaS platform.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your credentials

# Generate Prisma Client
npx prisma generate

# Run database migrations
npx prisma migrate dev

# Start development server
npm run start:dev

# API available at: http://localhost:3001/api/v1
# Swagger docs: http://localhost:3001/api/docs
```

## 📚 API Endpoints

### Authentication
- `POST /auth/signup` - Sign up with email/password
- `POST /auth/signin` - Sign in
- `GET /auth/google` - Initiate Google OAuth
- `POST /auth/refresh` - Refresh access token
- `POST /auth/logout` - Logout
- `POST /auth/password/request-reset` - Request password reset
- `POST /auth/password/reset` - Reset password
- `GET /auth/me` - Get current user

### Users
- `GET /users/profile` - Get user profile
- `PATCH /users/profile` - Update profile

### Proposals
- `POST /proposals` - Create proposal
- `GET /proposals` - List all proposals
- `GET /proposals/:id` - Get proposal by ID
- `PATCH /proposals/:id` - Update proposal
- `DELETE /proposals/:id` - Delete proposal
- `GET /proposals/public/:slug` - Get proposal by slug (public)
- `POST /proposals/public/:slug/approve` - Approve proposal (public)

### Comments
- `GET /proposals/:proposalId/comments` - Get comments
- `POST /proposals/:proposalId/comments` - Add comment

### Webhooks
- `POST /webhooks/stripe` - Stripe webhook handler

### Health
- `GET /health` - Health check
- `GET /health/ping` - Simple ping

## 🔐 Authentication Flow

1. **Sign Up**: Client calls `/auth/signup`
   - Server creates user with hashed password
   - Returns access token + httpOnly refresh token cookie
   - User enters 14-day trial

2. **Sign In**: Client calls `/auth/signin`
   - Server verifies credentials
   - Returns access token + refresh token cookie

3. **Access Protected Routes**: 
   - Client sends: `Authorization: Bearer <access_token>`
   - Access tokens expire in 15 minutes

4. **Refresh Token**:
   - Client calls `/auth/refresh` with refresh token cookie
   - Server returns new access token
   - Refresh tokens expire in 7 days

## 🗄️ Database Schema

Key models:
- **User**: Email/password auth, subscription info, Stripe IDs
- **Proposal**: Title, slug, status, blocks, pricing
- **ProposalBlock**: Rich text, images, videos, pricing tables
- **PricingItem**: Line items (Fixed/Optional/Quantity)
- **Comment**: Client comments on proposals
- **Activity**: Audit log for proposal events

See `prisma/schema.prisma` for full schema.

## 🔌 WebSocket Events

Client can connect to WebSocket server for real-time updates:

```typescript
const socket = io('http://localhost:3001');

// Join a proposal room
socket.emit('join_proposal', { proposalId: '123' });

// Listen for events
socket.on('proposal_viewed', (data) => { ... });
socket.on('comment_added', (data) => { ... });
socket.on('proposal_approved', (data) => { ... });
```

## 🧪 Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## 📦 Docker

```bash
# Build image
docker build -t syncquote-backend .

# Run container
docker run -p 3001:3001 \
  -e DATABASE_URL="postgresql://..." \
  -e JWT_ACCESS_SECRET="..." \
  syncquote-backend
```

## 🔧 Environment Variables

See `.env.example` for all required variables:

- `DATABASE_URL` - PostgreSQL connection string
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` - JWT secrets
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` - Google OAuth
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` - Stripe
- `SENDGRID_API_KEY` - Email service
- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` - S3 storage
- `SENTRY_DSN` - Error tracking

## 📊 Monitoring

- **Logs**: Structured JSON via Pino
- **Errors**: Sentry integration
- **Health**: `/health` endpoint for uptime monitoring
- **Metrics**: ECS Container Insights (production)

## 🚀 Deployment

GitHub Actions automatically:
1. Runs linter & tests
2. Builds Docker image
3. Pushes to AWS ECR
4. Deploys to ECS Fargate

See `.github/workflows/backend-ci.yml` for pipeline details.
