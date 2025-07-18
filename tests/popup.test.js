/**
 * @vitest-environment jsdom
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';

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

// Mock console.error
console.error = vi.fn();

// Mock window.open
window.open = vi.fn();

describe('popup.js', () => {
  let mockStatusIcon,
    mockStatusText,
    mockOpenOptionsButton,
    mockSlackChannelLink,
    mockMatchingMessageDiv,
    mockFeatureToggle,
    mockCountdownElement;

  // Spy on document.addEventListener to capture the DOMContentLoaded handler
  let domContentLoadedHandler;
  const originalAddEventListener = document.addEventListener;

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
      },
    };

    // Mock document.addEventListener to capture the DOMContentLoaded handler
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

  afterEach(() => {
    // Restore document.addEventListener
    document.addEventListener = originalAddEventListener;
  });

  describe('DOMContentLoaded event', () => {
    test('should register event listeners', async () => {
      // Verify that the DOMContentLoaded event listener was registered
      expect(document.addEventListener).toHaveBeenCalledWith(
        'DOMContentLoaded',
        expect.any(Function),
      );
      expect(domContentLoadedHandler).toBeDefined();
    });
  });

  describe('Event handlers', () => {
    test('should handle toggle event', async () => {
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

      // Trigger the DOMContentLoaded handler
      await domContentLoadedHandler();

      // Get the toggle event handler
      const toggleHandler = mockFeatureToggle.addEventListener.mock.calls.find(
        (call) => call[0] === 'toggle',
      )[1];

      // Call the handler with a mock event
      toggleHandler({ detail: { checked: true } });

      // Verify that storage was updated
      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        featureEnabled: true,
      });

      // Verify that a message was sent
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        {
          action: 'featureToggleChanged',
          enabled: true,
        },
        expect.any(Function),
      );
    });

    test('should handle options button click with openOptionsPage', async () => {
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

      // Trigger the DOMContentLoaded handler
      await domContentLoadedHandler();

      // Get the click event handler
      const clickHandler =
        mockOpenOptionsButton.addEventListener.mock.calls.find(
          (call) => call[0] === 'click',
        )[1];

      // Call the handler
      clickHandler();

      // Verify that openOptionsPage was called
      expect(chrome.runtime.openOptionsPage).toHaveBeenCalled();
    });

    test('should handle options button click without openOptionsPage', async () => {
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

      // Remove openOptionsPage
      chrome.runtime.openOptionsPage = undefined;

      // Trigger the DOMContentLoaded handler
      await domContentLoadedHandler();

      // Get the click event handler
      const clickHandler =
        mockOpenOptionsButton.addEventListener.mock.calls.find(
          (call) => call[0] === 'click',
        )[1];

      // Call the handler
      clickHandler();

      // Verify that window.open was called
      expect(window.open).toHaveBeenCalledWith(
        'chrome-extension://options.html',
      );
    });

    test('should handle storage changes', async () => {
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

      // Trigger the DOMContentLoaded handler
      await domContentLoadedHandler();

      // Get the storage change handler
      const storageHandler =
        chrome.storage.onChanged.addListener.mock.calls[0][0];

      // Reset mocks to track new calls
      chrome.storage.sync.get.mockClear();

      // Call the handler with a storage change
      storageHandler(
        { lastKnownMergeState: { newValue: {}, oldValue: null } },
        'local',
      );

      // Verify that loadAndDisplayData was called (indirectly)
      expect(chrome.storage.sync.get).toHaveBeenCalled();
    });

    test('should handle runtime messages for updateCountdownDisplay', async () => {
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

      // Trigger the DOMContentLoaded handler
      await domContentLoadedHandler();

      // Get the message handler
      const messageHandler =
        chrome.runtime.onMessage.addListener.mock.calls[0][0];

      // Call the handler with a message
      messageHandler({ action: 'updateCountdownDisplay', timeLeft: 60000 });

      // Verify that storage was queried
      expect(chrome.storage.local.get).toHaveBeenCalledWith(
        ['featureEnabled'],
        expect.any(Function),
      );
    });

    test('should handle runtime messages for countdownCompleted', async () => {
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

      // Trigger the DOMContentLoaded handler
      await domContentLoadedHandler();

      // Get the message handler
      const messageHandler =
        chrome.runtime.onMessage.addListener.mock.calls[0][0];

      // Call the handler with a message
      messageHandler({ action: 'countdownCompleted' });

      // Verify that the toggle was updated
      expect(mockFeatureToggle.setAttribute).toHaveBeenCalledWith(
        'checked',
        '',
      );
    });
  });

  describe('UI state handling', () => {
    test('should handle countdown display', async () => {
      // Mock chrome.storage.local.get for updateCountdownDisplay
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        if (keys.includes('featureEnabled')) {
          callback({ featureEnabled: false });
        } else {
          callback({});
        }
      });

      // Trigger the DOMContentLoaded handler
      await domContentLoadedHandler();

      // Get the message handler
      const messageHandler =
        chrome.runtime.onMessage.addListener.mock.calls[0][0];

      // Call the handler with updateCountdownDisplay action
      messageHandler({ action: 'updateCountdownDisplay', timeLeft: 65000 });

      // Verify that countdown element is updated
      expect(mockCountdownElement.style.display).toBe('block');
      expect(mockCountdownElement.textContent).toContain('1:05');

      // Test with feature enabled
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        if (keys.includes('featureEnabled')) {
          callback({ featureEnabled: true });
        } else {
          callback({});
        }
      });

      messageHandler({ action: 'updateCountdownDisplay', timeLeft: 65000 });
      expect(mockCountdownElement.style.display).toBe('none');

      // Test with zero time left
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        if (keys.includes('featureEnabled')) {
          callback({ featureEnabled: false });
        } else {
          callback({});
        }
      });

      messageHandler({ action: 'updateCountdownDisplay', timeLeft: 0 });
      expect(mockCountdownElement.style.display).toBe('none');
    });

    test('should handle missing countdown element', async () => {
      // Mock document.getElementById to return null for countdown-timer
      document.getElementById.mockImplementation((id) => {
        if (id === 'countdown-timer') return null;
        return mockStatusIcon; // Return something for other elements
      });

      // Mock chrome.storage.local.get for updateCountdownDisplay
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        if (keys.includes('featureEnabled')) {
          callback({ featureEnabled: false });
        } else {
          callback({});
        }
      });

      // Trigger the DOMContentLoaded handler
      await domContentLoadedHandler();

      // Get the message handler
      const messageHandler =
        chrome.runtime.onMessage.addListener.mock.calls[0][0];

      // Call the handler with updateCountdownDisplay action
      messageHandler({ action: 'updateCountdownDisplay', timeLeft: 65000 });

      // No error should be thrown
      expect(true).toBe(true);
    });
  });
});

