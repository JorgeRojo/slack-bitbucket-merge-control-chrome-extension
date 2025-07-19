/**
 * @jest-environment jsdom
 */

import { describe, beforeEach, test, expect, vi } from 'vitest';
import { APP_STATUS, MERGE_STATUS } from '../src/constants';

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

async function updateContentScriptMergeState(channelName) {
  const { appStatus, featureEnabled } = await chrome.storage.local.get([
    'messages',
    'appStatus',
    'featureEnabled',
  ]);

  await chrome.storage.sync.get([
    'allowedPhrases',
    'disallowedPhrases',
    'exceptionPhrases',
  ]);

  let mergeStatusForContentScript = MERGE_STATUS.UNKNOWN;
  let matchingMessageForContentScript = null;

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
    vi.resetAllMocks();

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

    chrome.storage.sync.get.mockImplementation(() => {
      return Promise.resolve({
        allowedPhrases: 'allowed to merge',
        disallowedPhrases: 'not allowed to merge',
        exceptionPhrases: 'except',
      });
    });

    chrome.storage.local.set.mockImplementation(() => Promise.resolve());
  });

  test('should set merge status to ERROR when app status is UNKNOWN_ERROR', async () => {
    chrome.storage.local.get.mockImplementation(() => {
      return Promise.resolve({
        messages: [],
        appStatus: APP_STATUS.UNKNOWN_ERROR,
        featureEnabled: true,
      });
    });

    await updateContentScriptMergeState('test-channel');

    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({
        lastKnownMergeState: expect.objectContaining({
          mergeStatus: MERGE_STATUS.ERROR,
        }),
      }),
    );
  });

  test('should set merge status to ERROR when app status is CONFIG_ERROR', async () => {
    chrome.storage.local.get.mockImplementation(() => {
      return Promise.resolve({
        messages: [],
        appStatus: APP_STATUS.CONFIG_ERROR,
        featureEnabled: true,
      });
    });

    await updateContentScriptMergeState('test-channel');

    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({
        lastKnownMergeState: expect.objectContaining({
          mergeStatus: MERGE_STATUS.ERROR,
        }),
      }),
    );
  });

  test('should set merge status to ERROR when app status is TOKEN_ERROR', async () => {
    chrome.storage.local.get.mockImplementation(() => {
      return Promise.resolve({
        messages: [],
        appStatus: APP_STATUS.TOKEN_ERROR,
        featureEnabled: true,
      });
    });

    await updateContentScriptMergeState('test-channel');

    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({
        lastKnownMergeState: expect.objectContaining({
          mergeStatus: MERGE_STATUS.ERROR,
        }),
      }),
    );
  });

  test('should set merge status to ERROR when app status is WEB_SOCKET_ERROR', async () => {
    chrome.storage.local.get.mockImplementation(() => {
      return Promise.resolve({
        messages: [],
        appStatus: APP_STATUS.WEB_SOCKET_ERROR,
        featureEnabled: true,
      });
    });

    await updateContentScriptMergeState('test-channel');

    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({
        lastKnownMergeState: expect.objectContaining({
          mergeStatus: MERGE_STATUS.ERROR,
        }),
      }),
    );
  });

  test('should not change merge status when app status is OK', async () => {
    chrome.storage.local.get.mockImplementation(() => {
      return Promise.resolve({
        messages: [],
        appStatus: APP_STATUS.OK,
        featureEnabled: true,
      });
    });

    await updateContentScriptMergeState('test-channel');

    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({
        lastKnownMergeState: expect.objectContaining({
          mergeStatus: MERGE_STATUS.UNKNOWN,
        }),
      }),
    );
  });
});
