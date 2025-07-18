/**
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals';
import {
  updateUI,
  getReactivationTime,
  startCountdown,
  stopAndHideCountdown,
  scheduleFeatureReactivation,
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

  describe('stopAndHideCountdown', () => {
    let mockCountdownElement;

    beforeEach(() => {
      mockCountdownElement = createMockElement();
    });

    test('should hide countdown element', () => {
      stopAndHideCountdown(mockCountdownElement);
      expect(mockCountdownElement.style.display).toBe('none');
    });

    test('should handle null countdown element', () => {
      expect(() => {
        stopAndHideCountdown(null);
      }).not.toThrow();
    });
  });

  describe('startCountdown', () => {
    let mockCountdownElement, mockToggleElement, mockUpdateCountdown;

    beforeEach(() => {
      mockCountdownElement = createMockElement();
      mockToggleElement = createMockElement();

      // Mock setInterval to capture the callback
      global.setInterval = jest.fn((callback) => {
        mockUpdateCountdown = callback;
        return 123; // mock interval ID
      });
    });

    test('should start countdown and update display', () => {
      const targetTime = 1000000 + 65000; // 1 minute 5 seconds from now
      mockDateNow.mockReturnValue(1000000);

      startCountdown(targetTime, mockCountdownElement, mockToggleElement);

      expect(global.setInterval).toHaveBeenCalledWith(
        expect.any(Function),
        1000,
      );
      expect(mockCountdownElement.textContent).toBe('Reactivation in: 1:05');
    });

    test('should reactivate toggle when countdown reaches zero', () => {
      const targetTime = 1000000; // same as current time
      mockDateNow.mockReturnValue(1000000);

      startCountdown(targetTime, mockCountdownElement, mockToggleElement);

      // Simulate countdown reaching zero
      mockUpdateCountdown();

      expect(mockToggleElement.setAttribute).toHaveBeenCalledWith(
        'checked',
        '',
      );
      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        featureEnabled: true,
      });
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        action: 'featureToggleChanged',
        enabled: true,
      });
      expect(mockCountdownElement.style.display).toBe('none');
      expect(global.clearInterval).toHaveBeenCalledWith(123);
    });

    test('should handle negative time left', () => {
      const targetTime = 999000; // in the past
      mockDateNow.mockReturnValue(1000000);

      startCountdown(targetTime, mockCountdownElement, mockToggleElement);

      expect(mockToggleElement.setAttribute).toHaveBeenCalledWith(
        'checked',
        '',
      );
    });
  });

  describe('scheduleFeatureReactivation', () => {
    let mockToggleElement, mockCountdownElement;

    beforeEach(() => {
      mockToggleElement = createMockElement();
      mockCountdownElement = createMockElement();

      global.document.getElementById = jest.fn((id) => {
        if (id === 'countdown-timer') return mockCountdownElement;
        return null;
      });
    });

    test('should schedule reactivation with provided time', () => {
      const reactivationTime = 2000000;

      scheduleFeatureReactivation(mockToggleElement, reactivationTime);

      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        reactivationTime,
      });
    });

    test('should schedule reactivation with default time when not provided', () => {
      mockDateNow.mockReturnValue(1000000);

      scheduleFeatureReactivation(mockToggleElement);

      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        reactivationTime: 1000000 + FEATURE_REACTIVATION_TIMEOUT,
      });
    });

    test('should handle missing countdown element', () => {
      global.document.getElementById = jest.fn(() => null);

      expect(() => {
        scheduleFeatureReactivation(mockToggleElement, 2000000);
      }).not.toThrow();
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
    });

    test('should set toggle to unchecked when feature is disabled', () => {
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ featureEnabled: false });
      });

      initializeFeatureToggleState(mockToggleElement);

      expect(mockToggleElement.removeAttribute).toHaveBeenCalledWith('checked');
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
