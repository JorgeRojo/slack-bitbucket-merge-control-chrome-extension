/**
 * @vitest-environment jsdom
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';

// Mock DOM elements
const createMockElement = () => ({
  className: '',
  textContent: '',
  style: { display: '' },
  href: '',
  setAttribute: vi.fn(),
  removeAttribute: vi.fn(),
  addEventListener: vi.fn(),
});

describe('Popup.js Runtime Error Handling', () => {
  let mockStatusIcon,
    mockStatusText,
    mockOpenOptionsButton,
    mockSlackChannelLink,
    mockMatchingMessageDiv,
    mockFeatureToggle,
    mockCountdownElement;

  let domContentLoadedHandler;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock elements
    mockStatusIcon = createMockElement();
    mockStatusText = createMockElement();
    mockOpenOptionsButton = createMockElement();
    mockSlackChannelLink = createMockElement();
    mockMatchingMessageDiv = createMockElement();
    mockFeatureToggle = createMockElement();
    mockCountdownElement = createMockElement();

    // Mock document.getElementById
    document.getElementById = vi.fn((id) => {
      switch (id) {
        case 'status-icon':
          return mockStatusIcon;
        case 'status-text':
          return mockStatusText;
        case 'open-options':
          return mockOpenOptionsButton;
        case 'slack-channel-link':
          return mockSlackChannelLink;
        case 'matching-message':
          return mockMatchingMessageDiv;
        case 'feature-toggle':
          return mockFeatureToggle;
        case 'countdown-timer':
          return mockCountdownElement;
        default:
          return null;
      }
    });

    // Mock chrome API
    global.chrome = {
      storage: {
        sync: {
          get: vi.fn(),
        },
        local: {
          get: vi.fn(),
          set: vi.fn(),
        },
        onChanged: {
          addListener: vi.fn(),
        },
      },
      runtime: {
        sendMessage: vi.fn(),
        openOptionsPage: vi.fn(),
        getURL: vi.fn(() => 'chrome-extension://options.html'),
        onMessage: {
          addListener: vi.fn(),
        },
        lastError: null,
      },
    };

    // Mock console.log
    console.log = vi.fn();

    // Mock document.addEventListener to capture the DOMContentLoaded handler
    const originalAddEventListener = document.addEventListener;
    document.addEventListener = vi.fn((event, handler) => {
      if (event === 'DOMContentLoaded') {
        domContentLoadedHandler = handler;
      }
      return originalAddEventListener.call(document, event, handler);
    });

    // Import the module to trigger the event listener registration
    vi.resetModules();
    require('../src/popup.js');
  });

  test('should handle runtime.lastError in checkCountdownStatus', async () => {
    // Setup for the test
    chrome.storage.sync.get.mockResolvedValue({
      slackToken: 'xoxb-token',
      appToken: 'xapp-token',
      channelName: 'general',
    });

    chrome.storage.local.get.mockImplementation((keys, callback) => {
      if (typeof callback === 'function') {
        callback({ featureEnabled: false });
      }
      return Promise.resolve({});
    });

    // Simulate runtime.lastError when sendMessage is called
    chrome.runtime.sendMessage.mockImplementation((message, callback) => {
      if (
        message.action === 'getCountdownStatus' &&
        callback &&
        typeof callback === 'function'
      ) {
        // Set runtime.lastError before calling the callback
        chrome.runtime.lastError = {
          message: 'The message port closed before a response was received.',
        };
        callback(null);
        // Clear runtime.lastError after callback
        delete chrome.runtime.lastError;
      }
    });

    // Trigger the DOMContentLoaded handler
    await domContentLoadedHandler();

    // Get the message handler
    const messageHandler =
      chrome.runtime.onMessage.addListener.mock.calls[0][0];

    // Call the handler with countdownCompleted to trigger checkCountdownStatus
    messageHandler({ action: 'countdownCompleted' }, {}, () => {});

    // Verify that getCountdownStatus was called
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      { action: 'getCountdownStatus' },
      expect.any(Function),
    );

    // Verify that the error was logged
    expect(console.log).toHaveBeenCalledWith(
      'Error al recibir respuesta:',
      'The message port closed before a response was received.',
    );
  });

  test('should handle runtime.lastError in toggle event', async () => {
    // Setup for the test
    chrome.storage.sync.get.mockResolvedValue({
      slackToken: 'xoxb-token',
      appToken: 'xapp-token',
      channelName: 'general',
    });

    chrome.storage.local.get.mockImplementation((keys, callback) => {
      if (typeof callback === 'function') {
        callback({ featureEnabled: true });
      }
      return Promise.resolve({});
    });

    // Simulate runtime.lastError when sendMessage is called
    chrome.runtime.sendMessage.mockImplementation((message, callback) => {
      if (
        message.action === 'featureToggleChanged' &&
        callback &&
        typeof callback === 'function'
      ) {
        // Set runtime.lastError before calling the callback
        chrome.runtime.lastError = {
          message: 'The message port closed before a response was received.',
        };
        callback(null);
        // Clear runtime.lastError after callback
        delete chrome.runtime.lastError;
      }
    });

    // Trigger the DOMContentLoaded handler
    await domContentLoadedHandler();

    // Get the toggle event handler
    const toggleHandler = mockFeatureToggle.addEventListener.mock.calls.find(
      (call) => call[0] === 'toggle',
    )[1];

    // Call the handler with a mock event
    toggleHandler({ detail: { checked: true } });

    // Verify that featureToggleChanged was called
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      {
        action: 'featureToggleChanged',
        enabled: true,
      },
      expect.any(Function),
    );

    // Verify that the error was logged
    expect(console.log).toHaveBeenCalledWith(
      'Error al recibir respuesta de featureToggleChanged:',
      'The message port closed before a response was received.',
    );
  });

  test('should handle exception in sendMessage during checkCountdownStatus', async () => {
    // Setup for the test
    chrome.storage.sync.get.mockResolvedValue({
      slackToken: 'xoxb-token',
      appToken: 'xapp-token',
      channelName: 'general',
    });

    chrome.storage.local.get.mockImplementation((keys, callback) => {
      if (typeof callback === 'function') {
        callback({ featureEnabled: false });
      }
      return Promise.resolve({});
    });

    // Simulate exception when sendMessage is called
    chrome.runtime.sendMessage.mockImplementation((message) => {
      if (message.action === 'getCountdownStatus') {
        throw new Error('Test error');
      }
    });

    // Trigger the DOMContentLoaded handler
    await domContentLoadedHandler();

    // Get the message handler
    const messageHandler =
      chrome.runtime.onMessage.addListener.mock.calls[0][0];

    // Call the handler with countdownCompleted to trigger checkCountdownStatus
    messageHandler({ action: 'countdownCompleted' }, {}, () => {});

    // Verify that the error was logged
    expect(console.log).toHaveBeenCalledWith(
      'Error al enviar mensaje:',
      expect.any(Error),
    );
  });

  test('should handle exception in sendMessage during toggle event', async () => {
    // Setup for the test
    chrome.storage.sync.get.mockResolvedValue({
      slackToken: 'xoxb-token',
      appToken: 'xapp-token',
      channelName: 'general',
    });

    chrome.storage.local.get.mockImplementation((keys, callback) => {
      if (typeof callback === 'function') {
        callback({ featureEnabled: true });
      }
      return Promise.resolve({});
    });

    // Simulate exception when sendMessage is called
    chrome.runtime.sendMessage.mockImplementation((message) => {
      if (message.action === 'featureToggleChanged') {
        throw new Error('Test error');
      }
    });

    // Trigger the DOMContentLoaded handler
    await domContentLoadedHandler();

    // Get the toggle event handler
    const toggleHandler = mockFeatureToggle.addEventListener.mock.calls.find(
      (call) => call[0] === 'toggle',
    )[1];

    // Call the handler with a mock event
    toggleHandler({ detail: { checked: true } });

    // Verify that the error was logged
    expect(console.log).toHaveBeenCalledWith(
      'Error al enviar mensaje de featureToggleChanged:',
      expect.any(Error),
    );
  });
});
