import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  manageCountdownElement,
  updateCountdownText,
  updateCountdownDisplay,
  initializeFeatureToggleState,
  checkCountdownStatus,
  initializeToggle,
  setupToggleEventListeners,
  handleBackgroundMessages,
  handleCountdownUpdate,
  handleCountdownCompleted,
  setupBackgroundMessageListener,
  initializeToggleFeatureStatus,
} from '../src/popup-toggle-feature-status.js';

// Mock chrome APIs
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

describe('popup-toggle-feature-status.js', () => {
  let mockCountdownElement;
  let mockToggleElement;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock DOM elements
    mockCountdownElement = {
      style: { display: '' },
      textContent: '',
    };
    
    mockToggleElement = {
      setAttribute: vi.fn(),
      removeAttribute: vi.fn(),
      addEventListener: vi.fn(),
    };

    // Mock document.getElementById
    global.document = {
      getElementById: vi.fn((id) => {
        if (id === 'countdown-timer') return mockCountdownElement;
        return null;
      }),
    };

    // Reset chrome.runtime.lastError
    global.chrome.runtime.lastError = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('manageCountdownElement', () => {
    test('should show countdown element with time', () => {
      const result = manageCountdownElement({ show: true, timeLeft: 65000 });
      
      expect(mockCountdownElement.style.display).toBe('block');
      expect(mockCountdownElement.textContent).toContain('Reactivation in:');
      expect(result).toBe(mockCountdownElement);
    });

    test('should hide countdown element', () => {
      const result = manageCountdownElement({ show: false });
      
      expect(mockCountdownElement.style.display).toBe('none');
      expect(result).toBe(mockCountdownElement);
    });

    test('should return null when element not found', () => {
      global.document.getElementById.mockReturnValue(null);
      
      const result = manageCountdownElement({ show: true });
      
      expect(result).toBeNull();
    });
  });

  describe('updateCountdownText', () => {
    test('should format time correctly', () => {
      updateCountdownText(mockCountdownElement, 65000); // 1:05
      expect(mockCountdownElement.textContent).toBe('Reactivation in: 1:05');
    });

    test('should pad seconds with zero', () => {
      updateCountdownText(mockCountdownElement, 61000); // 1:01
      expect(mockCountdownElement.textContent).toBe('Reactivation in: 1:01');
    });

    test('should handle zero time', () => {
      updateCountdownText(mockCountdownElement, 0);
      expect(mockCountdownElement.textContent).toBe('Reactivation in: 0:00');
    });
  });

  describe('updateCountdownDisplay', () => {
    test('should hide countdown when feature is enabled', () => {
      global.chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ featureEnabled: true });
      });

      updateCountdownDisplay(60000);

      expect(mockCountdownElement.style.display).toBe('none');
    });

    test('should show countdown when feature is disabled', () => {
      global.chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ featureEnabled: false });
      });

      updateCountdownDisplay(60000);

      expect(mockCountdownElement.style.display).toBe('block');
      expect(mockCountdownElement.textContent).toContain('Reactivation in:');
    });
  });

  describe('initializeFeatureToggleState', () => {
    test('should set toggle as checked when feature is enabled', () => {
      global.chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ featureEnabled: true });
      });

      initializeFeatureToggleState(mockToggleElement);

      expect(mockToggleElement.setAttribute).toHaveBeenCalledWith('checked', '');
      expect(mockCountdownElement.style.display).toBe('none');
    });

    test('should set toggle as unchecked when feature is disabled', () => {
      global.chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ featureEnabled: false });
      });

      initializeFeatureToggleState(mockToggleElement);

      expect(mockToggleElement.removeAttribute).toHaveBeenCalledWith('checked');
    });

    test('should show countdown when reactivation time is set', () => {
      const futureTime = Date.now() + 60000;
      global.chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ 
          featureEnabled: false, 
          reactivationTime: futureTime 
        });
      });

      initializeFeatureToggleState(mockToggleElement);

      expect(mockCountdownElement.style.display).toBe('block');
    });
  });

  describe('checkCountdownStatus', () => {
    test('should send message to get countdown status', () => {
      global.chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        callback({ isCountdownActive: true, timeLeft: 60000 });
      });

      checkCountdownStatus();

      expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith(
        { action: 'getCountdownStatus' },
        expect.any(Function)
      );
    });

    test('should handle runtime error', () => {
      global.chrome.runtime.lastError = { message: 'Connection error' };
      global.chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        callback();
      });

      expect(() => checkCountdownStatus()).not.toThrow();
    });
  });

  describe('initializeToggle', () => {
    test('should initialize toggle after animation frame', async () => {
      global.chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ featureEnabled: true });
      });

      await initializeToggle(mockToggleElement);

      expect(mockToggleElement.setAttribute).toHaveBeenCalledWith('checked', '');
    });
  });

  describe('setupToggleEventListeners', () => {
    test('should add toggle event listener', () => {
      setupToggleEventListeners(mockToggleElement);

      expect(mockToggleElement.addEventListener).toHaveBeenCalledWith(
        'toggle',
        expect.any(Function)
      );
    });

    test('should handle toggle event when checked', () => {
      let toggleHandler;
      mockToggleElement.addEventListener.mockImplementation((event, handler) => {
        if (event === 'toggle') toggleHandler = handler;
      });

      setupToggleEventListeners(mockToggleElement);

      const mockEvent = {
        detail: { checked: true }
      };

      toggleHandler(mockEvent);

      expect(global.chrome.storage.local.set).toHaveBeenCalledWith({
        featureEnabled: true
      });
      expect(mockCountdownElement.style.display).toBe('none');
    });
  });

  describe('handleBackgroundMessages', () => {
    test('should handle updateCountdownDisplay message', () => {
      global.chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ featureEnabled: false });
      });

      const request = {
        action: 'updateCountdownDisplay',
        timeLeft: 60000
      };

      handleBackgroundMessages(request, { featureToggle: mockToggleElement });

      expect(mockCountdownElement.style.display).toBe('block');
    });

    test('should handle countdownCompleted message', () => {
      const request = {
        action: 'countdownCompleted'
      };

      handleBackgroundMessages(request, { featureToggle: mockToggleElement });

      expect(mockCountdownElement.style.display).toBe('none');
      expect(mockToggleElement.setAttribute).toHaveBeenCalledWith('checked', '');
    });
  });

  describe('initializeToggleFeatureStatus', () => {
    test('should initialize complete toggle system', async () => {
      global.chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ featureEnabled: true });
      });

      await initializeToggleFeatureStatus(mockToggleElement);

      expect(mockToggleElement.setAttribute).toHaveBeenCalledWith('checked', '');
      expect(mockToggleElement.addEventListener).toHaveBeenCalledWith(
        'toggle',
        expect.any(Function)
      );
      expect(global.chrome.runtime.onMessage.addListener).toHaveBeenCalled();
    });

    test('should handle null toggle element', async () => {
      await expect(initializeToggleFeatureStatus(null)).resolves.toBeUndefined();
    });
  });
});
