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

- **Usernames**: Unique `username` for users (derived from email) and random guest usernames

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
│   ├── guestController.ts
│   ├── tripController.ts          # start/stop/ingest
│   ├── tripAnalyticsController.ts # history, details, batch, events, updates
│   └── permissionsController.ts   # permission logs & status
├── middleware/
│   ├── auth.ts          # JWT auth + role guard
│   ├── errorHandler.ts
│   └── security.ts      # Rate limit, CORS, Helmet
├── routes/
│   ├── admin.ts         # Admin routes
│   ├── auth.ts          # User auth routes
│   ├── trips.ts         # Trip APIs (start/stop/batch/history/events)
│   └── index.ts
├── services/
│   └── emailService.ts
├── types/
│   └── index.ts
└── utils/
    ├── jwt.ts
    ├── otp.ts
    ├── password.ts
    ├── username.ts
    ├── crypto.ts           # AES-256-GCM encrypt/decrypt
    └── validation.ts
```

## Data Model (Prisma)

- `User` model maps to table `users`
- `Admin` model maps to table `admins`
- `AdminRole` enum with values: `ADMIN`, `SUPER_ADMIN`

### User
Important fields:
- `email` (unique)
- `username` (unique)
- `password`
- `otp`, `otpExpiresAt`, `isVerified`
- `createdAt`, `updatedAt`

Note: There is a `guest_visits` table created dynamically by the API (not part of Prisma schema). It includes a `username` column with a unique index. See Guest section below.

### Trip
- `id`, `userId` (FK `users.id`)
- `deviceId` (nullable)
- `startedAt`, `endedAt` (nullable)
- `startLat`, `startLng`, `endLat`, `endLng` (nullable)
- `modes: string[]` (e.g., `["walk","car"]`)
- `companions: Json?`
- `destLat`, `destLng`, `destAddressEncrypted`
- `metadata: Json?`
- `distanceMeters: Int?`, `durationSeconds: Int?`
- `distanceByMode: Json?` (e.g., `{ "walk": 1200, "car": 5400 }`)

### TripPoint
- `id`, `tripId` (FK `trips.id`)
- `timestamp`
- `lat`, `lng`
- `speed?`, `accuracy?`, `heading?`
- `mode?: string` (per-sample mode; used to compute `distanceByMode`)
- `clientId?: string` (for idempotency)
- Unique composite: `(tripId, clientId)`

### TripEvent
- `id`, `tripId`, `type: string`, `data: Json?`, `createdAt`

### PermissionLog
- `id`, `userId?`, `deviceId?`, `permission`, `status`, `error?`, `createdAt`

## API Endpoints

### Health
```http
GET /api/health
```
Purpose: Quick uptime check; used by load balancers and clients.
Headers: none
Success 200:
```json
{ "success": true, "message": "Server is running", "timestamp": "2025-09-09T12:00:00.000Z" }
```
Errors: none

### Users (Auth)
- Sign Up
```http
POST /api/auth/signup
```
Purpose: Register a new user and send OTP for email verification.
Headers: `Content-Type: application/json`
Body:
```json
{ "email": "user@example.com", "password": "StrongP@ssw0rd!" }
```
Success 201:
```json
{ "success": true, "message": "User created successfully. OTP sent to your email for verification" }
```
Common errors:
- 409: `{ "success": false, "message": "User with this email already exists and is verified" }`
- 400: `{ "success": false, "message": "Validation error", "error": "..." }`
Behavior:
- Generates and stores a unique `username` from the email local-part (adds numeric/random suffixes if needed).
- Sends an OTP email for verification.
- Verify OTP
```http
POST /api/auth/verify-otp
```
Purpose: Verify email with OTP and issue a JWT.
Headers: `Content-Type: application/json`
Body:
```json
{ "email": "user@example.com", "otp": "123456" }
```
Response includes:
`user`: `{ id, email, username, isVerified, createdAt, updatedAt }` and `token`.
Success 200:
```json
{
  "success": true,
  "message": "Email verified successfully",
  "data": { "user": { "id": "...", "email": "...", "username": "...", "isVerified": true, "createdAt": "...", "updatedAt": "..." }, "token": "<JWT>" }
}
```
Common errors:
- 404: `{ "success": false, "message": "User not found" }`
- 400: `{ "success": false, "message": "Invalid OTP" }` or `{ "success": false, "message": "OTP has expired" }`
- Resend OTP
```http
POST /api/auth/resend-otp
```
Purpose: Generate and send a new OTP to unverified users.
Headers: `Content-Type: application/json`
Body:
```json
{ "email": "user@example.com" }
```
Success 200: `{ "success": true, "message": "OTP resent to your email" }`
Common errors:
- 404: `User not found`
- 400: `Email is already verified`
- Sign In
```http
POST /api/auth/signin
```
Purpose: Authenticate a verified user and return a JWT.
Headers: `Content-Type: application/json`
Body:
```json
{ "email": "user@example.com", "password": "StrongP@ssw0rd!" }
```
Response includes `username` in the user payload and token subject.
Success 200:
```json
{
  "success": true,
  "message": "Sign in successful",
  "data": { "user": { "id": "...", "email": "...", "username": "...", "isVerified": true, "createdAt": "...", "updatedAt": "..." }, "token": "<JWT>" }
}
```
Common errors:
- 401: `Invalid email or password`
- 401: `Please verify your email before signing in`
- Get Profile (requires Bearer token)
```http
GET /api/auth/profile
```
Purpose: Fetch the authenticated user's profile from the JWT.
Headers: `Authorization: Bearer <token>`
Success 200:
```json
{ "success": true, "message": "Profile retrieved successfully", "data": { "user": { /* token subject */ } } }
```
Errors:
- 401: Missing or invalid token

### Trips

- Start Trip
```http
POST /api/trips/start-trip
```
Body:
```json
{ "timestamp": 1710000000000, "lat": 12.9, "lng": 77.6, "deviceId": "abc", "modes": ["walk","car"], "companions": [{"name":"A","phone":"..."}], "destLat": 12.91, "destLng": 77.59, "destAddress": "Some place" }
```
Returns:
```json
{ "success": true, "message": "Trip started", "data": { "trip": { "id": "...", "userId": "...", "deviceId": "abc", "startedAt": "...", "startLat": 12.9, "startLng": 77.6, "modes": ["walk","car"], "companions": [...], "destLat": 12.91, "destLng": 77.59 } } }
```
Purpose: Begin an active trip; optionally sets destination and companions. Ends any previously active trip.
Headers: `Authorization: Bearer <token>`, `Content-Type: application/json`
Errors:
- 401: Unauthorized

- Ingest Location (single)
```http
POST /api/trips/ingest-location
```
Body:
```json
{ "tripId": "...", "timestamp": 1710000001000, "lat": 12.901, "lng": 77.601, "mode": "walk", "speed": 5.2, "accuracy": 10, "heading": 180, "clientId": "pt-1" }
```
Returns: `{ "success": true, "message": "Location ingested" }`
Purpose: Append a single location point. `clientId` is used to dedupe.
Headers: `Authorization: Bearer <token>`
Errors:
- 404: `Trip not found`
- 400: `Trip already ended`

- Ingest Locations (batch)
```http
POST /api/trips/batch-ingest
```
Body:
```json
{ "tripId": "...", "points": [{ "clientId": "pt-1", "timestamp": 1710000001000, "lat": 12.901, "lng": 77.601, "mode": "car" }] }
```
Returns: `{ "success": true, "message": "Batch locations ingested", "data": { "inserted": 1 } }`
Purpose: Efficient offline sync; deduplicates by `(tripId, clientId)`.
Headers: `Authorization: Bearer <token>`
Errors:
- 404: `Trip not found`
- 400: `Trip already ended` or validation error

- Stop Trip
```http
POST /api/trips/stop-trip
```
Body:
```json
{ "tripId": "...", "timestamp": 1710003600000, "lat": 12.95, "lng": 77.55 }
```
Returns: `{ "success": true, "message": "Trip stopped", "data": { "trip": { "id": "...", "startedAt": "...", "endedAt": "...", "endLat": 12.95, "endLng": 77.55 } } }`
Purpose: Ends active trip, records final location.
Headers: `Authorization: Bearer <token>`
Errors:
- 404: `Trip not found`
- 400: `Trip already ended`

- List Trips (history)
```http
GET /api/trips
```
Query: `page`, `pageSize`
Returns: `{ "success": true, "data": { "total": n, "page": 1, "pageSize": 20, "items": [{ "id": "...", "startedAt": "...", "endedAt": "...", "mode": "car", "distanceMeters": 1234, "durationSeconds": 567 }] } }`
Purpose: Paginated list of user’s trips.
Headers: `Authorization: Bearer <token>`
Errors: none

- Trip Detail with analytics
```http
GET /api/trips/:tripId
```
Returns: `{ "success": true, "data": { "trip": { "id": "...", "distanceMeters": 1234, "durationSeconds": 567, "averageSpeedMps": 2.17, ... }, "points": [{ "timestamp": "...", "lat": 12.9, "lng": 77.6, "speed": 4.5 }] } }`
Purpose: Full route data and computed stats for visualization.
Headers: `Authorization: Bearer <token>`
Errors:
- 404: `Trip not found`
Also returns: `distanceByMode` like `{ "walk": 1200, "car": 5400 }`.

- Update Trip (active)
```http
PATCH /api/trips/:tripId
```
Body: `{ "mode": "walk", "companions": [...], "destLat": 12.9, "destLng": 77.6, "destAddress": "..." }`
Returns: `{ "success": true, "message": "Trip updated", "data": { "trip": { ... } } }`
Purpose: Edit details during an active trip.
Headers: `Authorization: Bearer <token>`
Errors:
- 404: `Trip not found`
- 400: `Trip already ended`

- Log Trip Event
```http
POST /api/trips/event
```
Body: `{ "tripId": "...", "type": "ROUTE_CHANGE", "data": { "reason": "traffic" } }`
Returns: `{ "success": true, "message": "Event logged", "data": { "event": { "id": "...", "type": "ROUTE_CHANGE", "createdAt": "..." } } }`
Purpose: Record contextual events for notifications and analytics.
Headers: `Authorization: Bearer <token>`
Errors:
- 404: `Trip not found`

### Permissions

- Log Permission
```http
POST /api/permissions/log
```
Body: `{ "deviceId": "abc", "permission": "location", "status": "denied", "error": "user_blocked" }`
Returns: `{ "success": true, "message": "Permission logged", "data": { "id": "..." } }`
Purpose: Record permission outcome to aid support and fallback logic.
Headers: public, optional `Authorization` if available
Errors: none (validated server-side)

- Get Permission Status
```http
GET /api/permissions/status?deviceId=abc&permission=location
```
Returns: `{ "success": true, "message": "Permission status", "data": { "permission": "location", "status": "denied", "error": "user_blocked", "createdAt": "..." } }` or `null`.
Purpose: Allows client to understand last-known status and choose fallbacks.
Headers: public, optional `Authorization` if available
Errors: none

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
Includes recent users with `username` and guest visits with `username`.

### Guest (No Auth)
- Record guest visit (creates `guest_visits` table if missing)
```http
POST /api/guest
```
Behavior:
- Ensures table `guest_visits` exists and adds unique columns:
  - `username` (unique)
  - `device_id` (unique when provided)
  - `ip_address` (unique when provided)
- If a matching `device_id` exists, or if not provided then a matching `ip_address` exists, the API returns the existing visit id (idempotent).
- Generates a random unique guest `username` like `guest-abc123` and returns it for new visits.
Response example:
```json
{
  "success": true,
  "message": "Guest visit recorded",
  "data": { "visitId": 123, "username": "guest-abc123" }
}
```
Errors: none (idempotent when `deviceId` repeats)

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

Note: When using destructive resets in development, Prisma may require explicit consent. Never run resets in production.

## Database Operations & Drift

If Prisma reports schema drift (e.g., due to the runtime-created `guest_visits` table):

- Development reset (DESTRUCTIVE – drops all data):
```bash
npx prisma migrate reset
```
- If prompted for consent in non-interactive contexts, use env var `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION` with your explicit text consent. Use only in development.
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
