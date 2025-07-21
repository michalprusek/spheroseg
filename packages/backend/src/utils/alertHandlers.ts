/**
 * Alert Handlers for Business Metrics
 * 
 * Implements various notification channels for metric alerts
 */

import { Alert } from './businessMetrics';

// Re-export Alert type for use in tests
export type { Alert };
import logger from './logger';
import nodemailer from 'nodemailer';
import axios from 'axios';

export interface AlertHandlerConfig {
  email?: {
    enabled: boolean;
    recipients?: string[];
    smtp?: {
      host: string;
      port: number;
      secure: boolean;
      auth: {
        user: string;
        pass: string;
      };
    };
  };
  slack?: {
    enabled: boolean;
    webhookUrl?: string;
    channel?: string;
    username?: string;
  };
  webhook?: {
    enabled: boolean;
    url?: string;
    headers?: Record<string, string>;
    method?: 'POST' | 'PUT';
  };
  console?: {
    enabled: boolean;
  };
}

/**
 * Email alert handler
 */
export class EmailAlertHandler {
  private transporter: nodemailer.Transporter;
  private recipients: string[];
  
  constructor(config: NonNullable<AlertHandlerConfig['email']>) {
    if (!config.recipients || config.recipients.length === 0) {
      throw new Error('Email handler requires at least one recipient');
    }
    if (!config.smtp) {
      throw new Error('Email handler requires SMTP configuration');
    }
    this.recipients = config.recipients;
    this.transporter = nodemailer.createTransport(config.smtp);
  }
  
  async handle(alert: Alert): Promise<void> {
    const subject = `[${alert.severity.toUpperCase()}] ${alert.metric}: ${alert.message}`;
    
    const html = `
      <h2>Business Metric Alert</h2>
      <table border="1" cellpadding="10" cellspacing="0">
        <tr>
          <td><strong>Metric</strong></td>
          <td>${alert.metric}</td>
        </tr>
        <tr>
          <td><strong>Severity</strong></td>
          <td style="color: ${alert.severity === 'critical' ? 'red' : 'orange'}">
            ${alert.severity.toUpperCase()}
          </td>
        </tr>
        <tr>
          <td><strong>Type</strong></td>
          <td>${alert.type}</td>
        </tr>
        <tr>
          <td><strong>Message</strong></td>
          <td>${alert.message}</td>
        </tr>
        <tr>
          <td><strong>Value</strong></td>
          <td>${alert.value}</td>
        </tr>
        ${alert.threshold ? `
        <tr>
          <td><strong>Threshold</strong></td>
          <td>${alert.threshold}</td>
        </tr>
        ` : ''}
        <tr>
          <td><strong>Timestamp</strong></td>
          <td>${alert.timestamp.toISOString()}</td>
        </tr>
        <tr>
          <td><strong>Alert ID</strong></td>
          <td>${alert.id}</td>
        </tr>
      </table>
      <p>
        <a href="${process.env['APP_URL']}/admin/metrics?alert=${alert.id}">
          View in Dashboard
        </a>
      </p>
    `;
    
    await this.transporter.sendMail({
      from: process.env['EMAIL_FROM'] || 'alerts@spheroseg.com',
      to: this.recipients.join(', '),
      subject,
      html,
    });
    
    logger.info('Email alert sent', {
      alert: alert.id,
      recipients: this.recipients.length,
    });
  }
}

/**
 * Slack alert handler
 */
export class SlackAlertHandler {
  private webhookUrl: string;
  private channel?: string | undefined;
  private username?: string | undefined;
  
  constructor(config: NonNullable<AlertHandlerConfig['slack']>) {
    if (!config.webhookUrl) {
      throw new Error('Slack handler requires webhook URL');
    }
    this.webhookUrl = config.webhookUrl;
    this.channel = config.channel;
    this.username = config.username || 'SpherosegV4 Alerts';
  }
  
