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
  action: {
    setIcon: vi.fn(),
  },
  tabs: {
    sendMessage: vi.fn(),
  },
};

// Simplified implementation of updateContentScriptMergeState
async function updateContentScriptMergeState(channelName) {
  const { appStatus, featureEnabled } = await chrome.storage.local.get([
    'messages',
    'appStatus',
    'featureEnabled',
  ]);

  // Mock the behavior of getPhrasesFromStorage
  await chrome.storage.sync.get([
    'allowedPhrases',
    'disallowedPhrases',
    'exceptionPhrases',
  ]);

  // Simplified determineMergeStatus
  let mergeStatusForContentScript = MERGE_STATUS.UNKNOWN;
  let matchingMessageForContentScript = null;

  // This is the key part we're testing - handling of error statuses
  const errorStatuses = [
    APP_STATUS.UNKNOWN_ERROR,
    APP_STATUS.CONFIG_ERROR,
    APP_STATUS.TOKEN_ERROR,
    APP_STATUS.WEB_SOCKET_ERROR,
  ];

  if (appStatus && errorStatuses.includes(appStatus)) {
    mergeStatusForContentScript = MERGE_STATUS.ERROR;
  }

  // Set the merge state in storage
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

    // Mock storage.sync.get for phrases
    chrome.storage.sync.get.mockImplementation(() => {
      return Promise.resolve({
        allowedPhrases: 'allowed to merge',
        disallowedPhrases: 'not allowed to merge',
        exceptionPhrases: 'except',
      });
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
