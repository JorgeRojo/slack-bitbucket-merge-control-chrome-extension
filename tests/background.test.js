import { jest } from '@jest/globals';
import {
  cleanSlackMessageText,
  normalizeText,
  determineMergeStatus,
  updateExtensionIcon,
  getPhrasesFromStorage,
  scheduleFeatureReactivation,
  checkScheduledReactivation,
  reactivateFeature,
} from '../src/background.js';

// Mock chrome APIs
global.chrome = {
  action: {
    setIcon: jest.fn(),
  },
  storage: {
    sync: {
      get: jest.fn(),
    },
    local: {
      get: jest.fn(),
      set: jest.fn(),
    },
  },
  alarms: {
    create: jest.fn(),
    clear: jest.fn(),
  },
};

describe('Common Background Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('cleanSlackMessageText', () => {
    test('should replace user mentions with @MENTION', () => {
      const inputText = 'Hello <@U123456789>!';
      expect(cleanSlackMessageText(inputText)).toBe('Hello @MENTION!');
    });

    test('should remove named channel mentions', () => {
      const inputText = 'Check out <#C123456789|general> channel.';
      expect(cleanSlackMessageText(inputText)).toBe('Check out channel.');
    });

    test('should replace unnamed channel mentions with @CHANNEL', () => {
      const inputText = 'Please see <#C987654321> for details.';
      expect(cleanSlackMessageText(inputText)).toBe(
        'Please see @CHANNEL for details.',
      );
    });

    test('should remove special links', () => {
      const inputText = 'Visit <http://example.com|Example Website>.';
      expect(cleanSlackMessageText(inputText)).toBe('Visit .');
    });

    test('should remove any remaining <...>', () => {
      const inputText = 'Text with <unwanted> tags.';
      expect(cleanSlackMessageText(inputText)).toBe('Text with tags.');
    });

    test('should handle multiple types of cleaning in one string', () => {
      const inputText =
        'Hey <@U123>, check <#C456|general> about <http://foo.bar|link>.';
      expect(cleanSlackMessageText(inputText)).toBe(
        'Hey @MENTION, check about .',
      );
    });

    test('should return empty string for null, undefined or empty string input', () => {
      expect(cleanSlackMessageText(null)).toBe('');
      expect(cleanSlackMessageText(undefined)).toBe('');
      expect(cleanSlackMessageText('')).toBe('');
    });

    test('should handle text without any special Slack formatting', () => {
      const inputText = 'This is a regular message.';
      expect(cleanSlackMessageText(inputText)).toBe(
        'This is a regular message.',
      );
    });

    test('should handle line breaks and tabs', () => {
      const inputText = 'Line 1\nLine 2\tTabbed';
      expect(cleanSlackMessageText(inputText)).toBe('Line 1 Line 2 Tabbed');
    });

    test('should handle multiple whitespace characters', () => {
      const inputText = 'Text   with    multiple     spaces';
      expect(cleanSlackMessageText(inputText)).toBe(
        'Text with multiple spaces',
      );
    });

    test('should handle complex Slack formatting', () => {
      const complexText =
        'Check <@U123|user> in <#C456|channel> at <http://example.com|link> with <special> tags';
      const result = cleanSlackMessageText(complexText);
      expect(result).toBe('Check @MENTION in at with tags');
    });
  });

  describe('normalizeText', () => {
    test('should convert text to lowercase and trim whitespace', () => {
      expect(normalizeText('  Hello World  ')).toBe('hello world');
    });

    test('should replace multiple spaces with a single space', () => {
      expect(normalizeText('Hello   World')).toBe('hello world');
    });

    test('should remove diacritic marks', () => {
      expect(normalizeText('Héllö Wörld')).toBe('hello world');
    });

    test('should handle mixed case and extra spaces', () => {
      expect(normalizeText('  TEST  string   with   spaces  ')).toBe(
        'test string with spaces',
      );
    });

    test('should return empty string for null, undefined or empty string input', () => {
      expect(normalizeText(null)).toBe('');
      expect(normalizeText(undefined)).toBe('');
      expect(normalizeText('')).toBe('');
    });

    test('should handle accented characters from different languages', () => {
      expect(normalizeText('Café résumé naïve')).toBe('cafe resume naive');
    });

    test('should handle special Unicode characters', () => {
      expect(normalizeText('Ñoño piñata')).toBe('nono pinata');
    });

    test('should handle empty strings and whitespace', () => {
      expect(normalizeText('   ')).toBe('');
      expect(normalizeText('\n\t\r')).toBe('');
      expect(normalizeText('  hello  world  ')).toBe('hello world');
    });
  });

  describe('determineMergeStatus', () => {
    const mockAllowedPhrases = ['allowed to merge'];
    const mockDisallowedPhrases = ['not allowed to merge'];
    const mockExceptionPhrases = ['except this project'];

    test('should return allowed status when allowed phrase is found', () => {
      const result = determineMergeStatus({
        messages: [{ text: 'allowed to merge this', ts: '123' }],
        allowedPhrases: mockAllowedPhrases,
        disallowedPhrases: mockDisallowedPhrases,
        exceptionPhrases: mockExceptionPhrases,
      });

      expect(result.status).toBe('allowed');
      expect(result.message.text).toBe('allowed to merge this');
    });

    test('should return disallowed status when disallowed phrase is found', () => {
      const result = determineMergeStatus({
        messages: [{ text: 'not allowed to merge anything', ts: '123' }],
        allowedPhrases: mockAllowedPhrases,
        disallowedPhrases: mockDisallowedPhrases,
        exceptionPhrases: mockExceptionPhrases,
      });

      expect(result.status).toBe('disallowed');
      expect(result.message.text).toBe('not allowed to merge anything');
    });

    test('should return exception status when exception phrase is found', () => {
      const result = determineMergeStatus({
        messages: [{ text: 'allowed to merge except this project', ts: '123' }],
        allowedPhrases: mockAllowedPhrases,
        disallowedPhrases: mockDisallowedPhrases,
        exceptionPhrases: mockExceptionPhrases,
      });

      expect(result.status).toBe('exception');
      expect(result.message.text).toBe('allowed to merge except this project');
    });

    test('should return unknown status when no phrases match', () => {
      const result = determineMergeStatus({
        messages: [{ text: 'just a regular message', ts: '123' }],
        allowedPhrases: mockAllowedPhrases,
        disallowedPhrases: mockDisallowedPhrases,
        exceptionPhrases: mockExceptionPhrases,
      });

      expect(result.status).toBe('unknown');
      expect(result.message).toBe(null);
    });

    test('should handle empty messages array', () => {
      const result = determineMergeStatus({
        messages: [],
        allowedPhrases: mockAllowedPhrases,
        disallowedPhrases: mockDisallowedPhrases,
        exceptionPhrases: mockExceptionPhrases,
      });

      expect(result.status).toBe('unknown');
      expect(result.message).toBe(null);
    });

    test('should process messages in array order', () => {
      const messages = [
        { text: 'old allowed to merge', ts: '1234567890.123' },
        { text: 'recent not allowed to merge', ts: '1234567891.123' },
      ];

      const result = determineMergeStatus({
        messages,
        allowedPhrases: mockAllowedPhrases,
        disallowedPhrases: mockDisallowedPhrases,
        exceptionPhrases: mockExceptionPhrases,
      });

      // Should return the first matching message (allowed)
      expect(result.status).toBe('allowed');
      expect(result.message.text).toBe('old allowed to merge');
    });

    test('should handle case insensitive matching', () => {
      const result = determineMergeStatus({
        messages: [{ text: 'ALLOWED TO MERGE this', ts: '123' }],
        allowedPhrases: mockAllowedPhrases,
        disallowedPhrases: mockDisallowedPhrases,
        exceptionPhrases: mockExceptionPhrases,
      });

      expect(result.status).toBe('allowed');
    });

    test('should handle empty phrase arrays', () => {
      const result = determineMergeStatus({
        messages: [{ text: 'some message', ts: '123' }],
        allowedPhrases: [],
        disallowedPhrases: [],
        exceptionPhrases: [],
      });

      expect(result.status).toBe('unknown');
    });

    test('should handle messages with special characters', () => {
      const messages = [{ text: 'Allowed to merge! 🎉 @everyone', ts: '123' }];
      const result = determineMergeStatus({
        messages,
        allowedPhrases: ['allowed to merge'],
        disallowedPhrases: ['not allowed'],
        exceptionPhrases: ['except'],
      });

      expect(result.status).toBe('allowed');
    });

    test('should prioritize exception over disallowed', () => {
      const messages = [
        { text: 'not allowed to merge except this project', ts: '123' },
      ];
      const result = determineMergeStatus({
        messages,
        allowedPhrases: ['allowed to merge'],
        disallowedPhrases: ['not allowed to merge'],
        exceptionPhrases: ['except this project'],
      });

      expect(result.status).toBe('exception');
    });

    test('should prioritize disallowed over allowed', () => {
      const messages = [
        { text: 'allowed to merge but not allowed to merge', ts: '123' },
      ];
      const result = determineMergeStatus({
        messages,
        allowedPhrases: ['allowed to merge'],
        disallowedPhrases: ['not allowed to merge'],
        exceptionPhrases: ['except'],
      });

      expect(result.status).toBe('disallowed');
    });
  });

  describe('updateExtensionIcon', () => {
    test('should set allowed icon for allowed status', () => {
      updateExtensionIcon('allowed');
      expect(chrome.action.setIcon).toHaveBeenCalledWith({
        path: {
          16: 'images/icon16_enabled.png',
          48: 'images/icon48_enabled.png',
        },
      });
    });

    test('should set disallowed icon for disallowed status', () => {
      updateExtensionIcon('disallowed');
      expect(chrome.action.setIcon).toHaveBeenCalledWith({
        path: {
          16: 'images/icon16_disabled.png',
          48: 'images/icon48_disabled.png',
        },
      });
    });

    test('should set exception icon for exception status', () => {
      updateExtensionIcon('exception');
      expect(chrome.action.setIcon).toHaveBeenCalledWith({
        path: {
          16: 'images/icon16_exception.png',
          48: 'images/icon48_exception.png',
        },
      });
    });

    test('should set error icon for error status', () => {
      updateExtensionIcon('error');
      expect(chrome.action.setIcon).toHaveBeenCalledWith({
        path: {
          16: 'images/icon16_error.png',
          48: 'images/icon48_error.png',
        },
      });
    });

    test('should set loading icon for loading status', () => {
      updateExtensionIcon('loading');
      expect(chrome.action.setIcon).toHaveBeenCalledWith({
        path: {
          16: 'images/icon16.png',
          48: 'images/icon48.png',
        },
      });
    });

    test('should set default icon for unknown status', () => {
      updateExtensionIcon('unknown');
      expect(chrome.action.setIcon).toHaveBeenCalledWith({
        path: {
          16: 'images/icon16.png',
          48: 'images/icon48.png',
        },
      });
    });

    test('should handle all status cases', () => {
      const statuses = [
        'allowed',
        'disallowed',
        'exception',
        'error',
        'loading',
        'unknown',
        'default',
        'invalid',
      ];

      statuses.forEach((status) => {
        jest.clearAllMocks();
        updateExtensionIcon(status);
        expect(chrome.action.setIcon).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('getPhrasesFromStorage', () => {
    test('should return stored phrases when available', async () => {
      const mockStoredData = {
        allowedPhrases: 'custom allowed,another allowed',
        disallowedPhrases: 'custom disallowed,another disallowed',
        exceptionPhrases: 'custom exception,another exception',
      };

      chrome.storage.sync.get.mockResolvedValue(mockStoredData);

      const result = await getPhrasesFromStorage();

      expect(chrome.storage.sync.get).toHaveBeenCalledWith([
        'allowedPhrases',
        'disallowedPhrases',
        'exceptionPhrases',
      ]);
      expect(result.currentAllowedPhrases).toEqual([
        'custom allowed',
        'another allowed',
      ]);
      expect(result.currentDisallowedPhrases).toEqual([
        'custom disallowed',
        'another disallowed',
      ]);
      expect(result.currentExceptionPhrases).toEqual([
        'custom exception',
        'another exception',
      ]);
    });

    test('should return default phrases when storage is empty', async () => {
      chrome.storage.sync.get.mockResolvedValue({});

      const result = await getPhrasesFromStorage();

      expect(result.currentAllowedPhrases).toEqual([
        'allowed to merge',
        'no restrictions on merging.',
      ]);
      expect(result.currentDisallowedPhrases).toEqual([
        'not allowed to merge',
        'do not merge without consent',
        'closing versions. do not merge',
        'ask me before merging',
      ]);
      expect(result.currentExceptionPhrases).toEqual([
        'allowed to merge this task',
        'except everything related to',
        'allowed to merge in all projects except',
        'merge is allowed except',
        'do not merge these projects',
        'you can merge:',
        'do not merge in',
      ]);
    });

    test('should handle empty string values', async () => {
      chrome.storage.sync.get.mockResolvedValue({
        allowedPhrases: '',
        disallowedPhrases: '',
        exceptionPhrases: '',
      });

      const result = await getPhrasesFromStorage();

      // Empty strings should fall back to defaults
      expect(result.currentAllowedPhrases).toEqual([
        'allowed to merge',
        'no restrictions on merging.',
      ]);
    });
  });

  describe('Feature reactivation functions', () => {
    beforeEach(() => {
      jest.spyOn(Date, 'now').mockReturnValue(1000000000000);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    describe('scheduleFeatureReactivation', () => {
      test('should schedule feature reactivation', async () => {
        await scheduleFeatureReactivation();

        expect(chrome.storage.local.set).toHaveBeenCalledWith({
          reactivationTime: 1000000000000 + 60000, // 1 minute later
        });
      });
    });

    describe('checkScheduledReactivation', () => {
      test('should reactivate feature when time has passed', async () => {
        chrome.storage.local.get.mockResolvedValue({
          reactivationTime: 999999999000, // 1 second ago
          featureEnabled: false,
        });
        chrome.storage.sync.get.mockResolvedValue({
          channelName: 'test-channel',
        });

        await checkScheduledReactivation();

        expect(chrome.storage.local.set).toHaveBeenCalledWith({
          featureEnabled: true,
        });
      });

      test('should not reactivate feature when time has not passed', async () => {
        chrome.storage.local.get.mockResolvedValue({
          reactivationTime: 1000000001000, // 1 second in future
          featureEnabled: false,
        });

        await checkScheduledReactivation();

        expect(chrome.storage.local.set).not.toHaveBeenCalled();
      });

      test('should handle no reactivation time set', async () => {
        chrome.storage.local.get.mockResolvedValue({});

        await checkScheduledReactivation();

        expect(chrome.storage.local.set).not.toHaveBeenCalled();
      });
    });

    describe('reactivateFeature', () => {
      test('should reactivate feature', async () => {
        chrome.storage.sync.get.mockResolvedValue({
          channelName: 'test-channel',
        });

        await reactivateFeature();

        expect(chrome.storage.local.set).toHaveBeenCalledWith({
          featureEnabled: true,
        });
      });
    });
  });
});
