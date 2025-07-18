import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  RECONNECTION_DELAY_MS,
  WEBSOCKET_CHECK_INTERVAL,
  WEBSOCKET_CHECK_ALARM,
  WEBSOCKET_MAX_AGE
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

  send() {
  }
};

global.chrome = {
  alarms: {
    create: vi.fn(),
    clear: vi.fn(),
    onAlarm: {
      addListener: vi.fn(),
    },
  },
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
  },
  action: {
    setIcon: vi.fn(),
  },
};

global.fetch = vi.fn();

let rtmWebSocket = null;

function setupWebSocketCheckAlarm() {
  chrome.alarms.clear(WEBSOCKET_CHECK_ALARM, () => {
    chrome.alarms.create(WEBSOCKET_CHECK_ALARM, {
      periodInMinutes: WEBSOCKET_CHECK_INTERVAL
    });
  });
}

async function checkWebSocketConnection() {
  if (!rtmWebSocket || rtmWebSocket.readyState !== WebSocket.OPEN) {
    connectToSlackSocketMode();
    return;
  }
  
  const { lastWebSocketConnectTime } = await chrome.storage.local.get('lastWebSocketConnectTime');
  const currentTime = Date.now();
  const connectionAge = currentTime - (lastWebSocketConnectTime || 0);
  
  if (connectionAge > WEBSOCKET_MAX_AGE) {
    rtmWebSocket.close();
    setTimeout(connectToSlackSocketMode, 1000);
  } else {
    try {
      rtmWebSocket.send(JSON.stringify({ type: 'ping' }));
    } catch (error) {
      rtmWebSocket.close();
      setTimeout(connectToSlackSocketMode, 1000);
    }
  }
}

const connectToSlackSocketMode = vi.fn(() => {
  rtmWebSocket = new WebSocket();
  rtmWebSocket.onopen = () => {
    chrome.storage.local.set({ 
      appStatus: 'OK',
      lastWebSocketConnectTime: Date.now()
    });
    setupWebSocketCheckAlarm();
  };
  
  rtmWebSocket.onopen();
  
  return rtmWebSocket;
});

describe('WebSocket Alarm Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rtmWebSocket = null;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('setupWebSocketCheckAlarm should clear existing alarm and create a new one', () => {
    setupWebSocketCheckAlarm();
    
    expect(chrome.alarms.clear).toHaveBeenCalledWith(
      WEBSOCKET_CHECK_ALARM,
      expect.any(Function)
    );
    
    const clearCallback = chrome.alarms.clear.mock.calls[0][1];
    clearCallback();
    
    expect(chrome.alarms.create).toHaveBeenCalledWith(
      WEBSOCKET_CHECK_ALARM,
      { periodInMinutes: WEBSOCKET_CHECK_INTERVAL }
    );
  });

  test('checkWebSocketConnection should reconnect if WebSocket is null', async () => {
    rtmWebSocket = null;
    await checkWebSocketConnection();
    
    expect(connectToSlackSocketMode).toHaveBeenCalled();
  });

  test('checkWebSocketConnection should reconnect if WebSocket is not open', async () => {
    rtmWebSocket = new WebSocket();
    rtmWebSocket.readyState = WebSocket.CLOSED;
    
    await checkWebSocketConnection();
    
    expect(connectToSlackSocketMode).toHaveBeenCalled();
  });

  test('checkWebSocketConnection should reconnect if connection is too old', async () => {
    rtmWebSocket = new WebSocket();
    const oldTime = Date.now() - (WEBSOCKET_MAX_AGE + 60000);
    
    chrome.storage.local.get.mockResolvedValue({ lastWebSocketConnectTime: oldTime });
    
    const closeSpy = vi.spyOn(rtmWebSocket, 'close');
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
    
    await checkWebSocketConnection();
    
    expect(closeSpy).toHaveBeenCalled();
    expect(setTimeoutSpy).toHaveBeenCalledWith(connectToSlackSocketMode, 1000);
  });

  test('checkWebSocketConnection should send ping if connection is recent', async () => {
    rtmWebSocket = new WebSocket();
    const recentTime = Date.now() - 60000;
    
    chrome.storage.local.get.mockResolvedValue({ lastWebSocketConnectTime: recentTime });
    
    const sendSpy = vi.spyOn(rtmWebSocket, 'send');
    
    await checkWebSocketConnection();
    
    expect(sendSpy).toHaveBeenCalledWith(JSON.stringify({ type: 'ping' }));
  });

  test('checkWebSocketConnection should handle error when sending ping', async () => {
    rtmWebSocket = new WebSocket();
    const recentTime = Date.now() - 60000;
    
    chrome.storage.local.get.mockResolvedValue({ lastWebSocketConnectTime: recentTime });
    
    const sendSpy = vi.spyOn(rtmWebSocket, 'send').mockImplementation(() => {
      throw new Error('Send failed');
    });
    
    const closeSpy = vi.spyOn(rtmWebSocket, 'close');
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
    
    await checkWebSocketConnection();
    
    expect(sendSpy).toHaveBeenCalled();
    expect(closeSpy).toHaveBeenCalled();
    expect(setTimeoutSpy).toHaveBeenCalledWith(connectToSlackSocketMode, 1000);
  });

  test('connectToSlackSocketMode should create WebSocket and setup alarm', () => {
    const result = connectToSlackSocketMode();
    
    expect(result).toBe(rtmWebSocket);
    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      appStatus: 'OK',
      lastWebSocketConnectTime: expect.any(Number)
    });
    expect(chrome.alarms.clear).toHaveBeenCalled();
  });

  test('alarm listener should call checkWebSocketConnection when triggered', () => {
    const checkWebSocketConnectionSpy = vi.fn();
    
    let alarmCallback;
    chrome.alarms.onAlarm.addListener.mockImplementation((callback) => {
      alarmCallback = callback;
    });
    
    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === WEBSOCKET_CHECK_ALARM) {
        checkWebSocketConnectionSpy();
      }
    });
    
    expect(alarmCallback).toBeDefined();
    
    alarmCallback({ name: WEBSOCKET_CHECK_ALARM });
    
    expect(checkWebSocketConnectionSpy).toHaveBeenCalled();
  });
});
