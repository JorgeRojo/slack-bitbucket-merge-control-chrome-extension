import { Logger } from './utils/logger.js';
import { MESSAGE_ACTIONS, ERROR_MESSAGES } from './constants.js';

function manageCountdownElement({ show, timeLeft }) {
  const countdownElement = document.getElementById('countdown-timer');
  if (!countdownElement) return null;

  countdownElement.style.display = show ? 'block' : 'none';

  if (show && timeLeft !== undefined) {
    updateCountdownText(countdownElement, timeLeft);
  }

  return countdownElement;
}

function updateCountdownText(element, timeLeft) {
  const minutes = Math.floor(timeLeft / 60000);
  const seconds = Math.floor((timeLeft % 60000) / 1000);
  element.textContent = `Reactivation in: ${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function updateCountdownDisplay(timeLeft) {
  chrome.storage.local.get(['featureEnabled'], (result) => {
    const isEnabled = result.featureEnabled !== false;

    if (isEnabled) {
      manageCountdownElement({ show: false });
      return;
    }

    manageCountdownElement({ show: true, timeLeft });
  });
}

function initializeFeatureToggleState(toggleElement) {
  chrome.storage.local.get(['featureEnabled', 'reactivationTime'], (result) => {
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

function checkCountdownStatus() {
  try {
    chrome.runtime.sendMessage(
      { action: MESSAGE_ACTIONS.GET_COUNTDOWN_STATUS },
      (response) => {
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
      },
    );
  } catch (error) {
    Logger.error(error, 'Popup', {
      silentMessages: [
        ERROR_MESSAGES.RECEIVING_END_NOT_EXIST,
        ERROR_MESSAGES.MESSAGE_PORT_CLOSED,
      ],
    });
  }
}

async function initializeToggle(featureToggle) {
  await new Promise((resolve) => requestAnimationFrame(resolve));
  initializeFeatureToggleState(featureToggle);
}

function setupToggleEventListeners(featureToggle) {
  featureToggle.addEventListener('toggle', (event) => {
    const isChecked = event.detail.checked;
    chrome.storage.local.set({ featureEnabled: isChecked });

    try {
      chrome.runtime.sendMessage(
        {
          action: MESSAGE_ACTIONS.FEATURE_TOGGLE_CHANGED,
          enabled: isChecked,
        },
        (_response) => {
          if (chrome.runtime.lastError) {
            Logger.error(new Error(chrome.runtime.lastError.message), 'Popup', {
              silentMessages: [
                ERROR_MESSAGES.RECEIVING_END_NOT_EXIST,
                ERROR_MESSAGES.MESSAGE_PORT_CLOSED,
              ],
            });
            return;
          }
        },
      );
    } catch (error) {
      Logger.error(error, 'Popup', {
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

function handleBackgroundMessages(request, { featureToggle }) {
  if (request.action === MESSAGE_ACTIONS.UPDATE_COUNTDOWN_DISPLAY) {
    handleCountdownUpdate(request);
  } else if (request.action === MESSAGE_ACTIONS.COUNTDOWN_COMPLETED) {
    handleCountdownCompleted(featureToggle);
  }
}

function handleCountdownUpdate(request) {
  chrome.storage.local.get(['featureEnabled'], (result) => {
    const isEnabled = result.featureEnabled !== false;

    if (!isEnabled) {
      updateCountdownDisplay(request.timeLeft);
    } else {
      manageCountdownElement({ show: false });
    }
  });
}

function handleCountdownCompleted(featureToggle) {
  manageCountdownElement({ show: false });
  featureToggle.setAttribute('checked', '');
}

function setupBackgroundMessageListener(featureToggle) {
  chrome.runtime.onMessage.addListener((request, _sender, _sendResponse) => {
    handleBackgroundMessages(request, { featureToggle });
  });
}

export async function initializeToggleFeatureStatus(featureToggle) {
  if (!featureToggle) return;

  await initializeToggle(featureToggle);
  setupToggleEventListeners(featureToggle);
  setupBackgroundMessageListener(featureToggle);
}
