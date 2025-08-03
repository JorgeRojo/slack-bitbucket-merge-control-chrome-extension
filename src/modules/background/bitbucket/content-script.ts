import { getBitbucketTabId } from '@src/modules/background/websocket';
import {
  CONTENT_SCRIPT_ID,
  ERROR_MESSAGES,
  MERGE_STATUS,
  MESSAGE_ACTIONS,
} from '@src/modules/common/constants';
import { ProcessedMessage } from '@src/modules/common/types/app';
import { Logger } from '@src/modules/common/utils/Logger';
import { toErrorType } from '@src/modules/common/utils/type-helpers';

/**
 * Registers the content script for Bitbucket
 */
export async function registerBitbucketContentScript(): Promise<void> {
  const { bitbucketUrl } = await chrome.storage.sync.get('bitbucketUrl');

  Logger.log('Registering content script for URL:', bitbucketUrl);

  try {
    const existingScripts = await chrome.scripting.getRegisteredContentScripts();
    const scriptExists = existingScripts.some(script => script.id === CONTENT_SCRIPT_ID);

    if (scriptExists) {
      await chrome.scripting.unregisterContentScripts({
        ids: [CONTENT_SCRIPT_ID],
      });
    }
  } catch (error) {
    Logger.error(toErrorType(error), ERROR_MESSAGES.SCRIPT_VERIFICATION);
  }

  if (bitbucketUrl) {
    try {
      await chrome.scripting.registerContentScripts([
        {
          id: CONTENT_SCRIPT_ID,
          matches: [bitbucketUrl],
          js: ['content.js'],
          runAt: 'document_idle',
        },
      ]);
      Logger.log('Content script registered successfully for:', bitbucketUrl);
    } catch (error) {
      Logger.error(toErrorType(error), ERROR_MESSAGES.SCRIPT_REGISTRATION);
    }
  }
}

/**
 * Updates the merge button based on the last known state
 */
export function updateMergeButtonFromLastKnownMergeState(): void {
  chrome.storage.local.get(
    ['lastKnownMergeState', 'featureEnabled'],
    async (result: {
      lastKnownMergeState?: {
        isMergeDisabled?: boolean;
        lastSlackMessage?: ProcessedMessage;
        channelName?: string;
        mergeStatus?: keyof typeof MERGE_STATUS;
      };
      featureEnabled?: boolean;
    }) => {
      if (result.lastKnownMergeState) {
        const { isMergeDisabled, lastSlackMessage, channelName, mergeStatus } =
          result.lastKnownMergeState;

        const finalIsMergeDisabled = result.featureEnabled === false ? false : isMergeDisabled;
        const finalMergeStatus =
          result.featureEnabled === false ? MERGE_STATUS.ALLOWED : mergeStatus;

        try {
          const bitbucketTabId = getBitbucketTabId();
          if (bitbucketTabId) {
            await chrome.tabs.sendMessage(bitbucketTabId, {
              action: MESSAGE_ACTIONS.UPDATE_MERGE_BUTTON,
              payload: {
                lastSlackMessage: lastSlackMessage,
                channelName: channelName,
                isMergeDisabled: finalIsMergeDisabled,
                mergeStatus: finalMergeStatus,
                featureEnabled: result.featureEnabled !== false,
              },
            });
          }
        } catch (error) {
          Logger.error(toErrorType(error), 'Background', {
            silentMessages: [
              ERROR_MESSAGES.RECEIVING_END_NOT_EXIST,
              ERROR_MESSAGES.CONNECTION_FAILED,
            ],
          });
          return;
        }
      }
    }
  );
}
