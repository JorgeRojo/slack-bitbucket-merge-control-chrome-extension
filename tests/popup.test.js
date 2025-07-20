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

    document.querySelector = vi.fn((selector) => 
      selector === '.popup-content' ? mockPopupContent : originalQuerySelector.call(document, selector)
    );

    document.createElement = vi.fn((tagName) => 
      tagName === 'div' ? createMockElement() : originalCreateElement.call(document, tagName)
    );

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
      event === 'DOMContentLoaded' && (domContentLoadedHandler = handler);
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
      // Create a mock that returns null for feature-toggle and mockStatusIcon for others
      const mockGetElementById = vi.fn()
        .mockImplementation(id => id === 'feature-toggle' ? null : mockStatusIcon);
      
      document.getElementById = mockGetElementById;

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
      // Test ALLOWED state
      mockStorage.local.get.mockResolvedValue({
        lastKnownMergeState: {
          mergeStatus: 'allowed',
          appStatus: 'ok',
        },
      });

      await domContentLoadedHandler();

      // Test DISALLOWED state
      mockStorage.local.get.mockResolvedValue({
        lastKnownMergeState: {
          mergeStatus: 'disallowed',
          appStatus: 'ok',
        },
      });

      await domContentLoadedHandler();

      // Test EXCEPTION state
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
      // When openOptionsButton is displayed (config needed)
      mockStorage.sync.get.mockResolvedValue({
        slackToken: null,
        appToken: null,
        channelName: null,
      });

      await domContentLoadedHandler();

      // When openOptionsButton is hidden (normal state)
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

      // Mock for featureEnabled=false
      const mockGetWithFeatureDisabled = (keys, callback) => {
        Array.isArray(keys) && keys.includes('featureEnabled') && callback({ featureEnabled: false });
        !Array.isArray(keys) && callback({});
        return Promise.resolve({});
      };
      
      mockStorage.local.get.mockImplementation(mockGetWithFeatureDisabled);

      await domContentLoadedHandler();

      const messageHandler = mockRuntime.onMessage.addListener.mock.calls[0][0];
      messageHandler({ action: 'updateCountdownDisplay', timeLeft: 65000 });
    });

    test('should update countdown text correctly', async () => {
      // Mock for featureEnabled=false
      const mockGetWithFeatureDisabled = (keys, callback) => {
        Array.isArray(keys) && keys.includes('featureEnabled') && callback({ featureEnabled: false });
        !Array.isArray(keys) && callback({});
        return Promise.resolve({});
      };
      
      mockStorage.local.get.mockImplementation(mockGetWithFeatureDisabled);

      await domContentLoadedHandler();

      const messageHandler = mockRuntime.onMessage.addListener.mock.calls[0][0];

      // Test minutes and seconds
      messageHandler({ action: 'updateCountdownDisplay', timeLeft: 65000 });
      expect(mockCountdownElement.textContent).toContain('Reactivation in:');

      // Test seconds only
      messageHandler({ action: 'updateCountdownDisplay', timeLeft: 5000 });
      expect(mockCountdownElement.textContent).toContain('Reactivation in:');

      // Test multiple minutes
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

      // Mock for callback function
      const mockGetWithCallback = (keys, callback) => {
        typeof callback === 'function' && callback({ featureEnabled: true });
        return Promise.resolve({});
      };
      
      mockStorage.local.get.mockImplementation(mockGetWithCallback);

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

      // Mock for callback function
      const mockGetWithCallback = (keys, callback) => {
        typeof callback === 'function' && callback({ featureEnabled: true });
        return Promise.resolve({});
      };
      
      mockStorage.local.get.mockImplementation(mockGetWithCallback);

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

      // Mock for callback function
      const mockGetWithCallback = (keys, callback) => {
        typeof callback === 'function' && callback({ featureEnabled: true });
        return Promise.resolve({});
      };
      
      mockStorage.local.get.mockImplementation(mockGetWithCallback);

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

      // Mock for callback function with featureEnabled=false
      const mockGetWithFeatureDisabled = (keys, callback) => {
        typeof callback === 'function' && callback({ featureEnabled: false });
        return Promise.resolve({});
      };
      
      mockStorage.local.get.mockImplementation(mockGetWithFeatureDisabled);

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

      // Mock for callback function with featureEnabled=true
      const mockGetWithFeatureEnabled = (keys, callback) => {
        typeof callback === 'function' && callback({ featureEnabled: true });
        return Promise.resolve({});
      };
      
      mockStorage.local.get.mockImplementation(mockGetWithFeatureEnabled);

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
      // Mock for featureEnabled check
      const mockGetForFeatureEnabled = (keys, callback) => {
        Array.isArray(keys) && keys.includes('featureEnabled') 
          ? callback({ featureEnabled: false })
          : callback({});
      };
      
      mockStorage.local.get.mockImplementation(mockGetForFeatureEnabled);

      await domContentLoadedHandler();

      const messageHandler = mockRuntime.onMessage.addListener.mock.calls[0][0];

      messageHandler({ action: 'updateCountdownDisplay', timeLeft: 65000 });

      // Mock for featureEnabled=true
      const mockGetForFeatureEnabled = (keys, callback) => {
        Array.isArray(keys) && keys.includes('featureEnabled') 
          ? callback({ featureEnabled: true })
          : callback({});
      };
      
      mockStorage.local.get.mockImplementation(mockGetForFeatureEnabled);

      messageHandler({ action: 'updateCountdownDisplay', timeLeft: 65000 });

      // Mock for featureEnabled=false and timeLeft=0
      const mockGetForFeatureDisabled = (keys, callback) => {
        Array.isArray(keys) && keys.includes('featureEnabled') 
          ? callback({ featureEnabled: false })
          : callback({});
      };
      
      mockStorage.local.get.mockImplementation(mockGetForFeatureDisabled);

      messageHandler({ action: 'updateCountdownDisplay', timeLeft: 0 });
    });

    test('should handle missing countdown element', async () => {
      // Mock that returns null for countdown-timer
      const mockGetElementByIdNoCountdown = vi.fn()
        .mockImplementation(id => id === 'countdown-timer' ? null : mockStatusIcon);
      
      document.getElementById = mockGetElementByIdNoCountdown;

      // Mock for featureEnabled check
      const mockGetForFeatureEnabled = (keys, callback) => {
        Array.isArray(keys) && keys.includes('featureEnabled') 
          ? callback({ featureEnabled: false })
          : callback({});
      };
      
      mockStorage.local.get.mockImplementation(mockGetForFeatureEnabled);

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
      mockStorage.local.get.mockImplementation(mockGetWithCallback);

      // Mock for runtime.lastError in getCountdownStatus
      const mockSendMessageWithError = (message, callback) => {
        const isGetCountdownStatus = message.action === 'getCountdownStatus';
        const hasCallback = callback && typeof callback === 'function';
        
        if (isGetCountdownStatus && hasCallback) {
          mockRuntime.lastError = {
            message: 'The message port closed before a response was received.',
          };
          callback(null);
          delete mockRuntime.lastError;
        }
      };
      
      mockRuntime.sendMessage.mockImplementation(mockSendMessageWithError);

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

      // Mock for callback function
      const mockGetWithCallback = (keys, callback) => {
        typeof callback === 'function' && callback({ featureEnabled: true });
        return Promise.resolve({});
      };
      
      mockStorage.local.get.mockImplementation(mockGetWithCallback);

      // Mock for runtime.lastError in featureToggleChanged
      const mockSendMessageWithError = (message, callback) => {
        const isFeatureToggleChanged = message.action === 'featureToggleChanged';
        const hasCallback = callback && typeof callback === 'function';
        
        if (isFeatureToggleChanged && hasCallback) {
          mockRuntime.lastError = {
            message: 'The message port closed before a response was received.',
          };
          callback(null);
          delete mockRuntime.lastError;
        }
      };
      
      mockRuntime.sendMessage.mockImplementation(mockSendMessageWithError);

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

      // Mock for callback function
      const mockGetWithCallback = (keys, callback) => {
        typeof callback === 'function' && callback({ featureEnabled: false });
        return Promise.resolve({});
      };
      
      mockStorage.local.get.mockImplementation(mockGetWithCallback);

      // Mock that throws error for getCountdownStatus
      const mockSendMessageThrowError = (message) => {
        message.action === 'getCountdownStatus' && (() => { throw new Error('Test error'); })();
      };
      
      mockRuntime.sendMessage.mockImplementation(mockSendMessageThrowError);

    test('should handle exception in sendMessage during toggle event', async () => {
      mockStorage.sync.get.mockResolvedValue({
        slackToken: 'xoxb-token',
        appToken: 'xapp-token',
        channelName: 'general',
      });

      // Mock for callback function
      const mockGetWithCallback = (keys, callback) => {
        typeof callback === 'function' && callback({ featureEnabled: true });
        return Promise.resolve({});
      };
      
      mockStorage.local.get.mockImplementation(mockGetWithCallback);

      // Mock that throws error for featureToggleChanged
      const mockSendMessageThrowError = (message) => {
        message.action === 'featureToggleChanged' && (() => { throw new Error('Test error'); })();
      };
      
      mockRuntime.sendMessage.mockImplementation(mockSendMessageThrowError);

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
        'Error processing messages:',
        expect.any(Error),
      );
    });
  });

  describe('showConfigNeededUI function', () => {
    test('should show config needed UI with all errors', async () => {
      // Mock for callback function with all config missing
      const mockGetWithAllConfigMissing = (keys, callback) => {
        typeof callback === 'function' && callback({
          slackToken: null,
          appToken: null,
          channelName: null,
        });
        
        return Promise.resolve({
          slackToken: null,
          appToken: null,
          channelName: null,
        });
      };
      
      mockStorage.sync.get.mockImplementation(mockGetWithAllConfigMissing);

      await domContentLoadedHandler();

      expect(document.createElement).toHaveBeenCalledWith('div');
    });

    test('should show config needed UI with some configuration present', async () => {
      // Mock for callback function with some config present
      const mockGetWithSomeConfigPresent = (keys, callback) => {
        typeof callback === 'function' && callback({
          slackToken: 'test-token',
          appToken: null,
          channelName: 'test-channel',
        });
        
        return Promise.resolve({
          slackToken: 'test-token',
          appToken: null,
          channelName: 'test-channel',
        });
      };
      
      mockStorage.sync.get.mockImplementation(mockGetWithSomeConfigPresent);

      await domContentLoadedHandler();

      expect(document.createElement).toHaveBeenCalledWith('div');
    });

    test('should handle existing error details element', async () => {
      // Mock that returns specific elements for specific IDs
      const mockGetElementByIdWithErrorDetails = vi.fn()
        .mockImplementation(id => {
          switch(id) {
            case 'error-details': return mockErrorDetails;
            case 'feature-toggle': return mockFeatureToggle;
            default: return mockStatusIcon;
          }
        });
      
      document.getElementById = mockGetElementByIdWithErrorDetails;

      // Mock for callback function with all config missing
      const mockGetWithAllConfigMissing = (keys, callback) => {
        typeof callback === 'function' && callback({
          slackToken: null,
          appToken: null,
          channelName: null,
        });
        
        return Promise.resolve({
          slackToken: null,
          appToken: null,
          channelName: null,
        });
      };
      
      mockStorage.sync.get.mockImplementation(mockGetWithAllConfigMissing);

      await domContentLoadedHandler();

      expect(mockErrorDetails.remove).toHaveBeenCalled();
    });

    test('should handle missing popup content element', async () => {
      // Mock querySelector to return null
      document.querySelector = vi.fn().mockReturnValue(null);

      // Mock for callback function with all config missing
      const mockGetWithAllConfigMissing = (keys, callback) => {
        typeof callback === 'function' && callback({
          slackToken: null,
          appToken: null,
          channelName: null,
        });
        
        return Promise.resolve({
          slackToken: null,
          appToken: null,
          channelName: null,
        });
      };
      
      mockStorage.sync.get.mockImplementation(mockGetWithAllConfigMissing);

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

  // Pruebas adicionales para cubrir las líneas restantes
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
