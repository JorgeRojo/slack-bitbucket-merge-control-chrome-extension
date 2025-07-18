import { jest } from '@jest/globals';
import {
  registerBitbucketContentScript,
  updateMergeButtonFromLastKnownMergeState,
  updateContentScriptMergeState,
} from '../src/background_bitbucket.js';

// Mock chrome APIs
global.chrome = {
  storage: {
    sync: {
      get: jest.fn(),
    },
    local: {
      get: jest.fn(),
      set: jest.fn(),
    },
  },
  scripting: {
    registerContentScripts: jest.fn(),
    unregisterContentScripts: jest.fn(),
  },
  tabs: {
    sendMessage: jest.fn(),
  },
  runtime: {
    onMessage: {
      addListener: jest.fn(),
    },
  },
};

describe('Bitbucket Background Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    chrome.scripting.unregisterContentScripts.mockResolvedValue();
    chrome.scripting.registerContentScripts.mockResolvedValue();
    chrome.storage.sync.get.mockResolvedValue({});
    chrome.storage.local.get.mockResolvedValue({});
    chrome.storage.local.set.mockResolvedValue();
  });

  describe('registerBitbucketContentScript', () => {
    test('should register content script when bitbucketUrl is provided', async () => {
      chrome.storage.sync.get.mockResolvedValue({
        bitbucketUrl:
          'https://bitbucket.example.com/projects/*/repos/*/pull-requests/*',
      });

      await registerBitbucketContentScript();

      expect(chrome.scripting.unregisterContentScripts).toHaveBeenCalledWith({
        ids: ['bitbucket-content-script'],
      });
      expect(chrome.scripting.registerContentScripts).toHaveBeenCalledWith([
        {
          id: 'bitbucket-content-script',
          matches: [
            'https://bitbucket.example.com/projects/*/repos/*/pull-requests/*',
          ],
          js: ['slack_frontend_closure_bitbucket_content.js'],
          runAt: 'document_idle',
        },
      ]);
    });

    test('should only unregister when no bitbucketUrl is provided', async () => {
      chrome.storage.sync.get.mockResolvedValue({});

      await registerBitbucketContentScript();

      expect(chrome.scripting.unregisterContentScripts).toHaveBeenCalledWith({
        ids: ['bitbucket-content-script'],
      });
      expect(chrome.scripting.registerContentScripts).not.toHaveBeenCalled();
    });
  });

  describe('updateMergeButtonFromLastKnownMergeState', () => {
    test('should call chrome.storage.local.get with correct parameters', () => {
      updateMergeButtonFromLastKnownMergeState();

      expect(chrome.storage.local.get).toHaveBeenCalledWith(
        ['lastKnownMergeState', 'featureEnabled'],
        expect.any(Function),
      );
    });

    test('should handle function call without errors', () => {
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({
          lastKnownMergeState: {
            mergeStatus: 'allowed',
            lastSlackMessage: 'allowed to merge',
            channelName: 'test-channel',
            isMergeDisabled: false,
          },
          featureEnabled: true,
        });
      });

      expect(() => updateMergeButtonFromLastKnownMergeState()).not.toThrow();
    });
  });

  describe('updateContentScriptMergeState', () => {
    beforeEach(() => {
      // Mock getPhrasesFromStorage and determineMergeStatus
      jest.doMock('../src/background.js', () => ({
        getPhrasesFromStorage: jest.fn().mockResolvedValue({
          currentAllowedPhrases: ['allowed to merge'],
          currentDisallowedPhrases: ['not allowed to merge'],
          currentExceptionPhrases: ['except this project'],
        }),
        determineMergeStatus: jest.fn().mockReturnValue({
          status: 'allowed',
          message: { text: 'allowed to merge', ts: '123' },
        }),
      }));
    });

    afterEach(() => {
      jest.dontMock('../src/background.js');
    });

    test('should handle function call without errors', async () => {
      chrome.storage.local.get.mockResolvedValue({
        featureEnabled: true,
        messages: [{ text: 'test message', ts: '123' }],
      });

      await expect(
        updateContentScriptMergeState('test-channel'),
      ).resolves.not.toThrow();
    });

    test('should handle empty messages gracefully', async () => {
      chrome.storage.local.get.mockResolvedValue({
        featureEnabled: true,
        messages: [],
      });

      await expect(
        updateContentScriptMergeState('test-channel'),
      ).resolves.not.toThrow();
    });

    test('should handle null messages gracefully', async () => {
      chrome.storage.local.get.mockResolvedValue({
        featureEnabled: true,
        messages: null,
      });

      await expect(
        updateContentScriptMergeState('test-channel'),
      ).resolves.not.toThrow();
    });

    test('should handle undefined messages gracefully', async () => {
      chrome.storage.local.get.mockResolvedValue({
        featureEnabled: true,
      });

      await expect(
        updateContentScriptMergeState('test-channel'),
      ).resolves.not.toThrow();
    });

    test('should handle disabled feature', async () => {
      chrome.storage.local.get.mockResolvedValue({
        featureEnabled: false,
        messages: [{ text: 'not allowed to merge', ts: '123' }],
      });

      await expect(
        updateContentScriptMergeState('test-channel'),
      ).resolves.not.toThrow();
    });

    test('should handle missing featureEnabled flag', async () => {
      chrome.storage.local.get.mockResolvedValue({
        messages: [{ text: 'allowed to merge', ts: '123' }],
      });

      await expect(
        updateContentScriptMergeState('test-channel'),
      ).resolves.not.toThrow();
    });

    test('should handle storage errors gracefully', async () => {
      chrome.storage.local.get.mockRejectedValue(new Error('Storage error'));

      await expect(
        updateContentScriptMergeState('test-channel'),
      ).rejects.toThrow('Storage error');
    });

    test('should handle sendMessage errors gracefully', async () => {
      chrome.storage.local.get.mockResolvedValue({
        featureEnabled: true,
        messages: [{ text: 'allowed to merge', ts: '123' }],
      });
      chrome.tabs.sendMessage.mockRejectedValue(new Error('Tab not found'));

      await expect(
        updateContentScriptMergeState('test-channel'),
      ).resolves.not.toThrow();
    });

    test('should handle null channelName', async () => {
      chrome.storage.local.get.mockResolvedValue({
        featureEnabled: true,
        messages: [{ text: 'allowed to merge', ts: '123' }],
      });

      await expect(updateContentScriptMergeState(null)).resolves.not.toThrow();
    });

    test('should handle undefined channelName', async () => {
      chrome.storage.local.get.mockResolvedValue({
        featureEnabled: true,
        messages: [{ text: 'allowed to merge', ts: '123' }],
      });

      await expect(
        updateContentScriptMergeState(undefined),
      ).resolves.not.toThrow();
    });

    test('should handle empty channelName', async () => {
      chrome.storage.local.get.mockResolvedValue({
        featureEnabled: true,
        messages: [{ text: 'allowed to merge', ts: '123' }],
      });

      await expect(updateContentScriptMergeState('')).resolves.not.toThrow();
    });

    test('should call chrome.storage.local.get with correct parameter', async () => {
      chrome.storage.local.get.mockResolvedValue({
        featureEnabled: true,
        messages: [],
      });

      await updateContentScriptMergeState('test-channel');

      expect(chrome.storage.local.get).toHaveBeenCalledWith('featureEnabled');
    });

    test('should handle complex message scenarios', async () => {
      const complexMessages = [
        { text: 'Hello world', ts: '1234567890.123' },
        { text: 'allowed to merge this PR', ts: '1234567891.123' },
        { text: 'Some other message', ts: '1234567892.123' },
      ];

      chrome.storage.local.get.mockResolvedValue({
        featureEnabled: true,
        messages: complexMessages,
      });

      await expect(
        updateContentScriptMergeState('complex-channel'),
      ).resolves.not.toThrow();
    });

    test('should handle messages with special characters', async () => {
      const specialMessages = [
        { text: 'Allowed to merge! 🎉 @everyone', ts: '123' },
        { text: 'Café résumé naïve', ts: '124' },
        { text: 'Special chars: <>&"\'', ts: '125' },
      ];

      chrome.storage.local.get.mockResolvedValue({
        featureEnabled: true,
        messages: specialMessages,
      });

      await expect(
        updateContentScriptMergeState('special-channel'),
      ).resolves.not.toThrow();
    });

    test('should handle very long channel names', async () => {
      const longChannelName = 'a'.repeat(1000);

      chrome.storage.local.get.mockResolvedValue({
        featureEnabled: true,
        messages: [{ text: 'test', ts: '123' }],
      });

      await expect(
        updateContentScriptMergeState(longChannelName),
      ).resolves.not.toThrow();
    });

    test('should handle concurrent calls gracefully', async () => {
      chrome.storage.local.get.mockResolvedValue({
        featureEnabled: true,
        messages: [{ text: 'allowed to merge', ts: '123' }],
      });

      const promises = Array.from({ length: 5 }, (_, i) =>
        updateContentScriptMergeState(`channel-${i}`),
      );

      await expect(Promise.all(promises)).resolves.not.toThrow();
    });

    test('should not call getPhrasesFromStorage when no bitbucketTabId', async () => {
      // Since bitbucketTabId is null by default, the function should return early
      chrome.storage.local.get.mockResolvedValue({
        featureEnabled: true,
        messages: [{ text: 'test', ts: '123' }],
      });

      await updateContentScriptMergeState('test-channel');

      // Should only call storage.local.get for featureEnabled
      expect(chrome.storage.local.get).toHaveBeenCalledWith('featureEnabled');
      expect(chrome.storage.local.get).toHaveBeenCalledTimes(1);
    });

    test('should handle feature enabled as undefined', async () => {
      chrome.storage.local.get.mockResolvedValue({
        featureEnabled: undefined,
        messages: [{ text: 'allowed to merge', ts: '123' }],
      });

      await expect(
        updateContentScriptMergeState('test-channel'),
      ).resolves.not.toThrow();
    });

    test('should handle large number of messages', async () => {
      const manyMessages = Array.from({ length: 1000 }, (_, i) => ({
        text: `Message ${i}`,
        ts: `${1234567890 + i}.123`,
      }));

      chrome.storage.local.get.mockResolvedValue({
        featureEnabled: true,
        messages: manyMessages,
      });

      await expect(
        updateContentScriptMergeState('busy-channel'),
      ).resolves.not.toThrow();
    });

    test('should handle messages with malformed timestamps', async () => {
      const malformedMessages = [
        { text: 'Message 1', ts: 'invalid-timestamp' },
        { text: 'Message 2', ts: null },
        { text: 'Message 3', ts: undefined },
        { text: 'Message 4' }, // missing ts
      ];

      chrome.storage.local.get.mockResolvedValue({
        featureEnabled: true,
        messages: malformedMessages,
      });

      await expect(
        updateContentScriptMergeState('malformed-channel'),
      ).resolves.not.toThrow();
    });

    test('should handle messages with missing text', async () => {
      const incompleteMessages = [
        { ts: '1234567890.123' }, // missing text
        { text: '', ts: '1234567891.123' }, // empty text
        { text: null, ts: '1234567892.123' }, // null text
        { text: undefined, ts: '1234567893.123' }, // undefined text
      ];

      chrome.storage.local.get.mockResolvedValue({
        featureEnabled: true,
        messages: incompleteMessages,
      });

      await expect(
        updateContentScriptMergeState('incomplete-channel'),
      ).resolves.not.toThrow();
    });
  });
});
