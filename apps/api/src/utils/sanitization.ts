/**
 * Input sanitization utilities for XSS protection
 */

/**
 * Sanitize string input by removing potentially dangerous HTML/script content
 * @param input - Raw string input
 * @returns Sanitized string safe for storage
 */
export function sanitizeInput(input: string | undefined | null): string | undefined | null {
  if (!input || typeof input !== 'string') {
    return input;
  }

  // Remove script tags and event handlers
  let sanitized = input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/on\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/on\w+\s*=\s*'[^']*'/gi, '')
    .replace(/on\w+\s*=\s*[^\s>]*/gi, '')
    .replace(/<img[^>]*>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/vbscript:/gi, '');

  // Remove any remaining HTML tags for text fields
  sanitized = sanitized.replace(/<[^>]*>/g, '');

  // Trim whitespace
  return sanitized.trim();
}

/**
 * Sanitize an object's string properties recursively
 * @param obj - Object to sanitize
 * @returns Object with sanitized string values
 */
export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const sanitized: any = Array.isArray(obj) ? [] : {};

  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const value = obj[key];

      if (typeof value === 'string') {
        sanitized[key] = sanitizeInput(value);
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }
  }

  return sanitized as T;
}

/**
 * Validate and sanitize notification preferences
 * @param prefs - Raw notification preferences
 * @returns Validated and sanitized preferences
 */
export function validateNotificationPreferences(prefs: any): any {
  if (!prefs || typeof prefs !== 'object') {
    return null;
  }

  const validPrefs: any = {};

  // Only allow known boolean fields
  const booleanFields = ['email', 'requestUpdates', 'weeklyDigest', 'maintenanceAlerts'];
  for (const field of booleanFields) {
    if (field in prefs) {
      validPrefs[field] = Boolean(prefs[field]);
    }
  }

  // Validate frequency enum
  if ('frequency' in prefs) {
    const validFrequencies = ['immediate', 'daily', 'weekly'];
    validPrefs.frequency = validFrequencies.includes(prefs.frequency)
      ? prefs.frequency
      : 'immediate';
  }

  // Validate quiet hours if present
  if (prefs.quietHours && typeof prefs.quietHours === 'object') {
    validPrefs.quietHours = {
      enabled: Boolean(prefs.quietHours.enabled),
      start:
        typeof prefs.quietHours.start === 'string'
          ? sanitizeInput(prefs.quietHours.start)
          : '00:00',
      end: typeof prefs.quietHours.end === 'string' ? sanitizeInput(prefs.quietHours.end) : '00:00',
      timezone:
        typeof prefs.quietHours.timezone === 'string'
          ? sanitizeInput(prefs.quietHours.timezone)
          : 'Europe/Zurich',
    };
  }

  return validPrefs;
}

/**
 * Validate and sanitize privacy settings
 * @param settings - Raw privacy settings
 * @returns Validated and sanitized settings
 */
export function validatePrivacySettings(settings: any): any {
  if (!settings || typeof settings !== 'object') {
    return null;
  }

  const validSettings: any = {};

  // Validate profile visibility enum
  if ('profileVisibility' in settings) {
    const validVisibilities = ['private', 'team', 'company'];
    validSettings.profileVisibility = validVisibilities.includes(settings.profileVisibility)
      ? settings.profileVisibility
      : 'team';
  }

  // Only allow known boolean fields
  const booleanFields = [
    'allowAnalytics',
    'shareLocationData',
    'allowManagerAccess',
    'dataRetentionConsent',
  ];

  for (const field of booleanFields) {
    if (field in settings) {
      validSettings[field] = Boolean(settings[field]);
    }
  }

  return validSettings;
}
