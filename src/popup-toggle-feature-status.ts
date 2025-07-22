import { Logger } from './utils/logger';
import { MESSAGE_ACTIONS, ERROR_MESSAGES } from './constants';
import { ChromeRuntimeMessage } from './types/chrome';
import { toErrorType } from './utils/type-helpers';

interface CountdownOptions {
  show: boolean;
  timeLeft?: number;
}

interface CountdownResponse {
  isCountdownActive: boolean;
  timeLeft: number;
}

function manageCountdownElement({ show, timeLeft }: CountdownOptions): HTMLElement | null {
  const countdownElement = document.getElementById('countdown-timer');
  if (!countdownElement) return null;

  countdownElement.style.display = show ? 'block' : 'none';

  if (show && timeLeft !== undefined) {
    updateCountdownText(countdownElement, timeLeft);
  }

  return countdownElement;
}

function updateCountdownText(element: HTMLElement, timeLeft: number): void {
  const minutes = Math.floor(timeLeft / 60000);
  const seconds = Math.floor((timeLeft % 60000) / 1000);
  element.textContent = `Reactivation in: ${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function updateCountdownDisplay(timeLeft: number): void {
  chrome.storage.local.get(['featureEnabled'], result => {
    const isEnabled = result.featureEnabled !== false;

    if (isEnabled) {
      manageCountdownElement({ show: false });
      return;
    }

    manageCountdownElement({ show: true, timeLeft });
  });
}

function checkCountdownStatus(): void {
  try {
    chrome.runtime.sendMessage(
      { action: MESSAGE_ACTIONS.GET_COUNTDOWN_STATUS },
      (response: CountdownResponse | undefined) => {
        if (chrome.runtime.lastError) {
          Logger.error(new Error(chrome.runtime.lastError.message), 'Popup', {
            silentMessages: [
              ERROR_MESSAGES.RECEIVING_END_NOT_EXIST,
              ERROR_MESSAGES.MESSAGE_PORT_CLOSED,
            ],
          });
          return;
        }

        if (!response?.isCountdownActive) return;

        updateCountdownDisplay(response.timeLeft);
      }
    );
  } catch (error) {
    Logger.error(toErrorType(error), 'Popup', {
      silentMessages: [ERROR_MESSAGES.RECEIVING_END_NOT_EXIST, ERROR_MESSAGES.MESSAGE_PORT_CLOSED],
    });
  }
}

async function initializeToggle(toggleElement: HTMLElement): Promise<void> {
  chrome.storage.local.get(['featureEnabled', 'reactivationTime'], result => {
    const isEnabled = result.featureEnabled !== false;

    if (isEnabled) {
      toggleElement.setAttribute('checked', '');
      manageCountdownElement({ show: false });

      return;
    }

    toggleElement.removeAttribute('checked');

    const { reactivationTime } = result;
    if (reactivationTime) {
      const currentTime = Date.now();
      const timeLeft = Math.max(0, reactivationTime - currentTime);

      if (timeLeft > 0) {
        updateCountdownDisplay(timeLeft);

        return;
      }
    }

    checkCountdownStatus();
  });
}

function setupToggleEventListeners(featureToggle: HTMLElement): void {
  featureToggle.addEventListener('toggle', (event: Event) => {
    const customEvent = event as CustomEvent;
    const isChecked = customEvent.detail.checked;
    chrome.storage.local.set({ featureEnabled: isChecked });

    try {
      chrome.runtime.sendMessage(
        {
          action: MESSAGE_ACTIONS.FEATURE_TOGGLE_CHANGED,
          enabled: isChecked,
        },
        _response => {
          if (chrome.runtime.lastError) {
            Logger.error(new Error(chrome.runtime.lastError.message), 'Popup', {
              silentMessages: [
                ERROR_MESSAGES.RECEIVING_END_NOT_EXIST,
                ERROR_MESSAGES.MESSAGE_PORT_CLOSED,
              ],
            });
            return;
          }
        }
      );
    } catch (error) {
      Logger.error(toErrorType(error), 'Popup', {
        silentMessages: [
          ERROR_MESSAGES.RECEIVING_END_NOT_EXIST,
          ERROR_MESSAGES.MESSAGE_PORT_CLOSED,
        ],
      });
    }

    if (isChecked) {
      manageCountdownElement({ show: false });
    } else {
      setTimeout(() => checkCountdownStatus(), 100);
    }
  });
}

interface BackgroundMessageHandlerOptions {
  featureToggle: HTMLElement;
}

function handleBackgroundMessages(
  request: ChromeRuntimeMessage,
  { featureToggle }: BackgroundMessageHandlerOptions
): void {
  if (request.action === MESSAGE_ACTIONS.UPDATE_COUNTDOWN_DISPLAY) {
    handleCountdownUpdate(request);
  } else if (request.action === MESSAGE_ACTIONS.COUNTDOWN_COMPLETED) {
    handleCountdownCompleted(featureToggle);
  }
}

function handleCountdownUpdate(request: ChromeRuntimeMessage): void {
  chrome.storage.local.get(['featureEnabled'], result => {
    const isEnabled = result.featureEnabled !== false;

    if (!isEnabled) {
      updateCountdownDisplay(request.payload?.timeLeft);
    } else {
      manageCountdownElement({ show: false });
    }
  });
}

function handleCountdownCompleted(featureToggle: HTMLElement): void {
  manageCountdownElement({ show: false });
  featureToggle.setAttribute('checked', '');
}

function setupBackgroundMessageListener(featureToggle: HTMLElement): void {
  chrome.runtime.onMessage.addListener((request, _sender, _sendResponse) => {
    handleBackgroundMessages(request, { featureToggle });
  });
}

export async function initializeToggleFeatureStatus(featureToggle: HTMLElement): Promise<void> {
  if (!featureToggle) return;

  await initializeToggle(featureToggle);
  setupToggleEventListeners(featureToggle);
  setupBackgroundMessageListener(featureToggle);
}
