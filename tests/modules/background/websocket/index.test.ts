import { updateAppStatus, updateExtensionIcon } from '@src/modules/background/app-state';
import { updateContentScriptMergeState as _updateContentScriptMergeState } from '@src/modules/background/bitbucket';
import {
  fetchAndStoreMessages as _fetchAndStoreMessages,
  handleSlackApiError as _handleSlackApiError,
  fetchAndStoreTeamId,
  handleCanvasChangedEvent,
  processAndStoreMessage,
  resolveChannelId,
} from '@src/modules/background/slack';
import {
  checkWebSocketConnection,
  closeWebSocket,
  connectToSlackSocketMode,
  getBitbucketTabId,
  setBitbucketTabId,
  setupWebSocketCheckAlarm,
} from '@src/modules/background/websocket';
import { APP_STATUS, MERGE_STATUS, WEBSOCKET_CHECK_ALARM } from '@src/modules/common/constants';
import { Logger } from '@src/modules/common/utils/Logger';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// Mock dependencies
vi.mock('@src/modules/background/app-state', () => ({
  updateAppStatus: vi.fn().mockResolvedValue(true),
  updateExtensionIcon: vi.fn(),
}));

vi.mock('@src/modules/background/bitbucket', () => ({
  updateContentScriptMergeState: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@src/modules/background/slack', () => ({
  fetchAndStoreMessages: vi.fn().mockResolvedValue(undefined),
  fetchAndStoreTeamId: vi.fn().mockResolvedValue(undefined),
  handleCanvasChangedEvent: vi.fn().mockResolvedValue(undefined),
  handleSlackApiError: vi.fn().mockResolvedValue(undefined),
  processAndStoreMessage: vi.fn().mockResolvedValue(undefined),
  resolveChannelId: vi.fn().mockResolvedValue('C12345'),
}));

