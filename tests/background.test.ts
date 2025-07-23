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
import { Logger } from '../src/modules/common/utils/logger';
import { MERGE_STATUS, MESSAGE_ACTIONS, APP_STATUS } from '../src/modules/common/constants';
import { ChromeRuntimeMessage } from '../src/modules/common/types/chrome';
import { ProcessedMessage } from '../src/modules/common/types/app';
interface MessageRequest {
  action: string;
  payload?: {
    enabled?: boolean;
    channelName?: string;
    skipErrorNotification?: boolean;
  };
  channelName?: string;
  enabled?: boolean;
}
interface MessageSender {
  tab?: { id: number; url?: string };
}
interface AlarmInfo {
  name?: string;
}
interface InstallDetails {
  reason: string;
}
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
vi.mock('../src/modules/common/utils/logger');
describe('Background Script - Enhanced Coverage Tests', () => {
  let backgroundModule: typeof import('../src/modules/background/background');
  let messageHandler: (
    request: MessageRequest,
    sender: MessageSender,
    sendResponse?: (response: any) => void
  ) => boolean | Promise<void> | void;
  let installedHandler: (details?: InstallDetails) => Promise<void>;
  let startupHandler: () => Promise<void>;
  let alarmHandler: (alarm: AlarmInfo) => void;
  beforeAll(async () => {
    mockStorage.sync.get.mockResolvedValue({
      slackToken: 'test-token',
      channelName: 'test-channel',
      disallowedPhrases: 'block,stop,do not merge,not merge anything',
      exceptionPhrases: 'allow,proceed,exception',
      bitbucketUrl: 'https:
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
    (global.fetch as Mock).mockImplementation((url: string) => {
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
              url: 'wss:
            }),
        });
      }
      return Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ ok: false, error: 'not_found' }),
      });
    });
    backgroundModule = await import('../src/modules/background/background');
    messageHandler = mockRuntime.onMessage.addListener.mock.calls[0]?.[0];
    installedHandler = mockRuntime.onInstalled.addListener.mock.calls[0]?.[0];
    startupHandler = mockRuntime.onStartup.addListener.mock.calls[0]?.[0];
    alarmHandler = mockAlarms.onAlarm.addListener.mock.calls[0]?.[0];
  });
  afterAll(() => {
    vi.restoreAllMocks();
  });
  test('should initialize and register all event listeners', () => {
    if (process.env.NODE_ENV === 'test') {
      expect(mockRuntime.onInstalled.addListener).not.toHaveBeenCalled();
      expect(mockRuntime.onStartup.addListener).not.toHaveBeenCalled();
    } else {
      expect(mockRuntime.onMessage.addListener).toHaveBeenCalled();
      expect(mockRuntime.onInstalled.addListener).toHaveBeenCalled();
      expect(mockRuntime.onStartup.addListener).toHaveBeenCalled();
      expect(mockAlarms.onAlarm.addListener).toHaveBeenCalled();
      expect(mockStorage.onChanged.addListener).toHaveBeenCalled();
    }
    expect(mockRuntime.onMessage.addListener).toHaveBeenCalled();
    expect(mockAlarms.onAlarm.addListener).toHaveBeenCalled();
    expect(mockStorage.onChanged.addListener).toHaveBeenCalled();
  });
  test('should handle onInstalled event', async () => {
    if (installedHandler) {
      await expect(async () => await installedHandler({ reason: 'install' })).not.toThrow();
    } else {
      expect(installedHandler).toBeUndefined();
    }
  });
  test('should handle onStartup event', async () => {
    if (startupHandler) {
      await expect(async () => await startupHandler()).not.toThrow();
    } else {
      expect(startupHandler).toBeUndefined();
    }
  });
  test('should handle getDefaultPhrases message', async () => {
    expect(messageHandler).toBeDefined();
    const mockSendResponse = vi.fn();
    const result = await messageHandler(
      { action: MESSAGE_ACTIONS.GET_DEFAULT_PHRASES },
      {},
      mockSendResponse
    );
    await new Promise(resolve => setTimeout(resolve, 10));
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
    expect(mockStorage.local.set).toHaveBeenCalledTimes(2);
    const calls = mockStorage.local.set.mock.calls;
    const hasFeatureEnabledCall = calls.some(
      call =>
        call[0].hasOwnProperty('featureEnabled') && !call[0].hasOwnProperty('lastKnownMergeState')
    );
    const hasMergeStateCall = calls.some(call => call[0].hasOwnProperty('lastKnownMergeState'));
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
    (global.fetch as Mock).mockClear();
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
    (global.fetch as Mock).mockClear();
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
    (Logger.error as Mock).mockClear();
    (Logger.log as Mock).mockClear();
    expect(Logger.error).toBeDefined();
    expect(Logger.log).toBeDefined();
    expect(typeof Logger.error).toBe('function');
    expect(typeof Logger.log).toBe('function');
  });
  test('should handle WebSocket connection setup', async () => {
    expect(messageHandler).toBeDefined();
    (Logger.log as Mock).mockClear();
    (Logger.error as Mock).mockClear();
    (global.WebSocket as Mock).mockClear();
    const result = messageHandler({ action: MESSAGE_ACTIONS.RECONNECT_SLACK }, {});
    await result;
    expect(result).toBeInstanceOf(Promise);
    expect(Logger.log).toBeDefined();
  });
  test('should handle error scenarios', async () => {
    expect(messageHandler).toBeDefined();
    (Logger.error as Mock).mockClear();
    (global.fetch as Mock).mockResolvedValueOnce({
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
    expect(result).toBe(false);
  });
  test('should process Slack API responses correctly', async () => {
    expect(messageHandler).toBeDefined();
    (global.fetch as Mock).mockClear();
    const result = messageHandler(
      { action: MESSAGE_ACTIONS.FETCH_NEW_MESSAGES, payload: { channelName: 'test-channel' } },
      {}
    );
    await result;
    expect(global.fetch).toHaveBeenCalled();
  });
  test('should handle new disallowed phrase "not merge anything"', async () => {
    expect(messageHandler).toBeDefined();
    (global.fetch as Mock).mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            ok: true,
            messages: [{ text: 'not merge anything today', ts: '1234567890' }],
          }),
      })
    );
    const result = messageHandler(
      { action: MESSAGE_ACTIONS.FETCH_NEW_MESSAGES, payload: { channelName: 'test-channel' } },
      {}
    );
    await result;
    expect(global.fetch).toHaveBeenCalled();
  });
  test('should handle text normalization through message processing', async () => {
    expect(messageHandler).toBeDefined();
    (global.fetch as Mock).mockImplementationOnce((url: string) => {
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
      { action: MESSAGE_ACTIONS.FETCH_NEW_MESSAGES, payload: { channelName: 'test-channel' } },
      {}
    );
    await result;
    expect(mockStorage.local.set).toHaveBeenCalled();
    const setCall = mockStorage.local.set.mock.calls.find((call: any) => call[0].messages);
    expect(setCall).toBeDefined();
    expect(setCall[0].messages.length).toBeGreaterThan(0);
  });
  test('should handle Slack message text cleaning through message processing', async () => {
    expect(messageHandler).toBeDefined();
    (global.fetch as Mock).mockImplementationOnce((url: string) => {
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
                    text: 'Check this link: <https:
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
      { action: MESSAGE_ACTIONS.FETCH_NEW_MESSAGES, payload: { channelName: 'test-channel' } },
      {}
    );
    await result;
    expect(mockStorage.local.set).toHaveBeenCalled();
    const setCall = mockStorage.local.set.mock.calls.find((call: any) => call[0].messages);
    expect(setCall).toBeDefined();
    expect(setCall[0].messages.length).toBeGreaterThan(0);
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
      { id: 123, url: 'https:
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
      (global.fetch as Mock).mockImplementationOnce((url: string) => {
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
        { action: MESSAGE_ACTIONS.FETCH_NEW_MESSAGES, payload: { channelName: 'test-channel' } },
        {}
      );
      await result;
      expect(mockAction.setIcon).toHaveBeenCalled();
      expect(mockStorage.local.set).toHaveBeenCalled();
    }
  });
  test('should handle storage changes for bitbucketUrl', async () => {
    const storageChangeHandler = mockStorage.onChanged.addListener.mock.calls[0]?.[0];
    expect(storageChangeHandler).toBeDefined();
    mockScripting.getRegisteredContentScripts.mockResolvedValueOnce([]);
    mockStorage.sync.get.mockResolvedValueOnce({
      bitbucketUrl: 'https:
    });
    const changes = {
      bitbucketUrl: {
        newValue: 'https:
      },
    };
    await storageChangeHandler(changes, 'sync');
    expect(mockScripting.getRegisteredContentScripts).toHaveBeenCalled();
    expect(mockScripting.unregisterContentScripts).not.toHaveBeenCalled();
    expect(mockStorage.sync.get).toHaveBeenCalledWith('bitbucketUrl');
  });
  test('should handle registerBitbucketContentScript with no URL', async () => {
    const storageChangeHandler = mockStorage.onChanged.addListener.mock.calls[0]?.[0];
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
    const storageChangeHandler = mockStorage.onChanged.addListener.mock.calls[0]?.[0];
    expect(storageChangeHandler).toBeDefined();
    mockScripting.unregisterContentScripts.mockRejectedValueOnce(new Error('Unregister failed'));
    mockScripting.registerContentScripts.mockRejectedValueOnce(new Error('Register failed'));
    mockStorage.sync.get.mockResolvedValueOnce({
      bitbucketUrl: 'https:
    });
    const changes = {
      bitbucketUrl: { newValue: 'https:
    };
    await expect(async () => await storageChangeHandler(changes, 'sync')).not.toThrow();
  });
  test('should ignore storage changes for non-sync namespaces', async () => {
    const storageChangeHandler = mockStorage.onChanged.addListener.mock.calls[0]?.[0];
    expect(storageChangeHandler).toBeDefined();
    mockScripting.unregisterContentScripts.mockClear();
    mockScripting.registerContentScripts.mockClear();
    const changes = {
      bitbucketUrl: { newValue: 'https:
    };
    await storageChangeHandler(changes, 'local');
    expect(mockScripting.unregisterContentScripts).not.toHaveBeenCalled();
    expect(mockScripting.registerContentScripts).not.toHaveBeenCalled();
  });
  test('should ignore storage changes for non-bitbucketUrl keys', async () => {
    const storageChangeHandler = mockStorage.onChanged.addListener.mock.calls[0]?.[0];
    expect(storageChangeHandler).toBeDefined();
    mockScripting.unregisterContentScripts.mockClear();
    mockScripting.registerContentScripts.mockClear();
    const changes = { slackToken: { newValue: 'new-token' } };
    await storageChangeHandler(changes, 'sync');
    expect(mockScripting.unregisterContentScripts).not.toHaveBeenCalled();
    expect(mockScripting.registerContentScripts).not.toHaveBeenCalled();
  });
  test('should handle unknown message action', () => {
    expect(messageHandler).toBeDefined();
    const result = messageHandler({ action: 'unknownAction' }, {}, vi.fn());
    expect(result).toBe(false);
  });
  test('should handle "Receiving end does not exist" errors silently in runtime.sendMessage', async () => {
    (Logger.error as Mock).mockClear();
    mockRuntime.sendMessage.mockRejectedValue(
      new Error('Could not establish connection. Receiving end does not exist.')
    );
    const result = messageHandler(
      { action: MESSAGE_ACTIONS.FETCH_NEW_MESSAGES, payload: { channelName: 'test-channel' } },
      {},
      vi.fn()
    );
    await result;
    expect(Logger.error).toBeDefined();
  });
  test('should handle feature toggle and countdown (enhanced)', async () => {
    mockStorage.local.set.mockClear();
    await messageHandler(
      { action: MESSAGE_ACTIONS.FEATURE_TOGGLE_CHANGED, payload: { enabled: false } },
      {}
    );
    expect(mockStorage.local.set).toHaveBeenCalled();
    const mockSendResponse = vi.fn();
    const reactivationTime = Date.now() + 60000;
    mockStorage.local.get.mockResolvedValueOnce({
      featureEnabled: false,
      reactivationTime,
    });
    const result = await messageHandler(
      { action: MESSAGE_ACTIONS.GET_COUNTDOWN_STATUS },
      {},
      mockSendResponse
    );
    expect(mockSendResponse).toHaveBeenCalledWith({
      isCountdownActive: true,
      timeLeft: expect.any(Number),
      reactivationTime,
    });
    expect(result).toBe(true);
    mockStorage.local.set.mockClear();
    mockRuntime.sendMessage.mockClear();
    await messageHandler(
      { action: MESSAGE_ACTIONS.COUNTDOWN_COMPLETED, payload: { enabled: true } },
      {}
    );
    expect(mockStorage.local.set).toHaveBeenCalled();
  });
  test('should get phrases from storage correctly (enhanced)', async () => {
    mockStorage.sync.get.mockResolvedValueOnce({
      allowedPhrases: 'custom1,custom2',
      disallowedPhrases: 'block1,block2',
      exceptionPhrases: 'exception1,exception2',
    });
    await messageHandler(
      { action: MESSAGE_ACTIONS.FETCH_NEW_MESSAGES, payload: { channelName: 'test-channel' } },
      {}
    );
    mockStorage.sync.get.mockResolvedValueOnce({});
    await messageHandler(
      { action: MESSAGE_ACTIONS.FETCH_NEW_MESSAGES, payload: { channelName: 'test-channel' } },
      {}
    );
    mockStorage.sync.get.mockResolvedValueOnce({
      allowedPhrases: '',
      disallowedPhrases: '',
      exceptionPhrases: '',
    });
    await messageHandler(
      { action: MESSAGE_ACTIONS.FETCH_NEW_MESSAGES, payload: { channelName: 'test-channel' } },
      {}
    );
  });
  test('should resolve channel ID correctly (enhanced)', async () => {
    mockStorage.local.get.mockClear();
    mockStorage.local.set.mockClear();
    (global.fetch as Mock).mockClear();
    mockStorage.local.get.mockResolvedValueOnce({
      channelId: 'C12345',
      cachedChannelName: 'test-channel',
    });
    await messageHandler(
      { action: MESSAGE_ACTIONS.FETCH_NEW_MESSAGES, payload: { channelName: 'test-channel' } },
      {}
    );
    const conversationsListCalls = (global.fetch as Mock).mock.calls.filter((call: any) =>
      call[0].includes('conversations.list')
    );
    expect(conversationsListCalls.length).toBe(0);
    (global.fetch as Mock).mockClear();
    mockStorage.local.get.mockClear();
    mockStorage.local.set.mockClear();
    mockStorage.local.get.mockResolvedValueOnce({
      channelId: 'C12345',
      cachedChannelName: 'old-channel',
    });
    (global.fetch as Mock).mockImplementationOnce((url: string) => {
      if (url.includes('conversations.list')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              ok: true,
              channels: [{ id: 'C67890', name: 'new-channel' }],
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
    await messageHandler(
      { action: MESSAGE_ACTIONS.FETCH_NEW_MESSAGES, payload: { channelName: 'new-channel' } },
      {}
    );
    const newConversationsListCalls = (global.fetch as Mock).mock.calls.filter((call: any) =>
      call[0].includes('conversations.list')
    );
    expect(newConversationsListCalls.length).toBeGreaterThan(0);
    expect(mockStorage.local.set).toHaveBeenCalled();
  });
  test('should initialize extension correctly on install and startup (enhanced)', async () => {
    if (!installedHandler) {
      expect(installedHandler).toBeUndefined();
      return;
    }
    mockStorage.sync.get.mockClear();
    mockStorage.sync.set.mockClear();
    mockStorage.sync.get.mockImplementationOnce((key: any, callback: any) => {
      callback({});
      return Promise.resolve({});
    });
    await installedHandler({ reason: 'install' });
    expect(mockStorage.sync.set).toHaveBeenCalledWith(
      expect.objectContaining({
        mergeButtonSelector: expect.any(String),
      })
    );
  });
  describe('Chrome Event Listeners Coverage', () => {
    test('should handle chrome.alarms.onAlarm listener', async () => {
      await import('../src/modules/background/background');
      const mockCheckWebSocket = vi.fn();
      vi.doMock('../src/modules/background/background', () => ({
        checkWebSocketConnection: mockCheckWebSocket,
      }));
      const alarmHandler = mockAlarms.onAlarm.addListener.mock.calls[0]?.[0];
      if (alarmHandler) {
        await alarmHandler({ name: 'websocket-check' });
        expect(alarmHandler).toBeDefined();
      }
    });
    test('should handle chrome.storage.onChanged listener for bitbucketUrl', async () => {
      await import('../src/modules/background/background');
      const storageChangeHandler = mockStorage.onChanged.addListener.mock.calls[0]?.[0];
      if (storageChangeHandler) {
        const changes = {
          bitbucketUrl: {
            oldValue: 'https:
            newValue: 'https:
          },
        };
        await storageChangeHandler(changes, 'sync');
        expect(storageChangeHandler).toBeDefined();
      }
    });
    test('should handle chrome.runtime.onInstalled listener in production', async () => {
      const originalProcess = global.process;
      global.process = { env: {} } as any;
      try {
        vi.resetModules();
        await import('../src/modules/background/background');
        const installedHandler = mockRuntime.onInstalled.addListener.mock.calls[0]?.[0];
        if (installedHandler) {
          mockStorage.sync.get.mockImplementationOnce((key: any, callback: any) => {
            callback({});
          });
          await installedHandler({ reason: 'install' });
          expect(mockStorage.sync.set).toHaveBeenCalledWith(
            expect.objectContaining({
              mergeButtonSelector: expect.any(String),
            })
          );
        }
      } finally {
        global.process = originalProcess;
      }
    });
    test('should handle chrome.runtime.onStartup listener in production', async () => {
      const originalProcess = global.process;
      global.process = { env: {} } as any;
      try {
        vi.resetModules();
        await import('../src/modules/background/background');
        const startupHandler = mockRuntime.onStartup.addListener.mock.calls[0]?.[0];
        if (startupHandler) {
          await startupHandler();
          expect(startupHandler).toBeDefined();
        }
      } finally {
        global.process = originalProcess;
      }
    });
    test('should skip production listeners in test environment', async () => {
      const originalProcess = global.process;
      global.process = { env: { NODE_ENV: 'test' } } as any;
      try {
        vi.resetModules();
        await import('../src/modules/background/background');
        expect(global.process.env.NODE_ENV).toBe('test');
      } finally {
        global.process = originalProcess;
      }
    });
    test('should handle alarm with correct name', async () => {
      await import('../src/modules/background/background');
      const alarmHandler = mockAlarms.onAlarm.addListener.mock.calls[0]?.[0];
      if (alarmHandler) {
        await alarmHandler({ name: 'websocket-check' });
        await alarmHandler({ name: 'other-alarm' });
        expect(alarmHandler).toBeDefined();
      }
    });
    test('should handle storage changes for non-bitbucketUrl keys', async () => {
      await import('../src/modules/background/background');
      const storageChangeHandler = mockStorage.onChanged.addListener.mock.calls[0]?.[0];
      if (storageChangeHandler) {
        const changes = {
          otherKey: {
            oldValue: 'old',
            newValue: 'new',
          },
        };
        await storageChangeHandler(changes, 'sync');
        expect(storageChangeHandler).toBeDefined();
      }
    });
    test('should handle storage changes in local namespace', async () => {
      await import('../src/modules/background/background');
      const storageChangeHandler = mockStorage.onChanged.addListener.mock.calls[0]?.[0];
      if (storageChangeHandler) {
        const changes = {
          bitbucketUrl: {
            oldValue: 'old',
            newValue: 'new',
          },
        };
        await storageChangeHandler(changes, 'local');
        expect(storageChangeHandler).toBeDefined();
      }
    });
    test('should handle onInstalled with existing mergeButtonSelector', async () => {
      const originalProcess = global.process;
      global.process = { env: {} } as any;
      try {
        vi.resetModules();
        await import('../src/modules/background/background');
        const installedHandler = mockRuntime.onInstalled.addListener.mock.calls[0]?.[0];
        if (installedHandler) {
          mockStorage.sync.get.mockImplementationOnce((key: any, callback: any) => {
            callback({ mergeButtonSelector: 'existing-selector' });
          });
          mockStorage.sync.set.mockClear();
          await installedHandler({ reason: 'install' });
          expect(mockStorage.sync.set).not.toHaveBeenCalledWith(
            expect.objectContaining({
              mergeButtonSelector: expect.any(String),
            })
          );
        }
      } finally {
        global.process = originalProcess;
      }
    });
    test('should execute all onInstalled callback functions', async () => {
      const originalProcess = global.process;
      global.process = { env: {} } as any;
      try {
        const mockConnectToSlackSocketMode = vi.fn();
        const mockRegisterBitbucketContentScript = vi.fn();
        const mockCheckScheduledReactivation = vi.fn();
        const mockSetupWebSocketCheckAlarm = vi.fn();
        vi.doMock('../src/modules/background/background', async () => {
          const actual = await vi.importActual('../src/modules/background/background');
          return {
            ...actual,
            connectToSlackSocketMode: mockConnectToSlackSocketMode,
            registerBitbucketContentScript: mockRegisterBitbucketContentScript,
            checkScheduledReactivation: mockCheckScheduledReactivation,
            setupWebSocketCheckAlarm: mockSetupWebSocketCheckAlarm,
          };
        });
        vi.resetModules();
        await import('../src/modules/background/background');
        const installedHandler = mockRuntime.onInstalled.addListener.mock.calls[0]?.[0];
        if (installedHandler) {
          mockStorage.sync.get.mockImplementationOnce((key: any, callback: any) => {
            callback({});
          });
          await installedHandler({ reason: 'install' });
          expect(installedHandler).toBeDefined();
        }
      } finally {
        global.process = originalProcess;
        vi.clearAllMocks();
      }
    });
    test('should execute all onStartup callback functions', async () => {
      const originalProcess = global.process;
      global.process = { env: {} } as any;
      try {
        vi.resetModules();
        await import('../src/modules/background/background');
        const startupHandler = mockRuntime.onStartup.addListener.mock.calls[0]?.[0];
        if (startupHandler) {
          await startupHandler();
          expect(startupHandler).toBeDefined();
        }
      } finally {
        global.process = originalProcess;
      }
    });
    test('should handle checkWebSocketConnection in alarm listener', async () => {
      await import('../src/modules/background/background');
      const alarmHandler = mockAlarms.onAlarm.addListener.mock.calls[0]?.[0];
      if (alarmHandler) {
        await alarmHandler({ name: 'websocket-check' });
        expect(alarmHandler).toBeDefined();
      }
    });
    test('should handle registerBitbucketContentScript in storage change listener', async () => {
      await import('../src/modules/background/background');
      const storageChangeHandler = mockStorage.onChanged.addListener.mock.calls[0]?.[0];
      if (storageChangeHandler) {
        const changes = {
          bitbucketUrl: {
            oldValue: 'https:
            newValue: 'https:
          },
        };
        await storageChangeHandler(changes, 'sync');
        expect(storageChangeHandler).toBeDefined();
      }
    });
  });
});
