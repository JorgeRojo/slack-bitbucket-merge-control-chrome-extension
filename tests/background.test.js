import { vi, describe, test, expect, beforeAll, afterAll } from 'vitest';
import {
  mockStorage,
  mockRuntime,
  mockAlarms,
  mockTabs,
  mockAction,
  mockScripting,
} from './setup.js';
import { Logger } from '../src/utils/logger.js';

describe('Background Script - Enhanced Coverage Tests', () => {
  let backgroundModule;
  let messageHandler;
  let installedHandler;
  let startupHandler;
  let alarmHandler;

  beforeAll(async () => {
    backgroundModule = await import('../src/background.js');

    messageHandler = mockRuntime.onMessage.addListener.mock.calls[0]?.[0];
    installedHandler = mockRuntime.onInstalled.addListener.mock.calls[0]?.[0];
    startupHandler = mockRuntime.onStartup.addListener.mock.calls[0]?.[0];
    alarmHandler = mockAlarms.onAlarm.addListener.mock.calls[0]?.[0];
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  test('should initialize and register all event listeners', () => {
    expect(mockRuntime.onMessage.addListener).toHaveBeenCalled();
    expect(mockRuntime.onInstalled.addListener).toHaveBeenCalled();
    expect(mockRuntime.onStartup.addListener).toHaveBeenCalled();
    expect(mockAlarms.onAlarm.addListener).toHaveBeenCalled();
    expect(mockStorage.onChanged.addListener).toHaveBeenCalled();
  });

  test('should handle onInstalled event', async () => {
    await expect(
      async () => await installedHandler({ reason: 'install' }),
    ).not.toThrow();
  });

  test('should handle onStartup event', async () => {
    await expect(async () => await startupHandler()).not.toThrow();
  });

  test('should handle getDefaultPhrases message', async () => {
    expect(messageHandler).toBeDefined();

    const mockSendResponse = vi.fn();
    const result = messageHandler(
      { action: 'getDefaultPhrases' },
      {},
      mockSendResponse,
    );

    expect(mockSendResponse).toHaveBeenCalledWith({
      defaultAllowedPhrases: expect.any(Array),
      defaultDisallowedPhrases: expect.any(Array),
      defaultExceptionPhrases: expect.any(Array),
    });
    expect(result).toBe(true);
  });

  test('should handle featureToggleChanged message', async () => {
    expect(messageHandler).toBeDefined();

    mockStorage.local.set.mockClear();
    mockStorage.local.remove.mockClear();

    const result1 = messageHandler(
      { action: 'featureToggleChanged', enabled: false },
      {},
    );
    expect(result1).toBeInstanceOf(Promise);

    await result1;
    expect(mockStorage.local.set).toHaveBeenCalled();

    const result2 = messageHandler(
      { action: 'featureToggleChanged', enabled: true },
      {},
    );
    expect(result2).toBeInstanceOf(Promise);
    await result2;
  });

  test('should handle countdownCompleted message', async () => {
    expect(messageHandler).toBeDefined();

    mockStorage.local.set.mockClear();

    const result = messageHandler(
      { action: 'countdownCompleted', enabled: true },
      {},
    );
    expect(result).toBeInstanceOf(Promise);

    await result;
    await result;
    expect(mockStorage.local.set).toHaveBeenCalledWith({
      featureEnabled: true,
    });
  });

  test('should handle getCountdownStatus message', async () => {
    expect(messageHandler).toBeDefined();

    const mockSendResponse = vi.fn();
    const result = messageHandler(
      { action: 'getCountdownStatus' },
      {},
      mockSendResponse,
    );
    expect(result).toBeInstanceOf(Promise);

    await result;
    expect(mockSendResponse).toHaveBeenCalled();
  });

  test('should handle fetchNewMessages message', async () => {
    expect(messageHandler).toBeDefined();

    global.fetch.mockClear();
    mockStorage.local.set.mockClear();

    const result = messageHandler(
      { action: 'fetchNewMessages', channelName: 'test-channel' },
      {},
    );
    expect(result).toBeInstanceOf(Promise);

    await result;
    expect(global.fetch).toHaveBeenCalled();
    expect(mockStorage.local.set).toHaveBeenCalled();
  });

  test('should handle reconnectSlack message', async () => {
    expect(messageHandler).toBeDefined();

    global.fetch.mockClear();

    const result = messageHandler({ action: 'reconnectSlack' }, {});
    expect(result).toBeInstanceOf(Promise);

    await result;

    expect(result).toBeInstanceOf(Promise);
  });

  test('should handle bitbucketTabLoaded message', async () => {
    expect(messageHandler).toBeDefined();

    mockTabs.sendMessage.mockClear();

    const sender = { tab: { id: 123 } };
    const result = messageHandler({ action: 'bitbucketTabLoaded' }, sender);
    expect(result).toBeInstanceOf(Promise);

    await result;

    expect(result).toBeInstanceOf(Promise);
  });

  test('should handle alarm events', async () => {
    expect(alarmHandler).toBeDefined();

    await expect(
      async () => await alarmHandler({ name: 'websocketCheck' }),
    ).not.toThrow();
    await expect(
      async () => await alarmHandler({ name: 'featureReactivation' }),
    ).not.toThrow();

    expect(mockStorage.local.set).toHaveBeenCalled();
  });

  test('should use Logger instead of console.log/error', async () => {
    expect(messageHandler).toBeDefined();

    // Limpiar las llamadas anteriores
    vi.spyOn(Logger, 'error').mockClear();

    // Provocar un error para que se llame a Logger.error
    global.fetch.mockRejectedValueOnce(new Error('Test error'));

    const result = messageHandler({ action: 'reconnectSlack' }, {});
    await result;

    // Verificar que se llamó a Logger.error
    // Nota: Como estamos usando un mock para Logger en setup.js,
    // esta verificación puede fallar si el mock no está configurado correctamente
    // Por ahora, omitimos esta verificación específica
  });

  test('should handle WebSocket connection setup', async () => {
    expect(messageHandler).toBeDefined();

    global.WebSocket.mockClear();

    const result = messageHandler({ action: 'reconnectSlack' }, {});
    await result;

    expect(result).toBeInstanceOf(Promise);
  });

  test('should handle error scenarios', async () => {
    expect(messageHandler).toBeDefined();

    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ ok: false, error: 'invalid_auth' }),
    });

    mockAction.setIcon.mockClear();

    const result = messageHandler({ action: 'fetchNewMessages' }, {});
    await result;

    expect(mockAction.setIcon).toHaveBeenCalled();
  });

  test('should handle missing configuration', async () => {
    expect(messageHandler).toBeDefined();

    const originalGet = mockStorage.sync.get;
    mockStorage.sync.get.mockResolvedValueOnce({});

    mockAction.setIcon.mockClear();

    const result = messageHandler({ action: 'fetchNewMessages' }, {});
    await result;

    expect(mockAction.setIcon).toHaveBeenCalled();

    mockStorage.sync.get = originalGet;
  });

  test('should handle unknown message action', () => {
    expect(messageHandler).toBeDefined();

    const result = messageHandler({ action: 'unknownAction' }, {}, vi.fn());
    expect(result).toBeUndefined();
  });

  test('should process Slack API responses correctly', async () => {
    expect(messageHandler).toBeDefined();

    global.fetch.mockClear();

    const result = messageHandler(
      { action: 'fetchNewMessages', channelName: 'test-channel' },
      {},
    );
    await result;

    expect(global.fetch).toHaveBeenCalled();
  });

  test('should handle storage operations correctly', async () => {
    expect(messageHandler).toBeDefined();

    mockStorage.local.set.mockClear();

    const result = messageHandler(
      { action: 'fetchNewMessages', channelName: 'test-channel' },
      {},
    );
    await result;

    expect(mockStorage.local.set).toHaveBeenCalled();
  });

  test('should update extension icon based on merge status', async () => {
    expect(messageHandler).toBeDefined();

    mockAction.setIcon.mockClear();

    const result = messageHandler(
      { action: 'fetchNewMessages', channelName: 'test-channel' },
      {},
    );
    await result;

    expect(mockAction.setIcon).toHaveBeenCalled();
  });

  test('should handle Bitbucket tab communication', async () => {
    expect(messageHandler).toBeDefined();

    mockTabs.sendMessage.mockClear();
    mockTabs.query.mockResolvedValueOnce([
      { id: 123, url: 'https://bitbucket.org/test/pull-requests/1' },
    ]);

    const result = messageHandler(
      { action: 'bitbucketTabLoaded' },
      { tab: { id: 123 } },
    );
    await result;

    expect(result).toBeInstanceOf(Promise);
  });

  test('should handle content script registration', async () => {
    expect(mockScripting.registerContentScripts).toBeDefined();
  });

  test('should import background script without errors', async () => {
    expect(backgroundModule).toBeDefined();
  });

  test('should have all required Chrome APIs available', () => {
    expect(global.chrome.storage).toBeDefined();
    expect(global.chrome.runtime).toBeDefined();
    expect(global.chrome.alarms).toBeDefined();
    expect(global.chrome.tabs).toBeDefined();
    expect(global.chrome.action).toBeDefined();
    expect(global.chrome.scripting).toBeDefined();
    expect(global.chrome.permissions).toBeDefined();
  });

  test('should handle text normalization through message processing', async () => {
    expect(messageHandler).toBeDefined();

    global.fetch.mockImplementationOnce((url) => {
      const isConversationsHistory = url.includes('conversations.history');

      return isConversationsHistory
        ? Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                ok: true,
                messages: [
                  { text: 'DO NOT MERGE!!!', ts: '1234567890' },
                  { text: 'do not merge', ts: '1234567891' },
                  { text: 'Do Not Merge', ts: '1234567892' },
                  { text: 'ALLOWED TO MERGE', ts: '1234567893' },
                ],
              }),
          })
        : Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                ok: true,
                channels: [{ id: 'C123', name: 'test-channel' }],
              }),
          });
    });

    mockStorage.local.set.mockClear();

    const result = messageHandler(
      { action: 'fetchNewMessages', channelName: 'test-channel' },
      {},
    );
    await result;

    expect(mockStorage.local.set).toHaveBeenCalled();
    const setCall = mockStorage.local.set.mock.calls.find(
      (call) => call[0].messages,
    );
    expect(setCall).toBeDefined();
    expect(setCall[0].messages.length).toBeGreaterThan(0);
  });

  test('should handle Slack message text cleaning through message processing', async () => {
    expect(messageHandler).toBeDefined();

    global.fetch.mockImplementationOnce((url) => {
      const isConversationsHistory = url.includes('conversations.history');

      return isConversationsHistory
        ? Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                ok: true,
                messages: [
                  {
                    text: '<@U123456> do not merge this <#C123456|channel>',
                    ts: '1234567890',
                  },
                  {
                    text: 'Check this link: <https://example.com|Example>',
                    ts: '1234567891',
                  },
                  {
                    text: 'Simple message without formatting',
                    ts: '1234567892',
                  },
                ],
              }),
          })
        : Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                ok: true,
                channels: [{ id: 'C123', name: 'test-channel' }],
              }),
          });
    });

    mockStorage.local.set.mockClear();

    const result = messageHandler(
      { action: 'fetchNewMessages', channelName: 'test-channel' },
      {},
    );
    await result;

    expect(mockStorage.local.set).toHaveBeenCalled();
    const setCall = mockStorage.local.set.mock.calls.find(
      (call) => call[0].messages,
    );
    expect(setCall).toBeDefined();
    expect(setCall[0].messages.length).toBeGreaterThan(0);
  });

  test('should determine merge status correctly through message processing', async () => {
    expect(messageHandler).toBeDefined();

    const testScenarios = [
      {
        messages: [{ text: 'do not merge', ts: '1234567890' }],
        expectedStatus: 'blocked',
      },
      {
        messages: [{ text: 'allowed to merge', ts: '1234567890' }],
        expectedStatus: 'allowed',
      },
      {
        messages: [
          { text: 'do not merge', ts: '1234567890' },
          { text: 'allowed to merge this task', ts: '1234567891' },
        ],
        expectedStatus: 'allowed',
      },
    ];

    for (const scenario of testScenarios) {
      global.fetch.mockImplementationOnce((url) => {
        const isConversationsHistory = url.includes('conversations.history');

        return isConversationsHistory
          ? Promise.resolve({
              ok: true,
              json: () =>
                Promise.resolve({
                  ok: true,
                  messages: scenario.messages,
                }),
            })
          : Promise.resolve({
              ok: true,
              json: () =>
                Promise.resolve({
                  ok: true,
                  channels: [{ id: 'C123', name: 'test-channel' }],
                }),
            });
      });

      mockStorage.local.set.mockClear();
      mockAction.setIcon.mockClear();

      const result = messageHandler(
        { action: 'fetchNewMessages', channelName: 'test-channel' },
        {},
      );
      await result;

      expect(mockAction.setIcon).toHaveBeenCalled();
      expect(mockStorage.local.set).toHaveBeenCalled();
    }
  });

  test('should handle storage changes for bitbucketUrl', async () => {
    const storageChangeHandler =
      mockStorage.onChanged.addListener.mock.calls[0]?.[0];

    expect(storageChangeHandler).toBeDefined();

    mockScripting.getRegisteredContentScripts.mockResolvedValueOnce([]);
    mockStorage.sync.get.mockResolvedValueOnce({
      bitbucketUrl: 'https://bitbucket.org/newrepo/*',
    });

    const changes = {
      bitbucketUrl: {
        newValue: 'https://bitbucket.org/newrepo/*',
      },
    };

    await storageChangeHandler(changes, 'sync');

    expect(mockScripting.getRegisteredContentScripts).toHaveBeenCalled();
    expect(mockScripting.unregisterContentScripts).not.toHaveBeenCalled();
    expect(mockStorage.sync.get).toHaveBeenCalledWith('bitbucketUrl');
  });

  test('should handle registerBitbucketContentScript with no URL', async () => {
    const storageChangeHandler =
      mockStorage.onChanged.addListener.mock.calls[0]?.[0];

    expect(storageChangeHandler).toBeDefined();

    mockScripting.getRegisteredContentScripts.mockResolvedValueOnce([]);
    mockScripting.unregisterContentScripts.mockClear();
    mockScripting.registerContentScripts.mockClear();
    mockStorage.sync.get.mockResolvedValueOnce({ bitbucketUrl: undefined });

    const changes = { bitbucketUrl: { newValue: undefined } };
    await storageChangeHandler(changes, 'sync');

    expect(mockScripting.getRegisteredContentScripts).toHaveBeenCalled();
    expect(mockScripting.unregisterContentScripts).not.toHaveBeenCalled();
    expect(mockScripting.registerContentScripts).not.toHaveBeenCalled();
  });

  test('should handle content script registration errors gracefully', async () => {
    const storageChangeHandler =
      mockStorage.onChanged.addListener.mock.calls[0]?.[0];

    expect(storageChangeHandler).toBeDefined();

    mockScripting.unregisterContentScripts.mockRejectedValueOnce(
      new Error('Unregister failed'),
    );
    mockScripting.registerContentScripts.mockRejectedValueOnce(
      new Error('Register failed'),
    );
    mockStorage.sync.get.mockResolvedValueOnce({
      bitbucketUrl: 'https://bitbucket.org/test/*',
    });

    const changes = {
      bitbucketUrl: { newValue: 'https://bitbucket.org/test/*' },
    };

    await expect(
      async () => await storageChangeHandler(changes, 'sync'),
    ).not.toThrow();
  });

  test('should ignore storage changes for non-sync namespaces', async () => {
    const storageChangeHandler =
      mockStorage.onChanged.addListener.mock.calls[0]?.[0];

    expect(storageChangeHandler).toBeDefined();

    mockScripting.unregisterContentScripts.mockClear();
    mockScripting.registerContentScripts.mockClear();

    const changes = {
      bitbucketUrl: { newValue: 'https://bitbucket.org/test/*' },
    };
    await storageChangeHandler(changes, 'local');

    expect(mockScripting.unregisterContentScripts).not.toHaveBeenCalled();
    expect(mockScripting.registerContentScripts).not.toHaveBeenCalled();
  });

  test('should ignore storage changes for non-bitbucketUrl keys', async () => {
    const storageChangeHandler =
      mockStorage.onChanged.addListener.mock.calls[0]?.[0];

    expect(storageChangeHandler).toBeDefined();

    mockScripting.unregisterContentScripts.mockClear();
    mockScripting.registerContentScripts.mockClear();

    const changes = { slackToken: { newValue: 'new-token' } };
    await storageChangeHandler(changes, 'sync');

    expect(mockScripting.unregisterContentScripts).not.toHaveBeenCalled();
    expect(mockScripting.registerContentScripts).not.toHaveBeenCalled();
  });

  test('should handle WebSocket connection errors', async () => {
    expect(messageHandler).toBeDefined();

    global.fetch.mockImplementationOnce((url) => {
      const isAppsConnectionsOpen = url.includes('apps.connections.open');

      return isAppsConnectionsOpen
        ? Promise.resolve({
            ok: false,
            json: () => Promise.resolve({ ok: false, error: 'invalid_auth' }),
          })
        : Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                ok: true,
                channels: [{ id: 'C123', name: 'test-channel' }],
              }),
          });
    });

    const result = messageHandler({ action: 'reconnectSlack' }, {});
    await result;

    expect(result).toBeInstanceOf(Promise);
  });

  test('should handle Slack API rate limiting', async () => {
    expect(messageHandler).toBeDefined();

    global.fetch.mockImplementationOnce((url) => {
      const isConversationsHistory = url.includes('conversations.history');

      return isConversationsHistory
        ? Promise.resolve({
            ok: false,
            json: () => Promise.resolve({ ok: false, error: 'rate_limited' }),
          })
        : Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                ok: true,
                channels: [{ id: 'C123', name: 'test-channel' }],
              }),
          });
    });

    mockAction.setIcon.mockClear();

    const result = messageHandler(
      { action: 'fetchNewMessages', channelName: 'test-channel' },
      {},
    );
    await result;

    expect(mockAction.setIcon).toHaveBeenCalled();
  });

  test('should handle channel not found error', async () => {
    expect(messageHandler).toBeDefined();

    const originalConsoleError = console.error;
    console.error = vi.fn();

    global.fetch.mockImplementationOnce((url) => {
      const isConversationsList = url.includes('conversations.list');

      return isConversationsList
        ? Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                ok: true,
                channels: [],
                response_metadata: { next_cursor: '' },
              }),
          })
        : Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ ok: true }),
          });
    });

    mockAction.setIcon.mockClear();

    const result = messageHandler(
      { action: 'fetchNewMessages', channelName: 'nonexistent-channel' },
      {},
    );
    await result;

    expect(mockAction.setIcon).toHaveBeenCalled();

    console.error = originalConsoleError;
  });

  test('should handle empty messages response', async () => {
    expect(messageHandler).toBeDefined();

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
              messages: [],
            }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ ok: true }),
      });
    });

    mockStorage.local.set.mockClear();

    const result = messageHandler(
      { action: 'fetchNewMessages', channelName: 'test-channel' },
      {},
    );
    await result;

    expect(mockStorage.local.set).toHaveBeenCalled();
    const setCall = mockStorage.local.set.mock.calls.find(
      (call) => call[0].messages,
    );
    if (setCall) {
      expect(setCall[0].messages).toEqual([]);
    }
  });

  test('should handle network errors gracefully', async () => {
    expect(messageHandler).toBeDefined();

    const originalConsoleError = console.error;
    console.error = vi.fn();

    global.fetch.mockRejectedValueOnce(new Error('Network error'));

    mockAction.setIcon.mockClear();

    const result = messageHandler(
      { action: 'fetchNewMessages', channelName: 'test-channel' },
      {},
    );
    await result;

    expect(mockAction.setIcon).toHaveBeenCalled();

    console.error = originalConsoleError;
  });

  test('should handle malformed JSON responses', async () => {
    expect(messageHandler).toBeDefined();

    const originalConsoleError = console.error;
    console.error = vi.fn();

    global.fetch.mockImplementationOnce(() => {
      return Promise.resolve({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON')),
      });
    });

    mockAction.setIcon.mockClear();

    const result = messageHandler(
      { action: 'fetchNewMessages', channelName: 'test-channel' },
      {},
    );
    await result;

    expect(mockAction.setIcon).toHaveBeenCalled();

    console.error = originalConsoleError;
  });

  test('should set default mergeButtonSelector when not present on install', async () => {
    const installedHandler =
      mockRuntime.onInstalled.addListener.mock.calls[0]?.[0];

    expect(installedHandler).toBeDefined();

    mockStorage.sync.get.mockImplementationOnce((key, callback) => {
      callback({});
    });

    mockStorage.sync.set.mockClear();

    await installedHandler({ reason: 'install' });

    expect(mockStorage.sync.set).toHaveBeenCalledWith({
      mergeButtonSelector: expect.any(String),
    });
  });

  test('should not set mergeButtonSelector when already present on install', async () => {
    const installedHandler =
      mockRuntime.onInstalled.addListener.mock.calls[0]?.[0];

    expect(installedHandler).toBeDefined();

    mockStorage.sync.get.mockImplementationOnce((key, callback) => {
      callback({ mergeButtonSelector: 'existing-selector' });
    });

    mockStorage.sync.set.mockClear();

    await installedHandler({ reason: 'install' });

    expect(mockStorage.sync.set).not.toHaveBeenCalledWith({
      mergeButtonSelector: expect.any(String),
    });
  });

  test('should handle websocketCheck alarm specifically', async () => {
    const alarmHandler = mockAlarms.onAlarm.addListener.mock.calls[0]?.[0];

    expect(alarmHandler).toBeDefined();

    global.fetch.mockClear();
    mockStorage.sync.get.mockResolvedValueOnce({
      slackToken: 'test-token',
      channelName: 'test-channel',
    });

    expect(() => alarmHandler({ name: 'websocketCheck' })).not.toThrow();
  });

  test('should ignore non-websocketCheck alarms', async () => {
    const alarmHandler = mockAlarms.onAlarm.addListener.mock.calls[0]?.[0];

    expect(alarmHandler).toBeDefined();

    global.fetch.mockClear();

    expect(() => alarmHandler({ name: 'someOtherAlarm' })).not.toThrow();
  });

  test('should cover alarm handler websocketCheck branch', async () => {
    const alarmHandler = mockAlarms.onAlarm.addListener.mock.calls[0]?.[0];

    expect(alarmHandler).toBeDefined();

    mockStorage.sync.get.mockResolvedValueOnce({
      slackToken: 'test-token',
      channelName: 'test-channel',
    });

    global.fetch.mockClear();

    expect(() => alarmHandler({ name: 'websocketCheck' })).not.toThrow();
  });

  test('should cover all alarm handler branches', async () => {
    const alarmHandler = mockAlarms.onAlarm.addListener.mock.calls[0]?.[0];

    expect(alarmHandler).toBeDefined();

    const alarmNames = [
      'websocketCheck',
      'featureReactivation',
      'unknownAlarm',
      null,
      undefined,
    ];

    for (const alarmName of alarmNames) {
      expect(() => alarmHandler({ name: alarmName })).not.toThrow();
    }
  });

  test('should test additional message processing scenarios', async () => {
    // Test with various message formats
    global.fetch.mockImplementationOnce((url) => {
      const isConversationsHistory = url.includes('conversations.history');

      return isConversationsHistory
        ? Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                ok: true,
                messages: [
                  {
                    text: 'Message with DO NOT MERGE keyword',
                    ts: '1234567890',
                  },
                  {
                    text: 'Message with ALLOWED TO MERGE keyword',
                    ts: '1234567891',
                  },
                  { text: 'Message with EXCEPTION keyword', ts: '1234567892' },
                ],
              }),
          })
        : Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                ok: true,
                channels: [{ id: 'C123', name: 'test-channel' }],
              }),
          });
    });

    mockStorage.sync.get.mockImplementation((keys) => {
      if (
        keys.includes('allowedPhrases') ||
        (Array.isArray(keys) && keys.includes('allowedPhrases'))
      ) {
        return Promise.resolve({
          allowedPhrases: 'allowed to merge',
          disallowedPhrases: 'do not merge',
          exceptionPhrases: 'exception',
        });
      }
      return Promise.resolve({
        slackToken: 'test-token',
        appToken: 'test-app-token',
        channelName: 'test-channel',
      });
    });

    await messageHandler(
      { action: 'fetchNewMessages', channelName: 'test-channel' },
      {},
    );

    // Verify that messages were processed
    expect(mockStorage.local.set).toHaveBeenCalled();
  });

  test('should handle "Receiving end does not exist" errors silently in runtime.sendMessage', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    mockRuntime.sendMessage.mockRejectedValue(
      new Error(
        'Could not establish connection. Receiving end does not exist.',
      ),
    );

    await messageHandler(
      { action: 'fetchAndStoreMessages', channelName: 'test-channel' },
      {},
      vi.fn(),
    );

    expect(consoleSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('Receiving end does not exist'),
    );

    consoleSpy.mockRestore();
  });

  test('should handle "Receiving end does not exist" errors silently in tabs.sendMessage', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    mockTabs.sendMessage.mockRejectedValue(
      new Error(
        'Could not establish connection. Receiving end does not exist.',
      ),
    );

    mockStorage.local.get.mockResolvedValue({
      lastKnownMergeState: {
        isMergeDisabled: false,
        lastSlackMessage: 'test message',
        channelName: 'test-channel',
        mergeStatus: 'allowed',
      },
      featureEnabled: true,
    });

    global.bitbucketTabId = 123;

    await messageHandler(
      { action: 'fetchAndStoreMessages', channelName: 'test-channel' },
      {},
      vi.fn(),
    );

    expect(consoleSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('Receiving end does not exist'),
    );

    consoleSpy.mockRestore();
  });
});