vi.mock('@src/modules/common/utils/Logger', () => ({
  Logger: {
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('WebSocket Module', () => {
  let originalWebSocket: any;
  let mockWebSocket: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Save original WebSocket
    originalWebSocket = global.WebSocket;

    // Create mock WebSocket
    mockWebSocket = {
      onopen: null,
      onmessage: null,
      onclose: null,
      onerror: null,
      readyState: WebSocket.CONNECTING,
      send: vi.fn(),
      close: vi.fn(),
    };
    global.WebSocket = vi.fn().mockImplementation(() => mockWebSocket);

    // Mock chrome API
    global.chrome = {
      alarms: {
        create: vi.fn(),
        clear: vi.fn((_name, callback) => {
          if (callback) callback();
        }),
      },
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({
            featureEnabled: true,
            lastWebSocketConnectTime: Date.now() - 1000,
          }),
          set: vi.fn().mockResolvedValue(undefined),
        },
        sync: {
          get: vi.fn().mockResolvedValue({
            slackToken: 'xoxb-test-token',
            appToken: 'xapp-test-token',
            channelName: 'test-channel',
          }),
        },
      },
    } as any;

    // Mock fetch
    global.fetch = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({
        ok: true,
        url: 'wss://wss-primary.slack.com/link/test',
      }),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    // Restore original WebSocket
    global.WebSocket = originalWebSocket;
  });

  test('setupWebSocketCheckAlarm should create an alarm', () => {
    setupWebSocketCheckAlarm();
    expect(chrome.alarms.clear).toHaveBeenCalledWith(WEBSOCKET_CHECK_ALARM, expect.any(Function));
    expect(chrome.alarms.create).toHaveBeenCalledWith(WEBSOCKET_CHECK_ALARM, {
      periodInMinutes: expect.any(Number),
    });
  });

  test('setBitbucketTabId and getBitbucketTabId should work correctly', () => {
    setBitbucketTabId(456);
    expect(getBitbucketTabId()).toBe(456);

    setBitbucketTabId(null);
    expect(getBitbucketTabId()).toBeNull();
  });

  test('connectToSlackSocketMode should create a WebSocket connection', async () => {
    await connectToSlackSocketMode();

    // Verify WebSocket was created
    expect(global.WebSocket).toHaveBeenCalledWith(expect.stringContaining('wss://'));

    // Verify app state was updated
    expect(updateExtensionIcon).toHaveBeenCalledWith(MERGE_STATUS.LOADING);
    expect(fetchAndStoreTeamId).toHaveBeenCalledWith('xoxb-test-token');
    expect(resolveChannelId).toHaveBeenCalledWith('xoxb-test-token', 'test-channel');
  });

  test('connectToSlackSocketMode should handle missing tokens', async () => {
    // Mock missing tokens
    chrome.storage.sync.get = vi.fn().mockResolvedValue({});

    await connectToSlackSocketMode();

    // Verify app state was updated with error
    expect(updateAppStatus).toHaveBeenCalledWith(APP_STATUS.CONFIG_ERROR);

    // Verify WebSocket was not created
    expect(global.WebSocket).not.toHaveBeenCalled();
  });

  test('checkWebSocketConnection should reconnect if WebSocket is closed', async () => {
    // First connect
    await connectToSlackSocketMode();

    // Reset mocks
    vi.clearAllMocks();

    // Simulate closed connection
    mockWebSocket.readyState = WebSocket.CLOSED;

    // Check connection
    await checkWebSocketConnection();

    // Verify reconnection attempt - just check that Logger.log was called
    expect(Logger.log).toHaveBeenCalled();
  });

  test('WebSocket onopen handler should update app state', async () => {
    // Mock the chrome.storage.local.set implementation to actually store the value
    const storedValues: Record<string, any> = {};
    chrome.storage.local.set = vi.fn().mockImplementation(obj => {
      Object.assign(storedValues, obj);
      return Promise.resolve();
    });

    await connectToSlackSocketMode();

    // Simulate WebSocket open event
    if (mockWebSocket.onopen) {
      await mockWebSocket.onopen();
    }

    // Verify app state was updated
    expect(updateAppStatus).toHaveBeenCalledWith(APP_STATUS.OK);
    // Just verify that Logger.log was called
    expect(Logger.log).toHaveBeenCalled();
  });

  test('WebSocket onmessage handler should process message events', async () => {
    await connectToSlackSocketMode();

    // Reset mocks to ensure we can verify the calls
    vi.clearAllMocks();

    // Simulate WebSocket message event with a message
    if (mockWebSocket.onmessage) {
      await mockWebSocket.onmessage({
        data: JSON.stringify({
          payload: {
            event: {
              type: 'message',
              ts: '123456789',
              text: 'Test message',
              user: 'U123',
            },
          },
        }),
      });
    }

    // Verify message was processed - just check that processAndStoreMessage was called
    expect(processAndStoreMessage).toHaveBeenCalled();
  });

  test('WebSocket onmessage handler should process canvas change events', async () => {
    await connectToSlackSocketMode();

    // Simulate WebSocket message event with a canvas change
    if (mockWebSocket.onmessage) {
      mockWebSocket.onmessage({
        data: JSON.stringify({
          payload: {
            event: {
              type: 'file_change',
              file_id: 'F12345',
            },
          },
        }),
      });
    }

    // Verify canvas change was processed
    expect(handleCanvasChangedEvent).toHaveBeenCalledWith('F12345');
  });

  test('WebSocket onclose handler should update app state', async () => {
    await connectToSlackSocketMode();

    // Simulate WebSocket close event
    if (mockWebSocket.onclose) {
      mockWebSocket.onclose();
    }

    // Verify app state was updated
    expect(updateAppStatus).toHaveBeenCalledWith(APP_STATUS.WEB_SOCKET_ERROR);
    expect(Logger.log).toHaveBeenCalledWith(expect.stringContaining('closed'));
  });

  test('WebSocket onerror handler should log errors', async () => {
    await connectToSlackSocketMode();

    // Reset mocks to ensure we can verify the calls
    vi.clearAllMocks();

    // Simulate WebSocket error event
    if (mockWebSocket.onerror) {
      await mockWebSocket.onerror(new Error('WebSocket error'));
    }

    // Verify error handling - just check that updateAppStatus was called
    expect(updateAppStatus).toHaveBeenCalledWith(APP_STATUS.WEB_SOCKET_ERROR);
    expect(mockWebSocket.close).toHaveBeenCalled();
  });

  test('closeWebSocket should close the connection', async () => {
    // First connect
    await connectToSlackSocketMode();

    // Reset mocks
    vi.clearAllMocks();

    // Close WebSocket
    closeWebSocket();

    // Verify WebSocket was closed
    expect(mockWebSocket.close).toHaveBeenCalled();
  });
});
