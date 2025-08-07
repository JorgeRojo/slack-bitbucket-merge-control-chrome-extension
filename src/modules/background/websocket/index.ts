import { updateAppStatus, updateExtensionIcon } from '@src/modules/background/app-state';
import { updateContentScriptMergeState } from '@src/modules/background/bitbucket';
import {
  fetchAndStoreMessages,
  fetchAndStoreTeamId,
  handleCanvasChangedEvent,
  handleSlackApiError,
  processAndStoreMessage,
  resolveChannelId,
} from '@src/modules/background/slack';
import {
  APP_STATUS,
  MERGE_STATUS,
  RECONNECTION_DELAY_MS,
  SLACK_CONNECTIONS_OPEN_URL,
  WEBSOCKET_CHECK_ALARM,
  WEBSOCKET_CHECK_INTERVAL,
  WEBSOCKET_MAX_AGE,
} from '@src/modules/common/constants';
import { Logger } from '@src/modules/common/utils/Logger';
import { toErrorType } from '@src/modules/common/utils/type-helpers';

// Global variables
let rtmWebSocket: WebSocket | null = null;
let bitbucketTabId: number | null = null;

/**
 * Connects to Slack using Socket Mode
 */
export async function connectToSlackSocketMode(): Promise<void> {
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
      resolveChannelId(slackToken, channelName).then(async channelId => {
        if (channelId) {
          await fetchAndStoreMessages(slackToken, channelId);
        }
      }),
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

      setupWebSocketCheckAlarm();
    };

    rtmWebSocket.onmessage = async event => {
      const envelope = JSON.parse(event.data);
      if (envelope.payload && envelope.payload.event) {
        const eventPayload = envelope.payload.event;

        if (eventPayload.type === 'message' && eventPayload.ts && eventPayload.text) {
          await processAndStoreMessage(eventPayload);
          await updateContentScriptMergeState(channelName);
        } else if (eventPayload.type === 'file_change' && eventPayload.file_id) {
          await handleCanvasChangedEvent(eventPayload.file_id);
        }
      } else if (envelope.type === 'disconnect') {
        rtmWebSocket?.close();
      }
    };

    rtmWebSocket.onclose = async () => {
      setTimeout(connectToSlackSocketMode, RECONNECTION_DELAY_MS);
    };

    rtmWebSocket.onerror = async error => {
      Logger.error(toErrorType(error), 'WebSocket', { type: 'connection' });
      rtmWebSocket?.close();
    };
  } catch (error) {
    Logger.error(toErrorType(error), 'SlackConnection', {
      channelName,
      connectionType: 'RTM',
    });
    await handleSlackApiError(error);
    await updateContentScriptMergeState(channelName || '', bitbucketTabId);
  }
}

/**
 * Sets up an alarm to periodically check the WebSocket connection
 */
export function setupWebSocketCheckAlarm(): void {
  chrome.alarms.clear(WEBSOCKET_CHECK_ALARM, () => {
    chrome.alarms.create(WEBSOCKET_CHECK_ALARM, {
      periodInMinutes: WEBSOCKET_CHECK_INTERVAL,
    });
  });
}

/**
 * Checks the WebSocket connection status and reconnects if necessary
 */
export async function checkWebSocketConnection(): Promise<void> {
  if (!rtmWebSocket || rtmWebSocket.readyState !== WebSocket.OPEN) {
    connectToSlackSocketMode();
    return;
  }

  const { lastWebSocketConnectTime } = (await chrome.storage.local.get(
    'lastWebSocketConnectTime'
  )) as { lastWebSocketConnectTime?: number };

  const currentTime = Date.now();
  const connectionAge = currentTime - (lastWebSocketConnectTime || 0);

  if (connectionAge > WEBSOCKET_MAX_AGE) {
    rtmWebSocket.close();
    setTimeout(connectToSlackSocketMode, 1000);
  } else {
    try {
      rtmWebSocket.send(JSON.stringify({ type: 'ping' }));
    } catch {
      rtmWebSocket.close();
      setTimeout(connectToSlackSocketMode, 1000);
    }
  }
}

/**
 * Closes the current WebSocket connection
 */
export function closeWebSocket(): void {
  if (rtmWebSocket) {
    rtmWebSocket.close();
    rtmWebSocket = null;
  }
}

/**
 * Sets the Bitbucket tab ID
 */
export function setBitbucketTabId(tabId: number | null): void {
  bitbucketTabId = tabId;
}

/**
 * Gets the Bitbucket tab ID
 */
export function getBitbucketTabId(): number | null {
  return bitbucketTabId;
}
