import { describe, test, expect } from 'vitest';
import { Logger } from '../../src/utils/logger';

describe('Logger', () => {
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
  });

  test('error method should not throw errors', () => {
    expect(() => {
      Logger.error(new Error('test error'));
    }).not.toThrow();
  });

  test('error method should not throw errors with string input', () => {
    expect(() => {
      Logger.error('test error message');
    }).not.toThrow();
  });
});
