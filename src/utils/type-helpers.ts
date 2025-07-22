// Type helper utilities for safe type conversions

/**
 * Safely converts an unknown error to a string or Error object
 */
export function toErrorType(error: unknown): string | Error {
  if (error instanceof Error) {
    return error;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }
  return String(error);
}

/**
 * Safely converts an unknown value to a string
 */
export function toString(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (value === null || value === undefined) {
    return '';
  }
  return String(value);
}

/**
 * Type guard to check if a value is a string
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * Type guard to check if a value is an Error
 */
export function isError(value: unknown): value is Error {
  return value instanceof Error;
}
