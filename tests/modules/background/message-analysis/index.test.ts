import { getPhrasesFromStorage } from '@src/modules/background/config';
import {
  determineMergeStatus,
  getCurrentMergeStatusFromMessages,
} from '@src/modules/background/message-analysis';
import { MERGE_STATUS } from '@src/modules/common/constants';
import { ProcessedMessage } from '@src/modules/common/types/app';
import { Mock, beforeEach, describe, expect, test, vi } from 'vitest';

// Import the actual function from the module being mocked

// Mock chrome.storage.local
const mockChromeStorageLocalGet = vi.fn();
vi.stubGlobal('chrome', {
  storage: {
    local: {
      get: mockChromeStorageLocalGet,
    },
  },
});

// Mock the entire module. Vitest will automatically mock its exports.
vi.mock('@src/modules/background/config');

describe('Message Analysis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChromeStorageLocalGet.mockResolvedValue({
      messages: [],
    });
    // Now, directly use the imported and mocked function
    (getPhrasesFromStorage as Mock).mockResolvedValue({
      currentAllowedPhrases: ['allowed'],
      currentDisallowedPhrases: ['disallowed'],
      currentExceptionPhrases: ['exception'],
    });
  });

  describe('determineMergeStatus', () => {
    const mockMessage1: ProcessedMessage = {
      text: 'This is a test message.',
      ts: '1678886401.000',
      user: 'user1',
    };
    const mockMessage2: ProcessedMessage = {
      text: 'Another message here.',
      ts: '1678886402.000',
      user: 'user2',
    };

    const defaultPhrases = {
      allowedPhrases: ['allowed'],
      disallowedPhrases: ['disallowed'],
      exceptionPhrases: ['exception'],
    };

    test('should return UNKNOWN if no matching phrases are found', () => {
      const result = determineMergeStatus({
        messages: [mockMessage1, mockMessage2],
        ...defaultPhrases,
      });
      expect(result).toEqual({ status: MERGE_STATUS.UNKNOWN, message: null });
    });

    test('should return EXCEPTION if an exception phrase is found in messages (including canvas)', () => {
      const messagesWithException: ProcessedMessage[] = [
        {
          text: 'This message has an exception.',
          ts: '1678886403.000',
          user: 'user3',
        },
        mockMessage1,
      ];
      const result = determineMergeStatus({
        messages: messagesWithException,
        ...defaultPhrases,
      });
      expect(result).toEqual({
        status: MERGE_STATUS.EXCEPTION,
        message: messagesWithException[0],
      });
    });

    test('should return DISALLOWED if a disallowed phrase is found in messages (including canvas)', () => {
      const messagesWithDisallowed: ProcessedMessage[] = [
        {
          text: 'This message is disallowed.',
          ts: '1678886403.000',
          user: 'user3',
        },
        mockMessage1,
      ];
      const result = determineMergeStatus({
        messages: messagesWithDisallowed,
        ...defaultPhrases,
      });
      expect(result).toEqual({
        status: MERGE_STATUS.DISALLOWED,
        message: messagesWithDisallowed[0],
      });
    });

    test('should return ALLOWED if an allowed phrase is found in messages (including canvas)', () => {
      const messagesWithAllowed: ProcessedMessage[] = [
        { text: 'This message is allowed.', ts: '1678886403.000', user: 'user3' },
        mockMessage1,
      ];
      const result = determineMergeStatus({
        messages: messagesWithAllowed,
        ...defaultPhrases,
      });
      expect(result).toEqual({
        status: MERGE_STATUS.ALLOWED,
        message: messagesWithAllowed[0],
      });
    });

    test('should prioritize exception over disallowed in messages', () => {
      const messages: ProcessedMessage[] = [
        { text: 'exception and disallowed', ts: '1678886403.000', user: 'user3' },
      ];
      const result = determineMergeStatus({
        messages: messages,
        ...defaultPhrases,
      });
      expect(result).toEqual({
        status: MERGE_STATUS.EXCEPTION,
        message: messages[0],
      });
    });

    test('should prioritize disallowed over allowed in messages', () => {
      const messages: ProcessedMessage[] = [
        { text: 'disallowed and allowed', ts: '1678886403.000', user: 'user3' },
      ];
      const result = determineMergeStatus({
        messages: messages,
        ...defaultPhrases,
      });
      expect(result).toEqual({
        status: MERGE_STATUS.DISALLOWED,
        message: messages[0],
      });
    });

    test('should handle empty messages array', () => {
      const result = determineMergeStatus({
        messages: [],
        ...defaultPhrases,
      });
      expect(result).toEqual({ status: MERGE_STATUS.UNKNOWN, message: null });
    });

    test('should handle empty phrases arrays', () => {
      const result = determineMergeStatus({
        messages: [mockMessage1],
        allowedPhrases: [],
        disallowedPhrases: [],
        exceptionPhrases: [],
      });
      expect(result).toEqual({ status: MERGE_STATUS.UNKNOWN, message: null });
    });

    test('should prioritize the most recent message (highest ts) if multiple matches exist', () => {
      const messages: ProcessedMessage[] = [
        { text: 'This is allowed', ts: '1678886400.000', user: 'userA' },
        { text: 'This is disallowed', ts: '1678886405.000', user: 'userB' },
        { text: 'This is an exception', ts: '1678886410.000', user: 'userC' },
      ];

      const result = determineMergeStatus({
        messages: messages.sort((a, b) => Number(b.ts) - Number(a.ts)), // Ensure messages are sorted by ts descending
        ...defaultPhrases,
      });

      // The most recent message (highest ts) with a matching phrase should determine the status
      expect(result).toEqual({
        status: MERGE_STATUS.EXCEPTION,
        message: messages[0], // The exception message is the most recent
      });
    });

    test('should correctly identify canvas content as the source if it is the most recent and matches', () => {
      const canvasMessage: ProcessedMessage = {
        text: 'This canvas is disallowed.',
        ts: '1678886415.000', // More recent than other messages
        user: 'canvas',
      };
      const messages: ProcessedMessage[] = [
        { text: 'This is allowed', ts: '1678886400.000', user: 'userA' },
        canvasMessage,
        { text: 'This is an exception', ts: '1678886410.000', user: 'userC' },
      ];

      const result = determineMergeStatus({
        messages: messages.sort((a, b) => Number(b.ts) - Number(a.ts)), // Ensure messages are sorted by ts descending
        ...defaultPhrases,
      });

      expect(result).toEqual({
        status: MERGE_STATUS.DISALLOWED,
        message: canvasMessage,
      });
    });
  });

  describe('getCurrentMergeStatusFromMessages', () => {
    test('should return UNKNOWN if no messages are stored', async () => {
      mockChromeStorageLocalGet.mockResolvedValue({ messages: [] });
      const status = await getCurrentMergeStatusFromMessages();
      expect(status).toBe(MERGE_STATUS.UNKNOWN);
    });

    test('should return correct status based on stored messages', async () => {
      mockChromeStorageLocalGet.mockResolvedValue({
        messages: [{ text: 'This message is allowed.', ts: '1', user: 'user1' }],
      });
      (getPhrasesFromStorage as Mock).mockResolvedValue({
        currentAllowedPhrases: ['allowed'],
        currentDisallowedPhrases: ['disallowed'],
        currentExceptionPhrases: ['exception'],
      });
      const status = await getCurrentMergeStatusFromMessages();
      expect(status).toBe(MERGE_STATUS.ALLOWED);
    });

    test('should return correct status based on stored messages with exception', async () => {
      mockChromeStorageLocalGet.mockResolvedValue({
        messages: [{ text: 'This message has an exception.', ts: '1', user: 'user1' }],
      });
      (getPhrasesFromStorage as Mock).mockResolvedValue({
        currentAllowedPhrases: ['allowed'],
        currentDisallowedPhrases: ['disallowed'],
        currentExceptionPhrases: ['exception'],
      });
      const status = await getCurrentMergeStatusFromMessages();
      expect(status).toBe(MERGE_STATUS.EXCEPTION);
    });

    test('should return correct status based on stored messages with disallowed', async () => {
      mockChromeStorageLocalGet.mockResolvedValue({
        messages: [{ text: 'This message is disallowed.', ts: '1', user: 'user1' }],
      });
      (getPhrasesFromStorage as Mock).mockResolvedValue({
        currentAllowedPhrases: ['allowed'],
        currentDisallowedPhrases: ['disallowed'],
        currentExceptionPhrases: ['exception'],
      });
      const status = await getCurrentMergeStatusFromMessages();
      expect(status).toBe(MERGE_STATUS.DISALLOWED);
    });
  });
});
