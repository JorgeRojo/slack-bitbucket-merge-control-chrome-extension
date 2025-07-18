import { SLACK_BASE_URL } from './constants.js';
import { literals } from './literals.js';
import './components/toggle-switch/index.js';

// Inicialización cuando el DOM está listo
document.addEventListener('DOMContentLoaded', async () => {
  const uiElements = {
    statusIcon: document.getElementById('status-icon'),
    statusText: document.getElementById('status-text'),
    openOptionsButton: document.getElementById('open-options'),
    slackChannelLink: document.getElementById('slack-channel-link'),
    matchingMessageDiv: document.getElementById('matching-message'),
    featureToggle: document.getElementById('feature-toggle'),
  };

  const {
    statusIcon,
    statusText,
    openOptionsButton,
    slackChannelLink,
    matchingMessageDiv,
    featureToggle,
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
  });
});

/**
 * Updates the UI elements based on the current merge status
 * @param {Object} params - UI update parameters
 * @param {HTMLElement} params.statusIcon - The status icon element
 * @param {HTMLElement} params.statusText - The status text element
 * @param {HTMLElement} params.openOptionsButton - The options button element
 * @param {HTMLElement} params.slackChannelLink - The Slack channel link element
 * @param {HTMLElement} params.matchingMessageDiv - The matching message div element
 * @param {string} params.state - The current merge state ('allowed', 'disallowed', 'exception', 'config_needed', 'unknown')
 * @param {string} params.message - The message to display
 * @param {Object} [params.matchingMessage=null] - The matching Slack message object
 */
function updateUI({
  statusIcon,
  statusText,
  openOptionsButton,
  slackChannelLink,
  matchingMessageDiv,
  state,
  message,
  matchingMessage = null,
}) {
  statusIcon.className = state;
  statusText.className = state;

  openOptionsButton.style.display = 'none';
  slackChannelLink.style.display = 'none';
  matchingMessageDiv.style.display = 'none';

  updateContentByState({
    statusIcon,
    statusText,
    openOptionsButton,
    slackChannelLink,
    state,
    message,
  });

  if (matchingMessage) {
    matchingMessageDiv.textContent = `${literals.popup.textMatchingMessagePrefix}${matchingMessage.text}"`;
    matchingMessageDiv.style.display = 'block';
  }
}

/**
 * Actualiza el contenido de los elementos según el estado
 * @param {Object} params - Parámetros para actualizar el contenido
 */
function updateContentByState({
  statusIcon,
  statusText,
  openOptionsButton,
  slackChannelLink,
  state,
  message,
}) {
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
      statusText.textContent = message ?? literals.popup.textCouldNotDetermine;
      break;
  }
}

/**
 * Manages the countdown timer element display and content
 * @param {Object} options - Configuration options
 * @param {boolean} options.show - Whether to show or hide the countdown element
 * @param {number} [options.timeLeft] - Time left in milliseconds (required when show is true)
 * @returns {HTMLElement|null} - The countdown element or null if not found
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
 * Updates the text content of the countdown element
 * @param {HTMLElement} element - The countdown element
 * @param {number} timeLeft - Time left in milliseconds
 */
