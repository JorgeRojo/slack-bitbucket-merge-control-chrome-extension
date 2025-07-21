import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { ErrorHandler } from '../../src/utils/errorHandler';

describe('ErrorHandler', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should log error with component and context', () => {
    const error = new Error('Test error');
    const component = 'TestComponent';
    const context = { key: 'value' };

    const result = ErrorHandler.handle(error, { component, context });

    expect(console.error).toHaveBeenCalledWith(
      `[${component}] ${error.message}`,
      expect.objectContaining({ error, context }),
    );
    expect(result).toEqual({ error, context });
  });

  test('should work with string errors', () => {
    const errorMessage = 'String error message';
    const component = 'TestComponent';

    ErrorHandler.handle(errorMessage, { component });

    expect(console.error).toHaveBeenCalledWith(
      `[${component}] ${errorMessage}`,
      expect.objectContaining({ error: errorMessage }),
    );
  });

  test('should use default component if not provided', () => {
    const error = new Error('Test error');

    ErrorHandler.handle(error);

    expect(console.error).toHaveBeenCalledWith(
      '[General] Test error',
      expect.anything(),
    );
  });

  test('should execute callback if provided', () => {
    const error = new Error('Test error');
    const callback = vi.fn();
    const context = { key: 'value' };

    ErrorHandler.handle(error, { callback, context });

    expect(callback).toHaveBeenCalledWith(error, context);
  });

  test('should catch errors in callback', () => {
    const error = new Error('Test error');
    const callbackError = new Error('Callback error');
    const callback = vi.fn().mockImplementation(() => {
      throw callbackError;
    });

    ErrorHandler.handle(error, { callback });

    expect(callback).toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      'Error in error handler callback:',
      callbackError,
    );
  });
});
