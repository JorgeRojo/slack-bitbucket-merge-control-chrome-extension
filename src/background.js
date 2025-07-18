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
} from './constants.js';

let bitbucketTabId = null;

let rtmWebSocket = null;

// Expresiones regulares para normalización y limpieza de texto
const DIACRITICAL_MARKS_REGEX = /\p{Diacritic}/gu;
const MULTIPLE_WHITESPACE_REGEX = /\s+/g;
const NEWLINES_AND_TABS_REGEX = /[\n\r\t]+/g;
const USER_MENTION_REGEX = /<@[^>]+>/g;
const CHANNEL_MENTION_REGEX = /<#[^|>]+>/g;
const REMAINING_BRACKETS_REGEX = /<[^>]+>/g;

// Tiempo de reconexión en milisegundos
const RECONNECTION_DELAY_MS = 5000;

function normalizeText(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(DIACRITICAL_MARKS_REGEX, '')
    .replace(MULTIPLE_WHITESPACE_REGEX, ' ')
    .trim();
}

function cleanSlackMessageText(text) {
  if (!text) return '';

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
      return { status: 'exception', message };
    }

    const matchingDisallowedPhrase = normalizedDisallowedPhrases.find(
      (keyword) => normalizedMessageText.includes(keyword),
    );
    if (matchingDisallowedPhrase) {
      return { status: 'disallowed', message };
    }

    const matchingAllowedPhrase = normalizedAllowedPhrases.find((keyword) =>
      normalizedMessageText.includes(keyword),
    );
    if (matchingAllowedPhrase) {
      return { status: 'allowed', message };
    }
  }

  return { status: 'unknown', message: null };
}

