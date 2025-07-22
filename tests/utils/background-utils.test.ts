import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import {
  normalizeText,
  cleanSlackMessageText,
  determineMergeStatus,
  updateExtensionIcon,
  handleSlackApiError,
  updateAppStatus,
  getCurrentMergeStatusFromMessages,
  updateIconBasedOnCurrentMessages,
  getPhrasesFromStorage,
  processAndStoreMessage,
} from '../../src/utils/background-utils';
import { MERGE_STATUS, APP_STATUS, ERROR_MESSAGES } from '../../src/constants';
import { ProcessedMessage } from '../../src/types';
import { SlackMessage } from '../../src/types/slack';

// Mock Chrome API
const mockChrome = {
  action: {
    setIcon: vi.fn(),
  },
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
    },
    sync: {
      get: vi.fn(),
    },
  },
};

// Setup global chrome object
global.chrome = mockChrome as any;

// Mock Logger
vi.mock('../../src/utils/logger', () => ({
  Logger: {
    log: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock constants import
vi.mock('../../src/constants', async () => {
  const actual = await vi.importActual('../../src/constants');
  return {
    ...actual,
    DEFAULT_ALLOWED_PHRASES: ['allow', 'proceed', 'merge'],
    DEFAULT_DISALLOWED_PHRASES: ['block', 'stop', 'do not merge'],
    DEFAULT_EXCEPTION_PHRASES: ['exception', 'override'],
    MAX_MESSAGES: 50,
  };
});

describe('Background Utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock responses
    mockChrome.storage.local.get.mockResolvedValue({});
    mockChrome.storage.sync.get.mockResolvedValue({});
    mockChrome.storage.local.set.mockResolvedValue();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('normalizeText', () => {
    test('should normalize text by removing diacritical marks and standardizing whitespace', () => {
      expect(normalizeText('  Héllò   Wórld  ')).toBe('hello world');
      expect(normalizeText('DO NOT MERGE!!!')).toBe('do not merge!!!');
      expect(normalizeText('áéíóú')).toBe('aeiou');
      expect(normalizeText(undefined)).toBe('');
    });
  });

  describe('cleanSlackMessageText', () => {
    test('should clean Slack message text by removing formatting, mentions, etc.', () => {
      expect(cleanSlackMessageText('<@U123456> Hello <#C123456|channel>')).toBe(
        '@MENTION Hello @CHANNEL'
      );
      expect(cleanSlackMessageText('Check this link: <https://example.com|Example>')).toBe(
        'Check this link:'
      );
      expect(cleanSlackMessageText('Line 1\nLine 2\tTab')).toBe('Line 1 Line 2 Tab');
      expect(cleanSlackMessageText(undefined)).toBe('');
    });
  });

  describe('determineMergeStatus', () => {
    test('should determine merge status based on message content and configured phrases', () => {
      const messages: ProcessedMessage[] = [
        { text: 'This is a normal message', ts: '1234567890', user: 'U123', matchType: null },
        { text: 'Do not merge this PR', ts: '1234567891', user: 'U123', matchType: null },
        { text: 'Allow this merge', ts: '1234567892', user: 'U123', matchType: null },
      ];

      // Test disallowed phrase match
      const disallowedResult = determineMergeStatus({
        messages,
        allowedPhrases: ['allow', 'proceed'],
        disallowedPhrases: ['do not merge', 'block'],
        exceptionPhrases: ['exception'],
      });
      expect(disallowedResult.status).toBe(MERGE_STATUS.DISALLOWED);
      expect(disallowedResult.message).toBe(messages[1]);

      // Test allowed phrase match
      const allowedResult = determineMergeStatus({
        messages: [messages[2], messages[0]],
        allowedPhrases: ['allow', 'proceed'],
        disallowedPhrases: ['do not merge', 'block'],
        exceptionPhrases: ['exception'],
      });
      expect(allowedResult.status).toBe(MERGE_STATUS.ALLOWED);
      expect(allowedResult.message).toBe(messages[2]);

      // Test exception phrase match
      const exceptionResult = determineMergeStatus({
        messages: [
          { text: 'Exception to the rule', ts: '1234567893', user: 'U123', matchType: null },
          ...messages,
        ],
        allowedPhrases: ['allow', 'proceed'],
        disallowedPhrases: ['do not merge', 'block'],
        exceptionPhrases: ['exception'],
      });
      expect(exceptionResult.status).toBe(MERGE_STATUS.EXCEPTION);
      expect(exceptionResult.message?.text).toContain('Exception');

      // Test no match
      const noMatchResult = determineMergeStatus({
        messages: [
          { text: 'No matching phrases here', ts: '1234567894', user: 'U123', matchType: null },
        ],
        allowedPhrases: ['allow', 'proceed'],
        disallowedPhrases: ['do not merge', 'block'],
        exceptionPhrases: ['exception'],
      });
      expect(noMatchResult.status).toBe(MERGE_STATUS.UNKNOWN);
      expect(noMatchResult.message).toBeNull();

      // Test empty messages
      const emptyResult = determineMergeStatus({
        messages: [],
        allowedPhrases: ['allow', 'proceed'],
        disallowedPhrases: ['do not merge', 'block'],
        exceptionPhrases: ['exception'],
      });
      expect(emptyResult.status).toBe(MERGE_STATUS.UNKNOWN);
      expect(emptyResult.message).toBeNull();
    });
  });

  describe('updateExtensionIcon', () => {
    test('should update the extension icon based on the current status', () => {
      updateExtensionIcon(MERGE_STATUS.LOADING);
      expect(mockChrome.action.setIcon).toHaveBeenCalledWith({
        path: {
          16: 'images/icon16.png',
          48: 'images/icon48.png',
        },
      });

      updateExtensionIcon(MERGE_STATUS.ALLOWED);
      expect(mockChrome.action.setIcon).toHaveBeenCalledWith({
        path: {
          16: 'images/icon16_enabled.png',
          48: 'images/icon48_enabled.png',
        },
      });

      updateExtensionIcon(MERGE_STATUS.DISALLOWED);
      expect(mockChrome.action.setIcon).toHaveBeenCalledWith({
        path: {
          16: 'images/icon16_disabled.png',
          48: 'images/icon48_disabled.png',
        },
      });

      updateExtensionIcon(MERGE_STATUS.EXCEPTION);
      expect(mockChrome.action.setIcon).toHaveBeenCalledWith({
        path: {
          16: 'images/icon16_exception.png',
          48: 'images/icon48_exception.png',
        },
      });

      updateExtensionIcon(MERGE_STATUS.ERROR);
      expect(mockChrome.action.setIcon).toHaveBeenCalledWith({
        path: {
          16: 'images/icon16_error.png',
          48: 'images/icon48_error.png',
        },
      });

      updateExtensionIcon(MERGE_STATUS.UNKNOWN);
      expect(mockChrome.action.setIcon).toHaveBeenCalledWith({
        path: {
          16: 'images/icon16.png',
          48: 'images/icon48.png',
        },
      });
    });
  });

  describe('handleSlackApiError', () => {
    test('should handle channel not found error', async () => {
      mockChrome.storage.local.get.mockResolvedValue({ lastKnownMergeState: {} });

      await handleSlackApiError(new Error(ERROR_MESSAGES.CHANNEL_NOT_FOUND));

      expect(mockChrome.storage.local.set).toHaveBeenCalledWith({
        channelId: null,
      });
      expect(mockChrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          lastKnownMergeState: expect.objectContaining({
            appStatus: APP_STATUS.CHANNEL_NOT_FOUND,
          }),
        })
      );
    });

    test('should handle not in channel error', async () => {
      mockChrome.storage.local.get.mockResolvedValue({ lastKnownMergeState: {} });

      await expect(
        handleSlackApiError(new Error(ERROR_MESSAGES.NOT_IN_CHANNEL))
      ).resolves.not.toThrow();

      // Should call storage.local.set at least once
      expect(mockChrome.storage.local.set).toHaveBeenCalled();
    });

    test('should handle invalid auth error', async () => {
      mockChrome.storage.local.get.mockResolvedValue({ lastKnownMergeState: {} });

      await handleSlackApiError(new Error(ERROR_MESSAGES.INVALID_AUTH));

      expect(mockChrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          lastKnownMergeState: expect.objectContaining({
            appStatus: APP_STATUS.TOKEN_ERROR,
          }),
        })
      );
    });

    test('should handle token revoked error', async () => {
      mockChrome.storage.local.get.mockResolvedValue({ lastKnownMergeState: {} });

      await expect(
        handleSlackApiError(new Error(ERROR_MESSAGES.TOKEN_REVOKED))
      ).resolves.not.toThrow();
    });

    test('should handle unknown error', async () => {
      mockChrome.storage.local.get.mockResolvedValue({ lastKnownMergeState: {} });

      await handleSlackApiError(new Error('Some unknown error'));

      expect(mockChrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          lastKnownMergeState: expect.objectContaining({
            appStatus: APP_STATUS.UNKNOWN_ERROR,
          }),
        })
      );
    });

    test('should handle non-Error objects', async () => {
      mockChrome.storage.local.get.mockResolvedValue({ lastKnownMergeState: {} });

      await expect(handleSlackApiError('String error')).resolves.not.toThrow();
    });
  });

  describe('updateAppStatus', () => {
    test('should update app status and icon', async () => {
      mockChrome.storage.local.get.mockResolvedValue({ lastKnownMergeState: {} });

      const result = await updateAppStatus(APP_STATUS.OK);
      expect(result).toBe(true);
      expect(mockChrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          lastKnownMergeState: expect.objectContaining({
            appStatus: APP_STATUS.OK,
          }),
        })
      );

      // Test that calling with the same status doesn't update
      mockChrome.storage.local.set.mockClear();
      const secondResult = await updateAppStatus(APP_STATUS.OK);
      expect(secondResult).toBe(false);
      expect(mockChrome.storage.local.set).not.toHaveBeenCalled();

      // Test error status
      mockChrome.storage.local.set.mockClear();
      await updateAppStatus(APP_STATUS.TOKEN_ERROR);
      expect(mockChrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          lastKnownMergeState: expect.objectContaining({
            appStatus: APP_STATUS.TOKEN_ERROR,
          }),
        })
      );
      expect(mockChrome.action.setIcon).toHaveBeenCalledWith(
        expect.objectContaining({
          path: expect.objectContaining({
            16: 'images/icon16_error.png',
          }),
        })
      );
    });
  });

  describe('getCurrentMergeStatusFromMessages', () => {
    test('should return UNKNOWN when no messages', async () => {
      mockChrome.storage.local.get.mockResolvedValue({ messages: [] });
      const status = await getCurrentMergeStatusFromMessages();
      expect(status).toBe(MERGE_STATUS.UNKNOWN);
    });

    test('should determine status from messages', async () => {
      mockChrome.storage.local.get.mockResolvedValue({
        messages: [
          { text: 'Do not merge this PR', ts: '1234567891', user: 'U123', matchType: null },
        ],
      });
      mockChrome.storage.sync.get.mockResolvedValue({
        allowedPhrases: 'allow,proceed',
        disallowedPhrases: 'do not merge,block',
        exceptionPhrases: 'exception',
      });

      const status = await getCurrentMergeStatusFromMessages();
      expect(status).toBe(MERGE_STATUS.DISALLOWED);
    });
  });

  describe('getPhrasesFromStorage', () => {
    test('should get phrases from storage', async () => {
      mockChrome.storage.sync.get.mockResolvedValue({
        allowedPhrases: 'custom1,custom2',
        disallowedPhrases: 'block1,block2',
        exceptionPhrases: 'exception1,exception2',
      });

      const phrases = await getPhrasesFromStorage();
      expect(phrases.currentAllowedPhrases).toEqual(['custom1', 'custom2']);
      expect(phrases.currentDisallowedPhrases).toEqual(['block1', 'block2']);
      expect(phrases.currentExceptionPhrases).toEqual(['exception1', 'exception2']);
    });

    test('should use default phrases when not in storage', async () => {
      mockChrome.storage.sync.get.mockResolvedValue({});

      const phrases = await getPhrasesFromStorage();
      expect(phrases.currentAllowedPhrases).toEqual(['allow', 'proceed', 'merge']);
      expect(phrases.currentDisallowedPhrases).toEqual(['block', 'stop', 'do not merge']);
      expect(phrases.currentExceptionPhrases).toEqual(['exception', 'override']);
    });

    test('should handle empty strings in storage', async () => {
      mockChrome.storage.sync.get.mockResolvedValue({
        allowedPhrases: '',
        disallowedPhrases: '',
        exceptionPhrases: '',
      });

      const phrases = await getPhrasesFromStorage();
      // Empty strings should use default phrases, not create arrays with empty strings
      expect(phrases.currentAllowedPhrases).toEqual(['allow', 'proceed', 'merge']);
      expect(phrases.currentDisallowedPhrases).toEqual(['block', 'stop', 'do not merge']);
      expect(phrases.currentExceptionPhrases).toEqual(['exception', 'override']);
    });
  });

  describe('processAndStoreMessage', () => {
    test('should process and store a new message', async () => {
      mockChrome.storage.local.get.mockResolvedValue({ messages: [] });
      mockChrome.storage.sync.get.mockResolvedValue({
        allowedPhrases: 'allow,proceed',
        disallowedPhrases: 'block,stop',
        exceptionPhrases: 'exception',
      });

      const message: SlackMessage = {
        text: 'New message',
        ts: '1234567890',
        user: 'U123',
      };

      await processAndStoreMessage(message);

      expect(mockChrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              text: 'New message',
              ts: '1234567890',
              user: 'U123',
            }),
          ]),
        })
      );
    });

    test('should not add duplicate messages', async () => {
      const existingMessage = {
        text: 'Existing message',
        ts: '1234567890',
        user: 'U123',
        matchType: null,
      };

      mockChrome.storage.local.get.mockResolvedValue({ messages: [existingMessage] });

      const message: SlackMessage = {
        text: 'New text for existing message',
        ts: '1234567890',
        user: 'U123',
      };

      await processAndStoreMessage(message);

      // Should not call set with messages since it's a duplicate
      const setCalls = mockChrome.storage.local.set.mock.calls.filter(
        call => call[0].messages !== undefined
      );
      expect(setCalls).toHaveLength(0);
    });

    test('should sort messages by timestamp', async () => {
      const oldMessage = {
        text: 'Old message',
        ts: '1234567890',
        user: 'U123',
        matchType: null,
      };

      mockChrome.storage.local.get.mockResolvedValue({ messages: [oldMessage] });
      mockChrome.storage.sync.get.mockResolvedValue({
        allowedPhrases: 'allow,proceed',
        disallowedPhrases: 'block,stop',
        exceptionPhrases: 'exception',
      });

      const newMessage: SlackMessage = {
        text: 'New message',
        ts: '1234567891',
        user: 'U123',
      };

      await processAndStoreMessage(newMessage);

      const setCall = mockChrome.storage.local.set.mock.calls.find(
        call => call[0].messages !== undefined
      );

      expect(setCall).toBeDefined();
      expect(setCall[0].messages[0].ts).toBe('1234567891'); // Newer message first
      expect(setCall[0].messages[1].ts).toBe('1234567890'); // Older message second
    });

    test('should limit the number of messages', async () => {
      const messages = Array.from({ length: 60 }, (_, i) => ({
        text: `Message ${i}`,
        ts: `${1234567890 + i}`,
        user: 'U123',
        matchType: null,
      }));

      mockChrome.storage.local.get.mockResolvedValue({ messages });
      mockChrome.storage.sync.get.mockResolvedValue({
        allowedPhrases: 'allow,proceed',
        disallowedPhrases: 'block,stop',
        exceptionPhrases: 'exception',
      });

      const newMessage: SlackMessage = {
        text: 'New message',
        ts: '9999999999',
        user: 'U123',
      };

      await processAndStoreMessage(newMessage);

      const setCall = mockChrome.storage.local.set.mock.calls.find(
        call => call[0].messages !== undefined
      );

      expect(setCall).toBeDefined();
      expect(setCall[0].messages.length).toBe(50);
      expect(setCall[0].messages[0].ts).toBe('9999999999');
    });

    test('should handle invalid messages', async () => {
      const invalidMessage1: any = { user: 'U123' }; // Missing ts
      const invalidMessage2: any = { ts: '1234567890' }; // Missing text

      await processAndStoreMessage(invalidMessage1);
      await processAndStoreMessage(invalidMessage2);

      // Should not call set with messages since messages are invalid
      const setCalls = mockChrome.storage.local.set.mock.calls.filter(
        call => call[0].messages !== undefined
      );
      expect(setCalls).toHaveLength(0);
    });
  });
});
