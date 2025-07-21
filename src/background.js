import {
  DEFAULT_MERGE_BUTTON_SELECTOR,
  SLACK_CONVERSATIONS_LIST_URL,
  SLACK_CONVERSATIONS_HISTORY_URL,
  SLACK_AUTH_TEST_URL,
  SLACK_CONNECTIONS_OPEN_URL,
  MAX_MESSAGES,
  DEFAULT_ALLOWED_PHRASES,
  DEFAULT_DISALLOWED_PHRASES,
  DEFAULT_EXCEPTION_PHRASES,
  FEATURE_REACTIVATION_TIMEOUT,
  RECONNECTION_DELAY_MS,
  WEBSOCKET_CHECK_INTERVAL,
  WEBSOCKET_CHECK_ALARM,
  WEBSOCKET_MAX_AGE,
  APP_STATUS,
  MERGE_STATUS,
  MESSAGE_ACTIONS,
} from './constants.js';
import { Logger } from './utils/logger.js';

let bitbucketTabId = null;
let rtmWebSocket = null;

function normalizeText(text) {
  if (!text) return '';
  const DIACRITICAL_MARKS_REGEX = /\p{Diacritic}/gu;
  const MULTIPLE_WHITESPACE_REGEX = /\s+/g;
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(DIACRITICAL_MARKS_REGEX, '')
    .replace(MULTIPLE_WHITESPACE_REGEX, ' ')
    .trim();
}

function cleanSlackMessageText(text) {
  if (!text) return '';

  const NEWLINES_AND_TABS_REGEX = /[\n\r\t]+/g;
  const USER_MENTION_REGEX = /<@[^>]+>/g;
  const CHANNEL_MENTION_REGEX = /<#[^|>]+>/g;
  const REMAINING_BRACKETS_REGEX = /<[^>]+>/g;
  const MULTIPLE_WHITESPACE_REGEX = /\s+/g;

  text = text.replace(NEWLINES_AND_TABS_REGEX, ' ');
  let cleanedText = text.replace(USER_MENTION_REGEX, '@MENTION');
  cleanedText = cleanedText.replace(CHANNEL_MENTION_REGEX, '@CHANNEL');
  cleanedText = cleanedText.replace(REMAINING_BRACKETS_REGEX, '');
  cleanedText = cleanedText.replace(MULTIPLE_WHITESPACE_REGEX, ' ').trim();
  return cleanedText;
}

function determineMergeStatus({
  messages,
  allowedPhrases,
  disallowedPhrases,
  exceptionPhrases,
}) {
  const normalizedAllowedPhrases = allowedPhrases.map(normalizeText);
  const normalizedDisallowedPhrases = disallowedPhrases.map(normalizeText);
  const normalizedExceptionPhrases = exceptionPhrases.map(normalizeText);

  for (const message of messages) {
    const normalizedMessageText = normalizeText(message.text);

    const matchingExceptionPhrase = normalizedExceptionPhrases.find((keyword) =>
      normalizedMessageText.includes(keyword),
    );
    if (matchingExceptionPhrase) {
      return { status: MERGE_STATUS.EXCEPTION, message };
    }

    const matchingDisallowedPhrase = normalizedDisallowedPhrases.find(
      (keyword) => normalizedMessageText.includes(keyword),
    );
    if (matchingDisallowedPhrase) {
      return { status: MERGE_STATUS.DISALLOWED, message };
    }

    const matchingAllowedPhrase = normalizedAllowedPhrases.find((keyword) =>
      normalizedMessageText.includes(keyword),
    );
    if (matchingAllowedPhrase) {
      return { status: MERGE_STATUS.ALLOWED, message };
    }
  }

  return { status: MERGE_STATUS.UNKNOWN, message: null };
}