function updateCountdownText(element, timeLeft) {
  const minutes = Math.floor(timeLeft / 60000);
  const seconds = Math.floor((timeLeft % 60000) / 1000);
  element.textContent = `Reactivation in: ${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Updates the countdown display based on the current feature state and time left
 * @param {number} timeLeft - Time left in milliseconds
 */
function updateCountdownDisplay(timeLeft) {
  chrome.storage.local.get(['featureEnabled'], (result) => {
    const isEnabled = result.featureEnabled !== false;

    if (isEnabled || timeLeft <= 0) {
      if (typeof global !== 'undefined' && global.manageCountdownElement) {
        global.manageCountdownElement({ show: false });
      } else {
        manageCountdownElement({ show: false });
      }
      return;
    }

    if (typeof global !== 'undefined' && global.manageCountdownElement) {
      global.manageCountdownElement({ show: true, timeLeft });
    } else {
      manageCountdownElement({ show: true, timeLeft });
    }
  });
}

/**
 * Initializes the feature toggle state based on stored settings
 * @param {HTMLElement} toggleElement - The toggle element to initialize
 */
function initializeFeatureToggleState(toggleElement) {
  chrome.storage.local.get(['featureEnabled', 'reactivationTime'], (result) => {
    const isEnabled = result.featureEnabled !== false;

    if (isEnabled) {
      toggleElement.setAttribute('checked', '');
      if (typeof global !== 'undefined' && global.manageCountdownElement) {
        global.manageCountdownElement({ show: false });
      } else {
        manageCountdownElement({ show: false });
      }
      return;
    }

    toggleElement.removeAttribute('checked');
    checkCountdownStatus();
  });
}

/**
 * Checks the countdown status and updates the display
 */
function checkCountdownStatus() {
  chrome.runtime.sendMessage({ action: 'getCountdownStatus' }, (response) => {
    if (!response?.isCountdownActive) return;

    updateCountdownDisplay(response.timeLeft);
  });
}

/**
 * Loads and displays data from storage in the popup UI
 * @param {Object} params - UI elements and configuration
 * @param {HTMLElement} params.statusIcon - The status icon element
 * @param {HTMLElement} params.statusText - The status text element
 * @param {HTMLElement} params.openOptionsButton - The options button element
 * @param {HTMLElement} params.slackChannelLink - The Slack channel link element
 * @param {HTMLElement} params.matchingMessageDiv - The matching message div element
 * @returns {Promise<void>}
 */
async function loadAndDisplayData({
  statusIcon,
  statusText,
  openOptionsButton,
  slackChannelLink,
  matchingMessageDiv,
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
    });
  } catch (error) {
    console.error('Error processing messages:', error);
    showErrorUI({
      statusIcon,
      statusText,
      openOptionsButton,
      slackChannelLink,
      matchingMessageDiv,
    });
  }
}

/**
 * Muestra la UI de configuración necesaria
 * @param {Object} elements - Elementos de la UI
 */
function showConfigNeededUI({
  statusIcon,
  statusText,
  openOptionsButton,
  slackChannelLink,
  matchingMessageDiv,
}) {
  updateUI({
    statusIcon,
    statusText,
    openOptionsButton,
    slackChannelLink,
    matchingMessageDiv,
    state: 'config_needed',
    message: literals.popup.textConfigNeeded,
  });
}

/**
 * Configura el enlace al canal de Slack
 * @param {HTMLElement} slackChannelLink - Elemento de enlace al canal
 */
async function setupSlackChannelLink(slackChannelLink) {
  const { channelId, teamId } = await chrome.storage.local.get([
    'channelId',
    'teamId',
  ]);

  if (channelId && teamId) {
    slackChannelLink.href = `${SLACK_BASE_URL}${teamId}/${channelId}`;
  }
}

/**
 * Muestra el estado de fusión
 * @param {Object} elements - Elementos de la UI
 */
async function showMergeStatus({
  statusIcon,
  statusText,
  openOptionsButton,
  slackChannelLink,
  matchingMessageDiv,
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
    });
    return;
  }

  const { mergeStatus: status, lastSlackMessage } = lastKnownMergeState;

  const stateUIMap = {
    exception: {
      state: 'exception',
      message: literals.popup.textAllowedWithExceptions,
    },
    allowed: {
      state: 'allowed',
      message: literals.popup.textMergeAllowed,
    },
    disallowed: {
      state: 'disallowed',
      message: literals.popup.textMergeNotAllowed,
    },
    default: {
      state: 'unknown',
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
    state,
    message,
    matchingMessage: lastSlackMessage,
  });
}

/**
 * Muestra la UI de carga
 * @param {Object} elements - Elementos de la UI
 */
function showLoadingUI({
  statusIcon,
  statusText,
  openOptionsButton,
  slackChannelLink,
  matchingMessageDiv,
}) {
  updateUI({
    statusIcon,
    statusText,
    openOptionsButton,
    slackChannelLink,
    matchingMessageDiv,
    state: 'loading',
  });
  statusText.textContent = literals.popup.textWaitingMessages;
}

/**
 * Muestra la UI de error
 * @param {Object} elements - Elementos de la UI
 */
function showErrorUI({
  statusIcon,
  statusText,
  openOptionsButton,
  slackChannelLink,
  matchingMessageDiv,
}) {
  updateUI({
    statusIcon,
    statusText,
    openOptionsButton,
    slackChannelLink,
    matchingMessageDiv,
    state: 'disallowed',
    message: literals.popup.textErrorProcessingMessages,
  });
}

/**
 * Maneja los mensajes recibidos del script de fondo
 * @param {Object} request - Solicitud recibida
 * @param {Object} uiElements - Elementos de la UI
 */
function handleBackgroundMessages(request, { featureToggle }) {
  if (request.action === 'updateCountdownDisplay') {
    handleCountdownUpdate(request);
  } else if (request.action === 'countdownCompleted') {
    handleCountdownCompleted(featureToggle);
  }
}

/**
 * Maneja las actualizaciones del contador
 * @param {Object} request - Solicitud recibida
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
 * Maneja la finalización del contador
 * @param {HTMLElement} featureToggle - Elemento de toggle
 */
function handleCountdownCompleted(featureToggle) {
  manageCountdownElement({ show: false });
  featureToggle.setAttribute('checked', '');
}

/**
 * Inicializa el toggle con un pequeño retraso
 * @param {HTMLElement} featureToggle - Elemento de toggle
 */
async function initializeToggle(featureToggle) {
  await new Promise((resolve) => setTimeout(resolve, 100));
  initializeFeatureToggleState(featureToggle);
}

/**
 * Configura los event listeners
 * @param {Object} uiElements - Elementos de la UI
 */
function setupEventListeners({
  statusIcon,
  statusText,
  openOptionsButton,
  slackChannelLink,
  matchingMessageDiv,
  featureToggle,
}) {
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
      });
    }
  });

  chrome.runtime.onMessage.addListener((request, _sender, _sendResponse) => {
    handleBackgroundMessages(request, { featureToggle });
  });
}

// Expose functions for testing only when in test environment
if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
  window.popupTestExports = {
    updateUI,
    manageCountdownElement,
    updateCountdownDisplay,
    initializeFeatureToggleState,
    loadAndDisplayData,
  };
}