function updateExtensionIcon(status) {
  let smallIconPath, largeIconPath;
  switch (status) {
    case 'loading':
      smallIconPath = 'images/icon16.png';
      largeIconPath = 'images/icon48.png';
      break;
    case 'allowed':
      smallIconPath = 'images/icon16_enabled.png';
      largeIconPath = 'images/icon48_enabled.png';
      break;
    case 'disallowed':
      smallIconPath = 'images/icon16_disabled.png';
      largeIconPath = 'images/icon48_disabled.png';
      break;
    case 'exception':
      smallIconPath = 'images/icon16_exception.png';
      largeIconPath = 'images/icon48_exception.png';
      break;
    case 'error':
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

async function processAndStoreMessage(message, _slackToken) {
  if (!message.ts || !message.text) {
    return;
  }

  const messageTs = message.ts;

  let storedMessages =
    (await chrome.storage.local.get('messages')).messages || [];

  if (storedMessages.some((m) => m.ts === messageTs)) {
    return;
  }

  storedMessages.push({
    text: cleanSlackMessageText(message.text),
    ts: message.ts,
  });

  storedMessages.sort((a, b) => Number(b.ts) - Number(a.ts));

  if (storedMessages.length > MAX_MESSAGES) {
    storedMessages = storedMessages.slice(storedMessages.length - MAX_MESSAGES);
  }

  await chrome.storage.local.set({
    messages: storedMessages,
  });

  const {
    currentAllowedPhrases,
    currentDisallowedPhrases,
    currentExceptionPhrases,
  } = await getPhrasesFromStorage();

  const { status: mergeStatus, message: matchingMessage } =
    determineMergeStatus({
      messages: storedMessages,
      allowedPhrases: currentAllowedPhrases,
      disallowedPhrases: currentDisallowedPhrases,
      exceptionPhrases: currentExceptionPhrases,
    });

  updateExtensionIcon(mergeStatus);
  await chrome.storage.local.set({ lastMatchingMessage: matchingMessage });
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
    await chrome.storage.local.set({
      appStatus: 'CHANNEL_ERROR',
      messages: [],
      channelId: null,
    });
  } else if (
    errorMessage.includes('invalid_auth') ||
    errorMessage.includes('token_revoked')
  ) {
    await chrome.storage.local.set({
      appStatus: 'TOKEN_TOKEN_ERROR',
      messages: [],
    });
  } else {
    await chrome.storage.local.set({
      appStatus: 'UNKNOWN_ERROR',
      messages: [],
    });
  }
  updateExtensionIcon('error');
}

async function updateContentScriptMergeState(channelName) {
  const {
    messages: currentMessages = [],
    appStatus,
    featureEnabled,
  } = await chrome.storage.local.get([
    'messages',
    'appStatus',
    'featureEnabled',
  ]);

  const lastSlackMessage =
    currentMessages.length > 0
      ? currentMessages[currentMessages.length - 1]
      : null;

  const {
    currentAllowedPhrases,
    currentDisallowedPhrases,
    currentExceptionPhrases,
  } = await getPhrasesFromStorage();

  let mergeStatusForContentScript = 'unknown';
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
    updateExtensionIcon(status);
  }

  if (
    appStatus &&
    (appStatus.includes('ERROR') || appStatus.includes('TOKEN'))
  ) {
    mergeStatusForContentScript = 'allowed';
  }

  await chrome.storage.local.set({
    lastKnownMergeState: {
      isMergeDisabled:
        mergeStatusForContentScript === 'disallowed' ||
        mergeStatusForContentScript === 'exception',
      mergeStatus: mergeStatusForContentScript,
      lastSlackMessage: matchingMessageForContentScript,
      channelName: channelName,
      featureEnabled: featureEnabled !== false,
    },
  });

  try {
    await chrome.runtime.sendMessage({ action: 'updateMessages' });
  } catch {
    /* empty */
  }

  if (bitbucketTabId) {
    try {
      const effectiveMergeStatus =
        featureEnabled === false ? 'allowed' : mergeStatusForContentScript;
      const effectiveIsMergeDisabled =
        featureEnabled === false
          ? false
          : mergeStatusForContentScript === 'disallowed' ||
            mergeStatusForContentScript === 'exception';

      await chrome.tabs.sendMessage(bitbucketTabId, {
        action: 'updateMergeButton',
        lastSlackMessage: lastSlackMessage,
        channelName: channelName,
        isMergeDisabled: effectiveIsMergeDisabled,
        mergeStatus: effectiveMergeStatus,
        featureEnabled: featureEnabled !== false,
      });
    } catch {
      /* empty */
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
  } catch {
    /* empty */
  }
}

async function connectToSlackSocketMode() {
  const { slackToken, appToken, channelName } = await chrome.storage.sync.get([
    'slackToken',
    'appToken',
    'channelName',
  ]);

  if (!slackToken || !appToken || !channelName) {
    await chrome.storage.local.set({
      appStatus: 'CONFIG_ERROR',
      messages: [],
    });
    updateExtensionIcon('default');
    return;
  }

  updateExtensionIcon('loading');

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

    const { lastKnownMergeState } =
      (await chrome.storage.local.get('lastKnownMergeState')) ?? {};
    if (lastKnownMergeState?.mergeStatus) {
      updateExtensionIcon(lastKnownMergeState.mergeStatus);
    }

    const wsUrl = connectionsOpenData.url;
    rtmWebSocket = new WebSocket(wsUrl);

    rtmWebSocket.onopen = () => {
      chrome.storage.local.set({ appStatus: 'OK' });
    };

    rtmWebSocket.onmessage = async (event) => {
      const envelope = JSON.parse(event.data);
      if (envelope.payload && envelope.payload.event) {
        const message = envelope.payload.event;
        if (message.type === 'message' && message.ts && message.text) {
          await processAndStoreMessage(message, slackToken);
          await updateContentScriptMergeState(channelName);
        }
      } else if (envelope.type === 'disconnect') {
        rtmWebSocket.close();
      }
    };

    rtmWebSocket.onclose = () => {
      updateExtensionIcon('error');
      chrome.storage.local.set({ appStatus: 'UNKNOWN_ERROR' });
      setTimeout(connectToSlackSocketMode, RECONNECTION_DELAY_MS);
    };

    rtmWebSocket.onerror = () => {
      updateExtensionIcon('error');
      chrome.storage.local.set({ appStatus: 'UNKNOWN_ERROR' });
      rtmWebSocket.close();
    };
  } catch {
    await handleSlackApiError;
    await updateContentScriptMergeState(channelName);
  }
}