  async handle(alert: Alert): Promise<void> {
    const color = alert.severity === 'critical' ? 'danger' : 'warning';
    const icon = alert.severity === 'critical' ? ':rotating_light:' : ':warning:';
    
    const payload = {
      channel: this.channel,
      username: this.username,
      icon_emoji: icon,
      attachments: [
        {
          color,
          title: `${alert.metric}: ${alert.message}`,
          fields: [
            {
              title: 'Severity',
              value: alert.severity.toUpperCase(),
              short: true,
            },
            {
              title: 'Type',
              value: alert.type,
              short: true,
            },
            {
              title: 'Value',
              value: alert.value.toString(),
              short: true,
            },
            ...(alert.threshold ? [{
              title: 'Threshold',
              value: alert.threshold.toString(),
              short: true,
            }] : []),
          ],
          footer: 'SpherosegV4 Metrics',
          ts: Math.floor(alert.timestamp.getTime() / 1000),
          actions: [
            {
              type: 'button',
              text: 'View Dashboard',
              url: `${process.env['APP_URL']}/admin/metrics?alert=${alert.id}`,
            },
            {
              type: 'button',
              text: 'Acknowledge',
              url: `${process.env['APP_URL']}/api/metrics/alerts/${alert.id}/acknowledge`,
              style: 'primary',
            },
          ],
        },
      ],
    };
    
    await axios.post(this.webhookUrl, payload);
    
    logger.info('Slack alert sent', {
      alert: alert.id,
      channel: this.channel,
    });
  }
}

/**
 * Generic webhook alert handler
 */
export class WebhookAlertHandler {
  private url: string;
  private headers: Record<string, string>;
  private method: 'POST' | 'PUT';
  
  constructor(config: NonNullable<AlertHandlerConfig['webhook']>) {
    if (!config.url) {
      throw new Error('Webhook handler requires URL');
    }
    this.url = config.url;
    this.headers = config.headers || {};
    this.method = config.method || 'POST';
  }
  
  async handle(alert: Alert): Promise<void> {
    const payload = {
      event: 'metric_alert',
      alert: {
        id: alert.id,
        metric: alert.metric,
        severity: alert.severity,
        type: alert.type,
        message: alert.message,
        value: alert.value,
        threshold: alert.threshold,
        timestamp: alert.timestamp.toISOString(),
      },
      metadata: {
        application: 'SpherosegV4',
        environment: process.env['NODE_ENV'] || 'development',
        instance: process.env['INSTANCE_ID'] || 'unknown',
      },
    };
    
    await axios({
      method: this.method,
      url: this.url,
      headers: {
        'Content-Type': 'application/json',
        ...this.headers,
      },
      data: payload,
    });
    
    logger.info('Webhook alert sent', {
      alert: alert.id,
      url: this.url,
    });
  }
}

/**
 * Console alert handler (for development/debugging)
 */
export class ConsoleAlertHandler {
  async handle(alert: Alert): Promise<void> {
    const severityColor = alert.severity === 'critical' ? '\x1b[31m' : '\x1b[33m'; // Red or Yellow
    const resetColor = '\x1b[0m';
    
    console.log(`
${severityColor}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 BUSINESS METRIC ALERT - ${alert.severity.toUpperCase()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${resetColor}
Metric:    ${alert.metric}
Message:   ${alert.message}
Type:      ${alert.type}
Value:     ${alert.value}${alert.threshold ? `
Threshold: ${alert.threshold}` : ''}
Time:      ${alert.timestamp.toISOString()}
ID:        ${alert.id}
${severityColor}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${resetColor}
    `);
  }
}

/**
 * Alert handler factory
 */
