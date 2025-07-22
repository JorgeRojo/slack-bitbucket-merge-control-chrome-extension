import { vi } from 'vitest';

export const mockStorage = {
  sync: {
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn(),
  },
  local: {
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn(),
  },
  onChanged: {
    addListener: vi.fn(),
  },
};

export const mockRuntime = {
  onMessage: {
    addListener: vi.fn(),
  },
  onInstalled: {
    addListener: vi.fn(),
  },
  onStartup: {
    addListener: vi.fn(),
  },
  sendMessage: vi.fn(),
  openOptionsPage: vi.fn(),
  getURL: vi.fn(() => ''),
  lastError: null,
};

export const mockAlarms = {
  onAlarm: {
    addListener: vi.fn(),
  },
  create: vi.fn(),
  clear: vi.fn(),
};

export const mockTabs = {
  query: vi.fn(),
  sendMessage: vi.fn(),
};

export const mockAction = {
  setIcon: vi.fn(),
  setBadgeText: vi.fn(),
  setBadgeBackgroundColor: vi.fn(),
};

export const mockScripting = {
  registerContentScripts: vi.fn(),
  unregisterContentScripts: vi.fn(),
  getRegisteredContentScripts: vi.fn().mockResolvedValue([]),
};

export const mockPermissions = {
  request: vi.fn(),
  contains: vi.fn(),
};

// Define Chrome mock with TypeScript
interface ChromeMock {
  storage: typeof mockStorage;
  runtime: typeof mockRuntime;
  alarms: typeof mockAlarms;
  tabs: typeof mockTabs;
  action: typeof mockAction;
  scripting: typeof mockScripting;
  permissions: typeof mockPermissions;
}

// Apply the mock to the global object
(global as any).chrome = {
  storage: mockStorage,
  runtime: mockRuntime,
  alarms: mockAlarms,
  tabs: mockTabs,
  action: mockAction,
  scripting: mockScripting,
  permissions: mockPermissions,
};

// Mock WebSocket
class MockWebSocket {
  onopen: (() => void) | null = null;
  onmessage: ((event: any) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: ((error: any) => void) | null = null;
  readyState: number = WebSocket.OPEN;

  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  send = vi.fn();
  close = vi.fn();
}

(global as any).WebSocket = vi.fn().mockImplementation(() => new MockWebSocket());

// Define WebSocket constants that would normally be available
(global.WebSocket as any).CONNECTING = 0;
(global.WebSocket as any).OPEN = 1;
(global.WebSocket as any).CLOSING = 2;
(global.WebSocket as any).CLOSED = 3;

// Mock fetch
(global as any).fetch = vi.fn();

// Mock requestAnimationFrame
(global as any).requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
  callback(0);
  return 1;
});
