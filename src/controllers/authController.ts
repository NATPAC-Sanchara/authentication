import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { PasswordUtils } from '../utils/password';
import { JWTUtils } from '../utils/jwt';
import { OTPUtils } from '../utils/otp';
import { emailService } from '../services/emailService';
import { CustomError, asyncHandler } from '../middleware/errorHandler';
import { SignUpRequest, SignInRequest, VerifyOTPRequest, ResendOTPRequest, AuthResponse } from '../types';

export const signUp = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { email, password }: SignUpRequest = req.body;

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (existingUser) {
    if (existingUser.isVerified) {
      throw new CustomError('User with this email already exists and is verified', 409);
    } else {
      // User exists but not verified, update with new password and OTP
      const hashedPassword = await PasswordUtils.hash(password);
      const otp = OTPUtils.generateOTP();
      const hashedOTP = OTPUtils.hashOTP(otp);
      const otpExpiry = OTPUtils.generateOTPExpiry();

      await prisma.user.update({
        where: { email: email.toLowerCase() },
        data: {
          password: hashedPassword,
          otp: hashedOTP,
          otpExpiresAt: otpExpiry,
        },
      });

      // Send OTP email
      await emailService.sendOTPEmail(email, otp);

      res.status(200).json({
        success: true,
        message: 'OTP sent to your email for verification',
      });
      return;
    }
  }

  // Hash password
  const hashedPassword = await PasswordUtils.hash(password);

  // Generate OTP
  const otp = OTPUtils.generateOTP();
  const hashedOTP = OTPUtils.hashOTP(otp);
  const otpExpiry = OTPUtils.generateOTPExpiry();

  // Create user
  await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      password: hashedPassword,
      otp: hashedOTP,
      otpExpiresAt: otpExpiry,
      isVerified: false,
    },
  });

  // Send OTP email
  await emailService.sendOTPEmail(email, otp);

  res.status(201).json({
    success: true,
    message: 'User created successfully. OTP sent to your email for verification',
  });
});

export const verifyOTP = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { email, otp }: VerifyOTPRequest = req.body;

  // Find user by email
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (!user) {
    throw new CustomError('User not found', 404);
  }

  if (user.isVerified) {
    throw new CustomError('Email is already verified', 400);
  }

  if (!user.otp || !user.otpExpiresAt) {
    throw new CustomError('No OTP found for this user', 400);
  }

  // Check if OTP is expired
  if (OTPUtils.isOTPExpired(user.otpExpiresAt)) {
    throw new CustomError('OTP has expired', 400);
  }

  // Verify OTP
  if (!OTPUtils.verifyOTP(otp, user.otp)) {
    throw new CustomError('Invalid OTP', 400);
  }

  // Update user as verified and clear OTP
  const updatedUser = await prisma.user.update({
    where: { email: email.toLowerCase() },
    data: {
      isVerified: true,
      otp: null,
      otpExpiresAt: null,
    },
    select: {
      id: true,
      email: true,
      isVerified: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  // Send welcome email
  await emailService.sendWelcomeEmail(email);

  // Generate JWT token
  const token = JWTUtils.generateToken(updatedUser as any, 'USER');

  const response: AuthResponse = {
    success: true,
    message: 'Email verified successfully',
    data: {
      user: updatedUser,
      token,
    },
  };

  res.status(200).json(response);
});

export const resendOTP = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { email }: ResendOTPRequest = req.body;

  // Find user by email
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (!user) {
    throw new CustomError('User not found', 404);
  }

  if (user.isVerified) {
    throw new CustomError('Email is already verified', 400);
  }

  // Generate new OTP
  const otp = OTPUtils.generateOTP();
  const hashedOTP = OTPUtils.hashOTP(otp);
  const otpExpiry = OTPUtils.generateOTPExpiry();

  // Update user with new OTP
  await prisma.user.update({
    where: { email: email.toLowerCase() },
    data: {
      otp: hashedOTP,
      otpExpiresAt: otpExpiry,
    },
  });

  // Send OTP email
  await emailService.sendOTPEmail(email, otp);

  res.status(200).json({
    success: true,
    message: 'OTP resent to your email',
  });
});

export const signIn = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { email, password }: SignInRequest = req.body;

  // Find user by email
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (!user) {
    throw new CustomError('Invalid email or password', 401);
  }

  // Check if user is verified
  if (!user.isVerified) {
    throw new CustomError('Please verify your email before signing in', 401);
  }

  // Verify password
  const isPasswordValid = await PasswordUtils.verify(user.password, password);

  if (!isPasswordValid) {
    throw new CustomError('Invalid email or password', 401);
  }

  // Generate JWT token
  const token = JWTUtils.generateToken({
    id: user.id,
    email: user.email,
    isVerified: user.isVerified,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  } as any, 'USER');

  const response: AuthResponse = {
    success: true,
    message: 'Sign in successful',
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
  };

  res.status(200).json(response);
});

export const getProfile = asyncHandler(async (req: any, res: Response): Promise<void> => {
  const user = req.user;

  res.status(200).json({
    success: true,
    message: 'Profile retrieved successfully',
    data: { user },
  });
});