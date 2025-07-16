chrome.runtime.sendMessage({ action: 'bitbucketTabLoaded' });

let mergeButtonObserver = null;

function disableMergeButton(
  mergeButton,
  lastSlackMessage,
  channelName,
  mergeStatus,
) {
  if (mergeStatus === 'exception') {
    mergeButton.style.backgroundColor = '#FFA500';
  } else {
    mergeButton.style.backgroundColor = '#ef445e';
  }
  mergeButton.style.color = 'white';
  mergeButton.style.cursor = 'not-allowed';

  if (mergeButton._customMergeHandler) return;

  mergeButton._customMergeHandler = (event) => {
    const cleanedSlackMessage = lastSlackMessage.text
      .replace(/:\w+:/g, '')
      .replace(/<[^>]+>/g, '')
      .trim();

    let message = `Merge function is ${mergeStatus} from Slack.`;
    if (mergeStatus === 'disallowed') {
      message += `\nNot allowed to merge.`;
    } else if (mergeStatus === 'exception') {
      message += `\nAllowed with specific exceptions.`;
    }
    message += `\nNotified from channel: #${channelName}\nSlack message: ${cleanedSlackMessage}`;

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

async function applyMergeButtonLogic(
  mergeStatus,
  lastSlackMessage,
  channelName,
) {
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
    disableMergeButton(mergeButton, lastSlackMessage, channelName, mergeStatus);
  } else {
    enableMergeButton(mergeButton);
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'updateMergeButton') {
    applyMergeButtonLogic(
      request.mergeStatus,
      request.lastSlackMessage,
      request.channelName,
    );
  }
});

function applyInitialMergeState() {
  chrome.storage.local.get(['lastKnownMergeState'], (result) => {
    if (result.lastKnownMergeState) {
      const { mergeStatus, lastSlackMessage, channelName } =
        result.lastKnownMergeState;
      applyMergeButtonLogic(mergeStatus, lastSlackMessage, channelName);
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
