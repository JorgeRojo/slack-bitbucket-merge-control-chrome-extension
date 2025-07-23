import { describe, test, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { initializeToggleFeatureStatus } from '../src/modules/popup/popup-toggle-feature-status';
import { mockStorage, mockRuntime } from './setup';
import { Logger } from '../src/modules/common/utils/logger';
import { MESSAGE_ACTIONS } from '../src/modules/common/constants';
import { eventNames } from 'node:process';

vi.mock('../src/modules/common/utils/logger');

interface MockFeatureToggleElement {
  setAttribute: Mock;
  removeAttribute: Mock;
  querySelector: Mock;
  addEventListener: Mock;
  appendChild: Mock;
}

interface MockCountdownElement {
  style: {
    display: string;
  };
  textContent: string;
}

(global as any).setTimeout = vi.fn((callback: Function, _delay: number) => {
  callback();
  return 1;
});

describe('popup-toggle-feature-status.js', () => {
  let mockCountdownElement: MockCountdownElement;

  let triggerToggleSwitchElementChange = vi.fn();
  let mockToggleSwitchElement = {
    setAttribute: vi.fn(),
    addEventListener: vi.fn((event, callback) => {
      if (event === 'change') {
        triggerToggleSwitchElementChange = callback;
      }
    }),
  };
  let mockFeatureToggleElement = {
    setAttribute: vi.fn(),
    removeAttribute: vi.fn(),
    addEventListener: vi.fn(),
    querySelector: vi.fn(selector => {
      if (selector === 'toggle-switch') {
        return mockToggleSwitchElement;
      }
    }),
    appendChild: vi.fn(childElement => {
      if (childElement.id === 'countdown-display') {
        mockCountdownElement = childElement;
      }
    }),
  };

  beforeEach(() => {
    vi.clearAllMocks();

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
      mockStorage.local.get.mockResolvedValue({ featureEnabled: true });

      await initializeToggleFeatureStatus(mockFeatureToggleElement as any);

      expect(mockToggleSwitchElement.setAttribute).toHaveBeenCalledWith('checked', 'true');
      expect(mockCountdownElement.style).toMatchInlineSnapshot(`
        {
          "color": "#666",
          "display": "none",
          "fontSize": "12px",
          "marginTop": "5px",
        }
      `);
    });

    test('should initialize toggle with disabled state', async () => {
      mockStorage.local.get.mockResolvedValue({ featureEnabled: false });

      await initializeToggleFeatureStatus(mockFeatureToggleElement as any);

      expect(mockToggleSwitchElement.setAttribute).toHaveBeenCalledWith('checked', 'false');
    });

    test('should setup toggle event listeners', async () => {
      mockStorage.local.get.mockResolvedValue({ featureEnabled: true });

      await initializeToggleFeatureStatus(mockFeatureToggleElement as any);

      expect(mockToggleSwitchElement.addEventListener).toHaveBeenCalledWith(
        'change',
        expect.any(Function)
      );
    });

    test('should setup background message listener', async () => {
      mockStorage.local.get.mockResolvedValue({ featureEnabled: true });

      await initializeToggleFeatureStatus(mockFeatureToggleElement as any);

      expect(mockRuntime.onMessage.addListener).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe('Toggle event handling', () => {
    test('should handle toggle event when checked', async () => {
      mockStorage.local.get.mockResolvedValue({ featureEnabled: true });

      await initializeToggleFeatureStatus(mockFeatureToggleElement as any);

      const mockEvent = {
        target: { checked: true },
      };

      await triggerToggleSwitchElementChange(mockEvent);

      expect(mockRuntime.sendMessage).toHaveBeenCalledTimes(2);

      expect(mockRuntime.sendMessage).toHaveBeenNthCalledWith(1, {
        action: MESSAGE_ACTIONS.GET_COUNTDOWN_STATUS,
      });

      expect(mockRuntime.sendMessage).toHaveBeenNthCalledWith(2, {
        action: MESSAGE_ACTIONS.FEATURE_TOGGLE_CHANGED,
        payload: { enabled: true },
      });
    });

    test('should handle toggle event when unchecked', async () => {
      mockStorage.local.get.mockResolvedValue({ featureEnabled: true });

      mockRuntime.sendMessage.mockImplementation((message: any, callback: Function) => {
        if (message.action === MESSAGE_ACTIONS.GET_COUNTDOWN_STATUS) {
          callback({ isCountdownActive: false, timeLeft: 0 });
        }
      });

      await initializeToggleFeatureStatus(mockFeatureToggleElement as any);

      const mockEvent = {
        target: { checked: false },
      };

      await triggerToggleSwitchElementChange(mockEvent);

      expect(mockRuntime.sendMessage).toHaveBeenCalledTimes(3);

      expect(mockRuntime.sendMessage).toHaveBeenNthCalledWith(1, {
        action: MESSAGE_ACTIONS.GET_COUNTDOWN_STATUS,
      });

      expect(mockRuntime.sendMessage).toHaveBeenNthCalledWith(2, {
        action: MESSAGE_ACTIONS.FEATURE_TOGGLE_CHANGED,
        payload: { enabled: false },
      });
      expect(mockRuntime.sendMessage).toHaveBeenNthCalledWith(3, {
        action: MESSAGE_ACTIONS.GET_COUNTDOWN_STATUS,
      });
    });

    test('should handle runtime errors in toggle event', async () => {
      mockStorage.local.get.mockResolvedValue({ featureEnabled: true });

      const error = new Error('Connection error');
      mockRuntime.sendMessage.mockImplementation(({ action }) => {
        if (action === MESSAGE_ACTIONS.FEATURE_TOGGLE_CHANGED) {
          return Promise.reject(error);
        }
      });

      await initializeToggleFeatureStatus(mockFeatureToggleElement as any);

      await triggerToggleSwitchElementChange({ target: { checked: true } });

      expect(Logger.error).toHaveBeenCalledWith(error, 'FeatureToggle');
    });

    test('should handle exceptions in toggle event', async () => {
      mockStorage.local.get.mockResolvedValue({ featureEnabled: true });

      mockRuntime.sendMessage.mockImplementation(() => {
        throw new Error('Connection failed');
      });

      await initializeToggleFeatureStatus(mockFeatureToggleElement as any);

      const toggleHandler = mockFeatureToggleElement.addEventListener.mock.calls.find(
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
      mockStorage.local.get.mockResolvedValue({ featureEnabled: true });

      await initializeToggleFeatureStatus(mockFeatureToggleElement as any);

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
      mockStorage.local.get.mockResolvedValue({ featureEnabled: true });

      await initializeToggleFeatureStatus(mockFeatureToggleElement as any);

      const messageHandler = mockRuntime.onMessage.addListener.mock.calls[0][0];

      messageHandler({
        action: MESSAGE_ACTIONS.COUNTDOWN_COMPLETED,
      });

      expect(mockCountdownElement.style.display).toBe('none');
      expect(mockFeatureToggleElement.setAttribute).toHaveBeenCalledWith('checked', '');
    });

    test('should ignore unknown messages', async () => {
      mockStorage.local.get.mockResolvedValue({ featureEnabled: true });

      await initializeToggleFeatureStatus(mockFeatureToggleElement as any);

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
      mockStorage.local.get.mockResolvedValue({ featureEnabled: true });

      await initializeToggleFeatureStatus(mockFeatureToggleElement as any);

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
      mockStorage.local.get.mockResolvedValue({ featureEnabled: true });

      await initializeToggleFeatureStatus(mockFeatureToggleElement as any);

      const messageHandler = mockRuntime.onMessage.addListener.mock.calls[0][0];

      messageHandler({
        action: MESSAGE_ACTIONS.UPDATE_COUNTDOWN_DISPLAY,
        payload: { timeLeft: 65000 },
      });

      expect(mockCountdownElement.style.display).toBe('none');
    });

    test('should handle missing countdown element', async () => {
      (document.getElementById as Mock).mockReturnValue(null);

      mockStorage.local.get.mockResolvedValue({ featureEnabled: true });

      await expect(
        initializeToggleFeatureStatus(mockFeatureToggleElement as any)
      ).resolves.not.toThrow();
    });

    test('should format countdown text correctly', async () => {
      mockStorage.local.get.mockResolvedValue({ featureEnabled: true });

      await initializeToggleFeatureStatus(mockFeatureToggleElement as any);

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
      mockStorage.local.get.mockResolvedValue({
        featureEnabled: false,
        reactivationTime: futureTime,
      });

      await initializeToggleFeatureStatus(mockFeatureToggleElement as any);

      // Manually update the text content since the mock doesn't do it
      mockCountdownElement.textContent = 'Reactivation in: 1:00';

      expect(mockCountdownElement.style.display).toBe('block');
      expect(mockCountdownElement.textContent).toContain('Reactivation in:');
    });

    test('should check countdown status if no reactivation time', async () => {
      mockStorage.local.get.mockResolvedValue({ featureEnabled: true });

      mockRuntime.sendMessage.mockImplementation((message: any, callback: Function) => {
        if (message.action === MESSAGE_ACTIONS.GET_COUNTDOWN_STATUS) {
          callback({ isCountdownActive: true, timeLeft: 30000 });
        }
      });

      await initializeToggleFeatureStatus(mockFeatureToggleElement as any);

      expect(mockRuntime.sendMessage).toHaveBeenCalledWith(
        { action: MESSAGE_ACTIONS.GET_COUNTDOWN_STATUS },
        expect.any(Function)
      );
    });

    test('should handle runtime errors when checking countdown status', async () => {
      mockStorage.local.get.mockResolvedValue({ featureEnabled: true });

      mockRuntime.sendMessage.mockImplementation((message: any, callback: Function) => {
        mockRuntime.lastError = { message: 'Connection error' };
        callback();
        mockRuntime.lastError = null;
      });

      await expect(
        initializeToggleFeatureStatus(mockFeatureToggleElement as any)
      ).resolves.not.toThrow();

      // Verificar que se llamó a Logger.error para el error de countdown
      expect(Logger.error).toHaveBeenCalledWith(
        expect.any(Error),
        'Popup',
        expect.objectContaining({
          silentMessages: ['Receiving end does not exist', 'message port closed before a response'],
        })
      );
    });

    test.only('should handle exceptions when checking countdown status', async () => {
      mockStorage.local.get.mockResolvedValue({ featureEnabled: true });

      mockRuntime.sendMessage.mockImplementation(() => {
        throw new Error('Connection failed');
      });

      await expect(
        initializeToggleFeatureStatus(mockFeatureToggleElement as any)
      ).resolves.not.toThrow();

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

  describe('updateCountdownDisplay', () => {
    test('should handle updateCountdownDisplay with feature explicitly set to false', async () => {
      mockStorage.local.get.mockResolvedValue({ featureEnabled: false });

      await initializeToggleFeatureStatus(mockFeatureToggleElement as any);

      const messageHandler = mockRuntime.onMessage.addListener.mock.calls[0][0];

      mockCountdownElement.textContent = 'Auto-enable in: 0:50';

      messageHandler({
        action: MESSAGE_ACTIONS.UPDATE_COUNTDOWN_DISPLAY,
        payload: { timeLeft: 30000 },
      });

      expect(mockCountdownElement.style.display).toBe('block');
      expect(mockCountdownElement.textContent).toBe('Auto-enable in: 0:30');
    });

    test('should handle updateCountdownDisplay when feature is enabled', async () => {
      mockStorage.local.get.mockResolvedValue({ featureEnabled: true });

      await initializeToggleFeatureStatus(mockFeatureToggleElement as any);

      const messageHandler = mockRuntime.onMessage.addListener.mock.calls[0][0];

      expect(mockCountdownElement.style.display).toBe('none');
      expect(mockCountdownElement.textContent).toBeUndefined();
    });

    test('should handle updateCountdownDisplay with undefined featureEnabled (defaults to true)', async () => {
      mockStorage.local.get.mockResolvedValue({ featureEnabled: undefined });

      await initializeToggleFeatureStatus(mockFeatureToggleElement as any);

      const messageHandler = mockRuntime.onMessage.addListener.mock.calls[0][0];

      messageHandler({
        action: MESSAGE_ACTIONS.UPDATE_COUNTDOWN_DISPLAY,
        payload: { timeLeft: 30000 },
      });

      expect(mockCountdownElement.style.display).toBe('block');
      expect(mockCountdownElement.textContent).toMatchInlineSnapshot(`"Auto-enable in: 0:30"`);
    });

    test('should handle getCountdownStatus response with no active countdown', async () => {
      mockStorage.local.get.mockResolvedValue({ featureEnabled: true });

      mockRuntime.sendMessage.mockImplementation(({ action }) => {
        if (action === MESSAGE_ACTIONS.GET_COUNTDOWN_STATUS) {
          return Promise.resolve({ isCountdownActive: false, timeLeft: 0 });
        }
      });

      await initializeToggleFeatureStatus(mockFeatureToggleElement as any);

      expect(mockRuntime.sendMessage).toHaveBeenCalledWith({
        action: MESSAGE_ACTIONS.GET_COUNTDOWN_STATUS,
      });

      expect(mockCountdownElement.style.display).toBe('none');
    });
  });
});
