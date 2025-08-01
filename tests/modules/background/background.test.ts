import { updateAppStatus, updateExtensionIcon } from '@src/modules/background/app-state';
import { updateContentScriptMergeState } from '@src/modules/background/bitbucket';
import {
  fetchAndStoreMessages,
  fetchAndStoreTeamId,
  handleCanvasChangedEvent,
  handleSlackApiError,
  processAndStoreMessage,
  resolveChannelId,
} from '@src/modules/background/slack';
import { APP_STATUS, MERGE_STATUS, MESSAGE_ACTIONS } from '@src/modules/common/constants';
import { mockRuntime, mockStorage } from '@tests/setup';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// Mock dependencies
vi.mock('@src/modules/common/utils/Logger');
vi.mock('@src/modules/background/app-state');
vi.mock('@src/modules/background/bitbucket');
vi.mock('@src/modules/background/slack');

const mockedFetchAndStoreMessages = vi.mocked(fetchAndStoreMessages);
const _mockedFetchAndStoreTeamId = vi.mocked(fetchAndStoreTeamId);
const mockedHandleCanvasChangedEvent = vi.mocked(handleCanvasChangedEvent);
const mockedHandleSlackApiError = vi.mocked(handleSlackApiError);
const mockedProcessAndStoreMessage = vi.mocked(processAndStoreMessage);
const mockedResolveChannelId = vi.mocked(resolveChannelId);
const mockedUpdateAppStatus = vi.mocked(updateAppStatus);
const mockedUpdateContentScriptMergeState = vi.mocked(updateContentScriptMergeState);
const mockedUpdateExtensionIcon = vi.mocked(updateExtensionIcon);

interface MessageRequest {
  action: string;
  payload?: any;
}

interface MessageSender {
  tab?: { id: number; url?: string };
}

describe('Background Script', () => {
  let messageHandler: (
    request: MessageRequest,
    sender: MessageSender,
    sendResponse: (response: any) => void
  ) => boolean | void;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Temporarily set NODE_ENV to ensure listeners are attached
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    await import('@src/modules/background/background');
    process.env.NODE_ENV = originalNodeEnv;

    messageHandler = mockRuntime.onMessage.addListener.mock.calls[0][0];

    // Mock setup
    mockedFetchAndStoreMessages.mockResolvedValue();
    mockedResolveChannelId.mockResolvedValue('C12345');
    mockedHandleCanvasChangedEvent.mockResolvedValue();
    mockedHandleSlackApiError.mockResolvedValue();
    mockedProcessAndStoreMessage.mockResolvedValue();
    mockedResolveChannelId.mockResolvedValue('C12345');
    mockedUpdateAppStatus.mockResolvedValue(true);
    mockedUpdateContentScriptMergeState.mockResolvedValue();
    mockedUpdateExtensionIcon.mockReturnValue(true);

    mockStorage.sync.get.mockResolvedValue({
      slackToken: 'test-token',
      appToken: 'test-app-token',
      channelName: 'test-channel',
      bitbucketUrl: 'https://bitbucket.org/test/test/pull-requests/1',
    });
    mockStorage.local.get.mockResolvedValue({
      featureEnabled: true,
      lastKnownMergeState: { mergeStatus: MERGE_STATUS.LOADING },
      reactivationTime: 0,
    });
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('Message Handlers', () => {
    test('GET_DEFAULT_PHRASES should return default phrases', () => {
      const sendResponse = vi.fn();
      messageHandler({ action: MESSAGE_ACTIONS.GET_DEFAULT_PHRASES }, {}, sendResponse);
      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultAllowedPhrases: expect.any(Array),
          defaultDisallowedPhrases: expect.any(Array),
          defaultExceptionPhrases: expect.any(Array),
        })
      );
    });

    test('FETCH_NEW_MESSAGES should fetch and store new messages', async () => {
      const sendResponse = vi.fn();
      messageHandler(
        {
          action: MESSAGE_ACTIONS.FETCH_NEW_MESSAGES,
          payload: { channelName: 'test-channel' },
        },
        {},
        sendResponse
      );
      await new Promise(process.nextTick);
      expect(mockedUpdateExtensionIcon).toHaveBeenCalledWith(MERGE_STATUS.LOADING);
      expect(mockedResolveChannelId).toHaveBeenCalledWith('test-token', 'test-channel');
      expect(mockedFetchAndStoreMessages).toHaveBeenCalledWith('test-token', 'C12345');
      expect(mockedUpdateContentScriptMergeState).toHaveBeenCalledWith('test-channel');
      expect(sendResponse).toHaveBeenCalledWith({ success: true });
    });

    test('FETCH_NEW_MESSAGES should handle missing config', async () => {
      mockStorage.sync.get.mockResolvedValueOnce({});
      const sendResponse = vi.fn();
      messageHandler({ action: MESSAGE_ACTIONS.FETCH_NEW_MESSAGES }, {}, sendResponse);
      await new Promise(process.nextTick);
      expect(mockedUpdateAppStatus).toHaveBeenCalledWith(APP_STATUS.CONFIG_ERROR);
      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'Missing slackToken or channelName',
      });
    });

    test('RECONNECT_SLACK should attempt to reconnect', async () => {
      const sendResponse = vi.fn();
      global.WebSocket = vi.fn().mockImplementation(() => ({
        close: vi.fn(),
      })) as any;

      messageHandler({ action: MESSAGE_ACTIONS.RECONNECT_SLACK }, {}, sendResponse);
      await new Promise(process.nextTick);

      expect(mockedUpdateExtensionIcon).toHaveBeenCalledWith(MERGE_STATUS.LOADING);
      expect(sendResponse).toHaveBeenCalledWith({ success: true });
    });

    test('FEATURE_TOGGLE_CHANGED should handle feature toggle', async () => {
      const sendResponse = vi.fn();
      messageHandler(
        { action: MESSAGE_ACTIONS.FEATURE_TOGGLE_CHANGED, payload: { enabled: false } },
        {},
        sendResponse
      );
      await new Promise(process.nextTick);
      expect(mockStorage.local.set).toHaveBeenCalledWith({ featureEnabled: false });
      expect(mockedUpdateContentScriptMergeState).toHaveBeenCalled();
      expect(sendResponse).toHaveBeenCalledWith({ success: true });
    });

    test('GET_COUNTDOWN_STATUS should return countdown status', async () => {
      mockStorage.local.get.mockResolvedValue({
        featureEnabled: false,
        reactivationTime: Date.now() + 10000,
      });
      const sendResponse = vi.fn();
      messageHandler({ action: MESSAGE_ACTIONS.GET_COUNTDOWN_STATUS }, {}, sendResponse);
      await new Promise(process.nextTick);
      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({ isCountdownActive: true })
      );
    });

    test('COUNTDOWN_COMPLETED should re-enable feature', async () => {
      const sendResponse = vi.fn();
      messageHandler(
        { action: MESSAGE_ACTIONS.COUNTDOWN_COMPLETED, payload: { enabled: true } },
        {},
        sendResponse
      );
      await new Promise(process.nextTick);
      expect(mockStorage.local.set).toHaveBeenCalledWith({ featureEnabled: true });
      expect(mockedUpdateContentScriptMergeState).toHaveBeenCalled();
      expect(sendResponse).toHaveBeenCalledWith({ success: true });
    });

    test('should return false for unknown actions', () => {
      const result = messageHandler({ action: 'UNKNOWN_ACTION' }, {}, vi.fn());
      expect(result).toBe(false);
    });
  });
});
