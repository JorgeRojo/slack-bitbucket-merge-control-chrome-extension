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
    expect(result).toEqual({ error, context, silenced: false });
  });

  test('should preserve original Error object with stack trace', () => {
    const originalError = new Error('Original error');
    const originalStack = originalError.stack;

    ErrorHandler.handle(originalError, { component: 'Test' });

    const errorCall = (console.error as jest.Mock).mock.calls.find(
      (call: any[]) => call[0] === '[Test]' && call[1] === originalError
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
    expect(console.error).toHaveBeenCalledWith('Error in callback handler', callbackError);
  });

  test('should handle null and undefined errors gracefully', () => {
    // @ts-ignore - Testing invalid input
    ErrorHandler.handle(null, { component: 'Test' });
    // @ts-ignore - Testing invalid input
    ErrorHandler.handle(undefined, { component: 'Test' });

    expect(console.error).toHaveBeenCalledWith('[Test]', null);
    expect(console.error).toHaveBeenCalledWith('[Test]', undefined);
  });

  test('should maintain error object identity', () => {
    const originalError = new Error('Test error');
    (originalError as any).customProperty = 'custom value';

    const result = ErrorHandler.handle(originalError);

    const errorCall = (console.error as jest.Mock).mock.calls.find(
      (call: any[]) => call[0] === '[General]' && call[1] === originalError
    );

    expect(errorCall[1]).toBe(originalError);
    expect((errorCall[1] as any).customProperty).toBe('custom value');
    expect(result.error).toBe(originalError);
  });

  test('should silence errors that match silentMessages', () => {
    const error = new Error('Receiving end does not exist');
    const silentMessages = ['Receiving end does not exist'];

    const result = ErrorHandler.handle(error, { silentMessages });

    expect(console.error).not.toHaveBeenCalled();
    expect(result).toEqual({ error, context: {}, silenced: true });
  });

  test('should silence errors with partial message matches', () => {
    const error = new Error('Could not establish connection. Receiving end does not exist.');
    const silentMessages = ['Receiving end does not exist'];

    const result = ErrorHandler.handle(error, { silentMessages });

    expect(console.error).not.toHaveBeenCalled();
    expect(result.silenced).toBe(true);
  });

  test('should not silence errors that do not match silentMessages', () => {
    const error = new Error('Some other error');
    const silentMessages = ['Receiving end does not exist'];

    const result = ErrorHandler.handle(error, { silentMessages });

    expect(console.error).toHaveBeenCalledWith('[General]', error);
    expect(result.silenced).toBe(false);
  });

  test('should handle multiple silent messages', () => {
    const silentMessages = [
      'Receiving end does not exist',
      'The message port closed before a response was received',
    ];

    const error1 = new Error('Receiving end does not exist');
    const error2 = new Error('The message port closed before a response was received');
    const error3 = new Error('Some other error');

    const result1 = ErrorHandler.handle(error1, { silentMessages });
    const result2 = ErrorHandler.handle(error2, { silentMessages });
    const result3 = ErrorHandler.handle(error3, { silentMessages });

    expect(result1.silenced).toBe(true);
    expect(result2.silenced).toBe(true);
    expect(result3.silenced).toBe(false);
  });

  test('should handle string errors with silent messages', () => {
    const errorMessage = 'Receiving end does not exist';
    const silentMessages = ['Receiving end does not exist'];

    const result = ErrorHandler.handle(errorMessage, { silentMessages });

    expect(console.error).not.toHaveBeenCalled();
    expect(result.silenced).toBe(true);
  });
});
