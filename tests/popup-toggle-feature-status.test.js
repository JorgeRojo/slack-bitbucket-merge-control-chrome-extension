import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { initializeToggleFeatureStatus } from '../src/popup-toggle-feature-status.js';

global.chrome = {
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
    },
  },
  runtime: {
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
    },
    lastError: null,
  },
};

global.document = {
  getElementById: vi.fn(),
};

global.requestAnimationFrame = vi.fn((callback) => {
  setTimeout(callback, 0);
  return 1;
});

global.setTimeout = vi.fn((callback, _delay) => {
  callback();
  return 1;
});

describe('popup-toggle-feature-status.js', () => {
  let mockToggleElement;
  let mockCountdownElement;

  beforeEach(() => {
    vi.clearAllMocks();

    mockToggleElement = {
      setAttribute: vi.fn(),
      removeAttribute: vi.fn(),
      addEventListener: vi.fn(),
    };

    mockCountdownElement = {
      style: { display: '' },
      textContent: '',
    };

    global.document.getElementById.mockImplementation((id) => {
      if (id === 'countdown-timer') return mockCountdownElement;
      return null;
    });

    global.chrome.runtime.lastError = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initializeToggleFeatureStatus', () => {
    test('should handle null toggle element', async () => {
      await expect(
        initializeToggleFeatureStatus(null),
      ).resolves.toBeUndefined();
    });

    test('should initialize toggle with enabled state', async () => {
      global.chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ featureEnabled: true });
      });

      await initializeToggleFeatureStatus(mockToggleElement);

      expect(mockToggleElement.setAttribute).toHaveBeenCalledWith(
        'checked',
        '',
      );
      expect(mockCountdownElement.style.display).toBe('none');
    });

    test('should initialize toggle with disabled state', async () => {
      global.chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ featureEnabled: false });
      });

      await initializeToggleFeatureStatus(mockToggleElement);

      expect(mockToggleElement.removeAttribute).toHaveBeenCalledWith('checked');
    });

    test('should setup toggle event listeners', async () => {
      global.chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ featureEnabled: true });
      });

      await initializeToggleFeatureStatus(mockToggleElement);

      expect(mockToggleElement.addEventListener).toHaveBeenCalledWith(
        'toggle',
        expect.any(Function),
      );
    });

    test('should setup background message listener', async () => {
      global.chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ featureEnabled: true });
      });

      await initializeToggleFeatureStatus(mockToggleElement);

      expect(global.chrome.runtime.onMessage.addListener).toHaveBeenCalledWith(
        expect.any(Function),
      );
    });
  });

  describe('Toggle event handling', () => {
    test('should handle toggle event when checked', async () => {
      global.chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ featureEnabled: true });
      });

      await initializeToggleFeatureStatus(mockToggleElement);

      const toggleHandler = mockToggleElement.addEventListener.mock.calls.find(
        (call) => call[0] === 'toggle',
      )[1];

      const mockEvent = {
        detail: { checked: true },
      };

      toggleHandler(mockEvent);

      expect(global.chrome.storage.local.set).toHaveBeenCalledWith({
        featureEnabled: true,
      });
      expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith(
        {
          action: 'featureToggleChanged',
          enabled: true,
        },
        expect.any(Function),
      );
    });

    test('should handle toggle event when unchecked', async () => {
      global.chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ featureEnabled: false });
      });

      global.chrome.runtime.sendMessage.mockImplementation(
        (message, callback) => {
          if (message.action === 'getCountdownStatus') {
            callback({ isCountdownActive: false, timeLeft: 0 });
          }
        },
      );

      await initializeToggleFeatureStatus(mockToggleElement);

      const toggleHandler = mockToggleElement.addEventListener.mock.calls.find(
        (call) => call[0] === 'toggle',
      )[1];

      const mockEvent = {
        detail: { checked: false },
      };

      toggleHandler(mockEvent);

      expect(global.chrome.storage.local.set).toHaveBeenCalledWith({
        featureEnabled: false,
      });
      // When unchecked, it calls checkCountdownStatus instead of immediately hiding
      expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith(
        { action: 'getCountdownStatus' },
        expect.any(Function),
      );
    });

    test('should handle runtime errors in toggle event', async () => {
      global.chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ featureEnabled: true });
      });

      global.chrome.runtime.sendMessage.mockImplementation(
        (message, callback) => {
          global.chrome.runtime.lastError = { message: 'Connection error' };
          callback();
          delete global.chrome.runtime.lastError;
        },
      );

      await initializeToggleFeatureStatus(mockToggleElement);

      const toggleHandler = mockToggleElement.addEventListener.mock.calls.find(
        (call) => call[0] === 'toggle',
      )[1];

      expect(() => {
        toggleHandler({ detail: { checked: true } });
      }).not.toThrow();
    });

    test('should handle exceptions in toggle event', async () => {
      global.chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ featureEnabled: true });
      });

      global.chrome.runtime.sendMessage.mockImplementation(() => {
        throw new Error('Connection failed');
      });

      await initializeToggleFeatureStatus(mockToggleElement);

      const toggleHandler = mockToggleElement.addEventListener.mock.calls.find(
        (call) => call[0] === 'toggle',
      )[1];

      expect(() => {
        toggleHandler({ detail: { checked: true } });
      }).not.toThrow();
    });
  });

  describe('Background message handling', () => {
    test('should handle updateCountdownDisplay message', async () => {
      global.chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ featureEnabled: false });
      });

      await initializeToggleFeatureStatus(mockToggleElement);

      const messageHandler =
        global.chrome.runtime.onMessage.addListener.mock.calls[0][0];

      messageHandler({
        action: 'updateCountdownDisplay',
        timeLeft: 60000,
      });

      expect(mockCountdownElement.style.display).toBe('block');
      expect(mockCountdownElement.textContent).toContain('Reactivation in:');
    });

    test('should handle countdownCompleted message', async () => {
      global.chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ featureEnabled: false });
      });

      await initializeToggleFeatureStatus(mockToggleElement);

      const messageHandler =
        global.chrome.runtime.onMessage.addListener.mock.calls[0][0];

      messageHandler({
        action: 'countdownCompleted',
      });

      expect(mockCountdownElement.style.display).toBe('none');
      expect(mockToggleElement.setAttribute).toHaveBeenCalledWith(
        'checked',
        '',
      );
    });

    test('should ignore unknown messages', async () => {
      global.chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ featureEnabled: true });
      });

      await initializeToggleFeatureStatus(mockToggleElement);

      const messageHandler =
        global.chrome.runtime.onMessage.addListener.mock.calls[0][0];

      expect(() => {
        messageHandler({
          action: 'unknownAction',
        });
      }).not.toThrow();
    });
  });

  describe('Countdown functionality', () => {
    test('should show countdown when feature is disabled', async () => {
      global.chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ featureEnabled: false });
      });

      await initializeToggleFeatureStatus(mockToggleElement);

      const messageHandler =
        global.chrome.runtime.onMessage.addListener.mock.calls[0][0];

      messageHandler({
        action: 'updateCountdownDisplay',
        timeLeft: 65000,
      });

      expect(mockCountdownElement.style.display).toBe('block');
      expect(mockCountdownElement.textContent).toBe('Reactivation in: 1:05');
    });

    test('should hide countdown when feature is enabled', async () => {
      global.chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ featureEnabled: true });
      });

      await initializeToggleFeatureStatus(mockToggleElement);

      const messageHandler =
        global.chrome.runtime.onMessage.addListener.mock.calls[0][0];

      messageHandler({
        action: 'updateCountdownDisplay',
        timeLeft: 65000,
      });

      expect(mockCountdownElement.style.display).toBe('none');
    });

    test('should handle missing countdown element', async () => {
      global.document.getElementById.mockReturnValue(null);

      global.chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ featureEnabled: false });
      });

      await expect(
        initializeToggleFeatureStatus(mockToggleElement),
      ).resolves.not.toThrow();
    });

    test('should format countdown text correctly', async () => {
      global.chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ featureEnabled: false });
      });

      await initializeToggleFeatureStatus(mockToggleElement);

      const messageHandler =
        global.chrome.runtime.onMessage.addListener.mock.calls[0][0];

      // Test different time formats
      messageHandler({ action: 'updateCountdownDisplay', timeLeft: 61000 });
      expect(mockCountdownElement.textContent).toBe('Reactivation in: 1:01');

      messageHandler({ action: 'updateCountdownDisplay', timeLeft: 0 });
      expect(mockCountdownElement.textContent).toBe('Reactivation in: 0:00');

      messageHandler({ action: 'updateCountdownDisplay', timeLeft: 125000 });
      expect(mockCountdownElement.textContent).toBe('Reactivation in: 2:05');
    });
  });

  describe('Initialization with reactivation time', () => {
    test('should show countdown if reactivation time is in future', async () => {
      const futureTime = Date.now() + 60000;
      global.chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({
          featureEnabled: false,
          reactivationTime: futureTime,
        });
      });

      await initializeToggleFeatureStatus(mockToggleElement);

      expect(mockCountdownElement.style.display).toBe('block');
      expect(mockCountdownElement.textContent).toContain('Reactivation in:');
    });

    test('should check countdown status if no reactivation time', async () => {
      global.chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ featureEnabled: false });
      });

      global.chrome.runtime.sendMessage.mockImplementation(
        (message, callback) => {
          if (message.action === 'getCountdownStatus') {
            callback({ isCountdownActive: true, timeLeft: 30000 });
          }
        },
      );

      await initializeToggleFeatureStatus(mockToggleElement);

      expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith(
        { action: 'getCountdownStatus' },
        expect.any(Function),
      );
    });

    test('should handle runtime errors when checking countdown status', async () => {
      global.chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ featureEnabled: false });
      });

      global.chrome.runtime.sendMessage.mockImplementation(
        (message, callback) => {
          global.chrome.runtime.lastError = { message: 'Connection error' };
          callback();
          delete global.chrome.runtime.lastError;
        },
      );

      await expect(
        initializeToggleFeatureStatus(mockToggleElement),
      ).resolves.not.toThrow();
    });

    test('should handle exceptions when checking countdown status', async () => {
      global.chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ featureEnabled: false });
      });

      global.chrome.runtime.sendMessage.mockImplementation(() => {
        throw new Error('Connection failed');
      });

      await expect(
        initializeToggleFeatureStatus(mockToggleElement),
      ).resolves.not.toThrow();
    });
  });

  describe('Edge cases for complete coverage', () => {
    test('should handle updateCountdownDisplay with feature explicitly set to false', async () => {
      global.chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ featureEnabled: false });
      });

      await initializeToggleFeatureStatus(mockToggleElement);

      const messageHandler =
        global.chrome.runtime.onMessage.addListener.mock.calls[0][0];

      messageHandler({
        action: 'updateCountdownDisplay',
        timeLeft: 30000,
      });

      expect(mockCountdownElement.style.display).toBe('block');
      expect(mockCountdownElement.textContent).toBe('Reactivation in: 0:30');
    });

    test('should handle updateCountdownDisplay when feature is enabled', async () => {
      global.chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ featureEnabled: true });
      });

      await initializeToggleFeatureStatus(mockToggleElement);

      const messageHandler =
        global.chrome.runtime.onMessage.addListener.mock.calls[0][0];

      messageHandler({
        action: 'updateCountdownDisplay',
        timeLeft: 30000,
      });

      expect(mockCountdownElement.style.display).toBe('none');
    });

    test('should handle updateCountdownDisplay with undefined featureEnabled (defaults to true)', async () => {
      global.chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({});
      });

      await initializeToggleFeatureStatus(mockToggleElement);

      const messageHandler =
        global.chrome.runtime.onMessage.addListener.mock.calls[0][0];

      messageHandler({
        action: 'updateCountdownDisplay',
        timeLeft: 30000,
      });

      expect(mockCountdownElement.style.display).toBe('none');
    });

    test('should handle reactivation time that has already passed', async () => {
      const pastTime = Date.now() - 60000;
      global.chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({
          featureEnabled: false,
          reactivationTime: pastTime,
        });
      });

      global.chrome.runtime.sendMessage.mockImplementation(
        (message, callback) => {
          if (message.action === 'getCountdownStatus') {
            callback({ isCountdownActive: false, timeLeft: 0 });
          }
        },
      );

      await initializeToggleFeatureStatus(mockToggleElement);

      expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith(
        { action: 'getCountdownStatus' },
        expect.any(Function),
      );
    });

    test('should handle getCountdownStatus response with no active countdown', async () => {
      global.chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ featureEnabled: false });
      });

      global.chrome.runtime.sendMessage.mockImplementation(
        (message, callback) => {
          if (message.action === 'getCountdownStatus') {
            callback({ isCountdownActive: false, timeLeft: 0 });
          }
        },
      );

      await initializeToggleFeatureStatus(mockToggleElement);

      expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith(
        { action: 'getCountdownStatus' },
        expect.any(Function),
      );
    });
  });
});
