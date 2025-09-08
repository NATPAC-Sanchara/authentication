import { Request, Response, NextFunction } from 'express';
import { JWTUtils } from '../utils/jwt';
import { prisma } from '../config/database';
import { Admin, User } from '../types';

export interface AuthRequest extends Request {
  user?: User | (Admin & { role: 'ADMIN' | 'SUPER_ADMIN' });
}

export const authenticateToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = JWTUtils.extractTokenFromHeader(authHeader);
    
    const decoded = JWTUtils.verifyToken(token) as any;
    
    // Determine subject type
    let user: any = null;
    if (decoded.subjectType === 'ADMIN') {
      user = await prisma.admin.findUnique({
        where: { id: decoded.id },
        select: {
          id: true,
          email: true,
          isVerified: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } else {
      user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: {
          id: true,
          email: true,
          isVerified: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    }

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'User not found',
      });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: error instanceof Error ? error.message : 'Authentication failed',
    });
  }
};

export const authorizeRoles = (...roles: Array<'ADMIN' | 'SUPER_ADMIN'>) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const user = req.user as any;
    if (!user || !user.role || !roles.includes(user.role)) {
      res.status(403).json({ success: false, message: 'Forbidden' });
      return;
    }
    next();
  };
};