function updateExtensionIcon(status) {
  let smallIconPath, largeIconPath;
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

let lastAppStatus = null;

async function getCurrentMergeStatusFromMessages() {
  const { messages = [] } = await chrome.storage.local.get('messages');

  if (messages.length === 0) {
    return MERGE_STATUS.UNKNOWN;
  }

  const {
    currentAllowedPhrases,
    currentDisallowedPhrases,
    currentExceptionPhrases,
  } = await getPhrasesFromStorage();

  const { status } = determineMergeStatus({
    messages,
    allowedPhrases: currentAllowedPhrases,
    disallowedPhrases: currentDisallowedPhrases,
    exceptionPhrases: currentExceptionPhrases,
  });

  return status;
}

async function updateIconBasedOnCurrentMessages() {
  const iconStatus = await getCurrentMergeStatusFromMessages();
  updateExtensionIcon(iconStatus);
}

async function updateAppStatus(status) {
  if (status === lastAppStatus) {
    return false;
  }

  lastAppStatus = status;

  const { lastKnownMergeState = {} } = await chrome.storage.local.get(
    'lastKnownMergeState',
  );
  await chrome.storage.local.set({
    lastKnownMergeState: {
      ...lastKnownMergeState,
      appStatus: status,
    },
  });

  let iconStatus;
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

async function resolveChannelId(slackToken, channelName) {
  let { channelId, cachedChannelName } = await chrome.storage.local.get([
    'channelId',
    'cachedChannelName',
  ]);

  if (cachedChannelName !== channelName) {
    channelId = null;
  }

  if (!channelId) {
    const fetchAllChannels = async () => {
      const channelTypes = ['public_channel', 'private_channel'];
      const promises = channelTypes.map((type) =>
        fetch(`${SLACK_CONVERSATIONS_LIST_URL}?types=${type}`, {
          headers: { Authorization: `Bearer ${slackToken}` },
        }).then((res) => res.json()),
      );

      const results = await Promise.all(promises);
      let allChannels = [];
      for (const result of results) {
        if (!result.ok) continue;
        allChannels = allChannels.concat(result.channels);
      }
      return allChannels;
    };

    const allChannels = await fetchAllChannels();
    const foundChannel = allChannels.find((c) => c.name === channelName);

    if (!foundChannel) {
      throw new Error('channel_not_found');
    }

    channelId = foundChannel.id;
    await chrome.storage.local.set({
      channelId,
      cachedChannelName: channelName,
    });
  }
  return channelId;
}

async function processAndStoreMessage(message) {
  if (!message.ts || !message.text) {
    return;
  }

  const messageTs = message.ts;

  let messages = (await chrome.storage.local.get('messages')).messages || [];
  const existMessage = messages.some((m) => m.ts === messageTs);

  if (existMessage) {
    return;
  }

  messages.push({
    text: cleanSlackMessageText(message.text),
    ts: messageTs,
  });

  messages.sort((a, b) => Number(b.ts) - Number(a.ts));

  if (messages.length > MAX_MESSAGES) {
    messages = messages.slice(messages.length - MAX_MESSAGES);
  }

  await chrome.storage.local.set({
    messages: messages,
  });

  const {
    currentAllowedPhrases,
    currentDisallowedPhrases,
    currentExceptionPhrases,
  } = await getPhrasesFromStorage();

  const { message: matchingMessage } = determineMergeStatus({
    messages: messages,
    allowedPhrases: currentAllowedPhrases,
    disallowedPhrases: currentDisallowedPhrases,
    exceptionPhrases: currentExceptionPhrases,
  });

  await chrome.storage.local.set({ lastMatchingMessage: matchingMessage });

  await updateIconBasedOnCurrentMessages();
}

async function getPhrasesFromStorage() {
  const { allowedPhrases, disallowedPhrases, exceptionPhrases } =
    await chrome.storage.sync.get([
      'allowedPhrases',
      'disallowedPhrases',
      'exceptionPhrases',
    ]);

  const currentAllowedPhrases = allowedPhrases
    ? allowedPhrases.split(',')
    : DEFAULT_ALLOWED_PHRASES;

  const currentDisallowedPhrases = disallowedPhrases
    ? disallowedPhrases.split(',')
    : DEFAULT_DISALLOWED_PHRASES;

  const currentExceptionPhrases = exceptionPhrases
    ? exceptionPhrases.split(',')
    : DEFAULT_EXCEPTION_PHRASES;

  return {
    currentAllowedPhrases,
    currentDisallowedPhrases,
    currentExceptionPhrases,
  };
}

async function handleSlackApiError(error) {
  const errorMessage = error?.message || '';

  if (
    errorMessage.includes('channel_not_found') ||
    errorMessage.includes('not_in_channel')
  ) {
    await updateAppStatus(APP_STATUS.CHANNEL_NOT_FOUND);
    await chrome.storage.local.set({
      channelId: null,
    });
  } else if (
    errorMessage.includes('invalid_auth') ||
    errorMessage.includes('token_revoked')
  ) {
    await updateAppStatus(APP_STATUS.TOKEN_ERROR);
  } else {
    await updateAppStatus(APP_STATUS.UNKNOWN_ERROR);
  }
}

async function updateContentScriptMergeState(channelName) {
  const {
    messages: currentMessages = [],
    featureEnabled,
    lastKnownMergeState = {},
  } = await chrome.storage.local.get([
    'messages',
    'featureEnabled',
    'lastKnownMergeState',
  ]);

  const appStatus = lastKnownMergeState?.appStatus;

  const lastSlackMessage =
    currentMessages.length > 0
      ? currentMessages[currentMessages.length - 1]
      : null;

  const {
    currentAllowedPhrases,
    currentDisallowedPhrases,
    currentExceptionPhrases,
  } = await getPhrasesFromStorage();

  let mergeStatusForContentScript = MERGE_STATUS.UNKNOWN;
  let matchingMessageForContentScript = null;
  if (currentMessages.length > 0) {
    const { status, message } = determineMergeStatus({
      messages: currentMessages,
      allowedPhrases: currentAllowedPhrases,
      disallowedPhrases: currentDisallowedPhrases,
      exceptionPhrases: currentExceptionPhrases,
    });
    mergeStatusForContentScript = status;
    matchingMessageForContentScript = message;
  }

  const errorStatuses = [
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
    Logger.error(error);
  }

  if (bitbucketTabId) {
    try {
      const effectiveMergeStatus =
        featureEnabled === false
          ? MERGE_STATUS.ALLOWED
          : mergeStatusForContentScript;
      const effectiveIsMergeDisabled =
        featureEnabled === false
          ? false
          : mergeStatusForContentScript === MERGE_STATUS.DISALLOWED ||
            mergeStatusForContentScript === MERGE_STATUS.EXCEPTION;

      await chrome.tabs.sendMessage(bitbucketTabId, {
        action: 'updateMergeButton',
        lastSlackMessage: lastSlackMessage,
        channelName: channelName,
        isMergeDisabled: effectiveIsMergeDisabled,
        mergeStatus: effectiveMergeStatus,
        featureEnabled: featureEnabled !== false,
      });
    } catch (error) {
      Logger.error(error);
    }
  }
}

async function fetchAndStoreTeamId(slackToken) {
  try {
    const response = await fetch(SLACK_AUTH_TEST_URL, {
      headers: { Authorization: `Bearer ${slackToken}` },
    });
    const data = await response.json();
    if (data.ok) {
      await chrome.storage.local.set({ teamId: data.team_id });
    }
  } catch (error) {
    Logger.error(error);
  }
}

async function connectToSlackSocketMode() {
  const { slackToken, appToken, channelName } = await chrome.storage.sync.get([
    'slackToken',
    'appToken',
    'channelName',
  ]);

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
      resolveChannelId(slackToken, channelName).then((channelId) =>
        fetchAndStoreMessages(slackToken, channelId),
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
    rtmWebSocket = new WebSocket(wsUrl);

    rtmWebSocket.onopen = async () => {
      await updateAppStatus(APP_STATUS.OK);
      await chrome.storage.local.set({
        lastWebSocketConnectTime: Date.now(),
      });
      Logger.log('WebSocket successfully connected');

      setupWebSocketCheckAlarm();
    };

    rtmWebSocket.onmessage = async (event) => {
      const envelope = JSON.parse(event.data);
      if (envelope.payload && envelope.payload.event) {
        const message = envelope.payload.event;
        if (message.type === 'message' && message.ts && message.text) {
          await processAndStoreMessage(message);
          await updateContentScriptMergeState(channelName);
        }
      } else if (envelope.type === 'disconnect') {
        rtmWebSocket.close();
      }
    };

    rtmWebSocket.onclose = async () => {
      Logger.log('WebSocket connection closed');

      await updateAppStatus(APP_STATUS.WEB_SOCKET_ERROR);

      Logger.log('WebSocket closed. Scheduling reconnection...');
      setTimeout(connectToSlackSocketMode, RECONNECTION_DELAY_MS);
    };

    rtmWebSocket.onerror = async (error) => {
      await updateAppStatus(APP_STATUS.WEB_SOCKET_ERROR);
      Logger.error(error, 'WebSocket', { type: 'connection' });
      rtmWebSocket.close();
    };
  } catch (error) {
    Logger.error(error, 'SlackConnection', {
      channelName,
      connectionType: 'RTM',
    });
    await handleSlackApiError(error);
    await updateContentScriptMergeState(channelName);
  }
}

function setupWebSocketCheckAlarm() {
  chrome.alarms.clear(WEBSOCKET_CHECK_ALARM, () => {
    chrome.alarms.create(WEBSOCKET_CHECK_ALARM, {
      periodInMinutes: WEBSOCKET_CHECK_INTERVAL,
    });
    Logger.log(
      `Alarm set to check WebSocket every ${WEBSOCKET_CHECK_INTERVAL} minutes`,
    );
  });
}

async function checkWebSocketConnection() {
  Logger.log('Checking WebSocket connection status...');

  if (!rtmWebSocket || rtmWebSocket.readyState !== WebSocket.OPEN) {
    Logger.log('WebSocket is not connected. Attempting to reconnect...');
    connectToSlackSocketMode();
    return;
  }

  const { lastWebSocketConnectTime } = await chrome.storage.local.get(
    'lastWebSocketConnectTime',
  );
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
      Logger.error('Error sending ping:', error);
      await updateAppStatus(APP_STATUS.WEB_SOCKET_ERROR);
      rtmWebSocket.close();
      setTimeout(connectToSlackSocketMode, 1000);
    }
  }
}

