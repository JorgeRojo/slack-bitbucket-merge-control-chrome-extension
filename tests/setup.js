import { vi } from 'vitest';

// Mock para la clase Logger
vi.mock('../src/utils/logger.js', () => ({
  Logger: {
    log: vi.fn(),
    error: vi.fn(),
  },
}));

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

const setupDefaultMockResponses = () => {
  mockStorage.sync.get.mockResolvedValue({
    slackToken: 'test-token',
    channelName: 'test-channel',
    disallowedPhrases: 'block,stop,do not merge',
    exceptionPhrases: 'allow,proceed,exception',
    bitbucketUrl: 'https://bitbucket.org/test',
  });

  mockStorage.local.get.mockResolvedValue({
    featureEnabled: true,
    messages: [],
    teamId: 'test-team',
    countdownEndTime: Date.now() + 60000,
  });

  mockTabs.query.mockResolvedValue([]);
  mockPermissions.contains.mockResolvedValue(true);
  mockScripting.registerContentScripts.mockResolvedValue();

  global.fetch.mockImplementation((url) => {
    if (url.includes('conversations.list')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            ok: true,
            channels: [{ id: 'C123', name: 'test-channel' }],
            response_metadata: { next_cursor: '' },
          }),
      });
    }
    if (url.includes('conversations.history')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            ok: true,
            messages: [
              { text: 'test message with block phrase', ts: '1234567890' },
              { text: 'allow this merge', ts: '1234567891' },
            ],
          }),
      });
    }
    if (url.includes('team.info')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            ok: true,
            team: { id: 'T123', name: 'Test Team' },
          }),
      });
    }
    if (url.includes('apps.connections.open')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            ok: true,
            url: 'wss://test-websocket-url',
          }),
      });
    }
    return Promise.resolve({
      ok: false,
      json: () => Promise.resolve({ ok: false, error: 'not_found' }),
    });
  });
};

setupDefaultMockResponses();

// Store original console methods for restoration
const originalConsole = {
  error: console.error,
  warn: console.warn,
  log: console.log,
};

// Utility functions for console management
export const silenceConsole = () => {
  console.error = vi.fn();
  console.warn = vi.fn();
  console.log = vi.fn();
};

export const restoreConsole = () => {
  console.error = originalConsole.error;
  console.warn = originalConsole.warn;
  console.log = originalConsole.log;
};
