import { SLACK_BASE_URL, FEATURE_REACTIVATION_TIMEOUT } from './constants.js';
import { literals } from './literals.js';
import './components/toggle-switch/index.js';

/**
 * Returns the time when the feature should be reactivated
 * @returns {number} - Timestamp in milliseconds
 */
export function getReactivationTime() {
  return Date.now() + FEATURE_REACTIVATION_TIMEOUT;
}

/**
 * Updates the UI elements based on the current merge status
 * @param {HTMLElement} statusIcon - The status icon element
 * @param {HTMLElement} statusText - The status text element
 * @param {HTMLElement} openOptionsButton - The options button element
 * @param {HTMLElement} slackChannelLink - The Slack channel link element
 * @param {HTMLElement} matchingMessageDiv - The matching message div element
 * @param {string} state - The current merge state ('allowed', 'disallowed', 'exception', 'config_needed', 'unknown')
 * @param {string} message - The message to display
 * @param {Object} [matchingMessage=null] - The matching Slack message object
 */
export function updateUI(
  statusIcon,
  statusText,
  openOptionsButton,
  slackChannelLink,
  matchingMessageDiv,
  state,
  message,
  matchingMessage = null,
) {
  statusIcon.className = state;
  statusText.className = state;

  openOptionsButton.style.display = 'none';
  slackChannelLink.style.display = 'none';
  matchingMessageDiv.style.display = 'none';

  switch (state) {
    case 'allowed':
      statusIcon.textContent = literals.popup.emojiAllowed;
      statusText.textContent = message;
      break;
    case 'disallowed':
      statusIcon.textContent = literals.popup.emojiDisallowed;
      statusText.textContent = message;
      break;
    case 'exception':
      statusIcon.textContent = literals.popup.emojiException;
      statusText.textContent = message;
      slackChannelLink.style.display = 'block';
      break;
    case 'config_needed':
      statusIcon.textContent = literals.popup.emojiUnknown;
      statusText.textContent = message;
      openOptionsButton.style.display = 'block';
      break;
    default:
      statusIcon.textContent = literals.popup.emojiUnknown;
      statusText.textContent = message || literals.popup.textCouldNotDetermine;
      break;
  }

  if (matchingMessage) {
    matchingMessageDiv.textContent = `${literals.popup.textMatchingMessagePrefix}${matchingMessage.text}"`;
    matchingMessageDiv.style.display = 'block';
  }
}

/**
 * Manages the countdown timer element display and content
 * @param {Object} options - Configuration options
 * @param {boolean} options.show - Whether to show or hide the countdown element
 * @param {number} [options.timeLeft] - Time left in milliseconds (required when show is true)
 * @returns {HTMLElement|null} - The countdown element or null if not found
 */
