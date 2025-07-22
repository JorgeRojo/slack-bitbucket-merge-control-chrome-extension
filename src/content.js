const BITBUCKET_TAB_LOADED = 'bitbucketTabLoaded';
const UPDATE_MERGE_BUTTON = 'updateMergeButton';

const BitbucketMergeController = (() => {
  let mergeButtonObserver = null;

  function disableMergeButton(mergeButton, channelName, mergeStatus) {
    if (mergeStatus === 'exception') {
      mergeButton.style.backgroundColor = '#FFA500';
    } else {
      mergeButton.style.backgroundColor = '#ef445e';
      mergeButton.style.cursor = 'not-allowed';
    }

    if (mergeButton._customMergeHandler) {
      mergeButton.removeEventListener('click', mergeButton._customMergeHandler, true);
    }

    mergeButton._customMergeHandler = event => {
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

    mergeButton.removeEventListener('click', mergeButton._customMergeHandler, true);
    mergeButton._customMergeHandler = null;
  }

  async function applyMergeButtonLogic(mergeStatus, channelName) {
    const { mergeButtonSelector } = await chrome.storage.sync.get('mergeButtonSelector');
    const mergeButton = document.querySelector(
      mergeButtonSelector || '.merge-button-container > .merge-button'
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

  function applyInitialMergeState() {
    chrome.storage.local.get(['lastKnownMergeState', 'featureEnabled'], result => {
      if (result.lastKnownMergeState) {
        const { mergeStatus, channelName } = result.lastKnownMergeState;

        if (result.featureEnabled === false) {
          applyMergeButtonLogic('allowed', channelName);
        } else {
          applyMergeButtonLogic(mergeStatus, channelName);
        }
      }
    });
  }

  async function observeMergeButton() {
    const targetNode = document.body;
    const config = { childList: true, subtree: true };
    const { mergeButtonSelector } = await chrome.storage.sync.get('mergeButtonSelector');

    const callback = function (_mutationsList, observer) {
      const mergeButton = document.querySelector(
        mergeButtonSelector || '.merge-button-container > .merge-button'
      );
      if (mergeButton) {
        observer.disconnect();
        applyInitialMergeState();
      }
    };

    mergeButtonObserver = new MutationObserver(callback);
    mergeButtonObserver.observe(targetNode, config);
  }

  function handleRuntimeMessage(request) {
    if (request.action === UPDATE_MERGE_BUTTON) {
      if (request.featureEnabled === false) {
        applyMergeButtonLogic('allowed', request.channelName);
      } else {
        applyMergeButtonLogic(request.mergeStatus, request.channelName);
      }
    }
  }

  function init() {
    chrome.runtime.sendMessage({ action: BITBUCKET_TAB_LOADED });
    chrome.runtime.onMessage.addListener(handleRuntimeMessage);
    observeMergeButton();
  }

  return {
    init,
  };
})();

BitbucketMergeController.init();
