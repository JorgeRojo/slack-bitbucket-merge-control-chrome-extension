import {
  DEFAULT_MERGE_BUTTON_SELECTOR,
  SLACK_CONVERSATIONS_LIST_URL,
  SLACK_AUTH_TEST_URL,
  SLACK_CONNECTIONS_OPEN_URL,
  MAX_MESSAGES,
  DEFAULT_ALLOWED_PHRASES,
  DEFAULT_DISALLOWED_PHRASES,
  DEFAULT_EXCEPTION_PHRASES,
  MAX_MESSAGES_TO_CHECK,
} from './constants.js';

let bitbucketTabId = null;

function normalizeText(text) {
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
  // Replace user mentions like <@U123456789> with @MENTION
  let cleanedText = text.replace(/<@[^>]+>/g, '@MENTION');
  // Replace unnamed channel mentions like <#C123456789> with @CHANNEL
  cleanedText = cleanedText.replace(/<#[^|>]+>/g, '@CHANNEL');
  // Replace channel mentions with name like <#C123456789|channel-name> with channel-name
  cleanedText = cleanedText.replace(/<#[^|]+\|([^>]+)>/g, '$1');
  // Remove other special links like <http://example.com|link text> and keep only the link text
  cleanedText = cleanedText.replace(/<([^|]+)\|([^>]+)>/g, '$2');
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

  for (
    let i = messages.length - 1;
    i >= Math.max(0, messages.length - MAX_MESSAGES_TO_CHECK);
    i--
  ) {
    const message = messages[i];
    const normalizedMessageText = normalizeText(message.text);

    if (
      currentExceptionPhrases.some((keyword) =>
        normalizedMessageText.includes(keyword),
      )
    ) {
      return { status: 'exception', message: message };
    } else if (
      currentDisallowedPhrases.some((keyword) =>
        normalizedMessageText.includes(keyword),
      )
    ) {
      return { status: 'disallowed', message: message };
    } else if (
      currentAllowedPhrases.some((keyword) =>
        normalizedMessageText.includes(keyword),
      )
    ) {
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
          // console.error('Error fetching channels:', result.error);
        }
      }
      return allChannels;
    };

    const allChannels = await fetchAllChannels();
    const foundChannel = allChannels.find((c) => c.name === channelName);

    if (!foundChannel) {
      // console.error(`Channel "${channelName}" not found in public or private channels.`);
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

async function processAndStoreMessages(historyData, _slackToken) {
  if (!historyData.messages || historyData.messages.length === 0) {
    return; // No new messages to process
  }

  const newMessages = historyData.messages.map((msg) => ({
    text: cleanSlackMessageText(msg.text),
    ts: msg.ts,
  }));
  const newLastFetchTs = newMessages[0].ts;

  let { messages: storedMessages = [] } =
    await chrome.storage.local.get('messages');
  storedMessages.push(...newMessages.reverse());

  if (storedMessages.length > MAX_MESSAGES) {
    storedMessages = storedMessages.slice(storedMessages.length - MAX_MESSAGES);
  }

  await chrome.storage.local.set({
    messages: storedMessages,
    lastFetchTs: newLastFetchTs,
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
  // console.error('Error fetching Slack messages:', error.message);
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
  const { messages: currentMessages = [], appStatus } =
    await chrome.storage.local.get(['messages', 'appStatus']);
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
  }

  // If there's an error status, ensure the merge button is enabled (or not disabled by the extension)
  if (
    appStatus &&
    (appStatus.includes('ERROR') || appStatus.includes('TOKEN'))
  ) {
    // If there's an error, we don't want the extension to prevent merging.
    // So, we set the status to 'allowed' for the content script.
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
    },
  });

  try {
    await chrome.runtime.sendMessage({ action: 'updateMessages' });
  } catch (error) {
    console.warn(
      'Could not send message to popup, it might not be open:',
      error.message,
    );
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
      });
    } catch (error) {
      console.warn(
        'Could not send message to Bitbucket tab, resetting bitbucketTabId:',
        error.message,
      );
      bitbucketTabId = null;
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
    } else {
      console.error('Error fetching team ID:', data.error);
    }
  } catch (error) {
    console.error('Error fetching team ID:', error);
  }
}

