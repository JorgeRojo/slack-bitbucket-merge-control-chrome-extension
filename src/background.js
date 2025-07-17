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
} from './constants.js';

let bitbucketTabId = null;

let rtmWebSocket = null;

export function normalizeText(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function cleanSlackMessageText(text) {
  if (!text) return '';
  // replace break lines
  text = text.replace(/[\n\r\t]+/g, ' ');
  // Replace user mentions like <@U123456789> with @MENTION
  let cleanedText = text.replace(/<@[^>]+>/g, '@MENTION');
  // Replace unnamed channel mentions like <#C123456789> with @CHANNEL
  cleanedText = cleanedText.replace(/<#[^|>]+>/g, '@CHANNEL');
  // Remove any remaining <...>
  cleanedText = cleanedText.replace(/<[^>]+>/g, '');
  // Replace multiple spaces with a single space
  cleanedText = cleanedText.replace(/\s+/g, ' ').trim();
  return cleanedText;
}

function determineMergeStatus(
  messages,
  allowedPhrases,
  disallowedPhrases,
  exceptionPhrases,
) {
  const currentAllowedPhrases = allowedPhrases.map((phrase) =>
    normalizeText(phrase),
  );
  const currentDisallowedPhrases = disallowedPhrases.map((phrase) =>
    normalizeText(phrase),
  );
  const currentExceptionPhrases = exceptionPhrases.map((phrase) =>
    normalizeText(phrase),
  );

  for (const message of messages) {
    const normalizedMessageText = normalizeText(message.text);

    const matchingExceptionPhrase = currentExceptionPhrases.find((keyword) =>
      normalizedMessageText.includes(keyword),
    );
    if (matchingExceptionPhrase) {
      return { status: 'exception', message: message };
    }

    const matchingDisallowedPhrase = currentDisallowedPhrases.find((keyword) =>
      normalizedMessageText.includes(keyword),
    );
    if (matchingDisallowedPhrase) {
      return { status: 'disallowed', message: message };
    }

    const matchingAllowedPhrase = currentAllowedPhrases.find((keyword) =>
      normalizedMessageText.includes(keyword),
    );
    if (matchingAllowedPhrase) {
      return { status: 'allowed', message: message };
    }
  }

  return { status: 'unknown', message: null };
}

function updateExtensionIcon(status) {
  let path16, path48;
  switch (status) {
    case 'loading':
      path16 = 'images/icon16.png';
      path48 = 'images/icon48.png';
      break;
    case 'allowed':
      path16 = 'images/icon16_enabled.png';
      path48 = 'images/icon48_enabled.png';
      break;
    case 'disallowed':
      path16 = 'images/icon16_disabled.png';
      path48 = 'images/icon48_disabled.png';
      break;
    case 'exception':
      path16 = 'images/icon16_exception.png';
      path48 = 'images/icon48_exception.png';
      break;
    case 'error':
      path16 = 'images/icon16_error.png';
      path48 = 'images/icon48_error.png';
      break;
    default:
      path16 = 'images/icon16.png';
      path48 = 'images/icon48.png';
      break;
  }
  chrome.action.setIcon({
    path: {
      16: path16,
      48: path48,
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
        if (result.ok) {
          allChannels = allChannels.concat(result.channels);
        } else {
          /* empty */
        }
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
    determineMergeStatus(
      storedMessages,
      currentAllowedPhrases,
      currentDisallowedPhrases,
      currentExceptionPhrases,
    );

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
  const errorMessage = error.message;

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

  // If feature is disabled (toggle is off), always allow merges
  if (featureEnabled === false) {
    await chrome.storage.local.set({
      lastKnownMergeState: {
        isMergeDisabled: false,
        mergeStatus: 'allowed',
        lastSlackMessage: null,
        channelName: channelName,
        featureEnabled: false,
      },
    });

    updateExtensionIcon('allowed');

    if (bitbucketTabId) {
      try {
        await chrome.tabs.sendMessage(bitbucketTabId, {
          action: 'updateMergeButton',
          lastSlackMessage: null,
          channelName: channelName,
          isMergeDisabled: false,
          mergeStatus: 'allowed',
          featureEnabled: false,
        });
      } catch {
        /* empty */
      }
    }

    return;
  }

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
    const { status, message } = determineMergeStatus(
      currentMessages,
      currentAllowedPhrases,
      currentDisallowedPhrases,
      currentExceptionPhrases,
    );
    mergeStatusForContentScript = status;
    matchingMessageForContentScript = message;
    updateExtensionIcon(status);
  }

  // If there's an error status, ensure the merge button is enabled (or not disabled by the extension)
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
        mergeStatusForContentScript === 'exception', // Bitbucket only cares if it's disabled or not
      mergeStatus: mergeStatusForContentScript, // New field for more granular status
      lastSlackMessage: matchingMessageForContentScript, // Use the matching message
      channelName: channelName,
      featureEnabled: featureEnabled !== false, // Include feature toggle state
    },
  });

  try {
    await chrome.runtime.sendMessage({ action: 'updateMessages' });
  } catch {
    /* empty */
  }

  if (bitbucketTabId) {
    try {
      await chrome.tabs.sendMessage(bitbucketTabId, {
        action: 'updateMergeButton',
        lastSlackMessage: lastSlackMessage,
        channelName: channelName,
        isMergeDisabled:
          mergeStatusForContentScript === 'disallowed' ||
          mergeStatusForContentScript === 'exception',
        mergeStatus: mergeStatusForContentScript, // Pass granular status to content script
        featureEnabled: featureEnabled !== false, // Include feature toggle state
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
    await fetchAndStoreTeamId(slackToken);
    const channelId = await resolveChannelId(slackToken, channelName);
    await fetchAndStoreMessages(slackToken, channelId);

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
        rtmWebSocket.close(); // Close to trigger onclose and reconnect
      }
    };

    rtmWebSocket.onclose = () => {
      updateExtensionIcon('error');
      chrome.storage.local.set({ appStatus: 'UNKNOWN_ERROR' });
      // Attempt to reconnect after a delay
      setTimeout(connectToSlackSocketMode, 5000);
    };

    rtmWebSocket.onerror = () => {
      updateExtensionIcon('error');
      chrome.storage.local.set({ appStatus: 'UNKNOWN_ERROR' });
      rtmWebSocket.close(); // Close to trigger onclose and reconnect
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

      // Recalcular lastMatchingMessage usando las funciones existentes
      const {
        currentAllowedPhrases,
        currentDisallowedPhrases,
        currentExceptionPhrases,
      } = await getPhrasesFromStorage();

      const { status: mergeStatus, message: matchingMessage } =
        determineMergeStatus(
          messages,
          currentAllowedPhrases,
          currentDisallowedPhrases,
          currentExceptionPhrases,
        );

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
  bitbucketTabLoaded: async (request, sender) => {
    if (sender.tab) {
      const { bitbucketUrl } = await chrome.storage.sync.get('bitbucketUrl');
      if (bitbucketUrl) {
        const regexPattern = bitbucketUrl.replace(/\*/g, '.*');
        const bitbucketRegex = new RegExp(regexPattern);

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

    const { channelName } = await chrome.storage.sync.get('channelName');
    if (channelName) {
      await updateContentScriptMergeState(channelName);
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

        // If feature is disabled via toggle, always allow merges
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
});

chrome.runtime.onStartup.addListener(() => {
  connectToSlackSocketMode();
  registerBitbucketContentScript();
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
