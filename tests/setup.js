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

global.chrome = {
  storage: mockStorage,
  runtime: mockRuntime,
  alarms: mockAlarms,
  tabs: mockTabs,
  action: mockAction,
  scripting: mockScripting,
  permissions: mockPermissions,
};

global.WebSocket = vi.fn().mockImplementation(() => ({
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  send: vi.fn(),
  close: vi.fn(),
  readyState: 1,
}));

global.fetch = vi.fn();

global.requestAnimationFrame = vi.fn((callback) => {
  callback();
  return 1;
});
