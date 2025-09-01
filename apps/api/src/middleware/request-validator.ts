import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { ValidationError } from './error-handler';

export interface ValidationSchema {
  body?: Record<string, ValidationRule>;
  queryParams?: Record<string, ValidationRule>;
  pathParams?: Record<string, ValidationRule>;
}

export interface ValidationRule {
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'object' | 'array';
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  enum?: any[];
}

export const validateRequest = (schema: ValidationSchema) => {
  return (
    handler: (event: APIGatewayProxyEvent, context: Context) => Promise<APIGatewayProxyResult>
  ) => {
    return async (
      event: APIGatewayProxyEvent,
      context: Context
    ): Promise<APIGatewayProxyResult> => {
      const errors: Record<string, string> = {};

      // Validate body
      if (schema.body) {
        let body: any = {};
        if (event.body) {
          try {
            body = JSON.parse(event.body);
          } catch (error) {
            throw new ValidationError('Invalid JSON in request body');
          }
        }

        for (const [field, rule] of Object.entries(schema.body)) {
          const value = body[field];
          const fieldError = validateField(field, value, rule);
          if (fieldError) {
            errors[field] = fieldError;
          }
        }
      }

      // Validate query parameters
      if (schema.queryParams && event.queryStringParameters) {
        for (const [field, rule] of Object.entries(schema.queryParams)) {
          const value = event.queryStringParameters[field];
          const fieldError = validateField(field, value, rule);
          if (fieldError) {
            errors[field] = fieldError;
          }
        }
      }

      // Validate path parameters
      if (schema.pathParams && event.pathParameters) {
        for (const [field, rule] of Object.entries(schema.pathParams)) {
          const value = event.pathParameters[field];
          const fieldError = validateField(field, value, rule);
          if (fieldError) {
            errors[field] = fieldError;
          }
        }
      }

      if (Object.keys(errors).length > 0) {
        throw new ValidationError('Validation failed', { fields: errors });
      }

      return handler(event, context);
    };
  };
};

function validateField(field: string, value: any, rule: ValidationRule): string | null {
  if (rule.required && (value === undefined || value === null || value === '')) {
    return `${field} is required`;
  }

  if (value === undefined || value === null) {
    return null;
  }

  if (rule.type) {
    const actualType = Array.isArray(value) ? 'array' : typeof value;
    if (actualType !== rule.type) {
      return `${field} must be of type ${rule.type}`;
    }
  }

  if (rule.minLength && value.length < rule.minLength) {
    return `${field} must be at least ${rule.minLength} characters`;
  }

  if (rule.maxLength && value.length > rule.maxLength) {
    return `${field} must be at most ${rule.maxLength} characters`;
  }

  if (rule.pattern && !rule.pattern.test(value)) {
    return `${field} format is invalid`;
  }

  if (rule.enum && !rule.enum.includes(value)) {
    return `${field} must be one of: ${rule.enum.join(', ')}`;
  }

  return null;
}
