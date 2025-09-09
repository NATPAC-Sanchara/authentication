import nodemailer from 'nodemailer';
import { config } from '../config/env';

export class EmailService {
  private transporter: nodemailer.Transporter;
  private readonly BRAND_NAME = 'Sanchara';
  private readonly LOGO_URL = 'https://camo.githubusercontent.com/283e86e44dea1df3a9c11a5d5ea37032da347f1ec037c2000b47a130caf06d1a/68747470733a2f2f692e6962622e636f2f4b6a743654644e572f494d472d32303235303930382d5741303031352e6a7067';
  private readonly COLORS = {
    bg: '#0B0F1A',
    card: '#121826',
    accent: '#4F46E5',
    text: '#E5E7EB',
    muted: '#9CA3AF',
    divider: '#1F2937',
  } as const;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      secure: config.email.secure,
      auth: {
        user: config.email.user,
        pass: config.email.password,
      },
    });
  }

  private buildTemplate(options: {
    preheader?: string;
    heading: string;
    subheading?: string;
    bodyHtml: string;
    footerHtml?: string;
  }): string {
    const { preheader, heading, subheading, bodyHtml, footerHtml } = options;
    return `
      <div style="background:${this.COLORS.bg}; padding:32px 16px; font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,'Apple Color Emoji','Segoe UI Emoji';">
        ${preheader ? `<span style=\"display:none !important; visibility:hidden; opacity:0; color:transparent; height:0; width:0; overflow:hidden;\">${preheader}</span>` : ''}
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px; margin:0 auto;">
          <tr>
            <td style="text-align:center; padding-bottom:24px;">
              <img src="${this.LOGO_URL}" alt="${this.BRAND_NAME} Logo" style="height:40px; object-fit:contain; border:0; outline:none;" />
            </td>
          </tr>
          <tr>
            <td style="background:${this.COLORS.card}; border-radius:16px; padding:32px; box-shadow: 0 10px 25px rgba(0,0,0,0.25); border:1px solid ${this.COLORS.divider};">
              <h1 style="margin:0 0 8px 0; color:${this.COLORS.text}; font-size:22px; font-weight:700; letter-spacing:0.2px;">${heading}</h1>
              ${subheading ? `<p style=\"margin:0 0 24px 0; color:${this.COLORS.muted}; font-size:14px;\">${subheading}</p>` : ''}
              <div style="color:${this.COLORS.text}; font-size:15px; line-height:1.6;">${bodyHtml}</div>
              <hr style="border:none; border-top:1px solid ${this.COLORS.divider}; margin:28px 0;" />
              <p style="margin:0; color:${this.COLORS.muted}; font-size:12px;">If you didn’t request this, you can safely ignore this email.</p>
            </td>
          </tr>
          <tr>
            <td style="text-align:center; padding:16px; color:${this.COLORS.muted}; font-size:12px;">
              © ${new Date().getFullYear()} ${this.BRAND_NAME}. All rights reserved.
              ${footerHtml ? `<div style=\"margin-top:6px;\">${footerHtml}</div>` : ''}
            </td>
          </tr>
        </table>
      </div>
    `;
  }

  async sendOTPEmail(email: string, otp: string): Promise<void> {
    const bodyHtml = `
      <p style="margin:0 0 16px 0;">Welcome to <strong>${this.BRAND_NAME}</strong>.</p>
      <p style="margin:0 0 16px 0;">Use the One-Time Passcode (OTP) below to verify your email and finish setting up your account.</p>
      <div style="margin:20px 0; background:rgba(79,70,229,0.08); border:1px solid ${this.COLORS.accent}; border-radius:12px; padding:20px; text-align:center;">
        <div style="font-size:28px; letter-spacing:6px; font-weight:800; color:${this.COLORS.text};">${otp}</div>
      </div>
      <p style="margin:0 0 8px 0; color:${this.COLORS.muted};">This code expires in <strong>${config.otp.expiryMinutes} minutes</strong>.</p>
      <p style="margin:0; color:${this.COLORS.muted};">For your security, never share this code with anyone.</p>
    `;

    const mailOptions = {
      from: `"${this.BRAND_NAME}" <${config.email.user}>`,
      to: email,
      subject: 'Email Verification - OTP Code',
      html: this.buildTemplate({
        preheader: 'Your Sanchara verification code',
        heading: 'Verify your email',
        subheading: 'Secure your account in seconds',
        bodyHtml,
      }),
    };

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      throw new Error('Failed to send verification email');
    }
  }

  async sendWelcomeEmail(email: string): Promise<void> {
    const bodyHtml = `
      <p style="margin:0 0 16px 0;">You're all set! 🎉</p>
      <p style="margin:0 0 16px 0;">Your email has been verified successfully. You can now sign in and start exploring <strong>${this.BRAND_NAME}</strong>.</p>
      <p style="margin:0; color:${this.COLORS.muted};">Need help? Just reply to this email or visit our support center.</p>
    `;

    const mailOptions = {
      from: `"${this.BRAND_NAME}" <${config.email.user}>`,
      to: email,
      subject: 'Welcome! Email Verified Successfully',
      html: this.buildTemplate({
        preheader: 'Welcome to Sanchara',
        heading: 'Welcome to Sanchara',
        subheading: 'Your email is verified',
        bodyHtml,
      }),
    };

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      // Don't throw error for welcome email as it's not critical
      console.error('Failed to send welcome email:', error);
    }
  }

  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      console.error('Email service connection failed:', error);
      return false;
    }
  }
}

export const emailService = new EmailService();