async function fetchAndStoreMessages(slackToken, channelId) {
  if (!channelId) {
    return;
  }

  try {
    await chrome.storage.local.set({ lastMatchingMessage: null });

    const response = await fetch(
      `${SLACK_CONVERSATIONS_HISTORY_URL}?channel=${channelId}&limit=${MAX_MESSAGES}`,
      {
        headers: { Authorization: `Bearer ${slackToken}` },
      },
    );
    const data = await response.json();

    if (data.ok) {
      const messages = data.messages.map((msg) => ({
        text: cleanSlackMessageText(msg.text),
        ts: msg.ts,
      }));
      await chrome.storage.local.set({ messages });

      const {
        currentAllowedPhrases,
        currentDisallowedPhrases,
        currentExceptionPhrases,
      } = await getPhrasesFromStorage();

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

const messageHandlers = {
  [MESSAGE_ACTIONS.GET_DEFAULT_PHRASES]: (_request, _sender, sendResponse) => {
    sendResponse({
      defaultAllowedPhrases: DEFAULT_ALLOWED_PHRASES,
      defaultDisallowedPhrases: DEFAULT_DISALLOWED_PHRASES,
      defaultExceptionPhrases: DEFAULT_EXCEPTION_PHRASES,
    });
    return true;
  },
  [MESSAGE_ACTIONS.FETCH_NEW_MESSAGES]: async (request) => {
    const { slackToken, channelName } = await chrome.storage.sync.get([
      'slackToken',
      'channelName',
    ]);

    const targetChannelName = request?.channelName || channelName;

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
      } catch (error) {
        Logger.error('Error fetching messages:', error);
        await handleSlackApiError(error);

        if (request?.channelName && !request?.skipErrorNotification) {
          try {
            await chrome.runtime.sendMessage({
              action: MESSAGE_ACTIONS.CHANNEL_CHANGE_ERROR,
              error: error.message,
            });
          } catch (error) {
            Logger.error(error);
          }
        }
      }
    } else {
      await updateAppStatus(APP_STATUS.CONFIG_ERROR);
    }
  },
  [MESSAGE_ACTIONS.RECONNECT_SLACK]: async () => {
    const { lastKnownMergeState = {} } = await chrome.storage.local.get(
      'lastKnownMergeState',
    );
    const appStatus = lastKnownMergeState?.appStatus;

    if (rtmWebSocket) {
      rtmWebSocket.close();
    }

    if (!appStatus || appStatus === APP_STATUS.OK) {
      updateExtensionIcon(MERGE_STATUS.LOADING);
    }

    connectToSlackSocketMode();
  },
  [MESSAGE_ACTIONS.BITBUCKET_TAB_LOADED]: async (_request, sender) => {
    if (sender.tab) {
      const { bitbucketUrl } = await chrome.storage.sync.get('bitbucketUrl');
      if (bitbucketUrl) {
        const wildcardToRegexPattern = bitbucketUrl.replace(/\*/g, '.*');
        const bitbucketRegex = new RegExp(wildcardToRegexPattern);

        if (bitbucketRegex.test(sender.tab.url)) {
          bitbucketTabId = sender.tab.id;
          updateMergeButtonFromLastKnownMergeState();
        }
      }
    }
  },
  [MESSAGE_ACTIONS.FEATURE_TOGGLE_CHANGED]: async (request) => {
    const { enabled } = request;
    await chrome.storage.local.set({ featureEnabled: enabled });

    if (!enabled) {
      await scheduleFeatureReactivation();
    }

    const { channelName } = await chrome.storage.sync.get('channelName');
    if (channelName) {
      await updateContentScriptMergeState(channelName);
    }
  },

  [MESSAGE_ACTIONS.COUNTDOWN_COMPLETED]: async (request) => {
    const { enabled } = request;
    await chrome.storage.local.set({ featureEnabled: enabled });

    const { channelName } = await chrome.storage.sync.get('channelName');
    if (channelName) {
      await updateContentScriptMergeState(channelName);
    }
  },

  [MESSAGE_ACTIONS.GET_COUNTDOWN_STATUS]: async (
    request,
    sender,
    sendResponse,
  ) => {
    const { reactivationTime, featureEnabled } = await chrome.storage.local.get(
      ['reactivationTime', 'featureEnabled'],
    );

    if (featureEnabled === false && reactivationTime) {
      const currentTime = Date.now();
      const timeLeft = Math.max(0, reactivationTime - currentTime);

      sendResponse({
        isCountdownActive: true,
        timeLeft: timeLeft,
        reactivationTime: reactivationTime,
      });
      return true;
    } else {
      sendResponse({
        isCountdownActive: false,
        timeLeft: 0,
        reactivationTime: null,
      });
      return true;
    }
  },
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const handler = messageHandlers[request.action];
  if (handler) {
    return handler(request, sender, sendResponse);
  }
});

