import { MESSAGE_ACTIONS } from '../common/constants';
import { Logger } from '../common/utils/logger';
import { toErrorType } from '../common/utils/type-helpers';

export async function initializeToggleFeatureStatus(featureToggle: HTMLElement): Promise<void> {
  const toggleSwitch = featureToggle.querySelector('toggle-switch');
  if (!toggleSwitch) return;

  const { featureEnabled = true } = await chrome.storage.local.get('featureEnabled');
  toggleSwitch.setAttribute('checked', featureEnabled ? 'true' : 'false');

  const countdownDisplay = document.createElement('div');
  countdownDisplay.id = 'countdown-display';
  countdownDisplay.style.display = 'none';
  countdownDisplay.style.fontSize = '12px';
  countdownDisplay.style.marginTop = '5px';
  countdownDisplay.style.color = '#666';
  featureToggle.appendChild(countdownDisplay);

  toggleSwitch.addEventListener('change', async (event: Event) => {
    const target = event.target as HTMLInputElement;
    const isChecked = target.checked;

    try {
      await chrome.runtime.sendMessage({
        action: MESSAGE_ACTIONS.FEATURE_TOGGLE_CHANGED,
        payload: { enabled: isChecked },
      });

      if (!isChecked) {
        checkCountdownStatus();
      } else {
        countdownDisplay.style.display = 'none';
      }
    } catch (error) {
      Logger.error(toErrorType(error), 'FeatureToggle');
    }
  });

  chrome.runtime.onMessage.addListener((request, _sender, _sendResponse) => {
    if (request.action === MESSAGE_ACTIONS.UPDATE_COUNTDOWN_DISPLAY) {
      updateCountdownDisplay(request.payload?.timeLeft);
    } else if (request.action === MESSAGE_ACTIONS.COUNTDOWN_COMPLETED) {
      countdownDisplay.style.display = 'none';
      toggleSwitch.setAttribute('checked', 'true');
    }
  });

  await checkCountdownStatus();
}

async function checkCountdownStatus(): Promise<void> {
  try {
    const response = await chrome.runtime.sendMessage({
      action: MESSAGE_ACTIONS.GET_COUNTDOWN_STATUS,
    });

    if (response?.isCountdownActive) {
      updateCountdownDisplay(response.timeLeft);
    }
  } catch (error) {
    Logger.error(toErrorType(error), 'CountdownCheck');
  }
}

function updateCountdownDisplay(timeLeft: number): void {
  const countdownDisplay = document.getElementById('countdown-display');
  if (!countdownDisplay) return;

  if (!timeLeft || timeLeft <= 0) {
    countdownDisplay.style.display = 'none';
    return;
  }

  const minutes = Math.floor(timeLeft / 60000);
  const seconds = Math.floor((timeLeft % 60000) / 1000);

  countdownDisplay.textContent = `Auto-enable in: ${minutes}:${seconds.toString().padStart(2, '0')}`;
  countdownDisplay.style.display = 'block';
}
