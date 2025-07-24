import { mockRuntime } from '@tests/setup';
import { describe, expect, test } from 'vitest';

describe('Tests Alias Example', () => {
  test('should be able to import from @tests', () => {
    expect(mockRuntime).toBeDefined();
    expect(typeof mockRuntime.sendMessage).toBe('function');
  });
});
