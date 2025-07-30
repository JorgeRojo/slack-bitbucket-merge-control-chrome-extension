import { getCurrentMergeStatusFromMessages } from '@src/modules/background/message-analysis';
import { APP_STATUS, MERGE_STATUS } from '@src/modules/common/constants';

/**
 * Updates the extension icon based on the merge status
 */
export function updateExtensionIcon(status: MERGE_STATUS): boolean {
  let smallIconPath: string, largeIconPath: string;
  switch (status) {
    case MERGE_STATUS.LOADING:
      smallIconPath = 'images/icon16.png';
      largeIconPath = 'images/icon48.png';
      break;
    case MERGE_STATUS.ALLOWED:
      smallIconPath = 'images/icon16_enabled.png';
      largeIconPath = 'images/icon48_enabled.png';
      break;
    case MERGE_STATUS.DISALLOWED:
      smallIconPath = 'images/icon16_disabled.png';
      largeIconPath = 'images/icon48_disabled.png';
      break;
    case MERGE_STATUS.EXCEPTION:
      smallIconPath = 'images/icon16_exception.png';
      largeIconPath = 'images/icon48_exception.png';
      break;
    case MERGE_STATUS.ERROR:
      smallIconPath = 'images/icon16_error.png';
      largeIconPath = 'images/icon48_error.png';
      break;
    default:
      smallIconPath = 'images/icon16.png';
      largeIconPath = 'images/icon48.png';
      break;
  }

  chrome.action.setIcon({
    path: {
      16: smallIconPath,
      48: largeIconPath,
    },
  });

  return true;
}

/**
 * Updates the application status and sets the appropriate icon
 */
export async function updateAppStatus(status: APP_STATUS): Promise<boolean> {
  const { lastKnownMergeState = {} } = await chrome.storage.local.get('lastKnownMergeState');
  await chrome.storage.local.set({
    lastKnownMergeState: {
      ...lastKnownMergeState,
      appStatus: status,
    },
  });

  let iconStatus: MERGE_STATUS;
  switch (status) {
    case APP_STATUS.OK:
      iconStatus = await getCurrentMergeStatusFromMessages();
      break;
    case APP_STATUS.CONFIG_ERROR:
    case APP_STATUS.TOKEN_ERROR:
    case APP_STATUS.WEB_SOCKET_ERROR:
    case APP_STATUS.CHANNEL_NOT_FOUND:
    case APP_STATUS.UNKNOWN_ERROR:
      iconStatus = MERGE_STATUS.ERROR;
      break;
    default:
      iconStatus = MERGE_STATUS.UNKNOWN;
  }

  updateExtensionIcon(iconStatus);

  return true;
}

/**
 * Updates the icon based on the current messages
 */
export async function updateIconBasedOnCurrentMessages(): Promise<void> {
  const iconStatus = await getCurrentMergeStatusFromMessages();
  updateExtensionIcon(iconStatus);
}
