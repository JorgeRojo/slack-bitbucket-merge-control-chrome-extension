import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { mockStorage, mockRuntime } from './setup';
import { Logger } from '../src/utils/logger';
import { MERGE_STATUS, APP_STATUS } from '../src/constants';

vi.mock('../src/utils/logger');
vi.mock('../src/popup-toggle-feature-status', () => ({
  initializeToggleFeatureStatus: mockInitializeToggleFeatureStatus,
}));

const mockInitializeToggleFeatureStatus = vi.fn();

interface MockElement {
  className: string;
  textContent: string;
  style: {
    display: string;
    [key: string]: string;
  };
  href: string;
  innerHTML: string;
  id: string;
  setAttribute: jest.Mock;
  removeAttribute: jest.Mock;
  addEventListener: jest.Mock;
  appendChild: jest.Mock;
  remove: jest.Mock;
}

const createMockElement = (): MockElement => ({
  className: '',
  textContent: '',
  style: { display: '' },
  href: '',
  innerHTML: '',
  id: '',
  setAttribute: vi.fn(),
  removeAttribute: vi.fn(),
  addEventListener: vi.fn(),
  appendChild: vi.fn(),
  remove: vi.fn(),
});

interface MockDocument {
  getElementById: jest.Mock;
  addEventListener: jest.Mock;
  createElement: jest.Mock;
  querySelector: jest.Mock;
}

const createMockDocument = (): MockDocument => ({
  getElementById: vi.fn(),
  addEventListener: vi.fn(),
  createElement: vi.fn(() => createMockElement()),
  querySelector: vi.fn(() => createMockElement()),
});

console.error = vi.fn();
console.log = vi.fn();
window.open = vi.fn();

