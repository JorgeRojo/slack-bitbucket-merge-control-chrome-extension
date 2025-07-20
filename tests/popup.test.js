/**
 * @vitest-environment jsdom
 */

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
    mockCountdownElement;

  let domContentLoadedHandler;
  const originalAddEventListener = document.addEventListener;

  beforeEach(() => {
    vi.clearAllMocks();

    mockStatusIcon = createMockElement();
    mockStatusText = createMockElement();
    mockOpenOptionsButton = createMockElement();
    mockSlackChannelLink = createMockElement();
    mockMatchingMessageDiv = createMockElement();
    mockFeatureToggle = createMockElement();
    mockCountdownElement = createMockElement();

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

    mockStorage.sync.get.mockResolvedValue({
      slackToken: 'test-token',
      channelName: 'test-channel',
      disallowedPhrases: 'block,stop,do not merge',
      exceptionPhrases: 'allow,proceed,exception',
      bitbucketUrl: 'https://bitbucket.org/test',
    });

    mockStorage.local.get.mockResolvedValue({
      featureEnabled: true,
      messages: [],
      teamId: 'test-team',
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
  });

  describe('DOMContentLoaded event', () => {
    test('should register event listeners', async () => {
      expect(document.addEventListener).toHaveBeenCalledWith(
        'DOMContentLoaded',
        expect.any(Function),
      );
      expect(domContentLoadedHandler).toBeDefined();
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

      expect(mockCountdownElement.style.display).toBe('block');
      expect(mockCountdownElement.textContent).toContain('1:05');

      mockStorage.local.get.mockImplementation((keys, callback) => {
        if (keys.includes('featureEnabled')) {
          callback({ featureEnabled: true });
        } else {
          callback({});
        }
      });

      messageHandler({ action: 'updateCountdownDisplay', timeLeft: 65000 });
      expect(mockCountdownElement.style.display).toBe('none');

      mockStorage.local.get.mockImplementation((keys, callback) => {
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

      expect(true).toBe(true);
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

      expect(console.log).toHaveBeenCalledWith(
        'Error al recibir respuesta:',
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

      expect(console.log).toHaveBeenCalledWith(
        'Error al recibir respuesta de featureToggleChanged:',
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

      expect(console.log).toHaveBeenCalledWith(
        'Error al enviar mensaje:',
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

      expect(console.log).toHaveBeenCalledWith(
        'Error al enviar mensaje de featureToggleChanged:',
        expect.any(Error),
      );
    });
  });
});
