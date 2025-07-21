import { Logger } from './utils/logger.js';
import {
  SLACK_BASE_URL,
  MERGE_STATUS,
  APP_STATUS,
  MESSAGE_ACTIONS,
  ERROR_MESSAGES,
} from './constants.js';
import { literals } from './literals.js';
import './components/toggle-switch/index.js';

document.addEventListener('DOMContentLoaded', async () => {
  const uiElements = {
    statusIcon: document.getElementById('status-icon'),
    statusText: document.getElementById('status-text'),
    openOptionsButton: document.getElementById('open-options'),
    slackChannelLink: document.getElementById('slack-channel-link'),
    matchingMessageDiv: document.getElementById('matching-message'),
    featureToggle: document.getElementById('feature-toggle'),
    optionsLinkContainer: document.getElementById('options-link-container'),
  };

  const {
    statusIcon,
    statusText,
    openOptionsButton,
    slackChannelLink,
    matchingMessageDiv,
    featureToggle,
    optionsLinkContainer,
  } = uiElements;

  if (featureToggle) {
    await initializeToggle(featureToggle);
    setupEventListeners(uiElements);
  }

  await loadAndDisplayData({
    statusIcon,
    statusText,
    openOptionsButton,
    slackChannelLink,
    matchingMessageDiv,
    optionsLinkContainer,
  });
});

function updateUI({
  statusIcon,
  statusText,
  openOptionsButton,
  slackChannelLink,
  matchingMessageDiv,
  optionsLinkContainer,
  state,
  message,
  matchingMessage = null,
}) {
  if (statusIcon) {
    statusIcon.className = state;
  }

  if (statusText) {
    statusText.className = state;
  }

  if (openOptionsButton) {
    openOptionsButton.style.display = 'none';
  }

  if (slackChannelLink) {
    slackChannelLink.style.display = 'none';
  }

  if (matchingMessageDiv) {
    matchingMessageDiv.style.display = 'none';
  }

  updateContentByState({
    statusIcon,
    statusText,
    openOptionsButton,
    slackChannelLink,
    optionsLinkContainer,
    state,
    message,
  });

  if (matchingMessage && matchingMessageDiv) {
    matchingMessageDiv.textContent = matchingMessage.text;
    matchingMessageDiv.style.display = 'block';
  }
}

function updateContentByState({
  statusIcon,
  statusText,
  openOptionsButton,
  slackChannelLink,
  optionsLinkContainer,
  state,
  message,
}) {
  switch (state) {
    case MERGE_STATUS.ALLOWED:
      statusIcon.textContent = literals.popup.emojiAllowed;
      statusText.textContent = message;
      break;
    case MERGE_STATUS.DISALLOWED:
      statusIcon.textContent = literals.popup.emojiDisallowed;
      statusText.textContent = message;
      break;
    case MERGE_STATUS.EXCEPTION:
      statusIcon.textContent = literals.popup.emojiException;
      statusText.textContent = message;
      if (slackChannelLink) {
        slackChannelLink.style.display = 'block';
      }
      break;
    case MERGE_STATUS.CONFIG_NEEDED:
      statusIcon.textContent = literals.popup.emojiUnknown;
      statusText.textContent = message;
      if (openOptionsButton) {
        openOptionsButton.style.display = 'block';
      }
      if (optionsLinkContainer) {
        optionsLinkContainer.style.display = 'none';
      }
      break;
    default:
      statusIcon.textContent = literals.popup.emojiUnknown;
      statusText.textContent = message ?? literals.popup.textCouldNotDetermine;
      break;
  }

  if (openOptionsButton && openOptionsButton.style.display === 'none') {
    if (optionsLinkContainer) {
      optionsLinkContainer.style.display = 'block';
    }
  } else {
    if (optionsLinkContainer) {
      optionsLinkContainer.style.display = 'none';
    }
  }
}

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

    if (isEnabled || timeLeft <= 0) {
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
    // Silence common connection errors in popup
    Logger.error(error, 'Popup', {
      silentMessages: [
        ERROR_MESSAGES.RECEIVING_END_NOT_EXIST,
        ERROR_MESSAGES.MESSAGE_PORT_CLOSED,
      ],
    });
  }
}

async function loadAndDisplayData({
  statusIcon,
  statusText,
  openOptionsButton,
  slackChannelLink,
  matchingMessageDiv,
  optionsLinkContainer,
}) {
  try {
    const { slackToken, appToken, channelName } = await chrome.storage.sync.get(
      ['slackToken', 'appToken', 'channelName'],
    );

    if (!slackToken || !appToken || !channelName) {
      showConfigNeededUI({
        statusIcon,
        statusText,
        openOptionsButton,
        slackChannelLink,
        matchingMessageDiv,
        optionsLinkContainer,
      });
      return;
    }

    await setupSlackChannelLink(slackChannelLink);

    await showMergeStatus({
      statusIcon,
      statusText,
      openOptionsButton,
      slackChannelLink,
      matchingMessageDiv,
      optionsLinkContainer,
    });
  } catch (error) {
    Logger.error(error, 'PopupUI', {
      action: 'processMessages',
      uiElements: {
        statusIcon: statusIcon?.id,
        statusText: statusText?.id,
        hasOpenOptionsButton: !!openOptionsButton,
        hasSlackChannelLink: !!slackChannelLink,
      },
    });
    showErrorUI({
      statusIcon,
      statusText,
      openOptionsButton,
      slackChannelLink,
      matchingMessageDiv,
      optionsLinkContainer,
    });
  }
}

