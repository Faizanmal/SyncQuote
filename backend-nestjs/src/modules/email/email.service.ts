import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import sgMail from '@sendgrid/mail';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: { email: string; name: string };
}

type EmailProvider = 'resend' | 'sendgrid' | null;

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly provider: EmailProvider;
  private readonly resend: Resend | null = null;

  constructor(private configService: ConfigService) {
    const resendKey = this.configService.get<string>('RESEND_API_KEY')?.trim();
    const sendgridKey = this.configService.get<string>('SENDGRID_API_KEY')?.trim();

    if (resendKey) {
      this.resend = new Resend(resendKey);
      this.provider = 'resend';
      this.logger.log('Email provider: Resend');
    } else if (sendgridKey) {
      sgMail.setApiKey(sendgridKey);
      this.provider = 'sendgrid';
      this.logger.log('Email provider: SendGrid');
    } else {
      this.provider = null;
      this.logger.warn(
        'No email provider configured (set RESEND_API_KEY or SENDGRID_API_KEY). Email sending disabled.',
      );
    }
  }

  private defaultFrom() {
    return {
      email: this.configService.get<string>('EMAIL_FROM', 'noreply@faizanmalik.me'),
      name: this.configService.get<string>('EMAIL_FROM_NAME', 'SyncQuote'),
    };
  }

  private isConfigured(): boolean {
    return this.provider !== null;
  }

  /**
   * Deliver via Resend (preferred) or SendGrid.
   * @returns true if accepted by provider; false if skipped (no provider).
   */
  private async deliver(options: SendEmailOptions): Promise<boolean> {
    if (!this.isConfigured()) {
      this.logger.warn(`Email skipped (no provider): ${options.subject} → ${options.to}`);
      return false;
    }

    const from = options.from || this.defaultFrom();

    try {
      if (this.provider === 'resend' && this.resend) {
        const { error } = await this.resend.emails.send({
          from: `${from.name} <${from.email}>`,
          to: [options.to],
          subject: options.subject,
          html: options.html,
        });
        if (error) {
          throw new Error(error.message || 'Resend API error');
        }
      } else if (this.provider === 'sendgrid') {
        await sgMail.send({
          to: options.to,
          from,
          subject: options.subject,
          html: options.html,
        });
      }

      this.logger.log(`Email sent via ${this.provider} to ${options.to}: ${options.subject}`);
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send email to ${options.to}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  /**
   * Soft deliver — logs and returns false on failure instead of throwing.
   */
  private async deliverSoft(options: SendEmailOptions): Promise<boolean> {
    try {
      return await this.deliver(options);
    } catch {
      return false;
    }
  }

  /**
   * Generic send method for automation workflows
   */
  async send(options: SendEmailOptions): Promise<void> {
    const sent = await this.deliver(options);
    if (!sent) {
      throw new Error('Email provider not configured');
    }
  }

  /**
   * Alias for send method to maintain compatibility
   */
  async sendEmail(options: SendEmailOptions): Promise<void> {
    return this.send(options);
  }

  async sendVerificationEmail(email: string, token: string) {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const verificationUrl = `${frontendUrl}/verify-email?token=${token}`;

    await this.deliver({
      to: email,
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
    });
  }

  async sendPasswordResetEmail(email: string, token: string) {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

    await this.deliver({
      to: email,
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
    });
  }

  /**
   * @returns true when provider accepted the message; false when email is skipped (no API key).
   */
  async sendProposalToClient(options: {
    to: string;
    clientName: string;
    proposalTitle: string;
    proposalUrl: string;
    senderName: string;
    companyName?: string | null;
  }): Promise<boolean> {
    const fromName = options.companyName || options.senderName || 'SyncQuote';
    return this.deliver({
      to: options.to,
      subject: `${options.senderName} shared a proposal: ${options.proposalTitle}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Hi ${options.clientName},</h2>
          <p><strong>${options.senderName}</strong>${
            options.companyName ? ` at ${options.companyName}` : ''
          } shared a proposal with you.</p>
          <p style="font-size: 18px; margin: 16px 0;"><strong>${options.proposalTitle}</strong></p>
          <a href="${options.proposalUrl}" style="display: inline-block; background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">
            View Proposal
          </a>
          <p>Or copy this link: ${options.proposalUrl}</p>
          <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 14px;">Sent via ${fromName} on SyncQuote</p>
        </div>
      `,
    });
  }

  async sendProposalViewedNotification(email: string, proposalTitle: string, proposalUrl: string) {
    return this.deliverSoft({
      to: email,
      subject: `Your proposal "${proposalTitle}" has been viewed!`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Great news!</h2>
          <p>Your proposal <strong>"${proposalTitle}"</strong> has been viewed by your client.</p>
          <a href="${proposalUrl}" style="display: inline-block; background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">
            View Proposal
          </a>
        </div>
      `,
    });
  }

  async sendProposalApprovedNotification(
    email: string,
    proposalTitle: string,
    proposalUrl: string,
  ) {
    return this.deliverSoft({
      to: email,
      subject: `Your proposal "${proposalTitle}" was accepted`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Proposal accepted</h2>
          <p>Your proposal <strong>"${proposalTitle}"</strong> has been accepted by the client.</p>
          <p style="color: #6b7280; font-size: 13px;">This is an acceptance confirmation, not a certified electronic signature.</p>
          <a href="${proposalUrl}" style="display: inline-block; background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">
            View Proposal
          </a>
        </div>
      `,
    });
  }

  async sendPaymentReceivedNotification(
    email: string,
    proposalTitle: string,
    amount: number,
    currency: string,
    proposalUrl: string,
  ) {
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount);

    return this.deliverSoft({
      to: email,
      subject: `Payment received for "${proposalTitle}"`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Payment received</h2>
          <p>You received <strong>${formatted}</strong> for <strong>"${proposalTitle}"</strong>.</p>
          <a href="${proposalUrl}" style="display: inline-block; background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">
            View Proposal
          </a>
        </div>
      `,
    });
  }

  async sendNotificationEmail(email: string, userName: string, title: string, message: string) {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');

    return this.deliverSoft({
      to: email,
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
    });
  }

  async sendTeamInvitationEmail(
    email: string,
    teamName: string,
    inviterName: string,
    token: string,
    message?: string,
  ) {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const inviteUrl = `${frontendUrl}/invite?token=${token}`;
    const note = message
      ? `<p style="background:#f3f4f6;padding:12px;border-radius:6px;">${message}</p>`
      : '';

    await this.deliver({
      to: email,
      subject: `${inviterName} invited you to join ${teamName} on SyncQuote`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>You are invited to ${teamName}</h2>
          <p>${inviterName} invited you to collaborate on SyncQuote.</p>
          ${note}
          <a href="${inviteUrl}" style="display: inline-block; background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">
            Accept invitation
          </a>
          <p>Or copy this link: ${inviteUrl}</p>
          <p>This invitation expires in 7 days.</p>
        </div>
      `,
    });
  }

  async sendTeamAddedEmail(email: string, teamName: string, inviterName: string) {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');

    await this.deliver({
      to: email,
      subject: `You were added to ${teamName} on SyncQuote`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>You joined ${teamName}</h2>
          <p>${inviterName} added you to their team on SyncQuote.</p>
          <a href="${frontendUrl}/team" style="display: inline-block; background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">
            Open team
          </a>
        </div>
      `,
    });
  }
}
