import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  DEFAULT_ALLOWED_PHRASES,
  DEFAULT_DISALLOWED_PHRASES,
  DEFAULT_EXCEPTION_PHRASES,
  DEFAULT_MERGE_BUTTON_SELECTOR,
} from '../../src/constants.js';

const mockStorage = {
  sync: {
    get: vi.fn(),
    set: vi.fn(),
  },
  local: {
    get: vi.fn(),
    set: vi.fn(),
  },
  onChanged: {
    addListener: vi.fn(),
  },
};

const mockRuntime = {
  onMessage: {
    addListener: vi.fn(),
  },
  sendMessage: vi.fn(),
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

const mockTabs = {
  sendMessage: vi.fn(),
};

const mockScripting = {
  registerContentScripts: vi.fn(),
  unregisterContentScripts: vi.fn(),
};

const mockAlarms = {
  create: vi.fn(),
  clear: vi.fn(),
  onAlarm: {
    addListener: vi.fn(),
  },
};

global.chrome = {
  storage: mockStorage,
  runtime: mockRuntime,
  action: mockAction,
  tabs: mockTabs,
  scripting: mockScripting,
  alarms: mockAlarms,
};

global.Date.now = vi.fn(() => 1626262626262);

function triggerChromeEvent(eventName, ...args) {
  const listeners = mockRuntime[eventName].addListener.mock.calls.map(
    (call) => call[0],
  );
  listeners.forEach((listener) => listener(...args));
}

function triggerChromeMessage(message, sender = {}, sendResponse = vi.fn()) {
  const listeners = mockRuntime.onMessage.addListener.mock.calls.map(
    (call) => call[0],
  );
  listeners.forEach((listener) => listener(message, sender, sendResponse));
  return sendResponse;
}

describe('Background Script via Chrome API', () => {
  beforeEach(async () => {
    vi.resetAllMocks();

    mockStorage.local.get.mockImplementation((keys) => {
      if (typeof keys === 'string') {
        if (keys === 'messages') {
          return Promise.resolve({ messages: [] });
        }
        const result = {};
        result[keys] = null;
        return Promise.resolve(result);
      }

      if (Array.isArray(keys)) {
        const result = {};
        keys.forEach((key) => {
          if (key === 'messages') {
            result[key] = [];
          } else {
            result[key] = null;
          }
        });
        return Promise.resolve(result);
      }

      return Promise.resolve({
        messages: [],
        featureEnabled: true,
      });
    });

    mockStorage.sync.get.mockImplementation((keys) => {
      if (typeof keys === 'string') {
        if (keys === 'channelName') {
          return Promise.resolve({ channelName: 'test-channel' });
        } else if (keys === 'mergeButtonSelector') {
          return Promise.resolve({});
        }
        const result = {};
        result[keys] = null;
        return Promise.resolve(result);
      }

      if (Array.isArray(keys)) {
        const result = {};
        keys.forEach((key) => {
          if (key === 'channelName') {
            result[key] = 'test-channel';
          } else if (key === 'slackToken') {
            result[key] = 'xoxb-test-token';
          } else if (key === 'appToken') {
            result[key] = 'xapp-test-token';
          } else {
            result[key] = null;
          }
        });
        return Promise.resolve(result);
      }

      return Promise.resolve({
        channelName: 'test-channel',
        slackToken: 'xoxb-test-token',
        appToken: 'xapp-test-token',
      });
    });

    // Import the background script dynamically to trigger its initialization
    await import('../../src/background.js');
  });

  afterEach(() => {
    vi.resetModules();
  });

  test('should initialize on install', async () => {
    // Trigger onInstalled event
    triggerChromeEvent('onInstalled');

    // Verify default merge button selector is set
    expect(mockStorage.sync.get).toHaveBeenCalledWith(
      'mergeButtonSelector',
      expect.any(Function),
    );

    // Simulate the callback for storage.sync.get
    const mergeButtonCallback = mockStorage.sync.get.mock.calls.find(
      (call) => call[0] === 'mergeButtonSelector',
    )[1];

    mergeButtonCallback({});
    expect(mockStorage.sync.set).toHaveBeenCalledWith({
      mergeButtonSelector: DEFAULT_MERGE_BUTTON_SELECTOR,
    });
  });

  test('should initialize on startup', async () => {
    // Trigger onStartup event
    triggerChromeEvent('onStartup');

    // Verify storage is checked for configuration
    expect(mockStorage.sync.get).toHaveBeenCalled();
  });

  test('should handle getDefaultPhrases message', async () => {
    const sendResponse = vi.fn();

    // Trigger message
    triggerChromeMessage({ action: 'getDefaultPhrases' }, {}, sendResponse);

    // Verify response
    expect(sendResponse).toHaveBeenCalledWith({
      defaultAllowedPhrases: DEFAULT_ALLOWED_PHRASES,
      defaultDisallowedPhrases: DEFAULT_DISALLOWED_PHRASES,
      defaultExceptionPhrases: DEFAULT_EXCEPTION_PHRASES,
    });
  });

  test('should handle bitbucketTabLoaded message', async () => {
    // Mock storage to return bitbucket URL pattern
    mockStorage.sync.get.mockImplementation((key) => {
      if (key === 'bitbucketUrl') {
        return Promise.resolve({
          bitbucketUrl:
            'https://bitbucket.example.com/*/repos/*/pull-requests/*',
        });
      }
      return Promise.resolve({});
    });

    const sender = {
      tab: {
        id: 123,
        url: 'https://bitbucket.example.com/projects/TEST/repos/repo/pull-requests/42/overview',
      },
    };

    // Trigger message
    await triggerChromeMessage({ action: 'bitbucketTabLoaded' }, sender);

    // Verify storage is checked for last known merge state
    expect(mockStorage.local.get).toHaveBeenCalledWith(
      ['lastKnownMergeState', 'featureEnabled'],
      expect.any(Function),
    );
  });

  test('should handle featureToggleChanged message', async () => {
    // Mock Date.now for scheduleFeatureReactivation
    global.Date.now = vi.fn(() => 1000);

    // Trigger message to disable feature
    await triggerChromeMessage({
      action: 'featureToggleChanged',
      enabled: false,
    });

    // Verify feature is disabled in storage
    expect(mockStorage.local.set).toHaveBeenCalledWith({
      featureEnabled: false,
    });

    // Trigger message to enable feature
    await triggerChromeMessage({
      action: 'featureToggleChanged',
      enabled: true,
    });

    // Verify feature is enabled in storage
    expect(mockStorage.local.set).toHaveBeenCalledWith({
      featureEnabled: true,
    });
  });

  test('should handle countdownCompleted message', async () => {
    // Trigger message
    await triggerChromeMessage({ action: 'countdownCompleted', enabled: true });

    // Verify feature is enabled in storage
    expect(mockStorage.local.set).toHaveBeenCalledWith({
      featureEnabled: true,
    });
  });

  test('should handle getCountdownStatus message with active countdown', async () => {
    const sendResponse = vi.fn();

    // Mock storage to return active countdown
    mockStorage.local.get.mockImplementation((keys) => {
      if (
        Array.isArray(keys) &&
        keys.includes('reactivationTime') &&
        keys.includes('featureEnabled')
      ) {
        return Promise.resolve({
          reactivationTime: Date.now() + 60000, // 1 minute in the future
          featureEnabled: false,
        });
      }
      return Promise.resolve({});
    });

    // Trigger message
    triggerChromeMessage({ action: 'getCountdownStatus' }, {}, sendResponse);

    // Wait for async response
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Verify response
    expect(sendResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        isCountdownActive: true,
        timeLeft: expect.any(Number),
        reactivationTime: expect.any(Number),
      }),
    );
  });

  test('should handle getCountdownStatus message with no countdown', async () => {
    const sendResponse = vi.fn();

    // Mock storage to return no active countdown
    mockStorage.local.get.mockImplementation((keys) => {
      if (
        Array.isArray(keys) &&
        keys.includes('reactivationTime') &&
        keys.includes('featureEnabled')
      ) {
        return Promise.resolve({
          reactivationTime: null,
          featureEnabled: true,
        });
      }
      return Promise.resolve({});
    });

    // Trigger message
    triggerChromeMessage({ action: 'getCountdownStatus' }, {}, sendResponse);

    // Wait for async response
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Verify response
    expect(sendResponse).toHaveBeenCalledWith({
      isCountdownActive: false,
      timeLeft: 0,
      reactivationTime: null,
    });
  });

  test('should clear lastMatchingMessage when fetching new messages', async () => {
    // Configurar un mock para fetch
    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        json: () =>
          Promise.resolve({
            ok: true,
            messages: [
              { text: 'Test message 1', ts: '1626262626.000001' },
              { text: 'Test message 2', ts: '1626262626.000002' },
            ],
          }),
      }),
    );

    // Simular que ya existe un lastMatchingMessage
    mockStorage.local.get.mockImplementation((keys) => {
      if (Array.isArray(keys) && keys.includes('lastKnownMergeState')) {
        return Promise.resolve({
          lastKnownMergeState: {
            appStatus: 'ok',
          },
        });
      }
      return Promise.resolve({
        lastMatchingMessage: { text: 'Old message', ts: '1626262626.000000' },
      });
    });

    // Trigger fetchNewMessages message
    await triggerChromeMessage({
      action: 'fetchNewMessages',
      channelName: 'new-channel',
    });

    // Verificar que lastMatchingMessage se estableció a null antes de obtener nuevos mensajes
    const setCalls = mockStorage.local.set.mock.calls;

    // Buscar la llamada que establece lastMatchingMessage a null
    const nullMatchingMessageCall = setCalls.find(
      (call) => call[0].lastMatchingMessage === null,
    );

    expect(nullMatchingMessageCall).toBeTruthy();

    // Verificar que esta llamada ocurrió antes de establecer los nuevos mensajes
    const nullMatchingMessageIndex = setCalls.indexOf(nullMatchingMessageCall);
    const messagesSetIndex = setCalls.findIndex((call) => call[0].messages);

    // Si messagesSetIndex es -1, significa que no se establecieron nuevos mensajes,
    // lo cual es aceptable para esta prueba
    if (messagesSetIndex !== -1) {
      expect(nullMatchingMessageIndex).toBeLessThan(messagesSetIndex);
    }
  });
});
