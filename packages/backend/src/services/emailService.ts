import nodemailer from 'nodemailer';
import { createLogger } from '@/utils/logger';

const logger = createLogger('emailService');

// Načtení konfigurace z proměnných prostředí
const EMAIL_HOST = process.env.EMAIL_HOST || 'smtp.ethereal.email';
const EMAIL_PORT = parseInt(process.env.EMAIL_PORT || '587', 10);
const EMAIL_USER = process.env.EMAIL_USER || '';
const EMAIL_PASS = process.env.EMAIL_PASS || '';
const EMAIL_FROM = process.env.EMAIL_FROM || 'spheroseg@example.com';
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

// Konfigurace pro vývojové prostředí, pokud nejsou k dispozici reálné SMTP údaje
let testAccount: nodemailer.TestAccount | undefined;

/**
 * Vytvoří transportér pro odesílání emailů
 */
async function createTransporter() {
  // Pokud nejsou zadány SMTP údaje, vytvoříme testovací účet
  if (!EMAIL_USER || !EMAIL_PASS) {
    if (!testAccount) {
      try {
        logger.info('Creating Ethereal test account for email testing');
        testAccount = await nodemailer.createTestAccount();
        logger.info(`Test account created: ${testAccount.user}`);
      } catch (error) {
        logger.error('Failed to create test email account', { error });
        throw new Error('Failed to create email transporter');
      }
    }

    return nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
  }

  // Použití reálných SMTP údajů
  return nodemailer.createTransport({
    host: EMAIL_HOST,
    port: EMAIL_PORT,
    secure: EMAIL_PORT === 465, // true pro port 465, false pro ostatní porty
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS,
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

    const result = await transporter.sendMail({
      from: EMAIL_FROM,
      to,
      subject,
      text,
      html: html || text,
    });

    // Pokud používáme testovací účet, vypíšeme URL pro zobrazení emailu
    if (testAccount) {
      logger.info(`Email sent: ${nodemailer.getTestMessageUrl(result)}`);
    } else {
      logger.info(`Email sent to ${to}: ${result.messageId}`);
    }

    return result;
  } catch (error) {
    logger.error('Failed to send email', { error, to, subject });
    throw new Error(`Failed to send email: ${(error as Error).message}`);
  }
}

/**
 * Odešle pozvánku ke sdílení projektu
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
  // Vytvoříme odkaz pro přijetí pozvánky
  const invitationLink = `${APP_URL}/project/invitation/${invitationToken}`;

  const subject = `Pozvánka ke spolupráci na projektu "${projectTitle}"`;

  const text = `
Dobrý den,

uživatel ${ownerName} vás pozval ke spolupráci na projektu "${projectTitle}" na platformě SpheroSeg.

Typ přístupu: ${permission === 'view' ? 'Zobrazení' : 'Úpravy'}

Pro přijetí pozvánky klikněte na následující odkaz:
${invitationLink}

Pokud nemáte účet, budete moci vytvořit nový po kliknutí na odkaz.

S pozdravem,
Tým SpheroSeg
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
      <h2>Pozvánka ke spolupráci</h2>
    </div>
    <div class="content">
      <p>Dobrý den,</p>
      <p>uživatel <strong>${ownerName}</strong> vás pozval ke spolupráci na projektu <strong>"${projectTitle}"</strong> na platformě SpheroSeg.</p>

      <p>Typ přístupu: <strong>${permission === 'view' ? 'Zobrazení' : 'Úpravy'}</strong></p>

      <p>Pro přijetí pozvánky klikněte na následující tlačítko:</p>
      <a href="${invitationLink}" class="button">Přijmout pozvánku</a>

      <p>Pokud nemáte účet, budete moci vytvořit nový po kliknutí na odkaz.</p>

      <p>S pozdravem,<br>Tým SpheroSeg</p>
    </div>
    <div class="footer">
      <p>Toto je automaticky generovaný email. Neodpovídejte na něj.</p>
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
 * Odešle email s žádostí o přístup
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
  const subject = `SpheroSeg - Nová žádost o přístup od ${name}`;

  const text = `
Nová žádost o přístup do aplikace SpheroSeg:

Jméno: ${name}
Email: ${email}
Organizace: ${organization || 'Neuvedeno'}
Důvod: ${reason}

Datum žádosti: ${new Date().toLocaleString('cs-CZ')}
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
    .footer { margin-top: 20px; font-size: 12px; color: #666; }
    .field { margin-bottom: 15px; }
    .field-name { font-weight: bold; }
    .field-value { margin-top: 5px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>Nová žádost o přístup do aplikace SpheroSeg</h2>
    </div>
    <div class="content">
      <div class="field">
        <div class="field-name">Jméno:</div>
        <div class="field-value">${name}</div>
      </div>
      <div class="field">
        <div class="field-name">Email:</div>
        <div class="field-value">${email}</div>
      </div>
      <div class="field">
        <div class="field-name">Organizace:</div>
        <div class="field-value">${organization || 'Neuvedeno'}</div>
      </div>
      <div class="field">
        <div class="field-name">Důvod:</div>
        <div class="field-value">${reason}</div>
      </div>
      <div class="field">
        <div class="field-name">Datum žádosti:</div>
        <div class="field-value">${new Date().toLocaleString('cs-CZ')}</div>
      </div>
    </div>
    <div class="footer">
      <p>Toto je automaticky generovaný email. Pro odpověď použijte email žadatele.</p>
    </div>
  </div>
</body>
</html>
`;

  return sendEmail({
    to: 'prusemic@cvut.cz',
    subject,
    text,
    html,
  });
}

export default {
  sendEmail,
  sendProjectInvitation,
  sendAccessRequest,
};
