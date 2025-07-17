import { SLACK_BASE_URL } from './constants.js';
import { literals } from './literals.js';

document.addEventListener('DOMContentLoaded', async () => {
  const statusIcon = document.getElementById('status-icon');
  const statusText = document.getElementById('status-text');
  const openOptionsButton = document.getElementById('open-options');
  const slackChannelLink = document.getElementById('slack-channel-link');
  const matchingMessageDiv = document.getElementById('matching-message');

  function updateUI(state, message, matchingMessage = null) {
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
        statusText.textContent =
          message || literals.popup.textCouldNotDetermine;
        break;
    }

    if (matchingMessage) {
      matchingMessageDiv.textContent = `${literals.popup.textMatchingMessagePrefix}${matchingMessage.text}"`;
      matchingMessageDiv.style.display = 'block';
    }
  }

  async function loadAndDisplayData() {
    try {
      const { slackToken, appToken, channelName } =
        await chrome.storage.sync.get([
          'slackToken',
          'appToken',
          'channelName',
        ]);

      const { channelId, teamId } = await chrome.storage.local.get([
        'channelId',
        'teamId',
      ]);

      if (!slackToken || !appToken || !channelName) {
        updateUI('config_needed', literals.popup.textConfigNeeded);
        return;
      }

      if (channelId && teamId) {
        slackChannelLink.href = `${SLACK_BASE_URL}${teamId}/${channelId}`;
      }

      const { lastKnownMergeState } = await chrome.storage.local.get(
        'lastKnownMergeState',
      );

      if (!lastKnownMergeState || !lastKnownMergeState.mergeStatus) {
        updateUI('loading');
        statusText.textContent = literals.popup.textWaitingMessages;
        return;
      }

      const status = lastKnownMergeState.mergeStatus;
      const lastSlackMessage = lastKnownMergeState.lastSlackMessage;

      if (status === 'exception') {
        updateUI(
          'exception',
          literals.popup.textAllowedWithExceptions,
          lastSlackMessage,
        );
      } else if (status === 'allowed') {
        updateUI('allowed', literals.popup.textMergeAllowed, lastSlackMessage);
      } else if (status === 'disallowed') {
        updateUI(
          'disallowed',
          literals.popup.textMergeNotAllowed,
          lastSlackMessage,
        );
      } else {
        updateUI('unknown', literals.popup.textCouldNotDetermineStatus);
      }
    } catch (error) {
      console.error('Error processing messages:', error);
      updateUI('disallowed', literals.popup.textErrorProcessingMessages);
    }
  }

  openOptionsButton.addEventListener('click', () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL('options.html'));
    }
  });

  // Escuchar cambios en el storage para refrescar el popup
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (
      namespace === 'local' &&
      (changes.lastKnownMergeState || changes.lastMatchingMessage)
    ) {
      loadAndDisplayData();
    }
  });

  // Cargar datos inicialmente
  await loadAndDisplayData();
});
