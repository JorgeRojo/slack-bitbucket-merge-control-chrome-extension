document.addEventListener('DOMContentLoaded', function() {
  const saveButton = document.getElementById('save');
  const tokenInput = document.getElementById('slackToken');
  const channelInput = document.getElementById('channelName');
  const disabledPhrasesInput = document.getElementById('disabledPhrases');
  const bitbucketUrlInput = document.getElementById('bitbucketUrl');
  const mergeButtonSelectorInput = document.getElementById('mergeButtonSelector');
  const statusDiv = document.getElementById('status');

  // Load saved options
  chrome.storage.sync.get(['slackToken', 'channelName', 'disabledPhrases', 'bitbucketUrl', 'mergeButtonSelector'], function(result) {
    if (result.slackToken) {
      tokenInput.value = result.slackToken;
    }
    if (result.channelName) {
      channelInput.value = result.channelName;
    }
    else {
      channelInput.value = 'frontend-closure'; // Default value
    }
    if (result.disabledPhrases) {
      disabledPhrasesInput.value = result.disabledPhrases.split(',').join('\n');
    }
    else {
      disabledPhrasesInput.value = 'Not allowed\nMerge blocked\nDo not merge'; // Default suggested phrases
    }
    if (result.bitbucketUrl) {
      bitbucketUrlInput.value = result.bitbucketUrl;
    }
    else {
      bitbucketUrlInput.value = 'https://bitbucket.my-company.com/projects/*/repos/*/pull-requests/*/overview*'; // Default value
    }
    if (result.mergeButtonSelector) {
      mergeButtonSelectorInput.value = result.mergeButtonSelector;
    }
    else {
      mergeButtonSelectorInput.value = '.merge-button'; // Default value
    }
  });

  saveButton.addEventListener('click', function() {
    const slackToken = tokenInput.value.trim();
    const channelName = channelInput.value.trim().replace(/^#/, ''); // Remove leading # if present
    const disabledPhrases = disabledPhrasesInput.value.trim().split('\n').map(phrase => phrase.trim()).filter(phrase => phrase !== '').join(',');
    const bitbucketUrl = bitbucketUrlInput.value.trim();
    const mergeButtonSelector = mergeButtonSelectorInput.value.trim();

    if (slackToken && channelName && bitbucketUrl && mergeButtonSelector) {
      chrome.storage.sync.set({ slackToken, channelName, disabledPhrases, bitbucketUrl, mergeButtonSelector }, function() {
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