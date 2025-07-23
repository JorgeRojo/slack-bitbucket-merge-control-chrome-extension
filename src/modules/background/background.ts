import {
  SLACK_CONVERSATIONS_LIST_URL,
  SLACK_CONVERSATIONS_HISTORY_URL,
  SLACK_AUTH_TEST_URL,
  SLACK_CONNECTIONS_OPEN_URL,
  DEFAULT_MERGE_BUTTON_SELECTOR,
  FEATURE_REACTIVATION_TIMEOUT,
  RECONNECTION_DELAY_MS,
  WEBSOCKET_CHECK_INTERVAL,
  WEBSOCKET_CHECK_ALARM,
  WEBSOCKET_MAX_AGE,
  ERROR_MESSAGES,
  APP_STATUS,
  MERGE_STATUS,
  MESSAGE_ACTIONS,
  CONTENT_SCRIPT_ID,
  MAX_MESSAGES,
  DEFAULT_ALLOWED_PHRASES,
  DEFAULT_DISALLOWED_PHRASES,
  DEFAULT_EXCEPTION_PHRASES,
} from '../common/constants';
import { Logger } from '../common/utils/logger';
import { toErrorType } from '../common/utils/type-helpers';
import {
  cleanSlackMessageText,
  determineMergeStatus,
  updateExtensionIcon,
  handleSlackApiError,
  updateAppStatus,
  updateIconBasedOnCurrentMessages,
  getPhrasesFromStorage,
  processAndStoreMessage,
} from './utils/background-utils';
import { ProcessedMessage } from '../common/types/app';
import { SlackMessage, SlackChannel, SlackConversationsListResponse } from '../common/types/slack';
import { ChromeRuntimeMessage } from '../common/types/chrome';

let bitbucketTabId: number | null = null;
let rtmWebSocket: WebSocket | null = null;
let countdownInterval: ReturnType<typeof setInterval> | undefined;

async function resolveChannelId(slackToken: string, channelName: string): Promise<string> {
  let { channelId, cachedChannelName } = (await chrome.storage.local.get([
    'channelId',
    'cachedChannelName',
  ])) as { channelId?: string; cachedChannelName?: string };

  if (cachedChannelName !== channelName) {
    channelId = undefined;
  }

  if (!channelId) {
    const fetchAllChannels = async (): Promise<SlackChannel[]> => {
      const channelTypes = ['public_channel', 'private_channel'];
      const promises = channelTypes.map(type =>
        fetch(`${SLACK_CONVERSATIONS_LIST_URL}?types=${type}`, {
          headers: { Authorization: `Bearer ${slackToken}` },
        }).then(res => res.json() as Promise<SlackConversationsListResponse>)
      );

      const results = await Promise.all(promises);
      let allChannels: SlackChannel[] = [];
      for (const result of results) {
        if (!result.ok) continue;
        if (result.channels) {
          allChannels = allChannels.concat(result.channels);
        }
      }
      return allChannels;
    };

    const allChannels = await fetchAllChannels();
    const foundChannel = allChannels.find(c => c.name === channelName);

    if (!foundChannel) {
      throw new Error(ERROR_MESSAGES.CHANNEL_NOT_FOUND);
    }

    channelId = foundChannel.id;
    await chrome.storage.local.set({
      channelId,
      cachedChannelName: channelName,
    });
  }
  return channelId;
}

