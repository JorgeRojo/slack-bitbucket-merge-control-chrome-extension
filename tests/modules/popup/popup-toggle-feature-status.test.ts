import { MESSAGE_ACTIONS } from '@src/modules/common/constants';
import { initializeToggleFeatureStatus } from '@src/modules/popup/popup-toggle-feature-status';
import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('@src/modules/common/utils/Logger', () => ({
  Logger: {
    error: vi.fn(),
  },
}));

const { Logger } = await import('@src/modules/common/utils/Logger');

describe('popup-toggle-feature-status', () => {
  const originalChrome = global.chrome;

  beforeEach(() => {
    vi.clearAllMocks();

    global.chrome = {
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({ featureEnabled: true }),
        },
      },
      runtime: {
        sendMessage: vi.fn().mockResolvedValue({ isCountdownActive: false, timeLeft: 0 }),
        onMessage: {
          addListener: vi.fn(),
        },
      },
    } as any;

    document.getElementById = vi.fn().mockReturnValue({
      style: { display: 'none' },
      textContent: '',
    });
  });

  afterEach(() => {
    global.chrome = originalChrome;
  });

  test('should handle null toggle element', async () => {
    await expect(initializeToggleFeatureStatus(null)).resolves.not.toThrow();
    expect(chrome.storage.local.get).not.toHaveBeenCalled();
  });

  test('should handle null countdown display', async () => {
    document.getElementById = vi.fn().mockReturnValue(null);

    const mockToggleSwitch = {
      setAttribute: vi.fn(),
      addEventListener: vi.fn(),
    };

    await expect(initializeToggleFeatureStatus(mockToggleSwitch as any)).resolves.not.toThrow();
    expect(chrome.storage.local.get).not.toHaveBeenCalled();
  });

  test('should initialize toggle switch with feature enabled state', async () => {
    const mockToggleSwitch = {
      setAttribute: vi.fn(),
      addEventListener: vi.fn(),
    };

    const mockCountdownDisplay = {
      style: { display: 'none' },
      textContent: '',
    };

    document.getElementById = vi.fn().mockReturnValue(mockCountdownDisplay);
    chrome.storage.local.get = vi.fn().mockResolvedValue({ featureEnabled: true });

    await initializeToggleFeatureStatus(mockToggleSwitch as any);

    expect(chrome.storage.local.get).toHaveBeenCalledWith('featureEnabled');
    expect(mockToggleSwitch.setAttribute).toHaveBeenCalledWith('checked', 'true');
    expect(mockCountdownDisplay.style.display).toBe('none');
  });

  test('should initialize toggle switch with feature disabled state', async () => {
    const mockToggleSwitch = {
      setAttribute: vi.fn(),
      addEventListener: vi.fn(),
    };

    const mockCountdownDisplay = {
      style: { display: 'none' },
      textContent: '',
    };

    document.getElementById = vi.fn().mockReturnValue(mockCountdownDisplay);
    chrome.storage.local.get = vi.fn().mockResolvedValue({ featureEnabled: false });

    await initializeToggleFeatureStatus(mockToggleSwitch as any);

    expect(chrome.storage.local.get).toHaveBeenCalledWith('featureEnabled');
    expect(mockToggleSwitch.setAttribute).toHaveBeenCalledWith('checked', 'false');
    expect(mockCountdownDisplay.style.display).toBe('none');
  });

  test('should handle toggle event when checked', async () => {
    const mockToggleSwitch = {
      setAttribute: vi.fn(),
      addEventListener: vi.fn(),
    };

    const mockCountdownDisplay = {
      style: { display: 'none' },
      textContent: '',
    };

    document.getElementById = vi.fn().mockReturnValue(mockCountdownDisplay);

    await initializeToggleFeatureStatus(mockToggleSwitch as any);

    const toggleCallback = mockToggleSwitch.addEventListener.mock.calls[0][1];
    await toggleCallback({ detail: { checked: true } });

    expect(mockCountdownDisplay.style.display).toBe('none');
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      action: MESSAGE_ACTIONS.FEATURE_TOGGLE_CHANGED,
      payload: { enabled: true },
    });
  });

  test('should handle toggle event when unchecked', async () => {
    const mockToggleSwitch = {
      setAttribute: vi.fn(),
      addEventListener: vi.fn(),
    };

    const mockCountdownDisplay = {
      style: { display: 'none' },
      textContent: '',
    };

    document.getElementById = vi.fn().mockReturnValue(mockCountdownDisplay);

    chrome.runtime.sendMessage = vi.fn().mockImplementation(message => {
      if (message.action === MESSAGE_ACTIONS.GET_COUNTDOWN_STATUS) {
        return Promise.resolve({
          isCountdownActive: true,
          timeLeft: 120000, // 2 minutes
        });
      }
      return Promise.resolve({});
    });

    await initializeToggleFeatureStatus(mockToggleSwitch as any);

    const toggleCallback = mockToggleSwitch.addEventListener.mock.calls[0][1];
    await toggleCallback({ detail: { checked: false } });

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      action: MESSAGE_ACTIONS.FEATURE_TOGGLE_CHANGED,
      payload: { enabled: false },
    });

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      action: MESSAGE_ACTIONS.GET_COUNTDOWN_STATUS,
    });

    expect(mockCountdownDisplay.textContent).toContain('Auto-enable in: 2:00');
    expect(mockCountdownDisplay.style.display).toBe('block');
  });

  test('should handle error in toggle event', async () => {
    const mockToggleSwitch = {
      setAttribute: vi.fn(),
      addEventListener: vi.fn(),
    };

    const mockCountdownDisplay = {
      style: { display: 'none' },
      textContent: '',
    };

    document.getElementById = vi.fn().mockReturnValue(mockCountdownDisplay);

    chrome.runtime.sendMessage = vi.fn().mockRejectedValue(new Error('Test error'));

    await initializeToggleFeatureStatus(mockToggleSwitch as any);

    const toggleCallback = mockToggleSwitch.addEventListener.mock.calls[0][1];
    await toggleCallback({ detail: { checked: true } });

    expect(Logger.error).toHaveBeenCalled();
  });

  test('should handle UPDATE_COUNTDOWN_DISPLAY message', async () => {
    const mockToggleSwitch = {
      setAttribute: vi.fn(),
      addEventListener: vi.fn(),
    };

    const mockCountdownDisplay = {
      style: { display: 'none' },
      textContent: '',
    };

    document.getElementById = vi.fn().mockReturnValue(mockCountdownDisplay);

    await initializeToggleFeatureStatus(mockToggleSwitch as any);

    const messageListener = chrome.runtime.onMessage.addListener.mock.calls[0][0];
    messageListener({
      action: MESSAGE_ACTIONS.UPDATE_COUNTDOWN_DISPLAY,
      payload: { timeLeft: 65000 }, // 1 minute and 5 seconds
    });

    expect(mockCountdownDisplay.textContent).toContain('Auto-enable in: 1:05');
    expect(mockCountdownDisplay.style.display).toBe('block');
  });

  test('should handle COUNTDOWN_COMPLETED message', async () => {
    const mockToggleSwitch = {
      setAttribute: vi.fn(),
      addEventListener: vi.fn(),
    };

    const mockCountdownDisplay = {
      style: { display: 'none' },
      textContent: '',
    };

    document.getElementById = vi.fn().mockReturnValue(mockCountdownDisplay);

    await initializeToggleFeatureStatus(mockToggleSwitch as any);

    const messageListener = chrome.runtime.onMessage.addListener.mock.calls[0][0];
    messageListener({
      action: MESSAGE_ACTIONS.COUNTDOWN_COMPLETED,
    });

    expect(mockCountdownDisplay.style.display).toBe('none');
    expect(mockToggleSwitch.setAttribute).toHaveBeenCalledWith('checked', 'true');
  });

  test('should handle checkCountdownStatus with active countdown', async () => {
    const mockToggleSwitch = {
      setAttribute: vi.fn(),
      addEventListener: vi.fn(),
    };

    const mockCountdownDisplay = {
      style: { display: 'none' },
      textContent: '',
    };

    document.getElementById = vi.fn().mockReturnValue(mockCountdownDisplay);

    chrome.runtime.sendMessage = vi.fn().mockResolvedValue({
      isCountdownActive: true,
      timeLeft: 30000, // 30 seconds
    });

    await initializeToggleFeatureStatus(mockToggleSwitch as any);

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      action: MESSAGE_ACTIONS.GET_COUNTDOWN_STATUS,
    });

    expect(mockCountdownDisplay.textContent).toContain('Auto-enable in: 0:30');
    expect(mockCountdownDisplay.style.display).toBe('block');
  });

  test('should handle checkCountdownStatus with inactive countdown', async () => {
    const mockToggleSwitch = {
      setAttribute: vi.fn(),
      addEventListener: vi.fn(),
    };

    const mockCountdownDisplay = {
      style: { display: 'none' },
      textContent: '',
    };

    document.getElementById = vi.fn().mockReturnValue(mockCountdownDisplay);

    chrome.runtime.sendMessage = vi.fn().mockResolvedValue({
      isCountdownActive: false,
      timeLeft: 0,
    });

    await initializeToggleFeatureStatus(mockToggleSwitch as any);

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      action: MESSAGE_ACTIONS.GET_COUNTDOWN_STATUS,
    });

    expect(mockCountdownDisplay.style.display).toBe('none');
  });

  test('should handle error in checkCountdownStatus', async () => {
    const mockToggleSwitch = {
      setAttribute: vi.fn(),
      addEventListener: vi.fn(),
    };

    const mockCountdownDisplay = {
      style: { display: 'none' },
      textContent: '',
    };

    document.getElementById = vi.fn().mockReturnValue(mockCountdownDisplay);

    chrome.runtime.sendMessage = vi.fn().mockRejectedValue(new Error('Test error'));

    await initializeToggleFeatureStatus(mockToggleSwitch as any);

    expect(Logger.error).toHaveBeenCalled();
  });

  test('should handle updateCountdownDisplay with zero or negative time', async () => {
    const mockToggleSwitch = {
      setAttribute: vi.fn(),
      addEventListener: vi.fn(),
    };

    const mockCountdownDisplay = {
      style: { display: 'none' },
      textContent: '',
    };

    document.getElementById = vi.fn().mockReturnValue(mockCountdownDisplay);

    await initializeToggleFeatureStatus(mockToggleSwitch as any);

    const messageListener = chrome.runtime.onMessage.addListener.mock.calls[0][0];

    messageListener({
      action: MESSAGE_ACTIONS.UPDATE_COUNTDOWN_DISPLAY,
      payload: { timeLeft: 0 },
    });

    expect(mockCountdownDisplay.style.display).toBe('none');

    messageListener({
      action: MESSAGE_ACTIONS.UPDATE_COUNTDOWN_DISPLAY,
      payload: { timeLeft: -1000 },
    });

    expect(mockCountdownDisplay.style.display).toBe('none');
  });

  test('should format time correctly in updateCountdownDisplay', async () => {
    const mockToggleSwitch = {
      setAttribute: vi.fn(),
      addEventListener: vi.fn(),
    };

    const mockCountdownDisplay = {
      style: { display: 'none' },
      textContent: '',
    };

    document.getElementById = vi.fn().mockReturnValue(mockCountdownDisplay);

    await initializeToggleFeatureStatus(mockToggleSwitch as any);

    const messageListener = chrome.runtime.onMessage.addListener.mock.calls[0][0];

    const testCases = [
      { timeLeft: 1000, expected: '0:01' },
      { timeLeft: 10000, expected: '0:10' },
      { timeLeft: 60000, expected: '1:00' },
      { timeLeft: 61000, expected: '1:01' },
      { timeLeft: 3599000, expected: '59:59' },
      { timeLeft: 3600000, expected: '60:00' },
    ];

    for (const testCase of testCases) {
      messageListener({
        action: MESSAGE_ACTIONS.UPDATE_COUNTDOWN_DISPLAY,
        payload: { timeLeft: testCase.timeLeft },
      });

      expect(mockCountdownDisplay.textContent).toBe(`Auto-enable in: ${testCase.expected}`);
      expect(mockCountdownDisplay.style.display).toBe('block');
    }
  });
});
