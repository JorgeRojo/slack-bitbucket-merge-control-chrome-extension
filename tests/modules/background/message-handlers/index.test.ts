import { messageHandlers } from '@src/modules/background/message-handlers';
import {
  DEFAULT_ALLOWED_PHRASES,
  DEFAULT_DISALLOWED_PHRASES,
  DEFAULT_EXCEPTION_PHRASES,
  MESSAGE_ACTIONS,
} from '@src/modules/common/constants';
import { mockStorage } from '@tests/setup';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// Mock dependencies
vi.mock('@src/modules/background/app-state', () => ({
  updateAppStatus: vi.fn(),
  updateExtensionIcon: vi.fn(),
}));

vi.mock('@src/modules/background/bitbucket', () => ({
  updateContentScriptMergeState: vi.fn(),
}));

vi.mock('@src/modules/background/bitbucket/content-script', () => ({
  updateMergeButtonFromLastKnownMergeState: vi.fn(),
}));

vi.mock('@src/modules/background/countdown', () => ({
  scheduleFeatureReactivation: vi.fn(),
  stopCountdown: vi.fn(),
}));

vi.mock('@src/modules/background/slack', () => ({
  fetchAndStoreMessages: vi.fn(),
  handleSlackApiError: vi.fn(),
  resolveChannelId: vi.fn(),
}));

vi.mock('@src/modules/background/websocket', () => ({
  closeWebSocket: vi.fn(),
  connectToSlackSocketMode: vi.fn(),
}));

// Mock Logger
vi.mock('@src/modules/common/utils/Logger', () => ({
  Logger: {
    log: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Message Handlers Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock chrome.runtime.sendMessage
    chrome.runtime.sendMessage = vi.fn();

    // Mock storage
    mockStorage.sync.get.mockResolvedValue({
      slackToken: 'test-token',
      channelName: 'test-channel',
    });

    mockStorage.local.get.mockResolvedValue({
      lastKnownMergeState: {},
      featureEnabled: true,
      reactivationTime: Date.now() + 10000,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('should have a handler for GET_DEFAULT_PHRASES', () => {
    expect(messageHandlers[MESSAGE_ACTIONS.GET_DEFAULT_PHRASES]).toBeDefined();
  });

  test('GET_DEFAULT_PHRASES handler should return default phrases', () => {
    const sendResponse = vi.fn();

    messageHandlers[MESSAGE_ACTIONS.GET_DEFAULT_PHRASES]({} as any, {} as any, sendResponse);

    expect(sendResponse).toHaveBeenCalledWith({
      defaultAllowedPhrases: DEFAULT_ALLOWED_PHRASES,
      defaultDisallowedPhrases: DEFAULT_DISALLOWED_PHRASES,
      defaultExceptionPhrases: DEFAULT_EXCEPTION_PHRASES,
    });
  });

  test('should have a handler for FETCH_NEW_MESSAGES', () => {
    expect(messageHandlers[MESSAGE_ACTIONS.FETCH_NEW_MESSAGES]).toBeDefined();
  });

  test('should have a handler for RECONNECT_SLACK', () => {
    expect(messageHandlers[MESSAGE_ACTIONS.RECONNECT_SLACK]).toBeDefined();
  });

  test('should have a handler for BITBUCKET_TAB_LOADED', () => {
    expect(messageHandlers[MESSAGE_ACTIONS.BITBUCKET_TAB_LOADED]).toBeDefined();
  });

  test('should have a handler for FEATURE_TOGGLE_CHANGED', () => {
    expect(messageHandlers[MESSAGE_ACTIONS.FEATURE_TOGGLE_CHANGED]).toBeDefined();
  });

  test('should have a handler for COUNTDOWN_COMPLETED', () => {
    expect(messageHandlers[MESSAGE_ACTIONS.COUNTDOWN_COMPLETED]).toBeDefined();
  });

  test('should have a handler for GET_COUNTDOWN_STATUS', () => {
    expect(messageHandlers[MESSAGE_ACTIONS.GET_COUNTDOWN_STATUS]).toBeDefined();
  });
});
