import { updateAppStatus, updateExtensionIcon } from '@src/modules/background/app-state';
import { updateContentScriptMergeState } from '@src/modules/background/bitbucket';
import { updateMergeButtonFromLastKnownMergeState } from '@src/modules/background/bitbucket/content-script';
import { scheduleFeatureReactivation, stopCountdown } from '@src/modules/background/countdown';
import {
  fetchAndStoreMessages,
  handleSlackApiError,
  resolveChannelId,
} from '@src/modules/background/slack';
import { closeWebSocket, connectToSlackSocketMode } from '@src/modules/background/websocket';
import {
  APP_STATUS,
  DEFAULT_ALLOWED_PHRASES,
  DEFAULT_DISALLOWED_PHRASES,
  DEFAULT_EXCEPTION_PHRASES,
  ERROR_MESSAGES,
  MERGE_STATUS,
  MESSAGE_ACTIONS,
} from '@src/modules/common/constants';
import { ChromeRuntimeMessage } from '@src/modules/common/types/chrome';
import { Logger } from '@src/modules/common/utils/Logger';
import { toErrorType } from '@src/modules/common/utils/type-helpers';

/**
 * Manejadores de mensajes para las acciones de la extensión
 */
export const messageHandlers: Record<
  string,
  (
    request: ChromeRuntimeMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void
  ) => any
> = {
  [MESSAGE_ACTIONS.GET_DEFAULT_PHRASES]: (_request, _sender, sendResponse) => {
    sendResponse({
      defaultAllowedPhrases: DEFAULT_ALLOWED_PHRASES,
      defaultDisallowedPhrases: DEFAULT_DISALLOWED_PHRASES,
      defaultExceptionPhrases: DEFAULT_EXCEPTION_PHRASES,
    });
    return true;
  },

  [MESSAGE_ACTIONS.FETCH_NEW_MESSAGES]: (request, _sender, sendResponse) => {
    (async () => {
      try {
        const { slackToken, channelName } = (await chrome.storage.sync.get([
          'slackToken',
          'channelName',
        ])) as { slackToken?: string; channelName?: string };

        const targetChannelName = request?.payload?.channelName || channelName;

        if (slackToken && targetChannelName) {
          try {
            updateExtensionIcon(MERGE_STATUS.LOADING);

            await chrome.storage.local.set({ lastMatchingMessage: null });

            const channelId = await resolveChannelId(slackToken, targetChannelName);

            await updateAppStatus(APP_STATUS.OK);
            await chrome.storage.local.set({
              channelId: channelId,
            });

            await fetchAndStoreMessages(slackToken, channelId);

            await updateContentScriptMergeState(targetChannelName);

            sendResponse({ success: true });
          } catch (error) {
            Logger.error(toErrorType(error), ERROR_MESSAGES.FETCHING_MESSAGES);
            await handleSlackApiError(error);

            if (request?.payload?.channelName && !request?.payload?.skipErrorNotification) {
              try {
                await chrome.runtime.sendMessage({
                  action: MESSAGE_ACTIONS.CHANNEL_CHANGE_ERROR,
                  payload: { error: error instanceof Error ? error.message : String(error) },
                });
              } catch (sendError) {
                Logger.error(toErrorType(sendError), 'Background', {
                  silentMessages: [
                    ERROR_MESSAGES.RECEIVING_END_NOT_EXIST,
                    ERROR_MESSAGES.CONNECTION_FAILED,
                  ],
                });
              }
            }

            sendResponse({
              success: false,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        } else {
          await updateAppStatus(APP_STATUS.CONFIG_ERROR);
          sendResponse({ success: false, error: 'Missing slackToken or channelName' });
        }
      } catch (error) {
        Logger.error(toErrorType(error), 'Background');
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })();
    return true;
  },

  [MESSAGE_ACTIONS.RECONNECT_SLACK]: (_request, _sender, sendResponse) => {
    (async () => {
      try {
        const { lastKnownMergeState = {} } = (await chrome.storage.local.get(
          'lastKnownMergeState'
        )) as { lastKnownMergeState?: Record<string, any> };

        const appStatus = lastKnownMergeState?.appStatus as APP_STATUS | undefined;

        closeWebSocket();

        if (!appStatus || appStatus === APP_STATUS.OK) {
          updateExtensionIcon(MERGE_STATUS.LOADING);
        }

        connectToSlackSocketMode();

        sendResponse({ success: true });
      } catch (error) {
        Logger.error(toErrorType(error), 'Background');
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })();
    return true;
  },

  [MESSAGE_ACTIONS.BITBUCKET_TAB_LOADED]: (_request, sender, sendResponse) => {
    (async () => {
      try {
        if (sender.tab) {
          const { bitbucketUrl } = await chrome.storage.sync.get('bitbucketUrl');
          if (bitbucketUrl) {
            const wildcardToRegexPattern = bitbucketUrl.replace(/\*/g, '.*');
            const bitbucketRegex = new RegExp(wildcardToRegexPattern);

            if (sender.tab.url && bitbucketRegex.test(sender.tab.url)) {
              updateMergeButtonFromLastKnownMergeState();
            }
          }
        }

        sendResponse({ success: true });
      } catch (error) {
        Logger.error(toErrorType(error), 'Background');
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })();
    return true;
  },

  [MESSAGE_ACTIONS.FEATURE_TOGGLE_CHANGED]: (request, _sender, sendResponse) => {
    (async () => {
      try {
        const { enabled } = request.payload || {};
        await chrome.storage.local.set({ featureEnabled: enabled });

        if (enabled === false) {
          await scheduleFeatureReactivation();
        } else {
          stopCountdown();
          await chrome.storage.local.remove('reactivationTime');
        }

        const { channelName } = await chrome.storage.sync.get('channelName');
        if (channelName) {
          await updateContentScriptMergeState(channelName);
        }

        sendResponse({ success: true });
      } catch (error) {
        Logger.error(toErrorType(error), 'Background');
        sendResponse({ success: false, error: toErrorType(error).message });
      }
    })();
    return true;
  },

  [MESSAGE_ACTIONS.COUNTDOWN_COMPLETED]: (request, _sender, sendResponse) => {
    (async () => {
      try {
        const { enabled } = request.payload || {};
        await chrome.storage.local.set({ featureEnabled: enabled });

        const { channelName } = await chrome.storage.sync.get('channelName');
        if (channelName) {
          await updateContentScriptMergeState(channelName);
        }

        sendResponse({ success: true });
      } catch (error) {
        Logger.error(toErrorType(error), 'Background');
        sendResponse({ success: false, error: toErrorType(error).message });
      }
    })();
    return true;
  },

  [MESSAGE_ACTIONS.GET_COUNTDOWN_STATUS]: (_request, _sender, sendResponse) => {
    (async () => {
      try {
        const { reactivationTime, featureEnabled } = (await chrome.storage.local.get([
          'reactivationTime',
          'featureEnabled',
        ])) as { reactivationTime?: number; featureEnabled?: boolean };

        if (featureEnabled === false && reactivationTime) {
          const currentTime = Date.now();
          const timeLeft = Math.max(0, reactivationTime - currentTime);

          const response = {
            isCountdownActive: true,
            timeLeft: timeLeft,
            reactivationTime: reactivationTime,
          };

          sendResponse(response);
        } else {
          const response = {
            isCountdownActive: false,
            timeLeft: 0,
            reactivationTime: null,
          };

          sendResponse(response);
        }
      } catch (error) {
        Logger.error(toErrorType(error), 'Background');
        sendResponse({ isCountdownActive: false, timeLeft: 0, reactivationTime: null });
      }
    })();

    return true;
  },
};
