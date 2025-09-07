import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { User } from '../types';

export class JWTUtils {
  static generateToken(user: User): string {
    const payload = {
      id: user.id,
      email: user.email,
      role: (user as any).role,
    };
    // @ts-ignore
    return jwt.sign(
      payload,
      config.jwt.secret,
      {
        expiresIn: config.jwt.expiresIn,
        issuer: 'auth-backend',
        audience: 'auth-frontend',
      }
    );
  }

  static verifyToken(token: string): any {
    try {
      return jwt.verify(token, config.jwt.secret, {
        issuer: 'auth-backend',
        audience: 'auth-frontend',
      });
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Token has expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid token');
      } else {
        throw new Error('Token verification failed');
      }
    }
  }

  static extractTokenFromHeader(authHeader: string | undefined): string {
    if (!authHeader) {
      throw new Error('Authorization header is missing');
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new Error('Invalid authorization header format');
    }

    return parts[1];
  }
}
