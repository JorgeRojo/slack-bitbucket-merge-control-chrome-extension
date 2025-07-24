import { Logger } from '@src/modules/common/utils/Logger';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

describe('Logger', () => {
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;

  beforeEach(() => {
    console.log = vi.fn();
    console.error = vi.fn();
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  test('Logger should have log method', () => {
    expect(typeof Logger.log).toBe('function');
  });

  test('Logger should have error method', () => {
    expect(typeof Logger.error).toBe('function');
  });

  test('log method should not throw errors', () => {
    expect(() => {
      Logger.log('test message');
    }).not.toThrow();
    expect(console.log).toHaveBeenCalledWith('test message');
  });

  test('error method should not throw errors', () => {
    expect(() => {
      Logger.error(new Error('test error'));
    }).not.toThrow();
    expect(console.error).toHaveBeenCalled();
  });

  test('error method should not throw errors with string input', () => {
    expect(() => {
      Logger.error('test error message');
    }).not.toThrow();
    expect(console.error).toHaveBeenCalled();
  });

  test('error method should handle context with silentMessages', () => {
    expect(() => {
      Logger.error(new Error('test error'), 'TestComponent', {
        silentMessages: ['some message'],
        otherContext: 'value',
      });
    }).not.toThrow();
    expect(console.error).toHaveBeenCalled();
  });

  test('error method should handle empty context', () => {
    expect(() => {
      Logger.error(new Error('test error'), 'TestComponent', {});
    }).not.toThrow();
    expect(console.error).toHaveBeenCalled();
  });
});
