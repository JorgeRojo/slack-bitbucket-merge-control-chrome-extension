/**
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals';
import {
  updateUI,
  getReactivationTime,
  manageCountdownElement,
  updateCountdownDisplay,
  initializeFeatureToggleState,
  loadAndDisplayData,
} from '../src/popup.js';
import { literals } from '../src/literals.js';
import {
  SLACK_BASE_URL,
  FEATURE_REACTIVATION_TIMEOUT,
} from '../src/constants.js';

// Mock DOM elements
const createMockElement = () => ({
  className: '',
  textContent: '',
  style: { display: '' },
  href: '',
  setAttribute: jest.fn(),
  removeAttribute: jest.fn(),
});

// Mock document.getElementById
global.document = {
  getElementById: jest.fn(),
};

// Mock console.error
global.console = {
  error: jest.fn(),
};

// Mock Date.now for consistent testing
const mockDateNow = jest.spyOn(Date, 'now');

// Mock setInterval and clearInterval
global.setInterval = jest.fn();
global.clearInterval = jest.fn();

describe('popup.js', () => {
  let mockStatusIcon,
    mockStatusText,
    mockOpenOptionsButton,
    mockSlackChannelLink,
    mockMatchingMessageDiv;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDateNow.mockReturnValue(1000000);

    // Mock chrome API for each test
    global.chrome = {
      storage: {
        sync: {
          get: jest.fn(),
        },
        local: {
          get: jest.fn(),
          set: jest.fn(),
        },
      },
      runtime: {
        sendMessage: jest.fn(),
        openOptionsPage: jest.fn(),
        getURL: jest.fn(),
      },
    };

    mockStatusIcon = createMockElement();
    mockStatusText = createMockElement();
    mockOpenOptionsButton = createMockElement();
    mockSlackChannelLink = createMockElement();
    mockMatchingMessageDiv = createMockElement();
  });

  describe('updateUI', () => {
    test('should update UI for allowed state', () => {
      const message = 'Test message';

      updateUI(
        mockStatusIcon,
        mockStatusText,
        mockOpenOptionsButton,
        mockSlackChannelLink,
        mockMatchingMessageDiv,
        'allowed',
        message,
      );

      expect(mockStatusIcon.className).toBe('allowed');
      expect(mockStatusText.className).toBe('allowed');
      expect(mockStatusIcon.textContent).toBe(literals.popup.emojiAllowed);
      expect(mockStatusText.textContent).toBe(message);
      expect(mockOpenOptionsButton.style.display).toBe('none');
      expect(mockSlackChannelLink.style.display).toBe('none');
      expect(mockMatchingMessageDiv.style.display).toBe('none');
    });

    test('should update UI for disallowed state', () => {
      const message = 'Test message';

      updateUI(
        mockStatusIcon,
        mockStatusText,
        mockOpenOptionsButton,
        mockSlackChannelLink,
        mockMatchingMessageDiv,
        'disallowed',
        message,
      );

      expect(mockStatusIcon.className).toBe('disallowed');
      expect(mockStatusText.className).toBe('disallowed');
      expect(mockStatusIcon.textContent).toBe(literals.popup.emojiDisallowed);
      expect(mockStatusText.textContent).toBe(message);
    });

    test('should update UI for exception state', () => {
      const message = 'Test message';

      updateUI(
        mockStatusIcon,
        mockStatusText,
        mockOpenOptionsButton,
        mockSlackChannelLink,
        mockMatchingMessageDiv,
        'exception',
        message,
      );

      expect(mockStatusIcon.className).toBe('exception');
      expect(mockStatusText.className).toBe('exception');
      expect(mockStatusIcon.textContent).toBe(literals.popup.emojiException);
      expect(mockStatusText.textContent).toBe(message);
      expect(mockSlackChannelLink.style.display).toBe('block');
    });

    test('should update UI for config_needed state', () => {
      const message = 'Test message';

      updateUI(
        mockStatusIcon,
        mockStatusText,
        mockOpenOptionsButton,
        mockSlackChannelLink,
        mockMatchingMessageDiv,
        'config_needed',
        message,
      );

      expect(mockStatusIcon.className).toBe('config_needed');
      expect(mockStatusText.className).toBe('config_needed');
      expect(mockStatusIcon.textContent).toBe(literals.popup.emojiUnknown);
      expect(mockStatusText.textContent).toBe(message);
      expect(mockOpenOptionsButton.style.display).toBe('block');
    });

    test('should update UI for unknown state with default message', () => {
      updateUI(
        mockStatusIcon,
        mockStatusText,
        mockOpenOptionsButton,
        mockSlackChannelLink,
        mockMatchingMessageDiv,
        'unknown',
      );

      expect(mockStatusIcon.className).toBe('unknown');
      expect(mockStatusText.className).toBe('unknown');
      expect(mockStatusIcon.textContent).toBe(literals.popup.emojiUnknown);
      expect(mockStatusText.textContent).toBe(
        literals.popup.textCouldNotDetermine,
      );
    });

    test('should display matching message when provided', () => {
      const message = 'Test message';
      const matchingMessage = { text: 'matching text' };

      updateUI(
        mockStatusIcon,
        mockStatusText,
        mockOpenOptionsButton,
        mockSlackChannelLink,
        mockMatchingMessageDiv,
        'allowed',
        message,
        matchingMessage,
      );

      expect(mockMatchingMessageDiv.textContent).toBe(
        `${literals.popup.textMatchingMessagePrefix}${matchingMessage.text}"`,
      );
      expect(mockMatchingMessageDiv.style.display).toBe('block');
    });
  });

  describe('getReactivationTime', () => {
    test('should return current time plus reactivation timeout', () => {
      const currentTime = 1000000;
      mockDateNow.mockReturnValue(currentTime);

      const result = getReactivationTime();

      expect(result).toBe(currentTime + FEATURE_REACTIVATION_TIMEOUT);
    });
  });

  describe('manageCountdownElement', () => {
    let mockCountdownElement;

    beforeEach(() => {
      mockCountdownElement = createMockElement();
      global.document.getElementById = jest.fn((id) => {
        if (id === 'countdown-timer') return mockCountdownElement;
        return null;
      });
    });

    test('should show countdown with correct time format', () => {
      const timeLeft = 65000; // 1 minute 5 seconds

      const result = manageCountdownElement({ show: true, timeLeft });

      expect(result).toBe(mockCountdownElement);
      expect(mockCountdownElement.style.display).toBe('block');
      expect(mockCountdownElement.textContent).toBe('Reactivation in: 1:05');
    });

    test('should hide countdown when show is false', () => {
      // Set display to block initially
      mockCountdownElement.style.display = 'block';

      const result = manageCountdownElement({ show: false });

      expect(result).toBe(mockCountdownElement);
      expect(mockCountdownElement.style.display).toBe('none');
    });

    test('should return null when countdown element is not found', () => {
      global.document.getElementById = jest.fn(() => null);

      const result = manageCountdownElement({ show: true });

      expect(result).toBeNull();
    });
  });

  describe('updateCountdownDisplay', () => {
    let mockCountdownElement;

    beforeEach(() => {
      mockCountdownElement = createMockElement();
      // Mock chrome.storage.local.get para las pruebas
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ featureEnabled: false }); // Simular que la función está deshabilitada
      });

      // Mock manageCountdownElement
      global.manageCountdownElement = jest.fn((options) => {
        if (options.show) {
          mockCountdownElement.style.display = 'block';
          if (options.timeLeft) {
            const minutes = Math.floor(options.timeLeft / 60000);
            const seconds = Math.floor((options.timeLeft % 60000) / 1000);
            mockCountdownElement.textContent = `Reactivation in: ${minutes}:${seconds.toString().padStart(2, '0')}`;
          }
        } else {
          mockCountdownElement.style.display = 'none';
        }
        return mockCountdownElement;
      });
    });

    afterEach(() => {
      delete global.manageCountdownElement;
    });

    test('should update countdown display with correct time format when feature is disabled', () => {
      const timeLeft = 65000; // 1 minute 5 seconds

      updateCountdownDisplay(timeLeft);

      // Ejecutar el callback de chrome.storage.local.get
      const callback = chrome.storage.local.get.mock.calls[0][1];
      callback({ featureEnabled: false });

      expect(global.manageCountdownElement).toHaveBeenCalledWith({
        show: true,
        timeLeft: 65000,
      });
    });

    test('should hide countdown when time is zero or negative', () => {
      updateCountdownDisplay(0);

      // Ejecutar el callback de chrome.storage.local.get
      const callback = chrome.storage.local.get.mock.calls[0][1];
      callback({ featureEnabled: false });

      expect(global.manageCountdownElement).toHaveBeenCalledWith({
        show: false,
      });
    });

    test('should hide countdown when feature is enabled', () => {
      updateCountdownDisplay(65000);

      // Ejecutar el callback de chrome.storage.local.get con featureEnabled = true
      const callback = chrome.storage.local.get.mock.calls[0][1];
      callback({ featureEnabled: true });

      expect(global.manageCountdownElement).toHaveBeenCalledWith({
        show: false,
      });
    });
  });

  describe('initializeFeatureToggleState', () => {
    let mockToggleElement, mockCountdownElement;

    beforeEach(() => {
      mockToggleElement = createMockElement();
      mockCountdownElement = createMockElement();

      global.document.getElementById = jest.fn((id) => {
        if (id === 'countdown-timer') return mockCountdownElement;
        return null;
      });

      // Mock manageCountdownElement
      global.manageCountdownElement = jest.fn(() => mockCountdownElement);
    });

    afterEach(() => {
      delete global.manageCountdownElement;
    });

    test('should set toggle to checked when feature is enabled', () => {
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ featureEnabled: true });
      });

      initializeFeatureToggleState(mockToggleElement);

      expect(mockToggleElement.setAttribute).toHaveBeenCalledWith(
        'checked',
        '',
      );
      // When feature is enabled, countdown should be hidden
      expect(global.manageCountdownElement).toHaveBeenCalledWith({
        show: false,
      });
    });

    test('should set toggle to unchecked when feature is disabled', () => {
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ featureEnabled: false });
      });

      initializeFeatureToggleState(mockToggleElement);

      expect(mockToggleElement.removeAttribute).toHaveBeenCalledWith('checked');
    });

    test('should check countdown status when feature is disabled', () => {
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ featureEnabled: false });
      });

      // Mock the sendMessage to simulate getting countdown status
      chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        if (message.action === 'getCountdownStatus') {
          callback({
            isCountdownActive: true,
            timeLeft: 65000,
            reactivationTime: 1065000,
          });
        }
      });

      initializeFeatureToggleState(mockToggleElement);

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        { action: 'getCountdownStatus' },
        expect.any(Function),
      );
    });

    test('should default to enabled when featureEnabled is undefined', () => {
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({});
      });

      initializeFeatureToggleState(mockToggleElement);

      expect(mockToggleElement.setAttribute).toHaveBeenCalledWith(
        'checked',
        '',
      );
    });
  });

  describe('loadAndDisplayData', () => {
    beforeEach(() => {
      chrome.storage.sync.get.mockResolvedValue({});
      chrome.storage.local.get.mockResolvedValue({});
    });

    test('should show config needed when tokens are missing', async () => {
      chrome.storage.sync.get.mockResolvedValue({
        slackToken: null,
        appToken: null,
        channelName: null,
      });

      await loadAndDisplayData(
        mockStatusIcon,
        mockStatusText,
        mockOpenOptionsButton,
        mockSlackChannelLink,
        mockMatchingMessageDiv,
      );

      expect(mockStatusIcon.className).toBe('config_needed');
      expect(mockStatusText.textContent).toBe(literals.popup.textConfigNeeded);
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

      await loadAndDisplayData(
        mockStatusIcon,
        mockStatusText,
        mockOpenOptionsButton,
        mockSlackChannelLink,
        mockMatchingMessageDiv,
      );

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

      await loadAndDisplayData(
        mockStatusIcon,
        mockStatusText,
        mockOpenOptionsButton,
        mockSlackChannelLink,
        mockMatchingMessageDiv,
      );

      expect(mockStatusIcon.className).toBe('loading');
      expect(mockStatusText.textContent).toBe(
        literals.popup.textWaitingMessages,
      );
    });

    test('should handle exception status', async () => {
      const lastSlackMessage = { text: 'test message' };

      chrome.storage.sync.get.mockResolvedValue({
        slackToken: 'xoxb-token',
        appToken: 'xapp-token',
        channelName: 'general',
      });

      chrome.storage.local.get.mockResolvedValueOnce({}).mockResolvedValueOnce({
        lastKnownMergeState: {
          mergeStatus: 'exception',
          lastSlackMessage,
        },
      });

      await loadAndDisplayData(
        mockStatusIcon,
        mockStatusText,
        mockOpenOptionsButton,
        mockSlackChannelLink,
        mockMatchingMessageDiv,
      );

      expect(mockStatusIcon.className).toBe('exception');
      expect(mockStatusText.textContent).toBe(
        literals.popup.textAllowedWithExceptions,
      );
      expect(mockSlackChannelLink.style.display).toBe('block');
    });

    test('should handle allowed status', async () => {
      const lastSlackMessage = { text: 'test message' };

      chrome.storage.sync.get.mockResolvedValue({
        slackToken: 'xoxb-token',
        appToken: 'xapp-token',
        channelName: 'general',
      });

      chrome.storage.local.get.mockResolvedValueOnce({}).mockResolvedValueOnce({
        lastKnownMergeState: {
          mergeStatus: 'allowed',
          lastSlackMessage,
        },
      });

      await loadAndDisplayData(
        mockStatusIcon,
        mockStatusText,
        mockOpenOptionsButton,
        mockSlackChannelLink,
        mockMatchingMessageDiv,
      );

      expect(mockStatusIcon.className).toBe('allowed');
      expect(mockStatusText.textContent).toBe(literals.popup.textMergeAllowed);
    });

    test('should handle disallowed status', async () => {
      const lastSlackMessage = { text: 'test message' };

      chrome.storage.sync.get.mockResolvedValue({
        slackToken: 'xoxb-token',
        appToken: 'xapp-token',
        channelName: 'general',
      });

      chrome.storage.local.get.mockResolvedValueOnce({}).mockResolvedValueOnce({
        lastKnownMergeState: {
          mergeStatus: 'disallowed',
          lastSlackMessage,
        },
      });

      await loadAndDisplayData(
        mockStatusIcon,
        mockStatusText,
        mockOpenOptionsButton,
        mockSlackChannelLink,
        mockMatchingMessageDiv,
      );

      expect(mockStatusIcon.className).toBe('disallowed');
      expect(mockStatusText.textContent).toBe(
        literals.popup.textMergeNotAllowed,
      );
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

      await loadAndDisplayData(
        mockStatusIcon,
        mockStatusText,
        mockOpenOptionsButton,
        mockSlackChannelLink,
        mockMatchingMessageDiv,
      );

      expect(mockStatusIcon.className).toBe('unknown');
      expect(mockStatusText.textContent).toBe(
        literals.popup.textCouldNotDetermineStatus,
      );
    });

    test('should handle errors gracefully', async () => {
      chrome.storage.sync.get.mockRejectedValue(new Error('Storage error'));

      await loadAndDisplayData(
        mockStatusIcon,
        mockStatusText,
        mockOpenOptionsButton,
        mockSlackChannelLink,
        mockMatchingMessageDiv,
      );

      expect(console.error).toHaveBeenCalledWith(
        'Error processing messages:',
        expect.any(Error),
      );
      expect(mockStatusIcon.className).toBe('disallowed');
      expect(mockStatusText.textContent).toBe(
        literals.popup.textErrorProcessingMessages,
      );
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

      await loadAndDisplayData(
        mockStatusIcon,
        mockStatusText,
        mockOpenOptionsButton,
        mockSlackChannelLink,
        mockMatchingMessageDiv,
      );

      expect(mockStatusIcon.className).toBe('loading');
      expect(mockStatusText.textContent).toBe(
        literals.popup.textWaitingMessages,
      );
    });
  });
});
