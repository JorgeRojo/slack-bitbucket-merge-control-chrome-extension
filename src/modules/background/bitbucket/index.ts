import { getPhrasesFromStorage } from '@src/modules/background/config';
import { determineMergeStatus } from '@src/modules/background/message-analysis';
import {
  APP_STATUS,
  ERROR_MESSAGES,
  MERGE_STATUS,
  MESSAGE_ACTIONS,
} from '@src/modules/common/constants';
import {
  MergeDecisionSource,
  MergeStatusInfo,
  ProcessedMessage,
} from '@src/modules/common/types/app';
import { Logger } from '@src/modules/common/utils/Logger';
import { toErrorType } from '@src/modules/common/utils/type-helpers';

import {
  registerBitbucketContentScript,
  updateMergeButtonFromLastKnownMergeState,
} from './content-script';

/**
 * Updates the merge state in content scripts
 */
export async function updateContentScriptMergeState(
  channelName: string,
  bitbucketTabId?: number | null
): Promise<void> {
  const {
    messages: currentMessages = [],
    featureEnabled,
    lastKnownMergeState = { mergeStatus: MERGE_STATUS.UNKNOWN },
    canvasContent,
  } = (await chrome.storage.local.get([
    'messages',
    'featureEnabled',
    'lastKnownMergeState',
    'canvasContent',
  ])) as {
    messages?: ProcessedMessage[];
    featureEnabled?: boolean;
    lastKnownMergeState?: MergeStatusInfo;
    canvasContent?: string | null;
  };

  const appStatus = lastKnownMergeState?.appStatus as APP_STATUS | undefined;

  const lastSlackMessage =
    currentMessages && currentMessages.length > 0 ? currentMessages[0] : null;

  const { currentAllowedPhrases, currentDisallowedPhrases, currentExceptionPhrases } =
    await getPhrasesFromStorage();

  let mergeStatusForContentScript: MERGE_STATUS = MERGE_STATUS.UNKNOWN;
  let matchingMessageForContentScript: ProcessedMessage | null = null;
  let decisionSource: MergeDecisionSource = 'message';
  let determinedCanvasContent: string | null = null;

  const {
    status,
    message,
    source,
    canvasContent: newCanvasContent,
  } = determineMergeStatus({
    messages: currentMessages,
    allowedPhrases: currentAllowedPhrases,
    disallowedPhrases: currentDisallowedPhrases,
    exceptionPhrases: currentExceptionPhrases,
    canvasContent: canvasContent,
  });
  mergeStatusForContentScript = status;
  matchingMessageForContentScript = message;
  decisionSource = source;
  determinedCanvasContent = newCanvasContent === undefined ? null : newCanvasContent;

  const errorStatuses: APP_STATUS[] = [
    APP_STATUS.UNKNOWN_ERROR,
    APP_STATUS.CONFIG_ERROR,
    APP_STATUS.TOKEN_ERROR,
    APP_STATUS.WEB_SOCKET_ERROR,
    APP_STATUS.CHANNEL_NOT_FOUND,
  ];

  if (appStatus && errorStatuses.includes(appStatus)) {
    mergeStatusForContentScript = MERGE_STATUS.ERROR;
  }

  await chrome.storage.local.set({
    lastKnownMergeState: {
      isMergeDisabled:
        mergeStatusForContentScript === MERGE_STATUS.DISALLOWED ||
        mergeStatusForContentScript === MERGE_STATUS.EXCEPTION,
      mergeStatus: mergeStatusForContentScript,
      lastSlackMessage: matchingMessageForContentScript,
      channelName: channelName,
      featureEnabled: featureEnabled, // Corrected: should be featureEnabled directly
      appStatus: appStatus,
      source: decisionSource,
      canvasContent: determinedCanvasContent === undefined ? null : determinedCanvasContent,
    } as MergeStatusInfo,
  });

  try {
    await chrome.runtime.sendMessage({
      action: MESSAGE_ACTIONS.UPDATE_MESSAGES,
    });
  } catch (error) {
    Logger.error(toErrorType(error), 'Background', {
      silentMessages: [ERROR_MESSAGES.RECEIVING_END_NOT_EXIST, ERROR_MESSAGES.CONNECTION_FAILED],
    });
  }

  if (bitbucketTabId) {
    try {
      const effectiveMergeStatus =
        featureEnabled === false ? MERGE_STATUS.ALLOWED : mergeStatusForContentScript;
      const effectiveIsMergeDisabled =
        featureEnabled === false
          ? false
          : mergeStatusForContentScript === MERGE_STATUS.DISALLOWED ||
            mergeStatusForContentScript === MERGE_STATUS.EXCEPTION;

      await chrome.tabs.sendMessage(bitbucketTabId, {
        action: MESSAGE_ACTIONS.UPDATE_MERGE_BUTTON,
        payload: {
          lastSlackMessage: lastSlackMessage,
          channelName: channelName,
          isMergeDisabled: effectiveIsMergeDisabled,
          mergeStatus: effectiveMergeStatus,
          featureEnabled: featureEnabled,
        },
      });
    } catch (error) {
      Logger.error(toErrorType(error), 'Background', {
        silentMessages: [ERROR_MESSAGES.RECEIVING_END_NOT_EXIST, ERROR_MESSAGES.CONNECTION_FAILED],
      });
    }
  }
}

// Export functions from content-script module
export { registerBitbucketContentScript, updateMergeButtonFromLastKnownMergeState };
