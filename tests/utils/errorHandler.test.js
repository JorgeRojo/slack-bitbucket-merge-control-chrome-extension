import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { ErrorHandler } from '../../src/utils/errorHandler';

describe('ErrorHandler', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should log error object directly preserving stack trace', () => {
    const error = new Error('Test error');
    const component = 'TestComponent';
    const context = { key: 'value' };

    const result = ErrorHandler.handle(error, { component, context });

    expect(console.error).toHaveBeenCalledWith(`[${component}]`, error);
    expect(console.error).toHaveBeenCalledWith('Context:', context);
    expect(result).toEqual({ error, context });
  });

  test('should preserve original Error object with stack trace', () => {
    const originalError = new Error('Original error');
    const originalStack = originalError.stack;

    ErrorHandler.handle(originalError, { component: 'Test' });

    const errorCall = console.error.mock.calls.find(
      (call) => call[0] === '[Test]' && call[1] === originalError,
    );

    expect(errorCall).toBeDefined();
    expect(errorCall[1]).toBe(originalError);
    expect(errorCall[1].stack).toBe(originalStack);
  });

  test('should work with string errors', () => {
    const errorMessage = 'String error message';
    const component = 'TestComponent';

    ErrorHandler.handle(errorMessage, { component });

    expect(console.error).toHaveBeenCalledWith(`[${component}]`, errorMessage);
  });

  test('should use default component if not provided', () => {
    const error = new Error('Test error');

    ErrorHandler.handle(error);

    expect(console.error).toHaveBeenCalledWith('[General]', error);
  });

  test('should not log context if empty', () => {
    const error = new Error('Test error');
    const emptyContext = {};

    ErrorHandler.handle(error, { context: emptyContext });

    expect(console.error).toHaveBeenCalledWith('[General]', error);
    expect(console.error).not.toHaveBeenCalledWith('Context:', emptyContext);
  });

  test('should log context only when it has content', () => {
    const error = new Error('Test error');
    const context = { key: 'value', another: 'data' };

    ErrorHandler.handle(error, { context });

    expect(console.error).toHaveBeenCalledWith('[General]', error);
    expect(console.error).toHaveBeenCalledWith('Context:', context);
  });

  test('should execute callback if provided', () => {
    const error = new Error('Test error');
    const callback = vi.fn();
    const context = { key: 'value' };

    ErrorHandler.handle(error, { callback, context });

    expect(callback).toHaveBeenCalledWith(error, context);
  });

  test('should catch errors in callback and preserve their stack trace', () => {
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

  test('should handle null and undefined errors gracefully', () => {
    ErrorHandler.handle(null, { component: 'Test' });
    ErrorHandler.handle(undefined, { component: 'Test' });

    expect(console.error).toHaveBeenCalledWith('[Test]', null);
    expect(console.error).toHaveBeenCalledWith('[Test]', undefined);
  });

  test('should maintain error object identity', () => {
    const originalError = new Error('Test error');
    originalError.customProperty = 'custom value';

    const result = ErrorHandler.handle(originalError);

    const errorCall = console.error.mock.calls.find(
      (call) => call[0] === '[General]' && call[1] === originalError,
    );

    expect(errorCall[1]).toBe(originalError);
    expect(errorCall[1].customProperty).toBe('custom value');
    expect(result.error).toBe(originalError);
  });
});
