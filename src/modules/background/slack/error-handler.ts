import { updateAppStatus } from '@src/modules/background/app-state';
import { APP_STATUS, ERROR_MESSAGES } from '@src/modules/common/constants';

/**
 * Handles errors from Slack API calls
 */
export async function handleSlackApiError(error: Error | unknown): Promise<void> {
  const errorMessage = error instanceof Error ? error.message : String(error);

  if (
    errorMessage.includes(ERROR_MESSAGES.CHANNEL_NOT_FOUND) ||
    errorMessage.includes(ERROR_MESSAGES.NOT_IN_CHANNEL)
  ) {
    await updateAppStatus(APP_STATUS.CHANNEL_NOT_FOUND);
    await chrome.storage.local.set({
      channelId: null,
    });
  } else if (
    errorMessage.includes(ERROR_MESSAGES.INVALID_AUTH) ||
    errorMessage.includes(ERROR_MESSAGES.TOKEN_REVOKED)
  ) {
    await updateAppStatus(APP_STATUS.TOKEN_ERROR);
  } else {
    await updateAppStatus(APP_STATUS.UNKNOWN_ERROR);
  }
}