async function fetchAndStoreMessages(slackToken, channelId) {
  if (!channelId) {
    return;
  }

  try {
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

      const { status: mergeStatus, message: matchingMessage } =
        determineMergeStatus({
          messages,
          allowedPhrases: currentAllowedPhrases,
          disallowedPhrases: currentDisallowedPhrases,
          exceptionPhrases: currentExceptionPhrases,
        });

      updateExtensionIcon(mergeStatus);
      await chrome.storage.local.set({ lastMatchingMessage: matchingMessage });

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
  getDefaultPhrases: (request, sender, sendResponse) => {
    sendResponse({
      defaultAllowedPhrases: DEFAULT_ALLOWED_PHRASES,
      defaultDisallowedPhrases: DEFAULT_DISALLOWED_PHRASES,
      defaultExceptionPhrases: DEFAULT_EXCEPTION_PHRASES,
    });
    return true;
  },
  fetchNewMessages: async (_request) => {
    const { slackToken, channelName } = await chrome.storage.sync.get([
      'slackToken',
      'channelName',
    ]);
    if (slackToken && channelName) {
      try {
        const channelId = await resolveChannelId(slackToken, channelName);
        await chrome.storage.local.set({ messages: [] });
        await fetchAndStoreMessages(slackToken, channelId);
        await updateContentScriptMergeState(channelName);
      } catch (error) {
        await handleSlackApiError(error);
      }
    }
  },
  reconnectSlack: () => {
    if (rtmWebSocket) {
      rtmWebSocket.close();
    }
    connectToSlackSocketMode();
  },
  bitbucketTabLoaded: async (_request, sender) => {
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
  featureToggleChanged: async (request) => {
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

  countdownCompleted: async (request) => {
    const { enabled } = request;
    await chrome.storage.local.set({ featureEnabled: enabled });

    const { channelName } = await chrome.storage.sync.get('channelName');
    if (channelName) {
      await updateContentScriptMergeState(channelName);
    }
  },

  getCountdownStatus: async (request, sender, sendResponse) => {
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
          result.featureEnabled === false ? 'allowed' : mergeStatus;

        try {
          await chrome.tabs.sendMessage(bitbucketTabId, {
            action: 'updateMergeButton',
            lastSlackMessage: lastSlackMessage,
            channelName: channelName,
            isMergeDisabled: finalIsMergeDisabled,
            mergeStatus: finalMergeStatus,
            featureEnabled: result.featureEnabled !== false,
          });
        } catch {
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
      action: 'updateCountdownDisplay',
      timeLeft,
    });
  } catch {
    // Esta excepción es esperada cuando el popup no está abierto
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
      action: 'countdownCompleted',
      enabled: true,
    });
  } catch {
    // Esta excepción es esperada cuando el popup no está abierto
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
});

chrome.runtime.onStartup.addListener(() => {
  connectToSlackSocketMode();
  registerBitbucketContentScript();
  checkScheduledReactivation();
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
  } catch {
    /* empty */
  }

  if (bitbucketUrl) {
    try {
      await chrome.scripting.registerContentScripts([
        {
          id: 'bitbucket-content-script',
          matches: [bitbucketUrl],
          js: ['slack_frontend_closure_bitbucket_content.js'],
          runAt: 'document_idle',
        },
      ]);
    } catch {
      /* empty */
    }
  }
}
