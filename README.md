# Authentication Backend API

A secure, scalable backend authentication system built with Express.js, TypeScript, and PostgreSQL, optimized for deployment on Vercel.

## Features

- **Secure Authentication**: JWT-based authentication with Argon2 password hashing
- **Email Verification**: OTP-based email verification with Nodemailer
- **Type Safety**: Full TypeScript implementation
- **Database**: PostgreSQL with Prisma ORM
- **Security**: Rate limiting, CORS, input validation, and security headers
- **Deployment**: Optimized for Vercel serverless deployment
- **Error Handling**: Comprehensive error handling and logging

## Prerequisites

- Node.js 18+ 
- PostgreSQL database
- npm or yarn

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp env.example .env
   ```
   
   Update the `.env` file with your configuration:
   ```env
   DATABASE_URL="your-postgresql-connection-string"
   JWT_SECRET="your-super-secret-jwt-key"
   JWT_EXPIRES_IN="7d"
   PORT=3000
   NODE_ENV="development"
   
   # Email Configuration
   EMAIL_HOST="smtp.gmail.com"
   EMAIL_PORT=587
   EMAIL_SECURE=false
   EMAIL_USER="noreply.sanchara@gmail.com"
   EMAIL_PASSWORD="nodc wmew efwn etyi"
   
   # OTP Configuration
   OTP_EXPIRY_MINUTES=10
   OTP_LENGTH=6
   ```

4. **Database Setup**
   ```bash
   # Generate Prisma client
   npm run db:generate
   
   # Push schema to database
   npm run db:push
   ```

5. **Start Development Server**
   ```bash
   npm run dev
   ```

## Project Structure

```
src/
├── config/          # Configuration files
│   ├── database.ts  # Prisma client setup
│   └── env.ts       # Environment variables
├── controllers/     # Route controllers
│   └── authController.ts
├── middleware/      # Express middleware
│   ├── auth.ts      # JWT authentication
│   ├── errorHandler.ts
│   └── security.ts  # Security middleware
├── routes/          # API routes
│   ├── auth.ts      # Authentication routes
│   └── index.ts     # Main router
├── types/           # TypeScript type definitions
│   └── index.ts
├── utils/           # Utility functions
│   ├── jwt.ts       # JWT utilities
│   ├── password.ts  # Password hashing
│   └── validation.ts # Input validation
├── app.ts           # Express app configuration
└── index.ts         # Server entry point
```

## API Endpoints

### Authentication

#### Sign Up
```http
POST /api/auth/signup
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User created successfully. OTP sent to your email for verification"
}
```

#### Verify OTP
```http
POST /api/auth/verify-otp
Content-Type: application/json

