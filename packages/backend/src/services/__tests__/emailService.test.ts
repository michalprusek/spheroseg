/**
 * Email Service Test Suite
 * 
 * This suite tests the critical email functionality including
 * project invitations, password resets, verification emails,
 * internationalization support, template generation, and error handling.
 */

import {
  sendProjectInvitation,
  sendInvitationAcceptedNotification,
  sendPasswordResetEmail,
  sendNewPasswordEmail,
  sendVerificationEmail,
  sendAccessRequest,
  default as emailService,
} from '../emailService';
import nodemailer from 'nodemailer';
import i18next from '../../config/i18n';

// Mock dependencies
jest.mock('nodemailer');
jest.mock('../../config/i18n');
jest.mock('../../utils/logger');
jest.mock('../../config');

// Mock logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

jest.mock('../../utils/logger', () => ({
  createLogger: () => mockLogger,
}));

// Mock config
const mockConfig = {
  email: {
    host: 'smtp.example.com',
    port: 587,
    secure: false,
    user: 'test@example.com',
    pass: 'password',
    from: 'noreply@spheroseg.com',
  },
  app: {
    frontendUrl: 'https://app.spheroseg.com',
  },
};

jest.mock('../../config', () => ({
  default: mockConfig,
}));

// Mock nodemailer transporter
const mockTransporter = {
  sendMail: jest.fn(),
  verify: jest.fn(),
};

const mockNodemailer = nodemailer as jest.Mocked<typeof nodemailer>;
mockNodemailer.createTransporter = jest.fn().mockReturnValue(mockTransporter);

// Mock i18next
const mockI18next = i18next as jest.Mocked<typeof i18next>;
const mockTranslator = jest.fn();
mockI18next.getFixedT = jest.fn().mockReturnValue(mockTranslator);

