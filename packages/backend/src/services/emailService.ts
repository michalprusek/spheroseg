import nodemailer from 'nodemailer';
import { createLogger } from '../utils/logger';

const logger = createLogger('emailService');

// Načtení konfigurace z proměnných prostředí
const EMAIL_HOST = process.env.EMAIL_HOST || 'mail.utia.cas.cz';
const EMAIL_PORT = parseInt(process.env.EMAIL_PORT || '25', 10);
const EMAIL_USER = process.env.EMAIL_USER || '';
const EMAIL_PASS = process.env.EMAIL_PASS || '';
const EMAIL_FROM = process.env.EMAIL_FROM || 'spheroseg@utia.cas.cz';
const APP_URL = process.env.APP_URL || 'https://spherosegapp.utia.cas.cz';

// Vždy používáme mail.utia.cas.cz

/**
 * Vytvoří transportér pro odesílání emailů
 */
async function createTransporter() {
  logger.info('Creating email transporter', {
    EMAIL_HOST,
    EMAIL_PORT,
    EMAIL_FROM,
    hasAuth: !!(EMAIL_USER && EMAIL_PASS),
  });

  // Pokud je nastaven EMAIL_HOST, použijeme ho (bez ohledu na přihlašovací údaje)
  if (EMAIL_HOST && EMAIL_HOST !== 'smtp.ethereal.email') {
    logger.info(`Using SMTP server: ${EMAIL_HOST}:${EMAIL_PORT}`);

    const transportConfig: any = {
      host: EMAIL_HOST,
      port: EMAIL_PORT,
      secure: false, // Port 25 používá STARTTLS, ne přímé SSL
      opportunisticTLS: true, // Použít TLS pokud server nabízí STARTTLS
      connectionTimeout: 10000,
      greetingTimeout: 5000,
      socketTimeout: 10000,
      tls: {
        rejectUnauthorized: false, // Povolení self-signed certifikátů
        servername: EMAIL_HOST, // Explicitně nastavit server name pro TLS
      },
    };

    // Přidáme autentizaci pouze pokud jsou zadány přihlašovací údaje
    if (EMAIL_USER && EMAIL_PASS) {
      transportConfig.auth = {
        user: EMAIL_USER,
        pass: EMAIL_PASS,
      };
      logger.info('Using SMTP authentication');
    } else {
      logger.info('Using SMTP without authentication');
    }

    return nodemailer.createTransport(transportConfig);
  }

  // Vždy použít výchozí SMTP server

  // Vždy použít mail.utia.cas.cz místo Ethereal
  logger.info('Using fallback SMTP configuration for mail.utia.cas.cz');
  return nodemailer.createTransport({
    host: 'mail.utia.cas.cz',
    port: 25,
    secure: false,
    opportunisticTLS: true,
    connectionTimeout: 10000,
    greetingTimeout: 5000,
    socketTimeout: 10000,
    tls: {
      rejectUnauthorized: false,
      servername: 'mail.utia.cas.cz',
    },
  });
}

/**
 * Odešle email
 */
export async function sendEmail({
  to,
  subject,
  text,
  html,
}: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}) {
  try {
    const transporter = await createTransporter();

    // Přidáme timeout pro odeslání emailu
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Email send timeout')), 15000);
    });

    const result = (await Promise.race([
      transporter.sendMail({
        from: EMAIL_FROM,
        to,
        subject,
        text,
        html: html || text,
      }),
      timeoutPromise,
    ])) as any;

    logger.info(`Email sent to ${to}: ${result.messageId}`);

    return result;
  } catch (error) {
    logger.error('Failed to send email', {
      error:
        error instanceof Error
          ? {
              message: error.message,
              code: (error as any).code,
              command: (error as any).command,
              response: (error as any).response,
              responseCode: (error as any).responseCode,
              stack: error.stack,
            }
          : error,
      to,
      subject,
    });
    throw new Error(`Failed to send email: ${(error as Error).message}`);
  }
}

