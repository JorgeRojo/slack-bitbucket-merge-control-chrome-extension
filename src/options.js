document.addEventListener('DOMContentLoaded', function() {
  const saveButton = document.getElementById('save');
  const tokenInput = document.getElementById('slackToken');
  const channelInput = document.getElementById('channelName');
  const statusDiv = document.getElementById('status');

  // Load saved options
  chrome.storage.sync.get(['slackToken', 'channelName'], function(result) {
    if (result.slackToken) {
      tokenInput.value = result.slackToken;
    }
    if (result.channelName) {
      channelInput.value = result.channelName;
    } else {
      channelInput.value = 'frontend-closure'; // Default value
    }
  });

  saveButton.addEventListener('click', function() {
    const slackToken = tokenInput.value.trim();
    const channelName = channelInput.value.trim().replace(/^#/, ''); // Remove leading # if present

    if (slackToken && channelName) {
      chrome.storage.sync.set({ slackToken, channelName }, function() {
        statusDiv.textContent = 'Options saved.';
        // Also, clear old data when settings change
        chrome.storage.local.remove(['channelId', 'lastFetchTs', 'messages', 'appStatus']);
        setTimeout(function() {
          statusDiv.textContent = '';
        }, 2000);
      });
    } else {
      statusDiv.textContent = 'Please fill in all fields.';
    }
  });
});