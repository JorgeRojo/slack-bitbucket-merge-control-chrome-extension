/**
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals';
import { literals } from '../src/literals.js';
import { SLACK_BASE_URL } from '../src/constants.js';

// Import the functions
import * as popupModule from '../src/popup.js';

// Extract the exported functions
const {
  updateUI,
  manageCountdownElement,
  updateCountdownDisplay,
  initializeFeatureToggleState,
  loadAndDisplayData,
} = popupModule;

// Mock DOM elements
const createMockElement = () => ({
  className: '',
  textContent: '',
  style: { display: '' },
  href: '',
  setAttribute: jest.fn(),
  removeAttribute: jest.fn(),
  addEventListener: jest.fn(),
});

// Mock document
document.getElementById = jest.fn();
document.addEventListener = jest.fn((event, callback) => {
  if (event === 'DOMContentLoaded') {
    // Store the callback to call it in tests
    document.domContentLoadedCallback = callback;
  }
});

// Mock window.open
window.open = jest.fn();

// Mock console.error
console.error = jest.fn();

// Mock Promise.resolve for setTimeout
global.Promise = {
  ...Promise,
  resolve: jest.fn(() => ({
    then: (callback) => {
      callback();
      return { catch: jest.fn() };
    },
  })),
};

// Mock chrome API
global.chrome = {
  storage: {
    sync: {
      get: jest.fn(),
    },
    local: {
      get: jest.fn(),
      set: jest.fn(),
    },
    onChanged: {
      addListener: jest.fn(),
    },
  },
  runtime: {
    sendMessage: jest.fn(),
    openOptionsPage: jest.fn(),
    getURL: jest.fn(() => 'chrome-extension://options.html'),
    onMessage: {
      addListener: jest.fn(),
    },
  },
};

describe('popup.js', () => {
  let mockStatusIcon,
    mockStatusText,
    mockOpenOptionsButton,
    mockSlackChannelLink,
    mockMatchingMessageDiv,
    mockFeatureToggle,
    mockCountdownElement;

  beforeEach(() => {
    jest.clearAllMocks();

    mockStatusIcon = createMockElement();
    mockStatusText = createMockElement();
    mockOpenOptionsButton = createMockElement();
    mockSlackChannelLink = createMockElement();
    mockMatchingMessageDiv = createMockElement();
    mockFeatureToggle = createMockElement();
    mockCountdownElement = createMockElement();

    document.getElementById.mockImplementation((id) => {
      if (id === 'status-icon') return mockStatusIcon;
      if (id === 'status-text') return mockStatusText;
      if (id === 'open-options') return mockOpenOptionsButton;
      if (id === 'slack-channel-link') return mockSlackChannelLink;
      if (id === 'matching-message') return mockMatchingMessageDiv;
      if (id === 'feature-toggle') return mockFeatureToggle;
      if (id === 'countdown-timer') return mockCountdownElement;
      return null;
    });

    // Mock global manageCountdownElement
    global.manageCountdownElement = jest.fn();
  });

  afterEach(() => {
    delete global.manageCountdownElement;
  });

  describe('updateUI', () => {
    test('should update UI for allowed state', () => {
      updateUI({
        statusIcon: mockStatusIcon,
        statusText: mockStatusText,
        openOptionsButton: mockOpenOptionsButton,
        slackChannelLink: mockSlackChannelLink,
        matchingMessageDiv: mockMatchingMessageDiv,
        state: 'allowed',
        message: 'Test message',
      });

      expect(mockStatusIcon.className).toBe('allowed');
      expect(mockStatusText.className).toBe('allowed');
      expect(mockStatusIcon.textContent).toBe(literals.popup.emojiAllowed);
      expect(mockStatusText.textContent).toBe('Test message');
    });

    test('should update UI for disallowed state', () => {
      updateUI({
        statusIcon: mockStatusIcon,
        statusText: mockStatusText,
        openOptionsButton: mockOpenOptionsButton,
        slackChannelLink: mockSlackChannelLink,
        matchingMessageDiv: mockMatchingMessageDiv,
        state: 'disallowed',
        message: 'Test message',
      });

      expect(mockStatusIcon.className).toBe('disallowed');
      expect(mockStatusText.textContent).toBe('Test message');
    });

    test('should update UI for exception state', () => {
      updateUI({
        statusIcon: mockStatusIcon,
        statusText: mockStatusText,
        openOptionsButton: mockOpenOptionsButton,
        slackChannelLink: mockSlackChannelLink,
        matchingMessageDiv: mockMatchingMessageDiv,
        state: 'exception',
        message: 'Test message',
      });

      expect(mockStatusIcon.className).toBe('exception');
      expect(mockSlackChannelLink.style.display).toBe('block');
    });

    test('should update UI for config_needed state', () => {
      updateUI({
        statusIcon: mockStatusIcon,
        statusText: mockStatusText,
        openOptionsButton: mockOpenOptionsButton,
        slackChannelLink: mockSlackChannelLink,
        matchingMessageDiv: mockMatchingMessageDiv,
        state: 'config_needed',
        message: 'Test message',
      });

      expect(mockStatusIcon.className).toBe('config_needed');
      expect(mockOpenOptionsButton.style.display).toBe('block');
    });

    test('should update UI for unknown state', () => {
      updateUI({
        statusIcon: mockStatusIcon,
        statusText: mockStatusText,
        openOptionsButton: mockOpenOptionsButton,
        slackChannelLink: mockSlackChannelLink,
        matchingMessageDiv: mockMatchingMessageDiv,
        state: 'unknown',
      });

      expect(mockStatusIcon.className).toBe('unknown');
      expect(mockStatusText.textContent).toBe(
        literals.popup.textCouldNotDetermine,
      );
    });

    test('should update UI with matching message', () => {
      updateUI({
        statusIcon: mockStatusIcon,
        statusText: mockStatusText,
        openOptionsButton: mockOpenOptionsButton,
        slackChannelLink: mockSlackChannelLink,
        matchingMessageDiv: mockMatchingMessageDiv,
        state: 'allowed',
        message: 'Test message',
        matchingMessage: { text: 'matching text' },
      });

      expect(mockMatchingMessageDiv.textContent).toBe(
        `${literals.popup.textMatchingMessagePrefix}matching text"`,
      );
      expect(mockMatchingMessageDiv.style.display).toBe('block');
    });
  });

  describe('manageCountdownElement', () => {
    test('should show countdown with time', () => {
      manageCountdownElement({ show: true, timeLeft: 65000 });
      expect(mockCountdownElement.style.display).toBe('block');
      expect(mockCountdownElement.textContent).toContain('1:05');
    });

    test('should hide countdown', () => {
      manageCountdownElement({ show: false });
      expect(mockCountdownElement.style.display).toBe('none');
    });

    test('should return null when countdown element is not found', () => {
      document.getElementById.mockReturnValueOnce(null);
      const result = manageCountdownElement({ show: true });
      expect(result).toBeNull();
    });
  });

  describe('updateCountdownDisplay', () => {
    test('should update countdown when feature is disabled', () => {
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ featureEnabled: false });
      });

      updateCountdownDisplay(65000);

      // Test with global.manageCountdownElement
      global.manageCountdownElement.mockClear();
      updateCountdownDisplay(65000);
      expect(global.manageCountdownElement).toHaveBeenCalledWith({
        show: true,
        timeLeft: 65000,
      });
    });

    test('should hide countdown when feature is enabled', () => {
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ featureEnabled: true });
      });

      updateCountdownDisplay(65000);

      // Test with global.manageCountdownElement
      global.manageCountdownElement.mockClear();
      updateCountdownDisplay(65000);
      expect(global.manageCountdownElement).toHaveBeenCalledWith({
        show: false,
      });
    });

    test('should hide countdown when time is zero or negative', () => {
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ featureEnabled: false });
      });

      updateCountdownDisplay(0);

      // Test with global.manageCountdownElement
      global.manageCountdownElement.mockClear();
      updateCountdownDisplay(0);
      expect(global.manageCountdownElement).toHaveBeenCalledWith({
        show: false,
      });
    });
  });

  describe('initializeFeatureToggleState', () => {
    test('should set toggle to checked when feature is enabled', () => {
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ featureEnabled: true });
      });

      initializeFeatureToggleState(mockFeatureToggle);
      expect(mockFeatureToggle.setAttribute).toHaveBeenCalledWith(
        'checked',
        '',
      );

      // Test with global.manageCountdownElement
      global.manageCountdownElement.mockClear();
      initializeFeatureToggleState(mockFeatureToggle);
      expect(global.manageCountdownElement).toHaveBeenCalledWith({
        show: false,
      });
    });

    test('should check countdown status when feature is disabled', () => {
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ featureEnabled: false });
      });

      chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        if (message.action === 'getCountdownStatus') {
          callback({
            isCountdownActive: true,
            timeLeft: 65000,
          });
        }
      });

      initializeFeatureToggleState(mockFeatureToggle);
      expect(mockFeatureToggle.removeAttribute).toHaveBeenCalledWith('checked');
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        { action: 'getCountdownStatus' },
        expect.any(Function),
      );
    });

    test('should handle inactive countdown', () => {
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ featureEnabled: false });
      });

      chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        if (message.action === 'getCountdownStatus') {
          callback({
            isCountdownActive: false,
          });
        }
      });

      initializeFeatureToggleState(mockFeatureToggle);
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        { action: 'getCountdownStatus' },
        expect.any(Function),
      );
    });

    test('should default to enabled when featureEnabled is undefined', () => {
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({});
      });

      initializeFeatureToggleState(mockFeatureToggle);
      expect(mockFeatureToggle.setAttribute).toHaveBeenCalledWith(
        'checked',
        '',
      );
    });
  });

  describe('loadAndDisplayData', () => {
    test('should show config needed when tokens are missing', async () => {
      chrome.storage.sync.get.mockResolvedValue({
        slackToken: null,
        appToken: null,
        channelName: null,
      });

      await loadAndDisplayData({
        statusIcon: mockStatusIcon,
        statusText: mockStatusText,
        openOptionsButton: mockOpenOptionsButton,
        slackChannelLink: mockSlackChannelLink,
        matchingMessageDiv: mockMatchingMessageDiv,
      });

      expect(mockStatusIcon.className).toBe('config_needed');
      expect(mockOpenOptionsButton.style.display).toBe('block');
    });

    test('should set slack channel link when channelId and teamId are available', async () => {
      const channelId = 'C123456';
      const teamId = 'T123456';

      chrome.storage.sync.get.mockResolvedValue({
        slackToken: 'xoxb-token',
        appToken: 'xapp-token',
        channelName: 'general',
      });

      chrome.storage.local.get
        .mockResolvedValueOnce({ channelId, teamId })
        .mockResolvedValueOnce({ lastKnownMergeState: null });

      await loadAndDisplayData({
        statusIcon: mockStatusIcon,
        statusText: mockStatusText,
        openOptionsButton: mockOpenOptionsButton,
        slackChannelLink: mockSlackChannelLink,
        matchingMessageDiv: mockMatchingMessageDiv,
      });

      expect(mockSlackChannelLink.href).toBe(
        `${SLACK_BASE_URL}${teamId}/${channelId}`,
      );
    });

    test('should show loading state when no merge state is available', async () => {
      chrome.storage.sync.get.mockResolvedValue({
        slackToken: 'xoxb-token',
        appToken: 'xapp-token',
        channelName: 'general',
      });

      chrome.storage.local.get
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ lastKnownMergeState: null });

      await loadAndDisplayData({
        statusIcon: mockStatusIcon,
        statusText: mockStatusText,
        openOptionsButton: mockOpenOptionsButton,
        slackChannelLink: mockSlackChannelLink,
        matchingMessageDiv: mockMatchingMessageDiv,
      });

      expect(mockStatusIcon.className).toBe('loading');
    });

    test('should handle exception status', async () => {
      chrome.storage.sync.get.mockResolvedValue({
        slackToken: 'xoxb-token',
        appToken: 'xapp-token',
        channelName: 'general',
      });

      chrome.storage.local.get.mockResolvedValueOnce({}).mockResolvedValueOnce({
        lastKnownMergeState: {
          mergeStatus: 'exception',
          lastSlackMessage: { text: 'test message' },
        },
      });

      await loadAndDisplayData({
        statusIcon: mockStatusIcon,
        statusText: mockStatusText,
        openOptionsButton: mockOpenOptionsButton,
        slackChannelLink: mockSlackChannelLink,
        matchingMessageDiv: mockMatchingMessageDiv,
      });

      expect(mockStatusIcon.className).toBe('exception');
      expect(mockSlackChannelLink.style.display).toBe('block');
    });

    test('should handle allowed status', async () => {
      chrome.storage.sync.get.mockResolvedValue({
        slackToken: 'xoxb-token',
        appToken: 'xapp-token',
        channelName: 'general',
      });

      chrome.storage.local.get.mockResolvedValueOnce({}).mockResolvedValueOnce({
        lastKnownMergeState: {
          mergeStatus: 'allowed',
          lastSlackMessage: { text: 'test message' },
        },
      });

      await loadAndDisplayData({
        statusIcon: mockStatusIcon,
        statusText: mockStatusText,
        openOptionsButton: mockOpenOptionsButton,
        slackChannelLink: mockSlackChannelLink,
        matchingMessageDiv: mockMatchingMessageDiv,
      });

      expect(mockStatusIcon.className).toBe('allowed');
    });

    test('should handle disallowed status', async () => {
      chrome.storage.sync.get.mockResolvedValue({
        slackToken: 'xoxb-token',
        appToken: 'xapp-token',
        channelName: 'general',
      });

      chrome.storage.local.get.mockResolvedValueOnce({}).mockResolvedValueOnce({
        lastKnownMergeState: {
          mergeStatus: 'disallowed',
          lastSlackMessage: { text: 'test message' },
        },
      });

      await loadAndDisplayData({
        statusIcon: mockStatusIcon,
        statusText: mockStatusText,
        openOptionsButton: mockOpenOptionsButton,
        slackChannelLink: mockSlackChannelLink,
        matchingMessageDiv: mockMatchingMessageDiv,
      });

      expect(mockStatusIcon.className).toBe('disallowed');
    });

    test('should handle unknown status', async () => {
      chrome.storage.sync.get.mockResolvedValue({
        slackToken: 'xoxb-token',
        appToken: 'xapp-token',
        channelName: 'general',
      });

      chrome.storage.local.get.mockResolvedValueOnce({}).mockResolvedValueOnce({
        lastKnownMergeState: {
          mergeStatus: 'unknown',
        },
      });

      await loadAndDisplayData({
        statusIcon: mockStatusIcon,
        statusText: mockStatusText,
        openOptionsButton: mockOpenOptionsButton,
        slackChannelLink: mockSlackChannelLink,
        matchingMessageDiv: mockMatchingMessageDiv,
      });

      expect(mockStatusIcon.className).toBe('unknown');
    });

    test('should handle errors gracefully', async () => {
      chrome.storage.sync.get.mockRejectedValue(new Error('Storage error'));

      await loadAndDisplayData({
        statusIcon: mockStatusIcon,
        statusText: mockStatusText,
        openOptionsButton: mockOpenOptionsButton,
        slackChannelLink: mockSlackChannelLink,
        matchingMessageDiv: mockMatchingMessageDiv,
      });

      expect(console.error).toHaveBeenCalled();
      expect(mockStatusIcon.className).toBe('disallowed');
    });

    test('should handle merge state without mergeStatus', async () => {
      chrome.storage.sync.get.mockResolvedValue({
        slackToken: 'xoxb-token',
        appToken: 'xapp-token',
        channelName: 'general',
      });

      chrome.storage.local.get.mockResolvedValueOnce({}).mockResolvedValueOnce({
        lastKnownMergeState: {}, // empty merge state
      });

      await loadAndDisplayData({
        statusIcon: mockStatusIcon,
        statusText: mockStatusText,
        openOptionsButton: mockOpenOptionsButton,
        slackChannelLink: mockSlackChannelLink,
        matchingMessageDiv: mockMatchingMessageDiv,
      });

      expect(mockStatusIcon.className).toBe('loading');
    });
  });

  describe('DOMContentLoaded and event handlers', () => {
    test('should set up event listeners on DOMContentLoaded', () => {
      // Call the DOMContentLoaded callback
      if (document.domContentLoadedCallback) {
        document.domContentLoadedCallback();
      }

      // Check that event listeners were set up
      expect(mockFeatureToggle.addEventListener).toHaveBeenCalledWith(
        'toggle',
        expect.any(Function),
      );
      expect(mockOpenOptionsButton.addEventListener).toHaveBeenCalledWith(
        'click',
        expect.any(Function),
      );
      expect(chrome.storage.onChanged.addListener).toHaveBeenCalled();
      expect(chrome.runtime.onMessage.addListener).toHaveBeenCalled();
    });

    test('should handle toggle event', () => {
      // Call the DOMContentLoaded callback
      if (document.domContentLoadedCallback) {
        document.domContentLoadedCallback();
      }

      // Get the toggle event handler
      const toggleHandler = mockFeatureToggle.addEventListener.mock.calls.find(
        (call) => call[0] === 'toggle',
      )[1];

      // Call the handler with a mock event
      toggleHandler({ detail: { checked: true } });

      // Check that storage was updated
      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        featureEnabled: true,
      });

      // Check that a message was sent
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        action: 'featureToggleChanged',
        enabled: true,
      });

      // Check that manageCountdownElement was called
      expect(global.manageCountdownElement).toHaveBeenCalledWith({
        show: false,
      });
    });

    test('should handle options button click with openOptionsPage', () => {
      // Call the DOMContentLoaded callback
      if (document.domContentLoadedCallback) {
        document.domContentLoadedCallback();
      }

      // Get the click event handler
      const clickHandler =
        mockOpenOptionsButton.addEventListener.mock.calls.find(
          (call) => call[0] === 'click',
        )[1];

      // Call the handler
      clickHandler();

      // Check that openOptionsPage was called
      expect(chrome.runtime.openOptionsPage).toHaveBeenCalled();
    });

    test('should handle options button click without openOptionsPage', () => {
      // Remove openOptionsPage
      chrome.runtime.openOptionsPage = undefined;

      // Call the DOMContentLoaded callback
      if (document.domContentLoadedCallback) {
        document.domContentLoadedCallback();
      }

      // Get the click event handler
      const clickHandler =
        mockOpenOptionsButton.addEventListener.mock.calls.find(
          (call) => call[0] === 'click',
        )[1];

      // Call the handler
      clickHandler();

      // Check that window.open was called
      expect(window.open).toHaveBeenCalledWith(
        'chrome-extension://options.html',
      );
    });

    test('should handle storage changes for lastKnownMergeState', () => {
      // Call the DOMContentLoaded callback
      if (document.domContentLoadedCallback) {
        document.domContentLoadedCallback();
      }

      // Get the storage change handler
      const storageHandler =
        chrome.storage.onChanged.addListener.mock.calls[0][0];

      // Call the handler with a mock change event
      storageHandler(
        { lastKnownMergeState: { newValue: {}, oldValue: null } },
        'local',
      );

      // Check that loadAndDisplayData was called (indirectly)
      expect(chrome.storage.sync.get).toHaveBeenCalled();
    });

    test('should handle storage changes for lastMatchingMessage', () => {
      // Call the DOMContentLoaded callback
      if (document.domContentLoadedCallback) {
        document.domContentLoadedCallback();
      }

      // Get the storage change handler
      const storageHandler =
        chrome.storage.onChanged.addListener.mock.calls[0][0];

      // Call the handler with a mock change event
      storageHandler(
        { lastMatchingMessage: { newValue: {}, oldValue: null } },
        'local',
      );

      // Check that loadAndDisplayData was called (indirectly)
      expect(chrome.storage.sync.get).toHaveBeenCalled();
    });

    test('should not handle storage changes for unrelated keys', () => {
      // Call the DOMContentLoaded callback
      if (document.domContentLoadedCallback) {
        document.domContentLoadedCallback();
      }

      // Get the storage change handler
      const storageHandler =
        chrome.storage.onChanged.addListener.mock.calls[0][0];

      // Reset the mock
      chrome.storage.sync.get.mockClear();

      // Call the handler with an unrelated change event
      storageHandler(
        { unrelatedKey: { newValue: {}, oldValue: null } },
        'local',
      );

      // Check that loadAndDisplayData was not called
      expect(chrome.storage.sync.get).not.toHaveBeenCalled();
    });

    test('should not handle storage changes for non-local namespace', () => {
      // Call the DOMContentLoaded callback
      if (document.domContentLoadedCallback) {
        document.domContentLoadedCallback();
      }

      // Get the storage change handler
      const storageHandler =
        chrome.storage.onChanged.addListener.mock.calls[0][0];

      // Reset the mock
      chrome.storage.sync.get.mockClear();

      // Call the handler with a non-local namespace
      storageHandler(
        { lastKnownMergeState: { newValue: {}, oldValue: null } },
        'sync',
      );

      // Check that loadAndDisplayData was not called
      expect(chrome.storage.sync.get).not.toHaveBeenCalled();
    });

    test('should handle runtime messages for updateCountdownDisplay', () => {
      // Call the DOMContentLoaded callback
      if (document.domContentLoadedCallback) {
        document.domContentLoadedCallback();
      }

      // Get the message handler
      const messageHandler =
        chrome.runtime.onMessage.addListener.mock.calls[0][0];

      // Set up the storage mock
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ featureEnabled: false });
      });

      // Call the handler with a mock message
      messageHandler({ action: 'updateCountdownDisplay', timeLeft: 60000 });

      // Check that storage was queried
      expect(chrome.storage.local.get).toHaveBeenCalledWith(
        ['featureEnabled'],
        expect.any(Function),
      );
    });

    test('should handle runtime messages for countdownCompleted', () => {
      // Call the DOMContentLoaded callback
      if (document.domContentLoadedCallback) {
        document.domContentLoadedCallback();
      }

      // Get the message handler
      const messageHandler =
        chrome.runtime.onMessage.addListener.mock.calls[0][0];

      // Call the handler with a mock message
      messageHandler({ action: 'countdownCompleted' });

      // Check that manageCountdownElement was called
      expect(global.manageCountdownElement).toHaveBeenCalledWith({
        show: false,
      });

      // Check that the toggle was updated
      expect(mockFeatureToggle.setAttribute).toHaveBeenCalledWith(
        'checked',
        '',
      );
    });

    test('should not handle unrelated runtime messages', () => {
      // Call the DOMContentLoaded callback
      if (document.domContentLoadedCallback) {
        document.domContentLoadedCallback();
      }

      // Get the message handler
      const messageHandler =
        chrome.runtime.onMessage.addListener.mock.calls[0][0];

      // Reset mocks
      global.manageCountdownElement.mockClear();
      mockFeatureToggle.setAttribute.mockClear();

      // Call the handler with an unrelated message
      messageHandler({ action: 'unrelatedAction' });

      // Check that no handlers were called
      expect(global.manageCountdownElement).not.toHaveBeenCalled();
      expect(mockFeatureToggle.setAttribute).not.toHaveBeenCalled();
    });
  });

  describe('initializeToggle', () => {
    test('should initialize toggle with delay', async () => {
      // Mock the Promise.resolve
      global.Promise.resolve.mockClear();

      // Call initializeToggle
      await popupModule.initializeToggle(mockFeatureToggle);

      // Check that Promise.resolve was called
      expect(global.Promise.resolve).toHaveBeenCalled();
    });
  });
});
