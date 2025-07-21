import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockStorage, mockRuntime } from './setup';
import {
  DEFAULT_ALLOWED_PHRASES,
  DEFAULT_DISALLOWED_PHRASES,
  DEFAULT_EXCEPTION_PHRASES,
  DEFAULT_BITBUCKET_URL,
  DEFAULT_MERGE_BUTTON_SELECTOR,
  DEFAULT_CHANNEL_NAME,
  MESSAGE_ACTIONS,
} from '../src/constants';
import { literals } from '../src/literals';

vi.mock('../src/utils/logger');

describe('Options Page', () => {
  // Mock DOM elements
  interface MockElements {
    [key: string]: {
      addEventListener?: jest.Mock;
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

  // Mock document.getElementById
  (global as any).document = {
    addEventListener: vi.fn(),
    getElementById: vi.fn((id: string) => mockElements[id] || null),
  };

  beforeEach(() => {
    // Reset mocks
    vi.resetAllMocks();

    // Reset mock elements
    Object.keys(mockElements).forEach((key) => {
      if (key === 'save') {
        mockElements[key].addEventListener = vi.fn();
      } else if (key === 'status') {
        mockElements[key].textContent = '';
        mockElements[key].className = '';
      } else {
        mockElements[key].value = '';
      }
    });

    // Setup storage mock
    mockStorage.sync.get.mockImplementation((keys: string[], callback: Function) => {
      callback({});
    });

    mockStorage.sync.set.mockImplementation((data: Record<string, any>, callback?: Function) => {
      if (callback) callback();
    });

    mockStorage.local.remove.mockImplementation((keys: string[], callback?: Function) => {
      if (callback) callback();
    });

    // Mock setTimeout
    vi.spyOn(global, 'setTimeout').mockImplementation((_fn: Function) => {
      return 123 as any; // Mock timer ID
    });
  });

  afterEach(() => {
    vi.resetModules();
  });

  test('should initialize DOM event listeners on DOMContentLoaded', async () => {
    // Import the module to trigger DOMContentLoaded handler
    await import('../src/options');

    // Verify that the event listener was added
    expect(document.addEventListener).toHaveBeenCalledWith(
      'DOMContentLoaded',
      expect.any(Function),
    );

    // Get the DOMContentLoaded handler
    const domContentLoadedHandler = (document.addEventListener as jest.Mock).mock.calls[0][1];

    // Call the handler to simulate DOMContentLoaded event
    domContentLoadedHandler();

    // Verify that save button event listener was added
    expect(mockElements.save.addEventListener).toHaveBeenCalledWith(
      'click',
      expect.any(Function),
    );
  });

  test('should load default values when no stored values exist', async () => {
    // Import the module to trigger DOMContentLoaded handler
    await import('../src/options');

    // Get the DOMContentLoaded handler
    const domContentLoadedHandler = (document.addEventListener as jest.Mock).mock.calls[0][1];

    // Call the handler to simulate DOMContentLoaded event
    domContentLoadedHandler();

    // Get the storage callback
    const storageCallback = mockStorage.sync.get.mock.calls[0][1];

    // Call the callback with empty result
    storageCallback({});

    // Verify default values were set
    expect(mockElements.channelName.value).toBe(DEFAULT_CHANNEL_NAME);
    expect(mockElements.allowedPhrases.value).toBe(
      DEFAULT_ALLOWED_PHRASES.join('\n'),
    );
    expect(mockElements.disallowedPhrases.value).toBe(
      DEFAULT_DISALLOWED_PHRASES.join('\n'),
    );
    expect(mockElements.exceptionPhrases.value).toBe(
      DEFAULT_EXCEPTION_PHRASES.join('\n'),
    );
    expect(mockElements.bitbucketUrl.value).toBe(DEFAULT_BITBUCKET_URL);
    expect(mockElements.mergeButtonSelector.value).toBe(
      DEFAULT_MERGE_BUTTON_SELECTOR,
    );
  });

  test('should load stored values when they exist', async () => {
    // Import the module to trigger DOMContentLoaded handler
    await import('../src/options');

    // Get the DOMContentLoaded handler
    const domContentLoadedHandler = (document.addEventListener as jest.Mock).mock.calls[0][1];

    // Call the handler to simulate DOMContentLoaded event
    domContentLoadedHandler();

    // Get the storage callback
    const storageCallback = mockStorage.sync.get.mock.calls[0][1];

    // Call the callback with stored values
    storageCallback({
      slackToken: 'test-slack-token',
      appToken: 'test-app-token',
      channelName: 'test-channel',
      allowedPhrases: 'phrase1,phrase2',
      disallowedPhrases: 'disallowed1,disallowed2',
      exceptionPhrases: 'exception1,exception2',
      bitbucketUrl: 'https://test-bitbucket-url.com/*',
      mergeButtonSelector: '.test-selector',
    });

    // Verify stored values were set
    expect(mockElements.slackToken.value).toBe('test-slack-token');
    expect(mockElements.appToken.value).toBe('test-app-token');
    expect(mockElements.channelName.value).toBe('test-channel');
    expect(mockElements.allowedPhrases.value).toBe('phrase1\nphrase2');
    expect(mockElements.disallowedPhrases.value).toBe(
      'disallowed1\ndisallowed2',
    );
    expect(mockElements.exceptionPhrases.value).toBe('exception1\nexception2');
    expect(mockElements.bitbucketUrl.value).toBe(
      'https://test-bitbucket-url.com/*',
    );
    expect(mockElements.mergeButtonSelector.value).toBe('.test-selector');
  });

  test('should save options when save button is clicked with valid inputs', async () => {
    // Import the module to trigger DOMContentLoaded handler
    await import('../src/options');

    // Get the DOMContentLoaded handler
    const domContentLoadedHandler = (document.addEventListener as jest.Mock).mock.calls[0][1];

    // Call the handler to simulate DOMContentLoaded event
    domContentLoadedHandler();

    // Get the save button click handler
    const saveClickHandler =
      (mockElements.save.addEventListener as jest.Mock).mock.calls[0][1];

    // Set input values
    mockElements.slackToken.value = 'test-slack-token';
    mockElements.appToken.value = 'test-app-token';
    mockElements.channelName.value = 'test-channel';
    mockElements.allowedPhrases.value = 'phrase1\nphrase2';
    mockElements.disallowedPhrases.value = 'disallowed1\ndisallowed2';
    mockElements.exceptionPhrases.value = 'exception1\nexception2';
    mockElements.bitbucketUrl.value = 'https://test-bitbucket-url.com/*';
    mockElements.mergeButtonSelector.value = '.test-selector';

    // Call the save click handler
    saveClickHandler();

    // Verify status message was updated
    expect(mockElements.status.textContent).toBe('Saving options...');
    expect(mockElements.status.className).toBe('status-message status-loading');

    // Verify storage.sync.set was called with correct values
    expect(mockStorage.sync.set).toHaveBeenCalledWith(
      {
        slackToken: 'test-slack-token',
        appToken: 'test-app-token',
        channelName: 'test-channel',
        allowedPhrases: 'phrase1,phrase2',
        disallowedPhrases: 'disallowed1,disallowed2',
        exceptionPhrases: 'exception1,exception2',
        bitbucketUrl: 'https://test-bitbucket-url.com/*',
        mergeButtonSelector: '.test-selector',
      },
      expect.any(Function),
    );

    // Get the storage.sync.set callback
    const storageSetCallback = mockStorage.sync.set.mock.calls[0][1];

    // Call the callback
    await storageSetCallback();

    // Verify status message was updated to success
    expect(mockElements.status.textContent).toBe(
      literals.options.textOptionsSaved,
    );
    expect(mockElements.status.className).toBe('status-message status-success');

    // Verify local storage was cleared
    expect(mockStorage.local.remove).toHaveBeenCalledWith([
      'channelId',
      'lastFetchTs',
    ]);

    // Verify runtime messages were sent
    expect(mockRuntime.sendMessage).toHaveBeenCalledWith({
      action: MESSAGE_ACTIONS.RECONNECT_SLACK,
    });

    expect(mockRuntime.sendMessage).toHaveBeenCalledWith({
      action: MESSAGE_ACTIONS.FETCH_NEW_MESSAGES,
      channelName: 'test-channel',
      skipErrorNotification: true,
    });

    // Verify setTimeout was called
    expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 3000);

    // Call the setTimeout callback
    const setTimeoutCallback = (setTimeout as jest.Mock).mock.calls[0][0];
    setTimeoutCallback();

    // Verify status message was cleared
    expect(mockElements.status.textContent).toBe('');
    expect(mockElements.status.className).toBe('status-message');
  });

  test('should show error when save button is clicked with missing inputs', async () => {
    // Import the module to trigger DOMContentLoaded handler
    await import('../src/options');

    // Get the DOMContentLoaded handler
    const domContentLoadedHandler = (document.addEventListener as jest.Mock).mock.calls[0][1];

    // Call the handler to simulate DOMContentLoaded event
    domContentLoadedHandler();

    // Get the save button click handler
    const saveClickHandler =
      (mockElements.save.addEventListener as jest.Mock).mock.calls[0][1];

    // Set incomplete input values (missing slackToken)
    mockElements.slackToken.value = '';
    mockElements.appToken.value = 'test-app-token';
    mockElements.channelName.value = 'test-channel';
    mockElements.bitbucketUrl.value = 'https://test-bitbucket-url.com/*';
    mockElements.mergeButtonSelector.value = '.test-selector';

    // Call the save click handler
    saveClickHandler();

    // Verify error message was shown
    expect(mockElements.status.textContent).toBe(
      literals.options.textFillAllFields,
    );
    expect(mockElements.status.className).toBe('status-message status-error');

    // Verify storage.sync.set was not called
    expect(mockStorage.sync.set).not.toHaveBeenCalled();
  });

  test('should handle channel name with leading hash', async () => {
    // Import the module to trigger DOMContentLoaded handler
    await import('../src/options');

    // Get the DOMContentLoaded handler
    const domContentLoadedHandler = (document.addEventListener as jest.Mock).mock.calls[0][1];

    // Call the handler to simulate DOMContentLoaded event
    domContentLoadedHandler();

    // Get the save button click handler
    const saveClickHandler =
      (mockElements.save.addEventListener as jest.Mock).mock.calls[0][1];

    // Set input values with leading hash in channel name
    mockElements.slackToken.value = 'test-slack-token';
    mockElements.appToken.value = 'test-app-token';
    mockElements.channelName.value = '#test-channel';
    mockElements.allowedPhrases.value = 'phrase1\nphrase2';
    mockElements.disallowedPhrases.value = 'disallowed1\ndisallowed2';
    mockElements.exceptionPhrases.value = 'exception1\nexception2';
    mockElements.bitbucketUrl.value = 'https://test-bitbucket-url.com/*';
    mockElements.mergeButtonSelector.value = '.test-selector';

    // Call the save click handler
    saveClickHandler();

    // Verify storage.sync.set was called with correct values (hash removed)
    expect(mockStorage.sync.set).toHaveBeenCalledWith(
      expect.objectContaining({
        channelName: 'test-channel', // Hash should be removed
      }),
      expect.any(Function),
    );
  });

  test('should handle multiline input formatting', async () => {
    // Import the module to trigger DOMContentLoaded handler
    await import('../src/options');

    // Get the DOMContentLoaded handler
    const domContentLoadedHandler = (document.addEventListener as jest.Mock).mock.calls[0][1];

    // Call the handler to simulate DOMContentLoaded event
    domContentLoadedHandler();

    // Get the save button click handler
    const saveClickHandler =
      (mockElements.save.addEventListener as jest.Mock).mock.calls[0][1];

    // Set input values with extra whitespace and empty lines
    mockElements.slackToken.value = 'test-slack-token';
    mockElements.appToken.value = 'test-app-token';
    mockElements.channelName.value = 'test-channel';
    mockElements.allowedPhrases.value = '  phrase1  \n\n  phrase2  \n\n';
    mockElements.disallowedPhrases.value = 'disallowed1\ndisallowed2';
    mockElements.exceptionPhrases.value = 'exception1\nexception2';
    mockElements.bitbucketUrl.value = 'https://test-bitbucket-url.com/*';
    mockElements.mergeButtonSelector.value = '.test-selector';

    // Call the save click handler
    saveClickHandler();

    // Verify storage.sync.set was called with correct values (whitespace trimmed, empty lines removed)
    expect(mockStorage.sync.set).toHaveBeenCalledWith(
      expect.objectContaining({
        allowedPhrases: 'phrase1,phrase2',
      }),
      expect.any(Function),
    );
  });
});
