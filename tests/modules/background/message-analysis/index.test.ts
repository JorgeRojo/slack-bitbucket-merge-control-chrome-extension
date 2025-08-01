import { determineMergeStatus } from '@src/modules/background/message-analysis';
import { MERGE_STATUS } from '@src/modules/common/constants';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// Mock dependencies
vi.mock('@src/modules/background/config', () => ({
  getPhrasesFromStorage: vi.fn(),
}));

describe('Message Analysis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('determineMergeStatus', () => {
    const allowedPhrases = ['allowed'];
    const disallowedPhrases = ['disallowed'];
    const exceptionPhrases = ['exception'];

    test('should return EXCEPTION from canvas if matching exception phrase', () => {
      const result = determineMergeStatus({
        messages: [],
        allowedPhrases,
        disallowedPhrases,
        exceptionPhrases,
        canvasContent: 'This is an exception',
      });
      expect(result.status).toBe(MERGE_STATUS.EXCEPTION);
      expect(result.source).toBe('canvas');
      expect(result.message).toBeNull();
      expect(result.canvasContent).toBe('This is an exception');
    });

    test('should return DISALLOWED from canvas if matching disallowed phrase', () => {
      const result = determineMergeStatus({
        messages: [],
        allowedPhrases,
        disallowedPhrases,
        exceptionPhrases,
        canvasContent: 'This is disallowed',
      });
      expect(result.status).toBe(MERGE_STATUS.DISALLOWED);
      expect(result.source).toBe('canvas');
      expect(result.message).toBeNull();
      expect(result.canvasContent).toBe('This is disallowed');
    });

    test('should return ALLOWED from canvas if matching allowed phrase', () => {
      const result = determineMergeStatus({
        messages: [],
        allowedPhrases,
        disallowedPhrases,
        exceptionPhrases,
        canvasContent: 'This is allowed',
      });
      expect(result.status).toBe(MERGE_STATUS.ALLOWED);
      expect(result.source).toBe('canvas');
      expect(result.message).toBeNull();
      expect(result.canvasContent).toBe('This is allowed');
    });

    test('should return EXCEPTION from message if matching exception phrase', () => {
      const messages = [{ text: 'This is an exception', ts: '123', user: 'U123', matchType: null }];
      const result = determineMergeStatus({
        messages,
        allowedPhrases,
        disallowedPhrases,
        exceptionPhrases,
      });
      expect(result.status).toBe(MERGE_STATUS.EXCEPTION);
      expect(result.source).toBe('message');
      expect(result.message).toEqual(messages[0]);
    });

    test('should return DISALLOWED from message if matching disallowed phrase', () => {
      const messages = [{ text: 'This is disallowed', ts: '123', user: 'U123', matchType: null }];
      const result = determineMergeStatus({
        messages,
        allowedPhrases,
        disallowedPhrases,
        exceptionPhrases,
      });
      expect(result.status).toBe(MERGE_STATUS.DISALLOWED);
      expect(result.source).toBe('message');
      expect(result.message).toEqual(messages[0]);
    });

    test('should return ALLOWED from message if matching allowed phrase', () => {
      const messages = [{ text: 'This is allowed', ts: '123', user: 'U123', matchType: null }];
      const result = determineMergeStatus({
        messages,
        allowedPhrases,
        disallowedPhrases,
        exceptionPhrases,
      });
      expect(result.status).toBe(MERGE_STATUS.ALLOWED);
      expect(result.source).toBe('message');
      expect(result.message).toEqual(messages[0]);
    });

    test('should return UNKNOWN if no matching phrases', () => {
      const messages = [
        { text: 'No matching phrases here', ts: '123', user: 'U123', matchType: null },
      ];
      const result = determineMergeStatus({
        messages,
        allowedPhrases,
        disallowedPhrases,
        exceptionPhrases,
      });
      expect(result.status).toBe(MERGE_STATUS.UNKNOWN);
      expect(result.source).toBe('message');
      expect(result.message).toBeNull();
    });

    test('should prioritize exception over disallowed and allowed phrases', () => {
      const messages = [
        {
          text: 'This contains exception and disallowed and allowed',
          ts: '123',
          user: 'U123',
          matchType: null,
        },
      ];
      const result = determineMergeStatus({
        messages,
        allowedPhrases,
        disallowedPhrases,
        exceptionPhrases,
      });
      expect(result.status).toBe(MERGE_STATUS.EXCEPTION);
      expect(result.source).toBe('message');
      expect(result.message).toEqual(messages[0]);
    });

    test('should prioritize disallowed over allowed phrases', () => {
      const messages = [
        {
          text: 'This contains disallowed and allowed',
          ts: '123',
          user: 'U123',
          matchType: null,
        },
      ];
      const result = determineMergeStatus({
        messages,
        allowedPhrases,
        disallowedPhrases,
        exceptionPhrases,
      });
      expect(result.status).toBe(MERGE_STATUS.DISALLOWED);
      expect(result.source).toBe('message');
      expect(result.message).toEqual(messages[0]);
    });
  });
});
