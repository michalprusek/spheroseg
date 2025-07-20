/**
 * PII (Personally Identifiable Information) Sanitizer
 * 
 * Detects and removes sensitive information from error logs and data
 * to ensure compliance with privacy regulations.
 */

export interface SanitizationOptions {
  preserveStructure?: boolean;
  maskCharacter?: string;
  minMaskLength?: number;
  customPatterns?: RegExp[];
}

export class PIISanitizer {
  // Common PII patterns
  private static readonly patterns = {
    // Authentication tokens
    jwt: /\b[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\b/g,
    bearerToken: /Bearer\s+[A-Za-z0-9-._~+\/]+=*/gi,
    apiKey: /([aA]pi[_-]?[kK]ey|[aA]ccess[_-]?[tT]oken|[sS]ecret[_-]?[kK]ey)\s*[:=]\s*['"]?([A-Za-z0-9-._~+\/]+)['"]?/gi,
    
    // Personal information
    email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    phone: /(\+?[1-9]\d{0,2}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
    ssn: /\b\d{3}-\d{2}-\d{4}\b|\b\d{9}\b/g,
    
    // Financial information
    creditCard: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|6(?:011|5[0-9]{2})[0-9]{12}|(?:2131|1800|35\d{3})\d{11})\b/g,
    iban: /[A-Z]{2}\d{2}[A-Z0-9]{1,30}/g,
    
    // IP addresses
    ipv4: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    ipv6: /\b(?:[A-F0-9]{1,4}:){7}[A-F0-9]{1,4}\b/gi,
    
    // Database credentials
    dbUrl: /(mongodb|postgres|postgresql|mysql|redis|elastic):\/\/[^:]+:[^@]+@[^\/]+/gi,
    
    // File paths that might contain usernames
    userPath: /\/(?:home|users)\/[^\/\s]+/gi,
    
    // AWS credentials
    awsAccessKey: /AKIA[0-9A-Z]{16}/g,
    awsSecretKey: /[0-9a-zA-Z/+=]{40}/g,
    
    // Generic sensitive keys in objects/queries
    sensitiveKeys: /(password|passwd|pwd|secret|token|key|auth|credential|private)['"]?\s*[:=]\s*['"]?[^'",\s}]+['"]?/gi,
  };
  
  /**
   * Sanitize a string by replacing PII with masked values
   */
  static sanitizeString(
    input: string,
    options: SanitizationOptions = {}
  ): string {
    const {
      maskCharacter = '*',
      minMaskLength = 3,
      customPatterns = [],
    } = options;
    
    let sanitized = input;
    
    // Apply all standard patterns
    Object.entries(this.patterns).forEach(([type, pattern]) => {
      sanitized = sanitized.replace(pattern, (match) => {
        // Special handling for certain types
        if (type === 'email') {
          const [local, domain] = match.split('@');
          return `${local.charAt(0)}${maskCharacter.repeat(3)}@${domain}`;
        }
        
        if (type === 'sensitiveKeys') {
          // Preserve the key name but mask the value
          const keyMatch = match.match(/([^:=]+)[:=]\s*['"]?([^'",\s}]+)['"]?/);
          if (keyMatch) {
            return `${keyMatch[1]}=${maskCharacter.repeat(8)}`;
          }
        }
        
        // Default masking
        const maskLength = Math.max(minMaskLength, Math.min(match.length, 12));
        return maskCharacter.repeat(maskLength);
      });
    });
    
    // Apply custom patterns
    customPatterns.forEach((pattern) => {
      sanitized = sanitized.replace(pattern, maskCharacter.repeat(8));
    });
    
    return sanitized;
  }
  
  /**
   * Sanitize an object by recursively cleaning all string values
   */
  static sanitizeObject<T extends Record<string, any>>(
    obj: T,
    options: SanitizationOptions = {}
  ): T {
    const { preserveStructure = true } = options;
    
    if (!obj || typeof obj !== 'object') {
      return obj;
    }
    
    if (obj instanceof Date || obj instanceof RegExp) {
      return obj;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item, options)) as any;
    }
    
    const sanitized: any = {};
    
    Object.keys(obj).forEach((key) => {
      const value = obj[key];
      const lowerKey = key.toLowerCase();
      
      // Check if the key itself suggests sensitive data
      const isSensitiveKey = [
        'password', 'passwd', 'pwd', 'secret', 'token',
        'key', 'auth', 'credential', 'private', 'ssn',
        'credit_card', 'creditcard', 'email', 'phone'
      ].some(sensitive => lowerKey.includes(sensitive));
      
      if (isSensitiveKey && typeof value === 'string') {
        sanitized[key] = preserveStructure ? '***REDACTED***' : undefined;
      } else if (typeof value === 'string') {
        sanitized[key] = this.sanitizeString(value, options);
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeObject(value, options);
      } else {
        sanitized[key] = value;
      }
    });
    
    return preserveStructure ? sanitized : this.removeUndefined(sanitized);
  }
  
  /**
   * Sanitize error stack traces
   */
  static sanitizeStackTrace(stack: string): string {
    if (!stack) return stack;
    
    // Remove file paths that might contain usernames
    let sanitized = stack.replace(this.patterns.userPath, '/[USER_PATH]');
    
    // Remove any potential secrets in stack trace
    sanitized = this.sanitizeString(sanitized, {
      maskCharacter: '[REDACTED]',
    });
    
    return sanitized;
  }
  
  /**
   * Create a sanitized error object safe for logging
   */
  static sanitizeError(error: Error & { [key: string]: any }): any {
    const sanitized: any = {
      name: error.name,
      message: this.sanitizeString(error.message),
      stack: error.stack ? this.sanitizeStackTrace(error.stack) : undefined,
    };
    
    // Copy and sanitize any additional properties
    Object.keys(error).forEach((key) => {
      if (!['name', 'message', 'stack'].includes(key)) {
        const value = error[key];
        if (typeof value === 'string') {
          sanitized[key] = this.sanitizeString(value);
        } else if (typeof value === 'object' && value !== null) {
          sanitized[key] = this.sanitizeObject(value);
        } else {
          sanitized[key] = value;
        }
      }
    });
    
    return sanitized;
  }
  
  /**
   * Check if a string contains potential PII
   */
  static containsPII(input: string): boolean {
    if (!input || typeof input !== 'string') {
      return false;
    }
    
    return Object.values(this.patterns).some(pattern => {
      const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern);
      return regex.test(input);
    });
  }
  
  /**
   * Get a report of detected PII in a string
   */
  static detectPII(input: string): Array<{ type: string; count: number }> {
    const detections: Array<{ type: string; count: number }> = [];
    
    Object.entries(this.patterns).forEach(([type, pattern]) => {
      const matches = input.match(pattern);
      if (matches && matches.length > 0) {
        detections.push({ type, count: matches.length });
      }
    });
    
    return detections;
  }
  
  /**
   * Remove undefined values from object
   */
  private static removeUndefined(obj: any): any {
    Object.keys(obj).forEach(key => {
      if (obj[key] === undefined) {
        delete obj[key];
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        obj[key] = this.removeUndefined(obj[key]);
      }
    });
    return obj;
  }
}

export default PIISanitizer;