/**
 * @jest-environment jsdom
 */

import { describe, beforeEach, test, expect, vi } from 'vitest';
import { APP_STATUS, MERGE_STATUS } from '../src/constants';
import { updateContentScriptMergeState } from '../src/background';

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

// Mock the functions that updateContentScriptMergeState depends on
vi.mock('../src/background', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    determineMergeStatus: vi.fn().mockReturnValue({
      status: MERGE_STATUS.UNKNOWN,
      message: null,
    }),
    updateExtensionIcon: vi.fn(),
  };
});

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
