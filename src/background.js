import { SLACK_CONVERSATIONS_LIST_URL, SLACK_CONVERSATIONS_HISTORY_URL } from './constants.js';

const POLLING_ALARM_NAME = 'slack-poll-alarm';
const MAX_MESSAGES = 100;

// Function to normalize text for comparison (lowercase, remove diacritics, normalize spaces)
function normalizeText(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, ' ')
    .trim();
}

// Function to update the extension icon based on status
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
      path48 = 'images/icon48.png'; // Default icon
      break;
  }
  chrome.action.setIcon({
    path: {
      "16": path16,
      "48": path48
    }
  });
}

async function fetchAndStoreMessages() {
  console.log('Fetching messages...');
  updateExtensionIcon('loading'); // Set icon to loading state

  const { slackToken, channelName, disabledPhrases } = await chrome.storage.sync.get(['slackToken', 'channelName', 'disabledPhrases']);
  if (!slackToken || !channelName) {
    console.log('Token or Channel Name not configured.');
    updateExtensionIcon('error'); // Set icon to error state
    return;
  }

  const disabledPhrasesArray = disabledPhrases ? disabledPhrases.split(',').map(phrase => normalizeText(phrase)) : [normalizeText('Not allowed')];

  let { channelId, cachedChannelName } = await chrome.storage.local.get(['channelId', 'cachedChannelName']);

  // If the channel name has changed, invalidate the cached channel ID
  if (cachedChannelName !== channelName) {
    channelId = null;
  }

  try {
    // 1. Find and cache channel ID if not already present
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
            console.error('Error fetching channels:', result.error);
          }
        }
        return allChannels;
      };

      const allChannels = await fetchAllChannels();
      const foundChannel = allChannels.find(c => c.name === channelName);

      if (!foundChannel) {
        console.error(`Channel "${channelName}" not found in public or private channels.`);
        throw new Error('channel_not_found');
      }
      
      channelId = foundChannel.id;
      await chrome.storage.local.set({ channelId, cachedChannelName: channelName });
      console.log(`Found and cached channel ID: ${channelId} for channel ${channelName}`);
    }

    // 2. Fetch new messages
    const { lastFetchTs } = await chrome.storage.local.get('lastFetchTs');
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

    await chrome.storage.local.set({ appStatus: 'OK' });

    if (historyData.messages && historyData.messages.length > 0) {
      console.log(`Fetched ${historyData.messages.length} new messages.`);
      const newMessages = historyData.messages.map(msg => ({ user: msg.user, text: msg.text, ts: msg.ts }));
      const newLastFetchTs = newMessages[0].ts;

      let { messages: storedMessages = [] } = await chrome.storage.local.get('messages');
      storedMessages.push(...newMessages.reverse());
      
      if (storedMessages.length > MAX_MESSAGES) {
        storedMessages = storedMessages.slice(storedMessages.length - MAX_MESSAGES);
      }

      await chrome.storage.local.set({ messages: storedMessages, lastFetchTs: newLastFetchTs });

      // Determine if merge is disabled and set icon accordingly
      const lastMessageText = normalizeText(newMessages[0].text); // Get the very latest message
      const isMergeDisabled = disabledPhrasesArray.some(phrase => lastMessageText.includes(phrase));

      if (isMergeDisabled) {
        updateExtensionIcon('disabled');
      } else {
        updateExtensionIcon('enabled');
      }

    } else {
      console.log('No new messages.');
      // If no new messages, maintain current status or default to enabled if no previous status
      const { messages: currentMessages = [] } = await chrome.storage.local.get('messages');
      const lastMessageText = normalizeText(currentMessages.length > 0 ? currentMessages[currentMessages.length - 1].text : '');
      const isMergeDisabled = disabledPhrasesArray.some(phrase => lastMessageText.includes(phrase));

      if (isMergeDisabled) {
        updateExtensionIcon('disabled');
      } else {
        updateExtensionIcon('enabled');
      }
    }

  } catch (error) {
    console.error('Error fetching Slack messages:', error.message);
    const errorMessage = error.message;

    if (errorMessage.includes('channel_not_found') || errorMessage.includes('not_in_channel')) {
      await chrome.storage.local.set({ appStatus: 'CHANNEL_ERROR', messages: [], channelId: null });
    } else if (errorMessage.includes('invalid_auth') || errorMessage.includes('token_revoked')) {
      await chrome.storage.local.set({ appStatus: 'TOKEN_TOKEN_ERROR', messages: [] });
    } else {
      await chrome.storage.local.set({ appStatus: 'UNKNOWN_ERROR', messages: [] });
    }
    updateExtensionIcon('error'); // Set icon to error state on any error
  } finally {
    // Save current state to local storage for content script to read on page load
    const { messages: currentMessages = [] } = await chrome.storage.local.get('messages');
    const lastSlackMessage = currentMessages.length > 0 ? currentMessages[currentMessages.length - 1] : null;
    const isMergeDisabledForContentScript = disabledPhrasesArray.some(phrase => lastSlackMessage && normalizeText(lastSlackMessage.text).includes(phrase));

    await chrome.storage.local.set({
      lastKnownMergeState: {
        isMergeDisabled: isMergeDisabledForContentScript,
        lastSlackMessage: lastSlackMessage,
        channelName: channelName
      }
    });

    chrome.runtime.sendMessage({ action: 'updateMessages' });
    // Send the last Slack message to the content script for Bitbucket
    if (bitbucketTabId) {
      console.log("Sending message to Bitbucket tab:", bitbucketTabId);
      chrome.tabs.sendMessage(bitbucketTabId, { action: 'updateMergeButton', lastSlackMessage: lastSlackMessage, channelName: channelName, isMergeDisabled: isMergeDisabledForContentScript });
    } else {
      console.log("No active Bitbucket tab to send message to.");
    }
  }
}

let bitbucketTabId = null;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "bitbucketTabLoaded" && sender.tab && sender.tab.url.includes("bitbucket.rdpnts.com")) {
    bitbucketTabId = sender.tab.id;
    console.log("Bitbucket tab loaded and registered:", bitbucketTabId);

    // Send the last known merge state immediately to the newly loaded tab
    chrome.storage.local.get(['lastKnownMergeState'], (result) => {
      if (result.lastKnownMergeState) {
        const { isMergeDisabled, lastSlackMessage, channelName } = result.lastKnownMergeState;
        chrome.tabs.sendMessage(bitbucketTabId, { action: 'updateMergeButton', lastSlackMessage: lastSlackMessage, channelName: channelName, isMergeDisabled: isMergeDisabled });
      }
    });
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

chrome.runtime.onStartup.addListener(fetchAndStoreMessages);
chrome.runtime.onInstalled.addListener(fetchAndStoreMessages);