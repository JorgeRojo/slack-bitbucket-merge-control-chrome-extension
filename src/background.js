import { SLACK_CONVERSATIONS_LIST_URL, SLACK_CONVERSATIONS_HISTORY_URL } from './constants.js';




chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'readSlackChannel') {
    const channel = request.channel;
    // Replace with your actual Slack Bot User OAuth Token
    // It's highly recommended to store this securely, not hardcoded.
    // For development, you can use a test token.
    chrome.storage.sync.get(['slackToken'], function(result) {
      const SLACK_BOT_TOKEN = result.slackToken; 

    if (!SLACK_BOT_TOKEN) {
        sendResponse({ success: false, error: 'Slack Bot Token not configured. Please go to extension options.' });
        return; // No need for true here as we are not sending response asynchronously
      }

      // First, find the channel ID if a name was provided
      // This step is optional if you always expect a channel ID
      fetch(`${SLACK_CONVERSATIONS_LIST_URL}?types=public_channel,private_channel`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
          'Content-Type': 'application/json'
        }
      })
      .then(response => response.json())
      .then(data => {
        if (data.ok) {
          const foundChannel = data.channels.find(c => c.name === channel || c.id === channel);
          if (foundChannel) {
            const channelId = foundChannel.id;
            // Then, fetch messages from the channel
            fetch(`${SLACK_CONVERSATIONS_HISTORY_URL}?channel=${channelId}`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
                'Content-Type': 'application/json'
              }
            })
            .then(response => response.json())
            .then(data => {
              if (data.ok) {
                // For simplicity, just sending text and user. You might want to fetch user info separately.
                const messages = data.messages.map(msg => ({ user: msg.user, text: msg.text }));
                sendResponse({ success: true, messages: messages });
              } else {
                sendResponse({ success: false, error: data.error });
              }
            })
            .catch(error => {
              sendResponse({ success: false, error: error.message });
            });
          } else {
            sendResponse({ success: false, error: 'Channel not found.' });
          }
        } else {
          sendResponse({ success: false, error: data.error });
        }
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    }); // Closing the chrome.storage.sync.get callback

    return true; // Indicates that sendResponse will be called asynchronously
  }
});