export function manageCountdownElement(options) {
  const countdownElement = document.getElementById('countdown-timer');
  if (!countdownElement) return null;

  if (!options.show) {
    countdownElement.style.display = 'none';
  } else {
    countdownElement.style.display = 'block';

    // Only update the text content if timeLeft is provided
    if (options.timeLeft !== undefined) {
      const minutes = Math.floor(options.timeLeft / 60000);
      const seconds = Math.floor((options.timeLeft % 60000) / 1000);
      countdownElement.textContent = `Reactivation in: ${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
  }

  return countdownElement;
}

/**
 * Updates the countdown display based on the current feature state and time left
 * @param {number} timeLeft - Time left in milliseconds
 */
export function updateCountdownDisplay(timeLeft) {
  chrome.storage.local.get(['featureEnabled'], (result) => {
    const isEnabled = result.featureEnabled !== false;

    if (isEnabled || timeLeft <= 0) {
      manageCountdownElement({ show: false });
      return;
    }

    manageCountdownElement({ show: true, timeLeft });
  });
}

/**
 * Schedules feature reactivation by sending a message to the background script
 * @param {HTMLElement} toggleElement - The toggle element
 * @param {number} [reactivationTime] - Optional reactivation time, defaults to getReactivationTime()
 */
export function scheduleFeatureReactivation(toggleElement, reactivationTime) {
  if (!reactivationTime) {
    reactivationTime = getReactivationTime();
  }

  // Send message to background script to start the countdown
  chrome.runtime.sendMessage({
    action: 'featureToggleChanged',
    enabled: false,
  });

  // The background script will handle the countdown and notify the popup
}

/**
 * Initializes the feature toggle state based on stored settings
 * @param {HTMLElement} toggleElement - The toggle element to initialize
 */
export function initializeFeatureToggleState(toggleElement) {
  chrome.storage.local.get(['featureEnabled', 'reactivationTime'], (result) => {
    const isEnabled = result.featureEnabled !== false;

    if (isEnabled) {
      toggleElement.setAttribute('checked', '');
      manageCountdownElement({ show: false });
    } else {
      toggleElement.removeAttribute('checked');

      chrome.runtime.sendMessage(
        { action: 'getCountdownStatus' },
        (response) => {
          if (response && response.isCountdownActive) {
            updateCountdownDisplay(response.timeLeft);
          }
        },
      );
    }
  });
}

/**
 * Loads and displays data from storage in the popup UI
 * @param {HTMLElement} statusIcon - The status icon element
 * @param {HTMLElement} statusText - The status text element
 * @param {HTMLElement} openOptionsButton - The options button element
 * @param {HTMLElement} slackChannelLink - The Slack channel link element
 * @param {HTMLElement} matchingMessageDiv - The matching message div element
 * @returns {Promise<void>}
 */
export async function loadAndDisplayData(
  statusIcon,
  statusText,
  openOptionsButton,
  slackChannelLink,
  matchingMessageDiv,
) {
  try {
    const { slackToken, appToken, channelName } = await chrome.storage.sync.get(
      ['slackToken', 'appToken', 'channelName'],
    );

    const { channelId, teamId } = await chrome.storage.local.get([
      'channelId',
      'teamId',
    ]);

    if (!slackToken || !appToken || !channelName) {
      updateUI(
        statusIcon,
        statusText,
        openOptionsButton,
        slackChannelLink,
        matchingMessageDiv,
        'config_needed',
        literals.popup.textConfigNeeded,
      );
      return;
    }

    if (channelId && teamId) {
      slackChannelLink.href = `${SLACK_BASE_URL}${teamId}/${channelId}`;
    }

    const { lastKnownMergeState } = await chrome.storage.local.get(
      'lastKnownMergeState',
    );

    if (!lastKnownMergeState || !lastKnownMergeState.mergeStatus) {
      updateUI(
        statusIcon,
        statusText,
        openOptionsButton,
        slackChannelLink,
        matchingMessageDiv,
        'loading',
      );
      statusText.textContent = literals.popup.textWaitingMessages;
      return;
    }

    const status = lastKnownMergeState.mergeStatus;
    const lastSlackMessage = lastKnownMergeState.lastSlackMessage;

    if (status === 'exception') {
      updateUI(
        statusIcon,
        statusText,
        openOptionsButton,
        slackChannelLink,
        matchingMessageDiv,
        'exception',
        literals.popup.textAllowedWithExceptions,
        lastSlackMessage,
      );
    } else if (status === 'allowed') {
      updateUI(
        statusIcon,
        statusText,
        openOptionsButton,
        slackChannelLink,
        matchingMessageDiv,
        'allowed',
        literals.popup.textMergeAllowed,
        lastSlackMessage,
      );
    } else if (status === 'disallowed') {
      updateUI(
        statusIcon,
        statusText,
        openOptionsButton,
        slackChannelLink,
        matchingMessageDiv,
        'disallowed',
        literals.popup.textMergeNotAllowed,
        lastSlackMessage,
      );
    } else {
      updateUI(
        statusIcon,
        statusText,
        openOptionsButton,
        slackChannelLink,
        matchingMessageDiv,
        'unknown',
        literals.popup.textCouldNotDetermineStatus,
      );
    }
  } catch (error) {
    console.error('Error processing messages:', error);
    updateUI(
      statusIcon,
      statusText,
      openOptionsButton,
      slackChannelLink,
      matchingMessageDiv,
      'disallowed',
      literals.popup.textErrorProcessingMessages,
    );
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const statusIcon = document.getElementById('status-icon');
  const statusText = document.getElementById('status-text');
  const openOptionsButton = document.getElementById('open-options');
  const slackChannelLink = document.getElementById('slack-channel-link');
  const matchingMessageDiv = document.getElementById('matching-message');
  const featureToggle = document.getElementById('feature-toggle');

  async function initializeToggle() {
    await new Promise((resolve) => setTimeout(resolve, 100));
    initializeFeatureToggleState(featureToggle);
  }

  if (featureToggle) {
    await initializeToggle();

    featureToggle.addEventListener('toggle', (event) => {
      const isChecked = event.detail.checked;
      chrome.storage.local.set({ featureEnabled: isChecked });

      chrome.runtime.sendMessage({
        action: 'featureToggleChanged',
        enabled: isChecked,
      });

      if (isChecked) {
        manageCountdownElement({ show: false });
      }
    });
  }

  openOptionsButton.addEventListener('click', () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL('options.html'));
    }
  });

  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (
      namespace === 'local' &&
      (changes.lastKnownMergeState || changes.lastMatchingMessage)
    ) {
      loadAndDisplayData(
        statusIcon,
        statusText,
        openOptionsButton,
        slackChannelLink,
        matchingMessageDiv,
      );
    }
  });

  chrome.runtime.onMessage.addListener((request, _sender, _sendResponse) => {
    if (request.action === 'updateCountdownDisplay') {
      chrome.storage.local.get(['featureEnabled'], (result) => {
        const isEnabled = result.featureEnabled !== false;

        if (!isEnabled) {
          // Just pass the timeLeft parameter, manageCountdownElement is called inside updateCountdownDisplay
          updateCountdownDisplay(request.timeLeft);
        } else {
          manageCountdownElement({ show: false });
        }
      });
    } else if (request.action === 'countdownCompleted') {
      manageCountdownElement({ show: false });
      featureToggle.setAttribute('checked', '');
    }
  });

  await loadAndDisplayData(
    statusIcon,
    statusText,
    openOptionsButton,
    slackChannelLink,
    matchingMessageDiv,
  );
});
