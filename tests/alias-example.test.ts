import { MESSAGE_ACTIONS } from '@src/modules/common/constants';
import { Logger } from '@src/modules/common/utils/Logger';
import { describe, expect, test } from 'vitest';

describe('Alias Example Tests', () => {
  test('should import modules using @src alias', () => {
    expect(MESSAGE_ACTIONS).toBeDefined();
    expect(Logger).toBeDefined();
  });
});
