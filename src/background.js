import { SLACK_CONVERSATIONS_LIST_URL, SLACK_CONVERSATIONS_HISTORY_URL } from './constants.js';

const POLLING_ALARM_NAME = 'slack-poll-alarm';
const MAX_MESSAGES = 100;

async function fetchAndStoreMessages() {
  console.log('Fetching messages...');
  const { slackToken, channelName } = await chrome.storage.sync.get(['slackToken', 'channelName']);
  if (!slackToken || !channelName) {
    console.log('Token or Channel Name not configured.');
    return;
  }

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
    } else {
      console.log('No new messages.');
    }

  } catch (error) {
    console.error('Error fetching Slack messages:', error.message);
    const errorMessage = error.message;

    if (errorMessage.includes('channel_not_found') || errorMessage.includes('not_in_channel')) {
      await chrome.storage.local.set({ appStatus: 'CHANNEL_ERROR', messages: [], channelId: null });
    } else if (errorMessage.includes('invalid_auth') || errorMessage.includes('token_revoked')) {
      await chrome.storage.local.set({ appStatus: 'TOKEN_ERROR', messages: [] });
    } else {
      await chrome.storage.local.set({ appStatus: 'UNKNOWN_ERROR', messages: [] });
    }
  } finally {
    chrome.runtime.sendMessage({ action: 'updateMessages' });
  }
}

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