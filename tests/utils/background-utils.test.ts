import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import {
  cleanSlackMessageText,
  determineMergeStatus,
  updateExtensionIcon,
  handleSlackApiError,
  updateAppStatus,
  updateIconBasedOnCurrentMessages,
  getPhrasesFromStorage,
  processAndStoreMessage,
} from '../../src/modules/background/utils/background-utils';
import { MERGE_STATUS, APP_STATUS, ERROR_MESSAGES } from '../../src/modules/common/constants';
import { ProcessedMessage } from '../../src/modules/common/types/app';
import { SlackMessage } from '../../src/modules/common/types/slack';
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
global.chrome = mockChrome as any;
vi.mock('../../src/utils/logger', () => ({
  Logger: {
    log: vi.fn(),
    error: vi.fn(),
  },
}));
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
    mockChrome.storage.local.get.mockResolvedValue({});
    mockChrome.storage.sync.get.mockResolvedValue({});
    mockChrome.storage.local.set.mockResolvedValue({});
  });
  afterEach(() => {
    vi.resetAllMocks();
  });
  describe('cleanSlackMessageText', () => {
    test('should clean Slack message text by removing formatting, mentions, etc.', () => {
      expect(cleanSlackMessageText('<@U123456> Hello <#C123456|channel>')).toBe(
        '@MENTION Hello @CHANNEL'
      );
      expect(cleanSlackMessageText('Check this link: <https://example.com>')).toBe(
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
      const disallowedResult = determineMergeStatus({
        messages,
        allowedPhrases: ['allow', 'proceed'],
        disallowedPhrases: ['do not merge', 'block'],
        exceptionPhrases: ['exception'],
      });
      expect(disallowedResult.status).toBe(MERGE_STATUS.DISALLOWED);
      expect(disallowedResult.message).toBe(messages[1]);
      const allowedResult = determineMergeStatus({
        messages: [messages[2], messages[0]],
        allowedPhrases: ['allow', 'proceed'],
        disallowedPhrases: ['do not merge', 'block'],
        exceptionPhrases: ['exception'],
      });
      expect(allowedResult.status).toBe(MERGE_STATUS.ALLOWED);
      expect(allowedResult.message).toBe(messages[2]);
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
      mockChrome.storage.local.set.mockClear();
      const secondResult = await updateAppStatus(APP_STATUS.OK);
      expect(secondResult).toBe(false);
      expect(mockChrome.storage.local.set).not.toHaveBeenCalled();
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
  describe('updateIconBasedOnCurrentMessages', () => {
    test('should update icon based on current messages', async () => {
      mockChrome.storage.local.get.mockImplementation(key => {
        if (key === 'messages') {
          return Promise.resolve({
            messages: [
              { text: 'Do not merge this PR', ts: '1234567891', user: 'U123', matchType: null },
            ],
          });
        }
        return Promise.resolve({});
      });
      mockChrome.storage.sync.get.mockResolvedValue({
        allowedPhrases: 'allow,proceed',
        disallowedPhrases: 'do not merge,block',
        exceptionPhrases: 'exception',
      });
      await updateIconBasedOnCurrentMessages();
      expect(mockChrome.action.setIcon).toHaveBeenCalledWith(
        expect.objectContaining({
          path: expect.objectContaining({
            16: 'images/icon16_disabled.png',
            48: 'images/icon48_disabled.png',
          }),
        })
      );
    });
    test('should handle empty messages', async () => {
      mockChrome.storage.local.get.mockResolvedValue({ messages: [] });
      await updateIconBasedOnCurrentMessages();
      expect(mockChrome.action.setIcon).toHaveBeenCalledWith(
        expect.objectContaining({
          path: expect.objectContaining({
            16: 'images/icon16.png',
            48: 'images/icon48.png',
          }),
        })
      );
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
      expect(phrases.currentAllowedPhrases).toEqual([
        'allowed to merge',
        'no restrictions on merging.',
      ]);
      expect(phrases.currentDisallowedPhrases).toEqual([
        'not allowed to merge',
        'do not merge without consent',
        'closing versions. do not merge',
        'ask me before merging',
        'not merge anything',
      ]);
      expect(phrases.currentExceptionPhrases).toEqual([
        'allowed to merge this task',
        'except everything related to',
        'allowed to merge in all projects except',
        'merge is allowed except',
        'do not merge these projects',
        'you can merge:',
        'do not merge in',
      ]);
    });
    test('should handle empty strings in storage', async () => {
      mockChrome.storage.sync.get.mockResolvedValue({
        allowedPhrases: '',
        disallowedPhrases: '',
        exceptionPhrases: '',
      });
      const phrases = await getPhrasesFromStorage();
      expect(phrases.currentAllowedPhrases).toEqual([
        'allowed to merge',
        'no restrictions on merging.',
      ]);
      expect(phrases.currentDisallowedPhrases).toEqual([
        'not allowed to merge',
        'do not merge without consent',
        'closing versions. do not merge',
        'ask me before merging',
        'not merge anything',
      ]);
      expect(phrases.currentExceptionPhrases).toEqual([
        'allowed to merge this task',
        'except everything related to',
        'allowed to merge in all projects except',
        'merge is allowed except',
        'do not merge these projects',
        'you can merge:',
        'do not merge in',
      ]);
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
      expect(setCall[0].messages[0].ts).toBe('1234567891');
      expect(setCall[0].messages[1].ts).toBe('1234567890');
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
      const invalidMessage1: any = { user: 'U123' };
      const invalidMessage2: any = { ts: '1234567890' };
      await processAndStoreMessage(invalidMessage1);
      await processAndStoreMessage(invalidMessage2);
      const setCalls = mockChrome.storage.local.set.mock.calls.filter(
        call => call[0].messages !== undefined
      );
      expect(setCalls).toHaveLength(0);
    });
  });
});
