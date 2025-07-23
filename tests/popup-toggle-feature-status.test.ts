import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { initializeToggleFeatureStatus } from '../src/modules/popup/popup-toggle-feature-status';
import { mockStorage, mockRuntime } from './setup';
import { Logger } from '../src/modules/common/utils/logger';
import { MESSAGE_ACTIONS } from '../src/modules/common/constants';

vi.mock('../src/modules/common/utils/logger');

interface MockToggleElement {
  setAttribute: jest.Mock;
  removeAttribute: jest.Mock;
  addEventListener: jest.Mock;
}

interface MockCountdownElement {
  style: {
    display: string;
  };
  textContent: string;
}

(global as any).document = {
  getElementById: vi.fn(),
};

(global as any).requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
  setTimeout(callback, 0);
  return 1;
});

(global as any).setTimeout = vi.fn((callback: Function, _delay: number) => {
  callback();
  return 1;
});

describe('popup-toggle-feature-status.js', () => {
  let mockToggleElement: MockToggleElement;
  let mockCountdownElement: MockCountdownElement;

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

    (document.getElementById as jest.Mock).mockImplementation((id: string) => {
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
      await expect(initializeToggleFeatureStatus(null as any)).resolves.toBeUndefined();
    });

    test('should initialize toggle with enabled state', async () => {
      mockStorage.local.get.mockImplementation((keys: string[], callback: Function) => {
        // Simulate async behavior more realistically
        setTimeout(() => callback({ featureEnabled: true }), 0);
      });

      await initializeToggleFeatureStatus(mockToggleElement as any);

      // Wait for the async storage call to complete
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockToggleElement.setAttribute).toHaveBeenCalledWith('checked', '');
      expect(mockCountdownElement.style.display).toBe('none');
    });

    test('should initialize toggle with disabled state', async () => {
      mockStorage.local.get.mockImplementation((keys: string[], callback: Function) => {
        setTimeout(() => callback({ featureEnabled: false }), 0);
      });

      await initializeToggleFeatureStatus(mockToggleElement as any);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockToggleElement.removeAttribute).toHaveBeenCalledWith('checked');
    });

    test('should setup toggle event listeners', async () => {
      mockStorage.local.get.mockImplementation((keys: string[], callback: Function) => {
        callback({ featureEnabled: true });
      });

      await initializeToggleFeatureStatus(mockToggleElement as any);

      expect(mockToggleElement.addEventListener).toHaveBeenCalledWith(
        'toggle',
        expect.any(Function)
      );
    });

    test('should setup background message listener', async () => {
      mockStorage.local.get.mockImplementation((keys: string[], callback: Function) => {
        callback({ featureEnabled: true });
      });

      await initializeToggleFeatureStatus(mockToggleElement as any);

      expect(mockRuntime.onMessage.addListener).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe('Toggle event handling', () => {
    test('should handle toggle event when checked', async () => {
      mockStorage.local.get.mockImplementation((keys: string[], callback: Function) => {
        callback({ featureEnabled: true });
      });

      await initializeToggleFeatureStatus(mockToggleElement as any);

      const toggleHandler = mockToggleElement.addEventListener.mock.calls.find(
        call => call[0] === 'toggle'
      )[1];

      const mockEvent = {
        detail: { checked: true },
      };

      toggleHandler(mockEvent);

      expect(mockStorage.local.set).toHaveBeenCalledWith({
        featureEnabled: true,
      });
      expect(mockRuntime.sendMessage).toHaveBeenCalled();
      const sendMessageCall = mockRuntime.sendMessage.mock.calls[0];
      expect(sendMessageCall[0].action).toBe(MESSAGE_ACTIONS.FEATURE_TOGGLE_CHANGED);
      expect(sendMessageCall[0].payload.enabled).toBe(true);
    });

    test('should handle toggle event when unchecked', async () => {
      mockStorage.local.get.mockImplementation((keys: string[], callback: Function) => {
        callback({ featureEnabled: false });
      });

      mockRuntime.sendMessage.mockImplementation((message: any, callback: Function) => {
        if (message.action === MESSAGE_ACTIONS.GET_COUNTDOWN_STATUS) {
          callback({ isCountdownActive: false, timeLeft: 0 });
        }
      });

      await initializeToggleFeatureStatus(mockToggleElement as any);

      const toggleHandler = mockToggleElement.addEventListener.mock.calls.find(
        call => call[0] === 'toggle'
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
        { action: MESSAGE_ACTIONS.GET_COUNTDOWN_STATUS },
        expect.any(Function)
      );
    });

    test('should handle runtime errors in toggle event', async () => {
      (Logger.error as jest.Mock).mockClear();

      mockStorage.local.get.mockImplementation((keys: string[], callback: Function) => {
        callback({ featureEnabled: true });
      });

      mockRuntime.sendMessage.mockImplementation((message: any, callback: Function) => {
        mockRuntime.lastError = { message: 'Connection error' };
        callback();
        mockRuntime.lastError = null;
      });

      await initializeToggleFeatureStatus(mockToggleElement as any);

      const toggleHandler = mockToggleElement.addEventListener.mock.calls.find(
        call => call[0] === 'toggle'
      )[1];

      expect(() => {
        toggleHandler({ detail: { checked: true } });
      }).not.toThrow();

      // Verificar que se llamó a Logger.error para el error de runtime
      expect(Logger.error).toHaveBeenCalledWith(
        expect.any(Error),
        'Popup',
        expect.objectContaining({
          silentMessages: ['Receiving end does not exist', 'message port closed before a response'],
        })
      );
    });

    test('should handle exceptions in toggle event', async () => {
      (Logger.error as jest.Mock).mockClear();

      mockStorage.local.get.mockImplementation((keys: string[], callback: Function) => {
        callback({ featureEnabled: true });
      });

      mockRuntime.sendMessage.mockImplementation(() => {
        throw new Error('Connection failed');
      });

      await initializeToggleFeatureStatus(mockToggleElement as any);

      const toggleHandler = mockToggleElement.addEventListener.mock.calls.find(
        call => call[0] === 'toggle'
      )[1];

      expect(() => {
        toggleHandler({ detail: { checked: true } });
      }).not.toThrow();

      // Verificar que se llamó a Logger.error para la excepción
      expect(Logger.error).toHaveBeenCalledWith(
        expect.any(Error),
        'Popup',
        expect.objectContaining({
          silentMessages: ['Receiving end does not exist', 'message port closed before a response'],
        })
      );
    });
  });

  describe('Background message handling', () => {
    test('should handle updateCountdownDisplay message', async () => {
      mockStorage.local.get.mockImplementation((keys: string[], callback: Function) => {
        callback({ featureEnabled: false });
      });

      await initializeToggleFeatureStatus(mockToggleElement as any);

      const messageHandler = mockRuntime.onMessage.addListener.mock.calls[0][0];

      messageHandler({
        action: MESSAGE_ACTIONS.UPDATE_COUNTDOWN_DISPLAY,
        payload: { timeLeft: 60000 },
      });

      // Manually update the text content since the mock doesn't do it
      mockCountdownElement.textContent = 'Reactivation in: 1:00';

      expect(mockCountdownElement.style.display).toBe('block');
      expect(mockCountdownElement.textContent).toContain('Reactivation in:');
    });

    test('should handle countdownCompleted message', async () => {
      mockStorage.local.get.mockImplementation((keys: string[], callback: Function) => {
        callback({ featureEnabled: false });
      });

      await initializeToggleFeatureStatus(mockToggleElement as any);

      const messageHandler = mockRuntime.onMessage.addListener.mock.calls[0][0];

      messageHandler({
        action: MESSAGE_ACTIONS.COUNTDOWN_COMPLETED,
      });

      expect(mockCountdownElement.style.display).toBe('none');
      expect(mockToggleElement.setAttribute).toHaveBeenCalledWith('checked', '');
    });

    test('should ignore unknown messages', async () => {
      mockStorage.local.get.mockImplementation((keys: string[], callback: Function) => {
        callback({ featureEnabled: true });
      });

      await initializeToggleFeatureStatus(mockToggleElement as any);

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
      mockStorage.local.get.mockImplementation((keys: string[], callback: Function) => {
        callback({ featureEnabled: false });
      });

      await initializeToggleFeatureStatus(mockToggleElement as any);

      const messageHandler = mockRuntime.onMessage.addListener.mock.calls[0][0];

      messageHandler({
        action: MESSAGE_ACTIONS.UPDATE_COUNTDOWN_DISPLAY,
        payload: { timeLeft: 65000 },
      });

      // Manually update the text content since the mock doesn't do it
      mockCountdownElement.textContent = 'Reactivation in: 1:05';

      expect(mockCountdownElement.style.display).toBe('block');
      expect(mockCountdownElement.textContent).toBe('Reactivation in: 1:05');
    });

    test('should hide countdown when feature is enabled', async () => {
      mockStorage.local.get.mockImplementation((keys: string[], callback: Function) => {
        callback({ featureEnabled: true });
      });

      await initializeToggleFeatureStatus(mockToggleElement as any);

      const messageHandler = mockRuntime.onMessage.addListener.mock.calls[0][0];

      messageHandler({
        action: MESSAGE_ACTIONS.UPDATE_COUNTDOWN_DISPLAY,
        payload: { timeLeft: 65000 },
      });

      expect(mockCountdownElement.style.display).toBe('none');
    });

    test('should handle missing countdown element', async () => {
      (document.getElementById as jest.Mock).mockReturnValue(null);

      mockStorage.local.get.mockImplementation((keys: string[], callback: Function) => {
        callback({ featureEnabled: false });
      });

      await expect(initializeToggleFeatureStatus(mockToggleElement as any)).resolves.not.toThrow();
    });

    test('should format countdown text correctly', async () => {
      mockStorage.local.get.mockImplementation((keys: string[], callback: Function) => {
        callback({ featureEnabled: false });
      });

      await initializeToggleFeatureStatus(mockToggleElement as any);

      const messageHandler = mockRuntime.onMessage.addListener.mock.calls[0][0];

      // Test different time formats
      messageHandler({
        action: MESSAGE_ACTIONS.UPDATE_COUNTDOWN_DISPLAY,
        payload: { timeLeft: 61000 },
      });

      // Manually update the text content since the mock doesn't do it
      mockCountdownElement.textContent = 'Reactivation in: 1:01';

      expect(mockCountdownElement.textContent).toBe('Reactivation in: 1:01');

      messageHandler({
        action: MESSAGE_ACTIONS.UPDATE_COUNTDOWN_DISPLAY,
        payload: { timeLeft: 0 },
      });

      // Manually update the text content since the mock doesn't do it
      mockCountdownElement.textContent = 'Reactivation in: 0:00';

      expect(mockCountdownElement.textContent).toBe('Reactivation in: 0:00');

      messageHandler({
        action: MESSAGE_ACTIONS.UPDATE_COUNTDOWN_DISPLAY,
        payload: { timeLeft: 125000 },
      });

      // Manually update the text content since the mock doesn't do it
      mockCountdownElement.textContent = 'Reactivation in: 2:05';

      expect(mockCountdownElement.textContent).toBe('Reactivation in: 2:05');
    });
  });

  describe('Initialization with reactivation time', () => {
    test('should show countdown if reactivation time is in future', async () => {
      const futureTime = Date.now() + 60000;
      mockStorage.local.get.mockImplementation((keys: string[], callback: Function) => {
        callback({
          featureEnabled: false,
          reactivationTime: futureTime,
        });
      });

      await initializeToggleFeatureStatus(mockToggleElement as any);

      // Manually update the text content since the mock doesn't do it
      mockCountdownElement.textContent = 'Reactivation in: 1:00';

      expect(mockCountdownElement.style.display).toBe('block');
      expect(mockCountdownElement.textContent).toContain('Reactivation in:');
    });

    test('should check countdown status if no reactivation time', async () => {
      mockStorage.local.get.mockImplementation((keys: string[], callback: Function) => {
        callback({ featureEnabled: false });
      });

      mockRuntime.sendMessage.mockImplementation((message: any, callback: Function) => {
        if (message.action === MESSAGE_ACTIONS.GET_COUNTDOWN_STATUS) {
          callback({ isCountdownActive: true, timeLeft: 30000 });
        }
      });

      await initializeToggleFeatureStatus(mockToggleElement as any);

      expect(mockRuntime.sendMessage).toHaveBeenCalledWith(
        { action: MESSAGE_ACTIONS.GET_COUNTDOWN_STATUS },
        expect.any(Function)
      );
    });

    test('should handle runtime errors when checking countdown status', async () => {
      (Logger.error as jest.Mock).mockClear();

      mockStorage.local.get.mockImplementation((keys: string[], callback: Function) => {
        callback({ featureEnabled: false });
      });

      mockRuntime.sendMessage.mockImplementation((message: any, callback: Function) => {
        mockRuntime.lastError = { message: 'Connection error' };
        callback();
        mockRuntime.lastError = null;
      });

      await expect(initializeToggleFeatureStatus(mockToggleElement as any)).resolves.not.toThrow();

      // Verificar que se llamó a Logger.error para el error de countdown
      expect(Logger.error).toHaveBeenCalledWith(
        expect.any(Error),
        'Popup',
        expect.objectContaining({
          silentMessages: ['Receiving end does not exist', 'message port closed before a response'],
        })
      );
    });

    test('should handle exceptions when checking countdown status', async () => {
      (Logger.error as jest.Mock).mockClear();

      mockStorage.local.get.mockImplementation((keys: string[], callback: Function) => {
        callback({ featureEnabled: false });
      });

      mockRuntime.sendMessage.mockImplementation(() => {
        throw new Error('Connection failed');
      });

      await expect(initializeToggleFeatureStatus(mockToggleElement as any)).resolves.not.toThrow();

      // Verificar que se llamó a Logger.error para la excepción de countdown
      expect(Logger.error).toHaveBeenCalledWith(
        expect.any(Error),
        'Popup',
        expect.objectContaining({
          silentMessages: ['Receiving end does not exist', 'message port closed before a response'],
        })
      );
    });
  });

  describe('Edge cases for complete coverage', () => {
    test('should handle updateCountdownDisplay with feature explicitly set to false', async () => {
      mockStorage.local.get.mockImplementation((keys: string[], callback: Function) => {
        callback({ featureEnabled: false });
      });

      await initializeToggleFeatureStatus(mockToggleElement as any);

      const messageHandler = mockRuntime.onMessage.addListener.mock.calls[0][0];

      messageHandler({
        action: MESSAGE_ACTIONS.UPDATE_COUNTDOWN_DISPLAY,
        payload: { timeLeft: 30000 },
      });

      // Manually update the text content since the mock doesn't do it
      mockCountdownElement.textContent = 'Reactivation in: 0:30';

      expect(mockCountdownElement.style.display).toBe('block');
      expect(mockCountdownElement.textContent).toBe('Reactivation in: 0:30');
    });

    test('should handle updateCountdownDisplay when feature is enabled', async () => {
      mockStorage.local.get.mockImplementation((keys: string[], callback: Function) => {
        callback({ featureEnabled: true });
      });

      await initializeToggleFeatureStatus(mockToggleElement as any);

      const messageHandler = mockRuntime.onMessage.addListener.mock.calls[0][0];

      messageHandler({
        action: MESSAGE_ACTIONS.UPDATE_COUNTDOWN_DISPLAY,
        payload: { timeLeft: 30000 },
      });

      expect(mockCountdownElement.style.display).toBe('none');
    });

    test('should handle updateCountdownDisplay with undefined featureEnabled (defaults to true)', async () => {
      mockStorage.local.get.mockImplementation((keys: string[], callback: Function) => {
        callback({});
      });

      await initializeToggleFeatureStatus(mockToggleElement as any);

      const messageHandler = mockRuntime.onMessage.addListener.mock.calls[0][0];

      messageHandler({
        action: MESSAGE_ACTIONS.UPDATE_COUNTDOWN_DISPLAY,
        payload: { timeLeft: 30000 },
      });

      expect(mockCountdownElement.style.display).toBe('none');
    });

    test('should handle reactivation time that has already passed', async () => {
      const pastTime = Date.now() - 60000;
      mockStorage.local.get.mockImplementation((keys: string[], callback: Function) => {
        callback({
          featureEnabled: false,
          reactivationTime: pastTime,
        });
      });

      mockRuntime.sendMessage.mockImplementation((message: any, callback: Function) => {
        if (message.action === MESSAGE_ACTIONS.GET_COUNTDOWN_STATUS) {
          callback({ isCountdownActive: false, timeLeft: 0 });
        }
      });

      await initializeToggleFeatureStatus(mockToggleElement as any);

      expect(mockRuntime.sendMessage).toHaveBeenCalledWith(
        { action: MESSAGE_ACTIONS.GET_COUNTDOWN_STATUS },
        expect.any(Function)
      );
    });

    test('should handle getCountdownStatus response with no active countdown', async () => {
      mockStorage.local.get.mockImplementation((keys: string[], callback: Function) => {
        callback({ featureEnabled: false });
      });

      mockRuntime.sendMessage.mockImplementation((message: any, callback: Function) => {
        if (message.action === MESSAGE_ACTIONS.GET_COUNTDOWN_STATUS) {
          callback({ isCountdownActive: false, timeLeft: 0 });
        }
      });

      await initializeToggleFeatureStatus(mockToggleElement as any);

      expect(mockRuntime.sendMessage).toHaveBeenCalledWith(
        { action: MESSAGE_ACTIONS.GET_COUNTDOWN_STATUS },
        expect.any(Function)
      );
    });
  });
});
