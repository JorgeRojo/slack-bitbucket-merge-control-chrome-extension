import { normalizeText } from '@src/modules/background/text-utils';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

describe('Text Utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('normalizeText', () => {
    test('should convert text to lowercase and remove diacritics', () => {
      const text = 'Héllö Wörld!';
      expect(normalizeText(text)).toBe('hello world');
    });

    test('should replace multiple whitespaces with single space', () => {
      const text = 'Hello   World';
      expect(normalizeText(text)).toBe('hello world');
    });

    test('should trim leading/trailing whitespaces', () => {
      const text = '  Hello World  ';
      expect(normalizeText(text)).toBe('hello world');
    });

    test('should handle empty string', () => {
      expect(normalizeText('')).toBe('');
    });

    test('should handle undefined input', () => {
      expect(normalizeText(undefined)).toBe('');
    });
  });
});
