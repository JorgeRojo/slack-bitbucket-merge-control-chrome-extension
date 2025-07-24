import {
  DEFAULT_ALLOWED_PHRASES,
  DEFAULT_BITBUCKET_URL,
  DEFAULT_CHANNEL_NAME,
  DEFAULT_DISALLOWED_PHRASES,
  DEFAULT_EXCEPTION_PHRASES,
  DEFAULT_MERGE_BUTTON_SELECTOR,
  MESSAGE_ACTIONS,
} from '@src/modules/common/constants';
import { literals } from '@src/modules/common/literals';
import { mockRuntime, mockStorage } from '@tests/setup';
import { Mock, afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
vi.mock('@src/modules/common/utils/logger');
describe('Options Page', () => {
  interface MockElements {
    [key: string]: {
      addEventListener?: typeof vi.fn;
      value?: string;
      textContent?: string;
      className?: string;
    };
  }
  const mockElements: MockElements = {
    save: { addEventListener: vi.fn() },
    slackToken: { value: '' },
    appToken: { value: '' },
    channelName: { value: '' },
    allowedPhrases: { value: '' },
    disallowedPhrases: { value: '' },
    exceptionPhrases: { value: '' },
    bitbucketUrl: { value: '' },
    mergeButtonSelector: { value: '' },
    status: { textContent: '', className: '' },
  };
  (global as any).document = {
    addEventListener: vi.fn(),
    getElementById: vi.fn((id: string) => mockElements[id] || null),
  };
  beforeEach(() => {
    vi.resetAllMocks();
    Object.keys(mockElements).forEach(key => {
      if (key === 'save') {
        mockElements[key].addEventListener = vi.fn();
      } else if (key === 'status') {
        mockElements[key].textContent = '';
        mockElements[key].className = '';
      } else {
        mockElements[key].value = '';
      }
    });
    mockStorage.sync.get.mockImplementation((_keys: string[], callback: Function) => {
      callback({});
    });
    mockStorage.sync.set.mockImplementation((_data: Record<string, any>, callback?: Function) => {
      if (callback) callback();
    });
    mockStorage.local.remove.mockImplementation((_keys: string[], callback?: Function) => {
      if (callback) callback();
    });
    vi.spyOn(global, 'setTimeout').mockImplementation((_fn: Function) => {
      return 123 as any;
    });
  });
  afterEach(() => {
    vi.resetModules();
  });
  test('should initialize DOM event listeners on DOMContentLoaded', async () => {
    await import('@src/modules/options/options');
    expect(document.addEventListener).toHaveBeenCalledWith(
      'DOMContentLoaded',
      expect.any(Function)
    );
    const domContentLoadedHandler = (document.addEventListener as Mock).mock.calls[0][1];
    domContentLoadedHandler();
    expect(mockElements.save.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
  });
  test('should load default values when no stored values exist', async () => {
    await import('@src/modules/options/options');
    const domContentLoadedHandler = (document.addEventListener as Mock).mock.calls[0][1];
    domContentLoadedHandler();
    const storageCallback = mockStorage.sync.get.mock.calls[0][1];
    storageCallback({});
    expect(mockElements.channelName.value).toBe(DEFAULT_CHANNEL_NAME);
    expect(mockElements.allowedPhrases.value).toBe(DEFAULT_ALLOWED_PHRASES.join('\n'));
    expect(mockElements.disallowedPhrases.value).toBe(DEFAULT_DISALLOWED_PHRASES.join('\n'));
    expect(mockElements.exceptionPhrases.value).toBe(DEFAULT_EXCEPTION_PHRASES.join('\n'));
    expect(mockElements.bitbucketUrl.value).toBe(DEFAULT_BITBUCKET_URL);
    expect(mockElements.mergeButtonSelector.value).toBe(DEFAULT_MERGE_BUTTON_SELECTOR);
  });
  test('should load stored values when they exist', async () => {
    await import('@src/modules/options/options');
    const domContentLoadedHandler = (document.addEventListener as Mock).mock.calls[0][1];
    domContentLoadedHandler();
    const storageCallback = mockStorage.sync.get.mock.calls[0][1];
    storageCallback({
      slackToken: 'test-slack-token',
      appToken: 'test-app-token',
      channelName: 'test-channel',
      allowedPhrases: 'phrase1,phrase2',
      disallowedPhrases: 'disallowed1,disallowed2',
      exceptionPhrases: 'exception1,exception2',
      bitbucketUrl: 'https://example.com',
      mergeButtonSelector: '.test-selector',
    });
    expect(mockElements.slackToken.value).toBe('test-slack-token');
    expect(mockElements.appToken.value).toBe('test-app-token');
    expect(mockElements.channelName.value).toBe('test-channel');
    expect(mockElements.allowedPhrases.value).toBe('phrase1\nphrase2');
    expect(mockElements.disallowedPhrases.value).toBe('disallowed1\ndisallowed2');
    expect(mockElements.exceptionPhrases.value).toBe('exception1\nexception2');
    expect(mockElements.bitbucketUrl.value).toBe('https://example.com');
    expect(mockElements.mergeButtonSelector.value).toBe('.test-selector');
  });
  test('should save options when save button is clicked with valid inputs', async () => {
    await import('@src/modules/options/options');
    const domContentLoadedHandler = (document.addEventListener as Mock).mock.calls[0][1];
    domContentLoadedHandler();
    const saveClickHandler = (mockElements.save.addEventListener as Mock).mock.calls[0][1];
    mockElements.slackToken.value = 'test-slack-token';
    mockElements.appToken.value = 'test-app-token';
    mockElements.channelName.value = 'test-channel';
    mockElements.allowedPhrases.value = 'phrase1\nphrase2';
    mockElements.disallowedPhrases.value = 'disallowed1\ndisallowed2';
    mockElements.exceptionPhrases.value = 'exception1\nexception2';
    mockElements.bitbucketUrl.value = 'https://example.com';
    mockElements.mergeButtonSelector.value = '.test-selector';
    saveClickHandler();
    expect(mockStorage.sync.set).toHaveBeenCalledWith(
      {
        slackToken: 'test-slack-token',
        appToken: 'test-app-token',
        channelName: 'test-channel',
        allowedPhrases: 'phrase1,phrase2',
        disallowedPhrases: 'disallowed1,disallowed2',
        exceptionPhrases: 'exception1,exception2',
        bitbucketUrl: 'https://example.com',
        mergeButtonSelector: '.test-selector',
      },
      expect.any(Function)
    );
    const storageSetCallback = mockStorage.sync.set.mock.calls[0][1];
    await storageSetCallback();
    expect(mockElements.status.textContent).toBe(literals.options.textOptionsSaved);
    expect(mockElements.status.className).toBe('status-message status-success');
    expect(mockStorage.local.remove).toHaveBeenCalledWith(['channelId', 'lastFetchTs']);
    expect(mockRuntime.sendMessage).toHaveBeenCalledWith({
      action: MESSAGE_ACTIONS.RECONNECT_SLACK,
    });
    expect(mockRuntime.sendMessage).toHaveBeenCalledWith({
      action: MESSAGE_ACTIONS.FETCH_NEW_MESSAGES,
      payload: {
        channelName: 'test-channel',
        skipErrorNotification: true,
      },
    });
    expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 3000);
    const setTimeoutCallback = (setTimeout as Mock).mock.calls[0][0];
    setTimeoutCallback();
    expect(mockElements.status.textContent).toBe('');
    expect(mockElements.status.className).toBe('status-message');
  });
  test('should show error when save button is clicked with missing inputs', async () => {
    await import('@src/modules/options/options');
    const domContentLoadedHandler = (document.addEventListener as Mock).mock.calls[0][1];
    domContentLoadedHandler();
    const saveClickHandler = (mockElements.save.addEventListener as Mock).mock.calls[0][1];
    mockElements.slackToken.value = '';
    mockElements.appToken.value = 'test-app-token';
    mockElements.channelName.value = 'test-channel';
    mockElements.bitbucketUrl.value = 'https://example.com';
    mockElements.mergeButtonSelector.value = '.test-selector';
    saveClickHandler();
    expect(mockElements.status.textContent).toBe(literals.options.textFillAllFields);
    expect(mockElements.status.className).toBe('status-message status-error');
    expect(mockStorage.sync.set).not.toHaveBeenCalled();
  });
  test('should handle channel name with leading hash', async () => {
    await import('@src/modules/options/options');
    const domContentLoadedHandler = (document.addEventListener as Mock).mock.calls[0][1];
    domContentLoadedHandler();
    const saveClickHandler = (mockElements.save.addEventListener as Mock).mock.calls[0][1];
    mockElements.slackToken.value = 'test-slack-token';
    mockElements.appToken.value = 'test-app-token';
    mockElements.channelName.value = '#test-channel';
    mockElements.allowedPhrases.value = 'phrase1\nphrase2';
    mockElements.disallowedPhrases.value = 'disallowed1\ndisallowed2';
    mockElements.exceptionPhrases.value = 'exception1\nexception2';
    mockElements.bitbucketUrl.value = 'https://example.com';
    mockElements.mergeButtonSelector.value = '.test-selector';
    saveClickHandler();
    expect(mockStorage.sync.set).toHaveBeenCalledWith(
      expect.objectContaining({
        channelName: 'test-channel',
      }),
      expect.any(Function)
    );
  });
  test('should handle multiline input formatting', async () => {
    await import('@src/modules/options/options');
    const domContentLoadedHandler = (document.addEventListener as Mock).mock.calls[0][1];
    domContentLoadedHandler();
    const saveClickHandler = (mockElements.save.addEventListener as Mock).mock.calls[0][1];
    mockElements.slackToken.value = 'test-slack-token';
    mockElements.appToken.value = 'test-app-token';
    mockElements.channelName.value = 'test-channel';
    mockElements.allowedPhrases.value = '  phrase1  \n\n  phrase2  \n\n';
    mockElements.disallowedPhrases.value = 'disallowed1\ndisallowed2';
    mockElements.exceptionPhrases.value = 'exception1\nexception2';
    mockElements.bitbucketUrl.value = 'https://example.com';
    mockElements.mergeButtonSelector.value = '.test-selector';
    saveClickHandler();
    expect(mockStorage.sync.set).toHaveBeenCalledWith(
      expect.objectContaining({
        allowedPhrases: 'phrase1,phrase2',
      }),
      expect.any(Function)
    );
  });
});
