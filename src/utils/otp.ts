import crypto from 'crypto';
import { config } from '../config/env';

export class OTPUtils {
  static generateOTP(): string {
    const length = config.otp.length;
    const digits = '0123456789';
    let otp = '';
    
    for (let i = 0; i < length; i++) {
      otp += digits[crypto.randomInt(0, digits.length)];
    }
    
    return otp;
  }

  static generateOTPExpiry(): Date {
    const expiryMinutes = config.otp.expiryMinutes;
    const expiryTime = new Date();
    expiryTime.setMinutes(expiryTime.getMinutes() + expiryMinutes);
    return expiryTime;
  }

  static isOTPExpired(expiryTime: Date): boolean {
    return new Date() > expiryTime;
  }

  static hashOTP(otp: string): string {
    return crypto.createHash('sha256').update(otp).digest('hex');
  }

  static verifyOTP(providedOTP: string, hashedOTP: string): boolean {
    const hashedProvidedOTP = this.hashOTP(providedOTP);
    return crypto.timingSafeEqual(
      Buffer.from(hashedProvidedOTP, 'hex'),
      Buffer.from(hashedOTP, 'hex')
    );
  }
}
