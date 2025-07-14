document.addEventListener('DOMContentLoaded', function() {
  const saveButton = document.getElementById('save');
  const tokenInput = document.getElementById('slackToken');
  const channelInput = document.getElementById('channelName');
  const disabledPhrasesInput = document.getElementById('disabledPhrases');
  const statusDiv = document.getElementById('status');

  // Load saved options
  chrome.storage.sync.get(['slackToken', 'channelName', 'disabledPhrases'], function(result) {
    if (result.slackToken) {
      tokenInput.value = result.slackToken;
    }
    if (result.channelName) {
      channelInput.value = result.channelName;
    } else {
      channelInput.value = 'frontend-closure'; // Default value
    }
    if (result.disabledPhrases) {
      disabledPhrasesInput.value = result.disabledPhrases;
    } else {
      disabledPhrasesInput.value = 'Not allowed,Merge blocked,Do not merge'; // Default suggested phrases
    }
  });

  saveButton.addEventListener('click', function() {
    const slackToken = tokenInput.value.trim();
    const channelName = channelInput.value.trim().replace(/^#/, ''); // Remove leading # if present
    const disabledPhrases = disabledPhrasesInput.value.trim();

    if (slackToken && channelName) {
      chrome.storage.sync.set({ slackToken, channelName, disabledPhrases }, function() {
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