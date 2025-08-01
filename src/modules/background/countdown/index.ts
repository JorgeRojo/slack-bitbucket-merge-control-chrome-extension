import { updateContentScriptMergeState } from '@src/modules/background/bitbucket';
import {
  ERROR_MESSAGES,
  FEATURE_REACTIVATION_TIMEOUT,
  MESSAGE_ACTIONS,
} from '@src/modules/common/constants';
import { Logger } from '@src/modules/common/utils/Logger';
import { toErrorType } from '@src/modules/common/utils/type-helpers';

// Global variable for countdown interval
let countdownInterval: ReturnType<typeof setInterval> | undefined;

/**
 * Stops the countdown
 */
export function stopCountdown(): void {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = undefined;
  }
}

/**
 * Notifies the popup about the countdown status
 */
export async function notifyPopupAboutCountdown(timeLeft: number): Promise<void> {
  try {
    await chrome.runtime.sendMessage({
      action: MESSAGE_ACTIONS.UPDATE_COUNTDOWN_DISPLAY,
      payload: { timeLeft },
    });
  } catch (error) {
    Logger.error(toErrorType(error), 'Background', {
      silentMessages: [ERROR_MESSAGES.RECEIVING_END_NOT_EXIST, ERROR_MESSAGES.CONNECTION_FAILED],
    });
  }
}

/**
 * Reactivates the feature after the countdown ends
 */
export async function reactivateFeature(): Promise<void> {
  await chrome.storage.local.set({ featureEnabled: true });

  try {
    await chrome.runtime.sendMessage({
      action: MESSAGE_ACTIONS.COUNTDOWN_COMPLETED,
      payload: { enabled: true },
    });
  } catch (error) {
    Logger.error(toErrorType(error), 'Background', {
      silentMessages: [ERROR_MESSAGES.RECEIVING_END_NOT_EXIST, ERROR_MESSAGES.CONNECTION_FAILED],
    });
  }

  const { channelName } = await chrome.storage.sync.get('channelName');
  if (channelName) {
    await updateContentScriptMergeState(channelName);
  }
}

/**
 * Starts the countdown to a target time
 */
export async function startCountdown(targetTime: number): Promise<void> {
  stopCountdown();

  const updateCountdown = async () => {
    const currentTime = Date.now();
    const timeLeft = Math.max(0, targetTime - currentTime);

    await notifyPopupAboutCountdown(timeLeft);

    if (timeLeft <= 0) {
      await reactivateFeature();
      stopCountdown();
      return;
    }
  };

  await updateCountdown();
  countdownInterval = setInterval(updateCountdown, 1000);
}

/**
 * Schedules feature reactivation after a specified time
 */
export async function scheduleFeatureReactivation(): Promise<void> {
  const reactivationTime = Date.now() + FEATURE_REACTIVATION_TIMEOUT;
  await chrome.storage.local.set({ reactivationTime });
  await startCountdown(reactivationTime);
}

/**
 * Checks if there is a scheduled reactivation and starts it if necessary
 */
export async function checkScheduledReactivation(): Promise<void> {
  const { reactivationTime, featureEnabled } = (await chrome.storage.local.get([
    'reactivationTime',
    'featureEnabled',
  ])) as { reactivationTime?: number; featureEnabled?: boolean };

  if (featureEnabled === false && reactivationTime) {
    const currentTime = Date.now();
    if (reactivationTime > currentTime) {
      await startCountdown(reactivationTime);
    } else {
      await reactivateFeature();
    }
  }
}
