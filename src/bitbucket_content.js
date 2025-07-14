chrome.runtime.sendMessage({ action: "bitbucketTabLoaded" });

let mergeButtonObserver = null;

function disableMergeButton(mergeButton, lastSlackMessage, channelName) {
  mergeButton.style.backgroundColor = "#ef445e";
  mergeButton.style.color = "white";
  mergeButton.style.cursor = "not-allowed";

  if (mergeButton._customMergeHandler) return;

  mergeButton._customMergeHandler = (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    const cleanedSlackMessage = lastSlackMessage.text
      .replace(/:\w+:/g, "")
      .replace(/<[^>]+>/g, "")
      .trim();
    alert(
      `Merge function is disabled from Slack.\nNotified from channel: #${channelName}\nSlack message: ${cleanedSlackMessage}`
    );
  };
  // Use capture phase to ensure it runs before other handlers
  mergeButton.addEventListener("click", mergeButton._customMergeHandler, true);
}

function enableMergeButton(mergeButton) {
  mergeButton.style.backgroundColor = '';
  mergeButton.style.color = '';
  mergeButton.style.cursor = '';

  if (!mergeButton._customMergeHandler) return;

  mergeButton.removeEventListener("click", mergeButton._customMergeHandler, true);
  mergeButton._customMergeHandler = null;
}

async function applyMergeButtonLogic(isMergeDisabled, lastSlackMessage, channelName) {
  const { mergeButtonSelector } = await chrome.storage.sync.get('mergeButtonSelector');
  const mergeButton = document.querySelector(mergeButtonSelector || '.merge-button');

  if (!mergeButton) {
    return;
  }

  if (isMergeDisabled) {
    disableMergeButton(mergeButton, lastSlackMessage, channelName);
  }
  else {
    enableMergeButton(mergeButton);
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "updateMergeButton") {
    applyMergeButtonLogic(request.isMergeDisabled, request.lastSlackMessage, request.channelName);
  }
});

function applyInitialMergeState() {
  chrome.storage.local.get(["lastKnownMergeState"], (result) => {
    if (result.lastKnownMergeState) {
      const { isMergeDisabled, lastSlackMessage, channelName } =
        result.lastKnownMergeState;
      applyMergeButtonLogic(isMergeDisabled, lastSlackMessage, channelName);
    }
  });
}

async function observeMergeButton() {
  const targetNode = document.body;
  const config = { childList: true, subtree: true };
  const { mergeButtonSelector } = await chrome.storage.sync.get('mergeButtonSelector');

  const callback = function (mutationsList, observer) {
    const mergeButton = document.querySelector(mergeButtonSelector || '.merge-button');
    if (mergeButton) {
      observer.disconnect();
      applyInitialMergeState();
    }
  };

  mergeButtonObserver = new MutationObserver(callback);
  mergeButtonObserver.observe(targetNode, config);
}

observeMergeButton();
