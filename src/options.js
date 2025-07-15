document.addEventListener('DOMContentLoaded', function() {
  const saveButton = document.getElementById('save');
  const tokenInput = document.getElementById('slackToken');
  const channelInput = document.getElementById('channelName');
  const allowedPhrasesInput = document.getElementById('allowedPhrases');
  const disallowedPhrasesInput = document.getElementById('disallowedPhrases');
  const exceptionPhrasesInput = document.getElementById('exceptionPhrases');
  const bitbucketUrlInput = document.getElementById('bitbucketUrl');
  const mergeButtonSelectorInput = document.getElementById('mergeButtonSelector');
  const statusDiv = document.getElementById('status');

  // Default phrases will be fetched from background.js

  // Load saved options
  chrome.storage.sync.get([
    'slackToken',
    'channelName',
    'allowedPhrases',
    'disallowedPhrases',
    'exceptionPhrases',
    'bitbucketUrl',
    'mergeButtonSelector'
  ], async function(result) {
    const defaultPhrases = await chrome.runtime.sendMessage({ action: "getDefaultPhrases" });

    if (result.slackToken) {
      tokenInput.value = result.slackToken;
    }
    if (result.channelName) {
      channelInput.value = result.channelName;
    } else {
      channelInput.value = 'frontend-closure'; // Default value
    }
    if (result.allowedPhrases) {
      allowedPhrasesInput.value = result.allowedPhrases.split(',').join('\n');
    }
    else {
      allowedPhrasesInput.value = defaultPhrases.defaultAllowedPhrases.join('\n');
    }
    if (result.disallowedPhrases) {
      disallowedPhrasesInput.value = result.disallowedPhrases.split(',').join('\n');
    }
    else {
      disallowedPhrasesInput.value = defaultPhrases.defaultDisallowedPhrases.join('\n');
    }
    if (result.exceptionPhrases) {
      exceptionPhrasesInput.value = result.exceptionPhrases.split(',').join('\n');
    }
    else {
      exceptionPhrasesInput.value = defaultPhrases.defaultExceptionPhrases.join('\n');
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
    const allowedPhrases = allowedPhrasesInput.value.trim().split('\n').map(phrase => phrase.trim()).filter(phrase => phrase !== '').join(',');
    const disallowedPhrases = disallowedPhrasesInput.value.trim().split('\n').map(phrase => phrase.trim()).filter(phrase => phrase !== '').join(',');
    const exceptionPhrases = exceptionPhrasesInput.value.trim().split('\n').map(phrase => phrase.trim()).filter(phrase => phrase !== '').join(',');
    const bitbucketUrl = bitbucketUrlInput.value.trim();
    const mergeButtonSelector = mergeButtonSelectorInput.value.trim();

    if (slackToken && channelName && bitbucketUrl && mergeButtonSelector) {
      chrome.storage.sync.set({
        slackToken,
        channelName,
        allowedPhrases,
        disallowedPhrases,
        exceptionPhrases,
        bitbucketUrl,
        mergeButtonSelector
      }, function() {
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