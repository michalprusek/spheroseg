/**
 * Unified Email Service
 * 
 * Consolidates all email functionality with i18n support
 */

import nodemailer from 'nodemailer';
import { createLogger } from '../utils/logger';
import config from '../config';
import i18next from '../config/i18n';

const logger = createLogger('emailService');

// Create reusable transporter
const transporter = nodemailer.createTransport({
  host: config.email.host,
  port: config.email.port,
  secure: config.email.secure,
  auth: {
    user: config.email.user,
    pass: config.email.pass,
  },
});

// Verify transporter configuration on startup
transporter.verify((error) => {
  if (error) {
    logger.error('Email transporter verification failed:', error);
  } else {
    logger.info('Email transporter is ready');
  }
});

interface SendProjectInvitationParams {
  to: string;
  projectTitle: string;
  ownerName: string;
  invitationToken: string;
  permission: 'view' | 'edit';
  recipientLanguage?: string;
}

interface SendInvitationAcceptedParams {
  to: string;
  projectTitle: string;
  acceptedByName: string;
  acceptedByEmail: string;
  ownerLanguage?: string;
}

interface SendPasswordResetParams {
  to: string;
  resetToken: string;
  userName?: string;
  language?: string;
}

interface SendVerificationEmailParams {
  to: string;
  verificationToken: string;
  userName?: string;
  language?: string;
}

interface SendAccessRequestParams {
  to: string;
  requesterName: string;
  requesterEmail: string;
  message?: string;
  language?: string;
}

/**
 * Get translation function for a specific language
 */
function getTranslator(language?: string) {
  return i18next.getFixedT(language || 'en');
}

/**
 * Generate email HTML template
 */
function generateEmailTemplate(content: {
  title: string;
  greeting: string;
  body: string;
  actionText?: string;
  actionUrl?: string;
  footer: string;
}): { html: string; text: string } {
  const { title, greeting, body, actionText, actionUrl, footer } = content;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #333;">${title}</h2>
      <p>${greeting}</p>
      <p>${body}</p>
      ${
        actionUrl
          ? `
        <div style="margin: 30px 0;">
          <a href="${actionUrl}" style="background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">
            ${actionText}
          </a>
        </div>
        `
          : ''
      }
      <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;" />
      <p style="color: #666; font-size: 14px;">${footer}</p>
    </div>
  `;

  const text = `
${title}

${greeting}

${body}

${actionUrl ? `${actionText}: ${actionUrl}` : ''}

---
${footer}
  `.trim();

  return { html, text };
}

/**
 * Send project invitation email
 */
export async function sendProjectInvitation(params: SendProjectInvitationParams): Promise<void> {
  const { to, projectTitle, ownerName, invitationToken, permission, recipientLanguage } = params;
  const t = getTranslator(recipientLanguage);

  try {
    const invitationUrl = `${config.appUrl}/accept-invitation?token=${invitationToken}`;
    
    const { html, text } = generateEmailTemplate({
      title: t('email.projectInvitation.title'),
      greeting: t('email.projectInvitation.greeting'),
      body: t('email.projectInvitation.body', {
        ownerName,
        projectTitle,
        permission: t(`email.projectInvitation.permission.${permission}`),
      }),
      actionText: t('email.projectInvitation.action'),
      actionUrl: invitationUrl,
      footer: t('email.projectInvitation.footer'),
    });

    const mailOptions = {
      from: `"SpherosegV4" <${config.email.from}>`,
      to,
      subject: t('email.projectInvitation.subject', { projectTitle }),
      html,
      text,
    };

    await transporter.sendMail(mailOptions);
    logger.info('Project invitation email sent', { to, projectTitle });
  } catch (error) {
    logger.error('Failed to send project invitation email', { error, to });
    throw error;
  }
}

/**
 * Send invitation accepted notification
 */
export async function sendInvitationAcceptedNotification(
  params: SendInvitationAcceptedParams
): Promise<void> {
  const { to, projectTitle, acceptedByName, acceptedByEmail, ownerLanguage } = params;
  const t = getTranslator(ownerLanguage);

  try {
    const { html, text } = generateEmailTemplate({
      title: t('email.invitationAccepted.title'),
      greeting: t('email.invitationAccepted.greeting'),
      body: t('email.invitationAccepted.body', {
        acceptedByName,
        acceptedByEmail,
        projectTitle,
      }),
      footer: t('email.invitationAccepted.footer'),
    });

    const mailOptions = {
      from: `"SpherosegV4" <${config.email.from}>`,
      to,
      subject: t('email.invitationAccepted.subject', { projectTitle }),
      html,
      text,
    };

    await transporter.sendMail(mailOptions);
    logger.info('Invitation accepted notification sent', { to, projectTitle });
  } catch (error) {
    logger.error('Failed to send invitation accepted notification', { error, to });
    throw error;
  }
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(params: SendPasswordResetParams): Promise<void> {
  const { to, resetToken, userName, language } = params;
  const t = getTranslator(language);

  try {
    const resetUrl = `${config.appUrl}/reset-password?token=${resetToken}`;
    
    const { html, text } = generateEmailTemplate({
      title: t('email.passwordReset.title'),
      greeting: userName 
        ? t('email.passwordReset.greetingWithName', { name: userName })
        : t('email.passwordReset.greeting'),
      body: t('email.passwordReset.body'),
      actionText: t('email.passwordReset.action'),
      actionUrl: resetUrl,
      footer: t('email.passwordReset.footer'),
    });

    const mailOptions = {
      from: `"SpherosegV4" <${config.email.from}>`,
      to,
      subject: t('email.passwordReset.subject'),
      html,
      text,
    };

    await transporter.sendMail(mailOptions);
    logger.info('Password reset email sent', { to });
  } catch (error) {
    logger.error('Failed to send password reset email', { error, to });
    throw error;
  }
}

// Alias for backward compatibility
export const sendPasswordReset = sendPasswordResetEmail;

/**
 * Send new password email (deprecated - should use reset token instead)
 * This is used by the forgotPassword method that generates a new password
 * @deprecated Use sendPasswordResetEmail with reset token instead
 */
export async function sendNewPasswordEmail(
  email: string, 
  userName: string, 
  newPassword: string,
  language?: string
): Promise<{ testUrl?: string }> {
  const t = getTranslator(language);

  try {
    const { html, text } = generateEmailTemplate({
      title: t('email.newPassword.title', { defaultValue: 'Your New Password' }),
      greeting: userName 
        ? t('email.newPassword.greetingWithName', { name: userName, defaultValue: `Hello ${userName},` })
        : t('email.newPassword.greeting', { defaultValue: 'Hello,' }),
      body: t('email.newPassword.body', { 
        password: newPassword,
        defaultValue: `Your new password is: <strong>${newPassword}</strong><br><br>Please log in with this password and change it immediately for security reasons.`
      }),
      footer: t('email.newPassword.footer', { 
        defaultValue: 'For security reasons, please change this password after logging in.'
      }),
    });

    const mailOptions = {
      from: `"SpherosegV4" <${config.email.from}>`,
      to: email,
      subject: t('email.newPassword.subject', { defaultValue: 'Your New Password for SpherosegV4' }),
      html,
      text,
    };

    await transporter.sendMail(mailOptions);
    logger.info('New password email sent', { to: email });
    
    // Return test URL for development/testing
    const testUrl = process.env.NODE_ENV === 'development' 
      ? `http://localhost:3000/login?email=${encodeURIComponent(email)}` 
      : undefined;
    
    return { testUrl };
  } catch (error) {
    logger.error('Failed to send new password email', { error, to: email });
    throw error;
  }
}

