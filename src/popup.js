document.addEventListener('DOMContentLoaded', function() {
  const readChannelButton = document.getElementById('readChannel');
  const channelNameInput = document.getElementById('channelName');
  const messagesDiv = document.getElementById('messages');

  // Check if Slack token is set
  chrome.storage.sync.get(['slackToken'], function(result) {
    if (!result.slackToken) {
      messagesDiv.innerHTML = 'Please set your Slack Bot User OAuth Token in the <a href="#" id="openOptions">extension options</a>.';
      document.getElementById('openOptions').addEventListener('click', function() {
        chrome.runtime.openOptionsPage();
      });
      readChannelButton.disabled = true;
      channelNameInput.disabled = true;
    } else {
      readChannelButton.disabled = false;
      channelNameInput.disabled = false;
    }
  });

  readChannelButton.addEventListener('click', function() {
    const channelName = channelNameInput.value.trim();
    if (channelName) {
      messagesDiv.innerHTML = 'Loading messages...';
      chrome.runtime.sendMessage({ action: 'readSlackChannel', channel: channelName }, function(response) {
        if (response.success) {
          messagesDiv.innerHTML = '';
          if (response.messages && response.messages.length > 0) {
            response.messages.forEach(message => {
              const p = document.createElement('p');
              p.textContent = `${message.user}: ${message.text}`;
              messagesDiv.appendChild(p);
            });
          } else {
            messagesDiv.textContent = 'No messages found or channel is empty.';
          }
        } else {
          messagesDiv.textContent = `Error: ${response.error || 'Unknown error'}`;
        }
      });
    } else {
      messagesDiv.textContent = 'Please enter a channel name or ID.';
    }
  });
});