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
- `id`, `userid` (FK `users.id`)
- `deviceid` (nullable)
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
- `id`, `userid?`, `deviceid?`, `permission`, `status`, `error?`, `createdAt`

## API Endpoints

### Health
```http
GET /api/health
```
- Purpose: Quick uptime check for clients/monitors.
- Auth: None
- Headers: None
- Success 200:
```json
{ "success": true, "message": "Server is running", "timestamp": "2025-09-09T12:00:00.000Z" }
```
- Errors: None

### Users (Auth)
- Sign Up
```http
POST /api/auth/signup
```
• Purpose: Register a user and send OTP.
• Auth: None
• Headers: `Content-Type: application/json`
• Request schema:
  - `email: string (valid email)`
  - `password: string (8–128 chars, strong)`
• Success 201: `{ success, message }`
• Errors:
  - 400 validation
  - 409 already exists (verified)
Behavior:
- Generates and stores a unique `username` from the email local-part (adds numeric/random suffixes if needed).
- Sends an OTP email for verification.
- Verify OTP
```http
POST /api/auth/verify-otp
```
• Purpose: Verify OTP and issue JWT.
• Headers: `Content-Type: application/json`
• Request: `{ email, otp }`
• Success 200: `{ success, data: { user, token } }`
• Errors: 400 invalid/expired OTP, 404 user not found
- Resend OTP
```http
POST /api/auth/resend-otp
```
• Purpose: Send a new OTP if not verified.
• Headers: `Content-Type: application/json`
• Request: `{ email }`
• Success 200: `{ success, message }`
• Errors: 404 user not found, 400 already verified
- Sign In
```http
POST /api/auth/signin
```
• Purpose: Authenticate and get JWT.
• Headers: `Content-Type: application/json`
• Request: `{ email, password }`
• Success 200: `{ success, data: { user, token } }`
• Errors: 401 invalid credentials, 401 not verified
- Get Profile (requires Bearer token)
```http
GET /api/auth/profile
```
• Purpose: Fetch authenticated user (from token).
• Headers: `Authorization: Bearer <token>`
• Success 200: `{ success, data: { user } }`
• Errors: 401 unauthorized

### Trips

- Start Trip
```http
POST /api/trips/start-trip
```
• Purpose: Begin active trip; optionally set destination and companions. If a previous trip is open, it is closed for safety.
• Headers: `Authorization: Bearer <token>`, `Content-Type: application/json`
• Body:
```json
{ "timestamp": 1710000000000, "lat": 12.9, "lng": 77.6, "deviceid": "abc", "modes": ["walk","car"], "companions": [{"name":"A","phone":"..."}], "destLat": 12.91, "destLng": 77.59, "destAddress": "Some place" }
```
• Success 201:
```json
{ "success": true, "message": "Trip started", "data": { "trip": { "id": "...", "userid": "...", "deviceid": "abc", "startedAt": "...", "startLat": 12.9, "startLng": 77.6, "modes": ["walk","car"], "companions": [...], "destLat": 12.91, "destLng": 77.59 } } }
```
• Errors: 401 unauthorized

- Ingest Location (single)
```http
POST /api/trips/ingest-location
```
• Purpose: Append a single GPS point (optional, use batch for efficiency).
• Headers: `Authorization: Bearer <token>`
• Body:
```json
{ "tripId": "...", "timestamp": 1710000001000, "lat": 12.901, "lng": 77.601, "mode": "walk", "speed": 5.2, "accuracy": 10, "heading": 180, "clientId": "pt-1" }
```
• Success 201: `{ success, message }`
• Errors: 404 trip not found, 400 trip ended

- Ingest Locations (batch)
```http
POST /api/trips/batch-ingest
```
• Purpose: Efficient offline/periodic sync; dedup by `(tripId, clientId)`.
• Headers: `Authorization: Bearer <token>`
• Body:
```json
{ "tripId": "...", "points": [{ "clientId": "pt-1", "timestamp": 1710000001000, "lat": 12.901, "lng": 77.601, "mode": "car" }] }
```
• Success 201: `{ success, message, data: { inserted } }`
• Errors: 404 trip not found, 400 trip ended/validation

