/**
 * @vitest-environment jsdom
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { literals } from '../src/literals.js';

// Import the functions
import * as popupModule from '../src/popup.js';

// Extract the exported functions
const {
  updateUI,
  manageCountdownElement,
  updateCountdownDisplay,
  initializeFeatureToggleState,
} = popupModule;

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

describe('popup.js', () => {
  let mockStatusIcon,
    mockStatusText,
    mockOpenOptionsButton,
    mockSlackChannelLink,
    mockMatchingMessageDiv,
    mockFeatureToggle,
    mockCountdownElement;

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
      if (id === 'countdown-timer') return mockCountdownElement;
      return null;
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
        getURL: vi.fn(),
        onMessage: {
          addListener: vi.fn(),
        },
      },
    };

    // Mock global manageCountdownElement
    global.manageCountdownElement = vi.fn();
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
      expect(mockStatusText.className).toBe('disallowed');
      expect(mockStatusIcon.textContent).toBe(literals.popup.emojiDisallowed);
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
      expect(mockStatusText.className).toBe('exception');
      expect(mockStatusIcon.textContent).toBe(literals.popup.emojiException);
      expect(mockStatusText.textContent).toBe('Test message');
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
      expect(mockStatusText.className).toBe('config_needed');
      expect(mockStatusIcon.textContent).toBe(literals.popup.emojiUnknown);
      expect(mockStatusText.textContent).toBe('Test message');
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
      expect(mockStatusText.className).toBe('unknown');
      expect(mockStatusIcon.textContent).toBe(literals.popup.emojiUnknown);
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
});
