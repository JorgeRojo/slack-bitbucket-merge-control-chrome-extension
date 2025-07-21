import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { initializeToggleFeatureStatus } from '../src/popup-toggle-feature-status.js';
import { mockStorage, mockRuntime } from './setup.js';

// Mock Logger locally for popup-toggle-feature-status tests
vi.mock('../src/utils/logger.js', () => ({
  Logger: {
    log: vi.fn(),
    error: vi.fn(),
  },
}));

import { Logger } from '../src/utils/logger.js';

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

    mockRuntime.lastError = null;
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
      mockStorage.local.get.mockImplementation((keys, callback) => {
        // Simulate async behavior more realistically
        setTimeout(() => callback({ featureEnabled: true }), 0);
      });

      await initializeToggleFeatureStatus(mockToggleElement);

      // Wait for the async storage call to complete
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockToggleElement.setAttribute).toHaveBeenCalledWith(
        'checked',
        '',
      );
      expect(mockCountdownElement.style.display).toBe('none');
    });

    test('should initialize toggle with disabled state', async () => {
      mockStorage.local.get.mockImplementation((keys, callback) => {
        setTimeout(() => callback({ featureEnabled: false }), 0);
      });

      await initializeToggleFeatureStatus(mockToggleElement);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockToggleElement.removeAttribute).toHaveBeenCalledWith('checked');
    });

    test('should setup toggle event listeners', async () => {
      mockStorage.local.get.mockImplementation((keys, callback) => {
        callback({ featureEnabled: true });
      });

      await initializeToggleFeatureStatus(mockToggleElement);

      expect(mockToggleElement.addEventListener).toHaveBeenCalledWith(
        'toggle',
        expect.any(Function),
      );
    });

    test('should setup background message listener', async () => {
      mockStorage.local.get.mockImplementation((keys, callback) => {
        callback({ featureEnabled: true });
      });

      await initializeToggleFeatureStatus(mockToggleElement);

      expect(mockRuntime.onMessage.addListener).toHaveBeenCalledWith(
        expect.any(Function),
      );
    });
  });

  describe('Toggle event handling', () => {
    test('should handle toggle event when checked', async () => {
      mockStorage.local.get.mockImplementation((keys, callback) => {
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

    test('should handle toggle event when unchecked', async () => {
      mockStorage.local.get.mockImplementation((keys, callback) => {
        callback({ featureEnabled: false });
      });

      mockRuntime.sendMessage.mockImplementation((message, callback) => {
        if (message.action === 'getCountdownStatus') {
          callback({ isCountdownActive: false, timeLeft: 0 });
        }
      });

      await initializeToggleFeatureStatus(mockToggleElement);

      const toggleHandler = mockToggleElement.addEventListener.mock.calls.find(
        (call) => call[0] === 'toggle',
      )[1];

      const mockEvent = {
        detail: { checked: false },
      };

      toggleHandler(mockEvent);

      expect(mockStorage.local.set).toHaveBeenCalledWith({
        featureEnabled: false,
      });
      // When unchecked, it calls checkCountdownStatus instead of immediately hiding
      expect(mockRuntime.sendMessage).toHaveBeenCalledWith(
        { action: 'getCountdownStatus' },
        expect.any(Function),
      );
    });

    test('should handle runtime errors in toggle event', async () => {
      Logger.error.mockClear();

      mockStorage.local.get.mockImplementation((keys, callback) => {
        callback({ featureEnabled: true });
      });

      mockRuntime.sendMessage.mockImplementation((message, callback) => {
        mockRuntime.lastError = { message: 'Connection error' };
        callback();
        delete mockRuntime.lastError;
      });

      await initializeToggleFeatureStatus(mockToggleElement);

      const toggleHandler = mockToggleElement.addEventListener.mock.calls.find(
        (call) => call[0] === 'toggle',
      )[1];

      expect(() => {
        toggleHandler({ detail: { checked: true } });
      }).not.toThrow();

      // Verificar que se llamó a Logger.error para el error de runtime
      expect(Logger.error).toHaveBeenCalledWith(
        expect.any(Error),
        'Popup',
        expect.objectContaining({
          silentMessages: [
            'Receiving end does not exist',
            'message port closed before a response',
          ],
        }),
      );
    });

    test('should handle exceptions in toggle event', async () => {
      Logger.error.mockClear();

      mockStorage.local.get.mockImplementation((keys, callback) => {
        callback({ featureEnabled: true });
      });

      mockRuntime.sendMessage.mockImplementation(() => {
        throw new Error('Connection failed');
      });

      await initializeToggleFeatureStatus(mockToggleElement);

      const toggleHandler = mockToggleElement.addEventListener.mock.calls.find(
        (call) => call[0] === 'toggle',
      )[1];

      expect(() => {
        toggleHandler({ detail: { checked: true } });
      }).not.toThrow();

      // Verificar que se llamó a Logger.error para la excepción
      expect(Logger.error).toHaveBeenCalledWith(
        expect.any(Error),
        'Popup',
        expect.objectContaining({
          silentMessages: [
            'Receiving end does not exist',
            'message port closed before a response',
          ],
        }),
      );
    });
  });

  describe('Background message handling', () => {
    test('should handle updateCountdownDisplay message', async () => {
      mockStorage.local.get.mockImplementation((keys, callback) => {
        callback({ featureEnabled: false });
      });

      await initializeToggleFeatureStatus(mockToggleElement);

      const messageHandler = mockRuntime.onMessage.addListener.mock.calls[0][0];

      messageHandler({
        action: 'updateCountdownDisplay',
        timeLeft: 60000,
      });

      expect(mockCountdownElement.style.display).toBe('block');
      expect(mockCountdownElement.textContent).toContain('Reactivation in:');
    });

    test('should handle countdownCompleted message', async () => {
      mockStorage.local.get.mockImplementation((keys, callback) => {
        callback({ featureEnabled: false });
      });

      await initializeToggleFeatureStatus(mockToggleElement);

      const messageHandler = mockRuntime.onMessage.addListener.mock.calls[0][0];

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
      mockStorage.local.get.mockImplementation((keys, callback) => {
        callback({ featureEnabled: true });
      });

      await initializeToggleFeatureStatus(mockToggleElement);

      const messageHandler = mockRuntime.onMessage.addListener.mock.calls[0][0];

      expect(() => {
        messageHandler({
          action: 'unknownAction',
        });
      }).not.toThrow();
    });
  });

  describe('Countdown functionality', () => {
    test('should show countdown when feature is disabled', async () => {
      mockStorage.local.get.mockImplementation((keys, callback) => {
        callback({ featureEnabled: false });
      });

      await initializeToggleFeatureStatus(mockToggleElement);

      const messageHandler = mockRuntime.onMessage.addListener.mock.calls[0][0];

      messageHandler({
        action: 'updateCountdownDisplay',
        timeLeft: 65000,
      });

      expect(mockCountdownElement.style.display).toBe('block');
      expect(mockCountdownElement.textContent).toBe('Reactivation in: 1:05');
    });

    test('should hide countdown when feature is enabled', async () => {
      mockStorage.local.get.mockImplementation((keys, callback) => {
        callback({ featureEnabled: true });
      });

      await initializeToggleFeatureStatus(mockToggleElement);

      const messageHandler = mockRuntime.onMessage.addListener.mock.calls[0][0];

      messageHandler({
        action: 'updateCountdownDisplay',
        timeLeft: 65000,
      });

      expect(mockCountdownElement.style.display).toBe('none');
    });

    test('should handle missing countdown element', async () => {
      global.document.getElementById.mockReturnValue(null);

      mockStorage.local.get.mockImplementation((keys, callback) => {
        callback({ featureEnabled: false });
      });

      await expect(
        initializeToggleFeatureStatus(mockToggleElement),
      ).resolves.not.toThrow();
    });

    test('should format countdown text correctly', async () => {
      mockStorage.local.get.mockImplementation((keys, callback) => {
        callback({ featureEnabled: false });
      });

      await initializeToggleFeatureStatus(mockToggleElement);

      const messageHandler = mockRuntime.onMessage.addListener.mock.calls[0][0];

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
      mockStorage.local.get.mockImplementation((keys, callback) => {
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
      mockStorage.local.get.mockImplementation((keys, callback) => {
        callback({ featureEnabled: false });
      });

      mockRuntime.sendMessage.mockImplementation((message, callback) => {
        if (message.action === 'getCountdownStatus') {
          callback({ isCountdownActive: true, timeLeft: 30000 });
        }
      });

      await initializeToggleFeatureStatus(mockToggleElement);

      expect(mockRuntime.sendMessage).toHaveBeenCalledWith(
        { action: 'getCountdownStatus' },
        expect.any(Function),
      );
    });

    test('should handle runtime errors when checking countdown status', async () => {
      Logger.error.mockClear();

      mockStorage.local.get.mockImplementation((keys, callback) => {
        callback({ featureEnabled: false });
      });

      mockRuntime.sendMessage.mockImplementation((message, callback) => {
        mockRuntime.lastError = { message: 'Connection error' };
        callback();
        delete mockRuntime.lastError;
      });

      await expect(
        initializeToggleFeatureStatus(mockToggleElement),
      ).resolves.not.toThrow();

      // Verificar que se llamó a Logger.error para el error de countdown
      expect(Logger.error).toHaveBeenCalledWith(
        expect.any(Error),
        'Popup',
        expect.objectContaining({
          silentMessages: [
            'Receiving end does not exist',
            'message port closed before a response',
          ],
        }),
      );
    });

    test('should handle exceptions when checking countdown status', async () => {
      Logger.error.mockClear();

      mockStorage.local.get.mockImplementation((keys, callback) => {
        callback({ featureEnabled: false });
      });

      mockRuntime.sendMessage.mockImplementation(() => {
        throw new Error('Connection failed');
      });

      await expect(
        initializeToggleFeatureStatus(mockToggleElement),
      ).resolves.not.toThrow();

      // Verificar que se llamó a Logger.error para la excepción de countdown
      expect(Logger.error).toHaveBeenCalledWith(
        expect.any(Error),
        'Popup',
        expect.objectContaining({
          silentMessages: [
            'Receiving end does not exist',
            'message port closed before a response',
          ],
        }),
      );
    });
  });

  describe('Edge cases for complete coverage', () => {
    test('should handle updateCountdownDisplay with feature explicitly set to false', async () => {
      mockStorage.local.get.mockImplementation((keys, callback) => {
        callback({ featureEnabled: false });
      });

      await initializeToggleFeatureStatus(mockToggleElement);

      const messageHandler = mockRuntime.onMessage.addListener.mock.calls[0][0];

      messageHandler({
        action: 'updateCountdownDisplay',
        timeLeft: 30000,
      });

      expect(mockCountdownElement.style.display).toBe('block');
      expect(mockCountdownElement.textContent).toBe('Reactivation in: 0:30');
    });

    test('should handle updateCountdownDisplay when feature is enabled', async () => {
      mockStorage.local.get.mockImplementation((keys, callback) => {
        callback({ featureEnabled: true });
      });

      await initializeToggleFeatureStatus(mockToggleElement);

      const messageHandler = mockRuntime.onMessage.addListener.mock.calls[0][0];

      messageHandler({
        action: 'updateCountdownDisplay',
        timeLeft: 30000,
      });

      expect(mockCountdownElement.style.display).toBe('none');
    });

    test('should handle updateCountdownDisplay with undefined featureEnabled (defaults to true)', async () => {
      mockStorage.local.get.mockImplementation((keys, callback) => {
        callback({});
      });

      await initializeToggleFeatureStatus(mockToggleElement);

      const messageHandler = mockRuntime.onMessage.addListener.mock.calls[0][0];

      messageHandler({
        action: 'updateCountdownDisplay',
        timeLeft: 30000,
      });

      expect(mockCountdownElement.style.display).toBe('none');
    });

    test('should handle reactivation time that has already passed', async () => {
      const pastTime = Date.now() - 60000;
      mockStorage.local.get.mockImplementation((keys, callback) => {
        callback({
          featureEnabled: false,
          reactivationTime: pastTime,
        });
      });

      mockRuntime.sendMessage.mockImplementation((message, callback) => {
        if (message.action === 'getCountdownStatus') {
          callback({ isCountdownActive: false, timeLeft: 0 });
        }
      });

      await initializeToggleFeatureStatus(mockToggleElement);

      expect(mockRuntime.sendMessage).toHaveBeenCalledWith(
        { action: 'getCountdownStatus' },
        expect.any(Function),
      );
    });

    test('should handle getCountdownStatus response with no active countdown', async () => {
      mockStorage.local.get.mockImplementation((keys, callback) => {
        callback({ featureEnabled: false });
      });

      mockRuntime.sendMessage.mockImplementation((message, callback) => {
        if (message.action === 'getCountdownStatus') {
          callback({ isCountdownActive: false, timeLeft: 0 });
        }
      });

      await initializeToggleFeatureStatus(mockToggleElement);

      expect(mockRuntime.sendMessage).toHaveBeenCalledWith(
        { action: 'getCountdownStatus' },
        expect.any(Function),
      );
    });
  });
});
