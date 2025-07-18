import { createLogger } from '../utils/logger';
import i18next from '../config/i18n';

const logger = createLogger('emailServicei18n');

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

/**
 * Get translation function for a specific language
 */
function getTranslator(language?: string) {
  return i18next.getFixedT(language || 'en');
}

/**
 * Generate email HTML template with i18n support
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
          <a href="${actionUrl}" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
            ${actionText || 'Click here'}
          </a>
        </div>
        <p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
        <p style="color: #666; font-size: 14px; word-break: break-all;">${actionUrl}</p>
      `
          : ''
      }
      <hr style="margin: 30px 0; border: 0; border-top: 1px solid #eee;">
      <p style="color: #666; font-size: 14px;">${footer}</p>
    </div>
  `;

  const text = `
${title}

${greeting}

${body}

${actionUrl ? `${actionText || 'Click here'}: ${actionUrl}` : ''}

${footer}
  `.trim();

  return { html, text };
}

/**
 * Sends a project invitation email with i18n support
 */
export async function sendProjectInvitation(params: SendProjectInvitationParams): Promise<void> {
  const { to, projectTitle, ownerName, invitationToken, permission, recipientLanguage } = params;
  const t = getTranslator(recipientLanguage);

  try {
    const invitationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/invitation/${invitationToken}`;

    const { html, text } = generateEmailTemplate({
      title: t('email.invitationSubject', { projectName: projectTitle }),
      greeting: t('common.hello', { name: to.split('@')[0] }),
      body: t('email.invitationBody', {
        ownerName,
        projectName: projectTitle,
        permission: t(`project.permissions.${permission}`),
      }),
      actionText: t('email.invitationAction'),
      actionUrl: invitationUrl,
      footer: t('email.invitationExpires'),
    });

    const emailContent = {
      to,
      subject: t('email.invitationSubject', { projectName: projectTitle }),
      html,
      text,
    };

    // Log email sending attempt
    logger.info('Sending project invitation email', {
      to: emailContent.to,
      subject: emailContent.subject,
      invitationUrl,
      language: recipientLanguage || 'en',
    });

    // In development, log to console
    if (process.env.NODE_ENV === 'development') {
      console.log('📧 Email Service (Development Mode)');
      console.log('================================');
      console.log('To:', emailContent.to);
      console.log('Subject:', emailContent.subject);
      console.log('Language:', recipientLanguage || 'en');
      console.log('Invitation URL:', invitationUrl);
      console.log('================================');
    }

    // TODO: Integrate with actual email service provider
    // await sendgrid.send(emailContent);
  } catch (error) {
    logger.error('Failed to send project invitation email', { error, to });
    throw error;
  }
}

/**
 * Sends notification when invitation is accepted
 */
export async function sendInvitationAcceptedNotification(
  params: SendInvitationAcceptedParams
): Promise<void> {
  const { to, projectTitle, acceptedByName, acceptedByEmail, ownerLanguage } = params;
  const t = getTranslator(ownerLanguage);

  try {
    const { html, text } = generateEmailTemplate({
      title: t('email.invitationAcceptedSubject', { userName: acceptedByName }),
      greeting: t('common.hello'),
      body: t('email.invitationAcceptedBody', {
        userName: acceptedByName,
        userEmail: acceptedByEmail,
        projectName: projectTitle,
      }),
      footer: t('email.footer'),
    });

    const emailContent = {
      to,
      subject: t('email.invitationAcceptedSubject', { userName: acceptedByName }),
      html,
      text,
    };

    logger.info('Sending invitation accepted notification', {
      to: emailContent.to,
      subject: emailContent.subject,
      language: ownerLanguage || 'en',
    });

    // In development, log to console
    if (process.env.NODE_ENV === 'development') {
      console.log('📧 Email Service (Development Mode)');
      console.log('================================');
      console.log('To:', emailContent.to);
      console.log('Subject:', emailContent.subject);
      console.log('Language:', ownerLanguage || 'en');
      console.log('================================');
    }

    // TODO: Integrate with actual email service provider
  } catch (error) {
    logger.error('Failed to send invitation accepted notification', { error, to });
    throw error;
  }
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(params: {
  to: string;
  resetToken: string;
  language?: string;
}): Promise<void> {
  const { to, resetToken, language } = params;
  const t = getTranslator(language);

  try {
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password/${resetToken}`;

    const { html, text } = generateEmailTemplate({
      title: t('email.passwordResetSubject'),
      greeting: t('common.hello'),
      body: t('email.passwordResetBody'),
      actionText: t('email.passwordResetAction'),
      actionUrl: resetUrl,
      footer: t('email.passwordResetExpires'),
    });

    const emailContent = {
      to,
      subject: t('email.passwordResetSubject'),
      html,
      text,
    };

    logger.info('Sending password reset email', {
      to: emailContent.to,
      subject: emailContent.subject,
      language: language || 'en',
    });

    // TODO: Send actual email
  } catch (error) {
    logger.error('Failed to send password reset email', { error, to });
    throw error;
  }
}

// Re-export the original functions for backward compatibility
export { sendProjectInvitation as sendProjectInvitationLegacy } from './emailService';
