import { SLACK_BASE_URL } from './constants.js';
import { literals } from './literals.js';
import './components/toggle-switch/index.js';

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

// Function to update the countdown display in the popup
export function updateCountdownDisplay(timeLeft, countdownElement) {
  if (!countdownElement) return;

  // Verificar primero si la función está deshabilitada
  chrome.storage.local.get(['featureEnabled'], (result) => {
    const isEnabled = result.featureEnabled !== false;

    if (isEnabled || timeLeft <= 0) {
      // Si la función está habilitada o el tiempo ha terminado, ocultar el contador
      countdownElement.style.display = 'none';
      return;
    }

    // Solo mostrar el contador si la función está deshabilitada y hay tiempo restante
    countdownElement.style.display = 'block';
    const minutes = Math.floor(timeLeft / 60000);
    const seconds = Math.floor((timeLeft % 60000) / 1000);
    countdownElement.textContent = `Reactivation in: ${minutes}:${seconds.toString().padStart(2, '0')}`;
  });
}

export function initializeFeatureToggleState(toggleElement) {
  chrome.storage.local.get(['featureEnabled', 'reactivationTime'], (result) => {
    const isEnabled = result.featureEnabled !== false;
    const countdownElement = document.getElementById('countdown-timer');

    if (isEnabled) {
      toggleElement.setAttribute('checked', '');
      // If feature is enabled, hide the countdown
      if (countdownElement) {
        countdownElement.style.display = 'none';
      }
    } else {
      toggleElement.removeAttribute('checked');

      // Check with background script for countdown status
      chrome.runtime.sendMessage(
        { action: 'getCountdownStatus' },
        (response) => {
          if (response && response.isCountdownActive && countdownElement) {
            updateCountdownDisplay(response.timeLeft, countdownElement);
          }
        },
      );
    }
  });
}

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

      const countdownElement = document.getElementById('countdown-timer');
      if (isChecked && countdownElement) {
        // If feature is enabled, hide the countdown
        countdownElement.style.display = 'none';
      }
      // If feature is disabled, the background script will handle starting the countdown
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

  // Listen for countdown updates from background script
  chrome.runtime.onMessage.addListener((request, _sender, _sendResponse) => {
    if (request.action === 'updateCountdownDisplay') {
      // Verificar primero si la función está deshabilitada antes de mostrar el contador
      chrome.storage.local.get(['featureEnabled'], (result) => {
        const isEnabled = result.featureEnabled !== false;
        const countdownElement = document.getElementById('countdown-timer');

        if (!isEnabled && countdownElement) {
          // Solo mostrar el contador si la función está deshabilitada
          updateCountdownDisplay(request.timeLeft, countdownElement);
        } else if (countdownElement) {
          // Si la función está habilitada, asegurarse de que el contador esté oculto
          countdownElement.style.display = 'none';
        }
      });
    } else if (request.action === 'countdownCompleted') {
      const countdownElement = document.getElementById('countdown-timer');
      if (countdownElement) {
        countdownElement.style.display = 'none';
      }
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
