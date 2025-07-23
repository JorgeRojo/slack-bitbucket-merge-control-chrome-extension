export function toErrorType(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  if (typeof error === 'string') {
    return new Error(error);
  }
  return new Error(String(error));
}

export function toString(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (value instanceof Error) {
    return value.message;
  }
  return String(value);
}

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

export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export function isError(value: unknown): value is Error {
  return value instanceof Error;
}