function showConfigNeededUI({
  statusIcon,
  statusText,
  openOptionsButton,
  slackChannelLink,
  matchingMessageDiv,
  optionsLinkContainer,
}) {
  const errorDetailsDiv = document.createElement('div');
  errorDetailsDiv.id = 'error-details';
  errorDetailsDiv.className = 'error-details';

  chrome.storage.sync.get(
    ['slackToken', 'appToken', 'channelName'],
    (result) => {
      const { slackToken, appToken, channelName } = result;
      const errors = [];

      if (!slackToken) {
        errors.push(literals.popup.errorDetails.slackTokenMissing);
      }

      if (!appToken) {
        errors.push(literals.popup.errorDetails.appTokenMissing);
      }

      if (!channelName) {
        errors.push(literals.popup.errorDetails.channelNameMissing);
      }

      if (errors.length === 0) {
        errors.push(literals.popup.errorDetails.configIncomplete);
      }

      errorDetailsDiv.innerHTML = `
      <h3>Configuration Issues:</h3>
      <ul>
        ${errors.map((error) => `<li>${error}</li>`).join('')}
      </ul>
    `;

      const popupContent = document.querySelector('.popup-content');
      const existingErrorDetails = document.getElementById('error-details');

      if (existingErrorDetails) {
        existingErrorDetails.remove();
      }

      if (popupContent) {
        popupContent.appendChild(errorDetailsDiv);
      }

      updateUI({
        statusIcon,
        statusText,
        openOptionsButton,
        slackChannelLink,
        matchingMessageDiv,
        optionsLinkContainer,
        state: MERGE_STATUS.CONFIG_NEEDED,
        message: literals.popup.errorDetails.textConfigNeeded,
      });
    },
  );
}

async function setupSlackChannelLink(slackChannelLink) {
  const { channelId, teamId } = await chrome.storage.local.get([
    'channelId',
    'teamId',
  ]);

  if (channelId && teamId) {
    slackChannelLink.href = `${SLACK_BASE_URL}${teamId}/${channelId}`;
  }
}

async function showMergeStatus({
  statusIcon,
  statusText,
  openOptionsButton,
  slackChannelLink,
  matchingMessageDiv,
  optionsLinkContainer,
}) {
  const { lastKnownMergeState } = await chrome.storage.local.get(
    'lastKnownMergeState',
  );

  if (!lastKnownMergeState?.mergeStatus) {
    showLoadingUI({
      statusIcon,
      statusText,
      openOptionsButton,
      slackChannelLink,
      matchingMessageDiv,
      optionsLinkContainer,
    });
    return;
  }

  const {
    mergeStatus: status,
    lastSlackMessage,
    appStatus,
  } = lastKnownMergeState;

  if (appStatus === APP_STATUS.CHANNEL_NOT_FOUND) {
    updateUI({
      statusIcon,
      statusText,
      openOptionsButton,
      slackChannelLink,
      matchingMessageDiv,
      optionsLinkContainer,
      state: MERGE_STATUS.DISALLOWED,
      message: literals.popup.errorDetails.channelNotFound,
    });
    return;
  }

  const stateUIMap = {
    [MERGE_STATUS.EXCEPTION]: {
      state: MERGE_STATUS.EXCEPTION,
      message: literals.popup.textAllowedWithExceptions,
    },
    [MERGE_STATUS.ALLOWED]: {
      state: MERGE_STATUS.ALLOWED,
      message: literals.popup.textMergeAllowed,
    },
    [MERGE_STATUS.DISALLOWED]: {
      state: MERGE_STATUS.DISALLOWED,
      message: literals.popup.textMergeNotAllowed,
    },
    default: {
      state: MERGE_STATUS.UNKNOWN,
      message: literals.popup.textCouldNotDetermineStatus,
    },
  };

  const { state, message } = stateUIMap[status] ?? stateUIMap.default;

  updateUI({
    statusIcon,
    statusText,
    openOptionsButton,
    slackChannelLink,
    matchingMessageDiv,
    optionsLinkContainer,
    state,
    message,
    matchingMessage: lastSlackMessage,
  });
}

function showLoadingUI({
  statusIcon,
  statusText,
  openOptionsButton,
  slackChannelLink,
  matchingMessageDiv,
  optionsLinkContainer,
}) {
  updateUI({
    statusIcon,
    statusText,
    openOptionsButton,
    slackChannelLink,
    matchingMessageDiv,
    optionsLinkContainer,
    state: MERGE_STATUS.LOADING,
  });
  statusText.textContent = literals.popup.textWaitingMessages;
}

function showErrorUI({
  statusIcon,
  statusText,
  openOptionsButton,
  slackChannelLink,
  matchingMessageDiv,
  optionsLinkContainer,
}) {
  updateUI({
    statusIcon,
    statusText,
    openOptionsButton,
    slackChannelLink,
    matchingMessageDiv,
    optionsLinkContainer,
    state: MERGE_STATUS.DISALLOWED,
    message: literals.popup.errorDetails.processingMessages,
  });
}

function handleBackgroundMessages(request, { featureToggle }) {
  if (request.action === 'updateCountdownDisplay') {
    handleCountdownUpdate(request);
  } else if (request.action === 'countdownCompleted') {
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

async function initializeToggle(featureToggle) {
  await new Promise((resolve) => setTimeout(resolve, 100));
  initializeFeatureToggleState(featureToggle);
}

function setupEventListeners({
  statusIcon,
  statusText,
  openOptionsButton,
  slackChannelLink,
  matchingMessageDiv,
  featureToggle,
  optionsLinkContainer,
}) {
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
    }
  });

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
      loadAndDisplayData({
        statusIcon,
        statusText,
        openOptionsButton,
        slackChannelLink,
        matchingMessageDiv,
        optionsLinkContainer,
      });
    }
  });

  chrome.runtime.onMessage.addListener((request, _sender, _sendResponse) => {
    handleBackgroundMessages(request, { featureToggle });
  });
}
