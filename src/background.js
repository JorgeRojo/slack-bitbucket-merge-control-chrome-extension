import { SLACK_CONVERSATIONS_LIST_URL, SLACK_CONVERSATIONS_HISTORY_URL } from './constants.js';

const POLLING_ALARM_NAME = 'slack-poll-alarm';
const MAX_MESSAGES = 100;

function normalizeText(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, ' ')
    .trim();
}

function updateExtensionIcon(status) {
  let path16, path48;
  switch (status) {
    case 'loading':
      path16 = 'images/icon16.png';
      path48 = 'images/icon48.png';
      break;
    case 'enabled':
      path16 = 'images/icon16_enabled.png';
      path48 = 'images/icon48_enabled.png';
      break;
    case 'disabled':
      path16 = 'images/icon16_disabled.png';
      path48 = 'images/icon48_disabled.png';
      break;
    case 'error':
      path16 = 'images/icon16_error.png';
      path48 = 'images/icon48_error.png';
      break;
    default:
      path16 = 'images/icon16.png'; // Default icon
      path48 = 'images/icon48.png';
      break;
  }
  chrome.action.setIcon({
    path: {
      "16": path16,
      "48": path48
    }
  });
}

// New helper functions
async function getSlackConfig() {
  const { slackToken, channelName, disabledPhrases } = await chrome.storage.sync.get(['slackToken', 'channelName', 'disabledPhrases']);
  if (!slackToken || !channelName) {
    updateExtensionIcon('default');
    throw new Error('Slack token or channel name not configured.');
  }
  const disabledPhrasesArray = disabledPhrases ? disabledPhrases.split(',').map(phrase => normalizeText(phrase)) : [normalizeText('Not allowed')];
  return { slackToken, channelName, disabledPhrasesArray };
}

