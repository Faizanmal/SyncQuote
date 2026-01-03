import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as sgMail from '@sendgrid/mail';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: { email: string; name: string };
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('SENDGRID_API_KEY');
    if (apiKey) {
      sgMail.setApiKey(apiKey);
    } else {
      this.logger.warn('SendGrid API key not configured. Email sending will be disabled.');
    }
  }

  /**
   * Generic send method for automation workflows
   */
  async send(options: SendEmailOptions): Promise<void> {
    const msg = {
      to: options.to,
      from: options.from || {
        email: this.configService.get<string>('EMAIL_FROM', 'noreply@syncquote.com'),
        name: this.configService.get<string>('EMAIL_FROM_NAME', 'SyncQuote'),
      },
      subject: options.subject,
      html: options.html,
    };

    try {
      await sgMail.send(msg);
      this.logger.log(`Email sent to ${options.to}: ${options.subject}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${options.to}: ${error.message}`);
      throw error;
    }
  }

  async sendVerificationEmail(email: string, token: string) {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const verificationUrl = `${frontendUrl}/verify-email?token=${token}`;

    const msg = {
      to: email,
      from: {
        email: this.configService.get<string>('EMAIL_FROM', 'noreply@syncquote.com'),
        name: this.configService.get<string>('EMAIL_FROM_NAME', 'SyncQuote'),
      },
      subject: 'Verify Your SyncQuote Account',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Welcome to SyncQuote!</h2>
          <p>Please verify your email address by clicking the button below:</p>
          <a href="${verificationUrl}" style="display: inline-block; background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">
            Verify Email
          </a>
          <p>Or copy and paste this link: ${verificationUrl}</p>
          <p>This link will expire in 24 hours.</p>
          <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 14px;">
            If you didn't sign up for SyncQuote, you can safely ignore this email.
          </p>
        </div>
      `,
    };

    try {
      await sgMail.send(msg);
      this.logger.log(`Verification email sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send verification email: ${error.message}`);
      throw error;
    }
  }

  async sendPasswordResetEmail(email: string, token: string) {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

    const msg = {
      to: email,
      from: {
        email: this.configService.get<string>('EMAIL_FROM', 'noreply@syncquote.com'),
        name: this.configService.get<string>('EMAIL_FROM_NAME', 'SyncQuote'),
      },
      subject: 'Reset Your SyncQuote Password',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Password Reset Request</h2>
          <p>You requested to reset your password. Click the button below to proceed:</p>
          <a href="${resetUrl}" style="display: inline-block; background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">
            Reset Password
          </a>
          <p>Or copy and paste this link: ${resetUrl}</p>
          <p>This link will expire in 1 hour.</p>
          <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 14px;">
            If you didn't request a password reset, you can safely ignore this email.
          </p>
        </div>
      `,
    };

    try {
      await sgMail.send(msg);
      this.logger.log(`Password reset email sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send password reset email: ${error.message}`);
      throw error;
    }
  }

  async sendProposalViewedNotification(email: string, proposalTitle: string, proposalUrl: string) {
    const msg = {
      to: email,
      from: {
        email: this.configService.get<string>('EMAIL_FROM', 'noreply@syncquote.com'),
        name: this.configService.get<string>('EMAIL_FROM_NAME', 'SyncQuote'),
      },
      subject: `Your proposal "${proposalTitle}" has been viewed!`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>🎉 Great news!</h2>
          <p>Your proposal <strong>"${proposalTitle}"</strong> has been viewed by your client.</p>
          <a href="${proposalUrl}" style="display: inline-block; background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">
            View Proposal
          </a>
        </div>
      `,
    };

    try {
      await sgMail.send(msg);
      this.logger.log(`Proposal viewed notification sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send proposal viewed notification: ${error.message}`);
    }
  }

  async sendProposalApprovedNotification(
    email: string,
    proposalTitle: string,
    proposalUrl: string,
  ) {
    const msg = {
      to: email,
      from: {
        email: this.configService.get<string>('EMAIL_FROM', 'noreply@syncquote.com'),
        name: this.configService.get<string>('EMAIL_FROM_NAME', 'SyncQuote'),
      },
      subject: `🎊 Your proposal "${proposalTitle}" was approved!`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>🎊 Congratulations!</h2>
          <p>Your proposal <strong>"${proposalTitle}"</strong> has been approved and signed!</p>
          <a href="${proposalUrl}" style="display: inline-block; background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">
            View Signed Proposal
          </a>
        </div>
      `,
    };

    try {
      await sgMail.send(msg);
      this.logger.log(`Proposal approved notification sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send proposal approved notification: ${error.message}`);
    }
  }

  async sendNotificationEmail(email: string, userName: string, title: string, message: string) {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');

    const msg = {
      to: email,
      from: {
        email: this.configService.get<string>('EMAIL_FROM', 'noreply@syncquote.com'),
        name: this.configService.get<string>('EMAIL_FROM_NAME', 'SyncQuote'),
      },
      subject: title,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Hi ${userName},</h2>
          <p>${message}</p>
          <a href="${frontendUrl}/dashboard" style="display: inline-block; background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">
            View Dashboard
          </a>
          <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 14px;">
            You're receiving this email because you have notifications enabled for your SyncQuote account.
          </p>
        </div>
      `,
    };

    try {
      await sgMail.send(msg);
      this.logger.log(`Notification email sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send notification email: ${error.message}`);
    }
  }
}