export class AlertHandlerFactory {
  static createHandlers(config: AlertHandlerConfig): Array<(alert: Alert) => Promise<void>> {
    const handlers: Array<(alert: Alert) => Promise<void>> = [];
    
    if (config.email?.enabled) {
      const emailHandler = new EmailAlertHandler(config.email);
      handlers.push(alert => emailHandler.handle(alert));
    }
    
    if (config.slack?.enabled) {
      const slackHandler = new SlackAlertHandler(config.slack);
      handlers.push(alert => slackHandler.handle(alert));
    }
    
    if (config.webhook?.enabled) {
      const webhookHandler = new WebhookAlertHandler(config.webhook);
      handlers.push(alert => webhookHandler.handle(alert));
    }
    
    if (config.console?.enabled) {
      const consoleHandler = new ConsoleAlertHandler();
      handlers.push(alert => consoleHandler.handle(alert));
    }
    
    return handlers;
  }
}

/**
 * Alert throttling to prevent spam
 */
export class ThrottledAlertHandler {
  private sentAlerts: Map<string, Date> = new Map();
  private throttleWindow: number; // milliseconds
  
  constructor(
    private handler: (alert: Alert) => Promise<void>,
    throttleMinutes: number = 15
  ) {
    this.throttleWindow = throttleMinutes * 60 * 1000;
  }
  
  async handle(alert: Alert): Promise<void> {
    const key = `${alert.metric}:${alert.severity}:${alert.type}`;
    const lastSent = this.sentAlerts.get(key);
    
    if (lastSent && (Date.now() - lastSent.getTime()) < this.throttleWindow) {
      logger.debug('Alert throttled', {
        alert: alert.id,
        metric: alert.metric,
        lastSent,
      });
      return;
    }
    
    await this.handler(alert);
    this.sentAlerts.set(key, new Date());
    
    // Clean up old entries
    for (const [k, v] of this.sentAlerts.entries()) {
      if (Date.now() - v.getTime() > this.throttleWindow * 2) {
        this.sentAlerts.delete(k);
      }
    }
  }
}

/**
 * Composite alert handler that tries multiple handlers
 */
export class CompositeAlertHandler {
  constructor(private handlers: Array<(alert: Alert) => Promise<void>>) {}
  
  async handle(alert: Alert): Promise<void> {
    const results = await Promise.allSettled(
      this.handlers.map(handler => handler(alert))
    );
    
    const failures = results.filter(r => r.status === 'rejected');
    if (failures.length > 0) {
      logger.error('Some alert handlers failed', {
        alert: alert.id,
        failures: failures.length,
        total: this.handlers.length,
      });
    }
  }
}

/**
 * Create default alert handler configuration
 */
export function createDefaultAlertConfig(): AlertHandlerConfig {
  return {
    email: {
      enabled: process.env['ALERT_EMAIL_ENABLED'] === 'true',
      recipients: process.env['ALERT_EMAIL_RECIPIENTS']?.split(',') || [],
      smtp: {
        host: process.env['SMTP_HOST'] || 'localhost',
        port: parseInt(process.env['SMTP_PORT'] || '587', 10),
        secure: process.env['SMTP_SECURE'] === 'true',
        auth: {
          user: process.env['SMTP_USER'] || '',
          pass: process.env['SMTP_PASS'] || '',
        },
      },
    },
    slack: {
      enabled: process.env['ALERT_SLACK_ENABLED'] === 'true',
      webhookUrl: process.env['ALERT_SLACK_WEBHOOK'] || '',
      ...(process.env['ALERT_SLACK_CHANNEL'] && { channel: process.env['ALERT_SLACK_CHANNEL'] }),
      ...(process.env['ALERT_SLACK_USERNAME'] && { username: process.env['ALERT_SLACK_USERNAME'] }),
    },
    webhook: {
      enabled: process.env['ALERT_WEBHOOK_ENABLED'] === 'true',
      url: process.env['ALERT_WEBHOOK_URL'] || '',
      headers: process.env['ALERT_WEBHOOK_HEADERS'] 
        ? JSON.parse(process.env['ALERT_WEBHOOK_HEADERS'])
        : undefined,
    },
    console: {
      enabled: process.env['NODE_ENV'] === 'development' || 
               process.env['ALERT_CONSOLE_ENABLED'] === 'true',
    },
  };
}