describe('popup.js', () => {
  let mockStatusIcon: MockElement,
    mockStatusText: MockElement,
    mockOpenOptionsButton: MockElement,
    mockSlackChannelLink: MockElement,
    mockMatchingMessageDiv: MockElement,
    mockFeatureToggle: MockElement,
    mockOptionsLinkContainer: MockElement,
    mockPopupContent: MockElement,
    mockErrorDetails: MockElement;

  let domContentLoadedHandler: () => Promise<void>;
  let storageChangeHandler: (changes: Record<string, any>, namespace: string) => void;

  beforeEach(async () => {
    vi.clearAllMocks();

    (console.error as jest.Mock).mockClear();
    (console.log as jest.Mock).mockClear();
    (Logger.error as jest.Mock).mockClear();

    mockStatusIcon = createMockElement();
    mockStatusText = createMockElement();
    mockOpenOptionsButton = createMockElement();
    mockSlackChannelLink = createMockElement();
    mockMatchingMessageDiv = createMockElement();
    mockFeatureToggle = createMockElement();
    mockOptionsLinkContainer = createMockElement();
    mockPopupContent = createMockElement();
    mockErrorDetails = createMockElement();

    (global as any).document = createMockDocument();

    (document.getElementById as jest.Mock) = vi.fn((id: string) => {
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
        case 'error-details':
          return mockErrorDetails;
        default:
          return null;
      }
    });

    (document.querySelector as jest.Mock) = vi.fn((selector: string) => {
      if (selector === '.popup-content') {
        return mockPopupContent;
      }
      return null;
    });

    (document.addEventListener as jest.Mock) = vi.fn((event: string, handler: any) => {
      if (event === 'DOMContentLoaded') {
        domContentLoadedHandler = handler;
      }
    });

    (document.createElement as jest.Mock) = vi.fn(() => createMockElement());

    mockStorage.sync.get.mockResolvedValue({
      slackToken: 'xoxb-token',
      appToken: 'xapp-token',
      channelName: 'general',
    });

    mockStorage.local.get.mockResolvedValue({
      channelId: 'C123456',
      teamId: 'T123456',
      lastKnownMergeState: {
        mergeStatus: MERGE_STATUS.ALLOWED,
        lastSlackMessage: { text: 'Test message', ts: '1234567890' },
        appStatus: APP_STATUS.OK,
      },
    });

    mockStorage.onChanged.addListener.mockImplementation((handler: any) => {
      storageChangeHandler = handler;
    });

    await import('../src/popup');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('DOMContentLoaded event', () => {
    test('should initialize all UI elements and setup event listeners', async () => {
      await domContentLoadedHandler();

      expect(mockInitializeToggleFeatureStatus).toHaveBeenCalledWith(mockFeatureToggle);
      expect(mockOpenOptionsButton.addEventListener).toHaveBeenCalledWith(
        'click',
        expect.any(Function)
      );
      expect(mockStorage.onChanged.addListener).toHaveBeenCalledWith(expect.any(Function));
    });

    test('should handle missing UI elements gracefully', async () => {
      (document.getElementById as jest.Mock) = vi.fn((id: string) => {
        switch (id) {
          case 'open-options':
            return mockOpenOptionsButton;
          case 'status-icon':
            return mockStatusIcon;
          case 'status-text':
            return mockStatusText;
          default:
            return null;
        }
      });

      await expect(domContentLoadedHandler()).resolves.not.toThrow();
      // In TypeScript version, initializeToggleFeatureStatus is not called when featureToggle is null
      // This is safer behavior than the JavaScript version
      expect(mockInitializeToggleFeatureStatus).not.toHaveBeenCalled();
    });
  });

  describe('Configuration handling', () => {
    test('should show config needed UI when slackToken is missing', async () => {
      mockStorage.sync.get.mockImplementation((keys: string[], callback: Function) => {
        const result = {
          slackToken: null,
          appToken: 'xapp-token',
          channelName: 'general',
        };
        if (typeof callback === 'function') {
          setTimeout(() => callback(result), 0);
        }
        return Promise.resolve(result);
      });

      await domContentLoadedHandler();

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockStatusIcon.className).toBe(MERGE_STATUS.CONFIG_NEEDED);
      expect(mockOpenOptionsButton.style.display).toBe('block');
    });

    test('should show config needed UI when appToken is missing', async () => {
      mockStorage.sync.get.mockImplementation((keys: string[], callback: Function) => {
        const result = {
          slackToken: 'xoxb-token',
          appToken: null,
          channelName: 'general',
        };
        if (typeof callback === 'function') {
          setTimeout(() => callback(result), 0);
        }
        return Promise.resolve(result);
      });

      await domContentLoadedHandler();
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockStatusIcon.className).toBe(MERGE_STATUS.CONFIG_NEEDED);
      expect(mockOpenOptionsButton.style.display).toBe('block');
    });

    test('should show config needed UI when channelName is missing', async () => {
      mockStorage.sync.get.mockImplementation((keys: string[], callback: Function) => {
        const result = {
          slackToken: 'xoxb-token',
          appToken: 'xapp-token',
          channelName: null,
        };
        if (typeof callback === 'function') {
          setTimeout(() => callback(result), 0);
        }
        return Promise.resolve(result);
      });

      await domContentLoadedHandler();
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockStatusIcon.className).toBe(MERGE_STATUS.CONFIG_NEEDED);
      expect(mockOpenOptionsButton.style.display).toBe('block');
    });

    test('should show config needed UI when all tokens are missing', async () => {
      mockStorage.sync.get.mockImplementation((keys: string[], callback: Function) => {
        const result = {
          slackToken: null,
          appToken: null,
          channelName: null,
        };
        if (typeof callback === 'function') {
          setTimeout(() => callback(result), 0);
        }
        return Promise.resolve(result);
      });

      await domContentLoadedHandler();
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockStatusIcon.className).toBe(MERGE_STATUS.CONFIG_NEEDED);
      expect(mockOpenOptionsButton.style.display).toBe('block');
    });

    test('should create error details div with specific missing configuration', async () => {
      mockStorage.sync.get.mockResolvedValue({
        slackToken: null,
        appToken: 'xapp-token',
        channelName: null,
      });

      mockStorage.sync.get.mockImplementation((keys: string[], callback: Function) => {
        if (typeof callback === 'function') {
          callback({
            slackToken: null,
            appToken: 'xapp-token',
            channelName: null,
          });
        }
        return Promise.resolve({
          slackToken: null,
          appToken: 'xapp-token',
          channelName: null,
        });
      });

      await domContentLoadedHandler();

      expect(document.createElement).toHaveBeenCalledWith('div');
      expect(mockPopupContent.appendChild).toHaveBeenCalled();
    });

    test('should remove existing error details before adding new ones', async () => {
      mockStorage.sync.get.mockResolvedValue({
        slackToken: null,
        appToken: null,
        channelName: null,
      });

      (document.getElementById as jest.Mock) = vi.fn((id: string) => {
        if (id === 'error-details') {
          return mockErrorDetails;
        }
        return createMockElement();
      });

      mockStorage.sync.get.mockImplementation((keys: string[], callback: Function) => {
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

    test('should handle edge case where no specific errors but config is incomplete', async () => {
      mockStorage.sync.get.mockImplementation((keys: string[], callback: Function) => {
        if (typeof callback === 'function') {
          setTimeout(
            () =>
              callback({
                slackToken: 'valid-token',
                appToken: 'valid-app-token',
                channelName: 'valid-channel',
              }),
            0
          );
        }
        return Promise.resolve({
          slackToken: null,
          appToken: null,
          channelName: null,
        });
      });

      await domContentLoadedHandler();
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockStatusIcon.className).toBe(MERGE_STATUS.CONFIG_NEEDED);
    });
  });

  describe('Merge status display', () => {
    test('should display ALLOWED status correctly', async () => {
      mockStorage.local.get.mockResolvedValue({
        lastKnownMergeState: {
          mergeStatus: MERGE_STATUS.ALLOWED,
          lastSlackMessage: { text: 'Merge approved', ts: '1234567890' },
          appStatus: APP_STATUS.OK,
        },
      });

      await domContentLoadedHandler();

      expect(mockStatusIcon.className).toBe(MERGE_STATUS.ALLOWED);
      expect(mockMatchingMessageDiv.textContent).toBe('Merge approved');
      expect(mockMatchingMessageDiv.style.display).toBe('block');
    });

    test('should display DISALLOWED status correctly', async () => {
      mockStorage.local.get.mockResolvedValue({
        lastKnownMergeState: {
          mergeStatus: MERGE_STATUS.DISALLOWED,
          lastSlackMessage: { text: 'Do not merge', ts: '1234567890' },
          appStatus: APP_STATUS.OK,
        },
      });

      await domContentLoadedHandler();

      expect(mockStatusIcon.className).toBe(MERGE_STATUS.DISALLOWED);
      expect(mockMatchingMessageDiv.textContent).toBe('Do not merge');
      expect(mockMatchingMessageDiv.style.display).toBe('block');
    });

    test('should display EXCEPTION status correctly', async () => {
      mockStorage.local.get.mockResolvedValue({
        lastKnownMergeState: {
          mergeStatus: MERGE_STATUS.EXCEPTION,
          lastSlackMessage: { text: 'Merge with caution', ts: '1234567890' },
          appStatus: APP_STATUS.OK,
        },
      });

      await domContentLoadedHandler();

      expect(mockStatusIcon.className).toBe(MERGE_STATUS.EXCEPTION);
      expect(mockSlackChannelLink.style.display).toBe('block');
      expect(mockMatchingMessageDiv.textContent).toBe('Merge with caution');
    });

    test('should handle unknown merge status', async () => {
      mockStorage.local.get.mockResolvedValue({
        lastKnownMergeState: {
          mergeStatus: 'unknown-status',
          lastSlackMessage: { text: 'Unknown message', ts: '1234567890' },
          appStatus: APP_STATUS.OK,
        },
      });

      await domContentLoadedHandler();

      expect(mockStatusIcon.className).toBe(MERGE_STATUS.UNKNOWN);
    });

    test('should show loading UI when no merge state exists', async () => {
      mockStorage.local.get.mockResolvedValue({
        lastKnownMergeState: null,
      });

      await domContentLoadedHandler();

      expect(mockStatusIcon.className).toBe(MERGE_STATUS.LOADING);
    });

    test('should show loading UI when merge state has no status', async () => {
      mockStorage.local.get.mockResolvedValue({
        lastKnownMergeState: {
          mergeStatus: null,
        },
      });

      await domContentLoadedHandler();

      expect(mockStatusIcon.className).toBe(MERGE_STATUS.LOADING);
    });

    test('should handle channel not found error', async () => {
      mockStorage.local.get.mockResolvedValue({
        lastKnownMergeState: {
          mergeStatus: MERGE_STATUS.ALLOWED,
          appStatus: APP_STATUS.CHANNEL_NOT_FOUND,
        },
      });

      await domContentLoadedHandler();

      expect(mockStatusIcon.className).toBe(MERGE_STATUS.DISALLOWED);
    });
  });

  describe('Slack channel link setup', () => {
    test('should setup slack channel link with valid channelId and teamId', async () => {
      mockStorage.local.get.mockResolvedValue({
        channelId: 'C123456',
        teamId: 'T123456',
        lastKnownMergeState: {
          mergeStatus: MERGE_STATUS.ALLOWED,
          appStatus: APP_STATUS.OK,
        },
      });

      await domContentLoadedHandler();

      expect(mockSlackChannelLink.href).toContain('T123456/C123456');
    });

    test('should not setup slack channel link when channelId is missing', async () => {
      mockStorage.local.get.mockResolvedValue({
        channelId: null,
        teamId: 'T123456',
        lastKnownMergeState: {
          mergeStatus: MERGE_STATUS.ALLOWED,
          appStatus: APP_STATUS.OK,
        },
      });

      await domContentLoadedHandler();

      expect(mockSlackChannelLink.href).toBe('');
    });

    test('should not setup slack channel link when teamId is missing', async () => {
      mockStorage.local.get.mockResolvedValue({
        channelId: 'C123456',
        teamId: null,
        lastKnownMergeState: {
          mergeStatus: MERGE_STATUS.ALLOWED,
          appStatus: APP_STATUS.OK,
        },
      });

      await domContentLoadedHandler();

      expect(mockSlackChannelLink.href).toBe('');
    });
  });

  describe('Event handlers', () => {
    test('should handle options button click with openOptionsPage', async () => {
      mockRuntime.openOptionsPage = vi.fn();

      await domContentLoadedHandler();

      const clickHandler = mockOpenOptionsButton.addEventListener.mock.calls.find(
        call => call[0] === 'click'
      )[1];

      clickHandler();

      expect(mockRuntime.openOptionsPage).toHaveBeenCalled();
    });

    test('should handle options button click without openOptionsPage', async () => {
      mockRuntime.openOptionsPage = undefined as any;
      mockRuntime.getURL = vi.fn().mockReturnValue('options.html');

      await domContentLoadedHandler();

      const clickHandler = mockOpenOptionsButton.addEventListener.mock.calls.find(
        call => call[0] === 'click'
      )[1];

      clickHandler();

      expect(window.open).toHaveBeenCalledWith('options.html');
    });

    test('should handle storage changes for lastKnownMergeState', async () => {
      await domContentLoadedHandler();

      const changes = {
        lastKnownMergeState: {
          newValue: { mergeStatus: MERGE_STATUS.DISALLOWED },
        },
      };

      storageChangeHandler(changes, 'local');

      expect(mockStorage.sync.get).toHaveBeenCalled();
    });

    test('should handle storage changes for lastMatchingMessage', async () => {
      await domContentLoadedHandler();

      const changes = {
        lastMatchingMessage: {
          newValue: { text: 'New message' },
        },
      };

      storageChangeHandler(changes, 'local');

      expect(mockStorage.sync.get).toHaveBeenCalled();
    });

    test('should ignore storage changes for non-local namespace', async () => {
      await domContentLoadedHandler();

      mockStorage.sync.get.mockClear();

      const changes = {
        lastKnownMergeState: {
          newValue: { mergeStatus: MERGE_STATUS.DISALLOWED },
        },
      };

      storageChangeHandler(changes, 'sync');

      expect(mockStorage.sync.get).not.toHaveBeenCalled();
    });

    test('should ignore storage changes for irrelevant keys', async () => {
      await domContentLoadedHandler();

      mockStorage.sync.get.mockClear();

      const changes = {
        someOtherKey: {
          newValue: 'some value',
        },
      };

      storageChangeHandler(changes, 'local');

      expect(mockStorage.sync.get).not.toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    test('should handle storage sync error gracefully', async () => {
      (Logger.error as jest.Mock).mockClear();
      mockStorage.sync.get.mockRejectedValue(new Error('Storage sync error'));

      await domContentLoadedHandler();

      expect(Logger.error).toHaveBeenCalledWith(
        expect.any(Error),
        'PopupUI',
        expect.objectContaining({
          action: 'processMessages',
        })
      );
      expect(mockStatusIcon.className).toBe(MERGE_STATUS.DISALLOWED);
    });

    test('should handle storage local error gracefully', async () => {
      (Logger.error as jest.Mock).mockClear();
      mockStorage.local.get.mockRejectedValue(new Error('Storage local error'));

      await domContentLoadedHandler();

      expect(Logger.error).toHaveBeenCalledWith(
        expect.any(Error),
        'PopupUI',
        expect.objectContaining({
          action: 'processMessages',
        })
      );
    });

    test('should show error UI when processing fails', async () => {
      mockStorage.sync.get.mockRejectedValue(new Error('Processing error'));

      await domContentLoadedHandler();

      expect(mockStatusIcon.className).toBe(MERGE_STATUS.DISALLOWED);
    });
  });

  describe('UI state management', () => {
    test('should hide all elements initially and show relevant ones based on state', async () => {
      await domContentLoadedHandler();

      expect(mockOpenOptionsButton.style.display).toBe('none');
      expect(mockSlackChannelLink.style.display).toBe('none');
    });

    test('should show options link container when options button is hidden', async () => {
      mockStorage.local.get.mockResolvedValue({
        lastKnownMergeState: {
          mergeStatus: MERGE_STATUS.ALLOWED,
          appStatus: APP_STATUS.OK,
        },
      });

      await domContentLoadedHandler();

      expect(mockOptionsLinkContainer.style.display).toBe('block');
    });

    test('should hide options link container when options button is shown', async () => {
      mockStorage.sync.get.mockImplementation((keys: string[], callback: Function) => {
        const result = {
          slackToken: null,
          appToken: null,
          channelName: null,
        };
        if (typeof callback === 'function') {
          setTimeout(() => callback(result), 0);
        }
        return Promise.resolve(result);
      });

      await domContentLoadedHandler();
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockOptionsLinkContainer.style.display).toBe('none');
    });

    test('should handle null matching message gracefully', async () => {
      mockStorage.local.get.mockResolvedValue({
        lastKnownMergeState: {
          mergeStatus: MERGE_STATUS.ALLOWED,
          lastSlackMessage: null,
          appStatus: APP_STATUS.OK,
        },
      });

      await domContentLoadedHandler();

      expect(mockMatchingMessageDiv.style.display).toBe('none');
    });

    test('should handle missing UI elements in updateUI', async () => {
      (document.getElementById as jest.Mock) = vi.fn((id: string) => {
        switch (id) {
          case 'open-options':
            return mockOpenOptionsButton;
          case 'status-icon':
            return mockStatusIcon;
          case 'status-text':
            return mockStatusText;
          default:
            return null;
        }
      });

      await expect(domContentLoadedHandler()).resolves.not.toThrow();
    });
  });

  describe('Integration tests', () => {
    test('should complete full initialization flow successfully', async () => {
      await domContentLoadedHandler();

      expect(mockStorage.sync.get).toHaveBeenCalled();
      expect(mockStorage.local.get).toHaveBeenCalled();
      expect(mockInitializeToggleFeatureStatus).toHaveBeenCalled();
      expect(mockStorage.onChanged.addListener).toHaveBeenCalled();
    });

    test('should handle toggle initialization failure gracefully', async () => {
      mockInitializeToggleFeatureStatus.mockRejectedValue(new Error('Toggle init failed'));

      await expect(domContentLoadedHandler()).rejects.toThrow('Toggle init failed');
    });

    test('should maintain proper execution order', async () => {
      const callOrder: string[] = [];

      mockStorage.sync.get.mockImplementation(() => {
        callOrder.push('sync-get');
        return Promise.resolve({
          slackToken: 'token',
          appToken: 'app-token',
          channelName: 'channel',
        });
      });

      mockStorage.local.get.mockImplementation(() => {
        callOrder.push('local-get');
        return Promise.resolve({
          lastKnownMergeState: { mergeStatus: MERGE_STATUS.ALLOWED },
        });
      });

      mockInitializeToggleFeatureStatus.mockImplementation(() => {
        callOrder.push('toggle-init');
        return Promise.resolve();
      });

      await domContentLoadedHandler();

      expect(callOrder).toContain('sync-get');
      expect(callOrder).toContain('local-get');
      expect(callOrder[callOrder.length - 1]).toBe('toggle-init');
    });
  });

  describe('Edge cases', () => {
    test('should handle empty storage responses', async () => {
      mockStorage.sync.get.mockImplementation((keys: string[], callback: Function) => {
        const result = {};
        if (typeof callback === 'function') {
          setTimeout(() => callback(result), 0);
        }
        return Promise.resolve(result);
      });
      mockStorage.local.get.mockResolvedValue({});

      await domContentLoadedHandler();
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockStatusIcon.className).toBe(MERGE_STATUS.CONFIG_NEEDED);
    });

    test('should handle malformed lastKnownMergeState', async () => {
      mockStorage.local.get.mockResolvedValue({
        lastKnownMergeState: 'invalid-data',
      });

      await domContentLoadedHandler();

      expect(mockStatusIcon.className).toBe(MERGE_STATUS.LOADING);
    });

    test('should handle missing popup content element', async () => {
      (document.querySelector as jest.Mock) = vi.fn(() => null);

      mockStorage.sync.get.mockImplementation((keys: string[], callback: Function) => {
        const result = {
          slackToken: null,
          appToken: null,
          channelName: null,
        };
        if (typeof callback === 'function') {
          setTimeout(() => callback(result), 0);
        }
        return Promise.resolve(result);
      });

      await expect(domContentLoadedHandler()).resolves.not.toThrow();
    });

    test('should handle config with empty strings', async () => {
      mockStorage.sync.get.mockImplementation((keys: string[], callback: Function) => {
        const result = {
          slackToken: '',
          appToken: '',
          channelName: '',
        };
        if (typeof callback === 'function') {
          setTimeout(() => callback(result), 0);
        }
        return Promise.resolve(result);
      });

      await domContentLoadedHandler();
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockStatusIcon.className).toBe(MERGE_STATUS.CONFIG_NEEDED);
    });

    test('should handle partial configuration correctly', async () => {
      mockStorage.sync.get.mockImplementation((keys: string[], callback: Function) => {
        const result = {
          slackToken: 'token',
          appToken: '',
          channelName: 'channel',
        };
        if (typeof callback === 'function') {
          setTimeout(() => callback(result), 0);
        }
        return Promise.resolve(result);
      });

      await domContentLoadedHandler();
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockStatusIcon.className).toBe(MERGE_STATUS.CONFIG_NEEDED);
    });
  });
});