{
  "email": "user@example.com",
  "otp": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Email verified successfully",
  "data": {
    "user": {
      "id": "user_id",
      "email": "user@example.com",
      "isVerified": true,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    "token": "jwt_token_here"
  }
}
```

#### Resend OTP
```http
POST /api/auth/resend-otp
Content-Type: application/json

{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "OTP resent to your email"
}
```

#### Sign In
```http
POST /api/auth/signin
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Sign in successful",
  "data": {
    "user": {
      "id": "user_id",
      "email": "user@example.com",
      "isVerified": true,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    "token": "jwt_token_here"
  }
}
```

**Note:** Sign in is only allowed after successful email verification.
#### Google OAuth

```http
GET /api/auth/google
```

Redirects to Google consent screen. Optional query param `redirect` can be provided to deep-link back to your mobile app or web URL. On success, the JWT will be appended as URL fragment: `#token=<JWT>`.

```http
GET /api/auth/google/callback?code=...&state=...
```

Returns JWT on success.

Example success response:
```json
{
  "success": true,
  "message": "Google sign-in successful",
  "data": {
    "user": {
      "id": "clxyz...",
      "email": "user@example.com",
      "isVerified": true,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    "token": "<jwt>"
  }
}
```

## Flutter (Android) Integration Guide — Google Sign-In

This backend supports a mobile-friendly OAuth flow with an optional `redirect` parameter so your Flutter app can receive the final JWT without hosting an intermediate page.

### 1) Backend and Google Cloud setup
- Ensure backend env vars are set with real values: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`.
- In Google Cloud Console → Credentials → OAuth 2.0 Client IDs:
  - Add the backend callback to Authorized redirect URIs: `https://your.api.com/api/auth/google/callback` (and a local dev URL if needed).

### 2) App deep link (AndroidManifest)
Choose a stable deep link for your app, e.g. `myapp://auth/callback`, so the backend can redirect back with the JWT.

AndroidManifest.xml:
```xml
<application>
  <activity android:name=".MainActivity" android:exported="true">
    <intent-filter>
      <action android:name="android.intent.action.VIEW"/>
      <category android:name="android.intent.category.DEFAULT"/>
      <category android:name="android.intent.category.BROWSABLE"/>
      <data android:scheme="myapp" android:host="auth" android:path="/callback"/>
    </intent-filter>
  </activity>
</application>
```

### 3) Start the OAuth flow from Flutter
- Use `url_launcher` to open the backend OAuth URL in a Custom Tab / external browser.
- Pass your deep link as a `redirect` query param. On success the backend will redirect to your deep link with `#token=<JWT>` as URL fragment.

pubspec.yaml:
```yaml
dependencies:
  url_launcher: ^6.3.0
  uni_links: ^0.5.1
```

Dart example (launch):
```dart
import 'dart:io';
import 'package:url_launcher/url_launcher.dart';

Future<void> startGoogleSignIn() async {
  final backendBase = Platform.isAndroid ? 'http://10.0.2.2:3000' : 'http://localhost:3000';
  final redirect = Uri.encodeComponent('myapp://auth/callback');
  final url = Uri.parse('$backendBase/api/auth/google?redirect=$redirect');

  if (!await launchUrl(url, mode: LaunchMode.externalApplication)) {
    throw Exception('Could not launch $url');
  }
}
```

### 4) Receive the JWT via deep link
- Use `uni_links` to handle incoming links in your app.
- Parse the token from the URL fragment after `#`.

Dart example (receive):
```dart
import 'dart:async';
import 'package:uni_links/uni_links.dart';

StreamSubscription? _sub;

void initDeepLinkListener(void Function(String jwt) onToken) {
  _sub = uriLinkStream.listen((Uri? uri) {
    if (uri == null) return;
    // Example: myapp://auth/callback#token=eyJhbGciOi...
    final fragment = uri.fragment; // 'token=...&foo=bar'
    final pairs = fragment.split('&');
    final map = <String, String>{};
    for (final p in pairs) {
      final i = p.indexOf('=');
      if (i > 0) map[p.substring(0, i)] = Uri.decodeComponent(p.substring(i + 1));
    }
    final jwt = map['token'];
    if (jwt != null && jwt.isNotEmpty) {
      onToken(jwt);
    }
  }, onError: (err) {
    // Handle errors appropriately
  });
}

void disposeDeepLinkListener() {
  _sub?.cancel();
}
```

Store the JWT securely (e.g., flutter_secure_storage) and use it in the `Authorization: Bearer <token>` header for your API calls.

### 5) Alternative: JSON callback (no deep link)
If you prefer to get JSON instead of a redirect:
1) Launch the OAuth flow without `redirect`.
2) Complete Google consent in a browser.
3) The backend responds to `GET /api/auth/google/callback` with JSON containing `{ user, token }`.

### 6) API summary for Flutter devs
- `GET /api/auth/google?redirect=myapp://auth/callback`
  - 302 redirect → Google consent → redirects back to `myapp://auth/callback#token=<JWT>` on success.
- `GET /api/auth/google/callback?code=...&state=...`
  - If no `redirect` was provided, returns JSON `{ success, message, data: { user, token } }`.

Common errors to handle:
- 400: missing/invalid parameters (`code`, `state`).
- 401: Google email not verified.
- 409: account exists but not linked (when `GOOGLE_LINK_ON_EMAIL_MATCH=false`).
- 500: unexpected server error.

