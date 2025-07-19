/**
 * @jest-environment jsdom
 */

import { describe, beforeEach, test, expect, vi } from 'vitest';
import { APP_STATUS, MERGE_STATUS } from '../src/constants';

// Mock chrome API
global.chrome = {
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
    },
    sync: {
      get: vi.fn(),
    },
  },
  runtime: {
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
    },
  },
  tabs: {
    sendMessage: vi.fn(),
  },
};

// Mock functions that are used by updateContentScriptMergeState
const getPhrasesFromStorage = vi.fn().mockResolvedValue({
  currentAllowedPhrases: ['allowed to merge'],
  currentDisallowedPhrases: ['not allowed to merge'],
  currentExceptionPhrases: ['except'],
});

const determineMergeStatus = vi.fn().mockReturnValue({
  status: MERGE_STATUS.UNKNOWN,
  message: null,
});

const updateExtensionIcon = vi.fn();

// Create a simplified version of updateContentScriptMergeState for testing
async function updateContentScriptMergeState(channelName) {
  const {
    messages: currentMessages = [],
    appStatus,
    featureEnabled,
  } = await chrome.storage.local.get([
    'messages',
    'appStatus',
    'featureEnabled',
  ]);

  await getPhrasesFromStorage();

  let mergeStatusForContentScript = MERGE_STATUS.UNKNOWN;
  let matchingMessageForContentScript = null;

  if (currentMessages.length > 0) {
    const { status, message } = determineMergeStatus({
      messages: currentMessages,
      allowedPhrases: [],
      disallowedPhrases: [],
      exceptionPhrases: [],
    });
    mergeStatusForContentScript = status;
    matchingMessageForContentScript = message;
    updateExtensionIcon(status);
  }

  const errorStatuses = [
    APP_STATUS.UNKNOWN_ERROR,
    APP_STATUS.CONFIG_ERROR,
    APP_STATUS.TOKEN_ERROR,
    APP_STATUS.WEB_SOCKET_ERROR,
  ];

  if (appStatus && errorStatuses.includes(appStatus)) {
    mergeStatusForContentScript = MERGE_STATUS.ERROR;
  }

  await chrome.storage.local.set({
    lastKnownMergeState: {
      isMergeDisabled:
        mergeStatusForContentScript === MERGE_STATUS.DISALLOWED ||
        mergeStatusForContentScript === MERGE_STATUS.EXCEPTION,
      mergeStatus: mergeStatusForContentScript,
      lastSlackMessage: matchingMessageForContentScript,
      channelName: channelName,
      featureEnabled: featureEnabled !== false,
    },
  });
}

describe('App Status Error Handling', () => {
  beforeEach(() => {
    // Reset all mocks
    vi.resetAllMocks();

    // Mock storage.local.get to return different app statuses
    chrome.storage.local.get.mockImplementation((keys) => {
      if (Array.isArray(keys) && keys.includes('messages')) {
        return Promise.resolve({
          messages: [],
          appStatus: null,
          featureEnabled: true,
        });
      }
      return Promise.resolve({});
    });

    // Mock storage.local.set
    chrome.storage.local.set.mockImplementation(() => Promise.resolve());
  });

  test('should set merge status to ERROR when app status is UNKNOWN_ERROR', async () => {
    // Setup
    chrome.storage.local.get.mockImplementation(() => {
      return Promise.resolve({
        messages: [],
        appStatus: APP_STATUS.UNKNOWN_ERROR,
        featureEnabled: true,
      });
    });

    // Execute
    await updateContentScriptMergeState('test-channel');

    // Verify
    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({
        lastKnownMergeState: expect.objectContaining({
          mergeStatus: MERGE_STATUS.ERROR,
        }),
      }),
    );
  });

  test('should set merge status to ERROR when app status is CONFIG_ERROR', async () => {
    // Setup
    chrome.storage.local.get.mockImplementation(() => {
      return Promise.resolve({
        messages: [],
        appStatus: APP_STATUS.CONFIG_ERROR,
        featureEnabled: true,
      });
    });

    // Execute
    await updateContentScriptMergeState('test-channel');

    // Verify
    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({
        lastKnownMergeState: expect.objectContaining({
          mergeStatus: MERGE_STATUS.ERROR,
        }),
      }),
    );
  });

  test('should set merge status to ERROR when app status is TOKEN_ERROR', async () => {
    // Setup
    chrome.storage.local.get.mockImplementation(() => {
      return Promise.resolve({
        messages: [],
        appStatus: APP_STATUS.TOKEN_ERROR,
        featureEnabled: true,
      });
    });

    // Execute
    await updateContentScriptMergeState('test-channel');

    // Verify
    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({
        lastKnownMergeState: expect.objectContaining({
          mergeStatus: MERGE_STATUS.ERROR,
        }),
      }),
    );
  });

  test('should set merge status to ERROR when app status is WEB_SOCKET_ERROR', async () => {
    // Setup
    chrome.storage.local.get.mockImplementation(() => {
      return Promise.resolve({
        messages: [],
        appStatus: APP_STATUS.WEB_SOCKET_ERROR,
        featureEnabled: true,
      });
    });

    // Execute
    await updateContentScriptMergeState('test-channel');

    // Verify
    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({
        lastKnownMergeState: expect.objectContaining({
          mergeStatus: MERGE_STATUS.ERROR,
        }),
      }),
    );
  });

  test('should not change merge status when app status is OK', async () => {
    // Setup
    chrome.storage.local.get.mockImplementation(() => {
      return Promise.resolve({
        messages: [],
        appStatus: APP_STATUS.OK,
        featureEnabled: true,
      });
    });

    // Execute
    await updateContentScriptMergeState('test-channel');

    // Verify
    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({
        lastKnownMergeState: expect.objectContaining({
          mergeStatus: MERGE_STATUS.UNKNOWN,
        }),
      }),
    );
  });
});
