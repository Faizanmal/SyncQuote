# 🚀 SyncQuote - Quick Start Guide

Get SyncQuote running locally in under 10 minutes!

## Prerequisites

- ✅ Node.js 20+ installed
- ✅ PostgreSQL 16 running
- ✅ Redis running (or use WSL2)

## Step-by-Step Setup

### 1. Install Dependencies (2 minutes)

```powershell
# Backend
cd backend-nestjs
npm install

# Frontend (in new terminal)
cd frontend
npm install
```

### 2. Configure Environment (2 minutes)

**Backend** - Create `backend-nestjs/.env`:
```env
NODE_ENV=development
PORT=3001
DATABASE_URL="postgresql://postgres:password@localhost:5432/syncquote"
JWT_ACCESS_SECRET=dev-secret-change-in-production-12345
JWT_REFRESH_SECRET=dev-refresh-secret-change-in-production-67890
REDIS_HOST=localhost
REDIS_PORT=6379
FRONTEND_URL=http://localhost:3000
ALLOWED_ORIGINS=http://localhost:3000
```

**Frontend** - Create `frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
NEXT_PUBLIC_WS_URL=ws://localhost:3001
```

### 3. Setup Database (3 minutes)

```powershell
# Create database
psql -U postgres
CREATE DATABASE syncquote;
\q

# Run migrations
cd backend-nestjs
npx prisma generate
npx prisma migrate dev
```

### 4. Start Development Servers (1 minute)

**Terminal 1 - Backend**:
```powershell
cd backend-nestjs
npm run start:dev
```

**Terminal 2 - Frontend**:
```powershell
cd frontend
npm run dev
```

### 5. Verify Setup (1 minute)

✅ **Backend Health**: http://localhost:3001/api/v1/health  
✅ **API Docs**: http://localhost:3001/api/docs  
✅ **Frontend**: http://localhost:3000

---

## Test the API

### 1. Sign Up a User

**Via Swagger** (http://localhost:3001/api/docs):
1. Click on `POST /auth/signup`
2. Click "Try it out"
3. Enter JSON:
```json
{
  "email": "test@example.com",
  "password": "password123",
  "name": "Test User"
}
```
4. Click "Execute"
5. Copy the `accessToken` from response

### 2. Authenticate Requests

1. Click "Authorize" button at top of Swagger
2. Enter: `Bearer YOUR_ACCESS_TOKEN`
3. Click "Authorize"

### 3. Create a Proposal

1. Go to `POST /proposals`
2. Try it out with:
```json
{
  "title": "My First Proposal",
  "taxRate": 10
}
```

### 4. View Your Proposal

1. Go to `GET /proposals`
2. Execute to see your proposals list

---

## Common Commands

### Backend

```powershell
cd backend-nestjs

# Start dev server
npm run start:dev

# Run database migrations
npx prisma migrate dev

# Open Prisma Studio (database GUI)
npx prisma studio

# Generate Prisma Client
npx prisma generate

# Run tests
npm run test

# Lint code
npm run lint
```

### Frontend

```powershell
cd frontend

# Start dev server
npm run dev

# Build for production
npm run build

# Type check
npm run type-check

# Lint code
npm run lint
```

---

## Troubleshooting

### "Port 3001 already in use"
```powershell
# Find and kill process
netstat -ano | findstr :3001
taskkill /PID <PID> /F
```

### "Cannot connect to database"
```powershell
# Check PostgreSQL is running
Get-Service postgresql*

# Start if stopped
Start-Service postgresql-x64-16
```

### "Redis connection failed"
```powershell
# If using WSL2
wsl
sudo service redis-server start
```

### "Prisma Client not generated"
```powershell
cd backend-nestjs
npx prisma generate
```

---

## Next Steps

### For Backend Development
1. Explore modules in `backend-nestjs/src/modules/`
2. Check API routes in `*.controller.ts` files
3. Business logic in `*.service.ts` files
4. Database models in `prisma/schema.prisma`

### For Frontend Development
1. Pages in `frontend/src/app/`
2. Components in `frontend/src/components/`
3. UI components in `frontend/src/components/ui/`
4. API hooks in `frontend/src/hooks/use-api.ts`

### Test Features
- ✅ Sign up / Sign in
- ✅ Create proposals
- ✅ Update proposals
- ✅ Delete proposals
- 🔜 Public proposal view (to be implemented)
- 🔜 E-signature (to be implemented)
- 🔜 PDF generation (to be implemented)

---

## Development Workflow

1. **Make changes** to code
2. **Backend auto-reloads** (watch mode)
3. **Frontend auto-reloads** (Fast Refresh)
4. **Test via Swagger** (http://localhost:3001/api/docs)
5. **Commit changes** with clear message

---

## Useful URLs

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:3001/api/v1 |
| API Documentation | http://localhost:3001/api/docs |
| Health Check | http://localhost:3001/api/v1/health |
| Prisma Studio | http://localhost:5555 (after `npx prisma studio`) |

---

## Environment Variables Reference

### Required (Minimum)
- `DATABASE_URL` - PostgreSQL connection
- `JWT_ACCESS_SECRET` - JWT signing key
- `JWT_REFRESH_SECRET` - Refresh token key

### Optional (Enhanced Features)
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` - Google OAuth
- `STRIPE_SECRET_KEY` - Stripe payments
- `SENDGRID_API_KEY` - Email notifications
- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` - S3 storage
- `SENTRY_DSN` - Error tracking

See `.env.example` for full list.

---

## File Structure Overview

```
backend-nestjs/
├── src/
│   ├── modules/
│   │   ├── auth/          # 🔐 Authentication
│   │   ├── users/         # 👤 User management
│   │   ├── proposals/     # 📄 Proposal CRUD
│   │   ├── comments/      # 💬 Comments
│   │   ├── webhooks/      # 🔔 Stripe webhooks
│   │   └── ...
│   ├── app.module.ts      # Main app module
│   └── main.ts           # Entry point
├── prisma/
│   └── schema.prisma     # 🗄️ Database schema
└── .env                  # 🔑 Environment variables

frontend/
├── src/
│   ├── app/              # 📱 Next.js pages (App Router)
│   ├── components/       # ⚛️ React components
│   │   └── ui/          # 🎨 shadcn/ui components
│   ├── hooks/           # 🪝 Custom React hooks
│   └── lib/             # 🛠️ Utilities
└── .env.local           # 🔑 Frontend env vars
```

---

## Getting Help

1. **Check logs**: Both terminals show detailed errors
2. **Swagger docs**: Test endpoints at http://localhost:3001/api/docs
3. **Database GUI**: Run `npx prisma studio` to inspect data
4. **Review code**: All modules well-documented with comments
5. **Check STATUS.md**: For current project status

---

## Ready to Code! 🎉

You now have:
- ✅ Backend API running with hot reload
- ✅ Frontend app running with Fast Refresh
- ✅ Database with migrations applied
- ✅ API documentation at your fingertips
- ✅ Full development environment

**Start building features!** Refer to the main `README.md` for architecture details.

---

*Happy coding! 🚀*
