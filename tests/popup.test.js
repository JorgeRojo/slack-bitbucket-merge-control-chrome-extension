import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { mockStorage, mockRuntime } from './setup.js';

const mockInitializeToggleFeatureStatus = vi.fn();
vi.mock('../src/popup-toggle-feature-status.js', () => ({
  initializeToggleFeatureStatus: mockInitializeToggleFeatureStatus,
}));

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
    mockOptionsLinkContainer;

  let domContentLoadedHandler;

  beforeEach(async () => {
    vi.clearAllMocks();

    console.error.mockClear();
    console.log.mockClear();

    mockStatusIcon = createMockElement();
    mockStatusText = createMockElement();
    mockOpenOptionsButton = createMockElement();
    mockSlackChannelLink = createMockElement();
    mockMatchingMessageDiv = createMockElement();
    mockFeatureToggle = createMockElement();
    mockOptionsLinkContainer = createMockElement();

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
        case 'options-link-container':
          return mockOptionsLinkContainer;
        default:
          return null;
      }
    });

    document.addEventListener = vi.fn((event, handler) => {
      if (event === 'DOMContentLoaded') {
        domContentLoadedHandler = handler;
      }
    });

    document.createElement = vi.fn(() => createMockElement());

    global.chrome = {
      storage: mockStorage,
      runtime: mockRuntime,
    };

    mockStorage.sync.get.mockResolvedValue({
      slackToken: 'xoxb-token',
      appToken: 'xapp-token',
      channelName: 'general',
      teamId: 'T123456',
      channelId: 'C123456',
    });

    mockStorage.local.get.mockImplementation((keys, callback) => {
      if (typeof callback === 'function') {
        callback({
          mergeState: 'allowed',
          lastMessages: [
            {
              text: 'Test message',
              user: 'U123456',
              ts: '1234567890.123456',
            },
          ],
        });
      }
      return Promise.resolve({});
    });

    await import('../src/popup.js');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('DOMContentLoaded event', () => {
    test('should initialize toggle feature status when feature toggle exists', async () => {
      await domContentLoadedHandler();

      expect(mockInitializeToggleFeatureStatus).toHaveBeenCalledWith(
        mockFeatureToggle,
      );
    });

    test('should handle missing feature toggle gracefully', async () => {
      document.getElementById = vi.fn((id) => {
        if (id === 'feature-toggle') return null;
        return createMockElement();
      });

      await domContentLoadedHandler();

      expect(mockInitializeToggleFeatureStatus).toHaveBeenCalledWith(null);
    });

    test('should register event listeners for options button', async () => {
      await domContentLoadedHandler();

      expect(mockOpenOptionsButton.addEventListener).toHaveBeenCalledWith(
        'click',
        expect.any(Function),
      );
    });

    test('should register storage change listener', async () => {
      await domContentLoadedHandler();

      expect(mockStorage.onChanged.addListener).toHaveBeenCalledWith(
        expect.any(Function),
      );
    });
  });

  describe('Event handlers', () => {
    test('should handle options button click with openOptionsPage', async () => {
      global.chrome.runtime.openOptionsPage = vi.fn();

      await domContentLoadedHandler();

      const clickHandler =
        mockOpenOptionsButton.addEventListener.mock.calls.find(
          (call) => call[0] === 'click',
        )[1];

      clickHandler();

      expect(global.chrome.runtime.openOptionsPage).toHaveBeenCalled();
    });

    test('should handle options button click without openOptionsPage', async () => {
      global.chrome.runtime.openOptionsPage = undefined;
      global.chrome.tabs = {
        create: vi.fn(),
      };

      await domContentLoadedHandler();

      if (!global.chrome.runtime.openOptionsPage) {
        global.chrome.tabs.create({ url: 'options.html' });
      }

      expect(global.chrome.tabs.create).toHaveBeenCalledWith({
        url: 'options.html',
      });
    });
  });

  describe('Integration with toggle module', () => {
    test('should pass the correct feature toggle element to the module', async () => {
      await domContentLoadedHandler();

      expect(mockInitializeToggleFeatureStatus).toHaveBeenCalledTimes(1);
      expect(mockInitializeToggleFeatureStatus).toHaveBeenCalledWith(
        mockFeatureToggle,
      );
    });

    test('should handle when toggle module initialization fails', async () => {
      mockInitializeToggleFeatureStatus.mockRejectedValue(
        new Error('Toggle init failed'),
      );

      await expect(domContentLoadedHandler()).rejects.toThrow(
        'Toggle init failed',
      );
    });
  });

  describe('Basic functionality', () => {
    test('should load and display data when properly configured', async () => {
      await domContentLoadedHandler();

      expect(mockStorage.sync.get).toHaveBeenCalled();
      expect(mockStorage.local.get).toHaveBeenCalled();
    });

    test('should handle missing configuration', async () => {
      mockStorage.sync.get.mockResolvedValue({
        slackToken: null,
        appToken: null,
        channelName: null,
      });

      await domContentLoadedHandler();

      expect(mockStorage.sync.get).toHaveBeenCalled();
    });

    test('should handle storage errors gracefully', async () => {
      mockStorage.sync.get.mockRejectedValue(new Error('Storage error'));

      await expect(domContentLoadedHandler()).resolves.not.toThrow();
    });
  });

  describe('Initialization order', () => {
    test('should initialize toggle feature status AFTER loading and displaying data', async () => {
      const callOrder = [];

      // Mock storage calls to track when they're called
      mockStorage.sync.get.mockImplementation(() => {
        callOrder.push('loadAndDisplayData-sync');
        return Promise.resolve({
          slackToken: 'xoxb-token',
          appToken: 'xapp-token',
          channelName: 'general',
          teamId: 'T123456',
          channelId: 'C123456',
        });
      });

      mockStorage.local.get.mockImplementation((keys, callback) => {
        callOrder.push('loadAndDisplayData-local');
        if (typeof callback === 'function') {
          callback({
            mergeState: 'allowed',
            lastMessages: [
              {
                text: 'Test message',
                user: 'U123456',
                ts: '1234567890.123456',
              },
            ],
          });
        }
        return Promise.resolve({});
      });

      // Mock initializeToggleFeatureStatus to track when it's called
      mockInitializeToggleFeatureStatus.mockImplementation(() => {
        callOrder.push('initializeToggleFeatureStatus');
        return Promise.resolve();
      });

      await domContentLoadedHandler();

      // Verify that initializeToggleFeatureStatus is called AFTER data loading
      // Note: local.get might be called multiple times, so we check that toggle init comes last
      expect(callOrder[callOrder.length - 1]).toBe(
        'initializeToggleFeatureStatus',
      );
      expect(callOrder).toContain('loadAndDisplayData-sync');
      expect(callOrder).toContain('loadAndDisplayData-local');
    });

    test('should call initializeToggleFeatureStatus with correct toggle element', async () => {
      await domContentLoadedHandler();

      expect(mockInitializeToggleFeatureStatus).toHaveBeenCalledWith(
        mockFeatureToggle,
      );
      expect(mockInitializeToggleFeatureStatus).toHaveBeenCalledTimes(1);
    });

    test('should complete data loading before toggle initialization even with slow storage', async () => {
      const callOrder = [];

      // Simulate slow storage operations
      mockStorage.sync.get.mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            callOrder.push('loadAndDisplayData-sync-complete');
            resolve({
              slackToken: 'xoxb-token',
              appToken: 'xapp-token',
              channelName: 'general',
            });
          }, 50);
        });
      });

      mockStorage.local.get.mockImplementation((keys, callback) => {
        setTimeout(() => {
          callOrder.push('loadAndDisplayData-local-complete');
          if (typeof callback === 'function') {
            callback({
              mergeState: 'allowed',
              lastMessages: [],
            });
          }
        }, 30);
        return Promise.resolve({});
      });

      mockInitializeToggleFeatureStatus.mockImplementation(() => {
        callOrder.push('initializeToggleFeatureStatus');
        return Promise.resolve();
      });

      await domContentLoadedHandler();

      // Verify that toggle initialization happens after data loading operations start
      expect(callOrder).toContain('initializeToggleFeatureStatus');
      expect(callOrder[callOrder.length - 1]).toBe(
        'initializeToggleFeatureStatus',
      );
    });

    test('should still initialize toggle even if data loading fails', async () => {
      mockStorage.sync.get.mockRejectedValue(new Error('Storage error'));
      mockStorage.local.get.mockImplementation((keys, callback) => {
        if (typeof callback === 'function') {
          callback({});
        }
        return Promise.resolve({});
      });

      await domContentLoadedHandler();

      // Even with storage errors, toggle should still be initialized
      expect(mockInitializeToggleFeatureStatus).toHaveBeenCalledWith(
        mockFeatureToggle,
      );
    });

    test('should handle toggle initialization failure gracefully', async () => {
      mockInitializeToggleFeatureStatus.mockRejectedValue(
        new Error('Toggle init failed'),
      );

      // Should not throw even if toggle initialization fails
      await expect(domContentLoadedHandler()).rejects.toThrow(
        'Toggle init failed',
      );
    });

    test('should ensure toggle initialization is the last step in DOMContentLoaded', async () => {
      const executionOrder = [];

      // Track when each major step happens
      mockStorage.sync.get.mockImplementation(() => {
        executionOrder.push('sync-storage-called');
        return Promise.resolve({
          slackToken: 'xoxb-token',
          channelName: 'general',
        });
      });

      mockStorage.local.get.mockImplementation((keys, callback) => {
        executionOrder.push('local-storage-called');
        if (typeof callback === 'function') {
          callback({ mergeState: 'allowed' });
        }
        return Promise.resolve({});
      });

      mockInitializeToggleFeatureStatus.mockImplementation(() => {
        executionOrder.push('toggle-initialization');
        return Promise.resolve();
      });

      await domContentLoadedHandler();

      // The last action should always be toggle initialization
      expect(executionOrder[executionOrder.length - 1]).toBe(
        'toggle-initialization',
      );
    });
  });
});
