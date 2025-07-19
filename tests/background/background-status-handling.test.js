/**
 * @jest-environment jsdom
 */

import { describe, beforeEach, test, expect, vi } from 'vitest';
import { APP_STATUS, MERGE_STATUS } from '../../src/constants';

async function updateContentScriptMergeState(channelName) {
  const {
    // eslint-disable-next-line no-unused-vars
    messages: _messages = [],
    appStatus,
    featureEnabled,
  } = await chrome.storage.local.get([
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
    APP_STATUS.CHANNEL_NOT_FOUND,
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
      appStatus: appStatus, // Incluir appStatus en lastKnownMergeState
    },
  });
}

describe('App Status Error Handling', () => {
  beforeEach(() => {
    vi.spyOn(chrome.storage.local, 'get').mockImplementation((keys) => {
      if (Array.isArray(keys) && keys.includes('messages')) {
        return Promise.resolve({
          messages: [],
          appStatus: null,
          featureEnabled: true,
        });
      }
      return Promise.resolve({});
    });

    vi.spyOn(chrome.storage.sync, 'get').mockImplementation(() => {
      return Promise.resolve({
        allowedPhrases: 'allowed to merge',
        disallowedPhrases: 'not allowed to merge',
        exceptionPhrases: 'except',
      });
    });

    vi.spyOn(chrome.storage.local, 'set').mockImplementation(() =>
      Promise.resolve(),
    );
    vi.spyOn(chrome.runtime, 'sendMessage').mockImplementation(() =>
      Promise.resolve(),
    );
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

  test('should set merge status to ERROR when app status is CHANNEL_NOT_FOUND', async () => {
    chrome.storage.local.get.mockImplementation(() => {
      return Promise.resolve({
        messages: [],
        appStatus: APP_STATUS.CHANNEL_NOT_FOUND,
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

  test('should include appStatus in lastKnownMergeState', async () => {
    chrome.storage.local.get.mockImplementation(() => {
      return Promise.resolve({
        messages: [],
        appStatus: APP_STATUS.CHANNEL_NOT_FOUND,
        featureEnabled: true,
      });
    });

    await updateContentScriptMergeState('test-channel');

    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({
        lastKnownMergeState: expect.objectContaining({
          appStatus: APP_STATUS.CHANNEL_NOT_FOUND,
        }),
      }),
    );
  });

  test('should handle CONFIG_NEEDED as a valid MERGE_STATUS', async () => {
    // Verify that CONFIG_NEEDED is defined in MERGE_STATUS
    expect(MERGE_STATUS.CONFIG_NEEDED).toBeDefined();
    expect(MERGE_STATUS.CONFIG_NEEDED).toBe('config_needed');
  });
});
