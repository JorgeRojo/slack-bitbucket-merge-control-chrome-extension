import { Logger } from './utils/logger';
import { SLACK_BASE_URL, MERGE_STATUS, APP_STATUS } from './constants';
import { literals } from './literals';
import './components/toggle-switch/index';
import { initializeToggleFeatureStatus } from './popup-toggle-feature-status';
import { ProcessedMessage, MergeStatusInfo, AppStatusInfo } from './types/index';
import { toErrorType } from './utils/type-helpers';

interface UIElements {
  statusIcon: HTMLElement | null;
  statusText: HTMLElement | null;
  openOptionsButton: HTMLElement | null;
  slackChannelLink: HTMLAnchorElement | null;
  matchingMessageDiv: HTMLElement | null;
  featureToggle?: HTMLElement | null;
  optionsLinkContainer: HTMLElement | null;
}

interface UpdateUIParams extends UIElements {
  state: MERGE_STATUS;
  message?: string | null;
  matchingMessage?: ProcessedMessage | null;
}

interface LastKnownMergeState {
  mergeStatus: MERGE_STATUS;
  lastSlackMessage?: ProcessedMessage;
  appStatus?: APP_STATUS;
}

document.addEventListener('DOMContentLoaded', async () => {
  const uiElements: UIElements = {
    statusIcon: document.getElementById('status-icon'),
    statusText: document.getElementById('status-text'),
    openOptionsButton: document.getElementById('open-options'),
    slackChannelLink: document.getElementById('slack-channel-link') as HTMLAnchorElement,
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

  if (featureToggle) {
    await initializeToggleFeatureStatus(featureToggle);
  }
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
}: UpdateUIParams): void {
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
}: Omit<UpdateUIParams, 'matchingMessageDiv' | 'matchingMessage'>): void {
  if (!statusIcon || !statusText) return;

  switch (state) {
    case MERGE_STATUS.ALLOWED:
      statusIcon.textContent = literals.popup.emojiAllowed;
      statusText.textContent = message || '';
      break;
    case MERGE_STATUS.DISALLOWED:
      statusIcon.textContent = literals.popup.emojiDisallowed;
      statusText.textContent = message || '';
      break;
    case MERGE_STATUS.EXCEPTION:
      statusIcon.textContent = literals.popup.emojiException;
      statusText.textContent = message || '';
      if (slackChannelLink) {
        slackChannelLink.style.display = 'block';
      }
      break;
    case MERGE_STATUS.CONFIG_NEEDED:
      statusIcon.textContent = literals.popup.emojiUnknown;
      statusText.textContent = message || '';
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
}: Omit<UIElements, 'featureToggle'>): Promise<void> {
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
    Logger.error(toErrorType(error), 'PopupUI', {
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
}: Omit<UIElements, 'featureToggle'>): void {
  const errorDetailsDiv = document.createElement('div');
  errorDetailsDiv.id = 'error-details';
  errorDetailsDiv.className = 'error-details';

  chrome.storage.sync.get(['slackToken', 'appToken', 'channelName'], result => {
    const { slackToken, appToken, channelName } = result;
    const errors: string[] = [];

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

async function setupSlackChannelLink(slackChannelLink: HTMLAnchorElement | null): Promise<void> {
  if (!slackChannelLink) return;

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
}: Omit<UIElements, 'featureToggle'>): Promise<void> {
  const { lastKnownMergeState } = (await chrome.storage.local.get('lastKnownMergeState')) as {
    lastKnownMergeState?: LastKnownMergeState;
  };

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

  const stateUIMap: Record<string, { state: MERGE_STATUS; message: string }> = {
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
}: Omit<UIElements, 'featureToggle'>): void {
  updateUI({
    statusIcon,
    statusText,
    openOptionsButton,
    slackChannelLink,
    matchingMessageDiv,
    optionsLinkContainer,
    state: MERGE_STATUS.LOADING,
  });

  if (statusText) {
    statusText.textContent = literals.popup.textWaitingMessages;
  }
}

function showErrorUI({
  statusIcon,
  statusText,
  openOptionsButton,
  slackChannelLink,
  matchingMessageDiv,
  optionsLinkContainer,
}: Omit<UIElements, 'featureToggle'>): void {
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
}: Omit<UIElements, 'featureToggle'>): void {
  if (!openOptionsButton) return;

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
