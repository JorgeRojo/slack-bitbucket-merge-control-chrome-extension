import { Logger } from './utils/logger.js';
import { SLACK_BASE_URL, MERGE_STATUS, APP_STATUS } from './constants.js';
import { literals } from './literals.js';
import './components/toggle-switch/index.js';
import { initializeToggleFeatureStatus } from './popup-toggle-feature-status.js';

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

  setupEventListeners({
    statusIcon,
    statusText,
    openOptionsButton,
    slackChannelLink,
    matchingMessageDiv,
    optionsLinkContainer,
  });

  await loadAndDisplayData({
    statusIcon,
    statusText,
    openOptionsButton,
    slackChannelLink,
    matchingMessageDiv,
    optionsLinkContainer,
  });

  await initializeToggleFeatureStatus(featureToggle);
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

async function loadAndDisplayData({
  statusIcon,
  statusText,
  openOptionsButton,
  slackChannelLink,
  matchingMessageDiv,
  optionsLinkContainer,
}) {
  try {
    const { slackToken, appToken, channelName } = await chrome.storage.sync.get([
      'slackToken',
      'appToken',
      'channelName',
    ]);

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

  chrome.storage.sync.get(['slackToken', 'appToken', 'channelName'], result => {
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
        ${errors.map(error => `<li>${error}</li>`).join('')}
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
  });
}

async function setupSlackChannelLink(slackChannelLink) {
  const { channelId, teamId } = await chrome.storage.local.get(['channelId', 'teamId']);

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
  const { lastKnownMergeState } = await chrome.storage.local.get('lastKnownMergeState');

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

  const { mergeStatus: status, lastSlackMessage, appStatus } = lastKnownMergeState;

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

function setupEventListeners({
  statusIcon,
  statusText,
  openOptionsButton,
  slackChannelLink,
  matchingMessageDiv,
  optionsLinkContainer,
}) {
  openOptionsButton.addEventListener('click', () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL('options.html'));
    }
  });

  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && (changes.lastKnownMergeState || changes.lastMatchingMessage)) {
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
}
