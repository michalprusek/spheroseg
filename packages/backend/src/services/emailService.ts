import { createLogger } from '../utils/logger';

const logger = createLogger('emailService');

interface SendProjectInvitationParams {
  to: string;
  projectTitle: string;
  ownerName: string;
  invitationToken: string;
  permission: 'view' | 'edit';
}

/**
 * Sends a project invitation email to the specified recipient
 * Note: This is a placeholder implementation. In production, you would integrate
 * with an email service provider like SendGrid, AWS SES, or similar.
 */
export async function sendProjectInvitation(params: SendProjectInvitationParams): Promise<void> {
  const { to, projectTitle, ownerName, invitationToken, permission } = params;

  try {
    // In production, replace this with actual email service integration
    const invitationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/accept-invitation/${invitationToken}`;
    
    const emailContent = {
      to,
      subject: `You've been invited to collaborate on "${projectTitle}"`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Project Invitation</h2>
          <p>Hi,</p>
          <p>${ownerName} has invited you to collaborate on the project "<strong>${projectTitle}</strong>" with ${permission} permissions.</p>
          <p>Click the link below to accept the invitation:</p>
          <p><a href="${invitationUrl}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Accept Invitation</a></p>
          <p>Or copy and paste this link into your browser:</p>
          <p>${invitationUrl}</p>
          <p>This invitation will expire in 48 hours.</p>
          <p>Best regards,<br>The SpherosegV4 Team</p>
        </div>
      `,
      text: `
        Project Invitation
        
        Hi,
        
        ${ownerName} has invited you to collaborate on the project "${projectTitle}" with ${permission} permissions.
        
        Click the link below to accept the invitation:
        ${invitationUrl}
        
        This invitation will expire in 48 hours.
        
        Best regards,
        The SpherosegV4 Team
      `
    };

    // Log email sending attempt (in production, actually send the email here)
    logger.info('Email would be sent:', {
      to: emailContent.to,
      subject: emailContent.subject,
      invitationUrl
    });

    // In development, you can log the email content to console
    if (process.env.NODE_ENV === 'development') {
      console.log('📧 Email Service (Development Mode)');
      console.log('================================');
      console.log('To:', emailContent.to);
      console.log('Subject:', emailContent.subject);
      console.log('Invitation URL:', invitationUrl);
      console.log('================================');
    }

    // TODO: Integrate with actual email service provider
    // Example with SendGrid:
    // const msg = {
    //   to: emailContent.to,
    //   from: 'noreply@spheroseg.com',
    //   subject: emailContent.subject,
    //   text: emailContent.text,
    //   html: emailContent.html,
    // };
    // await sgMail.send(msg);

  } catch (error) {
    logger.error('Failed to send project invitation email', {
      error,
      to,
      projectTitle,
      invitationToken
    });
    // Don't throw the error - we don't want to fail the share operation if email fails
    // The user can still share the invitation link manually
  }
}

/**
 * Sends a notification email when someone accepts a project invitation
 * @param ownerEmail - Email of the project owner
 * @param acceptorName - Name of the person who accepted the invitation
 * @param projectTitle - Title of the project
 */
export async function sendInvitationAcceptedNotification(
  ownerEmail: string,
  acceptorName: string,
  projectTitle: string
): Promise<void> {
  try {
    const emailContent = {
      to: ownerEmail,
      subject: `${acceptorName} accepted your invitation to "${projectTitle}"`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Invitation Accepted</h2>
          <p>Good news!</p>
          <p><strong>${acceptorName}</strong> has accepted your invitation to collaborate on "<strong>${projectTitle}</strong>".</p>
          <p>They now have access to the project based on the permissions you granted.</p>
          <p>Best regards,<br>The SpherosegV4 Team</p>
        </div>
      `,
      text: `
        Invitation Accepted
        
        Good news!
        
        ${acceptorName} has accepted your invitation to collaborate on "${projectTitle}".
        
        They now have access to the project based on the permissions you granted.
        
        Best regards,
        The SpherosegV4 Team
      `
    };

    logger.info('Acceptance notification would be sent:', {
      to: emailContent.to,
      subject: emailContent.subject
    });

    // TODO: Send actual email in production
  } catch (error) {
    logger.error('Failed to send invitation acceptance notification', {
      error,
      ownerEmail,
      acceptorName,
      projectTitle
    });
  }
}