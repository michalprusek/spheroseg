/**
 * Shared Logger Utility
 *
 * Simple logger for shared package that works in both browser and Node.js environments
 */
export interface LogLevel {
    DEBUG: 0;
    INFO: 1;
    WARN: 2;
    ERROR: 3;
}
export declare const LOG_LEVELS: LogLevel;
export type LogLevelValue = LogLevel[keyof LogLevel];
declare class SharedLogger {
    private level;
    private context;
    constructor(context?: string);
    setLevel(level: string): void;
    private formatMessage;
    debug(message: string, ...args: unknown[]): void;
    info(message: string, ...args: unknown[]): void;
    warn(message: string, ...args: unknown[]): void;
    error(message: string, ...args: unknown[]): void;
}
declare const logger: SharedLogger;
export { SharedLogger };
export default logger;
//# sourceMappingURL=logger.d.ts.map