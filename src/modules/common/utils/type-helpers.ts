/**
 * Utility functions for type handling and conversion
 */

/**
 * Converts unknown error to Error type
 */
export function toErrorType(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  if (typeof error === 'string') {
    return new Error(error);
  }
  return new Error(String(error));
}

/**
 * Converts unknown value to string
 */
export function toString(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (value instanceof Error) {
    return value.message;
  }
  return String(value);
}

/**
 * Safely gets string value from unknown, with optional fallback
 */
export function toStringOrUndefined(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }
  if (value instanceof Error) {
    return value.message;
  }
  if (value != null) {
    return String(value);
  }
  return undefined;
}

/**
 * Type guard to check if value is a string
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * Type guard to check if value is an Error
 */
export function isError(value: unknown): value is Error {
  return value instanceof Error;
}
