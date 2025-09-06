# Authentication Backend API

A secure, scalable backend authentication system built with Express.js, TypeScript, and PostgreSQL, optimized for deployment on Vercel.

## 🚀 Features

- **Secure Authentication**: JWT-based authentication with Argon2 password hashing
- **Email Verification**: OTP-based email verification with Nodemailer
- **Type Safety**: Full TypeScript implementation
- **Database**: PostgreSQL with Prisma ORM
- **Security**: Rate limiting, CORS, input validation, and security headers
- **Deployment**: Optimized for Vercel serverless deployment
- **Error Handling**: Comprehensive error handling and logging

## 📋 Prerequisites

- Node.js 18+ 
- PostgreSQL database
- npm or yarn

## 🛠️ Installation

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

## 🏗️ Project Structure

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

## 🔌 API Endpoints

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

## 🔒 Security Features

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

## 🚀 Deployment on Vercel

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

### 4. Database Migration
After deployment, run the database migration:
```bash
vercel env pull .env.local
npx prisma db push
```

## 🧪 Testing

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

## 📝 Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build the project for production
- `npm start` - Start production server
- `npm run db:generate` - Generate Prisma client
- `npm run db:push` - Push schema changes to database
- `npm run db:migrate` - Run database migrations
- `npm run db:studio` - Open Prisma Studio

## 🔧 Configuration

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

## 🛡️ Security Best Practices

1. **Password Hashing**: Uses Argon2id for secure password hashing
2. **JWT Security**: Tokens include issuer and audience claims
3. **Email Verification**: OTP-based email verification prevents fake accounts
4. **OTP Security**: OTPs are hashed and have time-based expiration
5. **Rate Limiting**: Prevents brute force attacks on auth endpoints
6. **Input Validation**: All inputs are validated using Joi
7. **Error Handling**: Sensitive information is not exposed in errors
8. **CORS**: Configurable cross-origin resource sharing
9. **Security Headers**: Helmet.js provides security headers

## 🐛 Troubleshooting

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

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📞 Support

For support, please open an issue in the repository or contact the development team.