/**
 * Sends project invitation email
 */
export async function sendProjectInvitation({
  to,
  projectTitle,
  ownerName,
  invitationToken,
  permission,
}: {
  to: string;
  projectTitle: string;
  ownerName: string;
  invitationToken: string;
  permission: string;
}) {
  // Create invitation link
  const invitationLink = `${APP_URL}/project/invitation/${invitationToken}`;

  const subject = `Invitation to collaborate on project "${projectTitle}"`;

  const text = `
Hello,

${ownerName} has invited you to collaborate on the project "${projectTitle}" on the SpheroSeg platform.

Access level: ${permission === 'view' ? 'View only' : 'Edit'}

To accept the invitation, please click the following link:
${invitationLink}

If you don't have an account, you'll be able to create one after clicking the link.

Best regards,
SpheroSeg Team
  `;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #4a76a8; color: white; padding: 15px; border-radius: 5px 5px 0 0; }
    .content { padding: 20px; border: 1px solid #ddd; border-radius: 0 0 5px 5px; }
    .button { display: inline-block; background-color: #4a76a8; color: white; padding: 10px 20px;
      text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .footer { margin-top: 20px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>Project Collaboration Invitation</h2>
    </div>
    <div class="content">
      <p>Hello,</p>
      <p><strong>${ownerName}</strong> has invited you to collaborate on the project <strong>"${projectTitle}"</strong> on the SpheroSeg platform.</p>

      <p>Access level: <strong>${permission === 'view' ? 'View only' : 'Edit'}</strong></p>

      <p>To accept the invitation, please click the following button:</p>
      <a href="${invitationLink}" class="button">Accept Invitation</a>

      <p>If you don't have an account, you'll be able to create one after clicking the link.</p>

      <p>Best regards,<br>SpheroSeg Team</p>
    </div>
    <div class="footer">
      <p>This is an automated email. Please do not reply.</p>
    </div>
  </div>
</body>
</html>
  `;

  return sendEmail({
    to,
    subject,
    text,
    html,
  });
}

/**
 * Sends access request notification email
 */
export async function sendAccessRequest({
  email,
  name,
  organization,
  reason,
}: {
  email: string;
  name: string;
  organization: string | null;
  reason: string;
}) {
  const subject = `SpheroSeg - New Access Request from ${name}`;

  const text = `New Access Request

Name: ${name}
Email: ${email}
Organization: ${organization || 'Not specified'}
Reason: ${reason}

Request Date: ${new Date().toLocaleString('en-US')}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #4a76a8; color: white; padding: 15px; border-radius: 5px 5px 0 0; }
    .content { padding: 20px; border: 1px solid #ddd; border-radius: 0 0 5px 5px; }
    .footer { margin-top: 20px; font-size: 12px; color: #666; }
    .field { margin-bottom: 15px; }
    .field-name { font-weight: bold; }
    .field-value { margin-top: 5px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>New Access Request for SpheroSeg</h2>
    </div>
    <div class="content">
      <div class="field">
        <div class="field-name">Name:</div>
        <div class="field-value">${name}</div>
      </div>
      <div class="field">
        <div class="field-name">Email:</div>
        <div class="field-value">${email}</div>
      </div>
      <div class="field">
        <div class="field-name">Organization:</div>
        <div class="field-value">${organization || 'Not specified'}</div>
      </div>
      <div class="field">
        <div class="field-name">Reason:</div>
        <div class="field-value">${reason}</div>
      </div>
      <div class="field">
        <div class="field-name">Request Date:</div>
        <div class="field-value">${new Date().toLocaleString('en-US')}</div>
      </div>
    </div>
    <div class="footer">
      <p>This is an automated email. To reply, please use the applicant's email address.</p>
    </div>
  </div>
</body>
</html>
`;

  return sendEmail({
    to: 'spheroseg@utia.cas.cz',
    subject,
    text,
    html,
  });
}

/**
 * Sends a password reset email with a new generated password
 */
export async function sendPasswordReset(
  email: string,
  name: string,
  newPassword: string
): Promise<{ success: boolean; testUrl?: string }> {
  const subject = 'SpheroSeg - Password Reset';

  const text = `Password Reset

Hello,

Your new password is: ${newPassword}

Please change it after logging in.

Best regards,
SpheroSeg Team`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Reset - SpheroSeg</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: white; padding: 40px; border: 1px solid #e0e0e0; border-top: none; }
    .password-box { background: #f8f9fa; border: 2px solid #007bff; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center; }
    .password { font-family: 'Courier New', monospace; font-size: 18px; font-weight: bold; color: #007bff; letter-spacing: 2px; }
    .warning { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 4px; padding: 15px; margin: 20px 0; color: #856404; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; border-radius: 0 0 8px 8px; }
    .button { display: inline-block; background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 10px 0; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🔐 Password Reset</h1>
    <p>Your new password for SpheroSeg</p>
  </div>
  
  <div class="content">
    <p>Hello,</p>
    
    <p>Your new password is:</p>
    
    <div class="password-box">
      <div class="password">${newPassword}</div>
    </div>
    
    <p>Please change it after logging in.</p>
    
    <a href="${APP_URL}/sign-in" class="button">Log In to SpheroSeg</a>
    
    <hr style="margin: 30px 0; border: none; border-top: 1px solid #e0e0e0;">
    
    <p>Best regards,<br>
    SpheroSeg Team</p>
  </div>
  
  <div class="footer">
    <p>This email was sent by SpheroSeg Platform</p>
    <p>© 2025 SpheroSeg. All rights reserved.</p>
  </div>
</body>
</html>
`;

  const result = await sendEmail({
    to: email,
    subject,
    text,
    html,
  });

  return {
    success: true,
    testUrl: undefined,
  };
}

/**
 * Sends email verification link
 */
export async function sendVerificationEmail(email: string, verificationUrl: string): Promise<void> {
  const subject = 'SpheroSeg - Email Verification';

  const text = `
Hello,

Thank you for registering with SpheroSeg.

To complete your registration, please verify your email address by clicking the following link:
${verificationUrl}

This link is valid for 24 hours.

If you did not register with SpheroSeg, you can safely ignore this email.

Best regards,
SpheroSeg Team
`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #4a76a8; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
    .content { padding: 30px; border: 1px solid #ddd; border-radius: 0 0 5px 5px; background-color: #ffffff; }
    .button { display: inline-block; background-color: #4a76a8; color: white; padding: 14px 28px;
      text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
    .button:hover { background-color: #3a5f91; }
    .footer { margin-top: 30px; font-size: 12px; color: #666; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>Email Verification</h2>
    </div>
    <div class="content">
      <p>Hello,</p>
      <p>Thank you for registering with <strong>SpheroSeg</strong>.</p>
      
      <p>To complete your registration, please verify your email address by clicking the following button:</p>
      
      <div style="text-align: center;">
        <a href="${verificationUrl}" class="button">Verify Email Address</a>
      </div>
      
      <p style="font-size: 14px; color: #666;">Or copy and paste the following link into your browser:<br>
      <span style="word-break: break-all;">${verificationUrl}</span></p>
      
      <p><strong>This link is valid for 24 hours.</strong></p>
      
      <p>If you did not register with SpheroSeg, you can safely ignore this email.</p>
      
      <p>Best regards,<br>SpheroSeg Team</p>
    </div>
    <div class="footer">
      <p>This is an automated email. Please do not reply.</p>
      <p>© 2025 SpheroSeg. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`;

  await sendEmail({
    to: email,
    subject,
    text,
    html,
  });
}

export default {
  sendEmail,
  sendProjectInvitation,
  sendAccessRequest,
  sendPasswordReset,
  sendVerificationEmail,
};
