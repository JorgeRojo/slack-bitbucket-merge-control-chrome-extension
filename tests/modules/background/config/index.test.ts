import { getPhrasesFromStorage } from '@src/modules/background/config';
import { mockStorage } from '@tests/setup';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

describe('Config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getPhrasesFromStorage', () => {
    test('should return phrases from storage when available', async () => {
      mockStorage.sync.get.mockResolvedValueOnce({
        allowedPhrases: 'allowed1,allowed2',
        disallowedPhrases: 'disallowed1,disallowed2',
        exceptionPhrases: 'exception1,exception2',
      });

      const result = await getPhrasesFromStorage();

      expect(result.currentAllowedPhrases).toContain('allowed1');
      expect(result.currentAllowedPhrases).toContain('allowed2');
      expect(result.currentDisallowedPhrases).toContain('disallowed1');
      expect(result.currentDisallowedPhrases).toContain('disallowed2');
      expect(result.currentExceptionPhrases).toContain('exception1');
      expect(result.currentExceptionPhrases).toContain('exception2');
    });

    test('should return default phrases when storage is empty', async () => {
      mockStorage.sync.get.mockResolvedValueOnce({});

      const result = await getPhrasesFromStorage();

      // Verify that the result contains at least some of the default phrases
      expect(result.currentAllowedPhrases.length).toBeGreaterThan(0);
      expect(result.currentDisallowedPhrases.length).toBeGreaterThan(0);
      expect(result.currentExceptionPhrases.length).toBeGreaterThan(0);
    });

    test('should return default phrases when storage values are empty strings', async () => {
      mockStorage.sync.get.mockResolvedValueOnce({
        allowedPhrases: '',
        disallowedPhrases: '',
        exceptionPhrases: '',
      });

      const result = await getPhrasesFromStorage();

      // Verify that the result contains at least some of the default phrases
      expect(result.currentAllowedPhrases.length).toBeGreaterThan(0);
      expect(result.currentDisallowedPhrases.length).toBeGreaterThan(0);
      expect(result.currentExceptionPhrases.length).toBeGreaterThan(0);
    });

    test('should handle errors and return default phrases', async () => {
      mockStorage.sync.get.mockRejectedValueOnce(new Error('Storage error'));

      const result = await getPhrasesFromStorage();

      // Verify that the result contains at least some of the default phrases
      expect(result.currentAllowedPhrases.length).toBeGreaterThan(0);
      expect(result.currentDisallowedPhrases.length).toBeGreaterThan(0);
      expect(result.currentExceptionPhrases.length).toBeGreaterThan(0);
    });
  });
});
