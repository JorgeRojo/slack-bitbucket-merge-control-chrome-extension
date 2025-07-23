import ToggleSwitch from '../common/components/toggle-switch/toggle-switch';
import { MESSAGE_ACTIONS } from '../common/constants';
import { Logger } from '../common/utils/logger';
import { toErrorType } from '../common/utils/type-helpers';

interface CountdownResponse {
  isCountdownActive: boolean;
  timeLeft: number;
}

export async function initializeToggleFeatureStatus(
  toggleSwitch: ToggleSwitch | null
): Promise<void> {
  const countdownDisplay = document.getElementById('countdown-display');

  if (!toggleSwitch || !countdownDisplay) return;

  const { featureEnabled = true } = await chrome.storage.local.get('featureEnabled');
  toggleSwitch.setAttribute('checked', featureEnabled ? 'true' : 'false');

  countdownDisplay.style.display = 'none';

  toggleSwitch.addEventListener('toggle', async event => {
    const isChecked = event.detail.checked;

    try {
      // Actualizar inmediatamente la visualización del contador
      if (isChecked) {
        countdownDisplay.style.display = 'none';
      }

      await chrome.runtime.sendMessage({
        action: MESSAGE_ACTIONS.FEATURE_TOGGLE_CHANGED,
        payload: { enabled: isChecked },
      });

      if (!isChecked) {
        await checkCountdownStatus(countdownDisplay);
      }
    } catch (error) {
      Logger.error(toErrorType(error), 'toggleSwitch', {
        silentMessages: ['The message port closed before a response was received'],
      });
    }
  });

  chrome.runtime.onMessage.addListener(request => {
    if (request.action === MESSAGE_ACTIONS.UPDATE_COUNTDOWN_DISPLAY) {
      updateCountdownDisplay(countdownDisplay, request.payload?.timeLeft);
    } else if (request.action === MESSAGE_ACTIONS.COUNTDOWN_COMPLETED) {
      countdownDisplay.style.display = 'none';
      toggleSwitch.setAttribute('checked', 'true');
    }
  });

  await checkCountdownStatus(countdownDisplay);
}

async function checkCountdownStatus(countdownDisplay: HTMLElement): Promise<void> {
  try {
    const response = (await chrome.runtime.sendMessage({
      action: MESSAGE_ACTIONS.GET_COUNTDOWN_STATUS,
    })) as CountdownResponse | undefined;

    if (!response?.isCountdownActive) return;

    updateCountdownDisplay(countdownDisplay, response.timeLeft);
  } catch (error) {
    Logger.error(toErrorType(error), 'Popup', {
      silentMessages: ['The message port closed before a response was received'],
    });
  }
}

function updateCountdownDisplay(countdownDisplay: HTMLElement, timeLeft: number): void {
  if (!timeLeft || timeLeft <= 0) {
    countdownDisplay.style.display = 'none';
    return;
  }

  const minutes = Math.floor(timeLeft / 60000);
  const seconds = Math.floor((timeLeft % 60000) / 1000);

  countdownDisplay.textContent = `Auto-enable in: ${minutes}:${seconds.toString().padStart(2, '0')}`;
  countdownDisplay.style.display = 'block';
}
