import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { asyncHandler, CustomError } from '../middleware/errorHandler';
import { JWTUtils } from '../utils/jwt';
import { PasswordUtils } from '../utils/password';
import { config } from '../config/env';
import { buildGoogleAuthUrl, createState, exchangeCodeForTokens, verifyGoogleIdToken, verifyState } from '../services/googleOAuth';

export const googleAuth = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const redirect = typeof req.query.redirect === 'string' ? req.query.redirect : null;
  const state = createState({ redirect });
  const url = buildGoogleAuthUrl(state);
  res.redirect(url);
});

export const googleCallback = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { code, state } = req.query as { code?: string; state?: string };

  if (!code) {
    throw new CustomError('Missing authorization code', 400);
  }
  const stateResult = state ? verifyState(state) : { valid: false } as const;
  if (!state || !stateResult.valid) {
    throw new CustomError('Invalid state parameter', 400);
  }

  const tokens = await exchangeCodeForTokens(code);

  // Verify id_token using Google's public keys
  const idPayload = await verifyGoogleIdToken(tokens.id_token);

  if (!idPayload.email || idPayload.email_verified !== true) {
    throw new CustomError('Google account email is not verified', 401);
  }

  const googleId = idPayload.sub;
  const email = idPayload.email.toLowerCase();
  const profilePicture = idPayload.picture || null;

  // 1) If a user with the googleId exists, log them in
  let user = await prisma.user.findUnique({ where: { googleId } });

  if (!user) {
    // 2) If email exists without googleId, optionally link or error
    const existingByEmail = await prisma.user.findUnique({ where: { email } });
    if (existingByEmail) {
      if (existingByEmail.googleId && existingByEmail.googleId !== googleId) {
        throw new CustomError('Email already linked to another Google account', 409);
      }

      if (config.google.linkOnEmailMatch) {
        user = await prisma.user.update({
          where: { email },
          data: {
            googleId,
            profilePicture: profilePicture || existingByEmail.profilePicture || null,
            isVerified: true,
          },
        });
      } else {
        throw new CustomError('Account exists without Google link. Please sign in with email/password.', 409);
      }
    } else {
      // 3) Create new user with Google data
      const randomPassword = `google-${googleId}-${Math.random().toString(36).slice(2, 10)}`;
      const hashed = await PasswordUtils.hash(randomPassword);
      user = await prisma.user.create({
        data: {
          email,
          password: hashed,
          googleId,
          profilePicture,
          isVerified: true,
        },
      });
    }
  }

  // Issue JWT similar to other flows
  const token = JWTUtils.generateToken({
    id: user.id,
    email: user.email,
    isVerified: user.isVerified,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  } as any);

  // If mobile/web deep link redirect is provided in state, redirect with token as fragment
  if (stateResult.valid && stateResult.redirect) {
    const redirectUrl = new URL(stateResult.redirect);
    const fragment = new URLSearchParams({ token }).toString();
    res.redirect(`${redirectUrl.toString()}#${fragment}`);
    return;
  }

  res.status(200).json({
    success: true,
    message: 'Google sign-in successful',
    data: {
      user: {
        id: user.id,
        email: user.email,
        isVerified: user.isVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      token,
    },
  });
});


