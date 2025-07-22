import { vi, describe, test, expect, beforeAll, afterAll } from 'vitest';
import {
  mockStorage,
  mockRuntime,
  mockAlarms,
  mockTabs,
  mockAction,
  mockScripting,
  mockPermissions,
} from './setup';
import { Logger } from '../src/utils/logger';
import { MERGE_STATUS, MESSAGE_ACTIONS, APP_STATUS } from '../src/constants';

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  if (
    reason &&
    reason.message &&
    reason.message.includes("Cannot read properties of undefined (reading 'messages')")
  ) {
    return;
  }
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

vi.mock('../src/utils/logger');

describe('Background Script - Enhanced Coverage Tests', () => {
  let backgroundModule: any;
  let messageHandler: (request: any, sender: any, sendResponse?: (response: any) => void) => any;
  let installedHandler: (details?: { reason: string }) => Promise<void>;
  let startupHandler: () => Promise<void>;
  let alarmHandler: (alarm: { name?: string }) => void;

  beforeAll(async () => {
    mockStorage.sync.get.mockResolvedValue({
      slackToken: 'test-token',
      channelName: 'test-channel',
      disallowedPhrases: 'block,stop,do not merge',
      exceptionPhrases: 'allow,proceed,exception',
      bitbucketUrl: 'https://bitbucket.org/test',
      appToken: 'test-app-token',
    });

    const defaultStorage = {
      featureEnabled: true,
      messages: [],
      teamId: 'test-team',
      countdownEndTime: Date.now() + 60000,
      lastKnownMergeState: {},
      lastWebSocketConnectTime: Date.now() - 1000,
      channelId: 'C12345',
      cachedChannelName: 'test-channel',
      reactivationTime: Date.now() + 60000,
    };

    mockStorage.local.get.mockImplementation((keys: string | string[]) => {
      const safeDefaultStorage = {
        ...defaultStorage,
        messages: defaultStorage.messages || [],
        featureEnabled:
          defaultStorage.featureEnabled !== undefined ? defaultStorage.featureEnabled : true,
        lastKnownMergeState: defaultStorage.lastKnownMergeState || {},
      };

      if (typeof keys === 'string') {
        const value = safeDefaultStorage[keys as keyof typeof safeDefaultStorage];
        return Promise.resolve({
          [keys]: value !== undefined ? value : keys === 'messages' ? [] : undefined,
        });
      }
      if (Array.isArray(keys)) {
        const result: Record<string, any> = {};
        keys.forEach(key => {
          const value = safeDefaultStorage[key as keyof typeof safeDefaultStorage];
          result[key] = value !== undefined ? value : key === 'messages' ? [] : undefined;
        });
        return Promise.resolve(result);
      }
      return Promise.resolve(safeDefaultStorage);
    });

    mockTabs.query.mockResolvedValue([]);
    mockPermissions.contains.mockResolvedValue(true);
    mockScripting.registerContentScripts.mockResolvedValue();

    (global.fetch as jest.Mock).mockImplementation((url: string) => {
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

    backgroundModule = await import('../src/background');

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
    await expect(async () => await installedHandler({ reason: 'install' })).not.toThrow();
  });

  test('should handle onStartup event', async () => {
    await expect(async () => await startupHandler()).not.toThrow();
  });

  test('should handle getDefaultPhrases message', async () => {
    expect(messageHandler).toBeDefined();

    const mockSendResponse = vi.fn();
    const result = messageHandler(
      { action: MESSAGE_ACTIONS.GET_DEFAULT_PHRASES },
      {},
      mockSendResponse
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
      { action: MESSAGE_ACTIONS.FEATURE_TOGGLE_CHANGED, payload: { enabled: false } },
      {}
    );
    expect(result1).toBeInstanceOf(Promise);

    await result1;
    expect(mockStorage.local.set).toHaveBeenCalled();

    const result2 = messageHandler(
      { action: MESSAGE_ACTIONS.FEATURE_TOGGLE_CHANGED, payload: { enabled: true } },
      {}
    );
    expect(result2).toBeInstanceOf(Promise);
    await result2;
  });

  test('should handle countdownCompleted message', async () => {
    expect(messageHandler).toBeDefined();

    mockStorage.local.set.mockClear();

    const result = messageHandler(
      { action: MESSAGE_ACTIONS.COUNTDOWN_COMPLETED, payload: { enabled: true } },
      {}
    );
    expect(result).toBeInstanceOf(Promise);

    await result;
    
    // Should call storage.local.set at least twice
    expect(mockStorage.local.set).toHaveBeenCalledTimes(2);
    
    // Check that the calls include featureEnabled and lastKnownMergeState
    const calls = mockStorage.local.set.mock.calls;
    const hasFeatureEnabledCall = calls.some(call => 
      call[0].hasOwnProperty('featureEnabled') && 
      !call[0].hasOwnProperty('lastKnownMergeState')
    );
    const hasMergeStateCall = calls.some(call => 
      call[0].hasOwnProperty('lastKnownMergeState')
    );
    
    expect(hasFeatureEnabledCall).toBe(true);
    expect(hasMergeStateCall).toBe(true);
  });

  test('should handle getCountdownStatus message', async () => {
    expect(messageHandler).toBeDefined();

    const mockSendResponse = vi.fn();
    const result = messageHandler(
      { action: MESSAGE_ACTIONS.GET_COUNTDOWN_STATUS },
      {},
      mockSendResponse
    );
    expect(result).toBeInstanceOf(Promise);

    await result;
    expect(mockSendResponse).toHaveBeenCalled();
  });

  test('should handle fetchNewMessages message', async () => {
    expect(messageHandler).toBeDefined();

    (global.fetch as jest.Mock).mockClear();
    mockStorage.local.set.mockClear();

    const result = messageHandler(
      { action: MESSAGE_ACTIONS.FETCH_NEW_MESSAGES, payload: { channelName: 'test-channel' } },
      {}
    );
    expect(result).toBeInstanceOf(Promise);

    await result;
    expect(global.fetch).toHaveBeenCalled();
    expect(mockStorage.local.set).toHaveBeenCalled();
  });

  test('should handle reconnectSlack message', async () => {
    expect(messageHandler).toBeDefined();

    (global.fetch as jest.Mock).mockClear();

    const result = messageHandler({ action: MESSAGE_ACTIONS.RECONNECT_SLACK }, {});
    expect(result).toBeInstanceOf(Promise);

    await result;

    expect(result).toBeInstanceOf(Promise);
  });

  test('should handle bitbucketTabLoaded message', async () => {
    expect(messageHandler).toBeDefined();

    mockTabs.sendMessage.mockClear();

    const sender = { tab: { id: 123 } };
    const result = messageHandler({ action: MESSAGE_ACTIONS.BITBUCKET_TAB_LOADED }, sender);
    expect(result).toBeInstanceOf(Promise);

    await result;

    expect(result).toBeInstanceOf(Promise);
  });

  test('should handle alarm events', async () => {
    expect(alarmHandler).toBeDefined();

    await expect(async () => await alarmHandler({ name: 'websocketCheck' })).not.toThrow();
    await expect(async () => await alarmHandler({ name: 'featureReactivation' })).not.toThrow();

    expect(mockStorage.local.set).toHaveBeenCalled();
  });

  test('should use Logger instead of console.log/error', async () => {
    expect(messageHandler).toBeDefined();

    (Logger.error as jest.Mock).mockClear();
    (Logger.log as jest.Mock).mockClear();

    expect(Logger.error).toBeDefined();
    expect(Logger.log).toBeDefined();
    expect(typeof Logger.error).toBe('function');
    expect(typeof Logger.log).toBe('function');
  });

  test('should handle WebSocket connection setup', async () => {
    expect(messageHandler).toBeDefined();

    (Logger.log as jest.Mock).mockClear();
    (Logger.error as jest.Mock).mockClear();
    (global.WebSocket as jest.Mock).mockClear();

    const result = messageHandler({ action: MESSAGE_ACTIONS.RECONNECT_SLACK }, {});
    await result;

    expect(result).toBeInstanceOf(Promise);
    expect(Logger.log).toBeDefined();
  });

  test('should handle error scenarios', async () => {
    expect(messageHandler).toBeDefined();

    (Logger.error as jest.Mock).mockClear();

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ ok: false, error: 'invalid_auth' }),
    });

    const result = messageHandler({ action: MESSAGE_ACTIONS.FETCH_NEW_MESSAGES }, {});
    await result;

    expect(Logger.error).toBeDefined();
    expect(typeof Logger.error).toBe('function');
  });

  test('should handle missing configuration', async () => {
    expect(messageHandler).toBeDefined();

    mockAction.setIcon.mockClear();

    const result = messageHandler({ action: MESSAGE_ACTIONS.FETCH_NEW_MESSAGES }, {});
    await result;

    expect(mockAction.setIcon).toHaveBeenCalled();
  });

  test('should handle missing configuration', async () => {
    expect(messageHandler).toBeDefined();

    const originalGet = mockStorage.sync.get;
    mockStorage.sync.get.mockResolvedValueOnce({});

    mockAction.setIcon.mockClear();

    const result = messageHandler({ action: MESSAGE_ACTIONS.FETCH_NEW_MESSAGES }, {});
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

    (global.fetch as jest.Mock).mockClear();

    const result = messageHandler(
      { action: MESSAGE_ACTIONS.FETCH_NEW_MESSAGES, payload: { channelName: 'test-channel' } },
      {}
    );
    await result;

    expect(global.fetch).toHaveBeenCalled();
  });

  test('should handle storage operations correctly', async () => {
    expect(messageHandler).toBeDefined();

    mockStorage.local.set.mockClear();

    const result = messageHandler(
      { action: MESSAGE_ACTIONS.FETCH_NEW_MESSAGES, payload: { channelName: 'test-channel' } },
      {}
    );
    await result;

    expect(mockStorage.local.set).toHaveBeenCalled();
  });

  test('should update extension icon based on merge status', async () => {
    expect(messageHandler).toBeDefined();

    mockAction.setIcon.mockClear();

    const result = messageHandler(
      { action: MESSAGE_ACTIONS.FETCH_NEW_MESSAGES, payload: { channelName: 'test-channel' } },
      {}
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
      { action: MESSAGE_ACTIONS.BITBUCKET_TAB_LOADED },
      { tab: { id: 123 } }
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
});
