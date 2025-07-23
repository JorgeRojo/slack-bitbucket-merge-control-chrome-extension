import { describe, test, expect } from 'vitest';
import { mockRuntime } from '@tests/setup';

describe('Tests Alias Example', () => {
  test('should be able to import from @tests', () => {
    expect(mockRuntime).toBeDefined();
    expect(typeof mockRuntime.sendMessage).toBe('function');
  });
});