async function updateContentScriptMergeState(channelName: string): Promise<void> {
  const {
    messages: currentMessages = [],
    featureEnabled,
    lastKnownMergeState = {},
  } = (await chrome.storage.local.get(['messages', 'featureEnabled', 'lastKnownMergeState'])) as {
    messages?: ProcessedMessage[];
    featureEnabled?: boolean;
    lastKnownMergeState?: Record<string, any>;
  };

  const appStatus = lastKnownMergeState?.appStatus as APP_STATUS | undefined;

  const lastSlackMessage =
    currentMessages && currentMessages.length > 0 ? currentMessages[0] : null;

  const { currentAllowedPhrases, currentDisallowedPhrases, currentExceptionPhrases } =
    await getPhrasesFromStorage();

  let mergeStatusForContentScript: MERGE_STATUS = MERGE_STATUS.UNKNOWN;
  let matchingMessageForContentScript: ProcessedMessage | null = null;

  if (currentMessages && currentMessages.length > 0) {
    const { status, message } = determineMergeStatus({
      messages: currentMessages,
      allowedPhrases: currentAllowedPhrases,
      disallowedPhrases: currentDisallowedPhrases,
      exceptionPhrases: currentExceptionPhrases,
    });
    mergeStatusForContentScript = status;
    matchingMessageForContentScript = message;
  }

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
      featureEnabled: featureEnabled !== false,
      appStatus: appStatus,
    },
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
          featureEnabled: featureEnabled !== false,
        },
      });
    } catch (error) {
      Logger.error(toErrorType(error), 'Background', {
        silentMessages: [ERROR_MESSAGES.RECEIVING_END_NOT_EXIST, ERROR_MESSAGES.CONNECTION_FAILED],
      });
    }
  }
}

async function fetchAndStoreTeamId(slackToken: string): Promise<void> {
  try {
    const response = await fetch(SLACK_AUTH_TEST_URL, {
      headers: { Authorization: `Bearer ${slackToken}` },
    });
    const data = await response.json();
    if (data.ok) {
      await chrome.storage.local.set({ teamId: data.team_id });
    }
  } catch (error) {
    Logger.error(toErrorType(error));
  }
}

async function fetchAndStoreMessages(slackToken: string, channelId: string): Promise<void> {
  if (!channelId) {
    return;
  }

  try {
    await chrome.storage.local.set({ lastMatchingMessage: null });

    const response = await fetch(
      `${SLACK_CONVERSATIONS_HISTORY_URL}?channel=${channelId}&limit=${MAX_MESSAGES}`,
      {
        headers: { Authorization: `Bearer ${slackToken}` },
      }
    );
    const data = await response.json();

    if (data.ok) {
      const messages = data.messages.map((msg: SlackMessage) => ({
        text: cleanSlackMessageText(msg.text),
        ts: msg.ts,
        user: msg.user,
        matchType: null,
      }));
      await chrome.storage.local.set({ messages });

      const { currentAllowedPhrases, currentDisallowedPhrases, currentExceptionPhrases } =
        await getPhrasesFromStorage();

      const { message: matchingMessage } = determineMergeStatus({
        messages,
        allowedPhrases: currentAllowedPhrases,
        disallowedPhrases: currentDisallowedPhrases,
        exceptionPhrases: currentExceptionPhrases,
      });

      await chrome.storage.local.set({ lastMatchingMessage: matchingMessage });

      await updateIconBasedOnCurrentMessages();

      const { channelName } = await chrome.storage.sync.get('channelName');
      await updateContentScriptMergeState(channelName);
    } else {
      throw new Error(data.error);
    }
  } catch (error) {
    await handleSlackApiError(error);
  }
}

