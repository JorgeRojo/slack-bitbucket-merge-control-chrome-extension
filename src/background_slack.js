import {
  SLACK_CONVERSATIONS_LIST_URL,
  SLACK_CONVERSATIONS_HISTORY_URL,
  SLACK_AUTH_TEST_URL,
  SLACK_CONNECTIONS_OPEN_URL,
  MAX_MESSAGES,
} from './constants.js';
import {
  cleanSlackMessageText,
  determineMergeStatus,
  updateExtensionIcon,
  getPhrasesFromStorage,
  updateContentScriptMergeState,
} from './background.js';

let rtmWebSocket = null;

export async function resolveChannelId(slackToken, channelName) {
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

export async function processAndStoreMessage(message, _slackToken) {
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

export async function handleSlackApiError(error) {
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

export async function fetchAndStoreTeamId(slackToken) {
  try {
    const response = await fetch(SLACK_AUTH_TEST_URL, {
      headers: { Authorization: `Bearer ${slackToken}` },
    });
    const data = await response.json();

    if (data.ok) {
      await chrome.storage.local.set({ teamId: data.team_id });
    }
  } catch {
    // Silently handle error - team ID is not critical
  }
}

export async function connectToSlackSocketMode() {
  const { slackAppToken, slackToken, channelName } =
    await chrome.storage.sync.get([
      'slackAppToken',
      'slackToken',
      'channelName',
    ]);

  if (!slackAppToken || !slackToken || !channelName) {
    await chrome.storage.local.set({
      appStatus: 'MISSING_CONFIGURATION',
      messages: [],
    });
    updateExtensionIcon('error');
    return;
  }

  try {
    await fetchAndStoreTeamId(slackToken);

    const channelId = await resolveChannelId(slackToken, channelName);
    await fetchAndStoreMessages(slackToken, channelId);

    if (rtmWebSocket) {
      rtmWebSocket.close();
    }

    const connectionsResponse = await fetch(SLACK_CONNECTIONS_OPEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${slackAppToken}`,
      },
    });

    const connectionsData = await connectionsResponse.json();

    if (!connectionsData.ok) {
      throw new Error(connectionsData.error);
    }

    const wsUrl = connectionsData.url;
    rtmWebSocket = new WebSocket(wsUrl);

    rtmWebSocket.onopen = () => {
      chrome.storage.local.set({ appStatus: 'CONNECTED' });
    };

    rtmWebSocket.onmessage = async (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'events_api' && data.payload) {
        const eventData = data.payload;

        if (eventData.event && eventData.event.type === 'message') {
          const message = eventData.event;

          if (message.channel === channelId && message.text) {
            await processAndStoreMessage(message, slackToken);
          }
        }
      }
    };

    rtmWebSocket.onclose = () => {
      chrome.storage.local.set({ appStatus: 'DISCONNECTED' });
      updateExtensionIcon('error');

      // Attempt to reconnect after 5 seconds
      setTimeout(() => {
        connectToSlackSocketMode();
      }, 5000);
    };

    rtmWebSocket.onerror = (error) => {
      handleSlackApiError(error);
    };
  } catch (error) {
    await handleSlackApiError(error);
  }
}

export async function fetchAndStoreMessages(slackToken, channelId) {
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
