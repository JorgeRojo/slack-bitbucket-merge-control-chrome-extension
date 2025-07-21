import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { mockStorage, mockRuntime } from './setup.js';

const createMockElement = () => ({
  className: '',
  textContent: '',
  style: { display: '' },
  href: '',
  setAttribute: vi.fn(),
  removeAttribute: vi.fn(),
  addEventListener: vi.fn(),
  appendChild: vi.fn(),
  remove: vi.fn(),
});

console.error = vi.fn();
console.log = vi.fn();
window.open = vi.fn();

describe('popup.js', () => {
  let mockStatusIcon,
    mockStatusText,
    mockOpenOptionsButton,
    mockSlackChannelLink,
    mockMatchingMessageDiv,
    mockFeatureToggle,
    mockCountdownElement,
    mockOptionsLinkContainer,
    mockPopupContent,
    mockErrorDetails;

  let domContentLoadedHandler;
  const originalAddEventListener = document.addEventListener;
  const originalQuerySelector = document.querySelector;
  const originalCreateElement = document.createElement;

  beforeEach(() => {
    vi.clearAllMocks();

    mockStatusIcon = createMockElement();
    mockStatusText = createMockElement();
    mockOpenOptionsButton = createMockElement();
    mockSlackChannelLink = createMockElement();
    mockMatchingMessageDiv = createMockElement();
    mockFeatureToggle = createMockElement();
    mockCountdownElement = createMockElement();
    mockOptionsLinkContainer = createMockElement();
    mockPopupContent = createMockElement();
    mockErrorDetails = createMockElement();

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
        case 'options-link-container':
          return mockOptionsLinkContainer;
        case 'error-details':
          return mockErrorDetails;
        default:
          return null;
      }
    });

    document.querySelector = vi.fn((selector) => {
      if (selector === '.popup-content') {
        return mockPopupContent;
      }
      return originalQuerySelector.call(document, selector);
    });

    document.createElement = vi.fn((tagName) => {
      if (tagName === 'div') {
        return createMockElement();
      }
      return originalCreateElement.call(document, tagName);
    });

    mockStorage.sync.get.mockResolvedValue({
      slackToken: 'test-token',
      appToken: 'test-app-token',
      channelName: 'test-channel',
      disallowedPhrases: 'block,stop,do not merge',
      exceptionPhrases: 'allow,proceed,exception',
      bitbucketUrl: 'https://bitbucket.org/test',
    });

    mockStorage.local.get.mockResolvedValue({
      featureEnabled: true,
      messages: [],
      teamId: 'test-team',
      channelId: 'test-channel-id',
      countdownEndTime: Date.now() + 60000,
    });

    mockRuntime.getURL.mockReturnValue('chrome-extension://options.html');

    document.addEventListener = vi.fn((event, handler) => {
      if (event === 'DOMContentLoaded') {
        domContentLoadedHandler = handler;
      }
      return originalAddEventListener.call(document, event, handler);
    });

    vi.resetModules();
    require('../src/popup.js');
  });

  afterEach(() => {
    document.addEventListener = originalAddEventListener;
    document.querySelector = originalQuerySelector;
    document.createElement = originalCreateElement;
  });

  describe('DOMContentLoaded event', () => {
    test('should register event listeners', async () => {
      expect(document.addEventListener).toHaveBeenCalledWith(
        'DOMContentLoaded',
        expect.any(Function),
      );
      expect(domContentLoadedHandler).toBeDefined();
    });

    test('should handle missing featureToggle', async () => {
      document.getElementById = vi.fn((id) => {
        if (id === 'feature-toggle') return null;
        return mockStatusIcon;
      });

      vi.resetModules();
      require('../src/popup.js');

      await domContentLoadedHandler();

      expect(mockStorage.sync.get).toHaveBeenCalled();
    });
  });

  describe('UI update functions', () => {
    test('should update UI with matching message', async () => {
      mockStorage.local.get.mockResolvedValue({
        lastKnownMergeState: {
          mergeStatus: 'allowed',
          lastSlackMessage: { text: 'Test matching message' },
          appStatus: 'ok',
        },
      });

      await domContentLoadedHandler();

      expect(mockMatchingMessageDiv.textContent).toBe('Test matching message');
    });

    test('should handle all merge status cases', async () => {
      mockStorage.local.get.mockResolvedValue({
        lastKnownMergeState: {
          mergeStatus: 'allowed',
          appStatus: 'ok',
        },
      });

      await domContentLoadedHandler();

      mockStorage.local.get.mockResolvedValue({
        lastKnownMergeState: {
          mergeStatus: 'disallowed',
          appStatus: 'ok',
        },
      });

      await domContentLoadedHandler();

      mockStorage.local.get.mockResolvedValue({
        lastKnownMergeState: {
          mergeStatus: 'exception',
          appStatus: 'ok',
        },
      });

      await domContentLoadedHandler();
    });

    test('should handle config needed UI', async () => {
      mockStorage.sync.get.mockResolvedValue({
        slackToken: null,
        appToken: null,
        channelName: null,
      });

      await domContentLoadedHandler();
    });

    test('should handle optionsLinkContainer display logic', async () => {
      mockStorage.sync.get.mockResolvedValue({
        slackToken: null,
        appToken: null,
        channelName: null,
      });

      await domContentLoadedHandler();

      mockStorage.sync.get.mockResolvedValue({
        slackToken: 'test-token',
        appToken: 'test-app-token',
        channelName: 'test-channel',
      });

      mockStorage.local.get.mockResolvedValue({
        lastKnownMergeState: {
          mergeStatus: 'allowed',
          appStatus: 'ok',
        },
      });

      await domContentLoadedHandler();
    });
  });

  describe('Countdown functions', () => {
    test('should handle missing countdown element', async () => {
      document.getElementById = vi.fn((id) => {
        if (id === 'countdown-timer') return null;
        if (id === 'feature-toggle') return mockFeatureToggle;
        return mockStatusIcon;
      });

      mockStorage.local.get.mockImplementation((keys, callback) => {
        if (keys.includes('featureEnabled')) {
          callback({ featureEnabled: false });
        } else {
          callback({});
        }
      });

      await domContentLoadedHandler();

      const messageHandler = mockRuntime.onMessage.addListener.mock.calls[0][0];
      messageHandler({ action: 'updateCountdownDisplay', timeLeft: 65000 });
    });

    test('should update countdown text correctly', async () => {
      mockStorage.local.get.mockImplementation((keys, callback) => {
        if (keys.includes('featureEnabled')) {
          callback({ featureEnabled: false });
        } else {
          callback({});
        }
      });

      await domContentLoadedHandler();

      const messageHandler = mockRuntime.onMessage.addListener.mock.calls[0][0];

      messageHandler({ action: 'updateCountdownDisplay', timeLeft: 65000 });
      expect(mockCountdownElement.textContent).toContain('Reactivation in:');

      messageHandler({ action: 'updateCountdownDisplay', timeLeft: 5000 });
      expect(mockCountdownElement.textContent).toContain('Reactivation in:');

      messageHandler({ action: 'updateCountdownDisplay', timeLeft: 125000 });
      expect(mockCountdownElement.textContent).toContain('Reactivation in:');
    });
  });

  describe('Event handlers', () => {
    test('should handle toggle event', async () => {
      mockStorage.sync.get.mockResolvedValue({
        slackToken: 'xoxb-token',
        appToken: 'xapp-token',
        channelName: 'general',
      });

      mockStorage.local.get.mockImplementation((keys, callback) => {
        if (typeof callback === 'function') {
          callback({ featureEnabled: true });
        }
        return Promise.resolve({});
      });

      await domContentLoadedHandler();

      const toggleHandler = mockFeatureToggle.addEventListener.mock.calls.find(
        (call) => call[0] === 'toggle',
      )[1];

      toggleHandler({ detail: { checked: true } });

      expect(mockStorage.local.set).toHaveBeenCalledWith({
        featureEnabled: true,
      });

      expect(mockRuntime.sendMessage).toHaveBeenCalledWith(
        {
          action: 'featureToggleChanged',
          enabled: true,
        },
        expect.any(Function),
      );
    });

    test('should handle options button click with openOptionsPage', async () => {
      mockStorage.sync.get.mockResolvedValue({
        slackToken: 'xoxb-token',
        appToken: 'xapp-token',
        channelName: 'general',
      });

      mockStorage.local.get.mockImplementation((keys, callback) => {
        if (typeof callback === 'function') {
          callback({ featureEnabled: true });
        }
        return Promise.resolve({});
      });

      await domContentLoadedHandler();

      const clickHandler =
        mockOpenOptionsButton.addEventListener.mock.calls.find(
          (call) => call[0] === 'click',
        )[1];

      clickHandler();

      expect(mockRuntime.openOptionsPage).toHaveBeenCalled();
    });

    test('should handle options button click without openOptionsPage', async () => {
      mockStorage.sync.get.mockResolvedValue({
        slackToken: 'xoxb-token',
        appToken: 'xapp-token',
        channelName: 'general',
      });

      mockStorage.local.get.mockImplementation((keys, callback) => {
        if (typeof callback === 'function') {
          callback({ featureEnabled: true });
        }
        return Promise.resolve({});
      });

      mockRuntime.openOptionsPage = undefined;

      await domContentLoadedHandler();

      const clickHandler =
        mockOpenOptionsButton.addEventListener.mock.calls.find(
          (call) => call[0] === 'click',
        )[1];

      clickHandler();

      expect(window.open).toHaveBeenCalledWith(
        'chrome-extension://options.html',
      );
    });

    test('should handle storage changes', async () => {
      mockStorage.sync.get.mockResolvedValue({
        slackToken: 'xoxb-token',
        appToken: 'xapp-token',
        channelName: 'general',
      });

      mockStorage.local.get.mockImplementation((keys, callback) => {
        if (typeof callback === 'function') {
          callback({ featureEnabled: true });
        }
        return Promise.resolve({});
      });

      await domContentLoadedHandler();

      const storageHandler = mockStorage.onChanged.addListener.mock.calls[0][0];

      mockStorage.sync.get.mockClear();

      storageHandler(
        { lastKnownMergeState: { newValue: {}, oldValue: null } },
        'local',
      );

      expect(mockStorage.sync.get).toHaveBeenCalled();
    });

    test('should handle runtime messages for updateCountdownDisplay', async () => {
      mockStorage.sync.get.mockResolvedValue({
        slackToken: 'xoxb-token',
        appToken: 'xapp-token',
        channelName: 'general',
      });

      mockStorage.local.get.mockImplementation((keys, callback) => {
        if (typeof callback === 'function') {
          callback({ featureEnabled: false });
        }
        return Promise.resolve({});
      });

      await domContentLoadedHandler();

      const messageHandler = mockRuntime.onMessage.addListener.mock.calls[0][0];

      messageHandler({ action: 'updateCountdownDisplay', timeLeft: 60000 });

      expect(mockStorage.local.get).toHaveBeenCalledWith(
        ['featureEnabled'],
        expect.any(Function),
      );
    });

    test('should handle runtime messages for countdownCompleted', async () => {
      mockStorage.sync.get.mockResolvedValue({
        slackToken: 'xoxb-token',
        appToken: 'xapp-token',
        channelName: 'general',
      });

      mockStorage.local.get.mockImplementation((keys, callback) => {
        if (typeof callback === 'function') {
          callback({ featureEnabled: true });
        }
        return Promise.resolve({});
      });

      await domContentLoadedHandler();

      const messageHandler = mockRuntime.onMessage.addListener.mock.calls[0][0];

      messageHandler({ action: 'countdownCompleted' });

      expect(mockFeatureToggle.setAttribute).toHaveBeenCalledWith(
        'checked',
        '',
      );
    });
  });

  describe('UI state handling', () => {
    test('should handle countdown display', async () => {
      mockStorage.local.get.mockImplementation((keys, callback) => {
        if (keys.includes('featureEnabled')) {
          callback({ featureEnabled: false });
        } else {
          callback({});
        }
      });

      await domContentLoadedHandler();

      const messageHandler = mockRuntime.onMessage.addListener.mock.calls[0][0];

      messageHandler({ action: 'updateCountdownDisplay', timeLeft: 65000 });

      mockStorage.local.get.mockImplementation((keys, callback) => {
        if (keys.includes('featureEnabled')) {
          callback({ featureEnabled: true });
        } else {
          callback({});
        }
      });

      messageHandler({ action: 'updateCountdownDisplay', timeLeft: 65000 });

      mockStorage.local.get.mockImplementation((keys, callback) => {
        if (keys.includes('featureEnabled')) {
          callback({ featureEnabled: false });
        } else {
          callback({});
        }
      });

      messageHandler({ action: 'updateCountdownDisplay', timeLeft: 0 });
    });

    test('should handle missing countdown element', async () => {
      document.getElementById.mockImplementation((id) => {
        if (id === 'countdown-timer') return null;
        return mockStatusIcon;
      });

      mockStorage.local.get.mockImplementation((keys, callback) => {
        if (keys.includes('featureEnabled')) {
          callback({ featureEnabled: false });
        } else {
          callback({});
        }
      });

      await domContentLoadedHandler();

      const messageHandler = mockRuntime.onMessage.addListener.mock.calls[0][0];

      messageHandler({ action: 'updateCountdownDisplay', timeLeft: 65000 });
    });
  });

  describe('Error handling', () => {
    test('should handle runtime.lastError in checkCountdownStatus', async () => {
      mockStorage.sync.get.mockResolvedValue({
        slackToken: 'xoxb-token',
        appToken: 'xapp-token',
        channelName: 'general',
      });

      mockStorage.local.get.mockImplementation((keys, callback) => {
        if (typeof callback === 'function') {
          callback({ featureEnabled: false });
        }
        return Promise.resolve({});
      });

      mockRuntime.sendMessage.mockImplementation((message, callback) => {
        if (
          message.action === 'getCountdownStatus' &&
          callback &&
          typeof callback === 'function'
        ) {
          mockRuntime.lastError = {
            message: 'The message port closed before a response was received.',
          };
          callback(null);
          delete mockRuntime.lastError;
        }
      });

      await domContentLoadedHandler();

      const messageHandler = mockRuntime.onMessage.addListener.mock.calls[0][0];

      messageHandler({ action: 'countdownCompleted' }, {}, () => {});

      expect(mockRuntime.sendMessage).toHaveBeenCalledWith(
        { action: 'getCountdownStatus' },
        expect.any(Function),
      );

      // Error should be silenced, not logged
      expect(console.log).not.toHaveBeenCalledWith(
        'Error receiving response:',
        'The message port closed before a response was received.',
      );
    });

    test('should handle runtime.lastError in toggle event', async () => {
      mockStorage.sync.get.mockResolvedValue({
        slackToken: 'xoxb-token',
        appToken: 'xapp-token',
        channelName: 'general',
      });

      mockStorage.local.get.mockImplementation((keys, callback) => {
        if (typeof callback === 'function') {
          callback({ featureEnabled: true });
        }
        return Promise.resolve({});
      });

      mockRuntime.sendMessage.mockImplementation((message, callback) => {
        if (
          message.action === 'featureToggleChanged' &&
          callback &&
          typeof callback === 'function'
        ) {
          mockRuntime.lastError = {
            message: 'The message port closed before a response was received.',
          };
          callback(null);
          delete mockRuntime.lastError;
        }
      });

      await domContentLoadedHandler();

      const toggleHandler = mockFeatureToggle.addEventListener.mock.calls.find(
        (call) => call[0] === 'toggle',
      )[1];

      toggleHandler({ detail: { checked: true } });

      expect(mockRuntime.sendMessage).toHaveBeenCalledWith(
        {
          action: 'featureToggleChanged',
          enabled: true,
        },
        expect.any(Function),
      );

      // Error should be silenced, not logged
      expect(console.log).not.toHaveBeenCalledWith(
        'Error receiving featureToggleChanged response:',
        'The message port closed before a response was received.',
      );
    });

    test('should handle exception in sendMessage during checkCountdownStatus', async () => {
      mockStorage.sync.get.mockResolvedValue({
        slackToken: 'xoxb-token',
        appToken: 'xapp-token',
        channelName: 'general',
      });

      mockStorage.local.get.mockImplementation((keys, callback) => {
        if (typeof callback === 'function') {
          callback({ featureEnabled: false });
        }
        return Promise.resolve({});
      });

      mockRuntime.sendMessage.mockImplementation((message) => {
        if (message.action === 'getCountdownStatus') {
          throw new Error('Test error');
        }
      });

      await domContentLoadedHandler();

      const messageHandler = mockRuntime.onMessage.addListener.mock.calls[0][0];

      messageHandler({ action: 'countdownCompleted' }, {}, () => {});

      // Error should be silenced, not logged
      expect(console.log).not.toHaveBeenCalledWith(
        'Error sending message:',
        expect.any(Error),
      );
    });

    test('should handle exception in sendMessage during toggle event', async () => {
      mockStorage.sync.get.mockResolvedValue({
        slackToken: 'xoxb-token',
        appToken: 'xapp-token',
        channelName: 'general',
      });

      mockStorage.local.get.mockImplementation((keys, callback) => {
        if (typeof callback === 'function') {
          callback({ featureEnabled: true });
        }
        return Promise.resolve({});
      });

      mockRuntime.sendMessage.mockImplementation((message) => {
        if (message.action === 'featureToggleChanged') {
          throw new Error('Test error');
        }
      });

      await domContentLoadedHandler();

      const toggleHandler = mockFeatureToggle.addEventListener.mock.calls.find(
        (call) => call[0] === 'toggle',
      )[1];

      toggleHandler({ detail: { checked: true } });

      // Error should be silenced, not logged
      expect(console.log).not.toHaveBeenCalledWith(
        'Error sending featureToggleChanged message:',
        expect.any(Error),
      );
    });
  });

  describe('loadAndDisplayData function', () => {
    test('should handle missing configuration', async () => {
      mockStorage.sync.get.mockResolvedValue({
        slackToken: null,
        appToken: null,
        channelName: null,
      });

      await domContentLoadedHandler();

      expect(mockStorage.sync.get).toHaveBeenCalledWith([
        'slackToken',
        'appToken',
        'channelName',
      ]);
    });

    test('should handle error in loadAndDisplayData', async () => {
      mockStorage.sync.get.mockRejectedValue(new Error('Test error'));

      await domContentLoadedHandler();

      expect(console.error).toHaveBeenCalledWith(
        '[PopupUI]',
        expect.any(Error),
      );
      expect(console.error).toHaveBeenCalledWith(
        'Context:',
        expect.objectContaining({
          action: 'processMessages',
          uiElements: expect.any(Object),
        }),
      );
    });
  });

  describe('showConfigNeededUI function', () => {
    test('should show config needed UI with all errors', async () => {
      mockStorage.sync.get.mockImplementation((keys, callback) => {
        if (typeof callback === 'function') {
          callback({
            slackToken: null,
            appToken: null,
            channelName: null,
          });
        }
        return Promise.resolve({
          slackToken: null,
          appToken: null,
          channelName: null,
        });
      });

      await domContentLoadedHandler();

      expect(document.createElement).toHaveBeenCalledWith('div');
    });

    test('should show config needed UI with some configuration present', async () => {
      mockStorage.sync.get.mockImplementation((keys, callback) => {
        if (typeof callback === 'function') {
          callback({
            slackToken: 'test-token',
            appToken: null,
            channelName: 'test-channel',
          });
        }
        return Promise.resolve({
          slackToken: 'test-token',
          appToken: null,
          channelName: 'test-channel',
        });
      });

      await domContentLoadedHandler();

      expect(document.createElement).toHaveBeenCalledWith('div');
    });

    test('should handle existing error details element', async () => {
      document.getElementById.mockImplementation((id) => {
        if (id === 'error-details') return mockErrorDetails;
        if (id === 'feature-toggle') return mockFeatureToggle;
        return mockStatusIcon;
      });

      mockStorage.sync.get.mockImplementation((keys, callback) => {
        if (typeof callback === 'function') {
          callback({
            slackToken: null,
            appToken: null,
            channelName: null,
          });
        }
        return Promise.resolve({
          slackToken: null,
          appToken: null,
          channelName: null,
        });
      });

      await domContentLoadedHandler();

      expect(mockErrorDetails.remove).toHaveBeenCalled();
    });

    test('should handle missing popup content element', async () => {
      document.querySelector.mockImplementation(() => null);

      mockStorage.sync.get.mockImplementation((keys, callback) => {
        if (typeof callback === 'function') {
          callback({
            slackToken: null,
            appToken: null,
            channelName: null,
          });
        }
        return Promise.resolve({
          slackToken: null,
          appToken: null,
          channelName: null,
        });
      });

      await domContentLoadedHandler();
    });
  });

  describe('setupSlackChannelLink function', () => {
    test('should setup slack channel link with valid IDs', async () => {
      mockStorage.local.get.mockResolvedValue({
        channelId: 'C12345',
        teamId: 'T12345',
      });

      await domContentLoadedHandler();

      expect(mockSlackChannelLink.href).toBe(
        'https://app.slack.com/client/T12345/C12345',
      );
    });

    test('should handle missing channel or team IDs', async () => {
      mockStorage.local.get.mockResolvedValue({
        channelId: null,
        teamId: null,
      });

      await domContentLoadedHandler();

      expect(mockSlackChannelLink.href).toBe('');
    });
  });

  describe('showMergeStatus function', () => {
    test('should show loading UI when no merge state is available', async () => {
      mockStorage.local.get.mockResolvedValue({
        lastKnownMergeState: null,
      });

      await domContentLoadedHandler();
    });

    test('should handle channel not found status', async () => {
      mockStorage.local.get.mockResolvedValue({
        lastKnownMergeState: {
          mergeStatus: 'disallowed',
          appStatus: 'channel_not_found',
        },
      });

      await domContentLoadedHandler();
    });

    test('should handle exception status', async () => {
      mockStorage.local.get.mockResolvedValue({
        lastKnownMergeState: {
          mergeStatus: 'exception',
          appStatus: 'ok',
        },
      });

      await domContentLoadedHandler();
    });

    test('should handle allowed status', async () => {
      mockStorage.local.get.mockResolvedValue({
        lastKnownMergeState: {
          mergeStatus: 'allowed',
          appStatus: 'ok',
        },
      });

      await domContentLoadedHandler();
    });

    test('should handle disallowed status', async () => {
      mockStorage.local.get.mockResolvedValue({
        lastKnownMergeState: {
          mergeStatus: 'disallowed',
          appStatus: 'ok',
        },
      });

      await domContentLoadedHandler();
    });

    test('should handle unknown status', async () => {
      mockStorage.local.get.mockResolvedValue({
        lastKnownMergeState: {
          mergeStatus: 'unknown',
          appStatus: 'ok',
        },
      });

      await domContentLoadedHandler();
    });
  });

  describe('Additional coverage tests', () => {
    test('should handle getCountdownStatus with active countdown', async () => {
      mockStorage.local.get.mockImplementation((keys, callback) => {
        if (
          keys.includes('featureEnabled') &&
          keys.includes('reactivationTime')
        ) {
          callback({
            featureEnabled: false,
            reactivationTime: Date.now() + 60000,
          });
        } else {
          callback({});
        }
      });

      mockRuntime.sendMessage.mockImplementation((message, callback) => {
        if (message.action === 'getCountdownStatus' && callback) {
          callback({
            isCountdownActive: true,
            timeLeft: 60000,
            reactivationTime: Date.now() + 60000,
          });
        }
      });

      await domContentLoadedHandler();

      // Trigger checkCountdownStatus
      const messageHandler = mockRuntime.onMessage.addListener.mock.calls[0][0];
      messageHandler({ action: 'countdownCompleted' });
    });

    test('should handle getCountdownStatus with inactive countdown', async () => {
      mockStorage.local.get.mockImplementation((keys, callback) => {
        if (
          keys.includes('featureEnabled') &&
          keys.includes('reactivationTime')
        ) {
          callback({
            featureEnabled: true,
            reactivationTime: null,
          });
        } else {
          callback({});
        }
      });

      mockRuntime.sendMessage.mockImplementation((message, callback) => {
        if (message.action === 'getCountdownStatus' && callback) {
          callback({
            isCountdownActive: false,
            timeLeft: 0,
            reactivationTime: null,
          });
        }
      });

      await domContentLoadedHandler();

      // Trigger checkCountdownStatus
      const messageHandler = mockRuntime.onMessage.addListener.mock.calls[0][0];
      messageHandler({ action: 'countdownCompleted' });
    });
  });
});