async function resolveChannelId(slackToken, channelName) {
  let { channelId, cachedChannelName } = await chrome.storage.local.get(['channelId', 'cachedChannelName']);

  if (cachedChannelName !== channelName) {
    channelId = null;
  }

  if (!channelId) {
    const fetchAllChannels = async () => {
      const channelTypes = ['public_channel', 'private_channel'];
      const promises = channelTypes.map(type =>
        fetch(`${SLACK_CONVERSATIONS_LIST_URL}?types=${type}`, {
          headers: { 'Authorization': `Bearer ${slackToken}` }
        }).then(res => res.json())
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
    const foundChannel = allChannels.find(c => c.name === channelName);

    if (!foundChannel) {
      // console.error(`Channel "${channelName}" not found in public or private channels.`);
      throw new Error('channel_not_found');
    }

    channelId = foundChannel.id;
    await chrome.storage.local.set({ channelId, cachedChannelName: channelName });
  }
  return channelId;
}

async function fetchSlackHistory(slackToken, channelId, lastFetchTs) {
  const historyUrl = new URL(SLACK_CONVERSATIONS_HISTORY_URL);
  historyUrl.searchParams.append('channel', channelId);
  if (lastFetchTs) {
    historyUrl.searchParams.append('oldest', lastFetchTs);
  }
  historyUrl.searchParams.append('limit', 100);

  const historyResponse = await fetch(historyUrl, {
    headers: { 'Authorization': `Bearer ${slackToken}` }
  });
  const historyData = await historyResponse.json();
  if (!historyData.ok) throw new Error(historyData.error);
  return historyData;
}

async function processAndStoreMessages(historyData, disabledPhrasesArray) {
  if (historyData.messages && historyData.messages.length > 0) {
    const newMessages = historyData.messages.map(msg => ({ user: msg.user, text: msg.text, ts: msg.ts }));
    const newLastFetchTs = newMessages[0].ts;

    let { messages: storedMessages = [] } = await chrome.storage.local.get('messages');
    storedMessages.push(...newMessages.reverse());

    if (storedMessages.length > MAX_MESSAGES) {
      storedMessages = storedMessages.slice(storedMessages.length - MAX_MESSAGES);
    }

    await chrome.storage.local.set({ messages: storedMessages, lastFetchTs: newLastFetchTs });

    const lastMessageText = normalizeText(newMessages[0].text);
    const isMergeDisabled = disabledPhrasesArray.some(phrase => lastMessageText.includes(phrase));
    updateExtensionIcon(isMergeDisabled ? 'disabled' : 'enabled');
  } else {
    const { messages: currentMessages = [] } = await chrome.storage.local.get('messages');
    const lastMessageText = normalizeText(currentMessages.length > 0 ? currentMessages[currentMessages.length - 1].text : '');
    const isMergeDisabled = disabledPhrasesArray.some(phrase => lastMessageText.includes(phrase));
    updateExtensionIcon(isMergeDisabled ? 'disabled' : 'enabled');
  }
}

async function handleSlackApiError(error) {
  // console.error('Error fetching Slack messages:', error.message);
  const errorMessage = error.message;

  if (errorMessage.includes('channel_not_found') || errorMessage.includes('not_in_channel')) {
    await chrome.storage.local.set({ appStatus: 'CHANNEL_ERROR', messages: [], channelId: null });
  } else if (errorMessage.includes('invalid_auth') || errorMessage.includes('token_revoked')) {
    await chrome.storage.local.set({ appStatus: 'TOKEN_TOKEN_ERROR', messages: [] });
  } else {
    await chrome.storage.local.set({ appStatus: 'UNKNOWN_ERROR', messages: [] });
  }
  updateExtensionIcon('error');
}

async function updateContentScriptMergeState(disabledPhrasesArray, channelName) {
  const { messages: currentMessages = [], appStatus } = await chrome.storage.local.get(['messages', 'appStatus']);
  const lastSlackMessage = currentMessages.length > 0 ? currentMessages[currentMessages.length - 1] : null;
  let isMergeDisabledForContentScript = disabledPhrasesArray.some(phrase => lastSlackMessage && normalizeText(lastSlackMessage.text).includes(phrase));

  // If there's an error status, ensure the merge button is enabled
  if (appStatus && (appStatus.includes('ERROR') || appStatus.includes('TOKEN'))) {
    isMergeDisabledForContentScript = false;
  }

  await chrome.storage.local.set({
    lastKnownMergeState: {
      isMergeDisabled: isMergeDisabledForContentScript,
      lastSlackMessage: lastSlackMessage,
      channelName: channelName
    }
  });

  try {
    await chrome.runtime.sendMessage({ action: 'updateMessages' });
  } catch (error) {
    console.warn('Could not send message to popup, it might not be open:', error.message);
  }
  if (bitbucketTabId) {
    try {
      await chrome.tabs.sendMessage(bitbucketTabId, { action: 'updateMergeButton', lastSlackMessage: lastSlackMessage, channelName: channelName, isMergeDisabled: isMergeDisabledForContentScript });
    } catch (error) {
      console.warn('Could not send message to Bitbucket tab, resetting bitbucketTabId:', error.message);
      bitbucketTabId = null;
    }
  }
}

async function fetchAndStoreMessages() {
  
  updateExtensionIcon('loading');
  let channelName = '';
  let disabledPhrasesArray = [];

  try {
    const config = await getSlackConfig();
    const { slackToken, channelName: configChannelName, disabledPhrasesArray: configDisabledPhrasesArray } = config;
    channelName = configChannelName;
    disabledPhrasesArray = configDisabledPhrasesArray;

    const channelId = await resolveChannelId(slackToken, channelName);
    const { lastFetchTs } = await chrome.storage.local.get('lastFetchTs');
    const historyData = await fetchSlackHistory(slackToken, channelId, lastFetchTs);

    await chrome.storage.local.set({ appStatus: 'OK' });
    await processAndStoreMessages(historyData, disabledPhrasesArray);

  } catch (error) {
    await handleSlackApiError(error);
  } finally {
    await updateContentScriptMergeState(disabledPhrasesArray, channelName);
  }
}

let bitbucketTabId = null;

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  if (request.action === "bitbucketTabLoaded" && sender.tab) {
    const { bitbucketUrl } = await chrome.storage.sync.get('bitbucketUrl');
    if (bitbucketUrl) {
      // Convert glob to regex. This is a simplified conversion.
      // For a full robust solution, a dedicated glob-to-regex library would be ideal.
      const regexPattern = bitbucketUrl.replace(/\*/g, '.*'); // Escape * for regex
      const bitbucketRegex = new RegExp(regexPattern);

      if (bitbucketRegex.test(sender.tab.url)) {
        bitbucketTabId = sender.tab.id;

        // Send the last known merge state immediately to the newly loaded tab
        chrome.storage.local.get(['lastKnownMergeState'], async (result) => {
          if (result.lastKnownMergeState) {
            const { isMergeDisabled, lastSlackMessage, channelName } = result.lastKnownMergeState;
            try {
              await chrome.tabs.sendMessage(bitbucketTabId, { action: 'updateMergeButton', lastSlackMessage: lastSlackMessage, channelName: channelName, isMergeDisabled: isMergeDisabled });
            } catch (error) {
              console.warn('Could not send initial message to Bitbucket tab, resetting bitbucketTabId:', error.message);
              bitbucketTabId = null;
            }
          }
        });
      }
    }
  }
});

chrome.alarms.create(POLLING_ALARM_NAME, {
  periodInMinutes: 1 / 12 // 5 seconds
});

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === POLLING_ALARM_NAME) {
    fetchAndStoreMessages();
  }
});

chrome.runtime.onInstalled.addListener(() => {
  fetchAndStoreMessages();
  registerBitbucketContentScript();
});

chrome.runtime.onStartup.addListener(() => {
  fetchAndStoreMessages();
  registerBitbucketContentScript();
});

async function registerBitbucketContentScript() {
  const { bitbucketUrl } = await chrome.storage.sync.get('bitbucketUrl');

  // Clear existing dynamic scripts to avoid duplicates or old patterns
  try {
    await chrome.scripting.unregisterContentScripts({
      ids: ['bitbucket-content-script']
    });
  } catch (e) {
    // Ignore error if script was not registered
  }

  if (bitbucketUrl) {
    try {
      await chrome.scripting.registerContentScripts([
        {
          id: 'bitbucket-content-script',
          matches: [bitbucketUrl],
          js: ['bitbucket_content.js'],
          runAt: 'document_idle'
        }
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