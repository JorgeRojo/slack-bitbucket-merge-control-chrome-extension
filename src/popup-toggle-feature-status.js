import { Logger } from './utils/logger.js';
import {
  MESSAGE_ACTIONS,
  ERROR_MESSAGES,
} from './constants.js';

/**
 * Manages the countdown element display and text
 * @param {Object} options - Configuration options
 * @param {boolean} options.show - Whether to show the countdown
 * @param {number} [options.timeLeft] - Time left in milliseconds
 * @returns {HTMLElement|null} The countdown element or null if not found
 */
function manageCountdownElement({ show, timeLeft }) {
  const countdownElement = document.getElementById('countdown-timer');
  if (!countdownElement) return null;

  countdownElement.style.display = show ? 'block' : 'none';

  if (show && timeLeft !== undefined) {
    updateCountdownText(countdownElement, timeLeft);
  }

  return countdownElement;
}

/**
 * Updates the countdown text display
 * @param {HTMLElement} element - The countdown element
 * @param {number} timeLeft - Time left in milliseconds
 */
function updateCountdownText(element, timeLeft) {
  const minutes = Math.floor(timeLeft / 60000);
  const seconds = Math.floor((timeLeft % 60000) / 1000);
  element.textContent = `Reactivation in: ${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Updates the countdown display based on feature state
 * @param {number} timeLeft - Time left in milliseconds
 */
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

/**
 * Initializes the feature toggle state based on storage
 * @param {HTMLElement} toggleElement - The toggle element
 */
function initializeFeatureToggleState(toggleElement) {
  chrome.storage.local.get(['featureEnabled', 'reactivationTime'], (result) => {
    const isEnabled = result.featureEnabled !== false;

    if (isEnabled) {
      toggleElement.setAttribute('checked', '');
      manageCountdownElement({ show: false });
      return;
    }

    toggleElement.removeAttribute('checked');

    // Check if there's an active countdown
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

/**
 * Checks the current countdown status from background script
 */
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
    // Silence common connection errors in popup
    Logger.error(error, 'Popup', {
      silentMessages: [
        ERROR_MESSAGES.RECEIVING_END_NOT_EXIST,
        ERROR_MESSAGES.MESSAGE_PORT_CLOSED,
      ],
    });
  }
}

/**
 * Initializes the toggle element
 * @param {HTMLElement} featureToggle - The toggle element
 */
async function initializeToggle(featureToggle) {
  await new Promise((resolve) => requestAnimationFrame(resolve));
  initializeFeatureToggleState(featureToggle);
}

/**
 * Sets up event listeners for the toggle
 * @param {HTMLElement} featureToggle - The toggle element
 */
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
            // Silence connection errors when background script is not available
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
      // Silence common connection errors in toggle
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
      // Give the background script a moment to set up the countdown
      setTimeout(() => checkCountdownStatus(), 100);
    }
  });
}

/**
 * Handles background messages related to countdown
 * @param {Object} request - The message request
 * @param {HTMLElement} featureToggle - The toggle element
 */
function handleBackgroundMessages(request, { featureToggle }) {
  if (request.action === MESSAGE_ACTIONS.UPDATE_COUNTDOWN_DISPLAY) {
    handleCountdownUpdate(request);
  } else if (request.action === MESSAGE_ACTIONS.COUNTDOWN_COMPLETED) {
    handleCountdownCompleted(featureToggle);
  }
}

/**
 * Handles countdown update messages from background
 * @param {Object} request - The message request
 */
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

/**
 * Handles countdown completion messages from background
 * @param {HTMLElement} featureToggle - The toggle element
 */
function handleCountdownCompleted(featureToggle) {
  manageCountdownElement({ show: false });
  featureToggle.setAttribute('checked', '');
}

/**
 * Sets up the message listener for background messages
 * @param {HTMLElement} featureToggle - The toggle element
 */
function setupBackgroundMessageListener(featureToggle) {
  chrome.runtime.onMessage.addListener((request, _sender, _sendResponse) => {
    handleBackgroundMessages(request, { featureToggle });
  });
}

/**
 * Initializes the complete toggle feature status system
 * @param {HTMLElement} featureToggle - The toggle element
 */
export async function initializeToggleFeatureStatus(featureToggle) {
  if (!featureToggle) return;

  await initializeToggle(featureToggle);
  setupToggleEventListeners(featureToggle);
  setupBackgroundMessageListener(featureToggle);
}

// Export individual functions for testing
export {
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
};
