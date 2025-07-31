import nodemailer from 'nodemailer';
import logger from '../utils/logger';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface VerificationEmailData {
  firstName: string;
  verificationUrl: string;
}

interface PasswordResetEmailData {
  firstName: string;
  resetUrl: string;
}

class EmailService {
  private transporter!: nodemailer.Transporter;
  private isConfigured: boolean;

  constructor() {
    this.isConfigured = this.setupTransporter();
  }

  private setupTransporter(): boolean {
    try {
      // Check if we have email credentials
      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
        logger.warn('Email service not configured. Email features will be disabled.');
        return false;
      }

      // For testing with placeholder password, use test mode
      if (process.env.EMAIL_PASSWORD === 'abcd efgh ijkl mnop') {
        logger.info('Using test email configuration - emails will be logged only');
        // Create a test transporter that doesn't actually send emails
        this.transporter = nodemailer.createTransport({
          streamTransport: true,
          newline: 'unix',
          buffer: true
        });
        return true;
      }

      // Gmail configuration with App Password
      logger.info('Configuring Gmail SMTP service...');
      const emailConfig = {
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD, // This should be your Gmail App Password
        },
        secure: true, // Use SSL
        port: 465,
        tls: {
          rejectUnauthorized: false
        }
      };

      this.transporter = nodemailer.createTransport(emailConfig);
      logger.info('Gmail SMTP service configured successfully');
      return true;
    } catch (error) {
      logger.error('Failed to setup email transporter:', error);
      return false;
    }
  }

  private generateVerificationEmailHTML(data: VerificationEmailData): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Verify Your Email - AgroConnect</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
            .content { padding: 30px; }
            .button { display: inline-block; background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { background-color: #f9f9f9; padding: 20px; text-align: center; color: #666; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Welcome to AgroConnect!</h1>
            </div>
            <div class="content">
                <h2>Hello ${data.firstName}!</h2>
                <p>Thank you for joining AgroConnect, your smart farming companion. To complete your registration, please verify your email address.</p>
                <p>Click the button below to verify your email:</p>
                <a href="${data.verificationUrl}" class="button">Verify Email Address</a>
                <p>Or copy and paste this link into your browser:</p>
                <p><a href="${data.verificationUrl}">${data.verificationUrl}</a></p>
                <p>This verification link will expire in 24 hours for security reasons.</p>
                <p>If you didn't create an account with AgroConnect, please ignore this email.</p>
            </div>
            <div class="footer">
                <p>© 2025 AgroConnect. All rights reserved.</p>
                <p>This is an automated message, please do not reply to this email.</p>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  private generatePasswordResetEmailHTML(data: PasswordResetEmailData): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Reset Your Password - AgroConnect</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { background-color: #FF9800; color: white; padding: 20px; text-align: center; }
            .content { padding: 30px; }
            .button { display: inline-block; background-color: #FF9800; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { background-color: #f9f9f9; padding: 20px; text-align: center; color: #666; }
            .warning { background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 15px 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Password Reset Request</h1>
            </div>
            <div class="content">
                <h2>Hello ${data.firstName}!</h2>
                <p>We received a request to reset your AgroConnect account password.</p>
                <div class="warning">
                    <strong>Important:</strong> If you didn't request this password reset, please ignore this email. Your password will remain unchanged.
                </div>
                <p>To reset your password, click the button below:</p>
                <a href="${data.resetUrl}" class="button">Reset Password</a>
                <p>Or copy and paste this link into your browser:</p>
                <p><a href="${data.resetUrl}">${data.resetUrl}</a></p>
                <p>This password reset link will expire in 1 hour for security reasons.</p>
                <p>After clicking the link, you'll be able to create a new password for your account.</p>
            </div>
            <div class="footer">
                <p>© 2025 AgroConnect. All rights reserved.</p>
                <p>This is an automated message, please do not reply to this email.</p>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  async sendVerificationEmail(email: string, firstName: string, verificationToken: string): Promise<boolean> {
    if (!this.isConfigured) {
      logger.warn('Email service not configured. Skipping verification email.');
      return false;
    }

    try {
      const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}&email=${encodeURIComponent(email)}`;
      
      const emailOptions: EmailOptions = {
        to: email,
        subject: 'Verify Your Email - AgroConnect',
        html: this.generateVerificationEmailHTML({ firstName, verificationUrl }),
        text: `Hello ${firstName}! Please verify your email by visiting: ${verificationUrl}`
      };

      if (process.env.EMAIL_PASSWORD === 'abcd efgh ijkl mnop') {
        logger.info(`TEST MODE - Verification email would be sent to: ${email}`);
        logger.info(`Verification URL: ${verificationUrl}`);
        return true;
      }

      await this.transporter.sendMail({
        from: `"AgroConnect" <${process.env.EMAIL_USER}>`,
        ...emailOptions
      });
      
      logger.info(`Verification email sent successfully to: ${email}`);
      return true;
    } catch (error) {
      logger.error(`Failed to send verification email to ${email}:`, error);
      return false;
    }
  }

  async sendPasswordResetEmail(email: string, firstName: string, resetToken: string): Promise<boolean> {
    if (!this.isConfigured) {
      logger.warn('Email service not configured. Skipping password reset email.');
      return false;
    }

    try {
      const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;
      
      const emailOptions: EmailOptions = {
        to: email,
        subject: 'Reset Your Password - AgroConnect',
        html: this.generatePasswordResetEmailHTML({ firstName, resetUrl }),
        text: `Hello ${firstName}! Reset your password by visiting: ${resetUrl}`
      };

      if (process.env.EMAIL_PASSWORD === 'abcd efgh ijkl mnop') {
        logger.info(`TEST MODE - Password reset email would be sent to: ${email}`);
        logger.info(`Reset URL: ${resetUrl}`);
        return true;
      }

      await this.transporter.sendMail({
        from: `"AgroConnect" <${process.env.EMAIL_USER}>`,
        ...emailOptions
      });
      
      logger.info(`Password reset email sent successfully to: ${email}`);
      return true;
    } catch (error) {
      logger.error(`Failed to send password reset email to ${email}:`, error);
      return false;
    }
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    if (!this.isConfigured) {
      logger.warn('Email service not configured. Email features will be disabled.');
      return false;
    }

    try {
      if (process.env.EMAIL_PASSWORD === 'abcd efgh ijkl mnop') {
        logger.info(`TEST MODE - Email would be sent to: ${options.to}`);
        logger.info(`Subject: ${options.subject}`);
        return true;
      }

      await this.transporter.sendMail({
        from: `"AgroConnect" <${process.env.EMAIL_USER}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text
      });
      
      logger.info(`Email sent successfully to: ${options.to}`);
      return true;
    } catch (error) {
      logger.error('Failed to send email:', error);
      return false;
    }
  }

  async verifyConnection(): Promise<boolean> {
    if (!this.isConfigured) {
      return false;
    }

    try {
      if (process.env.EMAIL_PASSWORD === 'abcd efgh ijkl mnop') {
        logger.info('TEST MODE - Email service connection verified (test mode)');
        return true;
      }

      await this.transporter.verify();
      logger.info('Gmail SMTP connection verified successfully');
      return true;
    } catch (error) {
      logger.error('Gmail SMTP connection failed:', error);
      return false;
    }
  }

  isEmailServiceConfigured(): boolean {
    return this.isConfigured;
  }
}

export default new EmailService();
