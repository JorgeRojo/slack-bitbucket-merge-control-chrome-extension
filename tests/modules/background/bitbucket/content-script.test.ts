import {
  registerBitbucketContentScript,
  updateMergeButtonFromLastKnownMergeState,
} from '@src/modules/background/bitbucket/content-script';
import { MERGE_STATUS } from '@src/modules/common/constants';
import { mockStorage } from '@tests/setup';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// Mock dependencies
vi.mock('@src/modules/background/websocket', () => ({
  getBitbucketTabId: vi.fn().mockReturnValue(123),
}));

// Mock Logger
vi.mock('@src/modules/common/utils/Logger', () => ({
  Logger: {
    log: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Bitbucket Content Script Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock chrome.scripting
    chrome.scripting = {
      getRegisteredContentScripts: vi.fn().mockResolvedValue([]),
      unregisterContentScripts: vi.fn().mockResolvedValue(undefined),
      registerContentScripts: vi.fn().mockResolvedValue(undefined),
    } as any;

    // Mock chrome.tabs
    chrome.tabs = {
      sendMessage: vi.fn().mockResolvedValue(undefined),
    } as any;

    // Mock storage
    mockStorage.sync.get.mockResolvedValue({
      bitbucketUrl: 'https://bitbucket.org/*',
    });

    mockStorage.local.get.mockResolvedValue({
      lastKnownMergeState: {
        isMergeDisabled: false,
        lastSlackMessage: { text: 'Test message', ts: '123', user: 'U123' },
        channelName: 'test-channel',
        mergeStatus: MERGE_STATUS.ALLOWED,
      },
      featureEnabled: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('registerBitbucketContentScript should exist', () => {
    expect(registerBitbucketContentScript).toBeDefined();
  });

  test('updateMergeButtonFromLastKnownMergeState should get lastKnownMergeState', () => {
    updateMergeButtonFromLastKnownMergeState();
    expect(mockStorage.local.get).toHaveBeenCalled();
  });
});