async function connectToSlackSocketMode(): Promise<void> {
  const { slackToken, appToken, channelName } = (await chrome.storage.sync.get([
    'slackToken',
    'appToken',
    'channelName',
  ])) as { slackToken?: string; appToken?: string; channelName?: string };

  if (!slackToken || !appToken || !channelName) {
    await updateAppStatus(APP_STATUS.CONFIG_ERROR);
    await chrome.storage.local.set({
      messages: [],
    });
    return;
  }

  updateExtensionIcon(MERGE_STATUS.LOADING);

  try {
    await Promise.all([
      fetchAndStoreTeamId(slackToken),
      resolveChannelId(slackToken, channelName).then(channelId =>
        fetchAndStoreMessages(slackToken, channelId)
      ),
    ]);

    const connectionsOpenResponse = await fetch(SLACK_CONNECTIONS_OPEN_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${appToken}` },
    });
    const connectionsOpenData = await connectionsOpenResponse.json();

    if (!connectionsOpenData.ok) {
      throw new Error(connectionsOpenData.error);
    }

    const wsUrl = connectionsOpenData.url;
    if (!wsUrl) {
      throw new Error('No WebSocket URL returned from Slack');
    }

    rtmWebSocket = new WebSocket(wsUrl);

    rtmWebSocket.onopen = async () => {
      await updateAppStatus(APP_STATUS.OK);
      await chrome.storage.local.set({
        lastWebSocketConnectTime: Date.now(),
      });
      Logger.log('WebSocket successfully connected');

      setupWebSocketCheckAlarm();
    };

    rtmWebSocket.onmessage = async event => {
      const envelope = JSON.parse(event.data);
      if (envelope.payload && envelope.payload.event) {
        const message = envelope.payload.event;
        if (message.type === 'message' && message.ts && message.text) {
          await processAndStoreMessage(message);
          await updateContentScriptMergeState(channelName);
        }
      } else if (envelope.type === 'disconnect') {
        rtmWebSocket?.close();
      }
    };

    rtmWebSocket.onclose = async () => {
      Logger.log('WebSocket connection closed');

      await updateAppStatus(APP_STATUS.WEB_SOCKET_ERROR);

      Logger.log('WebSocket closed. Scheduling reconnection...');
      setTimeout(connectToSlackSocketMode, RECONNECTION_DELAY_MS);
    };

    rtmWebSocket.onerror = async error => {
      await updateAppStatus(APP_STATUS.WEB_SOCKET_ERROR);
      Logger.error(toErrorType(error), 'WebSocket', { type: 'connection' });
      rtmWebSocket?.close();
    };
  } catch (error) {
    Logger.error(toErrorType(error), 'SlackConnection', {
      channelName,
      connectionType: 'RTM',
    });
    await handleSlackApiError(error);
    await updateContentScriptMergeState(channelName || '');
  }
}

function setupWebSocketCheckAlarm(): void {
  chrome.alarms.clear(WEBSOCKET_CHECK_ALARM, () => {
    chrome.alarms.create(WEBSOCKET_CHECK_ALARM, {
      periodInMinutes: WEBSOCKET_CHECK_INTERVAL,
    });
    Logger.log(`Alarm set to check WebSocket every ${WEBSOCKET_CHECK_INTERVAL} minutes`);
  });
}

async function checkWebSocketConnection(): Promise<void> {
  Logger.log('Checking WebSocket connection status...');

  if (!rtmWebSocket || rtmWebSocket.readyState !== WebSocket.OPEN) {
    Logger.log('WebSocket is not connected. Attempting to reconnect...');
    connectToSlackSocketMode();
    return;
  }

  const { lastWebSocketConnectTime } = (await chrome.storage.local.get(
    'lastWebSocketConnectTime'
  )) as { lastWebSocketConnectTime?: number };

  const currentTime = Date.now();
  const connectionAge = currentTime - (lastWebSocketConnectTime || 0);

  if (connectionAge > WEBSOCKET_MAX_AGE) {
    Logger.log('Old WebSocket connection. Reconnecting to refresh it...');
    rtmWebSocket.close();
    setTimeout(connectToSlackSocketMode, 1000);
  } else {
    Logger.log('WebSocket connection active and recent.');

    try {
      rtmWebSocket.send(JSON.stringify({ type: 'ping' }));
      Logger.log('Ping sent to Slack server');
    } catch (error) {
      Logger.error(toErrorType(error), ERROR_MESSAGES.SENDING_PING);
      await updateAppStatus(APP_STATUS.WEB_SOCKET_ERROR);
      rtmWebSocket.close();
      setTimeout(connectToSlackSocketMode, 1000);
    }
  }
}

function updateMergeButtonFromLastKnownMergeState(): void {
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
          bitbucketTabId = null;
          return;
        }
      }
    }
  );
}

function stopCountdown(): void {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = undefined;
  }
}

async function notifyPopupAboutCountdown(timeLeft: number): Promise<void> {
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

async function reactivateFeature(): Promise<void> {
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

async function startCountdown(targetTime: number): Promise<void> {
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

async function scheduleFeatureReactivation(): Promise<void> {
  const reactivationTime = Date.now() + FEATURE_REACTIVATION_TIMEOUT;
  await chrome.storage.local.set({ reactivationTime });
  await startCountdown(reactivationTime);
}

async function checkScheduledReactivation(): Promise<void> {
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

async function registerBitbucketContentScript(): Promise<void> {
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

const messageHandlers: Record<
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
        console.error('[Background] Error in FETCH_NEW_MESSAGES:', error);
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

        if (rtmWebSocket) {
          rtmWebSocket.close();
        }

        if (!appStatus || appStatus === APP_STATUS.OK) {
          updateExtensionIcon(MERGE_STATUS.LOADING);
        }

        connectToSlackSocketMode();

        sendResponse({ success: true });
      } catch (error) {
        console.error('[Background] Error in RECONNECT_SLACK:', error);
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
              bitbucketTabId = sender.tab.id || null;
              updateMergeButtonFromLastKnownMergeState();
            }
          }
        }

        sendResponse({ success: true });
      } catch (error) {
        console.error('[Background] Error in BITBUCKET_TAB_LOADED:', error);
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
        console.error('[Background] Error in FEATURE_TOGGLE_CHANGED:', error);
        sendResponse({ success: false, error: error.message });
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
        console.error('[Background] Error in COUNTDOWN_COMPLETED:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  },

  [MESSAGE_ACTIONS.GET_COUNTDOWN_STATUS]: (_request, _sender, sendResponse) => {
    console.log('[Background] Received GET_COUNTDOWN_STATUS message');

    (async () => {
      try {
        const { reactivationTime, featureEnabled } = (await chrome.storage.local.get([
          'reactivationTime',
          'featureEnabled',
        ])) as { reactivationTime?: number; featureEnabled?: boolean };

        console.log('[Background] Storage values:', { reactivationTime, featureEnabled });

        if (featureEnabled === false && reactivationTime) {
          const currentTime = Date.now();
          const timeLeft = Math.max(0, reactivationTime - currentTime);

          const response = {
            isCountdownActive: true,
            timeLeft: timeLeft,
            reactivationTime: reactivationTime,
          };

          console.log('[Background] Sending countdown active response:', response);
          sendResponse(response);
        } else {
          const response = {
            isCountdownActive: false,
            timeLeft: 0,
            reactivationTime: null,
          };

          console.log('[Background] Sending countdown inactive response:', response);
          sendResponse(response);
        }
      } catch (error) {
        console.error('[Background] Error in GET_COUNTDOWN_STATUS handler:', error);
        sendResponse({ isCountdownActive: false, timeLeft: 0, reactivationTime: null });
      }
    })();

    return true;
  },
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const handler = messageHandlers[request.action];
  if (handler) {
    return handler(request, sender, sendResponse);
  }
  return false;
});

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === WEBSOCKET_CHECK_ALARM) {
    checkWebSocketConnection();
  }
});

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes.bitbucketUrl) {
    registerBitbucketContentScript();
  }
});

if (typeof process === 'undefined' || process.env.NODE_ENV !== 'test') {
  chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.sync.get('mergeButtonSelector', result => {
      if (!result.mergeButtonSelector) {
        chrome.storage.sync.set({
          mergeButtonSelector: DEFAULT_MERGE_BUTTON_SELECTOR,
        });
      }
    });
    connectToSlackSocketMode();
    registerBitbucketContentScript();
    checkScheduledReactivation();
    setupWebSocketCheckAlarm();
  });

  chrome.runtime.onStartup.addListener(() => {
    connectToSlackSocketMode();
    registerBitbucketContentScript();
    checkScheduledReactivation();
    setupWebSocketCheckAlarm();
  });
}
