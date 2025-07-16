chrome.runtime.sendMessage({ action: 'bitbucketTabLoaded' });

let mergeButtonObserver = null;

function disableMergeButton(mergeButton, channelName, mergeStatus) {
  if (mergeStatus === 'exception') {
    mergeButton.style.backgroundColor = '#FFA500';
  } else {
    mergeButton.style.backgroundColor = '#ef445e';
    mergeButton.style.cursor = 'not-allowed';
  }

  if (mergeButton._customMergeHandler) {
    mergeButton.removeEventListener(
      'click',
      mergeButton._customMergeHandler,
      true,
    );
  }

  mergeButton._customMergeHandler = (event) => {
    let message = ``;
    if (mergeStatus === 'disallowed') {
      message = `Merge function is disallowed from Slack.`;
    } else if (mergeStatus === 'exception') {
      message = `Merge function is allowed with specific exceptions.`;
    }

    message += `\nNotified from channel: #${channelName}`;

    if (mergeStatus === 'exception') {
      if (!confirm(message)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    } else {
      alert(message);
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  };

  mergeButton.addEventListener('click', mergeButton._customMergeHandler, true);
}

function enableMergeButton(mergeButton) {
  mergeButton.style.backgroundColor = '';
  mergeButton.style.color = '';
  mergeButton.style.cursor = '';

  if (!mergeButton._customMergeHandler) return;

  mergeButton.removeEventListener(
    'click',
    mergeButton._customMergeHandler,
    true,
  );
  mergeButton._customMergeHandler = null;
}

async function applyMergeButtonLogic(mergeStatus, channelName) {
  const { mergeButtonSelector } = await chrome.storage.sync.get(
    'mergeButtonSelector',
  );
  const mergeButton = document.querySelector(
    mergeButtonSelector || '.merge-button-container > .merge-button',
  );

  if (!mergeButton) {
    return;
  }

  if (mergeStatus === 'disallowed' || mergeStatus === 'exception') {
    disableMergeButton(mergeButton, channelName, mergeStatus);
  } else {
    enableMergeButton(mergeButton);
  }
}

chrome.runtime.onMessage.addListener((request) => {
  if (request.action === 'updateMergeButton') {
    applyMergeButtonLogic(request.mergeStatus, request.channelName);
  }
});

function applyInitialMergeState() {
  chrome.storage.local.get(['lastKnownMergeState'], (result) => {
    if (result.lastKnownMergeState) {
      const { mergeStatus, channelName } = result.lastKnownMergeState;
      applyMergeButtonLogic(mergeStatus, channelName);
    }
  });
}

async function observeMergeButton() {
  const targetNode = document.body;
  const config = { childList: true, subtree: true };
  const { mergeButtonSelector } = await chrome.storage.sync.get(
    'mergeButtonSelector',
  );

  const callback = function (mutationsList, observer) {
    const mergeButton = document.querySelector(
      mergeButtonSelector || '.merge-button-container > .merge-button',
    );
    if (mergeButton) {
      observer.disconnect();
      applyInitialMergeState();
    }
  };

  mergeButtonObserver = new MutationObserver(callback);
  mergeButtonObserver.observe(targetNode, config);
}

observeMergeButton();
