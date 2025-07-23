import { vi } from 'vitest';

export const mockStorage = {
  sync: {
    get: vi.fn().mockResolvedValue({}),
    set: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
  },
  local: {
    get: vi.fn().mockResolvedValue({}),
    set: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
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
    addListener: vi.fn(callback => {
      // Don't execute the callback during tests to avoid side effects
      // callback();
    }),
  },
  onStartup: {
    addListener: vi.fn(callback => {
      // Don't execute the callback during tests to avoid side effects
      // callback();
    }),
  },
  sendMessage: vi.fn().mockResolvedValue(undefined),
  openOptionsPage: vi.fn().mockResolvedValue(undefined),
  getURL: vi.fn(() => ''),
  lastError: null,
};

export const mockAlarms = {
  onAlarm: {
    addListener: vi.fn(),
  },
  create: vi.fn().mockResolvedValue(undefined),
  clear: vi.fn().mockResolvedValue(undefined),
};

export const mockTabs = {
  query: vi.fn().mockResolvedValue([]),
  sendMessage: vi.fn().mockResolvedValue(undefined),
};

export const mockAction = {
  setIcon: vi.fn().mockResolvedValue(undefined),
  setBadgeText: vi.fn().mockResolvedValue(undefined),
  setBadgeBackgroundColor: vi.fn().mockResolvedValue(undefined),
};

export const mockScripting = {
  registerContentScripts: vi.fn().mockResolvedValue(undefined),
  unregisterContentScripts: vi.fn().mockResolvedValue(undefined),
  getRegisteredContentScripts: vi.fn().mockResolvedValue([]),
};

export const mockPermissions = {
  request: vi.fn().mockResolvedValue(true),
  contains: vi.fn().mockResolvedValue(true),
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

// Mock document methods
(global as any).document = {
  getElementById: vi.fn(),
  createElement: vi.fn(() => ({
    id: '',
    style: { display: '', fontSize: '', marginTop: '', color: '' },
    appendChild: vi.fn(),
    setAttribute: vi.fn(),
    removeAttribute: vi.fn(),
    addEventListener: vi.fn(),
  })),
  querySelector: vi.fn(),
  querySelectorAll: vi.fn(() => []),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  body: {
    appendChild: vi.fn(),
    removeChild: vi.fn(),
    contains: vi.fn(() => true),
  },
};
