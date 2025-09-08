# Authentication Backend API

A secure, scalable backend authentication system built with Express.js, TypeScript, and PostgreSQL, optimized for Vercel. Now includes separate `users` and `admins` tables with a SUPER_ADMIN bootstrap flow.

## Features

- **Users & Admins Split**: Separate Prisma models/tables for `users` and `admins`
- **Admin Roles**: `ADMIN` and `SUPER_ADMIN` via `AdminRole` enum
- **Bootstrap SUPER_ADMIN**: One-time secure bootstrap API using `ADMIN_SETUP_SECRET`
- **Secure Authentication**: JWT-based auth with Argon2 password hashing
- **Email Verification**: OTP-based verification for users
- **Security**: Rate limiting, CORS, validation, security headers
- **Error Handling**: Centralized error handling and structured responses
- **Deployment**: Optimized for Vercel/serverless

## Prerequisites

- Node.js 18+
- PostgreSQL database
- npm or yarn

## Quick Start

1) Install dependencies
```bash
npm install
```

2) Environment setup
```bash
cp env.example .env
```
Update `.env`:
```env
DATABASE_URL="<your-postgresql-connection-string>"
JWT_SECRET="<secure-random-string>"
JWT_EXPIRES_IN="7d"
PORT=3000
NODE_ENV="development"

# Email
EMAIL_HOST="smtp.gmail.com"
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER="<smtp-username>"
EMAIL_PASSWORD="<smtp-password-or-app-password>"

# OTP
OTP_EXPIRY_MINUTES=10
OTP_LENGTH=6

# Admin bootstrap secret (required for /api/admin/bootstrap-super-admin)
ADMIN_SETUP_SECRET="<choose-a-strong-secret>"
```

3) Database setup
- Option A: Use migrations (recommended when history is consistent)
```bash
npm run db:migrate
```
- Option B: Push schema directly (useful to sync quickly in dev)
```bash
npm run db:push
```

4) Start dev server
```bash
npm run dev
```

5) Bootstrap SUPER_ADMIN (one-time)
```bash
curl -X POST http://localhost:3000/api/admin/bootstrap-super-admin \
  -H "Content-Type: application/json" \
  -d '{
    "email":"superadmin@example.com",
    "password":"StrongP@ssw0rd#123",
    "secret":"<ADMIN_SETUP_SECRET from .env>"
  }'
```
Response contains the SUPER_ADMIN and a JWT token.

## Project Structure

```
src/
├── app.ts
├── index.ts
├── config/
│   ├── database.ts      # Prisma client
│   └── env.ts           # Env loading and validation
├── controllers/
│   ├── adminController.ts
│   ├── authController.ts
│   └── guestController.ts
├── middleware/
│   ├── auth.ts          # JWT auth + role guard
│   ├── errorHandler.ts
│   └── security.ts      # Rate limit, CORS, Helmet
├── routes/
│   ├── admin.ts         # Admin routes
│   ├── auth.ts          # User auth routes
│   └── index.ts
├── services/
│   └── emailService.ts
├── types/
│   └── index.ts
└── utils/
    ├── jwt.ts
    ├── otp.ts
    ├── password.ts
    └── validation.ts
```

## Data Model (Prisma)

- `User` model maps to table `users`
- `Admin` model maps to table `admins`
- `AdminRole` enum with values: `ADMIN`, `SUPER_ADMIN`

Note: There is a `guest_visits` table created dynamically by the API (not part of Prisma schema). See Guest section below.

## API Endpoints

### Health
```http
GET /api/health
```

### Users (Auth)
- Sign Up
```http
POST /api/auth/signup
```
- Verify OTP
```http
POST /api/auth/verify-otp
```
- Resend OTP
```http
POST /api/auth/resend-otp
```
- Sign In
```http
POST /api/auth/signin
```
- Get Profile (requires Bearer token)
```http
GET /api/auth/profile
```

### Admins
- Admin Sign Up (creates ADMIN)
```http
POST /api/admin/signup
```
- Admin Sign In
```http
POST /api/admin/signin
```
- Bootstrap SUPER_ADMIN (one-time, requires ADMIN_SETUP_SECRET)
```http
POST /api/admin/bootstrap-super-admin
```
- Create Admin (requires SUPER_ADMIN token)
```http
POST /api/admin/create
```
- Admin Dashboard (requires ADMIN or SUPER_ADMIN)
```http
GET /api/admin/dashboard
```

### Guest (No Auth)
- Record guest visit (creates `guest_visits` table if missing)
```http
POST /api/guest
```
The handler creates table `guest_visits` and a unique index on `device_id` if not present.

## Auth & Roles

- JWT tokens include a `subjectType` of `USER` or `ADMIN`.
- Middleware `authenticateToken` loads the subject from the corresponding table.
- Middleware `authorizeRoles('ADMIN' | 'SUPER_ADMIN')` restricts access by role.

## Scripts

- `npm run dev` – Start dev server with hot reload
- `npm run build` – Compile TypeScript to `dist/`
- `npm start` – Run compiled server
- `npm run db:generate` – Generate Prisma client
- `npm run db:push` – Push current Prisma schema to DB
- `npm run db:migrate` – Create/apply migrations in dev
- `npm run db:studio` – Open Prisma Studio

## Database Operations & Drift

If Prisma reports schema drift (e.g., due to the runtime-created `guest_visits` table):

- Development reset (DESTRUCTIVE – drops all data):
```bash
npx prisma migrate reset
```
- Quick sync to match `schema.prisma` (dev-only):
```bash
npx prisma db push
```
- Then regenerate client:
```bash
npx prisma generate
```

Tip: If you prefer Prisma to manage the guest table, add a `GuestVisit` model and remove the dynamic SQL in `guestController.ts` to avoid drift.

## Security

- Argon2 password hashing
- OTPs are hashed and time-limited
- Rate limiting for general and auth endpoints
- Joi input validation
- Helmet security headers and configurable CORS

## Deployment (Vercel)

1) Build
```bash
npm run build
```
2) Configure environment variables in Vercel
- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_EXPIRES_IN` (default: `7d`)
- `ADMIN_SETUP_SECRET` (required for bootstrap)
- Email variables if sending OTP emails from production
3) Deploy via CLI or dashboard
4) Run migrations in production
```bash
npx prisma migrate deploy
```

## Troubleshooting

- Port in use: Kill process on `3000` or change `PORT`
- Drift detected: Use `prisma db push` (dev) or reconcile migrations
- Invalid bootstrap secret: Ensure `ADMIN_SETUP_SECRET` is set and matches the request
- Email issues: Verify SMTP credentials and app passwords

## License

MIT
