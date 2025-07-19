/**
 * Tests for Alert Handlers
 */

import nodemailer from 'nodemailer';
import axios from 'axios';
import {
  EmailAlertHandler,
  SlackAlertHandler,
  WebhookAlertHandler,
  ConsoleAlertHandler,
  AlertHandlerFactory,
  ThrottledAlertHandler,
  CompositeAlertHandler,
  createDefaultAlertConfig,
  Alert,
} from '../alertHandlers';

// Mock dependencies
jest.mock('nodemailer');
jest.mock('axios');
jest.mock('../logger');

// Mock console for testing console handler
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();

describe('Alert Handlers', () => {
  const testAlert: Alert = {
    id: 'test-123',
    metric: 'test-metric',
    severity: 'warning',
    type: 'threshold',
    message: 'Test alert message',
    value: 15,
    threshold: 10,
    timestamp: new Date('2025-01-01T00:00:00Z'),
  };
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  describe('EmailAlertHandler', () => {
    let mockTransporter: any;
    
    beforeEach(() => {
      mockTransporter = {
        sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' }),
      };
      (nodemailer.createTransport as jest.Mock).mockReturnValue(mockTransporter);
    });
    
    it('should send email alert', async () => {
      const handler = new EmailAlertHandler({
        enabled: true,
        recipients: ['test@example.com', 'admin@example.com'],
        smtp: {
          host: 'smtp.test.com',
          port: 587,
          secure: false,
          auth: {
            user: 'test',
            pass: 'pass',
          },
        },
      });
      
      await handler.handle(testAlert);
      
      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: 'alerts@spheroseg.com',
        to: 'test@example.com, admin@example.com',
        subject: '[WARNING] test-metric: Test alert message',
        html: expect.stringContaining('Test alert message'),
      });
    });
    
    it('should format critical alerts differently', async () => {
      const criticalAlert = { ...testAlert, severity: 'critical' as const };
      
      const handler = new EmailAlertHandler({
        enabled: true,
        recipients: ['test@example.com'],
        smtp: {
          host: 'smtp.test.com',
          port: 587,
          secure: false,
          auth: {
            user: 'test',
            pass: 'pass',
          },
        },
      });
      
      await handler.handle(criticalAlert);
      
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: '[CRITICAL] test-metric: Test alert message',
          html: expect.stringContaining('color: red'),
        })
      );
    });
  });
  
  describe('SlackAlertHandler', () => {
    it('should send Slack alert', async () => {
      (axios.post as jest.Mock).mockResolvedValue({ data: { ok: true } });
      
      const handler = new SlackAlertHandler({
        enabled: true,
        webhookUrl: 'https://hooks.slack.com/test',
        channel: '#alerts',
        username: 'Test Bot',
      });
      
      await handler.handle(testAlert);
      
      expect(axios.post).toHaveBeenCalledWith(
        'https://hooks.slack.com/test',
        expect.objectContaining({
          channel: '#alerts',
          username: 'Test Bot',
          attachments: expect.arrayContaining([
            expect.objectContaining({
              color: 'warning',
              title: 'test-metric: Test alert message',
              fields: expect.arrayContaining([
                { title: 'Severity', value: 'WARNING', short: true },
                { title: 'Type', value: 'threshold', short: true },
                { title: 'Value', value: '15', short: true },
                { title: 'Threshold', value: '10', short: true },
              ]),
            }),
          ]),
        })
      );
    });
    
    it('should use danger color for critical alerts', async () => {
      (axios.post as jest.Mock).mockResolvedValue({ data: { ok: true } });
      
      const criticalAlert = { ...testAlert, severity: 'critical' as const };
      
      const handler = new SlackAlertHandler({
        enabled: true,
        webhookUrl: 'https://hooks.slack.com/test',
      });
      
      await handler.handle(criticalAlert);
      
      expect(axios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          attachments: expect.arrayContaining([
            expect.objectContaining({
              color: 'danger',
            }),
          ]),
        })
      );
    });
  });
  
  describe('WebhookAlertHandler', () => {
    it('should send webhook alert', async () => {
      (axios as unknown as jest.Mock).mockResolvedValue({ data: { success: true } });
      
      const handler = new WebhookAlertHandler({
        enabled: true,
        url: 'https://webhook.test.com/alerts',
        headers: {
          'X-API-Key': 'test-key',
        },
        method: 'POST',
      });
      
      await handler.handle(testAlert);
      
      expect(axios).toHaveBeenCalledWith({
        method: 'POST',
        url: 'https://webhook.test.com/alerts',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'test-key',
        },
        data: {
          event: 'metric_alert',
          alert: expect.objectContaining({
            id: 'test-123',
            metric: 'test-metric',
            severity: 'warning',
            type: 'threshold',
            message: 'Test alert message',
            value: 15,
            threshold: 10,
          }),
          metadata: expect.objectContaining({
            application: 'SpherosegV4',
            environment: 'development',
          }),
        },
      });
    });
    
    it('should support PUT method', async () => {
      (axios as unknown as jest.Mock).mockResolvedValue({ data: { success: true } });
      
      const handler = new WebhookAlertHandler({
        enabled: true,
        url: 'https://webhook.test.com/alerts',
        method: 'PUT',
      });
      
      await handler.handle(testAlert);
      
      expect(axios).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'PUT',
        })
      );
    });
  });
  
  describe('ConsoleAlertHandler', () => {
    it('should log alert to console', async () => {
      const handler = new ConsoleAlertHandler();
      
      await handler.handle(testAlert);
      
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('BUSINESS METRIC ALERT - WARNING')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Metric:    test-metric')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Value:     15')
      );
    });
    
    it('should use red color for critical alerts', async () => {
      const criticalAlert = { ...testAlert, severity: 'critical' as const };
      const handler = new ConsoleAlertHandler();
      
      await handler.handle(criticalAlert);
      
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('\\x1b[31m') // Red color code
      );
    });
  });
  
  describe('AlertHandlerFactory', () => {
    it('should create enabled handlers', () => {
      const config = {
        email: {
          enabled: true,
          recipients: ['test@example.com'],
          smtp: {
            host: 'smtp.test.com',
            port: 587,
            secure: false,
            auth: { user: 'test', pass: 'pass' },
          },
        },
        slack: {
          enabled: true,
          webhookUrl: 'https://hooks.slack.com/test',
        },
        webhook: {
          enabled: false,
          url: 'https://webhook.test.com',
        },
        console: {
          enabled: true,
        },
      };
      
      const handlers = AlertHandlerFactory.createHandlers(config);
      
      expect(handlers).toHaveLength(3); // email, slack, console (not webhook)
    });
    
    it('should not create disabled handlers', () => {
      const config = {
        email: { enabled: false },
        slack: { enabled: false },
        webhook: { enabled: false },
        console: { enabled: false },
      };
      
      const handlers = AlertHandlerFactory.createHandlers(config);
      
      expect(handlers).toHaveLength(0);
    });
  });
  
  describe('ThrottledAlertHandler', () => {
    it('should throttle repeated alerts', async () => {
      const mockHandler = jest.fn();
      const throttled = new ThrottledAlertHandler(mockHandler, 0.1); // 6 seconds
      
      // First alert should go through
      await throttled.handle(testAlert);
      expect(mockHandler).toHaveBeenCalledTimes(1);
      
      // Immediate second alert should be throttled
      await throttled.handle(testAlert);
      expect(mockHandler).toHaveBeenCalledTimes(1);
      
      // Different metric should go through
      const differentAlert = { ...testAlert, metric: 'different-metric' };
      await throttled.handle(differentAlert);
      expect(mockHandler).toHaveBeenCalledTimes(2);
    });
    
    it('should allow alerts after throttle window', async () => {
      jest.useFakeTimers();
      
      const mockHandler = jest.fn();
      const throttled = new ThrottledAlertHandler(mockHandler, 0.1); // 6 seconds
      
      await throttled.handle(testAlert);
      expect(mockHandler).toHaveBeenCalledTimes(1);
      
      // Advance time past throttle window
      jest.advanceTimersByTime(7000);
      
      await throttled.handle(testAlert);
      expect(mockHandler).toHaveBeenCalledTimes(2);
      
      jest.useRealTimers();
    });
  });
  
  describe('CompositeAlertHandler', () => {
    it('should call all handlers', async () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      const handler3 = jest.fn();
      
      const composite = new CompositeAlertHandler([handler1, handler2, handler3]);
      
      await composite.handle(testAlert);
      
      expect(handler1).toHaveBeenCalledWith(testAlert);
      expect(handler2).toHaveBeenCalledWith(testAlert);
      expect(handler3).toHaveBeenCalledWith(testAlert);
    });
    
    it('should continue if some handlers fail', async () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn().mockRejectedValue(new Error('Handler failed'));
      const handler3 = jest.fn();
      
      const composite = new CompositeAlertHandler([handler1, handler2, handler3]);
      
      await composite.handle(testAlert);
      
      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
      expect(handler3).toHaveBeenCalled();
    });
  });
  
  describe('createDefaultAlertConfig', () => {
    it('should create config from environment variables', () => {
      process.env['ALERT_EMAIL_ENABLED'] = 'true';
      process.env['ALERT_EMAIL_RECIPIENTS'] = 'test@example.com,admin@example.com';
      process.env['SMTP_HOST'] = 'smtp.gmail.com';
      process.env['SMTP_PORT'] = '587';
      process.env['SMTP_SECURE'] = 'false';
      process.env['SMTP_USER'] = 'alerts@company.com';
      process.env['SMTP_PASS'] = 'password123';
      
      process.env['ALERT_SLACK_ENABLED'] = 'true';
      process.env['ALERT_SLACK_WEBHOOK'] = 'https://hooks.slack.com/test';
      process.env['ALERT_SLACK_CHANNEL'] = '#alerts';
      
      process.env['NODE_ENV'] = 'production';
      
      const config = createDefaultAlertConfig();
      
      expect(config).toEqual({
        email: {
          enabled: true,
          recipients: ['test@example.com', 'admin@example.com'],
          smtp: {
            host: 'smtp.gmail.com',
            port: 587,
            secure: false,
            auth: {
              user: 'alerts@company.com',
              pass: 'password123',
            },
          },
        },
        slack: {
          enabled: true,
          webhookUrl: 'https://hooks.slack.com/test',
          channel: '#alerts',
          username: undefined,
        },
        webhook: {
          enabled: false,
          url: '',
          headers: undefined,
        },
        console: {
          enabled: false, // false in production
        },
      });
      
      // Clean up
      delete process.env['ALERT_EMAIL_ENABLED'];
      delete process.env['ALERT_EMAIL_RECIPIENTS'];
      delete process.env['SMTP_HOST'];
      delete process.env['SMTP_PORT'];
      delete process.env['SMTP_SECURE'];
      delete process.env['SMTP_USER'];
      delete process.env['SMTP_PASS'];
      delete process.env['ALERT_SLACK_ENABLED'];
      delete process.env['ALERT_SLACK_WEBHOOK'];
      delete process.env['ALERT_SLACK_CHANNEL'];
      delete process.env['NODE_ENV'];
    });
  });
});