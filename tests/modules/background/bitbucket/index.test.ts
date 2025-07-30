import { updateContentScriptMergeState } from '@src/modules/background/bitbucket';
import { getPhrasesFromStorage } from '@src/modules/background/config';
import { determineMergeStatus } from '@src/modules/background/message-analysis';
import { APP_STATUS, MERGE_STATUS, MESSAGE_ACTIONS } from '@src/modules/common/constants';
import { MergeStatusInfo, ProcessedMessage } from '@src/modules/common/types/app';
import { Logger } from '@src/modules/common/utils/Logger';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// Mock dependencies
vi.mock('@src/modules/background/message-analysis', () => ({
  determineMergeStatus: vi.fn(),
}));

vi.mock('@src/modules/background/config', () => ({
  getPhrasesFromStorage: vi.fn(),
}));

vi.mock('@src/modules/common/utils/Logger', () => ({
  Logger: {
    error: vi.fn(),
  },
}));

describe('Bitbucket Integration', () => {
  const mockChannelName = 'test-channel';
  const mockTabId = 123;
  const mockMessages = [
    { text: 'test message', ts: '123456789', user: 'U123', channel: 'C123', matchType: null },
  ] as ProcessedMessage[];
  const mockLastKnownMergeState = {
    mergeStatus: MERGE_STATUS.UNKNOWN,
    appStatus: APP_STATUS.OK,
  } as MergeStatusInfo;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock chrome API
    global.chrome = {
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({
            messages: mockMessages,
            featureEnabled: true,
            lastKnownMergeState: mockLastKnownMergeState,
            canvasContent: null,
          }),
          set: vi.fn().mockResolvedValue(undefined),
        },
      },
      runtime: {
        sendMessage: vi.fn().mockResolvedValue(undefined),
      },
      tabs: {
        sendMessage: vi.fn().mockResolvedValue(undefined),
      },
    } as any;

    // Mock getPhrasesFromStorage
    (getPhrasesFromStorage as any).mockResolvedValue({
      currentAllowedPhrases: ['allowed'],
      currentDisallowedPhrases: ['disallowed'],
      currentExceptionPhrases: ['exception'],
    });

    // Mock determineMergeStatus
    (determineMergeStatus as any).mockReturnValue({
      status: MERGE_STATUS.ALLOWED,
      message: mockMessages[0],
      source: 'message',
      canvasContent: null,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('should exist', () => {
    expect(updateContentScriptMergeState).toBeDefined();
  });

  test('should update merge state with allowed status', async () => {
    await updateContentScriptMergeState(mockChannelName, mockTabId);

    // Verify storage was updated
    expect(chrome.storage.local.set).toHaveBeenCalledWith(expect.objectContaining({
      lastKnownMergeState: expect.objectContaining({
        isMergeDisabled: false,
        mergeStatus: MERGE_STATUS.ALLOWED,
        channelName: mockChannelName,
        featureEnabled: true,
        source: 'message',
      }),
    }));

    // Verify runtime message was sent
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      action: MESSAGE_ACTIONS.UPDATE_MESSAGES,
    });

    // Verify tab message was sent
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(mockTabId, {
      action: MESSAGE_ACTIONS.UPDATE_MERGE_BUTTON,
      payload: expect.objectContaining({
        channelName: mockChannelName,
        isMergeDisabled: false,
        mergeStatus: MERGE_STATUS.ALLOWED,
        featureEnabled: true,
      }),
    });
  });

  test('should update merge state with disallowed status', async () => {
    (determineMergeStatus as any).mockReturnValue({
      status: MERGE_STATUS.DISALLOWED,
      message: mockMessages[0],
      source: 'message',
      canvasContent: null,
    });

    await updateContentScriptMergeState(mockChannelName, mockTabId);

    // Verify storage was updated with isMergeDisabled: true
    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      lastKnownMergeState: expect.objectContaining({
        isMergeDisabled: true,
        mergeStatus: MERGE_STATUS.DISALLOWED,
      }),
    });

    // Verify tab message was sent with isMergeDisabled: true
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(mockTabId, {
      action: MESSAGE_ACTIONS.UPDATE_MERGE_BUTTON,
      payload: expect.objectContaining({
        isMergeDisabled: true,
        mergeStatus: MERGE_STATUS.DISALLOWED,
      }),
    });
  });

  test('should handle error app status', async () => {
    // Set up an error app status
    global.chrome.storage.local.get = vi.fn().mockResolvedValue({
      messages: mockMessages,
      featureEnabled: true,
      lastKnownMergeState: {
        mergeStatus: MERGE_STATUS.UNKNOWN,
        appStatus: APP_STATUS.TOKEN_ERROR,
      },
      canvasContent: null,
    });

    await updateContentScriptMergeState(mockChannelName, mockTabId);

    // Verify storage was updated with ERROR status
    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      lastKnownMergeState: expect.objectContaining({
        mergeStatus: MERGE_STATUS.ERROR,
        appStatus: APP_STATUS.TOKEN_ERROR,
      }),
    });
  });

  test('should handle feature disabled state', async () => {
    // Set feature disabled
    global.chrome.storage.local.get = vi.fn().mockResolvedValue({
      messages: mockMessages,
      featureEnabled: false,
      lastKnownMergeState: mockLastKnownMergeState,
      canvasContent: null,
    });

    (determineMergeStatus as any).mockReturnValue({
      status: MERGE_STATUS.DISALLOWED,
      message: mockMessages[0],
      source: 'message',
      canvasContent: null,
    });

    await updateContentScriptMergeState(mockChannelName, mockTabId);

    // Verify tab message was sent with ALLOWED status despite disallowed from determineMergeStatus
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(mockTabId, {
      action: MESSAGE_ACTIONS.UPDATE_MERGE_BUTTON,
      payload: expect.objectContaining({
        isMergeDisabled: false,
        mergeStatus: MERGE_STATUS.ALLOWED,
        featureEnabled: false,
      }),
    });
  });

  test('should handle canvas content', async () => {
    const mockCanvasContent = 'Canvas content';

    global.chrome.storage.local.get = vi.fn().mockResolvedValue({
      messages: mockMessages,
      featureEnabled: true,
      lastKnownMergeState: mockLastKnownMergeState,
      canvasContent: mockCanvasContent,
    });

    (determineMergeStatus as any).mockReturnValue({
      status: MERGE_STATUS.ALLOWED,
      message: mockMessages[0],
      source: 'canvas',
      canvasContent: mockCanvasContent,
    });

    await updateContentScriptMergeState(mockChannelName, mockTabId);

    // Verify storage was updated with canvas content and source
    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      lastKnownMergeState: expect.objectContaining({
        source: 'canvas',
        canvasContent: mockCanvasContent,
      }),
    });
  });

  test('should handle runtime.sendMessage error', async () => {
    // Make runtime.sendMessage throw an error
    global.chrome.runtime.sendMessage = vi.fn().mockRejectedValue(new Error('Connection failed'));

    await updateContentScriptMergeState(mockChannelName, mockTabId);

    // Verify error was logged
    expect(Logger.error).toHaveBeenCalled();

    // Verify tabs.sendMessage was still called
    expect(chrome.tabs.sendMessage).toHaveBeenCalled();
  });

  test('should handle tabs.sendMessage error', async () => {
    // Make tabs.sendMessage throw an error
    global.chrome.tabs.sendMessage = vi.fn().mockRejectedValue(new Error('Connection failed'));

    await updateContentScriptMergeState(mockChannelName, mockTabId);

    // Verify error was logged
    expect(Logger.error).toHaveBeenCalled();
  });

  test('should handle null bitbucketTabId', async () => {
    await updateContentScriptMergeState(mockChannelName, null);

    // Verify storage was updated
    expect(chrome.storage.local.set).toHaveBeenCalled();

    // Verify runtime message was sent
    expect(chrome.runtime.sendMessage).toHaveBeenCalled();

    // Verify tab message was NOT sent
    expect(chrome.tabs.sendMessage).not.toHaveBeenCalled();
  });
});
