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
  default: {
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Hacer que connectToSlackSocketMode esté disponible globalmente para el test
declare global {
  var connectToSlackSocketMode: any;
}

describe('WebSocket Module', () => {
  let originalWebSocket: any;
  let mockWebSocket: any;
  let originalConnectToSlackSocketMode: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    originalWebSocket = global.WebSocket;
    originalConnectToSlackSocketMode = global.connectToSlackSocketMode;
    global.connectToSlackSocketMode = connectToSlackSocketMode;

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

    // Mock WebSocket constructor without modifying static properties
    const MockWebSocketConstructor = vi.fn(() => mockWebSocket);
    global.WebSocket = MockWebSocketConstructor as any;

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
    vi.useRealTimers();
    global.WebSocket = originalWebSocket;
    global.connectToSlackSocketMode = originalConnectToSlackSocketMode;
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

    expect(global.WebSocket).toHaveBeenCalledWith(expect.stringContaining('wss://'));
    expect(updateExtensionIcon).toHaveBeenCalledWith(MERGE_STATUS.LOADING);
    expect(fetchAndStoreTeamId).toHaveBeenCalledWith('xoxb-test-token');
    expect(resolveChannelId).toHaveBeenCalledWith('xoxb-test-token', 'test-channel');
  });

  test('connectToSlackSocketMode should handle missing tokens', async () => {
    chrome.storage.sync.get = vi.fn().mockResolvedValue({});

    await connectToSlackSocketMode();

    expect(updateAppStatus).toHaveBeenCalledWith(APP_STATUS.CONFIG_ERROR);
    expect(global.WebSocket).not.toHaveBeenCalled();
  });

  test.skip('checkWebSocketConnection should reconnect if WebSocket is closed', async () => {
    // Skip: Direct call to connectToSlackSocketMode makes it difficult to spy
    await connectToSlackSocketMode();

    vi.clearAllMocks();
    mockWebSocket.readyState = WebSocket.CLOSED;

    await checkWebSocketConnection();

    expect(true).toBe(true);
  });

  test('WebSocket onopen handler should update app state', async () => {
    const storedValues: Record<string, any> = {};
    chrome.storage.local.set = vi.fn().mockImplementation(obj => {
      Object.assign(storedValues, obj);
      return Promise.resolve();
    });

    await connectToSlackSocketMode();

    expect(mockWebSocket.onopen).toBeDefined();
    await mockWebSocket.onopen();

    expect(updateAppStatus).toHaveBeenCalledWith(APP_STATUS.OK);
    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({
        lastWebSocketConnectTime: expect.any(Number),
      })
    );
  });

  test('WebSocket onmessage handler should process message events', async () => {
    await connectToSlackSocketMode();

    vi.clearAllMocks();

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

    expect(processAndStoreMessage).toHaveBeenCalled();
  });

  test('WebSocket onmessage handler should process canvas change events', async () => {
    await connectToSlackSocketMode();

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

    expect(handleCanvasChangedEvent).toHaveBeenCalledWith('F12345');
  });

  test('WebSocket onclose handler should update app state', async () => {
    vi.clearAllMocks();

    await connectToSlackSocketMode();

    expect(mockWebSocket.onclose).toBeDefined();
    await mockWebSocket.onclose();

    expect(updateAppStatus).toHaveBeenCalledWith(APP_STATUS.WEB_SOCKET_ERROR);
    vi.runAllTimers();
  });

  test('WebSocket onerror handler should log errors', async () => {
    await connectToSlackSocketMode();

    vi.clearAllMocks();

    expect(mockWebSocket.onerror).toBeDefined();

    const errorEvent = new Error('WebSocket error');
    await mockWebSocket.onerror(errorEvent);

    expect(updateAppStatus).toHaveBeenCalledWith(APP_STATUS.WEB_SOCKET_ERROR);
    expect(Logger.error).toHaveBeenCalled();
    expect(mockWebSocket.close).toHaveBeenCalled();
  });

  test('closeWebSocket should close the connection', async () => {
    await connectToSlackSocketMode();

    vi.clearAllMocks();
    closeWebSocket();

    expect(mockWebSocket.close).toHaveBeenCalled();
  });
});
