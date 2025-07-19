"use strict";
/**
 * Shared Logger Utility
 *
 * Simple logger for shared package that works in both browser and Node.js environments
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SharedLogger = exports.LOG_LEVELS = void 0;
exports.LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
};
class SharedLogger {
    constructor(context) {
        this.level = exports.LOG_LEVELS.INFO;
        this.context = 'shared';
        if (context) {
            this.context = context;
        }
        // Set log level from environment
        const envLevel = (typeof process !== 'undefined' && process.env?.['LOG_LEVEL']) || 'info';
        this.setLevel(envLevel);
    }
    setLevel(level) {
        switch (level.toLowerCase()) {
            case 'debug':
                this.level = exports.LOG_LEVELS.DEBUG;
                break;
            case 'info':
                this.level = exports.LOG_LEVELS.INFO;
                break;
            case 'warn':
                this.level = exports.LOG_LEVELS.WARN;
                break;
            case 'error':
                this.level = exports.LOG_LEVELS.ERROR;
                break;
            default:
                this.level = exports.LOG_LEVELS.INFO;
        }
    }
    formatMessage(level, message, ...args) {
        if (typeof console === 'undefined')
            return;
        const timestamp = new Date().toISOString();
        const prefix = `[${timestamp}] [${level.toUpperCase()}] [${this.context}]`;
        const fullMessage = `${prefix} ${message}`;
        if (args.length > 0) {
            // eslint-disable-next-line no-console
            console.log(fullMessage, ...args);
        }
        else {
            // eslint-disable-next-line no-console
            console.log(fullMessage);
        }
    }
    debug(message, ...args) {
        if (this.level <= exports.LOG_LEVELS.DEBUG) {
            this.formatMessage('debug', message, ...args);
        }
    }
    info(message, ...args) {
        if (this.level <= exports.LOG_LEVELS.INFO) {
            this.formatMessage('info', message, ...args);
        }
    }
    warn(message, ...args) {
        if (this.level <= exports.LOG_LEVELS.WARN) {
            this.formatMessage('warn', message, ...args);
        }
    }
    error(message, ...args) {
        if (this.level <= exports.LOG_LEVELS.ERROR) {
            this.formatMessage('error', message, ...args);
        }
    }
}
exports.SharedLogger = SharedLogger;
// Create default logger instance
const logger = new SharedLogger();
exports.default = logger;
//# sourceMappingURL=logger.js.map