// Alias for backward compatibility with authService
export { sendNewPasswordEmail as sendPasswordResetDirect };

/**
 * Send email verification
 */
export async function sendVerificationEmail(params: SendVerificationEmailParams): Promise<void> {
  const { to, verificationToken, userName, language } = params;
  const t = getTranslator(language);

  try {
    const verificationUrl = `${config.appUrl}/verify-email?token=${verificationToken}`;
    
    const { html, text } = generateEmailTemplate({
      title: t('email.verification.title'),
      greeting: userName 
        ? t('email.verification.greetingWithName', { name: userName })
        : t('email.verification.greeting'),
      body: t('email.verification.body'),
      actionText: t('email.verification.action'),
      actionUrl: verificationUrl,
      footer: t('email.verification.footer'),
    });

    const mailOptions = {
      from: `"SpherosegV4" <${config.email.from}>`,
      to,
      subject: t('email.verification.subject'),
      html,
      text,
    };

    await transporter.sendMail(mailOptions);
    logger.info('Verification email sent', { to });
  } catch (error) {
    logger.error('Failed to send verification email', { error, to });
    throw error;
  }
}

/**
 * Send access request notification
 */
export async function sendAccessRequest(params: SendAccessRequestParams): Promise<void> {
  const { to, requesterName, requesterEmail, message, language } = params;
  const t = getTranslator(language);

  try {
    const { html, text } = generateEmailTemplate({
      title: t('email.accessRequest.title'),
      greeting: t('email.accessRequest.greeting'),
      body: t('email.accessRequest.body', {
        requesterName,
        requesterEmail,
        message: message || t('email.accessRequest.noMessage'),
      }),
      footer: t('email.accessRequest.footer'),
    });

    const mailOptions = {
      from: `"SpherosegV4" <${config.email.from}>`,
      to,
      subject: t('email.accessRequest.subject'),
      html,
      text,
    };

    await transporter.sendMail(mailOptions);
    logger.info('Access request notification sent', { to, requesterEmail });
  } catch (error) {
    logger.error('Failed to send access request notification', { error, to });
    throw error;
  }
}

// Default export for services expecting it
export default {
  sendProjectInvitation,
  sendInvitationAcceptedNotification,
  sendPasswordReset,
  sendPasswordResetEmail,
  sendNewPasswordEmail,
  sendVerificationEmail,
  sendAccessRequest,
};