let rtmWebSocket = null;

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
    await resolveChannelId(slackToken, channelName);

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

    rtmWebSocket.onopen = () => {
      console.log('Connected to Slack Socket Mode WebSocket.');
      updateExtensionIcon('default'); // Assuming connection means good status
      chrome.storage.local.set({ appStatus: 'OK' });
    };

    rtmWebSocket.onmessage = async (event) => {
      const envelope = JSON.parse(event.data);
      console.log('Received WebSocket envelope:', envelope);
      if (envelope.payload && envelope.payload.event) {
        const message = envelope.payload.event;
        if (message.type === 'message' && message.text) {
          // Process and store the message
          const historyData = { messages: [message] };
          await processAndStoreMessages(historyData, slackToken);
          await updateContentScriptMergeState(channelName);
        }
      } else if (envelope.type === 'disconnect') {
        console.warn(
          'Slack Socket Mode WebSocket disconnected:',
          envelope.reason,
        );
        rtmWebSocket.close(); // Close to trigger onclose and reconnect
      }
    };

    rtmWebSocket.onclose = (event) => {
      console.warn(
        'Slack Socket Mode WebSocket closed:',
        event.code,
        event.reason,
      );
      updateExtensionIcon('error');
      chrome.storage.local.set({ appStatus: 'UNKNOWN_ERROR' });
      // Attempt to reconnect after a delay
      setTimeout(connectToSlackSocketMode, 5000);
    };

    rtmWebSocket.onerror = (error) => {
      console.error('Slack Socket Mode WebSocket error:', error);
      updateExtensionIcon('error');
      chrome.storage.local.set({ appStatus: 'UNKNOWN_ERROR' });
      rtmWebSocket.close(); // Close to trigger onclose and reconnect
    };
  } catch (error) {
    console.error('Failed to connect to Slack Socket Mode:', error);
    await handleSlackApiError(error);
    await updateContentScriptMergeState(channelName);
  }
}

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  if (request.action === 'getDefaultPhrases') {
    sendResponse({
      defaultAllowedPhrases: DEFAULT_ALLOWED_PHRASES,
      defaultDisallowedPhrases: DEFAULT_DISALLOWED_PHRASES,
      defaultExceptionPhrases: DEFAULT_EXCEPTION_PHRASES,
    });
    return true;
  } else if (request.action === 'reconnectSlack') {
    if (rtmWebSocket) {
      rtmWebSocket.close();
    }
    connectToSlackSocketMode();
  } else if (request.action === 'bitbucketTabLoaded' && sender.tab) {
    const { bitbucketUrl } = await chrome.storage.sync.get('bitbucketUrl');
    if (bitbucketUrl) {
      const regexPattern = bitbucketUrl.replace(/\*/g, '.*');
      const bitbucketRegex = new RegExp(regexPattern);

      if (bitbucketRegex.test(sender.tab.url)) {
        bitbucketTabId = sender.tab.id;

        chrome.storage.local.get(['lastKnownMergeState'], async (result) => {
          if (result.lastKnownMergeState) {
            const { isMergeDisabled, lastSlackMessage, channelName } =
              result.lastKnownMergeState;
            try {
              await chrome.tabs.sendMessage(bitbucketTabId, {
                action: 'updateMergeButton',
                lastSlackMessage: lastSlackMessage,
                channelName: channelName,
                isMergeDisabled: isMergeDisabled,
              });
            } catch (error) {
              console.warn(
                'Could not send initial message to Bitbucket tab, resetting bitbucketTabId:',
                error.message,
              );
              bitbucketTabId = null;
            }
          }
        });
      }
    }
  }
});

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
      console.log('Bitbucket content script registered for:', bitbucketUrl);
    } catch (error) {
      console.error('Error registering Bitbucket content script:', error);
    }
  }
}

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes.bitbucketUrl) {
    registerBitbucketContentScript();
  }
});