- Stop Trip
```http
POST /api/trips/stop-trip
```
• Purpose: Mark trip as ended, optionally with final coordinates.
• Headers: `Authorization: Bearer <token>`
• Body:
```json
{ "tripId": "...", "timestamp": 1710003600000, "lat": 12.95, "lng": 77.55 }
```
• Success 200: `{ success, message, data: { trip } }`
• Errors: 404 trip not found, 400 trip ended

- List Trips (history)
```http
GET /api/trips
```
• Purpose: Paginated history for the user.
• Headers: `Authorization: Bearer <token>`
• Query: `page`, `pageSize`
• Success 200: `{ success, data: { total, page, pageSize, items } }`
• Errors: None (auth required)

- Trip Detail with analytics
```http
GET /api/trips/:tripId
```
• Purpose: Full route and computed stats for visualization.
• Headers: `Authorization: Bearer <token>`
• Success 200: `{ success, data: { trip, points } }`
  - `trip.distanceByMode`: e.g. `{ "walk": 1200, "car": 5400 }`
• Errors: 404 not found

### Companions

- List Companions
```http
GET /api/companions
```
Purpose: Fetch saved companion contacts for the authenticated user.
Headers: `Authorization: Bearer <token>`
Success 200: `{ success, message: "Companions list", data: { items: [{ id, name, email, phone, createdAt }] } }`
Errors: 401 unauthorized

- Create/Update Companion
```http
POST /api/companions
```
Body (create): `{ "name": "Alice", "email": "alice@example.com", "phone": "+11234567890" }`
Body (update): `{ "id": "<companionId>", "name": "Alice B" }`
Purpose: Upsert a companion contact for SOS and trip sharing.
Headers: `Authorization: Bearer <token>`, `Content-Type: application/json`
Success 200: `{ success, message: "Companion saved", data: { item: { ... } } }`
Errors: 401 unauthorized, 400 validation

- Delete Companion
```http
DELETE /api/companions/:id
```
Purpose: Remove a companion contact.
Headers: `Authorization: Bearer <token>`
Success 200: `{ success, message: "Companion deleted" }`
Errors: 401 unauthorized, 404 not found

### SOS

- Trigger SOS
```http
POST /api/sos
```
Body (optional): `{ "lat": 12.9, "lng": 77.6 }`
Purpose: Send SOS emails to the user’s companions and log an SOS event. Intended to be called when the Android app detects the three top-down shakes gesture.
Headers: `Authorization: Bearer <token>`
Success 201: `{ success, message: "SOS triggered", data: { sosId: "...", notified: 2 } }`
Errors: 401 unauthorized

### Streaks & Leaderboard

- Get My Streak
```http
GET /api/streak
```
Purpose: Show current daily travel streak and active days (last 60 days).
Headers: `Authorization: Bearer <token>`
Success 200: `{ success, message: "User streak", data: { currentStreakDays: 5, activeDaysLast60: 14 } }`
Errors: 401 unauthorized

- Weekly Leaderboard
```http
GET /api/leaderboard/weekly
```
Purpose: Top users by distance in the last 7 days; includes companions count per user.
Headers: `Authorization: Bearer <token>`
Success 200: `{ success, message: "Weekly leaderboard", data: { items: [{ user_id, email, username, distance, companions }] } }`
Errors: none (auth required)

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
Body: `{ "deviceid": "abc", "permission": "location", "status": "denied", "error": "user_blocked" }`
Returns: `{ "success": true, "message": "Permission logged", "data": { "id": "..." } }`
Purpose: Record permission outcome to aid support and fallback logic.
Headers: public, optional `Authorization` if available
Errors: none (validated server-side)

- Get Permission Status
```http
GET /api/permissions/status?deviceid=abc&permission=location
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
Errors: none (idempotent when `deviceid` repeats)

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