#### Get Profile (Protected)
```http
GET /api/auth/profile
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Profile retrieved successfully",
  "data": {
    "user": {
      "id": "user_id",
      "email": "user@example.com",
      "isVerified": true,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

### Health Check
```http
GET /api/health
```

**Response:**
```json
{
  "success": true,
  "message": "Server is running",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Security Features

### Password Requirements
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

### Rate Limiting
- **General API**: 100 requests per 15 minutes
- **Authentication**: 5 attempts per 15 minutes

### Security Headers
- Helmet.js for security headers
- CORS configuration
- Content Security Policy

## Deployment on Vercel

### 1. Prepare for Deployment
```bash
# Build the project
npm run build
```

### 2. Deploy to Vercel
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

### 3. Environment Variables
Set these environment variables in your Vercel dashboard:

- `DATABASE_URL`: Your PostgreSQL connection string
- `JWT_SECRET`: A secure random string for JWT signing
- `JWT_EXPIRES_IN`: Token expiration time (default: "7d")
- `NODE_ENV`: Set to "production"
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `GOOGLE_LINK_ON_EMAIL_MATCH`

### 4. Database Migration
After deployment, run the database migration:
```bash
vercel env pull .env.local
npx prisma migrate deploy
```

## Testing

### Manual Testing with cURL

**Sign Up:**
```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPass123!"}'
```

**Verify OTP:**
```bash
curl -X POST http://localhost:3000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","otp":"123456"}'
```

**Resend OTP:**
```bash
curl -X POST http://localhost:3000/api/auth/resend-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

**Sign In:**
```bash
curl -X POST http://localhost:3000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPass123!"}'
```

**Get Profile:**
```bash
curl -X GET http://localhost:3000/api/auth/profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build the project for production
- `npm start` - Start production server
- `npm run db:generate` - Generate Prisma client
- `npm run db:push` - Push schema changes to database
- `npm run db:migrate` - Run database migrations
- `npm run db:studio` - Open Prisma Studio

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `JWT_SECRET` | Secret key for JWT signing | Required |
| `JWT_EXPIRES_IN` | JWT token expiration time | "7d" |
| `PORT` | Server port | 3000 |
| `NODE_ENV` | Environment mode | "development" |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window in milliseconds | 900000 |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | 100 |
| `EMAIL_HOST` | SMTP server host | "smtp.gmail.com" |
| `EMAIL_PORT` | SMTP server port | 587 |
| `EMAIL_SECURE` | Use SSL/TLS | false |
| `EMAIL_USER` | SMTP username | "noreply.sanchara@gmail.com" |
| `EMAIL_PASSWORD` | SMTP password/app password | "nodc wmew efwn etyi" |
| `OTP_EXPIRY_MINUTES` | OTP expiration time in minutes | 10 |
| `OTP_LENGTH` | OTP code length | 6 |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | Required |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | Required |
| `GOOGLE_REDIRECT_URI` | OAuth redirect URI | Required |
| `GOOGLE_LINK_ON_EMAIL_MATCH` | Auto-link Google on email match | false |

## Security Best Practices

1. **Password Hashing**: Uses Argon2id for secure password hashing
2. **JWT Security**: Tokens include issuer and audience claims
3. **Email Verification**: OTP-based email verification prevents fake accounts
4. **OTP Security**: OTPs are hashed and have time-based expiration
5. **Rate Limiting**: Prevents brute force attacks on auth endpoints
6. **Input Validation**: All inputs are validated using Joi
7. **Error Handling**: Sensitive information is not exposed in errors
8. **CORS**: Configurable cross-origin resource sharing
9. **Security Headers**: Helmet.js provides security headers

## Troubleshooting

### Common Issues

1. **Database Connection Error**
   - Verify your `DATABASE_URL` is correct
   - Ensure your database is accessible
   - Check if SSL is required

2. **JWT Token Issues**
   - Verify `JWT_SECRET` is set
   - Check token expiration
   - Ensure proper Authorization header format

3. **Email Service Issues**
   - Verify email credentials are correct
   - Check if 2FA is enabled (use app password for Gmail)
   - Ensure SMTP settings are correct
   - Check firewall/network restrictions

4. **OTP Issues**
   - Check if OTP has expired (10 minutes default)
   - Verify OTP is exactly 6 digits
   - Ensure email was sent successfully
   - Check spam folder for verification emails

5. **Rate Limiting**
   - Check if you've exceeded rate limits
   - Wait for the window to reset
   - Verify rate limit configuration

6. **Sign In Issues**
   - Ensure email is verified before signing in
   - Check if user exists and is verified
   - Verify password is correct

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## Support

For support, please open an issue in the repository or contact the development team.
