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
  });
});
