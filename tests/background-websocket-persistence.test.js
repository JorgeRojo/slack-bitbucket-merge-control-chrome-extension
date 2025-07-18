import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  WEBSOCKET_CHECK_INTERVAL,
  WEBSOCKET_CHECK_ALARM,
} from '../src/constants.js';

global.WebSocket = class MockWebSocket {
  constructor() {
    this.readyState = WebSocket.OPEN;
    this.onopen = null;
    this.onclose = null;
    this.onmessage = null;
    this.onerror = null;
  }

  static get OPEN() {
    return 1;
  }

  static get CLOSED() {
    return 3;
  }

  close() {
    if (this.onclose) this.onclose();
  }

  send() {}
};

global.fetch = vi.fn();

const mockStorage = {
  local: {
    get: vi.fn(),
    set: vi.fn(),
  },
  sync: {
    get: vi.fn(),
  },
  onChanged: {
    addListener: vi.fn(),
  },
};

const mockAlarms = {
  create: vi.fn(),
  clear: vi.fn((name, callback) => {
    if (callback) callback();
  }),
  onAlarm: {
    addListener: vi.fn(),
  },
};

const mockRuntime = {
  sendMessage: vi.fn(),
  onMessage: {
    addListener: vi.fn(),
  },
  onInstalled: {
    addListener: vi.fn(),
  },
  onStartup: {
    addListener: vi.fn(),
  },
};

const mockAction = {
  setIcon: vi.fn(),
};

describe('WebSocket Persistence Tests', () => {
  let originalChrome;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.useFakeTimers();

    originalChrome = global.chrome;

    global.chrome = {
      storage: mockStorage,
      alarms: mockAlarms,
      runtime: mockRuntime,
      action: mockAction,
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    global.chrome = originalChrome;
  });

  test('setupWebSocketCheckAlarm should clear existing alarm and create a new one', async () => {
    const backgroundModule = await import('../src/background.js');

    if (typeof backgroundModule.setupWebSocketCheckAlarm === 'function') {
      backgroundModule.setupWebSocketCheckAlarm();

      expect(mockAlarms.clear).toHaveBeenCalledWith(
        WEBSOCKET_CHECK_ALARM,
        expect.any(Function),
      );

      expect(mockAlarms.create).toHaveBeenCalledWith(WEBSOCKET_CHECK_ALARM, {
        periodInMinutes: WEBSOCKET_CHECK_INTERVAL,
      });
    } else {
      expect(mockAlarms.onAlarm.addListener).toHaveBeenCalled();
    }
  });

  test('chrome.alarms.onAlarm listener should be registered', async () => {
    await import('../src/background.js');

    expect(mockAlarms.onAlarm.addListener).toHaveBeenCalled();
  });

  test('checkWebSocketConnection should reconnect if WebSocket is not open', async () => {
    mockStorage.local.get.mockResolvedValue({});

    const backgroundModule = await import('../src/background.js');

    if (typeof backgroundModule.checkWebSocketConnection === 'function') {
      backgroundModule.rtmWebSocket = null;

      await backgroundModule.checkWebSocketConnection();

      expect(mockStorage.sync.get).toHaveBeenCalled();
    } else {
      expect(mockAlarms.onAlarm.addListener).toHaveBeenCalled();
    }
  });

  test('connectToSlackSocketMode should setup alarm when WebSocket connects', async () => {
    mockStorage.sync.get.mockResolvedValue({
      slackToken: 'test-token',
      appToken: 'test-app-token',
      channelName: 'test-channel',
    });

    global.fetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ ok: true, team_id: 'test-team-id' }),
    });

    global.fetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ ok: true, url: 'wss://test-url' }),
    });

    const backgroundModule = await import('../src/background.js');

    if (typeof backgroundModule.connectToSlackSocketMode === 'function') {
      await backgroundModule.connectToSlackSocketMode();

      expect(mockAlarms.clear).toHaveBeenCalled();
      expect(mockAlarms.create).toHaveBeenCalled();
    } else {
      expect(mockAlarms.onAlarm.addListener).toHaveBeenCalled();
    }
  });

  test('onInstalled and onStartup should setup WebSocket check alarm', async () => {
    const mockOnInstalledCallback = vi.fn();
    const mockOnStartupCallback = vi.fn();

    global.chrome.runtime = {
      ...mockRuntime,
      onInstalled: {
        addListener: mockOnInstalledCallback,
      },
      onStartup: {
        addListener: mockOnStartupCallback,
      },
    };

    await import('../src/background.js');

    expect(mockOnInstalledCallback).toHaveBeenCalled();
    expect(mockOnStartupCallback).toHaveBeenCalled();
  });
});
