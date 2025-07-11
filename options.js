document.addEventListener('DOMContentLoaded', function() {
  const slackTokenInput = document.getElementById('slackToken');
  const saveButton = document.getElementById('saveButton');
  const statusDiv = document.getElementById('status');

  // Load saved token
  chrome.storage.sync.get(['slackToken'], function(result) {
    if (result.slackToken) {
      slackTokenInput.value = result.slackToken;
    }
  });

  // Save token on button click
  saveButton.addEventListener('click', function() {
    const token = slackTokenInput.value.trim();
    if (token) {
      chrome.storage.sync.set({ slackToken: token }, function() {
        statusDiv.textContent = 'Token saved!';
        setTimeout(() => { statusDiv.textContent = ''; }, 2000);
      });
    } else {
      statusDiv.textContent = 'Please enter a token.';
      statusDiv.style.color = 'red';
      setTimeout(() => { statusDiv.textContent = ''; statusDiv.style.color = 'black'; }, 2000);
    }
  });
});