const updateMergeButtonFromLastKnownMergeState = () => {
  chrome.storage.local.get(
    ['lastKnownMergeState', 'featureEnabled'],
    async (result) => {
      if (result.lastKnownMergeState) {
        const { isMergeDisabled, lastSlackMessage, channelName, mergeStatus } =
          result.lastKnownMergeState;

        const finalIsMergeDisabled =
          result.featureEnabled === false ? false : isMergeDisabled;
        const finalMergeStatus =
          result.featureEnabled === false ? MERGE_STATUS.ALLOWED : mergeStatus;

        try {
          await chrome.tabs.sendMessage(bitbucketTabId, {
            action: 'updateMergeButton',
            lastSlackMessage: lastSlackMessage,
            channelName: channelName,
            isMergeDisabled: finalIsMergeDisabled,
            mergeStatus: finalMergeStatus,
            featureEnabled: result.featureEnabled !== false,
          });
        } catch (error) {
          Logger.error(error);
          bitbucketTabId = null;
        }
      }
    },
  );
};

let countdownInterval;

function stopCountdown() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
}

async function startCountdown(targetTime) {
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

async function notifyPopupAboutCountdown(timeLeft) {
  try {
    await chrome.runtime.sendMessage({
      action: MESSAGE_ACTIONS.UPDATE_COUNTDOWN_DISPLAY,
      timeLeft,
    });
  } catch (error) {
    Logger.error(error);
  }
}

async function scheduleFeatureReactivation() {
  const reactivationTime = Date.now() + FEATURE_REACTIVATION_TIMEOUT;
  await chrome.storage.local.set({ reactivationTime });
  await startCountdown(reactivationTime);
}

async function checkScheduledReactivation() {
  const { reactivationTime, featureEnabled } = await chrome.storage.local.get([
    'reactivationTime',
    'featureEnabled',
  ]);

  if (featureEnabled === false && reactivationTime) {
    const currentTime = Date.now();
    if (reactivationTime > currentTime) {
      await startCountdown(reactivationTime);
    } else {
      await reactivateFeature();
    }
  }
}

async function reactivateFeature() {
  await chrome.storage.local.set({ featureEnabled: true });

  try {
    await chrome.runtime.sendMessage({
      action: MESSAGE_ACTIONS.COUNTDOWN_COMPLETED,
      enabled: true,
    });
  } catch (error) {
    Logger.error(error);
  }

  const { channelName } = await chrome.storage.sync.get('channelName');
  if (channelName) {
    await updateContentScriptMergeState(channelName);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get('mergeButtonSelector', (result) => {
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

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === WEBSOCKET_CHECK_ALARM) {
    checkWebSocketConnection();
  }
});

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes.bitbucketUrl) {
    registerBitbucketContentScript();
  }
});

async function registerBitbucketContentScript() {
  const { bitbucketUrl } = await chrome.storage.sync.get('bitbucketUrl');

  try {
    await chrome.scripting.unregisterContentScripts({
      ids: ['bitbucket-content-script'],
    });
  } catch (error) {
    Logger.error(error);
  }

  if (bitbucketUrl) {
    try {
      await chrome.scripting.registerContentScripts([
        {
          id: 'bitbucket-content-script',
          matches: [bitbucketUrl],
          js: ['content.js'],
          runAt: 'document_idle',
        },
      ]);
    } catch (error) {
      Logger.error(error);
    }
  }
}