describe('Email Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default successful transporter verification
    mockTransporter.verify.mockImplementation((callback) => {
      callback(null);
    });
    
    // Default successful email sending
    mockTransporter.sendMail.mockResolvedValue({
      messageId: 'test-message-id',
    });

    // Default translation behavior
    mockTranslator.mockImplementation((key: string, options?: any) => {
      // Simple mock translations
      const translations: Record<string, any> = {
        'email.projectInvitation.title': 'Project Invitation',
        'email.projectInvitation.greeting': 'Hello!',
        'email.projectInvitation.body': `${options?.ownerName} has invited you to join "${options?.projectTitle}" with ${options?.permission} permissions.`,
        'email.projectInvitation.action': 'Accept Invitation',
        'email.projectInvitation.footer': 'Best regards, SpherosegV4 Team',
        'email.projectInvitation.subject': `Invitation to "${options?.projectTitle}"`,
        'email.projectInvitation.permission.view': 'view',
        'email.projectInvitation.permission.edit': 'edit',
        
        'email.invitationAccepted.title': 'Invitation Accepted',
        'email.invitationAccepted.greeting': 'Good news!',
        'email.invitationAccepted.body': `${options?.acceptedByName} (${options?.acceptedByEmail}) has accepted your invitation to "${options?.projectTitle}".`,
        'email.invitationAccepted.footer': 'Best regards, SpherosegV4 Team',
        'email.invitationAccepted.subject': `${options?.acceptedByName} accepted your invitation`,
        
        'email.passwordReset.title': 'Password Reset',
        'email.passwordReset.greeting': 'Hello!',
        'email.passwordReset.greetingWithName': `Hello ${options?.name}!`,
        'email.passwordReset.body': 'You requested a password reset. Click the button below to reset your password.',
        'email.passwordReset.action': 'Reset Password',
        'email.passwordReset.footer': 'If you did not request this, please ignore this email.',
        'email.passwordReset.subject': 'Password Reset Request',
        
        'email.verification.title': 'Email Verification',
        'email.verification.greeting': 'Welcome!',
        'email.verification.greetingWithName': `Welcome ${options?.name}!`,
        'email.verification.body': 'Please verify your email address to complete registration.',
        'email.verification.action': 'Verify Email',
        'email.verification.footer': 'Best regards, SpherosegV4 Team',
        'email.verification.subject': 'Verify Your Email',
        
        'email.accessRequest.title': 'Access Request',
        'email.accessRequest.greeting': 'Hello!',
        'email.accessRequest.body': `${options?.requesterName} (${options?.requesterEmail}) has requested access. Message: ${options?.message}`,
        'email.accessRequest.footer': 'Best regards, SpherosegV4 Team',
        'email.accessRequest.subject': 'Access Request',
        'email.accessRequest.noMessage': 'No message provided',
        
        'email.newPassword.title': options?.defaultValue || 'Your New Password',
        'email.newPassword.greeting': options?.defaultValue || 'Hello,',
        'email.newPassword.greetingWithName': options?.defaultValue || `Hello ${options?.name},`,
        'email.newPassword.body': options?.defaultValue || `Your new password is: <strong>${options?.password}</strong>`,
        'email.newPassword.footer': options?.defaultValue || 'Please change this password after logging in.',
        'email.newPassword.subject': options?.defaultValue || 'Your New Password for SpherosegV4',
      };
      
      return translations[key] || key;
    });
  });

  describe('Transporter Configuration', () => {
    it('should create transporter with correct configuration', () => {
      expect(mockNodemailer.createTransporter).toHaveBeenCalledWith({
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        auth: {
          user: 'test@example.com',
          pass: 'password',
        },
      });
    });

    it('should verify transporter on startup', () => {
      expect(mockTransporter.verify).toHaveBeenCalled();
    });

    it('should log successful verification', () => {
      expect(mockLogger.info).toHaveBeenCalledWith('Email transporter is ready');
    });

    it('should handle verification errors', () => {
      const error = new Error('SMTP connection failed');
      mockTransporter.verify.mockImplementation((callback) => {
        callback(error);
      });

      // Re-require the module to trigger verification
      jest.resetModules();
      require('../emailService');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Email transporter verification failed:',
        error
      );
    });
  });

  describe('Project Invitation Email', () => {
    const mockParams = {
      to: 'user@example.com',
      projectTitle: 'Test Project',
      ownerName: 'John Doe',
      invitationToken: 'abc123',
      permission: 'edit' as const,
      recipientLanguage: 'en',
    };

    it('should send project invitation email successfully', async () => {
      await sendProjectInvitation(mockParams);

      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: '"SpherosegV4" <noreply@spheroseg.com>',
        to: 'user@example.com',
        subject: 'Invitation to "Test Project"',
        html: expect.stringContaining('Project Invitation'),
        text: expect.stringContaining('Project Invitation'),
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Project invitation email sent',
        { to: 'user@example.com', projectTitle: 'Test Project' }
      );
    });

    it('should generate correct invitation URL', async () => {
      await sendProjectInvitation(mockParams);

      const sentEmail = mockTransporter.sendMail.mock.calls[0][0];
      expect(sentEmail.html).toContain(
        'https://app.spheroseg.com/accept-invitation?token=abc123'
      );
      expect(sentEmail.text).toContain(
        'https://app.spheroseg.com/accept-invitation?token=abc123'
      );
    });

    it('should use correct language for translations', async () => {
      await sendProjectInvitation(mockParams);

      expect(mockI18next.getFixedT).toHaveBeenCalledWith('en');
    });

    it('should handle view permissions correctly', async () => {
      await sendProjectInvitation({
        ...mockParams,
        permission: 'view',
      });

      expect(mockTranslator).toHaveBeenCalledWith(
        'email.projectInvitation.permission.view'
      );
    });

    it('should handle send failures gracefully', async () => {
      const error = new Error('SMTP send failed');
      mockTransporter.sendMail.mockRejectedValue(error);

      await expect(sendProjectInvitation(mockParams)).rejects.toThrow(error);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to send project invitation email',
        { error, to: 'user@example.com' }
      );
    });

    it('should default to English when no language specified', async () => {
      await sendProjectInvitation({
        ...mockParams,
        recipientLanguage: undefined,
      });

      expect(mockI18next.getFixedT).toHaveBeenCalledWith('en');
    });
  });

  describe('Invitation Accepted Notification', () => {
    const mockParams = {
      to: 'owner@example.com',
      projectTitle: 'Test Project',
      acceptedByName: 'Jane Smith',
      acceptedByEmail: 'jane@example.com',
      ownerLanguage: 'en',
    };

    it('should send invitation accepted notification successfully', async () => {
      await sendInvitationAcceptedNotification(mockParams);

      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: '"SpherosegV4" <noreply@spheroseg.com>',
        to: 'owner@example.com',
        subject: 'Jane Smith accepted your invitation',
        html: expect.stringContaining('Invitation Accepted'),
        text: expect.stringContaining('Invitation Accepted'),
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Invitation accepted notification sent',
        { to: 'owner@example.com', projectTitle: 'Test Project' }
      );
    });

    it('should include accepter details in email body', async () => {
      await sendInvitationAcceptedNotification(mockParams);

      const sentEmail = mockTransporter.sendMail.mock.calls[0][0];
      expect(sentEmail.html).toContain('Jane Smith');
      expect(sentEmail.html).toContain('jane@example.com');
      expect(sentEmail.html).toContain('Test Project');
    });

    it('should handle send failures gracefully', async () => {
      const error = new Error('SMTP send failed');
      mockTransporter.sendMail.mockRejectedValue(error);

      await expect(sendInvitationAcceptedNotification(mockParams)).rejects.toThrow(error);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to send invitation accepted notification',
        { error, to: 'owner@example.com' }
      );
    });
  });

  describe('Password Reset Email', () => {
    const mockParams = {
      to: 'user@example.com',
      resetToken: 'reset123',
      userName: 'John Doe',
      language: 'en',
    };

    it('should send password reset email successfully', async () => {
      await sendPasswordResetEmail(mockParams);

      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: '"SpherosegV4" <noreply@spheroseg.com>',
        to: 'user@example.com',
        subject: 'Password Reset Request',
        html: expect.stringContaining('Password Reset'),
        text: expect.stringContaining('Password Reset'),
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Password reset email sent',
        { to: 'user@example.com' }
      );
    });

    it('should generate correct reset URL', async () => {
      await sendPasswordResetEmail(mockParams);

      const sentEmail = mockTransporter.sendMail.mock.calls[0][0];
      expect(sentEmail.html).toContain(
        'https://app.spheroseg.com/reset-password?token=reset123'
      );
      expect(sentEmail.text).toContain(
        'https://app.spheroseg.com/reset-password?token=reset123'
      );
    });

    it('should use personalized greeting when userName provided', async () => {
      await sendPasswordResetEmail(mockParams);

      expect(mockTranslator).toHaveBeenCalledWith(
        'email.passwordReset.greetingWithName',
        { name: 'John Doe' }
      );
    });

    it('should use generic greeting when userName not provided', async () => {
      await sendPasswordResetEmail({
        ...mockParams,
        userName: undefined,
      });

      expect(mockTranslator).toHaveBeenCalledWith('email.passwordReset.greeting');
    });

    it('should handle send failures gracefully', async () => {
      const error = new Error('SMTP send failed');
      mockTransporter.sendMail.mockRejectedValue(error);

      await expect(sendPasswordResetEmail(mockParams)).rejects.toThrow(error);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to send password reset email',
        { error, to: 'user@example.com' }
      );
    });
  });

  describe('New Password Email (Deprecated)', () => {
    it('should send new password email successfully', async () => {
      const result = await sendNewPasswordEmail(
        'user@example.com',
        'John Doe',
        'newpassword123',
        'en'
      );

      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: '"SpherosegV4" <noreply@spheroseg.com>',
        to: 'user@example.com',
        subject: 'Your New Password for SpherosegV4',
        html: expect.stringContaining('<strong>newpassword123</strong>'),
        text: expect.stringContaining('newpassword123'),
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'New password email sent',
        { to: 'user@example.com' }
      );

      expect(result.testUrl).toBeUndefined(); // Not in development mode
    });

    it('should return test URL in development mode', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const result = await sendNewPasswordEmail(
        'user@example.com',
        'John Doe',
        'newpassword123'
      );

      expect(result.testUrl).toBe(
        'http://localhost:3000/login?email=user%40example.com'
      );

      process.env.NODE_ENV = originalNodeEnv;
    });

    it('should include password in email content', async () => {
      await sendNewPasswordEmail(
        'user@example.com',
        'John Doe',
        'newpassword123'
      );

      const sentEmail = mockTransporter.sendMail.mock.calls[0][0];
      expect(sentEmail.html).toContain('newpassword123');
      expect(sentEmail.text).toContain('newpassword123');
    });

    it('should handle send failures gracefully', async () => {
      const error = new Error('SMTP send failed');
      mockTransporter.sendMail.mockRejectedValue(error);

      await expect(
        sendNewPasswordEmail('user@example.com', 'John Doe', 'newpassword123')
      ).rejects.toThrow(error);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to send new password email',
        { error, to: 'user@example.com' }
      );
    });
  });

  describe('Verification Email', () => {
    const mockParams = {
      to: 'user@example.com',
      verificationToken: 'verify123',
      userName: 'John Doe',
      language: 'en',
    };

    it('should send verification email successfully', async () => {
      await sendVerificationEmail(mockParams);

      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: '"SpherosegV4" <noreply@spheroseg.com>',
        to: 'user@example.com',
        subject: 'Verify Your Email',
        html: expect.stringContaining('Email Verification'),
        text: expect.stringContaining('Email Verification'),
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Verification email sent',
        { to: 'user@example.com' }
      );
    });

    it('should generate correct verification URL', async () => {
      await sendVerificationEmail(mockParams);

      const sentEmail = mockTransporter.sendMail.mock.calls[0][0];
      expect(sentEmail.html).toContain(
        'https://app.spheroseg.com/verify-email?token=verify123'
      );
      expect(sentEmail.text).toContain(
        'https://app.spheroseg.com/verify-email?token=verify123'
      );
    });

    it('should use personalized greeting when userName provided', async () => {
      await sendVerificationEmail(mockParams);

      expect(mockTranslator).toHaveBeenCalledWith(
        'email.verification.greetingWithName',
        { name: 'John Doe' }
      );
    });

    it('should use generic greeting when userName not provided', async () => {
      await sendVerificationEmail({
        ...mockParams,
        userName: undefined,
      });

      expect(mockTranslator).toHaveBeenCalledWith('email.verification.greeting');
    });
  });

  describe('Access Request Email', () => {
    const mockParams = {
      to: 'admin@example.com',
      requesterName: 'Jane Smith',
      requesterEmail: 'jane@example.com',
      message: 'I need access to analyze the data',
      language: 'en',
    };

    it('should send access request email successfully', async () => {
      await sendAccessRequest(mockParams);

      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: '"SpherosegV4" <noreply@spheroseg.com>',
        to: 'admin@example.com',
        subject: 'Access Request',
        html: expect.stringContaining('Access Request'),
        text: expect.stringContaining('Access Request'),
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Access request notification sent',
        { to: 'admin@example.com', requesterEmail: 'jane@example.com' }
      );
    });

    it('should include requester details and message', async () => {
      await sendAccessRequest(mockParams);

      expect(mockTranslator).toHaveBeenCalledWith(
        'email.accessRequest.body',
        {
          requesterName: 'Jane Smith',
          requesterEmail: 'jane@example.com',
          message: 'I need access to analyze the data',
        }
      );
    });

    it('should handle missing message gracefully', async () => {
      await sendAccessRequest({
        ...mockParams,
        message: undefined,
      });

      expect(mockTranslator).toHaveBeenCalledWith(
        'email.accessRequest.body',
        {
          requesterName: 'Jane Smith',
          requesterEmail: 'jane@example.com',
          message: 'No message provided',
        }
      );
    });
  });

  describe('Template Generation', () => {
    it('should generate HTML template with action button', async () => {
      await sendPasswordResetEmail({
        to: 'user@example.com',
        resetToken: 'reset123',
      });

      const sentEmail = mockTransporter.sendMail.mock.calls[0][0];
      expect(sentEmail.html).toContain('<a href=');
      expect(sentEmail.html).toContain('background-color: #4CAF50');
      expect(sentEmail.html).toContain('Reset Password');
    });

    it('should generate text template with URL', async () => {
      await sendPasswordResetEmail({
        to: 'user@example.com',
        resetToken: 'reset123',
      });

      const sentEmail = mockTransporter.sendMail.mock.calls[0][0];
      expect(sentEmail.text).toContain('Reset Password:');
      expect(sentEmail.text).toContain('https://app.spheroseg.com/reset-password?token=reset123');
    });

    it('should generate template without action when no URL provided', async () => {
      await sendInvitationAcceptedNotification({
        to: 'owner@example.com',
        projectTitle: 'Test Project',
        acceptedByName: 'Jane Smith',
        acceptedByEmail: 'jane@example.com',
      });

      const sentEmail = mockTransporter.sendMail.mock.calls[0][0];
      expect(sentEmail.html).not.toContain('<a href=');
      expect(sentEmail.text).not.toContain('http');
    });
  });

  describe('Internationalization Support', () => {
    it('should default to English when no language specified', async () => {
      await sendPasswordResetEmail({
        to: 'user@example.com',
        resetToken: 'reset123',
      });

      expect(mockI18next.getFixedT).toHaveBeenCalledWith('en');
    });

    it('should use specified language', async () => {
      await sendPasswordResetEmail({
        to: 'user@example.com',
        resetToken: 'reset123',
        language: 'es',
      });

      expect(mockI18next.getFixedT).toHaveBeenCalledWith('es');
    });

    it('should pass correct translation keys and parameters', async () => {
      await sendProjectInvitation({
        to: 'user@example.com',
        projectTitle: 'Test Project',
        ownerName: 'John Doe',
        invitationToken: 'abc123',
        permission: 'edit',
      });

      expect(mockTranslator).toHaveBeenCalledWith('email.projectInvitation.title');
      expect(mockTranslator).toHaveBeenCalledWith('email.projectInvitation.body', {
        ownerName: 'John Doe',
        projectTitle: 'Test Project',
        permission: 'edit',
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle transporter creation failures', () => {
      const error = new Error('Failed to create transporter');
      mockNodemailer.createTransporter.mockImplementation(() => {
        throw error;
      });

      expect(() => {
        jest.resetModules();
        require('../emailService');
      }).toThrow(error);
    });

    it('should handle translation failures gracefully', async () => {
      mockTranslator.mockImplementation(() => {
        throw new Error('Translation failed');
      });

      await expect(
        sendPasswordResetEmail({
          to: 'user@example.com',
          resetToken: 'reset123',
        })
      ).rejects.toThrow('Translation failed');
    });

    it('should handle SMTP authentication failures', async () => {
      const authError = new Error('Authentication failed');
      mockTransporter.sendMail.mockRejectedValue(authError);

      await expect(
        sendPasswordResetEmail({
          to: 'user@example.com',
          resetToken: 'reset123',
        })
      ).rejects.toThrow('Authentication failed');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to send password reset email',
        { error: authError, to: 'user@example.com' }
      );
    });
  });

  describe('Default Export', () => {
    it('should export all email functions', () => {
      expect(emailService.sendProjectInvitation).toBe(sendProjectInvitation);
      expect(emailService.sendPasswordResetEmail).toBe(sendPasswordResetEmail);
      expect(emailService.sendNewPasswordEmail).toBe(sendNewPasswordEmail);
      expect(emailService.sendVerificationEmail).toBe(sendVerificationEmail);
      expect(emailService.sendAccessRequest).toBe(sendAccessRequest);
    });

    it('should provide backward compatibility aliases', () => {
      expect(emailService.sendPasswordReset).toBe(sendPasswordResetEmail);
    });
  });

  describe('Configuration Validation', () => {
    it('should use correct email configuration', () => {
      expect(mockNodemailer.createTransporter).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'smtp.example.com',
          port: 587,
          secure: false,
          auth: {
            user: 'test@example.com',
            pass: 'password',
          },
        })
      );
    });

    it('should use correct frontend URL for links', async () => {
      await sendPasswordResetEmail({
        to: 'user@example.com',
        resetToken: 'reset123',
      });

      const sentEmail = mockTransporter.sendMail.mock.calls[0][0];
      expect(sentEmail.html).toContain('https://app.spheroseg.com');
    });

    it('should use correct sender information', async () => {
      await sendPasswordResetEmail({
        to: 'user@example.com',
        resetToken: 'reset123',
      });

      const sentEmail = mockTransporter.sendMail.mock.calls[0][0];
      expect(sentEmail.from).toBe('"SpherosegV4" <noreply@spheroseg.com>');
    });
  });
});