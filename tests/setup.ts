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
    addListener: vi.fn(_callback => {}),
  },
  onStartup: {
    addListener: vi.fn(_callback => {}),
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

interface _ChromeMock {
  storage: typeof mockStorage;
  runtime: typeof mockRuntime;
  alarms: typeof mockAlarms;
  tabs: typeof mockTabs;
  action: typeof mockAction;
  scripting: typeof mockScripting;
  permissions: typeof mockPermissions;
}

(global as any).chrome = {
  storage: mockStorage,
  runtime: mockRuntime,
  alarms: mockAlarms,
  tabs: mockTabs,
  action: mockAction,
  scripting: mockScripting,
  permissions: mockPermissions,
};

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

(global.WebSocket as any).CONNECTING = 0;
(global.WebSocket as any).OPEN = 1;
(global.WebSocket as any).CLOSING = 2;
(global.WebSocket as any).CLOSED = 3;

(global as any).fetch = vi.fn();

export const mockFetchError = new Error('--mocked-fetch-error--');
export const mockFetchResponses = <T extends { mustReject?: boolean; response?: { ok: boolean } }>(
  dataResponses: T[]
) => {
  const mockFetch = vi.mocked(fetch);
  dataResponses.forEach(data => {
    if (data.mustReject) {
      mockFetch.mockRejectedValueOnce(mockFetchError);
    } else {
      mockFetch.mockResolvedValueOnce(
        Object.assign(new Response(), {
          json: () => Promise.resolve(data.response),
        })
      );
    }
  });
  mockFetch.mockResolvedValue(
    Object.assign(new Response(), {
      json: () => Promise.resolve({ ok: true }),
    })
  );
};

// Mock for the global document object
(global as any).document = {
  getElementById: vi.fn(),

  // Mock for createElement that supports Shadow DOM
  createElement: vi.fn(tagName => {
    // Create a mock for the shadowRoot
    const shadowRoot = {
      innerHTML: '',
      querySelector: vi.fn(),
      querySelectorAll: vi.fn(() => []),
      appendChild: vi.fn(),
    };

    // Create a mock element with Shadow DOM support
    const element = {
      tagName,
      id: '',
      style: {
        display: '',
        fontSize: '',
        marginTop: '',
        color: '',
      },
      appendChild: vi.fn(),
      setAttribute: vi.fn(),
      removeAttribute: vi.fn(),
      addEventListener: vi.fn(),
      hasAttribute: vi.fn().mockReturnValue(false),
      getAttribute: vi.fn().mockReturnValue(null),

      // Method to create a Shadow DOM
      attachShadow: vi.fn(() => shadowRoot),

      // Pre-configured shadowRoot property
      shadowRoot: shadowRoot,
    };

    return element;
  }),

  querySelector: vi.fn(),
  querySelectorAll: vi.fn(() => []),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),

  // Mock for the document body
  body: {
    appendChild: vi.fn(),
    removeChild: vi.fn(),
    contains: vi.fn(() => true),
  },
};
